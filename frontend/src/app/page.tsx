"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { apiFetch } from "@/lib/api";
import { AuthUser } from "@/types";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function boot() {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        router.replace("/login");
        return;
      }
      try {
        const me = await apiFetch<AuthUser>("/auth/me");
        router.replace(me.role === "MANAGEMENT" ? "/management" : "/employee");
      } catch {
        router.replace("/login");
      }
    }
    void boot();
  }, [router]);

  return (
    <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
      Loading…
    </main>
  );
}
