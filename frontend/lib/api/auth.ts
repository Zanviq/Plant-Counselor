import { apiPost, apiGet, apiPatch, apiPut } from "./client";

export const signup = (nickname: string, password: string) =>
  apiPost("/auth/signup", { nickname, password });

export const login = (nickname: string, password: string) =>
  apiPost<{ access_token: string; user: unknown }>("/auth/login", { nickname, password });

export const refreshToken = () =>
  apiPost<{ access_token: string }>("/auth/refresh");

export const logout = () => apiPost("/auth/logout");

export const getMe = () => apiGet("/me");

export const updateMe = (fields: Record<string, unknown>) => apiPatch("/me", fields);

export const setApiKey = (api_key: string) => apiPut("/me/api-key", { api_key });
