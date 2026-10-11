export type UserRole = 'EMPLOYEE' | 'MANAGEMENT';

export type AssignmentStatus = 'PENDING' | 'VIEWED' | 'SIGNED' | 'REVOKED';

export class AuthUser {
  id!: string;
  email!: string;
  fullName!: string | null;
  role!: UserRole;
}

export type AssignmentRecord = {
  id: string;
  document_id: string;
  assignee_id: string;
  assigned_by: string;
  status: AssignmentStatus;
  due_date: string | null;
  viewed_at: string | null;
  signed_at: string | null;
  created_at: string;
  document?: {
    id: string;
    title: string;
    original_storage_path: string;
    created_at?: string;
  } | null;
  assignee?: {
    id: string;
    email: string;
    full_name: string | null;
    role?: UserRole;
  } | null;
  assigner?: {
    id: string;
    email: string;
    full_name: string | null;
  } | null;
  signature?:
    | {
        id: string;
        signed_pdf_path: string;
        created_at: string;
        signer_id?: string;
      }
    | {
        id: string;
        signed_pdf_path: string;
        created_at: string;
        signer_id?: string;
      }[]
    | null;
};
