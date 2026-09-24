-- ============================================================
-- Job Search AI Agent
-- Migration 006: Candidate Knowledge Foundation
-- ============================================================
--
-- Creates:
--   work_experiences
--   projects
--   project_work_experiences
--   evidence_stories
--   skills
--   tools
--   project_skills
--   evidence_story_skills
--   project_tools
--   evidence_story_tools
--
-- Candidate Knowledge is the source of truth for what the
-- candidate has actually done.
--
-- Resumes, Evaluations, Applications, Outreach, and Interviews
-- will consume Candidate Knowledge.
--
-- They do NOT become independent sources of candidate truth.
-- ============================================================


-- ============================================================
-- 1. CANDIDATE KNOWLEDGE PERMISSIONS
-- ============================================================
--
-- Validation is intentionally separate from ordinary updating.
--
-- This allows a future agent to:
--
--   create draft knowledge
--   improve draft knowledge
--
-- without automatically gaining authority to:
--
--   confirm candidate claims
--   reject candidate claims
--
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'candidate_knowledge.read',
        'candidate_knowledge',
        'read',
        'View Candidate Knowledge'
    ),
    (
        'candidate_knowledge.create',
        'candidate_knowledge',
        'create',
        'Create Candidate Knowledge records'
    ),
    (
        'candidate_knowledge.update',
        'candidate_knowledge',
        'update',
        'Update Candidate Knowledge records'
    ),
    (
        'candidate_knowledge.validate',
        'candidate_knowledge',
        'validate',
        'Confirm or reject material Candidate Knowledge'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT CANDIDATE KNOWLEDGE PERMISSIONS TO OWNER
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
      'candidate_knowledge.read',
      'candidate_knowledge.create',
      'candidate_knowledge.update',
      'candidate_knowledge.validate'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. WORK EXPERIENCES
-- ============================================================
--
-- Represents a role, contract, client engagement, or meaningful
-- period of professional work.
--
-- Examples:
--
-- Ferrari & Maserati of San Diego
-- Reliant Funding
-- Backd
-- Levo Funding
-- Alpine
-- MarencoAI
--
-- ============================================================

create table public.work_experiences (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    company_id uuid null,

    company_name text not null,
    role_title text not null,

    employment_type text null,

    start_date date null,
    end_date date null,

    is_current boolean not null default false,

    summary text null,
    scope text null,
    team_context text null,
    responsibilities text null,
    systems_owned text null,
    major_outcomes text null,
    promotion_history text null,

    source_type text null,
    source_reference text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
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

    constraint work_experiences_workspace_id_id_unique
        unique (workspace_id, id),

    constraint work_experiences_dates_valid
        check (
            start_date is null
            or end_date is null
            or start_date <= end_date
        ),

    constraint work_experiences_company_workspace_fk
        foreign key (
            workspace_id,
            company_id
        )
        references public.companies(
            workspace_id,
            id
        )
        on delete restrict
);


create index work_experiences_workspace_idx
on public.work_experiences(workspace_id);


create index work_experiences_company_idx
on public.work_experiences(
    workspace_id,
    company_id
)
where company_id is not null;


create index work_experiences_validation_idx
on public.work_experiences(
    workspace_id,
    validation_status
);


create trigger set_work_experiences_updated_at
before update on public.work_experiences
for each row
execute function public.set_updated_at();


create trigger set_work_experiences_actor_audit
before insert or update
on public.work_experiences
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_work_experiences_workspace_change
before update of workspace_id
on public.work_experiences
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. PROJECTS
-- ============================================================
--
-- Represents a substantial body of work.
--
-- Important:
--
-- A Project does NOT contain a single work_experience_id.
--
-- Why?
--
-- Some Projects may span:
--
--   multiple roles
--   multiple engagements
--   consulting + personal work
--   overlapping professional contexts
--
-- Relationships to Work Experiences are therefore handled by
-- project_work_experiences.
--
-- ============================================================

create table public.projects (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    name text not null,

    summary text null,
    problem_statement text null,
    candidate_role text null,
    stakeholders text null,
    responsibilities text null,
    architecture_summary text null,
    scale_complexity text null,
    outcomes text null,
    quantitative_results text null,

    status text not null default 'active'
        check (
            status in (
                'active',
                'completed',
                'archived'
            )
        ),

    start_date date null,
    end_date date null,

    source_type text null,
    source_reference text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
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

    constraint projects_workspace_id_id_unique
        unique (workspace_id, id),

    constraint projects_dates_valid
        check (
            start_date is null
            or end_date is null
            or start_date <= end_date
        )
);


create index projects_workspace_idx
on public.projects(workspace_id);


create index projects_validation_idx
on public.projects(
    workspace_id,
    validation_status
);


create trigger set_projects_updated_at
before update on public.projects
for each row
execute function public.set_updated_at();


create trigger set_projects_actor_audit
before insert or update
on public.projects
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_projects_workspace_change
before update of workspace_id
on public.projects
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 5. PROJECT ↔ WORK EXPERIENCE
-- ============================================================
--
-- Many-to-many relationship.
--
-- Example:
--
-- Housing Compass
--       ↓
-- Alpine engagement
--
-- Future Project:
--
-- could theoretically span more than one Work Experience.
--
-- ============================================================

create table public.project_work_experiences (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    project_id uuid not null,
    work_experience_id uuid not null,

    relationship_type text null,

    is_primary boolean not null default false,

    contribution_context text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint project_work_experiences_workspace_id_id_unique
        unique (workspace_id, id),

    constraint project_work_experiences_unique
        unique (
            workspace_id,
            project_id,
            work_experience_id
        ),

    constraint project_work_experiences_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete cascade,

    constraint project_work_experiences_work_workspace_fk
        foreign key (
            workspace_id,
            work_experience_id
        )
        references public.work_experiences(
            workspace_id,
            id
        )
        on delete cascade
);


-- Only one Work Experience may be marked as the primary context
-- for a particular Project.

create unique index project_work_experiences_one_primary
on public.project_work_experiences(
    workspace_id,
    project_id
)
where is_primary = true;


create index project_work_experiences_work_idx
on public.project_work_experiences(
    workspace_id,
    work_experience_id
);


create trigger set_project_work_experiences_actor
before insert
on public.project_work_experiences
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_project_work_experiences_workspace_change
before update of workspace_id
on public.project_work_experiences
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. EVIDENCE STORIES
-- ============================================================
--
-- This is the strongest proof unit in Candidate Knowledge.
--
-- Example:
--
-- Problem:
-- Lead distribution was inefficient.
--
-- Action:
-- Candidate analyzed Salesforce data and redesigned routing.
--
-- Outcome:
-- Revenue increased from $4M to $9.5M/month without increasing
-- lead volume.
--
-- Professional Translation:
-- Revenue Operations / Lead Routing / Salesforce Analytics
--
-- ============================================================

create table public.evidence_stories (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    work_experience_id uuid null,
    project_id uuid null,

    title text not null,

    situation text null,
    candidate_role text null,
    actions_taken text null,
    stakeholders text null,

    outcome text null,
    quantitative_impact text null,

    professional_translation text null,

    evidence_type text not null default 'unknown'
        check (
            evidence_type in (
                'direct',
                'adjacent',
                'demonstrated_understanding',
                'inference',
                'unknown'
            )
        ),

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
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

    source_type text null,
    source_reference text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint evidence_stories_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evidence_stories_work_experience_workspace_fk
        foreign key (
            workspace_id,
            work_experience_id
        )
        references public.work_experiences(
            workspace_id,
            id
        )
        on delete restrict,

    constraint evidence_stories_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete restrict
);


create index evidence_stories_workspace_idx
on public.evidence_stories(workspace_id);


create index evidence_stories_work_experience_idx
on public.evidence_stories(
    workspace_id,
    work_experience_id
)
where work_experience_id is not null;


create index evidence_stories_project_idx
on public.evidence_stories(
    workspace_id,
    project_id
)
where project_id is not null;


create index evidence_stories_validation_idx
on public.evidence_stories(
    workspace_id,
    validation_status
);


create trigger set_evidence_stories_updated_at
before update on public.evidence_stories
for each row
execute function public.set_updated_at();


create trigger set_evidence_stories_actor_audit
before insert or update
on public.evidence_stories
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_evidence_stories_workspace_change
before update of workspace_id
on public.evidence_stories
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 7. EVIDENCE STORY CONTEXT CONSISTENCY
-- ============================================================
--
-- If an Evidence Story names BOTH a Project and a Work
-- Experience, that Project must actually be linked to that Work
-- Experience through project_work_experiences.
--
-- This prevents evidence from accidentally combining unrelated
-- professional contexts.
-- ============================================================

create or replace function public.validate_evidence_story_context()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if new.project_id is null
       or new.work_experience_id is null then

        return new;

    end if;


    if not exists (
        select 1
        from public.project_work_experiences pwe
        where pwe.workspace_id = new.workspace_id
          and pwe.project_id = new.project_id
          and pwe.work_experience_id = new.work_experience_id
    ) then

        raise exception
            'Evidence Story Project is not linked to the selected Work Experience';

    end if;


    return new;

end;
$$;


create trigger validate_evidence_story_context_before_write
before insert or update of project_id, work_experience_id
on public.evidence_stories
for each row
execute function public.validate_evidence_story_context();

-- ============================================================
-- 8. SKILLS
-- ============================================================

create table public.skills (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    name text not null,
    normalized_name text null,

    category text null,
    description text null,

    status text not null default 'active'
        check (
            status in (
                'active',
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

    constraint skills_workspace_id_id_unique
        unique (workspace_id, id)
);


-- Avoid duplicates such as:
--
-- Salesforce Administration
-- salesforce administration
--
-- inside the same Workspace.

create unique index skills_workspace_normalized_unique
on public.skills (
    workspace_id,
    lower(coalesce(normalized_name, name))
);


create trigger set_skills_updated_at
before update on public.skills
for each row
execute function public.set_updated_at();


create trigger set_skills_actor_audit
before insert or update
on public.skills
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_skills_workspace_change
before update of workspace_id
on public.skills
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 9. TOOLS
-- ============================================================

create table public.tools (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    name text not null,
    normalized_name text null,

    category text null,
    description text null,

    status text not null default 'active'
        check (
            status in (
                'active',
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

    constraint tools_workspace_id_id_unique
        unique (workspace_id, id)
);


create unique index tools_workspace_normalized_unique
on public.tools (
    workspace_id,
    lower(coalesce(normalized_name, name))
);


create trigger set_tools_updated_at
before update on public.tools
for each row
execute function public.set_updated_at();


create trigger set_tools_actor_audit
before insert or update
on public.tools
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_tools_workspace_change
before update of workspace_id
on public.tools
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 10. PROJECT ↔ SKILL
-- ============================================================

create table public.project_skills (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    project_id uuid not null,
    skill_id uuid not null,

    evidence_strength text null
        check (
            evidence_strength is null
            or evidence_strength in (
                'direct',
                'strong',
                'moderate',
                'inferred'
            )
        ),

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint project_skills_workspace_id_id_unique
        unique (workspace_id, id),

    constraint project_skills_unique
        unique (
            workspace_id,
            project_id,
            skill_id
        ),

    constraint project_skills_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete cascade,

    constraint project_skills_skill_workspace_fk
        foreign key (
            workspace_id,
            skill_id
        )
        references public.skills(
            workspace_id,
            id
        )
        on delete cascade
);


create index project_skills_skill_idx
on public.project_skills(
    workspace_id,
    skill_id
);


create trigger set_project_skills_actor
before insert
on public.project_skills
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_project_skills_workspace_change
before update of workspace_id
on public.project_skills
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 11. EVIDENCE STORY ↔ SKILL
-- ============================================================

create table public.evidence_story_skills (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    evidence_story_id uuid not null,
    skill_id uuid not null,

    evidence_strength text not null
        check (
            evidence_strength in (
                'direct',
                'adjacent',
                'demonstrated_understanding',
                'inferred'
            )
        ),

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint evidence_story_skills_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evidence_story_skills_unique
        unique (
            workspace_id,
            evidence_story_id,
            skill_id
        ),

    constraint evidence_story_skills_story_workspace_fk
        foreign key (
            workspace_id,
            evidence_story_id
        )
        references public.evidence_stories(
            workspace_id,
            id
        )
        on delete cascade,

    constraint evidence_story_skills_skill_workspace_fk
        foreign key (
            workspace_id,
            skill_id
        )
        references public.skills(
            workspace_id,
            id
        )
        on delete cascade
);


create index evidence_story_skills_skill_idx
on public.evidence_story_skills(
    workspace_id,
    skill_id
);


create trigger set_evidence_story_skills_actor
before insert
on public.evidence_story_skills
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_evidence_story_skills_workspace_change
before update of workspace_id
on public.evidence_story_skills
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 12. PROJECT ↔ TOOL
-- ============================================================

create table public.project_tools (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    project_id uuid not null,
    tool_id uuid not null,

    usage_context text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint project_tools_workspace_id_id_unique
        unique (workspace_id, id),

    constraint project_tools_unique
        unique (
            workspace_id,
            project_id,
            tool_id
        ),

    constraint project_tools_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete cascade,

    constraint project_tools_tool_workspace_fk
        foreign key (
            workspace_id,
            tool_id
        )
        references public.tools(
            workspace_id,
            id
        )
        on delete cascade
);


create index project_tools_tool_idx
on public.project_tools(
    workspace_id,
    tool_id
);


create trigger set_project_tools_actor
before insert
on public.project_tools
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_project_tools_workspace_change
before update of workspace_id
on public.project_tools
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 13. EVIDENCE STORY ↔ TOOL
-- ============================================================

create table public.evidence_story_tools (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    evidence_story_id uuid not null,
    tool_id uuid not null,

    usage_context text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint evidence_story_tools_workspace_id_id_unique
        unique (workspace_id, id),

    constraint evidence_story_tools_unique
        unique (
            workspace_id,
            evidence_story_id,
            tool_id
        ),

    constraint evidence_story_tools_story_workspace_fk
        foreign key (
            workspace_id,
            evidence_story_id
        )
        references public.evidence_stories(
            workspace_id,
            id
        )
        on delete cascade,

    constraint evidence_story_tools_tool_workspace_fk
        foreign key (
            workspace_id,
            tool_id
        )
        references public.tools(
            workspace_id,
            id
        )
        on delete cascade
);


create index evidence_story_tools_tool_idx
on public.evidence_story_tools(
    workspace_id,
    tool_id
);


create trigger set_evidence_story_tools_actor
before insert
on public.evidence_story_tools
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_evidence_story_tools_workspace_change
before update of workspace_id
on public.evidence_story_tools
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 14. CANDIDATE KNOWLEDGE RELATIONSHIP MAP
-- ============================================================
--
-- Conceptually:
--
-- Work Experience
--       ↕
--     Project
--       ↓
-- Evidence Story
--    ↙       ↘
-- Skill      Tool
--
--
-- More precisely:
--
-- Work Experience
--       ↕ many-to-many
-- Project
--
-- Work Experience
--       ↓
-- Evidence Story
--
-- Project
--       ↓
-- Evidence Story
--
-- Project ↔ Skill
-- Story   ↔ Skill
--
-- Project ↔ Tool
-- Story   ↔ Tool
--
-- ============================================================


-- ============================================================
-- 15. WHY PROJECT_WORK_EXPERIENCES EXISTS
-- ============================================================
--
-- We intentionally did NOT put:
--
-- projects.work_experience_id
--
-- into the Project table.
--
-- That would imply every Project belongs to exactly one Work
-- Experience.
--
-- Instead:
--
-- project_work_experiences
--
-- lets the model represent reality if a Project spans multiple
-- professional contexts.
--
-- For simple Projects, one relationship may simply be marked:
--
-- is_primary = true
--
-- ============================================================


-- ============================================================
-- 16. SOURCE OF TRUTH RULE
-- ============================================================
--
-- Candidate Knowledge is living professional knowledge.
--
-- Example:
--
-- Evidence Story
--   "Reliant lead routing redesign"
--
-- supports:
--
--   Salesforce Administration
--   Revenue Operations
--   Workflow Design
--   Analytics
--
-- That Evidence Story may later feed:
--
--   Evaluation
--   Resume
--   Application
--   Outreach
--   Interview
--
-- The downstream output does NOT replace the Evidence Story as
-- the source of candidate truth.
--
-- ============================================================


-- ============================================================
-- MIGRATION 006 COMPLETE
-- ============================================================
--
-- Candidate Knowledge structure now exists.
--
-- NEXT MIGRATION:
--
-- Candidate Knowledge RLS + validation controls.
--
-- That migration will enforce:
--
--   candidate_knowledge.read
--   candidate_knowledge.create
--   candidate_knowledge.update
--   candidate_knowledge.validate
--
-- This allows future agents to help BUILD Candidate Knowledge
-- without automatically gaining authority to CONFIRM it.
--
-- ============================================================
