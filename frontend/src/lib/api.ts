import { createClient } from "@/lib/supabase/client";
import type {
  AssignmentRow,
  AuditLogRow,
  AuthUser,
  DocumentRow,
  Profile,
} from "@/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

async function getAccessToken() {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (!(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...options,
      headers,
    });
  } catch {
    throw new Error(
      `Cannot reach API at ${API_URL}. Set NEXT_PUBLIC_API_URL to your deployed NestJS URL (e.g. https://your-api.onrender.com/api).`,
    );
  }

  if (res.status === 401) {
    throw new Error("Unauthorized");
  }
  if (res.status === 403) {
    throw new Error("Forbidden");
  }

  if (!res.ok) {
    let message = res.statusText;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? message;
      if (Array.isArray(message)) message = message.join(", ");
    } catch {
      /* ignore */
    }
    throw new Error(message || `Request failed (${res.status})`);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}

/** Typed API surface — NestJS is the source of truth for authorization. */
export const api = {
  auth: {
    me: () => apiFetch<AuthUser>("/auth/me"),
  },
  users: {
    employees: () => apiFetch<Profile[]>("/users/employees"),
    invite: (body: {
      email: string;
      fullName?: string;
      temporaryPassword: string;
      role?: "EMPLOYEE";
    }) =>
      apiFetch<{ id: string; email: string; role: string }>("/users/invite", {
        method: "POST",
        body: JSON.stringify({ ...body, role: "EMPLOYEE" }),
      }),
  },
  documents: {
    list: () => apiFetch<DocumentRow[]>("/documents"),
    upload: (form: FormData) =>
      apiFetch<DocumentRow>("/documents", { method: "POST", body: form }),
  },
  assignments: {
    list: (params?: { status?: string; q?: string }) => {
      const qs = new URLSearchParams();
      if (params?.status) qs.set("status", params.status);
      if (params?.q) qs.set("q", params.q);
      const suffix = qs.toString() ? `?${qs}` : "";
      return apiFetch<AssignmentRow[]>(`/assignments${suffix}`);
    },
    get: (id: string) => apiFetch<AssignmentRow>(`/assignments/${id}`),
    create: (body: {
      documentId: string;
      assigneeId: string;
      dueDate?: string;
    }) =>
      apiFetch<AssignmentRow>("/assignments", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    revoke: (id: string) =>
      apiFetch<AssignmentRow>(`/assignments/${id}/revoke`, {
        method: "PATCH",
      }),
    fileUrl: (id: string) =>
      apiFetch<{ url: string }>(`/assignments/${id}/file-url`),
    signedUrl: (id: string) =>
      apiFetch<{ url: string }>(`/assignments/${id}/signed-url`),
    submitSignature: (id: string, signatureDataUrl: string) =>
      apiFetch<AssignmentRow>(`/assignments/${id}/signatures`, {
        method: "POST",
        body: JSON.stringify({ signatureDataUrl }),
      }),
  },
  audit: {
    list: (params?: {
      limit?: number;
      offset?: number;
      action?: string;
      documentId?: string;
      assignmentId?: string;
    }) => {
      const qs = new URLSearchParams();
      if (params?.limit != null) qs.set("limit", String(params.limit));
      if (params?.offset != null) qs.set("offset", String(params.offset));
      if (params?.action) qs.set("action", params.action);
      if (params?.documentId) qs.set("documentId", params.documentId);
      if (params?.assignmentId) qs.set("assignmentId", params.assignmentId);
      const suffix = qs.toString() ? `?${qs}` : "";
      return apiFetch<AuditLogRow[]>(`/audit${suffix}`);
    },
  },
};
