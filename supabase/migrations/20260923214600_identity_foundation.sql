-- ============================================================
-- Job Search AI Agent
-- Migration 001: Identity, Workspace, and Permission Foundation
-- ============================================================
--
-- Creates:
--   workspaces
--   principals
--   roles
--   permissions
--   role_permissions
--   workspace_memberships
--
-- RLS policies are intentionally NOT created in this migration.
-- They will be added in the next migration after the identity
-- and permission structure exists.
-- ============================================================


-- ------------------------------------------------------------
-- EXTENSIONS
-- ------------------------------------------------------------

create extension if not exists pgcrypto;


-- ------------------------------------------------------------
-- SHARED UPDATED_AT FUNCTION
-- ------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


-- ============================================================
-- 1. WORKSPACES
-- ============================================================

create table public.workspaces (
    id uuid primary key default gen_random_uuid(),

    name text not null,
    slug text not null,

    status text not null default 'active'
        check (status in ('active', 'inactive', 'archived')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint workspaces_slug_unique unique (slug)
);


create trigger set_workspaces_updated_at
before update on public.workspaces
for each row
execute function public.set_updated_at();


-- ============================================================
-- 2. PRINCIPALS
-- ============================================================
--
-- A Principal is an actor in the system.
--
-- Examples:
--   Diana
--   Evaluation Agent
--   Application Agent
--   Outreach Agent
--   Trusted system process
--
-- A Principal does NOT automatically have access to a Workspace.
-- Access is granted through workspace_memberships.
-- ============================================================

create table public.principals (
    id uuid primary key default gen_random_uuid(),

    principal_type text not null
        check (principal_type in ('human', 'agent', 'system')),

    auth_user_id uuid null
        references auth.users(id)
        on delete set null,

    name text not null,

    status text not null default 'active'
        check (status in ('active', 'inactive', 'suspended')),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- A Supabase Auth user should map to at most one Principal.
create unique index principals_auth_user_id_unique
on public.principals(auth_user_id)
where auth_user_id is not null;


create trigger set_principals_updated_at
before update on public.principals
for each row
execute function public.set_updated_at();


-- ============================================================
-- 3. ROLES
-- ============================================================
--
-- Roles bundle permissions.
--
-- workspace_id = NULL
--   Global/system role that may be reused across Workspaces.
--
-- workspace_id populated
--   Role defined specifically for one Workspace.
-- ============================================================

create table public.roles (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid null
        references public.workspaces(id)
        on delete cascade,

    name text not null,
    description text null,

    is_system_role boolean not null default false,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);


-- Prevent duplicate global role names.
create unique index roles_global_name_unique
on public.roles(lower(name))
where workspace_id is null;


-- Prevent duplicate role names inside the same Workspace.
create unique index roles_workspace_name_unique
on public.roles(workspace_id, lower(name))
where workspace_id is not null;


create index roles_workspace_id_idx
on public.roles(workspace_id);


create trigger set_roles_updated_at
before update on public.roles
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. PERMISSIONS
-- ============================================================
--
-- Permissions describe explicit capabilities.
--
-- Examples:
--   opportunity.read
--   evaluation.create
--   application.prepare
--   application.submit
--   outreach.draft
--   outreach.send
-- ============================================================

create table public.permissions (
    id uuid primary key default gen_random_uuid(),

    permission_key text not null,
    domain text not null,
    action text not null,

    description text null,

    created_at timestamptz not null default now(),

    constraint permissions_permission_key_unique
        unique (permission_key)
);


create index permissions_domain_idx
on public.permissions(domain);


-- ============================================================
-- 5. ROLE PERMISSIONS
-- ============================================================
--
-- Many-to-many relationship:
--
-- Role
--   ↓
-- Permissions
-- ============================================================

create table public.role_permissions (
    id uuid primary key default gen_random_uuid(),

    role_id uuid not null
        references public.roles(id)
        on delete cascade,

    permission_id uuid not null
        references public.permissions(id)
        on delete cascade,

    created_at timestamptz not null default now(),

    constraint role_permissions_unique
        unique (role_id, permission_id)
);


create index role_permissions_permission_id_idx
on public.role_permissions(permission_id);


-- ============================================================
-- 6. WORKSPACE MEMBERSHIPS
-- ============================================================
--
-- Connects:
--
-- Principal
--      ↓
-- Workspace
--      ↓
-- Role
--
-- A Principal may belong to multiple Workspaces.
--
-- V1 will likely contain:
--
-- Diana
--   ↓
-- Diana Job Search Workspace
--   ↓
-- Owner role
--
-- Future agents may also receive memberships.
-- ============================================================

create table public.workspace_memberships (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    principal_id uuid not null
        references public.principals(id)
        on delete cascade,

    role_id uuid not null
        references public.roles(id)
        on delete restrict,

    status text not null default 'active'
        check (status in ('active', 'inactive', 'suspended')),

    joined_at timestamptz not null default now(),

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint workspace_memberships_unique
        unique (workspace_id, principal_id)
);


create index workspace_memberships_principal_id_idx
on public.workspace_memberships(principal_id);


create index workspace_memberships_role_id_idx
on public.workspace_memberships(role_id);


create trigger set_workspace_memberships_updated_at
before update on public.workspace_memberships
for each row
execute function public.set_updated_at();


-- ============================================================
-- 7. ROLE / WORKSPACE INTEGRITY
-- ============================================================
--
-- Prevent a Workspace Membership from accidentally using a Role
-- owned by a different Workspace.
--
-- Valid:
--
-- Workspace A membership
--   → global role
--
-- Workspace A membership
--   → Workspace A role
--
-- Invalid:
--
-- Workspace A membership
--   → Workspace B role
-- ============================================================

create or replace function public.validate_membership_role_scope()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    role_workspace_id uuid;
begin
    select workspace_id
    into role_workspace_id
    from public.roles
    where id = new.role_id;

    if not found then
        raise exception 'Role % does not exist', new.role_id;
    end if;

    if role_workspace_id is not null
       and role_workspace_id <> new.workspace_id then

        raise exception
            'Role % belongs to a different workspace',
            new.role_id;

    end if;

    return new;
end;
$$;


create trigger validate_workspace_membership_role
before insert or update of workspace_id, role_id
on public.workspace_memberships
for each row
execute function public.validate_membership_role_scope();


-- ============================================================
-- MIGRATION 001 COMPLETE
-- ============================================================
--
-- We now have:
--
-- auth.users
--      ↓
-- principals
--      ↓
-- workspace_memberships
--      ↓
-- roles
--      ↓
-- role_permissions
--      ↓
-- permissions
--
-- NEXT MIGRATION:
-- RLS permission helpers and access policies.
--
-- Do not give ordinary agents unrestricted service_role access.
-- ============================================================
