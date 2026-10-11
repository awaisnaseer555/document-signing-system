import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AuditService {
  constructor(private readonly supabase: SupabaseService) {}

  async log(params: {
    actorId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    metadata?: Record<string, unknown>;
  }) {
    await this.supabase.admin.from('document_audit_logs').insert({
      actor_id: params.actorId,
      entity_type: params.entityType,
      entity_id: params.entityId,
      action: params.action,
      metadata: params.metadata ?? {},
    });
  }
}
