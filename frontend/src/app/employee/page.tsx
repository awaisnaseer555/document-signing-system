"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { apiFetch } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { AuthUser, AssignmentRow } from "@/types";

export default function EmployeePage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "SIGNED">("ALL");
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function boot() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }
        const me = await apiFetch<AuthUser>("/auth/me");
        if (me.role !== "EMPLOYEE") {
          router.replace("/management");
          return;
        }
        setUser(me);
        const rows = await apiFetch<AssignmentRow[]>("/assignments");
        setAssignments(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      }
    }
    void boot();
  }, [router]);

  const visible = useMemo(() => {
    return assignments.filter((a) => {
      if (filter === "PENDING" && !["PENDING", "VIEWED"].includes(a.status)) {
        return false;
      }
      if (filter === "SIGNED" && a.status !== "SIGNED") return false;
      if (!q.trim()) return true;
      return (a.document?.title ?? "")
        .toLowerCase()
        .includes(q.trim().toLowerCase());
    });
  }, [assignments, filter, q]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Loading employee dashboard…
      </main>
    );
  }

  return (
    <AppShell user={user}>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            My documents
          </h1>
          <p className="text-sm text-muted-foreground">
            View assigned PDFs, sign electronically, and track status.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search"
            className="rounded-md border bg-white px-3 py-2 text-sm"
          />
          <select
            value={filter}
            onChange={(e) =>
              setFilter(e.target.value as "ALL" | "PENDING" | "SIGNED")
            }
            className="rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="SIGNED">Completed</option>
          </select>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {visible.map((a) => (
          <div
            key={a.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4"
          >
            <div>
              <h2 className="font-medium">{a.document?.title ?? "Document"}</h2>
              <p className="text-sm text-muted-foreground">
                Due {a.due_date ?? "—"} · Assigned{" "}
                {new Date(a.created_at).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={a.status} />
              <Link
                href={`/assignments/${a.id}`}
                className="inline-flex h-7 items-center rounded-lg bg-primary px-2.5 text-[0.8rem] font-medium text-primary-foreground"
              >
                {a.status === "SIGNED" ? "View" : "Open & sign"}
              </Link>
            </div>
          </div>
        ))}
        {!visible.length ? (
          <p className="rounded-xl border bg-white p-8 text-center text-sm text-muted-foreground">
            No documents match this filter.
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
