import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(params: {
    actorId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    documentId?: string | null;
    assignmentId?: string | null;
    metadata?: Record<string, unknown>;
  }) {
    await this.supabase.admin.from('document_audit_logs').insert({
      actor_id: params.actorId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      document_id: params.documentId ?? null,
      assignment_id: params.assignmentId ?? null,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  }

  async list(params: {
    limit?: number;
    offset?: number;
    action?: string;
    documentId?: string;
    assignmentId?: string;
  }) {
    const limit = Math.min(Math.max(params.limit ?? 50, 1), 200);
    const offset = Math.max(params.offset ?? 0, 0);

    let query = this.supabase.admin
      .from('document_audit_logs')
      .select(
        `
        id, actor_id, document_id, assignment_id, entity_type, entity_id,
        action, metadata, created_at,
        actor:profiles!document_audit_logs_actor_id_fkey(id, email, full_name)
      `,
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.action) {
      query = query.eq('action', params.action);
    }
    if (params.documentId) {
      query = query.eq('document_id', params.documentId);
    }
    if (params.assignmentId) {
      query = query.eq('assignment_id', params.assignmentId);
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ?? [];
  }
}
