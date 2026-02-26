import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

function getDbUrl(databaseUrl?: string): string {
  if (databaseUrl) return databaseUrl;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Resource } = require("sst");
    if (Resource.AxelSaasSupabaseDatabaseUrl?.value) {
      return Resource.AxelSaasSupabaseDatabaseUrl.value;
    }
  } catch {
    // Resource not available
  }

  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Set it via: sst secret set AxelSaasSupabaseDatabaseUrl <url>",
    );
  }
  return url;
}

/**
 * Create a Drizzle client backed by postgres-js.
 *
 * Use `prepare: false` so the driver works with Supabase's Transaction pooler
 * (pgBouncer), which does not support prepared statements.
 */
export function createDb(databaseUrl?: string) {
  const url = getDbUrl(databaseUrl);
  const client = postgres(url, { prepare: false });
  return drizzle(client, { schema });
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
