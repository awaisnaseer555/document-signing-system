import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { AuthUser } from '../types';

describe('RolesGuard', () => {
  const reflector = new Reflector();
  const guard = new RolesGuard(reflector);

  function mockContext(user?: AuthUser, roles?: string[]): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles as never);
    return {
      getHandler: () => ({}),
      getClass: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({ user }),
      }),
    } as unknown as ExecutionContext;
  }

  it('allows when no roles are required', () => {
    const user = { id: '1', email: 'a@b.c', fullName: null, role: 'EMPLOYEE' } as AuthUser;
    expect(guard.canActivate(mockContext(user, undefined))).toBe(true);
  });

  it('allows matching role', () => {
    const user = {
      id: '1',
      email: 'mgr@b.c',
      fullName: null,
      role: 'MANAGEMENT',
    } as AuthUser;
    expect(guard.canActivate(mockContext(user, ['MANAGEMENT']))).toBe(true);
  });

  it('rejects mismatched role', () => {
    const user = {
      id: '1',
      email: 'emp@b.c',
      fullName: null,
      role: 'EMPLOYEE',
    } as AuthUser;
    expect(() =>
      guard.canActivate(mockContext(user, ['MANAGEMENT'])),
    ).toThrow(ForbiddenException);
  });

  it('rejects missing user', () => {
    expect(() =>
      guard.canActivate(mockContext(undefined, ['EMPLOYEE'])),
    ).toThrow(ForbiddenException);
  });
});
