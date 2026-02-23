import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Create a Drizzle client backed by Neon's HTTP transport.
 *
 * Neon's HTTP transport is ideal for serverless Lambdas — no persistent connection
 * pool required. Each request is an HTTP fetch (cold-start friendly).
 *
 * Uses SST Resource.AxelSaasSupabaseDatabaseUrl at runtime.
 */
export function createDb(databaseUrl?: string) {
  const url =
    databaseUrl ??
    (() => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { Resource } = require("sst");
        if (Resource.AxelSaasSupabaseDatabaseUrl?.value) {
          return Resource.AxelSaasSupabaseDatabaseUrl.value;
        }
      } catch {
        // Resource not available
      }
      return process.env.DATABASE_URL;
    })();

  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it via: sst secret set AxelSaasSupabaseDatabaseUrl <url>",
    );
  }

  const sql = neon(url);
  return drizzle(sql, { schema });
}

/** Singleton used in Lambda handlers (one per cold start). */
let _db: ReturnType<typeof createDb> | null = null;

export function getDb(): ReturnType<typeof createDb> {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type Db = ReturnType<typeof createDb>;

export * from "./schema";
