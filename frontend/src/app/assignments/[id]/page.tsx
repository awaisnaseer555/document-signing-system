"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { PdfViewer } from "@/components/pdf-viewer";
import { SignaturePad } from "@/components/signature-pad";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { AuthUser, AssignmentRow } from "@/types";

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [assignment, setAssignment] = useState<AssignmentRow | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function boot() {
      try {
        const supabase = createClient();
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          router.replace("/login");
          return;
        }

        // Parallel: auth + assignment detail
        const [me, row] = await Promise.all([
          api.auth.me(),
          api.assignments.get(params.id),
        ]);
        setUser(me);
        setAssignment(row);

        const urlRes =
          row.status === "SIGNED"
            ? await api.assignments.signedUrl(params.id)
            : await api.assignments.fileUrl(params.id);
        setFileUrl(urlRes.url);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load";
        if (message === "Forbidden" || message === "Unauthorized") {
          router.replace("/unauthorized");
          return;
        }
        setError(message);
      }
    }
    void boot();
  }, [params.id, router]);

  async function submitSignature(dataUrl: string) {
    setSubmitting(true);
    setError(null);
    try {
      const updated = await api.assignments.submitSignature(params.id, dataUrl);
      setAssignment(updated);
      const signed = await api.assignments.signedUrl(params.id);
      setFileUrl(signed.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user || !assignment) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        {error ?? "Loading document…"}
      </main>
    );
  }

  const canSign =
    user.role === "EMPLOYEE" &&
    ["PENDING", "VIEWED"].includes(assignment.status);

  return (
    <AppShell user={user}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {assignment.document?.title ?? "Document"}
          </h1>
          <p className="text-sm text-muted-foreground">
            Assignee:{" "}
            {assignment.assignee?.full_name ?? assignment.assignee?.email ?? "—"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={assignment.status} />
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              router.push(
                user.role === "MANAGEMENT" ? "/management" : "/employee",
              )
            }
          >
            Back
          </Button>
        </div>
      </div>

      {error ? (
        <p className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {fileUrl ? <PdfViewer url={fileUrl} /> : null}

      {canSign ? (
        <div className="mt-6">
          <SignaturePad onSubmit={submitSignature} submitting={submitting} />
        </div>
      ) : null}

      {assignment.status === "SIGNED" ? (
        <p className="mt-4 text-sm text-emerald-700 dark:text-emerald-400">
          Signed
          {assignment.signed_at
            ? ` on ${new Date(assignment.signed_at).toLocaleString()}`
            : ""}
          . Showing the generated signed PDF.
        </p>
      ) : null}
    </AppShell>
  );
}
