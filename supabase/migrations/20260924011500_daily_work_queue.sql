-- ============================================================
-- Job Search AI Agent
-- Migration 012: Daily Work Queue Foundation
-- ============================================================
--
-- Creates:
--   daily_plans
--   work_blocks
--   daily_plan_items
--
-- Also adds:
--   Daily-plan permissions
--   Automatic Daily Plan version numbering
--   Historical Next Action snapshots
--
-- Core principle:
--
-- Internal Tasks
--      ↓
-- Next Actions
--      ↓
-- Daily Plan
--      ↓
-- Work Blocks
--      ↓
-- Candidate-facing day
--
-- The Daily Work Queue should answer:
--
--   "What should I do today, and why?"
--
-- ============================================================


-- ============================================================
-- 1. DAILY PLAN PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'daily_plan.read',
        'daily_plan',
        'read',
        'View Daily Work Plans'
    ),
    (
        'daily_plan.create',
        'daily_plan',
        'create',
        'Generate Daily Work Plans'
    ),
    (
        'daily_plan.update',
        'daily_plan',
        'update',
        'Update active Daily Work Plans'
    ),
    (
        'daily_plan.complete',
        'daily_plan',
        'complete',
        'Finalize Daily Work Plans and daily progress'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT DAILY PLAN PERMISSIONS TO OWNER
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
      'daily_plan.read',
      'daily_plan.create',
      'daily_plan.update',
      'daily_plan.complete'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. DAILY PLANS
-- ============================================================
--
-- Represents one candidate-facing plan for one calendar day.
--
-- A day may have multiple versions.
--
-- Example:
--
-- September 24
--
-- v1
-- 8:00 AM
-- Today's One Thing:
-- Apply to Mor Furniture
--
-- Recruiter replies at 11:00 AM.
--
-- v2
-- 11:10 AM
-- Today's One Thing:
-- Respond to interview request
--
-- v1 remains preserved.
-- ============================================================

create table public.daily_plans (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    plan_date date not null,

    version_number integer not null,

    status text not null default 'draft'
        check (
            status in (
                'draft',
                'active',
                'completed',
                'superseded'
            )
        ),

    -- Selected only after plan items exist.
    todays_one_thing_action_id uuid null,

    grade text null
        check (
            grade is null
            or grade in (
                'A+',
                'A',
                'B',
                'C',
                'needs_attention'
            )
        ),

    score numeric null
        check (
            score is null
            or (
                score >= 0
                and score <= 100
            )
        ),

    summary text null,

    generated_at timestamptz not null default now(),

    completed_at timestamptz null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint daily_plans_workspace_id_id_unique
        unique (workspace_id, id),

    constraint daily_plans_date_version_unique
        unique (
            workspace_id,
            plan_date,
            version_number
        ),

    constraint daily_plans_version_positive
        check (version_number > 0),

    constraint daily_plans_todays_one_thing_workspace_fk
        foreign key (
            workspace_id,
            todays_one_thing_action_id
        )
        references public.next_actions(
            workspace_id,
            id
        )
        on delete restrict
);


create index daily_plans_workspace_date_idx
on public.daily_plans(
    workspace_id,
    plan_date desc
);


create index daily_plans_status_idx
on public.daily_plans(
    workspace_id,
    status
);


-- Only one active Daily Plan should exist for one Workspace
-- and date at a time.

create unique index daily_plans_one_active_per_day
on public.daily_plans(
    workspace_id,
    plan_date
)
where status = 'active';


create trigger set_daily_plans_updated_at
before update on public.daily_plans
for each row
execute function public.set_updated_at();


create trigger set_daily_plans_actor_audit
before insert or update
on public.daily_plans
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_daily_plans_workspace_change
before update of workspace_id
on public.daily_plans
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. AUTOMATIC DAILY PLAN VERSIONING
-- ============================================================
--
-- Version numbers are assigned by the database.
--
-- We lock:
--
-- Workspace + Plan Date
--
-- during version assignment so two simultaneous plan-generation
-- workflows cannot both create v2.
-- ============================================================

create or replace function public.prepare_daily_plan_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    lock_key bigint;
begin

    lock_key :=
        hashtextextended(
            new.workspace_id::text
            || ':daily_plan:'
            || new.plan_date::text,
            0
        );

    perform pg_advisory_xact_lock(lock_key);


    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.daily_plans
    where workspace_id = new.workspace_id
      and plan_date = new.plan_date;


    -- New plans always begin as drafts.

    new.status := 'draft';

    new.completed_at := null;

    new.grade := null;

    new.score := null;


    return new;

end;
$$;


create trigger prepare_daily_plan_before_insert
before insert
on public.daily_plans
for each row
execute function public.prepare_daily_plan_insert();


-- ============================================================
-- 5. WORK BLOCKS
-- ============================================================
--
-- Represents a focused group of candidate-facing work.
--
-- Examples:
--
-- Morning Review
-- Application Block
-- Outreach Block
-- Interview Preparation
-- Quick Tasks
--
-- ============================================================

create table public.work_blocks (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    daily_plan_id uuid not null,

    name text not null,

    block_order integer not null
        check (block_order > 0),

    planned_start_at timestamptz null,

    estimated_minutes integer null
        check (
            estimated_minutes is null
            or estimated_minutes >= 0
        ),

    status text not null default 'planned'
        check (
            status in (
                'planned',
                'active',
                'completed',
                'skipped'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint work_blocks_workspace_id_id_unique
        unique (workspace_id, id),

    constraint work_blocks_plan_order_unique
        unique (
            workspace_id,
            daily_plan_id,
            block_order
        ),

    constraint work_blocks_daily_plan_workspace_fk
        foreign key (
            workspace_id,
            daily_plan_id
        )
        references public.daily_plans(
            workspace_id,
            id
        )
        on delete cascade
);


create index work_blocks_daily_plan_idx
on public.work_blocks(
    workspace_id,
    daily_plan_id,
    block_order
);


create trigger set_work_blocks_updated_at
before update on public.work_blocks
for each row
execute function public.set_updated_at();


create trigger set_work_blocks_actor_audit
before insert or update
on public.work_blocks
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_work_blocks_workspace_change
before update of workspace_id
on public.work_blocks
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. DAILY PLAN ITEMS
-- ============================================================
--
-- Represents how one Next Action appeared in one Daily Plan.
--
-- Important:
--
-- The Next Action itself may later change.
--
-- The Daily Plan Item preserves:
--
--   what the candidate was shown
--   where it appeared
--   why it was prioritized
--   its priority at that moment
--
-- ============================================================

create table public.daily_plan_items (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    daily_plan_id uuid not null,

    work_block_id uuid null,

    next_action_id uuid not null,

    display_order integer not null
        check (display_order > 0),

    priority_snapshot integer not null
        check (
            priority_snapshot >= 0
            and priority_snapshot <= 100
        ),

    reason_for_priority text null,

    planned_status text not null default 'required'
        check (
            planned_status in (
                'required',
                'later',
                'optional',
                'background'
            )
        ),

    completion_status text not null default 'pending'
        check (
            completion_status in (
                'pending',
                'completed',
                'carried_forward',
                'removed'
            )
        ),

    -- Historical snapshot of the candidate-facing Next Action
    -- when this Plan was generated.
    action_snapshot jsonb not null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint daily_plan_items_workspace_id_id_unique
        unique (workspace_id, id),

    constraint daily_plan_items_action_unique
        unique (
            workspace_id,
            daily_plan_id,
            next_action_id
        ),

    constraint daily_plan_items_display_order_unique
        unique (
            workspace_id,
            daily_plan_id,
            display_order
        ),

    constraint daily_plan_items_daily_plan_workspace_fk
        foreign key (
            workspace_id,
            daily_plan_id
        )
        references public.daily_plans(
            workspace_id,
            id
        )
        on delete cascade,

    constraint daily_plan_items_work_block_workspace_fk
        foreign key (
            workspace_id,
            work_block_id
        )
        references public.work_blocks(
            workspace_id,
            id
        )
        on delete restrict,

    constraint daily_plan_items_next_action_workspace_fk
        foreign key (
            workspace_id,
            next_action_id
        )
        references public.next_actions(
            workspace_id,
            id
        )
        on delete restrict
);


create index daily_plan_items_plan_idx
on public.daily_plan_items(
    workspace_id,
    daily_plan_id,
    display_order
);


create index daily_plan_items_block_idx
on public.daily_plan_items(
    workspace_id,
    work_block_id,
    display_order
)
where work_block_id is not null;


create index daily_plan_items_action_idx
on public.daily_plan_items(
    workspace_id,
    next_action_id
);


create trigger set_daily_plan_items_updated_at
before update on public.daily_plan_items
for each row
execute function public.set_updated_at();


create trigger set_daily_plan_items_actor_audit
before insert or update
on public.daily_plan_items
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_daily_plan_items_workspace_change
before update of workspace_id
on public.daily_plan_items
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 7. DAILY PLAN ITEM CONSISTENCY + ACTION SNAPSHOT
-- ============================================================
--
-- Validates:
--
-- 1. Next Action belongs to same Workspace.
--
-- 2. Work Block, if present, belongs to the SAME Daily Plan.
--
-- 3. Preserve exactly what the candidate-facing action looked
--    like when the plan was generated.
--
-- ============================================================

create or replace function public.prepare_daily_plan_item()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    action_record public.next_actions%rowtype;
    block_plan_id uuid;
begin

    -- --------------------------------------------------------
    -- Load Next Action.
    -- --------------------------------------------------------

    select *
    into action_record
    from public.next_actions
    where workspace_id = new.workspace_id
      and id = new.next_action_id;


    if not found then
        raise exception
            'Next Action % does not exist in Workspace %',
            new.next_action_id,
            new.workspace_id;
    end if;


    -- Only open actions should normally enter a new Daily Plan.

    if action_record.status <> 'open' then
        raise exception
            'Only open Next Actions may be added to a new Daily Plan';

    end if;


    -- --------------------------------------------------------
    -- Validate Work Block belongs to this Daily Plan.
    -- --------------------------------------------------------

    if new.work_block_id is not null then

        select daily_plan_id
        into block_plan_id
        from public.work_blocks
        where workspace_id = new.workspace_id
          and id = new.work_block_id;


        if not found then
            raise exception
                'Work Block % does not exist in Workspace %',
                new.work_block_id,
                new.workspace_id;
        end if;


        if block_plan_id <> new.daily_plan_id then
            raise exception
                'Daily Plan Item Work Block belongs to a different Daily Plan';
        end if;

    end if;


    -- --------------------------------------------------------
    -- Priority snapshot comes from the actual Next Action.
    --
    -- The caller should not rewrite history by supplying an
    -- arbitrary different value.
    -- --------------------------------------------------------

    new.priority_snapshot :=
        action_record.priority;


    -- --------------------------------------------------------
    -- Freeze what the candidate saw.
    -- --------------------------------------------------------

    new.action_snapshot :=
        jsonb_build_object(

            'next_action_id',
            action_record.id,

            'opportunity_id',
            action_record.opportunity_id,

            'internal_task_id',
            action_record.internal_task_id,

            'assigned_to_principal_id',
            action_record.assigned_to_principal_id,

            'action_type',
            action_record.action_type,

            'title',
            action_record.title,

            'context_summary',
            action_record.context_summary,

            'priority',
            action_record.priority,

            'due_at',
            action_record.due_at,

            'estimated_minutes',
            action_record.estimated_minutes,

            'approval_required',
            action_record.approval_required,

            'todays_one_thing_eligible',
            action_record.todays_one_thing_eligible,

            'status',
            action_record.status,

            'snapshot_at',
            now()
        );


    return new;

end;
$$;


create trigger prepare_daily_plan_item_before_insert
before insert
on public.daily_plan_items
for each row
execute function public.prepare_daily_plan_item();


-- ============================================================
-- 8. WHY DAILY PLAN ITEMS ARE SNAPSHOTS
-- ============================================================
--
-- Imagine:
--
-- 8:00 AM
--
-- Next Action:
--
-- "Apply to Mor Furniture"
-- priority = 88
--
-- Daily Plan v1 records that.
--
--
-- At 11:00 AM:
--
-- recruiter replies from another Opportunity.
--
-- The system reprioritizes.
--
-- Mor Furniture Next Action may now be:
--
-- priority = 72
--
--
-- Daily Plan v1 should STILL show:
--
-- priority = 88
--
-- because that is what the system presented at 8:00 AM.
--
-- Daily Plan v2 can preserve the new state.
--
-- ============================================================


-- ============================================================
-- 9. TODAY'S ONE THING
-- ============================================================
--
-- We intentionally do NOT create:
--
-- todays_one_thing
--
-- as its own Task or table.
--
-- It is a designation applied to an existing Next Action.
--
-- daily_plans.todays_one_thing_action_id
--
-- identifies the selected action.
--
-- A later lifecycle migration will validate that:
--
--   the action exists in the Daily Plan
--   the action is eligible
--   only one action is selected
--
-- ============================================================


-- ============================================================
-- 10. DAILY GRADE
-- ============================================================
--
-- The Daily Plan supports:
--
-- score
-- grade
--
-- Current intended interpretation:
--
-- A+  = 95–100
-- A   = 90–94
-- B   = 80–89
-- C   = 70–79
-- Needs Attention = below 70
--
--
-- The exact scoring model should NOT yet be hard-coded into
-- database constraints.
--
-- Why?
--
-- We still need to calibrate:
--
-- urgency
-- leverage
-- critical actions
-- growth work
-- completed work
-- appropriately rescheduled work
--
-- The database stores the result.
--
-- The workflow layer determines the score.
--
-- ============================================================


-- ============================================================
-- 11. DAILY WORK QUEUE MODEL
-- ============================================================
--
-- Next Actions
--       ↓
-- Daily Plan
--       ↓
-- Work Blocks
--       ↓
-- Daily Plan Items
--
--
-- Candidate sees:
--
-- Today's One Thing
--
-- Morning Review
--   □ Respond to recruiter
--
-- Application Block
--   □ Review Mor Furniture application
--
-- Outreach Block
--   □ Follow hiring manager
--
-- Optional
--   □ Add one Candidate Knowledge story
--
-- ============================================================


-- ============================================================
-- MIGRATION 012 COMPLETE
-- ============================================================
--
-- Daily Work Queue structure now exists.
--
-- NEXT MIGRATION:
--
-- Daily Work Queue RLS + lifecycle controls
--
-- That migration will enforce:
--
--   draft → active → completed
--   plan supersession
--   Today's One Thing validity
--   historical-plan immutability
--   Work Block lifecycle
--   Daily Plan Item lifecycle
--   Workspace RLS
--
-- ============================================================
