jest.mock('../../modules/supabase/supabase.service', () => ({
  SupabaseService: class SupabaseService {},
}));
jest.mock('../../modules/storage/storage.service', () => ({
  StorageService: class StorageService {},
}));
jest.mock('../../modules/audit/audit.service', () => ({
  AuditService: class AuditService {},
}));

import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AssignmentsService } from '../../modules/assignments/assignments.service';
import { AuthUser } from '../types';

describe('Authorization isolation', () => {
  it('blocks employee from management-only routes', () => {
    const guard = new RolesGuard(new Reflector());
    const reflector = (guard as unknown as { reflector: Reflector }).reflector;
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['MANAGEMENT']);

    const ctx = {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'e1',
            email: 'e@x.com',
            fullName: null,
            role: 'EMPLOYEE',
          } satisfies AuthUser,
        }),
      }),
    };

    expect(() => guard.canActivate(ctx as never)).toThrow(ForbiddenException);
  });

  it('hides another employee assignment as not found', async () => {
    const supabase = {
      admin: {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  id: 'asg-other',
                  assignee_id: 'emp-other',
                  status: 'PENDING',
                  document: { title: 'Secret' },
                },
                error: null,
              }),
            }),
          }),
        }),
      },
    };

    const service = new AssignmentsService(
      supabase as never,
      { createSignedUrl: jest.fn() } as never,
      { log: jest.fn() } as never,
    );

    const employee: AuthUser = {
      id: 'emp-self',
      email: 'self@x.com',
      fullName: null,
      role: 'EMPLOYEE',
    };

    await expect(
      service.getAuthorized(employee, 'asg-other'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
