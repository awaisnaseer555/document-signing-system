import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { InviteUserDto } from './dto/invite-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async listEmployees() {
    const { data, error } = await this.supabase.admin
      .from('profiles')
      .select('id, email, full_name, role, created_at')
      .eq('role', 'EMPLOYEE')
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(error.message);
    }
    return data ?? [];
  }

  async invite(dto: InviteUserDto) {
    // Invites always create EMPLOYEE profiles. MANAGEMENT elevation is
    // service-role SQL only (never client-supplied metadata).
    const fullName = dto.fullName ?? dto.email.split('@')[0];

    const { data, error } = await this.supabase.admin.auth.admin.createUser({
      email: dto.email,
      password: dto.temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

    if (error || !data.user) {
      throw new BadRequestException(error?.message ?? 'Failed to create user');
    }

    await this.supabase.admin
      .from('profiles')
      .update({
        role: 'EMPLOYEE',
        full_name: fullName,
      })
      .eq('id', data.user.id);

    return {
      id: data.user.id,
      email: dto.email,
      role: 'EMPLOYEE' as const,
      fullName,
    };
  }
}
