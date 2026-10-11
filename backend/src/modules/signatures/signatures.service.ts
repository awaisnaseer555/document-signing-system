import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { AuthUser } from '../../common/types';
import { AssignmentsService } from '../assignments/assignments.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class SignaturesService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly assignments: AssignmentsService,
    private readonly audit: AuditService,
  ) {}

  async submit(
    user: AuthUser,
    assignmentId: string,
    signatureDataUrl: string,
  ) {
    const assignment = await this.assignments.getAuthorized(
      user,
      assignmentId,
    );

    if (user.role !== 'EMPLOYEE' || assignment.assignee_id !== user.id) {
      throw new BadRequestException('Only the assignee can sign');
    }

    if (assignment.status === 'SIGNED') {
      throw new ConflictException('Assignment already signed');
    }
    if (assignment.status === 'REVOKED') {
      throw new BadRequestException('Assignment is revoked');
    }

    const existing = Array.isArray(assignment.signature)
      ? assignment.signature[0]
      : assignment.signature;
    if (existing) {
      throw new ConflictException('Signature already exists');
    }

    if (!assignment.document?.original_storage_path) {
      throw new BadRequestException('Original document missing');
    }

    const base64 = signatureDataUrl.replace(/^data:image\/png;base64,/, '');
    const signatureBuffer = Buffer.from(base64, 'base64');
    if (signatureBuffer.length < 100) {
      throw new BadRequestException('Signature image is empty or invalid');
    }

    const originalPdf = await this.storage.download(
      'documents',
      assignment.document.original_storage_path,
    );

    const signedPdfBuffer = await this.composeSignedPdf(
      originalPdf,
      signatureBuffer,
      user,
    );

    const signatureImagePath = await this.storage.uploadSignaturePng(
      assignmentId,
      signatureBuffer,
    );
    const signedPdfPath = await this.storage.uploadSignedPdf(
      assignmentId,
      signedPdfBuffer,
    );

    const signedAt = new Date().toISOString();

    // Claim the assignment first to block concurrent duplicate submissions
    const { data: claimed, error: claimError } = await this.supabase.admin
      .from('document_assignments')
      .update({
        status: 'SIGNED',
        signed_at: signedAt,
        submitted_at: signedAt,
      })
      .eq('id', assignmentId)
      .in('status', ['PENDING', 'VIEWED'])
      .select('id')
      .maybeSingle();

    if (claimError) {
      throw new InternalServerErrorException(claimError.message);
    }
    if (!claimed) {
      throw new ConflictException('Assignment already signed or unavailable');
    }

    const { data: signature, error: sigError } = await this.supabase.admin
      .from('document_signatures')
      .insert({
        assignment_id: assignmentId,
        signer_id: user.id,
        signature_image_path: signatureImagePath,
        signed_pdf_path: signedPdfPath,
        signed_at: signedAt,
        submission_metadata: {
          signedAt,
          composer: 'server-pdf-lib',
        },
      })
      .select('*')
      .single();

    if (sigError || !signature) {
      // Best-effort rollback of claim if signature insert fails
      await this.supabase.admin
        .from('document_assignments')
        .update({
          status: assignment.status,
          signed_at: null,
          submitted_at: null,
        })
        .eq('id', assignmentId)
        .eq('status', 'SIGNED');
      throw new InternalServerErrorException(
        sigError?.message ?? 'Failed to save signature',
      );
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'assignment',
      entityId: assignmentId,
      documentId: assignment.document_id ?? assignment.document?.id ?? null,
      assignmentId,
      action: 'SIGNED',
      metadata: {
        signedPdfPath,
        signatureImagePath,
        signedAt,
      },
    });

    return this.assignments.getAuthorized(user, assignmentId);
  }

  private async composeSignedPdf(
    originalPdf: Buffer,
    signaturePng: Buffer,
    user: AuthUser,
  ) {
    const pdfDoc = await PDFDocument.load(originalPdf);
    const pngImage = await pdfDoc.embedPng(signaturePng);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const lastPage = pages[pages.length - 1];
    const { width } = lastPage.getSize();

    const sigWidth = Math.min(220, width * 0.4);
    const sigHeight = (pngImage.height / pngImage.width) * sigWidth;

    lastPage.drawImage(pngImage, {
      x: 48,
      y: 72,
      width: sigWidth,
      height: sigHeight,
    });

    lastPage.drawText(`Signed by: ${user.fullName ?? user.email}`, {
      x: 48,
      y: 56,
      size: 10,
      font,
    });
    lastPage.drawText(`Date: ${new Date().toISOString()}`, {
      x: 48,
      y: 42,
      size: 9,
      font,
    });

    const bytes = await pdfDoc.save();
    return Buffer.from(bytes);
  }
}
