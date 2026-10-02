import { it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { databaseHarness } from "./database-harness";

type Data = Record<string, unknown>;
const migration = "20261002024651_hq_planner_revision_enforcement.sql";
it("applies independently of the other proposed migrations without changing existing policies, grants, roles or guards", async () => {
  const { db } = await databaseHarness({
    stopBefore: migration,
    exclude: [
      "20261001225212_hq_manual_intake_and_material_delivery.sql",
      "20261002001252_hq_research_refresh_request.sql",
    ],
  });
  try {
    const catalog = async () =>
      (
        await db.query<Data>(`
      select jsonb_build_object(
        'policies',(select jsonb_agg(to_jsonb(p) order by schemaname,tablename,policyname) from pg_policies p where schemaname in ('public','storage')),
        'tables',(select jsonb_agg(jsonb_build_array(n.nspname,c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl) order by n.nspname,c.relname) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','storage') and c.relkind='r'),
        'permissions',(select jsonb_agg(to_jsonb(p) order by id) from permissions p),
        'roles',(select jsonb_agg(to_jsonb(r) order by id) from roles r),
        'role_permissions',(select jsonb_agg(to_jsonb(r) order by role_id,permission_id) from role_permissions r),
        'memberships',(select jsonb_agg(to_jsonb(m) order by id) from workspace_memberships m)
      ) as value;
    `)
      ).rows[0];
    const before = await catalog();
    const triggersBefore = (
      await db.query<Data>(
        "select oid,tgrelid,tgname,tgenabled,pg_get_triggerdef(oid) as definition from pg_trigger where not tgisinternal order by oid",
      )
    ).rows;
    const functionsBefore = (
      await db.query<Data>(
        "select p.oid,p.prosecdef,p.proconfig,p.proacl,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.oid",
      )
    ).rows;
    const source = await readFile(
      new URL("../../supabase/migrations/" + migration, import.meta.url),
      "utf8",
    );
    await db.exec(source);
    expect(await catalog()).toEqual(before);
    const triggersAfter = (
      await db.query<Data>(
        "select oid,tgrelid,tgname,tgenabled,pg_get_triggerdef(oid) as definition from pg_trigger where not tgisinternal order by oid",
      )
    ).rows;
    for (const trigger of triggersBefore)
      expect(triggersAfter.find((t) => t.oid === trigger.oid)).toEqual(trigger);
    const functionsAfter = (
      await db.query<Data>(
        "select p.oid,p.prosecdef,p.proconfig,p.proacl,p.prosrc from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.oid",
      )
    ).rows;
    const humanOid = (
      await db.query<Data>(
        "select 'public.hq_human_action(uuid,uuid,timestamptz,uuid,text,jsonb)'::regprocedure::oid as oid",
      )
    ).rows[0].oid;
    for (const old of functionsBefore) {
      const current = functionsAfter.find((f) => f.oid === old.oid);
      expect(current).toBeDefined();
      if (old.oid === humanOid) {
        const binding =
          "        update public.application_packages set hq_preparation_task_id=task_id\n          where workspace_id=target_workspace_id and id=new_package_id;\n";
        expect(String(current!.prosrc).replace(binding, "")).toBe(old.prosrc);
        expect({ ...current, prosrc: old.prosrc }).toEqual(old);
      } else expect(current).toEqual(old);
    }
    const newColumns = (
      await db.query<Data>(
        "select table_name,column_name,is_nullable,column_default from information_schema.columns where table_schema='public' and column_name='hq_preparation_task_id' order by table_name",
      )
    ).rows;
    expect(newColumns).toEqual([
      {
        table_name: "application_materials",
        column_name: "hq_preparation_task_id",
        is_nullable: "YES",
        column_default: null,
      },
      {
        table_name: "application_packages",
        column_name: "hq_preparation_task_id",
        is_nullable: "YES",
        column_default: null,
      },
    ]);
    const newFunctions = functionsAfter.filter(
      (f) => !functionsBefore.some((old) => old.oid === f.oid),
    );
    expect(
      newFunctions.every(
        (f) =>
          Array.isArray(f.proconfig) && f.proconfig.includes('search_path=""'),
      ),
    ).toBe(true);
  } finally {
    await db.close();
  }
}, 20000);
