import { accountStatus, authRequest } from "./account";
import type { Env } from "./auth";

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health" && request.method === "GET") {
      return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    }

    if (pathname === "/api/account/status" && request.method === "GET") {
      return accountStatus(request, env);
    }

    if (pathname.startsWith("/api/auth/")) {
      return authRequest(request, env);
    }

    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(null, { status: 404 });
  }
} satisfies ExportedHandler<Env>;
