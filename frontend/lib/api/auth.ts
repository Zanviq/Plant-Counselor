import { apiGet, apiPost } from "./client";
import type { UserProfile } from "@/lib/store/authStore";

export const getCurrentUser = () => apiGet<UserProfile>("/auth/me");

export const login = (username: string, password: string) =>
  apiPost<UserProfile>("/auth/login", { username, password });

export const signup = (body: { username: string; password: string; nickname?: string; email?: string }) =>
  apiPost<UserProfile>("/auth/signup", body);

export const logout = () => apiPost<Record<string, never>>("/auth/logout");
