-- ============================================================
-- Job Search AI Agent
-- Migration 004: Core Opportunity RLS
-- ============================================================
--
-- Adds:
--   RLS policies for:
--     companies
--     job_families
--     opportunities
--     opportunity_sources
--     company_intelligence
--
-- Also adds:
--   Automatic Principal attribution
--   Company archive permission enforcement
--   Opportunity close permission enforcement
--
-- Design principle:
--
-- RLS answers:
--   "May this Principal access this row?"
--
-- Guard triggers answer:
--   "May this Principal perform this special state change?"
--
-- Composite foreign keys from Migration 003 continue to protect
-- against cross-Workspace relationships.
-- ============================================================


-- ============================================================
-- 1. AUTOMATIC ACTOR ATTRIBUTION
-- ============================================================
--
-- Normal authenticated writes should automatically record the
-- Principal actually making the change.
--
-- This prevents a client from simply claiming:
--
-- created_by_principal_id = some_other_principal
--
-- The database derives the actor from auth.uid().
--
-- Trusted system operations where no authenticated Principal
-- exists may leave these fields null or populate them through a
-- separately controlled backend workflow.
-- ============================================================

create or replace function public.set_actor_audit_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    actor_id uuid;
begin

    actor_id := public.current_principal_id();

    if tg_op = 'INSERT' then

        if actor_id is not null then
            new.created_by_principal_id := actor_id;

            if to_jsonb(new) ? 'updated_by_principal_id' then
                new.updated_by_principal_id := actor_id;
            end if;
        end if;

    elsif tg_op = 'UPDATE' then

        if actor_id is not null
           and to_jsonb(new) ? 'updated_by_principal_id' then

            new.updated_by_principal_id := actor_id;

        end if;

    end if;

    return new;

end;
$$;


-- ------------------------------------------------------------
-- Companies
-- ------------------------------------------------------------

create trigger set_companies_actor_audit
before insert or update
on public.companies
for each row
execute function public.set_actor_audit_fields();


-- ------------------------------------------------------------
-- Job Families
-- ------------------------------------------------------------

create trigger set_job_families_actor_audit
before insert or update
on public.job_families
for each row
execute function public.set_actor_audit_fields();


-- ------------------------------------------------------------
-- Opportunities
-- ------------------------------------------------------------

create trigger set_opportunities_actor_audit
before insert or update
on public.opportunities
for each row
execute function public.set_actor_audit_fields();


-- ------------------------------------------------------------
-- Opportunity Sources
-- ------------------------------------------------------------

create trigger set_opportunity_sources_actor_audit
before insert or update
on public.opportunity_sources
for each row
execute function public.set_actor_audit_fields();


-- ------------------------------------------------------------
-- Company Intelligence
-- ------------------------------------------------------------

create trigger set_company_intelligence_actor_audit
before insert or update
on public.company_intelligence
for each row
execute function public.set_actor_audit_fields();


-- ============================================================
-- 2. COMPANY ARCHIVE GUARD
-- ============================================================
--
-- company.update allows ordinary edits.
--
-- Moving a Company INTO archived status is a distinct action
-- requiring:
--
-- company.archive
--
-- This makes the permission catalog meaningful rather than
-- allowing company.update to silently do everything.
-- ============================================================

create or replace function public.enforce_company_archive_permission()
returns trigger
language plpgsql
set search_path = public
as $
begin

    -- Entering OR leaving archived state is a privileged
    -- lifecycle action. Ordinary company.update authority is
    -- not sufficient to rewrite archival history.

    if old.status is distinct from new.status
       and (
           old.status = 'archived'
           or new.status = 'archived'
       )
       and not public.has_permission(
           new.workspace_id,
           'company.archive'
       ) then

        raise exception
            'Permission company.archive is required to change Company archive state';

    end if;

    return new;

end;
$;


create trigger enforce_company_archive
before update of status
on public.companies
for each row
execute function public.enforce_company_archive_permission();


-- ============================================================
-- 3. OPPORTUNITY CLOSE GUARD
-- ============================================================
--
-- opportunity.update allows normal Opportunity edits.
--
-- Moving an Opportunity INTO the closed stage requires the
-- distinct:
--
-- opportunity.close
--
-- permission.
-- ============================================================

create or replace function public.enforce_opportunity_close_permission()
returns trigger
language plpgsql
set search_path = public
as $
begin

    -- Entering OR leaving closed state, or changing the reason
    -- attached to a closed Opportunity, is separately governed.

    if (
           old.opportunity_stage is distinct from new.opportunity_stage
           and (
               old.opportunity_stage = 'closed'
               or new.opportunity_stage = 'closed'
           )
       )
       or (
           new.opportunity_stage = 'closed'
           and old.closed_reason is distinct from new.closed_reason
       ) then

        if not public.has_permission(
            new.workspace_id,
            'opportunity.close'
        ) then

            raise exception
                'Permission opportunity.close is required to change Opportunity close state';

        end if;

    end if;


    -- Closed Opportunities must explain why they closed and
    -- cannot simultaneously present themselves as active.

    if new.opportunity_stage = 'closed' then

        if nullif(btrim(new.closed_reason), '') is null then
            raise exception
                'Closed Opportunities require a closed_reason';
        end if;

        new.is_currently_active := false;

    else

        -- Reopening is allowed only through the privileged
        -- transition above. The stale close reason is cleared.

        if old.opportunity_stage = 'closed' then
            new.closed_reason := null;

        elsif new.closed_reason is not null then
            raise exception
                'closed_reason may only be set when opportunity_stage is closed';
        end if;

    end if;


    return new;

end;
$;


create trigger enforce_opportunity_close
before update of opportunity_stage, closed_reason, is_currently_active
on public.opportunities
for each row
execute function public.enforce_opportunity_close_permission();


-- ============================================================
-- 4. ENABLE RLS
-- ============================================================

alter table public.companies
enable row level security;

alter table public.job_families
enable row level security;

alter table public.opportunities
enable row level security;

alter table public.opportunity_sources
enable row level security;

alter table public.company_intelligence
enable row level security;


-- ============================================================
-- 5. COMPANY POLICIES
-- ============================================================

create policy "authorized principals can view companies"
on public.companies
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'company.read'
    )
);


create policy "authorized principals can create companies"
on public.companies
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'company.create'
    )
);


create policy "authorized principals can update companies"
on public.companies
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'company.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'company.update'
    )
);


-- No normal DELETE policy.
--
-- Companies should usually be archived rather than physically
-- deleted because historical Opportunities may depend on them.


-- ============================================================
-- 6. JOB FAMILY POLICIES
-- ============================================================

create policy "authorized principals can view job families"
on public.job_families
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'job_family.read'
    )
);


create policy "authorized principals can create job families"
on public.job_families
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'job_family.create'
    )
);


create policy "authorized principals can update job families"
on public.job_families
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'job_family.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'job_family.update'
    )
);


-- No normal DELETE policy.
--
-- Job Families are reusable classification records and should
-- normally become inactive rather than disappear.


-- ============================================================
-- 7. OPPORTUNITY POLICIES
-- ============================================================

create policy "authorized principals can view opportunities"
on public.opportunities
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'opportunity.read'
    )
);


create policy "authorized principals can create opportunities"
on public.opportunities
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'opportunity.create'
    )
);


create policy "authorized principals can update opportunities"
on public.opportunities
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'opportunity.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'opportunity.update'
    )
);


-- No normal DELETE policy.
--
-- An Opportunity is historical hiring-event data.
--
-- Closed Opportunities should remain available so the system can
-- later understand:
--
--   previous applications
--   previous evaluations
--   prior Company history
--   reposted roles
--   recurring hiring patterns


-- ============================================================
-- 8. OPPORTUNITY SOURCE POLICIES
-- ============================================================

create policy "authorized principals can view opportunity sources"
on public.opportunity_sources
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'opportunity_source.read'
    )
);


create policy "authorized principals can create opportunity sources"
on public.opportunity_sources
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'opportunity_source.create'
    )
);


create policy "authorized principals can update opportunity sources"
on public.opportunity_sources
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'opportunity_source.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'opportunity_source.update'
    )
);


-- No normal DELETE policy.
--
-- Sources provide provenance and may remain useful even if the
-- external posting later disappears.


-- ============================================================
-- 9. COMPANY INTELLIGENCE POLICIES
-- ============================================================

create policy "authorized principals can view company intelligence"
on public.company_intelligence
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'company_intelligence.read'
    )
);


create policy "authorized principals can create company intelligence"
on public.company_intelligence
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'company_intelligence.create'
    )
);


create policy "authorized principals can update company intelligence"
on public.company_intelligence
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'company_intelligence.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'company_intelligence.update'
    )
);


-- No normal DELETE policy.
--
-- Company Intelligence may become inactive or stale while
-- remaining historically useful.


-- ============================================================
-- 10. SECURITY MODEL RECAP
-- ============================================================
--
-- Example:
--
-- Diana
--   ↓
-- Principal
--   ↓
-- Workspace Membership
--   ↓
-- Owner Role
--   ↓
-- opportunity.create
--
-- Therefore:
--
-- Diana may INSERT an Opportunity owned by that Workspace.
--
--
-- Future Evaluation Agent:
--
-- Principal
--   ↓
-- Workspace Membership
--   ↓
-- Evaluation Agent Role
--
-- If that Role has:
--
-- opportunity.read
--
-- but NOT:
--
-- opportunity.update
--
-- then Postgres itself prevents that agent from editing the
-- Opportunity.
--
-- ============================================================


-- ============================================================
-- 11. DEFENSE IN DEPTH
-- ============================================================
--
-- We now have multiple layers:
--
-- Layer 1:
-- Authentication
--
-- Who is making this request?
--
-- Layer 2:
-- Principal
--
-- Which governed actor does that Auth identity represent?
--
-- Layer 3:
-- Workspace Membership
--
-- Does that Principal belong to this Workspace?
--
-- Layer 4:
-- Permission
--
-- Is that Principal allowed to perform this action?
--
-- Layer 5:
-- RLS
--
-- May this Principal access this row?
--
-- Layer 6:
-- Composite Foreign Keys
--
-- Are related records actually inside the same Workspace?
--
-- Layer 7:
-- Guard Triggers
--
-- Is this special state transition separately authorized?
--
-- Layer 8:
-- Actor Audit
--
-- Who actually made the change?
--
-- ============================================================


-- ============================================================
-- MIGRATION 004 COMPLETE
-- ============================================================
--
-- Core Opportunity tables are now protected by the same
-- Workspace / Principal / Role / Permission architecture
-- established in Migrations 001 and 002.
--
-- NEXT:
--
-- Candidate Knowledge Foundation
--
--   work_experiences
--   projects
--   project_work_experiences
--   evidence_stories
--   skills
--   tools
--
-- plus their relationship tables.
--
-- ============================================================
