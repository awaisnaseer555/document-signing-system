import { apiFetch } from "@/lib/api";
import { AuthUser } from "@/types";

export async function fetchMe(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/auth/me");
}
