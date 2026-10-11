import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

const MAX_PDF_BYTES = 25 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 120;

@Injectable()
export class StorageService {
  constructor(private readonly supabase: SupabaseService) {}

  assertPdf(file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('PDF file is required');
    }
    if (file.size > MAX_PDF_BYTES) {
      throw new BadRequestException('PDF exceeds 25MB limit');
    }
    const name = file.originalname?.toLowerCase() ?? '';
    const mimeOk =
      file.mimetype === 'application/pdf' || name.endsWith('.pdf');
    if (!mimeOk) {
      throw new BadRequestException('Only PDF files are allowed');
    }
  }

  async uploadOriginalPdf(documentId: string, file: Express.Multer.File) {
    this.assertPdf(file);
    const path = `originals/${documentId}/${Date.now()}.pdf`;
    const { error } = await this.supabase.admin.storage
      .from('documents')
      .upload(path, file.buffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload PDF: ${error.message}`,
      );
    }
    return path;
  }

  async uploadSignaturePng(assignmentId: string, pngBuffer: Buffer) {
    const path = `signatures/${assignmentId}/${Date.now()}.png`;
    const { error } = await this.supabase.admin.storage
      .from('signatures')
      .upload(path, pngBuffer, {
        contentType: 'image/png',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload signature: ${error.message}`,
      );
    }
    return path;
  }

  async uploadSignedPdf(assignmentId: string, pdfBuffer: Buffer) {
    const path = `signed/${assignmentId}/${Date.now()}.pdf`;
    const { error } = await this.supabase.admin.storage
      .from('signatures')
      .upload(path, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });
    if (error) {
      throw new InternalServerErrorException(
        `Failed to upload signed PDF: ${error.message}`,
      );
    }
    return path;
  }

  async download(bucket: 'documents' | 'signatures', path: string) {
    const { data, error } = await this.supabase.admin.storage
      .from(bucket)
      .download(path);
    if (error || !data) {
      throw new InternalServerErrorException(
        `Failed to download file: ${error?.message ?? 'unknown'}`,
      );
    }
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl(bucket: 'documents' | 'signatures', path: string) {
    const { data, error } = await this.supabase.admin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
    if (error || !data?.signedUrl) {
      throw new InternalServerErrorException(
        `Failed to create signed URL: ${error?.message ?? 'unknown'}`,
      );
    }
    return {
      url: data.signedUrl,
      expiresIn: SIGNED_URL_TTL_SECONDS,
    };
  }
}
