-- ============================================================
-- Job Search AI Agent
-- Migration 005: Core Integrity Hardening
-- ============================================================
--
-- Fixes / strengthens:
--
--   1. Workspace ownership becomes immutable for tenant-owned
--      records.
--
--   2. Composite foreign-key delete behavior is corrected for
--      optional relationships.
--
--   3. An Opportunity cannot reference itself as its previous
--      Opportunity.
--
-- Why this exists:
--
-- RLS protects who may access a row.
--
-- Foreign keys and integrity triggers protect whether the data
-- itself can become structurally inconsistent.
--
-- ============================================================


-- ============================================================
-- 1. PREVENT WORKSPACE OWNERSHIP FROM CHANGING
-- ============================================================
--
-- Once a tenant-owned record belongs to a Workspace, moving it
-- into another Workspace should not be a normal UPDATE.
--
-- If data ever truly needs to migrate between Workspaces, that
-- should occur through an intentional administrative migration,
-- not through ordinary application behavior.
-- ============================================================

create or replace function public.prevent_workspace_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if old.workspace_id is distinct from new.workspace_id then
        raise exception
            'workspace_id is immutable for % records',
            tg_table_name;
    end if;

    return new;

end;
$$;


-- ------------------------------------------------------------
-- Identity / permission tables that belong to a Workspace
-- ------------------------------------------------------------

create trigger prevent_roles_workspace_change
before update of workspace_id
on public.roles
for each row
execute function public.prevent_workspace_change();


create trigger prevent_workspace_memberships_workspace_change
before update of workspace_id
on public.workspace_memberships
for each row
execute function public.prevent_workspace_change();


-- ------------------------------------------------------------
-- Core Opportunity domain
-- ------------------------------------------------------------

create trigger prevent_companies_workspace_change
before update of workspace_id
on public.companies
for each row
execute function public.prevent_workspace_change();


create trigger prevent_job_families_workspace_change
before update of workspace_id
on public.job_families
for each row
execute function public.prevent_workspace_change();


create trigger prevent_opportunities_workspace_change
before update of workspace_id
on public.opportunities
for each row
execute function public.prevent_workspace_change();


create trigger prevent_opportunity_sources_workspace_change
before update of workspace_id
on public.opportunity_sources
for each row
execute function public.prevent_workspace_change();


create trigger prevent_company_intelligence_workspace_change
before update of workspace_id
on public.company_intelligence
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 2. CORRECT JOB FAMILY DELETE BEHAVIOR
-- ============================================================
--
-- Migration 003 originally used:
--
--   ON DELETE SET NULL
--
-- on the composite relationship:
--
--   (workspace_id, job_family_id)
--
-- We do NOT want deletion behavior to ever attempt to modify
-- workspace ownership.
--
-- Job Families are historical classification records and are
-- normally marked inactive rather than deleted.
--
-- Therefore deletion is restricted while referenced.
-- ============================================================

alter table public.opportunities
drop constraint if exists opportunities_job_family_workspace_fk;


alter table public.opportunities
add constraint opportunities_job_family_workspace_fk
foreign key (
    workspace_id,
    job_family_id
)
references public.job_families(
    workspace_id,
    id
)
on delete restrict;


-- ============================================================
-- 3. CORRECT PREVIOUS OPPORTUNITY DELETE BEHAVIOR
-- ============================================================
--
-- Historical Opportunities should generally never be physically
-- deleted.
--
-- A newer Opportunity may reference an older Opportunity:
--
-- Opportunity #2
--      ↓
-- previous_opportunity_id
--      ↓
-- Opportunity #1
--
-- If Opportunity #1 is referenced historically, deletion should
-- be blocked rather than modifying Workspace ownership or
-- silently breaking history.
-- ============================================================

alter table public.opportunities
drop constraint if exists
    opportunities_previous_opportunity_workspace_fk;


alter table public.opportunities
add constraint opportunities_previous_opportunity_workspace_fk
foreign key (
    workspace_id,
    previous_opportunity_id
)
references public.opportunities(
    workspace_id,
    id
)
on delete restrict;


-- ============================================================
-- 4. PREVENT SELF-REFERENCING OPPORTUNITIES
-- ============================================================
--
-- Invalid:
--
-- Opportunity A
--      ↓
-- previous_opportunity_id
--      ↓
-- Opportunity A
--
-- ============================================================

alter table public.opportunities
add constraint opportunities_previous_not_self
check (
    previous_opportunity_id is null
    or previous_opportunity_id <> id
);


-- ============================================================
-- 5. DESIGN RULE FOR FUTURE TABLES
-- ============================================================
--
-- From this migration forward:
--
-- Every normal Workspace-owned business table should:
--
--   1. contain workspace_id
--
--   2. prevent ordinary workspace_id changes
--
--   3. use Workspace-safe foreign keys when referencing another
--      Workspace-owned record
--
-- Example:
--
--   (workspace_id, opportunity_id)
--          ↓
--   opportunities(workspace_id, id)
--
-- instead of only:
--
--   opportunity_id → opportunities(id)
--
-- This protects against cross-tenant relationships even if
-- application logic contains a bug.
--
-- ============================================================


-- ============================================================
-- MIGRATION 005 COMPLETE
-- ============================================================
--
-- We now have:
--
-- Authentication
--      ↓
-- Principal
--      ↓
-- Workspace Membership
--      ↓
-- Permission
--      ↓
-- RLS
--      ↓
-- Immutable Workspace Ownership
--      ↓
-- Workspace-Safe Foreign Keys
--
-- NEXT MIGRATION:
--
-- Candidate Knowledge Foundation
--
--   work_experiences
--   projects
--   project_work_experiences
--   evidence_stories
--   skills
--   tools
--   relationship tables
--
-- ============================================================
