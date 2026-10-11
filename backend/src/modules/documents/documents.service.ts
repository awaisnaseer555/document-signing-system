import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { AuthUser } from '../../common/types';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DocumentsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async upload(user: AuthUser, title: string, file: Express.Multer.File) {
    const documentId = randomUUID();
    const path = await this.storage.uploadOriginalPdf(documentId, file);

    const { data, error } = await this.supabase.admin
      .from('documents')
      .insert({
        id: documentId,
        title,
        original_storage_path: path,
        mime_type: 'application/pdf',
        size_bytes: file.size,
        uploaded_by: user.id,
      })
      .select('*')
      .single();

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message ?? 'Failed to create document',
      );
    }

    await this.audit.log({
      actorId: user.id,
      entityType: 'document',
      entityId: documentId,
      documentId,
      action: 'DOCUMENT_UPLOADED',
      metadata: { title, sizeBytes: file.size },
    });
    return data;
  }

  async list() {
    const { data, error } = await this.supabase.admin
      .from('documents')
      .select(
        `
        *,
        uploader:profiles!documents_uploaded_by_fkey(id, email, full_name),
        assignments:document_assignments(
          id, status, due_date, signed_at, created_at,
          assignee:profiles!document_assignments_assignee_id_fkey(id, email, full_name)
        )
      `,
      )
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ?? [];
  }

  async getById(id: string) {
    const { data, error } = await this.supabase.admin
      .from('documents')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      throw new NotFoundException('Document not found');
    }
    return data;
  }
}
