-- ============================================================
-- Job Search AI Agent
-- Migration 003: Core Opportunity Foundation
-- ============================================================
--
-- Creates:
--   companies
--   job_families
--   opportunities
--   opportunity_sources
--   company_intelligence
--
-- Also adds the initial permission catalog for this domain.
--
-- RLS policies for these tables are intentionally added in the
-- NEXT migration so table structure and access logic remain
-- easier to review and debug separately.
-- ============================================================


-- ============================================================
-- 1. CORE OPPORTUNITY PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values

    -- Companies
    (
        'company.read',
        'company',
        'read',
        'View Companies in an accessible Workspace'
    ),
    (
        'company.create',
        'company',
        'create',
        'Create Companies'
    ),
    (
        'company.update',
        'company',
        'update',
        'Update Companies'
    ),
    (
        'company.archive',
        'company',
        'archive',
        'Archive Companies'
    ),

    -- Job Families
    (
        'job_family.read',
        'job_family',
        'read',
        'View Job Families'
    ),
    (
        'job_family.create',
        'job_family',
        'create',
        'Create Job Families'
    ),
    (
        'job_family.update',
        'job_family',
        'update',
        'Update Job Families'
    ),

    -- Opportunities
    (
        'opportunity.read',
        'opportunity',
        'read',
        'View Opportunities'
    ),
    (
        'opportunity.create',
        'opportunity',
        'create',
        'Create Opportunities'
    ),
    (
        'opportunity.update',
        'opportunity',
        'update',
        'Update Opportunities'
    ),
    (
        'opportunity.close',
        'opportunity',
        'close',
        'Close Opportunities'
    ),

    -- Opportunity Sources
    (
        'opportunity_source.read',
        'opportunity_source',
        'read',
        'View Opportunity Sources'
    ),
    (
        'opportunity_source.create',
        'opportunity_source',
        'create',
        'Create Opportunity Sources'
    ),
    (
        'opportunity_source.update',
        'opportunity_source',
        'update',
        'Update Opportunity Sources'
    ),

    -- Company Intelligence
    (
        'company_intelligence.read',
        'company_intelligence',
        'read',
        'View Company Intelligence'
    ),
    (
        'company_intelligence.create',
        'company_intelligence',
        'create',
        'Create Company Intelligence'
    ),
    (
        'company_intelligence.update',
        'company_intelligence',
        'update',
        'Update Company Intelligence'
    )

on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT NEW DOMAIN PERMISSIONS TO GLOBAL OWNER
-- ============================================================
--
-- The global Owner role receives the V1 domain permissions.
--
-- Future agent roles will receive narrower permission sets.
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

      'company.read',
      'company.create',
      'company.update',
      'company.archive',

      'job_family.read',
      'job_family.create',
      'job_family.update',

      'opportunity.read',
      'opportunity.create',
      'opportunity.update',
      'opportunity.close',

      'opportunity_source.read',
      'opportunity_source.create',
      'opportunity_source.update',

      'company_intelligence.read',
      'company_intelligence.create',
      'company_intelligence.update'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. COMPANIES
-- ============================================================
--
-- Represents the durable employer entity.
--
-- Example:
--
-- Mor Furniture For Less
--
-- A Company survives across multiple job Opportunities.
-- ============================================================

create table public.companies (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    name text not null,
    normalized_name text null,

    website_url text null,
    careers_url text null,
    linkedin_url text null,

    industry text null,
    company_size text null,
    headquarters_location text null,

    status text not null default 'active'
        check (
            status in (
                'active',
                'inactive',
                'archived'
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

    -- Required so child tables can use workspace-safe
    -- composite foreign keys.
    constraint companies_workspace_id_id_unique
        unique (workspace_id, id)
);


create index companies_workspace_id_idx
on public.companies(workspace_id);


create index companies_normalized_name_idx
on public.companies(
    workspace_id,
    normalized_name
);


create trigger set_companies_updated_at
before update on public.companies
for each row
execute function public.set_updated_at();


-- ============================================================
-- 4. JOB FAMILIES
-- ============================================================
--
-- Reusable role categories across Companies.
--
-- Examples:
--
-- Enterprise Account Executive
-- Strategic Solutions Engineer
-- Director of Operations
-- AI Transformation
-- ============================================================

create table public.job_families (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    name text not null,
    description text null,

    status text not null default 'active'
        check (
            status in (
                'active',
                'inactive'
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

    constraint job_families_workspace_id_id_unique
        unique (workspace_id, id)
);


create unique index job_families_workspace_name_unique
on public.job_families(
    workspace_id,
    lower(name)
);


create trigger set_job_families_updated_at
before update on public.job_families
for each row
execute function public.set_updated_at();


-- ============================================================
-- 5. OPPORTUNITIES
-- ============================================================
--
-- One Opportunity = one specific hiring event.
--
-- It is NOT:
--   one job title forever
--
-- Example:
--
-- Mor Furniture
-- AI Solutions Manager
-- September 2026 posting
--
-- If a materially new version appears six months later,
-- the new hiring event may receive a new Opportunity record.
-- ============================================================

create table public.opportunities (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    company_id uuid not null,

    job_family_id uuid null,

    title text not null,
    normalized_title text null,

    requisition_id text null,

    canonical_url text null,

    location_text text null,

    work_arrangement text null,

    employment_type text null,

    salary_min numeric null,
    salary_max numeric null,
    salary_currency text null,
    salary_period text null,

    job_description_text text null,

    opportunity_stage text not null default 'discovered'
        check (
            opportunity_stage in (
                'discovered',
                'verified',
                'evaluating',
                'pursuing',
                'interviewing',
                'offer',
                'closed'
            )
        ),

    closed_reason text null,

    first_discovered_at timestamptz not null default now(),

    last_verified_at timestamptz null,

    posting_date date null,
    closing_date date null,

    is_currently_active boolean not null default true,

    -- Used when a similar or related hiring event appears later.
    previous_opportunity_id uuid null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint opportunities_workspace_id_id_unique
        unique (workspace_id, id),

    constraint opportunities_salary_range_valid
        check (
            salary_min is null
            or salary_max is null
            or salary_min <= salary_max
        ),

    constraint opportunities_company_workspace_fk
        foreign key (
            workspace_id,
            company_id
        )
        references public.companies(
            workspace_id,
            id
        )
        on delete restrict,

    constraint opportunities_job_family_workspace_fk
        foreign key (
            workspace_id,
            job_family_id
        )
        references public.job_families(
            workspace_id,
            id
        )
        on delete set null
);


-- Self-referencing relationship is added separately because
-- the Opportunities table must exist first.

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
on delete set null;


create index opportunities_workspace_id_idx
on public.opportunities(workspace_id);


create index opportunities_company_id_idx
on public.opportunities(
    workspace_id,
    company_id
);


create index opportunities_job_family_id_idx
on public.opportunities(
    workspace_id,
    job_family_id
);


create index opportunities_stage_idx
on public.opportunities(
    workspace_id,
    opportunity_stage
);


create index opportunities_requisition_id_idx
on public.opportunities(
    workspace_id,
    company_id,
    requisition_id
)
where requisition_id is not null;


create index opportunities_canonical_url_idx
on public.opportunities(
    workspace_id,
    canonical_url
)
where canonical_url is not null;


create trigger set_opportunities_updated_at
before update on public.opportunities
for each row
execute function public.set_updated_at();


-- ============================================================
-- 6. OPPORTUNITY SOURCES
-- ============================================================
--
-- Stores where an Opportunity was discovered or verified.
--
-- Example:
--
-- AI Solutions Manager
--      ├── Indeed alert
--      ├── LinkedIn
--      └── Mor Furniture careers page
--
-- These are THREE Sources for ONE Opportunity.
-- ============================================================

create table public.opportunity_sources (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid not null,

    source_type text not null,

    source_url text null,

    -- External source record reference.
    --
    -- Examples:
    --   Gmail message ID
    --   Indeed alert identifier
    --   LinkedIn posting reference
    --   ATS source record ID
    source_reference text null,

    external_job_id text null,

    source_title text null,
    source_company_name text null,
    source_location text null,
    source_salary_text text null,

    source_job_description_text text null,

    discovered_at timestamptz not null default now(),

    last_checked_at timestamptz null,

    is_active boolean not null default true,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint opportunity_sources_workspace_id_id_unique
        unique (workspace_id, id),

    constraint opportunity_sources_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete cascade
);


create index opportunity_sources_opportunity_idx
on public.opportunity_sources(
    workspace_id,
    opportunity_id
);


create index opportunity_sources_external_job_id_idx
on public.opportunity_sources(
    workspace_id,
    source_type,
    external_job_id
)
where external_job_id is not null;


create index opportunity_sources_source_url_idx
on public.opportunity_sources(
    workspace_id,
    source_url
)
where source_url is not null;


create index opportunity_sources_source_reference_idx
on public.opportunity_sources(
    workspace_id,
    source_type,
    source_reference
)
where source_reference is not null;


-- Prevent the exact same URL from being attached to the same
-- Opportunity repeatedly.

create unique index opportunity_sources_opportunity_url_unique
on public.opportunity_sources(
    workspace_id,
    opportunity_id,
    source_url
)
where source_url is not null;


create trigger set_opportunity_sources_updated_at
before update on public.opportunity_sources
for each row
execute function public.set_updated_at();


-- ============================================================
-- 7. COMPANY INTELLIGENCE
-- ============================================================
--
-- Time-sensitive research about the Company.
--
-- Examples:
--
-- leadership change
-- layoffs
-- hiring expansion
-- funding
-- product launch
-- employee-review theme
-- LinkedIn hiring activity
--
-- Intelligence is separated from Company because it changes
-- over time and may later become stale.
-- ============================================================

create table public.company_intelligence (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    company_id uuid not null,

    intelligence_type text not null,

    title text null,

    summary text not null,

    evidence_type text not null default 'unknown'
        check (
            evidence_type in (
                'confirmed',
                'public_report',
                'employee_opinion',
                'inference',
                'unknown'
            )
        ),

    confidence_level text null
        check (
            confidence_level is null
            or confidence_level in (
                'high',
                'medium',
                'low'
            )
        ),

    source_url text null,
    source_name text null,

    published_at timestamptz null,
    researched_at timestamptz not null default now(),

    expires_at timestamptz null,

    is_active boolean not null default true,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint company_intelligence_workspace_id_id_unique
        unique (workspace_id, id),

    constraint company_intelligence_company_workspace_fk
        foreign key (
            workspace_id,
            company_id
        )
        references public.companies(
            workspace_id,
            id
        )
        on delete cascade
);


create index company_intelligence_company_idx
on public.company_intelligence(
    workspace_id,
    company_id
);


create index company_intelligence_active_idx
on public.company_intelligence(
    workspace_id,
    company_id,
    is_active
);


create index company_intelligence_researched_at_idx
on public.company_intelligence(
    workspace_id,
    researched_at desc
);


create trigger set_company_intelligence_updated_at
before update on public.company_intelligence
for each row
execute function public.set_updated_at();


-- ============================================================
-- 8. WHY THE COMPOSITE FOREIGN KEYS MATTER
-- ============================================================
--
-- Notice relationships such as:
--
-- (workspace_id, company_id)
--
-- instead of only:
--
-- company_id
--
-- This is intentional.
--
-- It prevents a child row from claiming:
--
-- workspace_id = Workspace A
--
-- while secretly referencing:
--
-- company_id = Company from Workspace B
--
-- RLS protects access.
--
-- Composite foreign keys also protect relational integrity.
--
-- This gives us defense in depth.
-- ============================================================


-- ============================================================
-- MIGRATION 003 COMPLETE
-- ============================================================
--
-- We now have:
--
-- Workspace
--    ↓
-- Company
--    ├── Company Intelligence
--    └── Opportunity
--           ├── Job Family
--           └── Opportunity Sources
--
-- NEXT MIGRATION:
--
-- Add RLS policies for:
--
-- companies
-- job_families
-- opportunities
-- opportunity_sources
-- company_intelligence
--
-- ============================================================
