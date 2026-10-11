jest.mock('../supabase/supabase.service', () => ({
  SupabaseService: class SupabaseService {},
}));
jest.mock('../storage/storage.service', () => ({
  StorageService: class StorageService {},
}));
jest.mock('../audit/audit.service', () => ({
  AuditService: class AuditService {},
}));
jest.mock('../assignments/assignments.service', () => ({
  AssignmentsService: class AssignmentsService {},
}));

import { ConflictException, BadRequestException } from '@nestjs/common';
import { SignaturesService } from './signatures.service';
import { AuthUser } from '../../common/types';

describe('SignaturesService.submit', () => {
  const employee: AuthUser = {
    id: 'emp-1',
    email: 'emp@example.com',
    fullName: 'Emp One',
    role: 'EMPLOYEE',
  };

  function buildService(overrides?: {
    assignment?: Record<string, unknown>;
    claimResult?: { data: unknown; error: unknown };
    insertResult?: { data: unknown; error: unknown };
  }) {
    const assignment = {
      id: 'asg-1',
      document_id: 'doc-1',
      assignee_id: 'emp-1',
      status: 'PENDING',
      signature: null,
      document: { id: 'doc-1', original_storage_path: 'originals/doc-1/a.pdf' },
      ...overrides?.assignment,
    };

    const assignments = {
      getAuthorized: jest.fn().mockResolvedValue(assignment),
    };

    const storage = {
      download: jest.fn().mockResolvedValue(Buffer.from('%PDF-1.4')),
      uploadSignaturePng: jest.fn().mockResolvedValue('sig/asg-1.png'),
      uploadSignedPdf: jest.fn().mockResolvedValue('signed/asg-1.pdf'),
    };

    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    const claimResult = overrides?.claimResult ?? {
      data: { id: 'asg-1' },
      error: null,
    };
    const insertResult = overrides?.insertResult ?? {
      data: { id: 'sig-1' },
      error: null,
    };

    const from = jest.fn((table: string) => {
      if (table === 'document_assignments') {
        return {
          update: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              in: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                  maybeSingle: jest.fn().mockResolvedValue(claimResult),
                }),
              }),
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }
      if (table === 'document_signatures') {
        return {
          insert: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue(insertResult),
            }),
          }),
        };
      }
      return {};
    });

    const supabase = { admin: { from } };
    const service = new SignaturesService(
      supabase as never,
      storage as never,
      assignments as never,
      audit as never,
    );

    // Avoid heavy pdf-lib path in unit tests
    jest
      .spyOn(service as never, 'composeSignedPdf' as never)
      .mockResolvedValue(Buffer.from('pdf') as never);

    return { service, assignments, audit, from };
  }

  it('rejects when assignment already signed', async () => {
    const { service } = buildService({
      assignment: { status: 'SIGNED' },
    });
    await expect(
      service.submit(employee, 'asg-1', 'data:image/png;base64,AAAA'),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects when assignee does not match', async () => {
    const { service } = buildService({
      assignment: { assignee_id: 'other' },
    });
    await expect(
      service.submit(employee, 'asg-1', 'data:image/png;base64,' + 'A'.repeat(200)),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects concurrent duplicate claim', async () => {
    const { service } = buildService({
      claimResult: { data: null, error: null },
    });
    const png = 'data:image/png;base64,' + Buffer.alloc(200, 1).toString('base64');
    await expect(service.submit(employee, 'asg-1', png)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });
});
