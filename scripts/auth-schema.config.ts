// Used only by the Better Auth CLI to generate a reviewed SQL migration.
// The Worker uses its D1 binding at runtime; this in-memory database is never deployed.
import { DatabaseSync } from "node:sqlite";
import { betterAuth } from "better-auth";

export const auth = betterAuth({
  database: new DatabaseSync(":memory:"),
  secret: "schema-generation-only-secret-please-do-not-use-in-production",
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 12
  }
});
