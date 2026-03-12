import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";

type JournalEntry = {
  idx: number;
  version: string;
  when: number;
  tag: string;
  breakpoints: boolean;
};

type MigrationRecord = JournalEntry & {
  hash: string;
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsFolder = path.resolve(__dirname, "../migrations");
const baselineTag = process.env.DRIZZLE_BASELINE_TAG;
const baselineOnly = process.env.DRIZZLE_BASELINE_ONLY === "1";

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL must be set to run migrations.\nUse the Direct Connection URL from: Supabase -> Settings -> Database -> Connection string -> URI",
    );
  }

  return url;
}

function readMigrationRecords(): MigrationRecord[] {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries: JournalEntry[];
  };

  return journal.entries.map((entry) => {
    const migrationPath = path.join(migrationsFolder, `${entry.tag}.sql`);
    const migrationSql = fs.readFileSync(migrationPath, "utf8");

    return {
      ...entry,
      hash: crypto.createHash("sha256").update(migrationSql).digest("hex"),
    };
  });
}

async function ensureMigrationsTable(db: ReturnType<typeof drizzle>) {
  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      "id" SERIAL PRIMARY KEY,
      "hash" text NOT NULL,
      "created_at" bigint
    )
  `);
}

async function objectExists(
  db: ReturnType<typeof drizzle>,
  statement: ReturnType<typeof sql>,
): Promise<boolean> {
  const result = await db.execute(statement);
  return result.rows.length > 0;
}

async function verifyMigrationObjects(
  db: ReturnType<typeof drizzle>,
  tag: string,
): Promise<void> {
  const verifiers: Record<string, () => Promise<boolean>> = {
    "0000_initial": async () =>
      (await objectExists(
        db,
        sql`select 1 from pg_type where typname = 'subscription_tier'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'users'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'subscriptions'`,
      )),
    "0001_auth_user_trigger": async () =>
      (await objectExists(
        db,
        sql`select 1 from pg_proc where proname = 'handle_auth_user_confirmed'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from pg_trigger where tgname = 'on_auth_user_created'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from pg_trigger where tgname = 'on_auth_user_email_confirmed'`,
      )),
    "0002_onboarding_state": async () =>
      (await objectExists(
        db,
        sql`select 1 from pg_type where typname = 'onboarding_status'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'onboarding_messages'`,
      )) &&
      (await objectExists(
        db,
        sql`select 1 from information_schema.tables where table_schema = 'public' and table_name = 'onboarding_state'`,
      )),
  };

  const verify = verifiers[tag];
  if (!verify) {
    throw new Error(`No baseline verifier is defined for migration ${tag}`);
  }

  if (!(await verify())) {
    throw new Error(
      `Cannot baseline ${tag} because the expected schema objects are not all present in the database.`,
    );
  }
}

async function baselineMigrations(
  db: ReturnType<typeof drizzle>,
  migrations: MigrationRecord[],
  tag: string,
): Promise<void> {
  const targetIndex = migrations.findIndex(
    (migration) => migration.tag === tag,
  );
  if (targetIndex === -1) {
    throw new Error(`Unknown DRIZZLE_BASELINE_TAG: ${tag}`);
  }

  const targetMigrations = migrations.slice(0, targetIndex + 1);
  const existingResult = await db.execute(sql`
    select "hash", "created_at"
    from "drizzle"."__drizzle_migrations"
    order by "created_at" asc
  `);
  const existingRows = existingResult.rows as Array<{
    hash: string;
    created_at: number | string | null;
  }>;

  for (const [index, row] of existingRows.entries()) {
    const expected = targetMigrations[index];
    if (!expected) {
      return;
    }

    if (
      row.hash !== expected.hash ||
      Number(row.created_at) !== expected.when
    ) {
      throw new Error(
        "Existing drizzle migration records do not match the requested baseline prefix.",
      );
    }
  }

  for (const migration of targetMigrations.slice(existingRows.length)) {
    await verifyMigrationObjects(db, migration.tag);
    await db.execute(sql`
      insert into "drizzle"."__drizzle_migrations" ("hash", "created_at")
      values (${migration.hash}, ${migration.when})
    `);
    console.log(`Baselined ${migration.tag}`);
  }
}

async function main() {
  const client = postgres(getDatabaseUrl(), { prepare: false });
  const db = drizzle(client);

  try {
    const migrations = readMigrationRecords();
    await ensureMigrationsTable(db);

    if (baselineTag) {
      await baselineMigrations(db, migrations, baselineTag);
    }

    if (!baselineOnly) {
      await migrate(db, { migrationsFolder });
    }
  } finally {
    await client.end({ timeout: 5 });
  }
}

await main();
