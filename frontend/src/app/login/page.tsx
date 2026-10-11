"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginValues } from "@/validators/auth";

export default function LoginPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  async function onSubmit(values: LoginValues) {
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: values.email,
        password: values.password,
      });
      if (signInError) throw signInError;

      const me = await api.auth.me();
      router.replace(me.role === "MANAGEMENT" ? "/management" : "/employee");
      router.refresh();
    } catch (err) {
      setError("root", {
        message: err instanceof Error ? err.message : "Login failed",
      });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-teal-50 p-4 dark:from-slate-950 dark:via-slate-900 dark:to-teal-950">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-md space-y-4 rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-xl"
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">DocSign</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign in to manage or sign assigned documents.
          </p>
        </div>
        <label className="block space-y-1 text-sm">
          <span>Email</span>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-md border bg-background px-3 py-2"
            {...register("email")}
          />
          {errors.email ? (
            <p className="text-sm text-destructive">{errors.email.message}</p>
          ) : null}
        </label>
        <label className="block space-y-1 text-sm">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            className="w-full rounded-md border bg-background px-3 py-2"
            {...register("password")}
          />
          {errors.password ? (
            <p className="text-sm text-destructive">{errors.password.message}</p>
          ) : null}
        </label>
        {errors.root ? (
          <p className="text-sm text-destructive">{errors.root.message}</p>
        ) : null}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          <Link href="/forgot-password" className="underline hover:text-foreground">
            Forgot password?
          </Link>
        </p>
        <p className="text-xs text-muted-foreground">
          Electronic signatures capture intent within this app and are not a
          legal validity claim.
        </p>
      </form>
    </div>
  );
}
