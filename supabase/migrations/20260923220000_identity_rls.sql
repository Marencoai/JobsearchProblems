-- ============================================================
-- Job Search AI Agent
-- Migration 002: Identity RLS and Permission Foundation
-- ============================================================
--
-- Adds:
--   Foundation permission definitions
--   Global Owner role
--   Current Principal helper
--   Workspace membership helper
--   Permission helper
--   Shared-workspace helper
--   Bootstrap function for first personal Workspace
--   RLS policies for identity/access tables
--
-- Important:
-- Normal application and agent activity should operate through
-- authenticated Principals and RLS.
--
-- service_role is NOT the normal agent identity.
-- ============================================================


-- ============================================================
-- 1. FOUNDATION PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'workspace.read',
        'workspace',
        'read',
        'View a Workspace the Principal belongs to'
    ),
    (
        'workspace.update',
        'workspace',
        'update',
        'Update Workspace settings'
    ),
    (
        'workspace.delete',
        'workspace',
        'delete',
        'Delete a Workspace'
    ),
    (
        'workspace.members.manage',
        'workspace',
        'manage_members',
        'Add, update, or remove Workspace memberships'
    ),
    (
        'workspace.roles.manage',
        'workspace',
        'manage_roles',
        'Create and manage Workspace-specific Roles and Role permissions'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GLOBAL OWNER ROLE
-- ============================================================
--
-- Global roles may be assigned inside any Workspace.
--
-- Owner is reusable, but the membership still determines
-- WHICH Workspace the Principal owns.
-- ============================================================

insert into public.roles (
    workspace_id,
    name,
    description,
    is_system_role
)
select
    null,
    'Owner',
    'Workspace owner with full Workspace administration permissions.',
    true
where not exists (
    select 1
    from public.roles
    where workspace_id is null
      and lower(name) = 'owner'
);


-- Grant all current foundation permissions to Owner.

insert into public.role_permissions (
    role_id,
    permission_id
)
select
    r.id,
    p.id
from public.roles r
cross join public.permissions p
where r.workspace_id is null
  and lower(r.name) = 'owner'
  and p.permission_key in (
      'workspace.read',
      'workspace.update',
      'workspace.delete',
      'workspace.members.manage',
      'workspace.roles.manage'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. CURRENT PRINCIPAL
-- ============================================================
--
-- Supabase authentication identifies a request through auth.uid().
--
-- This function translates:
--
-- auth.users.id
--       ↓
-- principals.id
--
-- Later, human users and authenticated agents can both resolve
-- to a Principal through this pattern.
-- ============================================================

create or replace function public.current_principal_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
    select p.id
    from public.principals p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
    limit 1;
$$;


-- ============================================================
-- 4. WORKSPACE MEMBERSHIP CHECK
-- ============================================================

create or replace function public.is_workspace_member(
    target_workspace_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_memberships wm
        where wm.workspace_id = target_workspace_id
          and wm.principal_id = public.current_principal_id()
          and wm.status = 'active'
    );
$$;


-- ============================================================
-- 5. PERMISSION CHECK
-- ============================================================
--
-- Central permission helper.
--
-- Instead of duplicating long permission logic across every
-- future table policy, policies can ask:
--
-- has_permission(workspace_id, 'opportunity.read')
--
-- ============================================================

create or replace function public.has_permission(
    target_workspace_id uuid,
    required_permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_memberships wm

        join public.role_permissions rp
          on rp.role_id = wm.role_id

        join public.permissions p
          on p.id = rp.permission_id

        where wm.workspace_id = target_workspace_id
          and wm.principal_id = public.current_principal_id()
          and wm.status = 'active'
          and p.permission_key = required_permission_key
    );
$$;


-- ============================================================
-- 6. SHARED WORKSPACE CHECK
-- ============================================================
--
-- Used when a Principal needs to see another Principal.
--
-- Example:
--
-- Diana and Evaluation Agent
-- both belong to the same Workspace.
--
-- Diana may therefore see that agent as an actor in history.
-- ============================================================

create or replace function public.shares_workspace_with_principal(
    target_principal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_memberships mine

        join public.workspace_memberships theirs
          on theirs.workspace_id = mine.workspace_id

        where mine.principal_id = public.current_principal_id()
          and mine.status = 'active'
          and theirs.principal_id = target_principal_id
          and theirs.status = 'active'
    );
$$;


-- ============================================================
-- 7. INITIAL WORKSPACE BOOTSTRAP
-- ============================================================
--
-- We have a chicken-and-egg problem:
--
-- RLS requires Workspace membership.
--
-- But the user's first Workspace does not have a membership yet.
--
-- This controlled function creates:
--
-- Authenticated User
--        ↓
-- Human Principal
--        ↓
-- Workspace
--        ↓
-- Owner Membership
--
-- It runs with elevated database privileges only for this
-- tightly defined bootstrap operation.
-- ============================================================

create or replace function public.bootstrap_personal_workspace(
    workspace_name text,
    workspace_slug text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    authenticated_user_id uuid;
    principal_id_value uuid;
    owner_role_id uuid;
    new_workspace_id uuid;
begin

    authenticated_user_id := auth.uid();

    if authenticated_user_id is null then
        raise exception 'Authentication required';
    end if;


    if nullif(trim(workspace_name), '') is null then
        raise exception 'Workspace name is required';
    end if;


    if nullif(trim(workspace_slug), '') is null then
        raise exception 'Workspace slug is required';
    end if;


    -- --------------------------------------------
    -- Find or create the human Principal.
    -- --------------------------------------------

    select id
    into principal_id_value
    from public.principals
    where auth_user_id = authenticated_user_id;


    if principal_id_value is null then

        insert into public.principals (
            principal_type,
            auth_user_id,
            name,
            status
        )
        values (
            'human',
            authenticated_user_id,
            coalesce(
                auth.jwt() ->> 'email',
                'User'
            ),
            'active'
        )
        returning id
        into principal_id_value;

    end if;


    -- --------------------------------------------
    -- Find the global Owner role.
    -- --------------------------------------------

    select id
    into owner_role_id
    from public.roles
    where workspace_id is null
      and lower(name) = 'owner'
    limit 1;


    if owner_role_id is null then
        raise exception 'Owner role has not been configured';
    end if;


    -- --------------------------------------------
    -- Create Workspace.
    -- --------------------------------------------

    insert into public.workspaces (
        name,
        slug,
        status
    )
    values (
        trim(workspace_name),
        lower(trim(workspace_slug)),
        'active'
    )
    returning id
    into new_workspace_id;


    -- --------------------------------------------
    -- Make authenticated Principal the Owner.
    -- --------------------------------------------

    insert into public.workspace_memberships (
        workspace_id,
        principal_id,
        role_id,
        status
    )
    values (
        new_workspace_id,
        principal_id_value,
        owner_role_id,
        'active'
    );


    return new_workspace_id;

end;
$$;


-- ============================================================
-- 8. FUNCTION EXECUTION PRIVILEGES
-- ============================================================

revoke all on function public.current_principal_id()
from public;

revoke all on function public.is_workspace_member(uuid)
from public;

revoke all on function public.has_permission(uuid, text)
from public;

revoke all on function public.shares_workspace_with_principal(uuid)
from public;

revoke all on function public.bootstrap_personal_workspace(text, text)
from public;


grant execute on function public.current_principal_id()
to authenticated;

grant execute on function public.is_workspace_member(uuid)
to authenticated;

grant execute on function public.has_permission(uuid, text)
to authenticated;

grant execute on function public.shares_workspace_with_principal(uuid)
to authenticated;

grant execute on function public.bootstrap_personal_workspace(text, text)
to authenticated;


-- ============================================================
-- 9. ENABLE RLS
-- ============================================================

alter table public.workspaces
enable row level security;

alter table public.principals
enable row level security;

alter table public.roles
enable row level security;

alter table public.permissions
enable row level security;

alter table public.role_permissions
enable row level security;

alter table public.workspace_memberships
enable row level security;


-- ============================================================
-- 10. WORKSPACE POLICIES
-- ============================================================

create policy "workspace members can view workspace"
on public.workspaces
for select
to authenticated
using (
    public.is_workspace_member(id)
);


create policy "authorized principals can update workspace"
on public.workspaces
for update
to authenticated
using (
    public.has_permission(id, 'workspace.update')
)
with check (
    public.has_permission(id, 'workspace.update')
);


create policy "authorized principals can delete workspace"
on public.workspaces
for delete
to authenticated
using (
    public.has_permission(id, 'workspace.delete')
);


-- Direct Workspace INSERT is intentionally not allowed.
-- New personal Workspaces should initially be created through:
--
-- bootstrap_personal_workspace(...)


-- ============================================================
-- 11. PRINCIPAL POLICIES
-- ============================================================
--
-- A Principal may see:
--
-- itself
-- OR
-- another Principal sharing an active Workspace.
-- ============================================================

create policy "principals can view relevant principals"
on public.principals
for select
to authenticated
using (
    id = public.current_principal_id()
    or public.shares_workspace_with_principal(id)
);


-- Direct Principal creation is intentionally restricted.
-- Initial human Principal creation occurs through the bootstrap
-- function.
--
-- Future agent creation should use a controlled workflow.


-- ============================================================
-- 12. ROLE POLICIES
-- ============================================================

create policy "workspace members can view available roles"
on public.roles
for select
to authenticated
using (
    workspace_id is null
    or public.is_workspace_member(workspace_id)
);


create policy "authorized principals can create workspace roles"
on public.roles
for insert
to authenticated
with check (
    workspace_id is not null
    and public.has_permission(
        workspace_id,
        'workspace.roles.manage'
    )
);


create policy "authorized principals can update workspace roles"
on public.roles
for update
to authenticated
using (
    workspace_id is not null
    and public.has_permission(
        workspace_id,
        'workspace.roles.manage'
    )
)
with check (
    workspace_id is not null
    and public.has_permission(
        workspace_id,
        'workspace.roles.manage'
    )
);


create policy "authorized principals can delete workspace roles"
on public.roles
for delete
to authenticated
using (
    workspace_id is not null
    and public.has_permission(
        workspace_id,
        'workspace.roles.manage'
    )
);


-- Global system roles cannot be modified through normal
-- authenticated table access.


-- ============================================================
-- 13. PERMISSION POLICIES
-- ============================================================
--
-- Permissions are system-defined reference records.
--
-- Authenticated Principals may read them.
-- Normal application access may not modify them.
-- ============================================================

create policy "authenticated principals can view permissions"
on public.permissions
for select
to authenticated
using (true);


-- ============================================================
-- 14. ROLE PERMISSION POLICIES
-- ============================================================

create policy "workspace members can view role permissions"
on public.role_permissions
for select
to authenticated
using (
    exists (
        select 1
        from public.roles r
        where r.id = role_permissions.role_id
          and (
              r.workspace_id is null
              or public.is_workspace_member(r.workspace_id)
          )
    )
);


create policy "authorized principals can assign workspace role permissions"
on public.role_permissions
for insert
to authenticated
with check (
    exists (
        select 1
        from public.roles r
        where r.id = role_permissions.role_id
          and r.workspace_id is not null
          and public.has_permission(
              r.workspace_id,
              'workspace.roles.manage'
          )
    )
);


create policy "authorized principals can remove workspace role permissions"
on public.role_permissions
for delete
to authenticated
using (
    exists (
        select 1
        from public.roles r
        where r.id = role_permissions.role_id
          and r.workspace_id is not null
          and public.has_permission(
              r.workspace_id,
              'workspace.roles.manage'
          )
    )
);


-- ============================================================
-- 15. WORKSPACE MEMBERSHIP POLICIES
-- ============================================================

create policy "workspace members can view memberships"
on public.workspace_memberships
for select
to authenticated
using (
    public.is_workspace_member(workspace_id)
);


create policy "authorized principals can create memberships"
on public.workspace_memberships
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


create policy "authorized principals can update memberships"
on public.workspace_memberships
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


create policy "authorized principals can delete memberships"
on public.workspace_memberships
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


-- ============================================================
-- MIGRATION 002 COMPLETE
-- ============================================================
--
-- We now have the first working access-control chain:
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
-- RLS can now ask:
--
-- Who are you?
-- Which Workspace are you in?
-- What Role do you have?
-- Does that Role contain the required Permission?
--
-- NEXT:
-- Add the V1 domain permission catalog and begin the
-- Core Opportunity tables.
-- ============================================================
