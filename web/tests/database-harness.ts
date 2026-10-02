import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// No connection string, filesystem data directory, production rows, or network.
// Hosted Auth is represented only by its UUID claim interface. PostgreSQL executes
// the real repository tables, policies, grants, and lifecycle triggers unchanged.
export async function databaseHarness(
  options: { stopBefore?: string; exclude?: string[] } = {},
) {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    -- Test-only Supabase Storage catalog interface. No object service/network.
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb; $$;
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    create function public.rls_auto_enable() returns event_trigger
      language plpgsql as $$ begin return; end; $$;
  `);
  const directory = fileURLToPath(
    new URL("../../supabase/migrations/", import.meta.url),
  );
  const applied: string[] = [];
  const skipped: string[] = [];
  for (const name of (await readdir(directory))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    if (name === options.stopBefore) break;
    if (options.exclude?.includes(name)) continue;
    // These two historical production identity migrations require specific real
    // Auth accounts and workspace IDs. Test identities are seeded separately.
    if (name.endsWith("_agent_identity.sql")) {
      skipped.push(name);
      continue;
    }
    let sql = await readFile(directory + name, "utf8");
    // PGlite supplies gen_random_uuid in core; pgcrypto is not bundled. This is
    // the only DDL adaptation. No application uses other pgcrypto functions.
    sql = sql.replace("create extension if not exists pgcrypto;", "");
    try {
      await db.exec(sql);
      applied.push(name);
    } catch (error) {
      await db.close();
      throw new Error("Migration " + name + ": " + String(error));
    }
  }
  return { db, applied, skipped };
}
