"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { AuditLogRow, AuthUser } from "@/types";

export default function AuditPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [rows, setRows] = useState<AuditLogRow[]>([]);
  const [action, setAction] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadLogs(filterAction?: string) {
    const data = await api.audit.list({
      limit: 100,
      action: filterAction || undefined,
    });
    setRows(data);
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
        await loadLogs();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load audit");
      } finally {
        setLoading(false);
      }
    }
    void boot();
  }, [router]);

  if (!user || loading) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading audit activity…
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit activity</h1>
          <p className="text-sm text-muted-foreground">
            Append-only history of assignments, views, signatures, and revokes.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">All actions</option>
            <option value="DOCUMENT_UPLOADED">DOCUMENT_UPLOADED</option>
            <option value="ASSIGNED">ASSIGNED</option>
            <option value="VIEWED">VIEWED</option>
            <option value="SIGNED">SIGNED</option>
            <option value="REVOKED">REVOKED</option>
          </select>
          <button
            type="button"
            className="rounded-md border px-3 py-2 text-sm"
            onClick={() => void loadLogs(action).catch((err: Error) => setError(err.message))}
          >
            Apply
          </button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/50 text-muted-foreground">
            <tr>
              <th className="px-3 py-2">When</th>
              <th className="px-3 py-2">Action</th>
              <th className="px-3 py-2">Actor</th>
              <th className="px-3 py-2">Entity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b last:border-0">
                <td className="px-3 py-2 whitespace-nowrap">
                  {new Date(row.created_at).toLocaleString()}
                </td>
                <td className="px-3 py-2 font-medium">{row.action}</td>
                <td className="px-3 py-2">
                  {row.actor?.full_name ?? row.actor?.email ?? row.actor_id ?? "—"}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.entity_type} · {row.entity_id.slice(0, 8)}…
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">
                  No audit events yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
