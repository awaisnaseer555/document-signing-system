"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { AuthUser, AssignmentRow, DocumentRow, Profile } from "@/types";

export default function ManagementPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [documents, setDocuments] = useState<DocumentRow[]>([]);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [invitePassword, setInvitePassword] = useState("");

  async function load(me?: AuthUser) {
    const current = me ?? user;
    if (!current) return;
    const [emps, docs, assigns] = await Promise.all([
      api.users.employees(),
      api.documents.list(),
      api.assignments.list({
        status: status || undefined,
        q: q || undefined,
      }),
    ]);
    setEmployees(emps);
    setDocuments(docs);
    setAssignments(assigns);
  }

  useEffect(() => {
    async function boot() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
        const me = await api.auth.me();
        if (me.role !== "MANAGEMENT") {
          router.replace("/unauthorized");
          return;
        }
        setUser(me);
        await load(me);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const filteredAssignments = useMemo(() => assignments, [assignments]);

  const stats = useMemo(() => {
    const pending = assignments.filter((a) => a.status === "PENDING").length;
    const viewed = assignments.filter((a) => a.status === "VIEWED").length;
    const signed = assignments.filter((a) => a.status === "SIGNED").length;
    const overdue = assignments.filter((a) => {
      if (!a.due_date || a.status === "SIGNED" || a.status === "REVOKED") {
        return false;
      }
      return a.due_date < new Date().toISOString().slice(0, 10);
    }).length;
    return { pending, viewed, signed, overdue, employees: employees.length };
  }, [assignments, employees.length]);

  async function uploadDocument(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("title", title);
      form.append("file", file);
      await api.documents.upload(form);
      setTitle("");
      setFile(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function assignDocument(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.assignments.create({
        documentId,
        assigneeId,
        dueDate: dueDate || undefined,
      });
      setDocumentId("");
      setAssigneeId("");
      setDueDate("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign failed");
    } finally {
      setBusy(false);
    }
  }

  async function inviteEmployee(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.users.invite({
        email: inviteEmail,
        fullName: inviteName || undefined,
        temporaryPassword: invitePassword,
      });
      setInviteEmail("");
      setInviteName("");
      setInvitePassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    setBusy(true);
    try {
      await api.assignments.revoke(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revoke failed");
    } finally {
      setBusy(false);
    }
  }

  async function downloadSigned(id: string) {
    try {
      const { url } = await api.assignments.signedUrl(id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    }
  }

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading management dashboard…
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Management dashboard
          </h1>
          <p className="text-sm text-muted-foreground">
            Upload PDFs, assign employees, track signing status.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search title or employee"
            className="rounded-md border bg-white px-3 py-2 text-sm"
          />
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="VIEWED">VIEWED</option>
            <option value="SIGNED">SIGNED</option>
            <option value="REVOKED">REVOKED</option>
          </select>
          <Button
            type="button"
            variant="outline"
            onClick={() => void load()}
            disabled={busy}
          >
            Apply
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        {(
          [
            ["Employees", stats.employees],
            ["Pending", stats.pending],
            ["Viewed", stats.viewed],
            ["Signed", stats.signed],
            ["Overdue", stats.overdue],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-xl border bg-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <form
          onSubmit={uploadDocument}
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <h2 className="font-medium">Upload PDF</h2>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Document title"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            required
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <Button type="submit" disabled={busy || !file}>
            Upload
          </Button>
        </form>

        <form
          onSubmit={assignDocument}
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <h2 className="font-medium">Assign document</h2>
          <select
            required
            value={documentId}
            onChange={(e) => setDocumentId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select document</option>
            {documents.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title}
              </option>
            ))}
          </select>
          <select
            required
            value={assigneeId}
            onChange={(e) => setAssigneeId(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          >
            <option value="">Select employee</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.full_name ?? e.email}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy}>
            Assign
          </Button>
        </form>

        <form
          onSubmit={inviteEmployee}
          className="space-y-3 rounded-xl border bg-card p-4"
        >
          <h2 className="font-medium">Invite employee</h2>
          <input
            required
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Email"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            value={inviteName}
            onChange={(e) => setInviteName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <input
            required
            type="password"
            minLength={8}
            value={invitePassword}
            onChange={(e) => setInvitePassword(e.target.value)}
            placeholder="Temporary password"
            className="w-full rounded-md border px-3 py-2 text-sm"
          />
          <Button type="submit" disabled={busy}>
            Create employee
          </Button>
        </form>
      </div>

      <section className="mt-8 space-y-3">
        <h2 className="text-lg font-medium">Assignments</h2>
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-3 py-2">Document</th>
                <th className="px-3 py-2">Employee</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Due</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-3 py-2">{a.document?.title ?? "—"}</td>
                  <td className="px-3 py-2">
                    {a.assignee?.full_name ?? a.assignee?.email ?? "—"}
                  </td>
                  <td className="px-3 py-2">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-3 py-2">{a.due_date ?? "—"}</td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/assignments/${a.id}`}
                        className="text-teal-700 underline"
                      >
                        Open
                      </Link>
                      {a.status === "SIGNED" ? (
                        <button
                          type="button"
                          className="text-teal-700 underline"
                          onClick={() => void downloadSigned(a.id)}
                        >
                          Download signed
                        </button>
                      ) : null}
                      {a.status !== "SIGNED" && a.status !== "REVOKED" ? (
                        <button
                          type="button"
                          className="text-red-600 underline"
                          onClick={() => void revoke(a.id)}
                        >
                          Revoke
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!filteredAssignments.length ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-8 text-center text-muted-foreground"
                  >
                    No assignments yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
