import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../../modules/supabase/supabase.service';
import { AuthUser, UserRole } from '../types';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: { authorization?: string };
      user?: AuthUser;
    }>();

    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice(7);
    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired token');
    }

    const { data: profile, error: profileError } = await this.supabase.admin
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new UnauthorizedException('User profile not found');
    }

    const user = new AuthUser();
    user.id = profile.id as string;
    user.email = profile.email as string;
    user.fullName = (profile.full_name as string | null) ?? null;
    user.role = profile.role as UserRole;
    request.user = user;

    return true;
  }
}
