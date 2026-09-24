-- ============================================================
-- Job Search AI Agent
-- Migration 008: Evaluation and Application Gap Foundation
-- ============================================================
--
-- Creates:
--   evaluations
--   evaluation_evidence
--   evaluation_company_intelligence
--   application_gaps
--
-- Also adds:
--   Evaluation permission catalog
--   Automatic Evaluation version numbering
--   Historical input snapshots
--   Cross-domain integrity checks
--
-- Core principle:
--
-- Opportunity = what the job is
--
-- Candidate Knowledge = what the candidate has done
--
-- Company Intelligence = what we know about the employer
--
-- Evaluation = what the system believed about the fit at a
-- specific point in time
--
-- ============================================================


-- ============================================================
-- 1. EVALUATION PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'evaluation.read',
        'evaluation',
        'read',
        'View Opportunity Evaluations'
    ),
    (
        'evaluation.create',
        'evaluation',
        'create',
        'Create Opportunity Evaluations'
    ),
    (
        'evaluation.update',
        'evaluation',
        'update',
        'Update draft Opportunity Evaluations'
    ),
    (
        'evaluation.complete',
        'evaluation',
        'complete',
        'Finalize an Opportunity Evaluation'
    ),

    (
        'application_gap.read',
        'application_gap',
        'read',
        'View Opportunity-specific Application Gaps'
    ),
    (
        'application_gap.create',
        'application_gap',
        'create',
        'Create Application Gaps'
    ),
    (
        'application_gap.update',
        'application_gap',
        'update',
        'Update or resolve Application Gaps'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT EVALUATION PERMISSIONS TO OWNER
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
      'evaluation.read',
      'evaluation.create',
      'evaluation.update',
      'evaluation.complete',
      'application_gap.read',
      'application_gap.create',
      'application_gap.update'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. EVALUATIONS
-- ============================================================
--
-- One Opportunity may have many Evaluation versions.
--
-- Example:
--
-- Mor Furniture
-- AI Solutions Manager
--
-- Evaluation v1
-- Candidate Fit = 72
--
-- New Candidate Knowledge discovered
--
-- Evaluation v2
-- Candidate Fit = 84
--
-- v1 remains preserved.
-- ============================================================

create table public.evaluations (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid not null,

    version_number integer not null,

    candidate_fit_score numeric null
        check (
            candidate_fit_score is null
            or (
                candidate_fit_score >= 0
                and candidate_fit_score <= 100
            )
        ),

    opportunity_fit_score numeric null
        check (
            opportunity_fit_score is null
            or (
                opportunity_fit_score >= 0
                and opportunity_fit_score <= 100
            )
        ),

    pursuit_score numeric null
        check (
            pursuit_score is null
            or (
                pursuit_score >= 0
                and pursuit_score <= 100
            )
        ),

    opportunity_type text null
        check (
            opportunity_type is null
            or opportunity_type in (
                'mutual_fit',
                'strong_practical_fit',
                'high_value_stretch',
                'bridge_opportunity',
                'low_priority'
            )
        ),

    evidence_confidence text null
        check (
            evidence_confidence is null
            or evidence_confidence in (
                'high',
                'medium',
                'low'
            )
        ),

    problem_translation text null,
    problem_fit_summary text null,

    strengths_summary text null,
    tradeoffs_summary text null,

    company_fit_summary text null,
    career_optionality_summary text null,

    required_decision_authority text null,

    recommended_next_action text null,
    unresolved_questions text null,

    evaluation_status text not null default 'draft'
        check (
            evaluation_status in (
                'draft',
                'complete',
                'superseded'
            )
        ),

    -- --------------------------------------------------------
    -- HISTORICAL SNAPSHOT
    -- --------------------------------------------------------
    --
    -- Preserves what the Opportunity looked like when this
    -- Evaluation was created.
    --
    -- If salary, JD text, URL, location, etc. later change,
    -- Evaluation v1 still retains its original input context.
    -- --------------------------------------------------------

    opportunity_snapshot jsonb not null,

    evaluation_method_version text null,

    evaluated_at timestamptz null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint evaluations_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evaluations_opportunity_version_unique
        unique (
            workspace_id,
            opportunity_id,
            version_number
        ),

    constraint evaluations_version_positive
        check (version_number > 0),

    constraint evaluations_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict
);


create index evaluations_opportunity_idx
on public.evaluations(
    workspace_id,
    opportunity_id
);


create index evaluations_status_idx
on public.evaluations(
    workspace_id,
    evaluation_status
);


create index evaluations_created_at_idx
on public.evaluations(
    workspace_id,
    created_at desc
);


create trigger set_evaluations_updated_at
before update on public.evaluations
for each row
execute function public.set_updated_at();


create trigger set_evaluations_actor_audit
before insert or update
on public.evaluations
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_evaluations_workspace_change
before update of workspace_id
on public.evaluations
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. AUTOMATIC EVALUATION VERSION + OPPORTUNITY SNAPSHOT
-- ============================================================
--
-- The caller does not need to decide:
--
--   "Is this Evaluation v2 or v3?"
--
-- The database determines the next version.
--
-- The same trigger also freezes the relevant Opportunity facts
-- used when the Evaluation begins.
-- ============================================================

create or replace function public.prepare_evaluation_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    opportunity_record public.opportunities%rowtype;
begin

    -- --------------------------------------------
    -- Load the Opportunity.
    -- --------------------------------------------

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


    -- --------------------------------------------
    -- Assign next Evaluation version.
    -- --------------------------------------------

    if new.version_number is null
       or new.version_number <= 0 then

        select coalesce(max(version_number), 0) + 1
        into new.version_number
        from public.evaluations
        where workspace_id = new.workspace_id
          and opportunity_id = new.opportunity_id;

    end if;


    -- --------------------------------------------
    -- Freeze Opportunity input snapshot.
    -- --------------------------------------------

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


create trigger prepare_evaluation_before_insert
before insert
on public.evaluations
for each row
execute function public.prepare_evaluation_insert();


-- ============================================================
-- 5. EVALUATION ↔ CANDIDATE EVIDENCE
-- ============================================================
--
-- Records which Candidate Knowledge materially supported an
-- Evaluation.
--
-- The link stores BOTH:
--
--   reference to living Candidate Knowledge
--
-- and:
--
--   snapshot of what that evidence said at Evaluation time
--
-- ============================================================

create table public.evaluation_evidence (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    evaluation_id uuid not null,

    evidence_story_id uuid null,
    project_id uuid null,
    skill_id uuid null,

    evidence_role text not null
        check (
            evidence_role in (
                'strength',
                'gap_support',
                'context',
                'comparison'
            )
        ),

    relevance_summary text null,

    confidence_level text null
        check (
            confidence_level is null
            or confidence_level in (
                'high',
                'medium',
                'low'
            )
        ),

    evidence_snapshot jsonb not null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint evaluation_evidence_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evaluation_evidence_one_source
        check (
            num_nonnulls(
                evidence_story_id,
                project_id,
                skill_id
            ) = 1
        ),

    constraint evaluation_evidence_evaluation_workspace_fk
        foreign key (
            workspace_id,
            evaluation_id
        )
        references public.evaluations(
            workspace_id,
            id
        )
        on delete cascade,

    constraint evaluation_evidence_story_workspace_fk
        foreign key (
            workspace_id,
            evidence_story_id
        )
        references public.evidence_stories(
            workspace_id,
            id
        )
        on delete restrict,

    constraint evaluation_evidence_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete restrict,

    constraint evaluation_evidence_skill_workspace_fk
        foreign key (
            workspace_id,
            skill_id
        )
        references public.skills(
            workspace_id,
            id
        )
        on delete restrict
);


create index evaluation_evidence_evaluation_idx
on public.evaluation_evidence(
    workspace_id,
    evaluation_id
);


create trigger set_evaluation_evidence_actor
before insert
on public.evaluation_evidence
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_evaluation_evidence_workspace_change
before update of workspace_id
on public.evaluation_evidence
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. AUTOMATIC EVIDENCE SNAPSHOT
-- ============================================================

create or replace function public.prepare_evaluation_evidence_snapshot()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    story_record public.evidence_stories%rowtype;
    project_record public.projects%rowtype;
    skill_record public.skills%rowtype;
    skill_support_snapshot jsonb := '[]'::jsonb;
begin

    new.evidence_snapshot := '{}'::jsonb;


    -- --------------------------------------------------------
    -- Evidence Story
    -- --------------------------------------------------------

    if new.evidence_story_id is not null then

        select *
        into story_record
        from public.evidence_stories
        where workspace_id = new.workspace_id
          and id = new.evidence_story_id;

        if not found then
            raise exception
                'Evidence Story % does not exist in Workspace %',
                new.evidence_story_id,
                new.workspace_id;
        end if;

        if story_record.validation_status = 'rejected' then
            raise exception
                'Rejected Evidence Stories cannot be used in an Evaluation';
        end if;

        new.evidence_snapshot :=
            new.evidence_snapshot
            ||
            jsonb_build_object(
                'evidence_story',
                jsonb_build_object(
                    'id', story_record.id,
                    'title', story_record.title,
                    'situation', story_record.situation,
                    'candidate_role', story_record.candidate_role,
                    'actions_taken', story_record.actions_taken,
                    'outcome', story_record.outcome,
                    'quantitative_impact',
                        story_record.quantitative_impact,
                    'professional_translation',
                        story_record.professional_translation,
                    'evidence_type',
                        story_record.evidence_type,
                    'validation_status',
                        story_record.validation_status,
                    'source_type',
                        story_record.source_type,
                    'source_reference',
                        story_record.source_reference
                )
            );

    end if;


    -- --------------------------------------------------------
    -- Project
    -- --------------------------------------------------------

    if new.project_id is not null then

        select *
        into project_record
        from public.projects
        where workspace_id = new.workspace_id
          and id = new.project_id;

        if not found then
            raise exception
                'Project % does not exist in Workspace %',
                new.project_id,
                new.workspace_id;
        end if;

        if project_record.validation_status = 'rejected' then
            raise exception
                'Rejected Projects cannot be used in an Evaluation';
        end if;

        new.evidence_snapshot :=
            new.evidence_snapshot
            ||
            jsonb_build_object(
                'project',
                jsonb_build_object(
                    'id', project_record.id,
                    'name', project_record.name,
                    'summary', project_record.summary,
                    'problem_statement',
                        project_record.problem_statement,
                    'candidate_role',
                        project_record.candidate_role,
                    'outcomes',
                        project_record.outcomes,
                    'quantitative_results',
                        project_record.quantitative_results,
                    'validation_status',
                        project_record.validation_status,
                    'source_type',
                        project_record.source_type,
                    'source_reference',
                        project_record.source_reference
                )
            );

    end if;


    -- --------------------------------------------------------
    -- Skill
    -- --------------------------------------------------------

    if new.skill_id is not null then

        select *
        into skill_record
        from public.skills
        where workspace_id = new.workspace_id
          and id = new.skill_id;

        if not found then
            raise exception
                'Skill % does not exist in Workspace %',
                new.skill_id,
                new.workspace_id;
        end if;


        -- A Skill row is taxonomy, not proof that the candidate
        -- possesses the Skill. Direct Skill evidence therefore
        -- requires at least one confirmed supporting Candidate
        -- Knowledge relationship.

        select
            coalesce(
                jsonb_agg(support_item),
                '[]'::jsonb
            )
        into skill_support_snapshot
        from (
            select
                jsonb_build_object(
                    'type',
                    'evidence_story',
                    'id',
                    es.id,
                    'title',
                    es.title,
                    'evidence_strength',
                    ess.evidence_strength
                ) as support_item
            from public.evidence_story_skills ess
            join public.evidence_stories es
              on es.workspace_id = ess.workspace_id
             and es.id = ess.evidence_story_id
            where ess.workspace_id = new.workspace_id
              and ess.skill_id = new.skill_id
              and ess.validation_status = 'confirmed'
              and es.validation_status = 'confirmed'

            union all

            select
                jsonb_build_object(
                    'type',
                    'project',
                    'id',
                    p.id,
                    'name',
                    p.name,
                    'evidence_strength',
                    ps.evidence_strength
                ) as support_item
            from public.project_skills ps
            join public.projects p
              on p.workspace_id = ps.workspace_id
             and p.id = ps.project_id
            where ps.workspace_id = new.workspace_id
              and ps.skill_id = new.skill_id
              and ps.validation_status = 'confirmed'
              and p.validation_status = 'confirmed'
        ) confirmed_support;


        if jsonb_array_length(skill_support_snapshot) = 0 then
            raise exception
                'Skill must have confirmed Candidate Knowledge support before it may be used as direct Evaluation evidence';
        end if;


        new.evidence_snapshot :=
            new.evidence_snapshot
            ||
            jsonb_build_object(
                'skill',
                jsonb_build_object(
                    'id', skill_record.id,
                    'name', skill_record.name,
                    'category', skill_record.category,
                    'description', skill_record.description,
                    'supporting_evidence', skill_support_snapshot
                )
            );

    end if;


    new.evidence_snapshot :=
        new.evidence_snapshot
        ||
        jsonb_build_object(
            'snapshot_at',
            now()
        );


    return new;

end;
$$;


create trigger prepare_evaluation_evidence_before_write
before insert or update
on public.evaluation_evidence
for each row
execute function public.prepare_evaluation_evidence_snapshot();


-- ============================================================
-- 7. EVALUATION ↔ COMPANY INTELLIGENCE
-- ============================================================

create table public.evaluation_company_intelligence (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    evaluation_id uuid not null,

    company_intelligence_id uuid not null,

    relevance_summary text null,

    intelligence_snapshot jsonb not null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint evaluation_company_intelligence_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evaluation_company_intelligence_unique
        unique (
            workspace_id,
            evaluation_id,
            company_intelligence_id
        ),

    constraint eval_company_intel_evaluation_workspace_fk
        foreign key (
            workspace_id,
            evaluation_id
        )
        references public.evaluations(
            workspace_id,
            id
        )
        on delete cascade,

    constraint eval_company_intel_intelligence_workspace_fk
        foreign key (
            workspace_id,
            company_intelligence_id
        )
        references public.company_intelligence(
            workspace_id,
            id
        )
        on delete restrict
);


create index evaluation_company_intelligence_eval_idx
on public.evaluation_company_intelligence(
    workspace_id,
    evaluation_id
);


create trigger set_evaluation_company_intelligence_actor
before insert
on public.evaluation_company_intelligence
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_eval_company_intelligence_workspace_change
before update of workspace_id
on public.evaluation_company_intelligence
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 8. COMPANY INTELLIGENCE CONSISTENCY + SNAPSHOT
-- ============================================================
--
-- Prevents:
--
-- Evaluation for Company A
--
-- accidentally using:
--
-- Company Intelligence belonging to Company B
--
-- inside the same Workspace.
-- ============================================================

create or replace function public.prepare_evaluation_company_intelligence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    evaluation_company_id uuid;
    intelligence_record public.company_intelligence%rowtype;
begin

    select o.company_id
    into evaluation_company_id
    from public.evaluations e
    join public.opportunities o
      on o.workspace_id = e.workspace_id
     and o.id = e.opportunity_id
    where e.workspace_id = new.workspace_id
      and e.id = new.evaluation_id;


    if evaluation_company_id is null then
        raise exception
            'Evaluation % could not resolve a Company',
            new.evaluation_id;
    end if;


    select *
    into intelligence_record
    from public.company_intelligence
    where workspace_id = new.workspace_id
      and id = new.company_intelligence_id;


    if not found then
        raise exception
            'Company Intelligence % does not exist in Workspace %',
            new.company_intelligence_id,
            new.workspace_id;
    end if;


    if intelligence_record.company_id
       <> evaluation_company_id then

        raise exception
            'Company Intelligence belongs to a different Company than the Evaluation';

    end if;


    new.intelligence_snapshot :=
        jsonb_build_object(

            'id',
            intelligence_record.id,

            'company_id',
            intelligence_record.company_id,

            'intelligence_type',
            intelligence_record.intelligence_type,

            'title',
            intelligence_record.title,

            'summary',
            intelligence_record.summary,

            'evidence_type',
            intelligence_record.evidence_type,

            'confidence_level',
            intelligence_record.confidence_level,

            'source_url',
            intelligence_record.source_url,

            'source_name',
            intelligence_record.source_name,

            'published_at',
            intelligence_record.published_at,

            'researched_at',
            intelligence_record.researched_at,

            'snapshot_at',
            now()
        );


    return new;

end;
$$;


create trigger prepare_eval_company_intelligence_before_write
before insert or update
on public.evaluation_company_intelligence
for each row
execute function public.prepare_evaluation_company_intelligence();


-- ============================================================
-- 9. APPLICATION GAPS
-- ============================================================
--
-- Opportunity-specific gap.
--
-- This is NOT yet a Career Development Gap.
--
-- Examples:
--
-- missing evidence
-- unfamiliar terminology
-- adjacent experience
-- positioning issue
-- clarification needed
-- one-off employer preference
--
-- ============================================================

create table public.application_gaps (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid not null,

    evaluation_id uuid null,

    skill_id uuid null,

    gap_type text not null
        check (
            gap_type in (
                'missing_evidence',
                'missing_terminology',
                'adjacent_experience',
                'positioning_issue',
                'clarification_needed',
                'employer_preference',
                'capability_gap'
            )
        ),

    description text not null,

    severity text null
        check (
            severity is null
            or severity in (
                'low',
                'medium',
                'high'
            )
        ),

    blocking_status text null
        check (
            blocking_status is null
            or blocking_status in (
                'blocking',
                'non_blocking',
                'unknown'
            )
        ),

    resolution_type text null
        check (
            resolution_type is null
            or resolution_type in (
                'evidence_discovery',
                'clarification',
                'positioning',
                'learning',
                'other'
            )
        ),

    resolution_status text not null default 'open'
        check (
            resolution_status in (
                'open',
                'investigating',
                'resolved',
                'dismissed'
            )
        ),

    resolution_notes text null,

    resolved_at timestamptz null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint application_gaps_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_gaps_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_gaps_evaluation_workspace_fk
        foreign key (
            workspace_id,
            evaluation_id
        )
        references public.evaluations(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_gaps_skill_workspace_fk
        foreign key (
            workspace_id,
            skill_id
        )
        references public.skills(
            workspace_id,
            id
        )
        on delete restrict
);


create index application_gaps_opportunity_idx
on public.application_gaps(
    workspace_id,
    opportunity_id
);


create index application_gaps_evaluation_idx
on public.application_gaps(
    workspace_id,
    evaluation_id
)
where evaluation_id is not null;


create index application_gaps_resolution_idx
on public.application_gaps(
    workspace_id,
    resolution_status
);


create trigger set_application_gaps_updated_at
before update on public.application_gaps
for each row
execute function public.set_updated_at();


create trigger set_application_gaps_actor_audit
before insert or update
on public.application_gaps
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_gaps_workspace_change
before update of workspace_id
on public.application_gaps
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 10. APPLICATION GAP / EVALUATION CONSISTENCY
-- ============================================================
--
-- Prevents:
--
-- Opportunity A
--
-- from receiving a Gap linked to:
--
-- Evaluation for Opportunity B
--
-- even when both belong to the same Workspace.
-- ============================================================

create or replace function public.validate_application_gap_evaluation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    evaluation_opportunity_id uuid;
begin

    if new.evaluation_id is null then
        return new;
    end if;


    select opportunity_id
    into evaluation_opportunity_id
    from public.evaluations
    where workspace_id = new.workspace_id
      and id = new.evaluation_id;


    if not found then
        raise exception
            'Evaluation % does not exist in Workspace %',
            new.evaluation_id,
            new.workspace_id;
    end if;


    if evaluation_opportunity_id
       <> new.opportunity_id then

        raise exception
            'Application Gap Opportunity does not match Evaluation Opportunity';

    end if;


    return new;

end;
$$;


create trigger validate_application_gap_evaluation_before_write
before insert or update of
    workspace_id,
    opportunity_id,
    evaluation_id
on public.application_gaps
for each row
execute function public.validate_application_gap_evaluation();


-- ============================================================
-- 11. EVALUATION RELATIONSHIP MAP
-- ============================================================
--
--                Opportunity
--                    ↓
--                Evaluation
--                /       \
--               /         \
-- Candidate Evidence     Company Intelligence
--        ↓                       ↓
-- evaluation_evidence    evaluation_company_intelligence
--
--
-- Evaluation
--      ↓
-- Application Gaps
--
--
-- New evidence may later produce:
--
-- Evaluation v2
--
-- without destroying:
--
-- Evaluation v1
--
-- ============================================================


-- ============================================================
-- 12. SNAPSHOT DESIGN PRINCIPLE
-- ============================================================
--
-- Living records:
--
-- Opportunity
-- Candidate Knowledge
-- Company Intelligence
--
-- may evolve.
--
--
-- Evaluation:
--
-- is a historical analytical snapshot.
--
--
-- Therefore Evaluation retains:
--
--   Opportunity snapshot
--   Candidate Evidence snapshots
--   Company Intelligence snapshots
--
--
-- This means the system can later answer:
--
-- "Why did we score this role 72 six months ago?"
--
-- even if the candidate and company data have since changed.
--
-- ============================================================


-- ============================================================
-- MIGRATION 008 COMPLETE
-- ============================================================
--
-- Evaluation structure now exists.
--
-- NEXT MIGRATION:
--
-- Evaluation RLS + Evaluation lifecycle protection
--
-- That migration will enforce:
--
--   evaluation.read
--   evaluation.create
--   evaluation.update
--   evaluation.complete
--
--   application_gap.read
--   application_gap.create
--   application_gap.update
--
-- It will also protect completed Evaluations from being
-- silently rewritten.
--
-- ============================================================
