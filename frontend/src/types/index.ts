export type UserRole = "EMPLOYEE" | "MANAGEMENT";
export type AssignmentStatus = "PENDING" | "VIEWED" | "SIGNED" | "REVOKED";

export interface AuthUser {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
}

export interface DocumentRow {
  id: string;
  title: string;
  created_at: string;
  size_bytes: number;
  assignments?: AssignmentRow[];
}

export interface AssignmentRow {
  id: string;
  status: AssignmentStatus;
  due_date: string | null;
  signed_at: string | null;
  viewed_at: string | null;
  created_at: string;
  document?: { id: string; title: string; created_at: string };
  assignee?: Profile;
  signature?:
    | { id: string; signed_pdf_path: string; created_at: string }
    | { id: string; signed_pdf_path: string; created_at: string }[]
    | null;
}
