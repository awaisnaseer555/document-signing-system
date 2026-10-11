"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { AuthUser } from "@/types";

export function AppShell({
  user,
  children,
}: {
  user: AuthUser;
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  const home =
    user.role === "MANAGEMENT" ? "/management" : "/employee";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href={home} className="text-lg font-semibold tracking-tight">
              DocSign
            </Link>
            <nav className="flex gap-3 text-sm text-muted-foreground">
              {user.role === "MANAGEMENT" ? (
                <Link href="/management" className="hover:text-foreground">
                  Management
                </Link>
              ) : (
                <Link href="/employee" className="hover:text-foreground">
                  My documents
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="hidden text-right sm:block">
              <div className="font-medium">{user.fullName ?? user.email}</div>
              <div className="text-xs text-muted-foreground">{user.role}</div>
            </div>
            <Button variant="outline" size="sm" onClick={signOut}>
              Sign out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
