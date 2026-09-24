-- ============================================================
-- Job Search AI Agent
-- Migration 013: Daily Work Queue RLS + Lifecycle Protection
-- ============================================================
--
-- Protects:
--   daily_plans
--   work_blocks
--   daily_plan_items
--
-- Adds:
--   Daily Plan lifecycle
--   Automatic supersession of older active plans
--   Today's One Thing validation
--   Historical-plan immutability
--   Work Block lifecycle controls
--   Daily Plan Item lifecycle controls
--   Work Block / Daily Plan relationship validation
--   Workspace RLS
--
-- Core principle:
--
-- Draft Plan
--      ↓
-- Build / organize
--      ↓
-- Active Plan
--      ↓
-- Candidate works the plan
--      ↓
-- Completed
--
-- If priorities materially change:
--
-- Active v1
--      ↓
-- Superseded
--
-- Active v2
--
-- v1 remains historical.
-- ============================================================


-- ============================================================
-- 1. DAILY PLAN LIFECYCLE
-- ============================================================
--
-- Valid primary lifecycle:
--
-- draft
--   ↓
-- active
--   ↓
-- completed
--
--
-- A draft or active Plan may instead become:
--
-- superseded
--
--
-- Completed and superseded Plans are historical.
-- ============================================================

create or replace function public.enforce_daily_plan_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    may_update boolean;
    may_complete boolean;
    plan_item_count integer;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    may_update :=
        public.has_permission(
            new.workspace_id,
            'daily_plan.update'
        );

    may_complete :=
        public.has_permission(
            new.workspace_id,
            'daily_plan.complete'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        -- prepare_daily_plan_insert() also sets these values.
        -- We repeat the rule here intentionally so lifecycle
        -- behavior remains explicit.

        new.status := 'draft';

        new.todays_one_thing_action_id := null;

        new.grade := null;
        new.score := null;
        new.completed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Immutable identity / origin fields.
    -- --------------------------------------------------------

    if new.id <> old.id then
        raise exception
            'Daily Plan id is immutable';
    end if;


    if new.workspace_id <> old.workspace_id then
        raise exception
            'Daily Plan Workspace is immutable';
    end if;


    if new.plan_date <> old.plan_date then
        raise exception
            'Daily Plan date is immutable';
    end if;


    if new.version_number <> old.version_number then
        raise exception
            'Daily Plan version is immutable';
    end if;


    if new.generated_at <> old.generated_at then
        raise exception
            'Daily Plan generated_at is immutable';
    end if;


    if new.created_at <> old.created_at then
        raise exception
            'Daily Plan created_at is immutable';
    end if;


    if new.created_by_principal_id
       is distinct from old.created_by_principal_id then

        raise exception
            'Daily Plan creator is immutable';

    end if;


    -- --------------------------------------------------------
    -- Historical plans are immutable.
    -- --------------------------------------------------------

    if old.status in (
        'completed',
        'superseded'
    ) then

        raise exception
            'Completed or superseded Daily Plans are immutable';

    end if;


    -- --------------------------------------------------------
    -- Draft remains Draft.
    --
    -- Full editing is allowed with daily_plan.update.
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'draft' then

        if not may_update then
            raise exception
                'Permission daily_plan.update is required to edit a draft Daily Plan';
        end if;


        -- Grade belongs to the completed historical day,
        -- not a draft plan.

        if new.grade is not null
           or new.score is not null
           or new.completed_at is not null then

            raise exception
                'Draft Daily Plans cannot contain a final grade, score, or completion timestamp';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Draft → Active
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'active' then

        if not may_update then
            raise exception
                'Permission daily_plan.update is required to activate a Daily Plan';
        end if;


        -- A candidate-facing active Plan should contain actual
        -- work.

        select count(*)
        into plan_item_count
        from public.daily_plan_items
        where workspace_id = new.workspace_id
          and daily_plan_id = new.id;


        if plan_item_count = 0 then
            raise exception
                'A Daily Plan must contain at least one Plan Item before activation';
        end if;


        -- ----------------------------------------------------
        -- Supersede any previously active Plan for the same
        -- Workspace and date.
        --
        -- This preserves v1 rather than rewriting it.
        -- ----------------------------------------------------

        update public.daily_plans
        set status = 'superseded'
        where workspace_id = new.workspace_id
          and plan_date = new.plan_date
          and status = 'active'
          and id <> new.id;


        new.grade := null;
        new.score := null;
        new.completed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Draft → Superseded
    --
    -- Useful when a generated draft is abandoned before it ever
    -- becomes the candidate-facing Plan.
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'superseded' then

        if not may_update then
            raise exception
                'Permission daily_plan.update is required to supersede a draft Daily Plan';
        end if;


        old_business_state :=
            to_jsonb(old)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Daily Plan content cannot change while marking the draft superseded';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Active remains Active
    --
    -- Structural reprioritization should create another Plan
    -- version rather than silently rewriting history.
    -- --------------------------------------------------------

    if old.status = 'active'
       and new.status = 'active' then

        old_business_state :=
            to_jsonb(old)
            - array[
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Active Daily Plan content is frozen; create a new Plan version for reprioritization';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Active → Completed
    -- --------------------------------------------------------

    if old.status = 'active'
       and new.status = 'completed' then

        if not may_complete then
            raise exception
                'Permission daily_plan.complete is required to complete a Daily Plan';
        end if;


        -- Structural plan content must not change during
        -- completion.
        --
        -- Grade / score / summary may be finalized.

        old_business_state :=
            to_jsonb(old)
            - array[
                'status',
                'grade',
                'score',
                'summary',
                'completed_at',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'status',
                'grade',
                'score',
                'summary',
                'completed_at',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Daily Plan structure cannot change during completion';
        end if;


        if new.completed_at is null then
            new.completed_at := now();
        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Active → Superseded
    --
    -- This normally happens automatically when a newer version
    -- becomes active.
    -- --------------------------------------------------------

    if old.status = 'active'
       and new.status = 'superseded' then

        if not may_update then
            raise exception
                'Permission daily_plan.update is required to supersede a Daily Plan';
        end if;


        old_business_state :=
            to_jsonb(old)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Daily Plan content cannot change while marking the Plan superseded';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Everything else is invalid.
    -- --------------------------------------------------------

    raise exception
        'Invalid Daily Plan lifecycle transition: % → %',
        old.status,
        new.status;

end;
$$;


revoke all on function public.enforce_daily_plan_lifecycle()
from public;


create trigger enforce_daily_plan_lifecycle_before_write
before insert or update
on public.daily_plans
for each row
execute function public.enforce_daily_plan_lifecycle();


-- ============================================================
-- 2. TODAY'S ONE THING VALIDATION
-- ============================================================
--
-- If Today's One Thing is selected:
--
--   it must appear in this Daily Plan
--   it must be eligible
--   it must still be open when the Plan becomes active
--   it cannot be a background-only Plan Item
--
-- ============================================================

create or replace function public.validate_todays_one_thing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    item_exists boolean;
begin

    if new.todays_one_thing_action_id is null then
        return new;
    end if;


    -- Once a Plan is completed/superseded, we preserve the
    -- historical selection even if the underlying Next Action
    -- later changes state.

    if new.status in (
        'completed',
        'superseded'
    ) then

        return new;

    end if;


    select exists (
        select 1

        from public.daily_plan_items dpi

        join public.next_actions na
          on na.workspace_id = dpi.workspace_id
         and na.id = dpi.next_action_id

        where dpi.workspace_id = new.workspace_id
          and dpi.daily_plan_id = new.id
          and dpi.next_action_id =
              new.todays_one_thing_action_id

          and dpi.planned_status <> 'background'

          and na.todays_one_thing_eligible = true
          and na.status = 'open'
    )
    into item_exists;


    if not item_exists then

        raise exception
            'Today''s One Thing must be an open, eligible Next Action included in this Daily Plan';

    end if;


    return new;

end;
$$;


revoke all on function public.validate_todays_one_thing()
from public;


create trigger validate_todays_one_thing_before_write
before insert or update of
    todays_one_thing_action_id,
    status
on public.daily_plans
for each row
execute function public.validate_todays_one_thing();


-- ============================================================
-- 3. WORK BLOCK PARENT STATUS HELPER
-- ============================================================

create or replace function public.get_daily_plan_status(
    target_workspace_id uuid,
    target_daily_plan_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select status
    from public.daily_plans
    where workspace_id = target_workspace_id
      and id = target_daily_plan_id
    limit 1;
$$;


revoke all on function
    public.get_daily_plan_status(uuid, uuid)
from public;


grant execute on function
    public.get_daily_plan_status(uuid, uuid)
to authenticated;


-- ============================================================
-- 4. WORK BLOCK LIFECYCLE
-- ============================================================
--
-- Draft Plan:
--   Block structure may be created / edited / removed.
--
-- Active Plan:
--   Structure is frozen.
--   Only Block status may progress.
--
-- Completed / Superseded Plan:
--   Blocks are historical and immutable.
--
-- ============================================================

create or replace function public.enforce_work_block_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    plan_status text;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    if tg_op = 'DELETE' then

        plan_status :=
            public.get_daily_plan_status(
                old.workspace_id,
                old.daily_plan_id
            );


        if plan_status <> 'draft' then
            raise exception
                'Work Blocks may only be deleted while the Daily Plan is a draft';
        end if;


        return old;

    end if;


    plan_status :=
        public.get_daily_plan_status(
            new.workspace_id,
            new.daily_plan_id
        );


    if plan_status is null then
        raise exception
            'Daily Plan does not exist';
    end if;


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if plan_status <> 'draft' then
            raise exception
                'Work Blocks may only be added to draft Daily Plans';
        end if;


        new.status := 'planned';

        return new;

    end if;


    -- --------------------------------------------------------
    -- Identity relationships are immutable.
    -- --------------------------------------------------------

    if new.id <> old.id
       or new.daily_plan_id <> old.daily_plan_id
       or new.created_at <> old.created_at
       or new.created_by_principal_id
          is distinct from old.created_by_principal_id then

        raise exception
            'Work Block identity and parent Plan are immutable';

    end if;


    -- --------------------------------------------------------
    -- Draft Plan
    -- --------------------------------------------------------

    if plan_status = 'draft' then

        -- Before activation the Block may be designed freely,
        -- but it remains a planned Block.

        new.status := 'planned';

        return new;

    end if;


    -- --------------------------------------------------------
    -- Historical Plan
    -- --------------------------------------------------------

    if plan_status in (
        'completed',
        'superseded'
    ) then

        raise exception
            'Work Blocks on historical Daily Plans are immutable';

    end if;


    -- --------------------------------------------------------
    -- Active Plan
    --
    -- Only status may change.
    -- --------------------------------------------------------

    if plan_status = 'active' then

        old_business_state :=
            to_jsonb(old)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'status',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Active Work Block structure is frozen';

        end if;


        -- Terminal Block states are immutable.

        if old.status in (
            'completed',
            'skipped'
        )
        and new.status is distinct from old.status then

            raise exception
                'Completed or skipped Work Blocks are terminal';

        end if;


        if old.status = 'planned'
           and new.status not in (
               'planned',
               'active',
               'completed',
               'skipped'
           ) then

            raise exception
                'Invalid Work Block transition';

        end if;


        if old.status = 'active'
           and new.status not in (
               'active',
               'completed',
               'skipped'
           ) then

            raise exception
                'Invalid Work Block transition';

        end if;


        return new;

    end if;


    return new;

end;
$$;


revoke all on function public.enforce_work_block_lifecycle()
from public;


create trigger enforce_work_block_lifecycle_before_write
before insert or update or delete
on public.work_blocks
for each row
execute function public.enforce_work_block_lifecycle();


-- ============================================================
-- 5. DAILY PLAN ITEM WORK BLOCK VALIDATION
-- ============================================================
--
-- daily_plan_id and next_action_id identify what this snapshot
-- represents and therefore remain immutable.
--
-- A draft item may move between Work Blocks, but that Work Block
-- must belong to the same Daily Plan.
-- ============================================================

create or replace function public.validate_daily_plan_item_relationships()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    block_plan_id uuid;
begin

    if tg_op = 'UPDATE' then

        if new.daily_plan_id <> old.daily_plan_id then
            raise exception
                'Daily Plan Item parent Plan is immutable';
        end if;


        if new.next_action_id <> old.next_action_id then
            raise exception
                'Daily Plan Item Next Action is immutable';
        end if;


        if new.action_snapshot
           is distinct from old.action_snapshot then

            raise exception
                'Daily Plan Item action snapshot is immutable';

        end if;


        if new.created_at <> old.created_at
           or new.created_by_principal_id
              is distinct from old.created_by_principal_id then

            raise exception
                'Daily Plan Item creation history is immutable';

        end if;

    end if;


    if new.work_block_id is not null then

        select daily_plan_id
        into block_plan_id
        from public.work_blocks
        where workspace_id = new.workspace_id
          and id = new.work_block_id;


        if not found then
            raise exception
                'Work Block does not exist in this Workspace';
        end if;


        if block_plan_id <> new.daily_plan_id then
            raise exception
                'Daily Plan Item Work Block belongs to a different Daily Plan';
        end if;

    end if;


    return new;

end;
$$;


revoke all on function
    public.validate_daily_plan_item_relationships()
from public;


create trigger validate_daily_plan_item_relationships_before_update
before update
on public.daily_plan_items
for each row
execute function public.validate_daily_plan_item_relationships();


-- ============================================================
-- 6. DAILY PLAN ITEM LIFECYCLE
-- ============================================================
--
-- Draft Plan:
--
--   items may be created
--   reordered
--   moved between Blocks
--   recategorized
--   removed
--
--
-- Active Plan:
--
--   structure freezes
--   only completion_status may change
--
--
-- Completed / Superseded Plan:
--
--   items become immutable history
--
-- ============================================================

create or replace function public.enforce_daily_plan_item_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    plan_status text;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    if tg_op = 'DELETE' then

        plan_status :=
            public.get_daily_plan_status(
                old.workspace_id,
                old.daily_plan_id
            );


        if plan_status <> 'draft' then
            raise exception
                'Daily Plan Items may only be deleted while the Plan is a draft';
        end if;


        return old;

    end if;


    plan_status :=
        public.get_daily_plan_status(
            new.workspace_id,
            new.daily_plan_id
        );


    if plan_status is null then
        raise exception
            'Daily Plan does not exist';
    end if;


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if plan_status <> 'draft' then
            raise exception
                'Daily Plan Items may only be added to draft Plans';
        end if;


        new.completion_status := 'pending';

        return new;

    end if;


    -- --------------------------------------------------------
    -- Historical Plan
    -- --------------------------------------------------------

    if plan_status in (
        'completed',
        'superseded'
    ) then

        raise exception
            'Daily Plan Items on historical Plans are immutable';

    end if;


    -- --------------------------------------------------------
    -- Draft Plan
    -- --------------------------------------------------------

    if plan_status = 'draft' then

        new.completion_status := 'pending';

        return new;

    end if;


    -- --------------------------------------------------------
    -- Active Plan
    --
    -- Only completion_status may change.
    -- --------------------------------------------------------

    if plan_status = 'active' then

        old_business_state :=
            to_jsonb(old)
            - array[
                'completion_status',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'completion_status',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Active Daily Plan Item structure is frozen';

        end if;


        -- Once the day records an outcome for this item, that
        -- historical outcome is terminal.

        if old.completion_status in (
            'completed',
            'carried_forward',
            'removed'
        )
        and new.completion_status
            is distinct from old.completion_status then

            raise exception
                'Finalized Daily Plan Item outcomes are immutable';

        end if;


        if old.completion_status = 'pending'
           and new.completion_status not in (
               'pending',
               'completed',
               'carried_forward',
               'removed'
           ) then

            raise exception
                'Invalid Daily Plan Item completion transition';

        end if;


        return new;

    end if;


    return new;

end;
$$;


revoke all on function
    public.enforce_daily_plan_item_lifecycle()
from public;


create trigger enforce_daily_plan_item_lifecycle_before_write
before insert or update or delete
on public.daily_plan_items
for each row
execute function public.enforce_daily_plan_item_lifecycle();


-- ============================================================
-- 7. ENABLE RLS
-- ============================================================

alter table public.daily_plans
enable row level security;

alter table public.work_blocks
enable row level security;

alter table public.daily_plan_items
enable row level security;


-- ============================================================
-- 8. DAILY PLAN POLICIES
-- ============================================================

create policy "authorized principals can view daily plans"
on public.daily_plans
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.read'
    )
);


create policy "authorized principals can create daily plans"
on public.daily_plans
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.create'
    )
);


create policy "authorized principals can update or complete daily plans"
on public.daily_plans
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
    or
    public.has_permission(
        workspace_id,
        'daily_plan.complete'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
    or
    public.has_permission(
        workspace_id,
        'daily_plan.complete'
    )
);


-- No normal DELETE policy.
--
-- Plan versions are historical.


-- ============================================================
-- 9. WORK BLOCK POLICIES
-- ============================================================

create policy "authorized principals can view work blocks"
on public.work_blocks
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.read'
    )
);


create policy "authorized principals can create work blocks"
on public.work_blocks
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.create'
    )
);


create policy "authorized principals can update work blocks"
on public.work_blocks
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
);


create policy "authorized principals can remove draft work blocks"
on public.work_blocks
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
);


-- Lifecycle trigger restricts deletion to Draft Plans.


-- ============================================================
-- 10. DAILY PLAN ITEM POLICIES
-- ============================================================

create policy "authorized principals can view daily plan items"
on public.daily_plan_items
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.read'
    )
);


create policy "authorized principals can create daily plan items"
on public.daily_plan_items
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.create'
    )
);


create policy "authorized principals can update daily plan items"
on public.daily_plan_items
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
);


create policy "authorized principals can remove draft daily plan items"
on public.daily_plan_items
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'daily_plan.update'
    )
);


-- Lifecycle trigger restricts deletion to Draft Plans.


-- ============================================================
-- 11. DAILY PLAN VERSIONING EXAMPLE
-- ============================================================
--
-- 8:00 AM
--
-- Daily Plan
-- September 24
-- v1
--
-- Today's One Thing:
-- Review Mor Furniture application
--
--
-- 11:00 AM
--
-- Recruiter requests interview.
--
-- The system does NOT rewrite v1.
--
--
-- Instead:
--
-- v1 → superseded
--
-- v2 → active
--
-- Today's One Thing:
-- Respond to recruiter
--
--
-- We can later answer:
--
-- "What did the system originally tell me to do?"
--
-- and:
--
-- "Why did my priorities change?"
--
-- ============================================================


-- ============================================================
-- 12. PLAN / ACTION DISTINCTION
-- ============================================================
--
-- Next Action:
--
-- current human-facing work state
--
--
-- Daily Plan Item:
--
-- historical record of how that Next Action was presented on a
-- particular day and Plan version
--
--
-- Example:
--
-- Next Action today:
-- priority = 72
--
-- Daily Plan v1 snapshot:
-- priority = 88
--
-- Both may be correct because they represent different moments.
--
-- ============================================================


-- ============================================================
-- 13. DAILY QUEUE PRINCIPLE
-- ============================================================
--
-- The candidate should not manage:
--
-- Tasks
-- retries
-- dependencies
-- waiting conditions
-- version numbers
-- priority calculations
--
--
-- The candidate should see:
--
-- Today's One Thing
--
-- Morning Review
-- Application Block
-- Outreach Block
-- Interview Prep
-- Optional Work
--
--
-- Backend complexity should collapse into a simple decision:
--
-- "What needs my attention now?"
--
-- ============================================================


-- ============================================================
-- MIGRATION 013 COMPLETE
-- ============================================================
--
-- Daily Work Queue now has:
--
--   Workspace RLS
--   Versioned Daily Plans
--   Automatic active-plan supersession
--   Historical-plan immutability
--   Today's One Thing validation
--   Frozen active Plan structure
--   Work Block lifecycle
--   Daily Plan Item lifecycle
--   Historical Next Action snapshots
--
--
-- NEXT:
--
-- Application Foundation
--
--   application_templates
--   application_packages
--   application_materials
--   application_material_evidence
--   applications
--   application_submitted_materials
--
-- This is our:
--
-- working RO
--      ↓
-- final RO
--
-- model.
--
-- ============================================================
