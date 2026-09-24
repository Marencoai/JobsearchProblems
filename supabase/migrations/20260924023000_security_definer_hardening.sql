-- ============================================================
-- Job Search AI Agent
-- Migration 017: SECURITY DEFINER Hardening
-- ============================================================
--
-- Supabase exposes the public schema through the Data API.
--
-- Elevated SECURITY DEFINER functions should not live in an
-- exposed schema. This migration moves every SECURITY DEFINER
-- implementation into a non-exposed private schema.
--
-- Existing triggers and policies keep their function dependency
-- by object identity when a function changes schema.
--
-- Small SECURITY INVOKER compatibility wrappers remain in public
-- only where existing function bodies or the client-facing
-- bootstrap flow require the original public function name.
--
-- ============================================================


-- ============================================================
-- 1. PRIVATE SCHEMA
-- ============================================================

create schema if not exists private;

revoke all on schema private from public;
revoke all on schema private from anon;
revoke all on schema private from authenticated;


-- ============================================================
-- 2. MOVE IDENTITY / AUTHORIZATION IMPLEMENTATIONS
-- ============================================================

alter function public.current_principal_id()
set schema private;

alter function public.current_principal_is_human()
set schema private;

alter function public.is_workspace_member(uuid)
set schema private;

alter function public.has_permission(uuid, text)
set schema private;

alter function public.shares_workspace_with_principal(uuid)
set schema private;

alter function public.bootstrap_personal_workspace(text, text)
set schema private;


-- ============================================================
-- 3. MOVE INTERNAL SECURITY DEFINER IMPLEMENTATIONS
-- ============================================================

alter function public.prevent_opportunity_history_cycle()
set schema private;

alter function public.validate_evidence_story_context()
set schema private;

alter function public.protect_project_work_context()
set schema private;

alter function public.is_active_workspace_principal(uuid, uuid)
set schema private;

alter function public.is_active_workspace_human(uuid, uuid)
set schema private;

alter function public.validate_activity_event_link()
set schema private;

alter function public.prevent_task_dependency_cycle()
set schema private;

alter function public.prepare_task_attempt_insert()
set schema private;

alter function public.sync_task_from_finalized_attempt()
set schema private;

alter function public.enforce_daily_plan_lifecycle()
set schema private;

alter function public.validate_todays_one_thing()
set schema private;

alter function public.get_daily_plan_status(uuid, uuid)
set schema private;

alter function public.enforce_work_block_lifecycle()
set schema private;

alter function public.validate_daily_plan_item_relationships()
set schema private;

alter function public.enforce_daily_plan_item_lifecycle()
set schema private;

alter function public.validate_application_package_context()
set schema private;

alter function public.validate_application_package_template()
set schema private;

alter function public.get_application_package_status(uuid, uuid)
set schema private;

alter function public.enforce_application_material_lifecycle()
set schema private;

alter function public.require_mutable_application_material()
set schema private;

alter function public.validate_application_submission_context()
set schema private;

alter function public.enforce_application_lifecycle()
set schema private;

alter function public.snapshot_materials_after_application_submit()
set schema private;

alter function public.initialize_candidate_settings_for_workspace()
set schema private;

alter function public.require_human_configuration_actor()
set schema private;


-- ============================================================
-- 4. LOCK DOWN PRIVATE FUNCTIONS
-- ============================================================
--
-- Revoking from PUBLIC prevents accidental direct execution.
--
-- The seven read/bootstrap helpers below receive narrowly scoped
-- authenticated execution because public SECURITY INVOKER
-- wrappers call them.
--
-- Trigger-only functions remain inaccessible to clients.
-- ============================================================

revoke all on all functions in schema private from public;
revoke all on all functions in schema private from anon;
revoke all on all functions in schema private from authenticated;


grant usage on schema private to authenticated;

grant execute on function private.current_principal_id()
to authenticated;

grant execute on function private.current_principal_is_human()
to authenticated;

grant execute on function private.is_workspace_member(uuid)
to authenticated;

grant execute on function private.has_permission(uuid, text)
to authenticated;

grant execute on function private.shares_workspace_with_principal(uuid)
to authenticated;

grant execute on function private.bootstrap_personal_workspace(text, text)
to authenticated;

grant execute on function private.is_active_workspace_principal(uuid, uuid)
to authenticated;

grant execute on function private.is_active_workspace_human(uuid, uuid)
to authenticated;


-- ============================================================
-- 5. PUBLIC SECURITY-INVOKER COMPATIBILITY WRAPPERS
-- ============================================================
--
-- These wrappers do NOT bypass RLS or inherit elevated database
-- authority. They only delegate to the narrowly granted private
-- implementation.
--
-- They preserve:
--
--   existing PL/pgSQL function bodies that call public helpers
--   application RPC compatibility for Workspace bootstrap
--
-- ============================================================

create or replace function public.current_principal_id()
returns uuid
language sql
stable
security invoker
set search_path = ''
as $$
    select private.current_principal_id();
$$;


create or replace function public.current_principal_is_human()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.current_principal_is_human();
$$;


create or replace function public.is_workspace_member(
    target_workspace_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.is_workspace_member(target_workspace_id);
$$;


create or replace function public.has_permission(
    target_workspace_id uuid,
    required_permission_key text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.has_permission(
        target_workspace_id,
        required_permission_key
    );
$$;


create or replace function public.shares_workspace_with_principal(
    target_principal_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.shares_workspace_with_principal(
        target_principal_id
    );
$$;


create or replace function public.bootstrap_personal_workspace(
    workspace_name text,
    workspace_slug text
)
returns uuid
language sql
volatile
security invoker
set search_path = ''
as $$
    select private.bootstrap_personal_workspace(
        workspace_name,
        workspace_slug
    );
$$;


create or replace function public.is_active_workspace_principal(
    target_workspace_id uuid,
    target_principal_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.is_active_workspace_principal(
        target_workspace_id,
        target_principal_id
    );
$$;


create or replace function public.is_active_workspace_human(
    target_workspace_id uuid,
    target_principal_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
    select private.is_active_workspace_human(
        target_workspace_id,
        target_principal_id
    );
$$;


-- Internal compatibility helpers.
--
-- These names are referenced by elevated trigger-function bodies,
-- but normal authenticated clients do not receive EXECUTE.

create or replace function public.get_daily_plan_status(
    target_workspace_id uuid,
    target_daily_plan_id uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select private.get_daily_plan_status(
        target_workspace_id,
        target_daily_plan_id
    );
$$;


create or replace function public.get_application_package_status(
    target_workspace_id uuid,
    target_package_id uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
    select private.get_application_package_status(
        target_workspace_id,
        target_package_id
    );
$$;


-- ============================================================
-- 6. PUBLIC WRAPPER PRIVILEGES
-- ============================================================

revoke all on function public.current_principal_id()
from public;

revoke all on function public.current_principal_is_human()
from public;

revoke all on function public.is_workspace_member(uuid)
from public;

revoke all on function public.has_permission(uuid, text)
from public;

revoke all on function public.shares_workspace_with_principal(uuid)
from public;

revoke all on function public.bootstrap_personal_workspace(text, text)
from public;

revoke all on function public.is_active_workspace_principal(uuid, uuid)
from public;

revoke all on function public.is_active_workspace_human(uuid, uuid)
from public;

revoke all on function public.get_daily_plan_status(uuid, uuid)
from public;

revoke all on function public.get_application_package_status(uuid, uuid)
from public;


grant execute on function public.current_principal_id()
to authenticated;

grant execute on function public.current_principal_is_human()
to authenticated;

grant execute on function public.is_workspace_member(uuid)
to authenticated;

grant execute on function public.has_permission(uuid, text)
to authenticated;

grant execute on function public.shares_workspace_with_principal(uuid)
to authenticated;

grant execute on function public.bootstrap_personal_workspace(text, text)
to authenticated;

grant execute on function public.is_active_workspace_principal(uuid, uuid)
to authenticated;

grant execute on function public.is_active_workspace_human(uuid, uuid)
to authenticated;


-- ============================================================
-- MIGRATION 017 COMPLETE
-- ============================================================
--
-- Elevated implementations now live outside the exposed public
-- schema.
--
-- Public compatibility functions are SECURITY INVOKER only.
--
-- ============================================================
