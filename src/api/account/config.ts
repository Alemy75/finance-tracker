import type { QueryKey } from "@tanstack/react-query";

export interface AccountStatus {
  registered: boolean;
  user: { id: string; email: string } | null;
}

export interface Credentials {
  email: string;
  password: string;
}

export const accountStatusUrl = () => "/api/account/status" as const;
export const authUrl = (path: "sign-up/email" | "sign-in/email" | "sign-out") => `/api/auth/${path}` as const;

export const accountStatusKey = () => ["account", "status"] as const satisfies QueryKey;
export const signInKey = () => ["account", "sign-in"] as const;
export const signUpKey = () => ["account", "sign-up"] as const;
export const signOutKey = () => ["account", "sign-out"] as const;
