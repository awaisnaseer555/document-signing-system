import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Access denied</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        You do not have permission to view this page. If you believe this is a
        mistake, sign in with a different account or contact management.
      </p>
      <div className="flex gap-2">
        <Link
          href="/login"
          className="inline-flex h-8 items-center rounded-lg border px-3 text-sm"
        >
          Sign in
        </Link>
        <Link
          href="/"
          className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-sm text-primary-foreground"
        >
          Home
        </Link>
      </div>
    </main>
  );
}
