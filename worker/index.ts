export default {
  fetch(request) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/health" && request.method === "GET") {
      return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
    }

    if (pathname.startsWith("/api/")) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    return new Response(null, { status: 404 });
  }
} satisfies ExportedHandler;
