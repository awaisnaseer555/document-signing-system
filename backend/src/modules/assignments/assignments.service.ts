import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { AssignmentRecord, AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateAssignmentDto } from './dto/create-assignment.dto';

@Injectable()
export class AssignmentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private assignmentSelect = `
    *,
    document:documents(*),
    assignee:profiles!document_assignments_assignee_id_fkey(id, email, full_name, role),
    assigner:profiles!document_assignments_assigned_by_fkey(id, email, full_name),
    signature:document_signatures(id, signed_pdf_path, created_at, signer_id)
  `;

  async create(user: AuthUser, dto: CreateAssignmentDto) {
    const { data: employee, error: empError } = await this.supabase.admin
      .from('profiles')
      .select('id, role')
      .eq('id', dto.assigneeId)
      .maybeSingle();

    if (empError || !employee || employee.role !== 'EMPLOYEE') {
      throw new BadRequestException('Assignee must be an employee');
    }

    const { data: document, error: docError } = await this.supabase.admin
      .from('documents')
      .select('id')
      .eq('id', dto.documentId)
      .maybeSingle();

    if (docError || !document) {
      throw new BadRequestException('Document not found');
    }

    const { data, error } = await this.supabase.admin
      .from('document_assignments')
      .insert({
        document_id: dto.documentId,
        assignee_id: dto.assigneeId,
        assigned_by: user.id,
        due_date: dto.dueDate ?? null,
        status: 'PENDING',
      })
      .select(this.assignmentSelect)
      .single();

    if (error || !data) {
      throw new BadRequestException(
        error?.message ?? 'Failed to create assignment',
      );
    }

    const row = data as unknown as AssignmentRecord;

    await this.audit.log({
      actorId: user.id,
      entityType: 'assignment',
      entityId: row.id,
      documentId: dto.documentId,
      assignmentId: row.id,
      action: 'ASSIGNED',
      metadata: {
        documentId: dto.documentId,
        assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ?? null,
      },
    });

    return row;
  }

  async list(user: AuthUser, status?: string, q?: string) {
    let query = this.supabase.admin
      .from('document_assignments')
      .select(this.assignmentSelect)
      .order('created_at', { ascending: false });

    if (user.role === 'EMPLOYEE') {
      query = query.eq('assignee_id', user.id).neq('status', 'REVOKED');
    }

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }

    let rows = (data ?? []) as unknown as AssignmentRecord[];
    if (q?.trim()) {
      const needle = q.trim().toLowerCase();
      rows = rows.filter((row) => {
        const title = row.document?.title ?? '';
        const email = row.assignee?.email ?? '';
        const name = row.assignee?.full_name ?? '';
        return (
          title.toLowerCase().includes(needle) ||
          email.toLowerCase().includes(needle) ||
          name.toLowerCase().includes(needle)
        );
      });
    }

    return rows;
  }

  async getAuthorized(user: AuthUser, id: string) {
    const { data, error } = await this.supabase.admin
      .from('document_assignments')
      .select(this.assignmentSelect)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Assignment not found');
    }

    const row = data as unknown as AssignmentRecord;

    if (user.role === 'EMPLOYEE' && row.assignee_id !== user.id) {
      throw new NotFoundException('Assignment not found');
    }

    return row;
  }

  async markViewed(user: AuthUser, id: string) {
    const assignment = await this.getAuthorized(user, id);
    if (user.role !== 'EMPLOYEE') {
      throw new ForbiddenException('Only employees mark viewed');
    }
    if (assignment.status === 'SIGNED' || assignment.status === 'REVOKED') {
      return assignment;
    }

    const { data, error } = await this.supabase.admin
      .from('document_assignments')
      .update({
        status: 'VIEWED',
        viewed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(this.assignmentSelect)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to update assignment',
      );
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'assignment',
      entityId: id,
      documentId: assignment.document_id ?? assignment.document?.id ?? null,
      assignmentId: id,
      action: 'VIEWED',
    });

    return data as unknown as AssignmentRecord;
  }

  async revoke(user: AuthUser, id: string) {
    const assignment = await this.getAuthorized(user, id);
    if (assignment.status === 'SIGNED') {
      throw new BadRequestException('Cannot revoke a signed assignment');
    }

    const { data, error } = await this.supabase.admin
      .from('document_assignments')
      .update({ status: 'REVOKED' })
      .eq('id', id)
      .select(this.assignmentSelect)
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to revoke assignment',
      );
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'assignment',
      entityId: id,
      documentId: assignment.document_id ?? assignment.document?.id ?? null,
      assignmentId: id,
      action: 'REVOKED',
    });

    return data as unknown as AssignmentRecord;
  }

  async getOriginalFileUrl(user: AuthUser, id: string) {
    const assignment = await this.getAuthorized(user, id);
    if (assignment.status === 'REVOKED' && user.role === 'EMPLOYEE') {
      throw new ForbiddenException('Assignment revoked');
    }

    if (!assignment.document?.original_storage_path) {
      throw new NotFoundException('Document file missing');
    }

    if (user.role === 'EMPLOYEE' && assignment.status === 'PENDING') {
      await this.markViewed(user, id);
    }

    return this.storage.createSignedUrl(
      'documents',
      assignment.document.original_storage_path,
    );
  }

  async getSignedFileUrl(user: AuthUser, id: string) {
    const assignment = await this.getAuthorized(user, id);
    const signature = Array.isArray(assignment.signature)
      ? assignment.signature[0]
      : assignment.signature;

    if (!signature?.signed_pdf_path) {
      throw new NotFoundException('Signed PDF not available');
    }

    if (
      user.role === 'EMPLOYEE' &&
      (assignment.assignee_id !== user.id || assignment.status !== 'SIGNED')
    ) {
      throw new ForbiddenException('Not allowed');
    }

    return this.storage.createSignedUrl(
      'signatures',
      signature.signed_pdf_path,
    );
  }
}
