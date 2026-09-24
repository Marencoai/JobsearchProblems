-- ============================================================
-- Job Search AI Agent
-- Migration 009: Evaluation RLS and Lifecycle Protection
-- ============================================================
--
-- Protects:
--   evaluations
--   evaluation_evidence
--   evaluation_company_intelligence
--   application_gaps
--
-- Adds:
--   RLS policies
--   Evaluation lifecycle controls
--   Completed Evaluation immutability
--   Draft-only Evaluation input editing
--   Safer automatic Evaluation version numbering
--
-- Core principle:
--
-- Draft Evaluation
--      ↓
-- may evolve
--
-- Completed Evaluation
--      ↓
-- historical analytical snapshot
--      ↓
-- should not silently change
--
-- ============================================================


-- ============================================================
-- 1. HARDEN AUTOMATIC EVALUATION VERSIONING
-- ============================================================
--
-- Migration 008 allowed the caller to provide version_number.
--
-- That is unnecessary authority.
--
-- From now on the database ALWAYS determines the next version.
--
-- We also use a transaction-level advisory lock based on the
-- Workspace + Opportunity pair.
--
-- Why?
--
-- Without this:
--
-- Agent A asks for next version → 2
-- Agent B asks for next version → 2
--
-- at nearly the same time.
--
-- The unique constraint would catch the collision, but one job
-- would fail unnecessarily.
--
-- The advisory lock makes version assignment deterministic.
-- ============================================================

create or replace function public.prepare_evaluation_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    opportunity_record public.opportunities%rowtype;
    lock_key bigint;
begin

    -- --------------------------------------------------------
    -- Serialize Evaluation version creation for this
    -- Workspace + Opportunity.
    -- --------------------------------------------------------

    lock_key :=
        hashtextextended(
            new.workspace_id::text
            || ':'
            || new.opportunity_id::text,
            0
        );

    perform pg_advisory_xact_lock(lock_key);


    -- --------------------------------------------------------
    -- Load the Opportunity.
    -- --------------------------------------------------------

    select *
    into opportunity_record
    from public.opportunities
    where workspace_id = new.workspace_id
      and id = new.opportunity_id;

    if not found then
        raise exception
            'Opportunity % does not exist in Workspace %',
            new.opportunity_id,
            new.workspace_id;
    end if;


    -- --------------------------------------------------------
    -- Always assign the next Evaluation version.
    -- --------------------------------------------------------

    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.evaluations
    where workspace_id = new.workspace_id
      and opportunity_id = new.opportunity_id;


    -- --------------------------------------------------------
    -- Freeze Opportunity input snapshot.
    -- --------------------------------------------------------

    new.opportunity_snapshot :=
        jsonb_build_object(

            'opportunity_id',
            opportunity_record.id,

            'company_id',
            opportunity_record.company_id,

            'job_family_id',
            opportunity_record.job_family_id,

            'title',
            opportunity_record.title,

            'normalized_title',
            opportunity_record.normalized_title,

            'requisition_id',
            opportunity_record.requisition_id,

            'canonical_url',
            opportunity_record.canonical_url,

            'location_text',
            opportunity_record.location_text,

            'work_arrangement',
            opportunity_record.work_arrangement,

            'employment_type',
            opportunity_record.employment_type,

            'salary_min',
            opportunity_record.salary_min,

            'salary_max',
            opportunity_record.salary_max,

            'salary_currency',
            opportunity_record.salary_currency,

            'salary_period',
            opportunity_record.salary_period,

            'job_description_text',
            opportunity_record.job_description_text,

            'posting_date',
            opportunity_record.posting_date,

            'closing_date',
            opportunity_record.closing_date,

            'last_verified_at',
            opportunity_record.last_verified_at,

            'snapshot_at',
            now()
        );


    return new;

end;
$$;


-- ============================================================
-- 2. EVALUATION LIFECYCLE GUARD
-- ============================================================
--
-- Valid lifecycle:
--
-- draft
--   ↓
-- complete
--   ↓
-- superseded
--
--
-- Draft:
--   editable with evaluation.update
--
-- Completing:
--   requires evaluation.complete
--
-- Complete:
--   content becomes immutable
--
-- Superseded:
--   fully historical
--
-- ============================================================

create or replace function public.enforce_evaluation_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_update boolean;
    may_complete boolean;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    may_update :=
        public.has_permission(
            new.workspace_id,
            'evaluation.update'
        );

    may_complete :=
        public.has_permission(
            new.workspace_id,
            'evaluation.complete'
        );


    -- --------------------------------------------------------
    -- Historical superseded Evaluations are immutable.
    -- --------------------------------------------------------

    if old.evaluation_status = 'superseded' then

        raise exception
            'Superseded Evaluations are immutable';

    end if;


    -- --------------------------------------------------------
    -- Editing a draft without changing lifecycle.
    -- --------------------------------------------------------

    if old.evaluation_status = 'draft'
       and new.evaluation_status = 'draft' then

        if not may_update then
            raise exception
                'Permission evaluation.update is required to edit a draft Evaluation';
        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Finalize a draft.
    -- --------------------------------------------------------

    if old.evaluation_status = 'draft'
       and new.evaluation_status = 'complete' then

        if not may_complete then
            raise exception
                'Permission evaluation.complete is required to complete an Evaluation';
        end if;

        if new.evaluated_at is null then
            new.evaluated_at := now();
        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- A draft cannot jump directly to superseded.
    -- --------------------------------------------------------

    if old.evaluation_status = 'draft'
       and new.evaluation_status = 'superseded' then

        raise exception
            'A draft Evaluation must be completed before it can be superseded';

    end if;


    -- --------------------------------------------------------
    -- Completed Evaluation remains completed.
    --
    -- No silent content edits.
    -- --------------------------------------------------------

    if old.evaluation_status = 'complete'
       and new.evaluation_status = 'complete' then

        raise exception
            'Completed Evaluations are immutable';

    end if;


    -- --------------------------------------------------------
    -- Complete → Superseded
    --
    -- Allowed only with evaluation.complete.
    --
    -- Only lifecycle/audit metadata may change.
    -- Analytical content must remain identical.
    -- --------------------------------------------------------

    if old.evaluation_status = 'complete'
       and new.evaluation_status = 'superseded' then

        if not may_complete then
            raise exception
                'Permission evaluation.complete is required to supersede an Evaluation';
        end if;


        old_business_state :=
            to_jsonb(old)
            - array[
                'evaluation_status',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_business_state :=
            to_jsonb(new)
            - array[
                'evaluation_status',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_business_state
           is distinct from new_business_state then

            raise exception
                'Evaluation content cannot change while marking it superseded';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Everything else is invalid.
    -- --------------------------------------------------------

    raise exception
        'Invalid Evaluation lifecycle transition: % → %',
        old.evaluation_status,
        new.evaluation_status;

end;
$$;


create trigger enforce_evaluation_lifecycle_before_update
before update
on public.evaluations
for each row
execute function public.enforce_evaluation_lifecycle();


-- ============================================================
-- 3. PROTECT COMPLETED EVALUATION INPUTS
-- ============================================================
--
-- Completing the Evaluation row is not enough.
--
-- These child records are part of the Evaluation snapshot:
--
--   evaluation_evidence
--   evaluation_company_intelligence
--
-- If we allowed those records to change afterward, Evaluation
-- history would still be mutable.
--
-- Therefore:
--
-- Evaluation draft
--      ↓
-- inputs may change
--
-- Evaluation complete / superseded
--      ↓
-- inputs frozen
-- ============================================================

create or replace function public.require_draft_evaluation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    old_status text;
    new_status text;
begin

    -- INSERT: the destination Evaluation must be a draft.
    if tg_op = 'INSERT' then

        select evaluation_status
        into new_status
        from public.evaluations
        where workspace_id = new.workspace_id
          and id = new.evaluation_id;

        if not found then
            raise exception
                'Evaluation % does not exist in Workspace %',
                new.evaluation_id,
                new.workspace_id;
        end if;

        if new_status <> 'draft' then
            raise exception
                'Evaluation inputs cannot be added after the Evaluation is completed';
        end if;

        return new;

    end if;


    -- DELETE: the historical parent must still be a draft.
    if tg_op = 'DELETE' then

        select evaluation_status
        into old_status
        from public.evaluations
        where workspace_id = old.workspace_id
          and id = old.evaluation_id;

        if not found then
            raise exception
                'Evaluation % does not exist in Workspace %',
                old.evaluation_id,
                old.workspace_id;
        end if;

        if old_status <> 'draft' then
            raise exception
                'Evaluation inputs cannot be removed after the Evaluation is completed';
        end if;

        return old;

    end if;


    -- UPDATE: protect BOTH sides of a possible parent change.
    --
    -- Without this check, a child row from a completed
    -- Evaluation could be moved to a draft Evaluation, silently
    -- changing the completed Evaluation's historical inputs.

    select evaluation_status
    into old_status
    from public.evaluations
    where workspace_id = old.workspace_id
      and id = old.evaluation_id;

    if not found then
        raise exception
            'Original Evaluation % does not exist in Workspace %',
            old.evaluation_id,
            old.workspace_id;
    end if;


    select evaluation_status
    into new_status
    from public.evaluations
    where workspace_id = new.workspace_id
      and id = new.evaluation_id;

    if not found then
        raise exception
            'Destination Evaluation % does not exist in Workspace %',
            new.evaluation_id,
            new.workspace_id;
    end if;


    if old_status <> 'draft'
       or new_status <> 'draft' then

        raise exception
            'Evaluation inputs may only be changed while both the original and destination Evaluations are drafts';

    end if;


    return new;

end;
$$;


-- ------------------------------------------------------------
-- Candidate Evidence Inputs
-- ------------------------------------------------------------

create trigger require_draft_evaluation_for_evidence
before insert or update or delete
on public.evaluation_evidence
for each row
execute function public.require_draft_evaluation();


-- ------------------------------------------------------------
-- Company Intelligence Inputs
-- ------------------------------------------------------------

create trigger require_draft_evaluation_for_company_intelligence
before insert or update or delete
on public.evaluation_company_intelligence
for each row
execute function public.require_draft_evaluation();


-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

alter table public.evaluations
enable row level security;

alter table public.evaluation_evidence
enable row level security;

alter table public.evaluation_company_intelligence
enable row level security;

alter table public.application_gaps
enable row level security;


-- ============================================================
-- 5. EVALUATION POLICIES
-- ============================================================

create policy "authorized principals can view evaluations"
on public.evaluations
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.read'
    )
);


create policy "authorized principals can create evaluations"
on public.evaluations
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'evaluation.create'
    )
);


-- Both update and complete authority may require an UPDATE
-- statement.
--
-- The lifecycle trigger determines which permission is actually
-- required for the requested transition.

create policy "authorized principals can update evaluations"
on public.evaluations
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
    or
    public.has_permission(
        workspace_id,
        'evaluation.complete'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
    or
    public.has_permission(
        workspace_id,
        'evaluation.complete'
    )
);


-- No DELETE policy.
--
-- Evaluations are historical analytical records.


-- ============================================================
-- 6. EVALUATION EVIDENCE POLICIES
-- ============================================================

create policy "authorized principals can view evaluation evidence"
on public.evaluation_evidence
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.read'
    )
);


create policy "authorized principals can create evaluation evidence"
on public.evaluation_evidence
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'evaluation.create'
    )
    or
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


create policy "authorized principals can update evaluation evidence"
on public.evaluation_evidence
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


create policy "authorized principals can remove evaluation evidence"
on public.evaluation_evidence
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


-- ============================================================
-- 7. EVALUATION COMPANY INTELLIGENCE POLICIES
-- ============================================================

create policy "authorized principals can view evaluation company intelligence"
on public.evaluation_company_intelligence
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.read'
    )
);


create policy "authorized principals can create evaluation company intelligence"
on public.evaluation_company_intelligence
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'evaluation.create'
    )
    or
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


create policy "authorized principals can update evaluation company intelligence"
on public.evaluation_company_intelligence
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


create policy "authorized principals can remove evaluation company intelligence"
on public.evaluation_company_intelligence
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'evaluation.update'
    )
);


-- ============================================================
-- 8. APPLICATION GAP POLICIES
-- ============================================================

create policy "authorized principals can view application gaps"
on public.application_gaps
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application_gap.read'
    )
);


create policy "authorized principals can create application gaps"
on public.application_gaps
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application_gap.create'
    )
);


create policy "authorized principals can update application gaps"
on public.application_gaps
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application_gap.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'application_gap.update'
    )
);


-- No normal DELETE policy.
--
-- Resolved or dismissed Gaps remain useful history.


-- ============================================================
-- 9. EVALUATION COMPLETION MODEL
-- ============================================================
--
-- Example:
--
-- Evaluation Agent
--
-- permissions:
--
--   evaluation.read
--   evaluation.create
--   evaluation.update
--
-- but NOT:
--
--   evaluation.complete
--
--
-- It can:
--
--   create Evaluation v1
--   attach evidence
--   attach Company Intelligence
--   refine reasoning
--
-- It cannot:
--
--   finalize the Evaluation
--
--
-- A Principal with:
--
--   evaluation.complete
--
-- may transition:
--
--   draft → complete
--
--
-- After that:
--
-- Evaluation content is frozen.
-- Evidence snapshot links are frozen.
-- Company Intelligence snapshot links are frozen.
--
-- ============================================================


-- ============================================================
-- 10. WHY APPLICATION GAPS REMAIN MUTABLE
-- ============================================================
--
-- Evaluation:
--   historical snapshot
--
-- Application Gap:
--   active workflow knowledge
--
--
-- Example:
--
-- Evaluation identifies:
--
-- "Missing direct Jira evidence"
--
-- Later candidate remembers:
--
-- Reliant Jira usage.
--
-- The Evaluation remains what it was at that moment.
--
-- But the Application Gap may become:
--
-- resolution_status = resolved
--
-- and a new Evaluation version may be created.
--
-- ============================================================


-- ============================================================
-- 11. IMMUTABILITY MODEL
-- ============================================================
--
-- Living:
--
-- Opportunity
-- Candidate Knowledge
-- Company Intelligence
-- Application Gaps
--
--
-- Historical snapshot:
--
-- Completed Evaluation
--
--
-- New information does NOT rewrite an old Evaluation.
--
-- New information may create:
--
-- Evaluation v2
--
-- ============================================================


-- ============================================================
-- MIGRATION 009 COMPLETE
-- ============================================================
--
-- Evaluations now have:
--
--   Workspace RLS
--   Version safety
--   Historical input snapshots
--   Lifecycle protection
--   Completed-record immutability
--   Frozen Evaluation inputs
--   Permission-separated completion authority
--
--
-- NEXT:
--
-- Workflow Foundation
--
--   activity_events
--   activity_event_links
--   activity_replies
--   internal_tasks
--   task_dependencies
--   task_attempts
--   next_actions
--
-- This creates the machine workflow beneath the candidate-facing
-- Activity Feed and Daily Work Queue.
--
-- ============================================================
