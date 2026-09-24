-- ============================================================
-- Job Search AI Agent
-- Migration 016: Candidate Settings and Automation Policies
-- ============================================================
--
-- Audit-discovered V1 completion.
--
-- Creates:
--   candidate_settings
--   automation_policies
--
-- Why this migration exists:
--
-- The V1 architecture already depends on configurable:
--
--   location preferences
--   compensation preferences
--   role preferences
--   search strategy
--   work-block preferences
--   daily opportunity target
--   progressive autonomy by action type
--
-- Those concepts were designed but had not yet been translated
-- into executable migrations.
--
-- ============================================================


-- ============================================================
-- 1. SETTINGS / AUTOMATION PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'settings.read',
        'settings',
        'read',
        'View Candidate Settings'
    ),
    (
        'settings.manage',
        'settings',
        'manage',
        'Create or update Candidate Settings'
    ),
    (
        'automation_policy.read',
        'automation_policy',
        'read',
        'View action-specific Automation Policies'
    ),
    (
        'automation_policy.manage',
        'automation_policy',
        'manage',
        'Create or update action-specific Automation Policies'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT SETTINGS PERMISSIONS TO OWNER
-- ============================================================

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
      'settings.read',
      'settings.manage',
      'automation_policy.read',
      'automation_policy.manage'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. CANDIDATE SETTINGS
-- ============================================================
--
-- One Candidate Settings record per Workspace.
--
-- The Workspace represents one governed job-search environment.
-- Additional humans such as a coach may collaborate inside that
-- Workspace, but the settings describe the candidate/search.
--
-- Flexible preference domains remain JSONB so the product can
-- evolve without creating a new column for every preference.
--
-- ============================================================

create table public.candidate_settings (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    timezone text null,

    search_strategy text not null default 'balanced'
        check (
            search_strategy in (
                'balanced',
                'opportunity_first',
                'hireability_first'
            )
        ),

    daily_opportunity_target integer not null default 4
        check (
            daily_opportunity_target > 0
            and daily_opportunity_target <= 100
        ),

    minimum_successful_grade text not null default 'B'
        check (
            minimum_successful_grade in (
                'A+',
                'A',
                'B',
                'C',
                'needs_attention'
            )
        ),

    candidate_profile jsonb not null default '{}'::jsonb,

    role_preferences jsonb not null default '{}'::jsonb,

    location_preferences jsonb not null default '{}'::jsonb,

    compensation_preferences jsonb not null default '{}'::jsonb,

    company_preferences jsonb not null default '{}'::jsonb,

    work_style_preferences jsonb not null default '{}'::jsonb,

    travel_preferences jsonb not null default '{}'::jsonb,

    queue_preferences jsonb not null default '{}'::jsonb,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint candidate_settings_workspace_unique
        unique (workspace_id),

    constraint candidate_settings_workspace_id_id_unique
        unique (workspace_id, id)
);


create trigger set_candidate_settings_updated_at
before update
on public.candidate_settings
for each row
execute function public.set_updated_at();


create trigger set_candidate_settings_actor_audit
before insert or update
on public.candidate_settings
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_candidate_settings_workspace_change
before update of workspace_id
on public.candidate_settings
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. INITIALIZE SETTINGS FOR NEW WORKSPACES
-- ============================================================
--
-- Every new Workspace receives one default Candidate Settings
-- record automatically.
--
-- This keeps bootstrap behavior deterministic and avoids a
-- partially initialized Workspace with no settings row.
-- ============================================================

create or replace function public.initialize_candidate_settings_for_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    insert into public.candidate_settings (
        workspace_id
    )
    values (
        new.id
    )
    on conflict (workspace_id) do nothing;


    return new;

end;
$$;


revoke all on function
    public.initialize_candidate_settings_for_workspace()
from public;


create trigger initialize_candidate_settings_after_workspace_insert
after insert
on public.workspaces
for each row
execute function public.initialize_candidate_settings_for_workspace();


-- Backfill any Workspace that may already exist when this
-- migration is applied to an existing environment.

insert into public.candidate_settings (
    workspace_id
)
select
    w.id
from public.workspaces w
on conflict (workspace_id) do nothing;


-- ============================================================
-- 5. AUTOMATION POLICIES
-- ============================================================
--
-- Permissions answer:
--
--   "May this Principal perform this kind of action?"
--
-- Automation Policies answer:
--
--   "Under what level of autonomy may the system perform this
--    action for this Workspace?"
--
-- Both must agree.
--
-- Examples of action_key:
--
--   application.submit
--   outreach.send
--   email.send
--   calendar.write
--   gmail.organize
--   interview.prepare
--
-- An action_key does not have to correspond to an already
-- implemented external integration. Policies may be configured
-- before the external action is available.
--
-- ============================================================

create table public.automation_policies (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    action_key text not null,

    autonomy_level text not null default 'prepare_only'
        check (
            autonomy_level in (
                'prepare_only',
                'approve_before_action',
                'act_within_rules',
                'autonomous'
            )
        ),

    is_enabled boolean not null default true,

    rules jsonb not null default '{}'::jsonb,

    notes text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint automation_policies_workspace_id_id_unique
        unique (workspace_id, id),

    constraint automation_policies_action_unique
        unique (
            workspace_id,
            action_key
        ),

    constraint automation_policies_action_key_not_blank
        check (
            nullif(btrim(action_key), '') is not null
        ),

    constraint automation_policies_action_key_normalized
        check (
            action_key = lower(btrim(action_key))
        )
);


create index automation_policies_workspace_enabled_idx
on public.automation_policies(
    workspace_id,
    is_enabled
);


create trigger set_automation_policies_updated_at
before update
on public.automation_policies
for each row
execute function public.set_updated_at();


create trigger set_automation_policies_actor_audit
before insert or update
on public.automation_policies
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_automation_policies_workspace_change
before update of workspace_id
on public.automation_policies
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. HUMAN-CONTROLLED SETTINGS AND AUTONOMY
-- ============================================================
--
-- Candidate preferences and authority expansion are human
-- decisions. Even if an agent role is accidentally granted a
-- settings-management permission later, it may not change these
-- records through normal authenticated access.
--
-- Trusted migration/backend execution with no auth.uid() is
-- still allowed for deterministic initialization.
-- ============================================================

create or replace function public.require_human_configuration_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
    actor_id uuid;
begin

    if auth.uid() is null then
        return new;
    end if;


    actor_id := public.current_principal_id();

    if actor_id is null
       or not public.is_active_workspace_human(
           new.workspace_id,
           actor_id
       ) then

        raise exception
            'Candidate Settings and Automation Policies may only be changed by an active human Principal';

    end if;


    return new;

end;
$;


revoke all on function public.require_human_configuration_actor()
from public;


create trigger require_human_candidate_settings_actor
before insert or update
on public.candidate_settings
for each row
execute function public.require_human_configuration_actor();


create trigger require_human_automation_policy_actor
before insert or update
on public.automation_policies
for each row
execute function public.require_human_configuration_actor();


-- ============================================================
-- 7. ENABLE RLS
-- ============================================================

alter table public.candidate_settings
enable row level security;

alter table public.automation_policies
enable row level security;


-- ============================================================
-- 8. CANDIDATE SETTINGS POLICIES
-- ============================================================

create policy "authorized principals can view candidate settings"
on public.candidate_settings
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'settings.read'
    )
);


create policy "authorized principals can create candidate settings"
on public.candidate_settings
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'settings.manage'
    )
);


create policy "authorized principals can update candidate settings"
on public.candidate_settings
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'settings.manage'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'settings.manage'
    )
);


-- No normal DELETE policy.
-- Settings are updated rather than discarded.


-- ============================================================
-- 9. AUTOMATION POLICY RLS
-- ============================================================

create policy "authorized principals can view automation policies"
on public.automation_policies
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'automation_policy.read'
    )
);


create policy "authorized principals can create automation policies"
on public.automation_policies
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'automation_policy.manage'
    )
);


create policy "authorized principals can update automation policies"
on public.automation_policies
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'automation_policy.manage'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'automation_policy.manage'
    )
);


-- No normal DELETE policy.
-- Set is_enabled = false when an Automation Policy should stop
-- applying.


-- ============================================================
-- 10. PROGRESSIVE AUTONOMY MODEL
-- ============================================================
--
-- Database permission
--        +
-- Automation Policy
--        +
-- Required approval / safety checks
--        =
-- External action authority
--
--
-- Example:
--
-- Application Agent Role:
--
-- application.prepare = allowed
-- application.submit = allowed
--
-- Workspace Automation Policy:
--
-- action_key = application.submit
-- autonomy_level = approve_before_action
--
-- Result:
--
-- Application Agent may prepare a submission action, but the
-- external action still waits for candidate approval.
--
-- ============================================================


-- ============================================================
-- MIGRATION 016 COMPLETE
-- ============================================================
--
-- V1 configuration now has durable storage for:
--
--   Candidate Settings
--   Search strategy
--   Preference domains
--   Daily opportunity target
--   Daily success threshold
--   Work-queue preferences
--   Action-specific progressive autonomy
--
-- This closes the configuration gap found during the
-- pre-deployment migration audit.
--
-- ============================================================
