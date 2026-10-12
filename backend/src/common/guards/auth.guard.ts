import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { SupabaseService } from '../../modules/supabase/supabase.service';
import { AuthUser, UserRole } from '../types';

type CacheEntry = { user: AuthUser; expiresAt: number };

/** Short-lived auth cache — dashboard fires many parallel API calls per page load. */
const AUTH_CACHE_TTL_MS = 45_000;
const AUTH_CACHE_MAX = 500;

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly cache = new Map<string, CacheEntry>();

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
    const cacheKey = createHash('sha256').update(token).digest('hex');
    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      request.user = cached.user;
      return true;
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      this.cache.delete(cacheKey);
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

    if (this.cache.size >= AUTH_CACHE_MAX) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    this.cache.set(cacheKey, {
      user,
      expiresAt: Date.now() + AUTH_CACHE_TTL_MS,
    });

    return true;
  }
}
