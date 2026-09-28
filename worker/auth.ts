import { betterAuth } from "better-auth";

export interface Env {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  ACCOUNT_SETUP_KEY: string;
}

export function createAuth(request: Request, env: Env) {
  const origin = new URL(request.url).origin;
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL: origin,
    basePath: "/api/auth",
    trustedOrigins: [origin],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12
    }
  });
}
