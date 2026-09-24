-- ============================================================
-- Job Search AI Agent
-- Migration 007: Candidate Knowledge RLS and Validation
-- ============================================================
--
-- Protects:
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
-- Adds:
--   RLS policies
--   Candidate Knowledge validation controls
--   Protection for confirmed/rejected evidence
--
-- Core principle:
--
-- An agent may help CREATE and IMPROVE Candidate Knowledge.
--
-- That does NOT automatically give the agent authority to
-- CONFIRM claims about the candidate.
-- ============================================================


-- ============================================================
-- 1. VALIDATION GUARD
-- ============================================================
--
-- Applies to Candidate Knowledge tables containing:
--
--   validation_status
--
-- Rules:
--
-- INSERT
-- ------
-- A Principal with candidate_knowledge.create may create:
--
--   candidate_review_needed
--   inferred
--
-- Creating a record directly as:
--
--   confirmed
--   rejected
--
-- requires:
--
--   candidate_knowledge.validate
--
--
-- UPDATE
-- ------
-- Any change to validation_status requires:
--
--   candidate_knowledge.validate
--
--
-- Additionally:
--
-- Once a record is confirmed or rejected, ordinary update
-- permission is not enough to modify it.
--
-- This prevents an agent from changing the contents of a
-- confirmed story while leaving:
--
--   validation_status = confirmed
--
-- ============================================================

create or replace function public.enforce_candidate_knowledge_validation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_validate boolean;
begin

    may_validate :=
        public.has_permission(
            new.workspace_id,
            'candidate_knowledge.validate'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if new.validation_status in (
            'confirmed',
            'rejected'
        )
        and not may_validate then

            raise exception
                'Permission candidate_knowledge.validate is required to create confirmed or rejected Candidate Knowledge';

        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- UPDATE
    -- --------------------------------------------------------

    if tg_op = 'UPDATE' then

        -- Validation state itself is controlled separately from
        -- ordinary editing.

        if old.validation_status
            is distinct from new.validation_status
           and not may_validate then

            raise exception
                'Permission candidate_knowledge.validate is required to change validation status';

        end if;


        -- Once knowledge has been formally confirmed or rejected,
        -- changing that historical validated record also requires
        -- validation authority.

        if old.validation_status in (
            'confirmed',
            'rejected'
        )
        and not may_validate then

            raise exception
                'Confirmed or rejected Candidate Knowledge requires validation permission to modify';

        end if;

        return new;

    end if;


    return new;

end;
$$;


-- ============================================================
-- 2. VALIDATION TRIGGERS
-- ============================================================


-- ------------------------------------------------------------
-- Work Experiences
-- ------------------------------------------------------------

create trigger enforce_work_experience_validation
before insert or update
on public.work_experiences
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Projects
-- ------------------------------------------------------------

create trigger enforce_project_validation
before insert or update
on public.projects
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Evidence Stories
-- ------------------------------------------------------------

create trigger enforce_evidence_story_validation
before insert or update
on public.evidence_stories
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Project ↔ Skill Claims
-- ------------------------------------------------------------
--
-- Linking a Project to a Skill is itself a capability claim.
-- Agents may propose the relationship, but confirming or
-- rejecting it requires candidate_knowledge.validate.
-- ------------------------------------------------------------

create trigger enforce_project_skill_validation
before insert or update
on public.project_skills
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Evidence Story ↔ Skill Claims
-- ------------------------------------------------------------

create trigger enforce_evidence_story_skill_validation
before insert or update
on public.evidence_story_skills
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Project ↔ Tool Claims
-- ------------------------------------------------------------

create trigger enforce_project_tool_validation
before insert or update
on public.project_tools
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Evidence Story ↔ Tool Claims
-- ------------------------------------------------------------

create trigger enforce_evidence_story_tool_validation
before insert or update
on public.evidence_story_tools
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ------------------------------------------------------------
-- Project ↔ Work Experience Claims
-- ------------------------------------------------------------
--
-- Linking a Project to a Work Experience is also part of the
-- candidate's professional record and therefore follows the
-- same validation model.
-- ------------------------------------------------------------

create trigger enforce_project_work_experience_validation
before insert or update
on public.project_work_experiences
for each row
execute function public.enforce_candidate_knowledge_validation();


-- ============================================================
-- 3. PROTECT VALIDATED CAPABILITY LINKS FROM DELETION
-- ============================================================
--
-- Confirmed / rejected Skill and Tool relationships are part of the
-- candidate's validated professional record.
--
-- A Principal with ordinary candidate_knowledge.update may
-- manage draft relationships, but deleting a validated claim
-- requires candidate_knowledge.validate.
-- ============================================================

create or replace function public.protect_validated_candidate_relationship_delete()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if old.validation_status in (
        'confirmed',
        'rejected'
    )
    and not public.has_permission(
        old.workspace_id,
        'candidate_knowledge.validate'
    ) then

        raise exception
            'Permission candidate_knowledge.validate is required to delete validated Candidate Knowledge relationships';

    end if;


    return old;

end;
$$;


create trigger protect_project_skill_validation_before_delete
before delete
on public.project_skills
for each row
execute function public.protect_validated_candidate_relationship_delete();


create trigger protect_evidence_story_skill_validation_before_delete
before delete
on public.evidence_story_skills
for each row
execute function public.protect_validated_candidate_relationship_delete();


create trigger protect_project_tool_validation_before_delete
before delete
on public.project_tools
for each row
execute function public.protect_validated_candidate_relationship_delete();


create trigger protect_evidence_story_tool_validation_before_delete
before delete
on public.evidence_story_tools
for each row
execute function public.protect_validated_candidate_relationship_delete();


create trigger protect_project_work_experience_validation_before_delete
before delete
on public.project_work_experiences
for each row
execute function public.protect_validated_candidate_relationship_delete();


-- ============================================================
-- 4. EVIDENCE STORY CONTEXT CONSISTENCY
-- ============================================================
--
-- When an Evidence Story references both a Project and a Work
-- Experience, those records must already be related through
-- project_work_experiences.
--
-- This prevents a Story from accidentally claiming that a
-- Project occurred inside the wrong employer / engagement.
-- ============================================================

create or replace function public.validate_evidence_story_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if new.project_id is null
       or new.work_experience_id is null then

        return new;

    end if;


    if new.validation_status = 'confirmed' then

        if not exists (
            select 1
            from public.project_work_experiences pwe
            where pwe.workspace_id = new.workspace_id
              and pwe.project_id = new.project_id
              and pwe.work_experience_id = new.work_experience_id
              and pwe.validation_status = 'confirmed'
        ) then

            raise exception
                'Confirmed Evidence Stories require a confirmed Project / Work Experience relationship';

        end if;

    else

        if not exists (
            select 1
            from public.project_work_experiences pwe
            where pwe.workspace_id = new.workspace_id
              and pwe.project_id = new.project_id
              and pwe.work_experience_id = new.work_experience_id
              and pwe.validation_status <> 'rejected'
        ) then

            raise exception
                'Evidence Story Project and Work Experience are not linked in Candidate Knowledge';

        end if;

    end if;


    return new;

end;
$$;


revoke all on function public.validate_evidence_story_context()
from public;


create trigger validate_evidence_story_context_before_write
before insert or update of
    project_id,
    work_experience_id,
    validation_status
on public.evidence_stories
for each row
execute function public.validate_evidence_story_context();


-- ============================================================
-- 5. PROTECT PROJECT / WORK CONTEXT USED BY STORIES
-- ============================================================
--
-- An Evidence Story may explicitly claim that a Project occurred
-- within a particular Work Experience.
--
-- Once a non-rejected Story depends on that pairing, the
-- Project ↔ Work Experience relationship cannot be deleted or
-- rejected without first resolving the dependent Story.
-- ============================================================

create or replace function public.protect_project_work_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    dependency_exists boolean;
    is_being_removed boolean := false;
begin

    if tg_op = 'DELETE' then
        is_being_removed := true;
    else
        is_being_removed :=
            old.validation_status <> 'rejected'
            and new.validation_status = 'rejected';
    end if;


    if not is_being_removed then
        return new;
    end if;


    select exists (
        select 1
        from public.evidence_stories es
        where es.workspace_id = old.workspace_id
          and es.project_id = old.project_id
          and es.work_experience_id = old.work_experience_id
          and es.validation_status <> 'rejected'
    )
    into dependency_exists;


    if dependency_exists then
        raise exception
            'Project / Work Experience relationship is still used by an active Evidence Story';
    end if;


    if tg_op = 'DELETE' then
        return old;
    end if;


    return new;

end;
$$;


revoke all on function public.protect_project_work_context()
from public;


create trigger protect_project_work_context_before_update
before update of validation_status
on public.project_work_experiences
for each row
execute function public.protect_project_work_context();


create trigger protect_project_work_context_before_delete
before delete
on public.project_work_experiences
for each row
execute function public.protect_project_work_context();


-- ============================================================
-- 6. ENABLE RLS
-- ============================================================

alter table public.work_experiences
enable row level security;

alter table public.projects
enable row level security;

alter table public.project_work_experiences
enable row level security;

alter table public.evidence_stories
enable row level security;

alter table public.skills
enable row level security;

alter table public.tools
enable row level security;

alter table public.project_skills
enable row level security;

alter table public.evidence_story_skills
enable row level security;

alter table public.project_tools
enable row level security;

alter table public.evidence_story_tools
enable row level security;


-- ============================================================
-- 6. WORK EXPERIENCE POLICIES
-- ============================================================

create policy "authorized principals can view work experiences"
on public.work_experiences
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create work experiences"
on public.work_experiences
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update work experiences"
on public.work_experiences
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- No normal DELETE policy.
--
-- Professional history should ordinarily be corrected,
-- rejected, or retained rather than silently destroyed.


-- ============================================================
-- 7. PROJECT POLICIES
-- ============================================================

create policy "authorized principals can view projects"
on public.projects
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create projects"
on public.projects
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update projects"
on public.projects
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 8. EVIDENCE STORY POLICIES
-- ============================================================

create policy "authorized principals can view evidence stories"
on public.evidence_stories
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create evidence stories"
on public.evidence_stories
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update evidence stories"
on public.evidence_stories
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 9. SKILL POLICIES
-- ============================================================
--
-- Skills are taxonomy/reference records inside Candidate
-- Knowledge.
--
-- Example:
--
-- Systems Integration
-- Consultative Selling
-- Salesforce Administration
--
-- They do not independently prove that the candidate possesses
-- the skill.
--
-- Evidence Stories provide that proof.
-- ============================================================

create policy "authorized principals can view skills"
on public.skills
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create skills"
on public.skills
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update skills"
on public.skills
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 10. TOOL POLICIES
-- ============================================================

create policy "authorized principals can view tools"
on public.tools
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create tools"
on public.tools
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update tools"
on public.tools
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 10. PROJECT ↔ WORK EXPERIENCE POLICIES
-- ============================================================

create policy "authorized principals can view project work relationships"
on public.project_work_experiences
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create project work relationships"
on public.project_work_experiences
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update project work relationships"
on public.project_work_experiences
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


create policy "authorized principals can remove project work relationships"
on public.project_work_experiences
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 11. PROJECT ↔ SKILL POLICIES
-- ============================================================

create policy "authorized principals can view project skills"
on public.project_skills
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create project skills"
on public.project_skills
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update project skills"
on public.project_skills
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


create policy "authorized principals can remove project skills"
on public.project_skills
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 12. EVIDENCE STORY ↔ SKILL POLICIES
-- ============================================================

create policy "authorized principals can view evidence story skills"
on public.evidence_story_skills
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create evidence story skills"
on public.evidence_story_skills
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update evidence story skills"
on public.evidence_story_skills
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


create policy "authorized principals can remove evidence story skills"
on public.evidence_story_skills
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 13. PROJECT ↔ TOOL POLICIES
-- ============================================================

create policy "authorized principals can view project tools"
on public.project_tools
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create project tools"
on public.project_tools
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update project tools"
on public.project_tools
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


create policy "authorized principals can remove project tools"
on public.project_tools
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 14. EVIDENCE STORY ↔ TOOL POLICIES
-- ============================================================

create policy "authorized principals can view evidence story tools"
on public.evidence_story_tools
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.read'
    )
);


create policy "authorized principals can create evidence story tools"
on public.evidence_story_tools
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.create'
    )
);


create policy "authorized principals can update evidence story tools"
on public.evidence_story_tools
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


create policy "authorized principals can remove evidence story tools"
on public.evidence_story_tools
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_knowledge.update'
    )
);


-- ============================================================
-- 15. VALIDATION AUTHORITY EXAMPLE
-- ============================================================
--
-- Future Candidate Knowledge Agent
--
-- Role permissions:
--
--   candidate_knowledge.read
--   candidate_knowledge.create
--   candidate_knowledge.update
--
-- but NOT:
--
--   candidate_knowledge.validate
--
--
-- The agent may create:
--
-- Evidence Story:
--   "Led requirements discovery before Salesforce migration"
--
-- validation_status:
--   candidate_review_needed
--
--
-- The agent may NOT silently change that to:
--
-- validation_status:
--   confirmed
--
--
-- Diana / Owner has:
--
-- candidate_knowledge.validate
--
-- and may confirm or reject it.
--
-- ============================================================


-- ============================================================
-- 16. CONFIRMED KNOWLEDGE PROTECTION
-- ============================================================
--
-- This also protects against a subtler problem.
--
-- Without the validation trigger, an agent could theoretically:
--
-- 1. Read a confirmed Evidence Story.
--
-- 2. Change:
--
--      actions_taken
--
--    or:
--
--      quantitative_impact
--
-- 3. Leave:
--
--      validation_status = confirmed
--
--
-- The record would LOOK candidate-approved even though the
-- candidate never approved the changed content.
--
-- Migration 007 prevents that.
--
-- Editing confirmed/rejected Candidate Knowledge requires:
--
--   candidate_knowledge.validate
--
-- ============================================================


-- ============================================================
-- 17. SOURCE OF TRUTH RECAP
-- ============================================================
--
-- Candidate Knowledge
--      ↓
-- confirmed evidence
--      ↓
-- Evaluation
--      ↓
-- Application / Outreach / Interview
--
--
-- Downstream systems may SELECT and USE Candidate Knowledge.
--
-- They should not automatically rewrite confirmed candidate
-- history.
--
-- ============================================================


-- ============================================================
-- MIGRATION 007 COMPLETE
-- ============================================================
--
-- Candidate Knowledge now has:
--
--   Workspace isolation
--   RLS
--   Actor attribution
--   Immutable Workspace ownership
--   Workspace-safe relationships
--   Draft creation
--   Candidate validation controls
--   Protection of confirmed evidence
--
-- NEXT:
--
-- Evaluation + Application Gap Foundation
--
--   evaluations
--   evaluation_evidence
--   evaluation_company_intelligence
--   application_gaps
--
-- ============================================================
