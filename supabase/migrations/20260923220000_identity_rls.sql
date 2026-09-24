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
as $
    select p.id
    from public.principals p
    where p.auth_user_id = auth.uid()
      and p.status = 'active'
    limit 1;
$;


-- ============================================================
-- 3A. CURRENT PRINCIPAL TYPE CHECK
-- ============================================================
--
-- Role, permission, and membership administration are authority
-- expansion operations. Normal AI agents must not be able to
-- grant themselves or other agents additional authority even if
-- a role is misconfigured later.
-- ============================================================

create or replace function public.current_principal_is_human()
returns boolean
language sql
stable
security definer
set search_path = public
as $
    select coalesce(
        (
            select p.principal_type = 'human'
            from public.principals p
            where p.id = public.current_principal_id()
            limit 1
        ),
        false
    );
$;


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

          -- Historical actors remain visible even if their
          -- Workspace membership was later suspended or
          -- deactivated. This preserves audit readability.
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


-- Physical Workspace deletion is intentionally not exposed to
-- normal authenticated application access.
--
-- V1 uses status = 'archived' for normal retirement.
--
-- A future privileged purge workflow may perform full deletion
-- when required for account/data removal.


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
    and public.current_principal_is_human()
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
    and public.current_principal_is_human()
    and public.has_permission(
        workspace_id,
        'workspace.roles.manage'
    )
)
with check (
    workspace_id is not null
    and public.current_principal_is_human()
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
    and public.current_principal_is_human()
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
          and public.current_principal_is_human()
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
          and public.current_principal_is_human()
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
    public.current_principal_is_human()
    and public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


create policy "authorized principals can update memberships"
on public.workspace_memberships
for update
to authenticated
using (
    public.current_principal_is_human()
    and public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
)
with check (
    public.current_principal_is_human()
    and public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


create policy "authorized principals can delete memberships"
on public.workspace_memberships
for delete
to authenticated
using (
    public.current_principal_is_human()
    and public.has_permission(
        workspace_id,
        'workspace.members.manage'
    )
);


-- ============================================================
-- 16. MEMBERSHIP ROLE-ASSIGNMENT GUARD
-- ============================================================
--
-- workspace.members.manage controls membership administration.
--
-- Assigning or changing a Role is a stronger capability because
-- a Role determines what the Principal may do.
--
-- Therefore:
--
--   membership creation/update
--        +
--   role assignment
--
-- are not treated as identical powers.
--
-- The only exception is the controlled first-Workspace bootstrap
-- where the newly created human Principal receives the global
-- Owner Role before any membership exists.
-- ============================================================

create or replace function public.enforce_membership_role_assignment()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    actor_id uuid;
    membership_count integer;
    target_role_workspace_id uuid;
    target_role_name text;
begin

    actor_id := public.current_principal_id();


    -- --------------------------------------------------------
    -- Membership identity is immutable.
    --
    -- To assign a different Principal, create a new Membership
    -- and remove the old one. Do not transfer a privileged row.
    -- --------------------------------------------------------

    if tg_op = 'UPDATE' then

        if new.id <> old.id
           or new.principal_id <> old.principal_id then

            raise exception
                'Workspace Membership id and principal_id are immutable';

        end if;


        -- Role did not change during this update.

        if new.role_id = old.role_id then
            return new;
        end if;

    end if;


    -- --------------------------------------------------------
    -- Resolve target Role.
    -- --------------------------------------------------------

    select
        workspace_id,
        lower(name)
    into
        target_role_workspace_id,
        target_role_name
    from public.roles
    where id = new.role_id;


    if not found then
        raise exception
            'Role % does not exist',
            new.role_id;
    end if;


    -- --------------------------------------------------------
    -- Controlled first-Workspace bootstrap exception.
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        select count(*)
        into membership_count
        from public.workspace_memberships
        where workspace_id = new.workspace_id;


        if membership_count = 0
           and actor_id = new.principal_id
           and target_role_workspace_id is null
           and target_role_name = 'owner' then

            return new;

        end if;

    end if;


    -- --------------------------------------------------------
    -- All other Role assignment requires explicit Role
    -- administration authority.
    -- --------------------------------------------------------

    if not public.current_principal_is_human() then

        raise exception
            'Only a human Principal may assign or change Workspace Roles';

    end if;


    if not public.has_permission(
        new.workspace_id,
        'workspace.roles.manage'
    ) then

        raise exception
            'Permission workspace.roles.manage is required to assign or change Workspace Roles';

    end if;


    return new;

end;
$$;


create trigger enforce_membership_role_assignment_before_write
before insert or update
on public.workspace_memberships
for each row
execute function public.enforce_membership_role_assignment();


-- ============================================================
-- 17. PROTECT OWNER MEMBERSHIPS
-- ============================================================
--
-- Prevent:
--
--   a lower-privileged membership manager from stripping an
--   Owner Role
--
-- and:
--
--   a Workspace from accidentally losing its final active Owner.
--
-- ============================================================

create or replace function public.protect_workspace_owner_membership()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    owner_role_id uuid;
    removing_owner boolean := false;
    remaining_owner_count integer;
begin

    select id
    into owner_role_id
    from public.roles
    where workspace_id is null
      and lower(name) = 'owner'
    limit 1;


    if owner_role_id is null then
        raise exception
            'Global Owner Role is not configured';
    end if;


    if old.role_id <> owner_role_id
       or old.status <> 'active' then

        if tg_op = 'DELETE' then
            return old;
        end if;

        return new;

    end if;


    if tg_op = 'DELETE' then

        removing_owner := true;

    else

        removing_owner :=
            new.role_id <> owner_role_id
            or new.status <> 'active';

    end if;


    if not removing_owner then
        return new;
    end if;


    -- When the entire Workspace itself is being deleted, the
    -- membership removal is part of ON DELETE CASCADE rather
    -- than an attempt to orphan a live Workspace.
    --
    -- In that case the parent Workspace row is already gone for
    -- this referential action and the owner-preservation rule
    -- should not block the Workspace deletion.

    if not exists (
        select 1
        from public.workspaces w
        where w.id = old.workspace_id
    ) then

        if tg_op = 'DELETE' then
            return old;
        end if;

        return new;

    end if;


    if not public.has_permission(
        old.workspace_id,
        'workspace.roles.manage'
    ) then

        raise exception
            'Permission workspace.roles.manage is required to remove an Owner membership';

    end if;


    select count(*)
    into remaining_owner_count
    from public.workspace_memberships wm
    where wm.workspace_id = old.workspace_id
      and wm.role_id = owner_role_id
      and wm.status = 'active'
      and wm.id <> old.id;


    if remaining_owner_count = 0 then

        raise exception
            'A Workspace must retain at least one active Owner';

    end if;


    if tg_op = 'DELETE' then
        return old;
    end if;

    return new;

end;
$$;


create trigger protect_workspace_owner_membership_before_delete
before delete
on public.workspace_memberships
for each row
execute function public.protect_workspace_owner_membership();


create trigger protect_workspace_owner_membership_before_update
before update of role_id, status
on public.workspace_memberships
for each row
execute function public.protect_workspace_owner_membership();


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
