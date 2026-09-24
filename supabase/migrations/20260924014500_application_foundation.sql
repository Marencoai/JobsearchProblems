-- ============================================================
-- Job Search AI Agent
-- Migration 014: Application Foundation
-- ============================================================
--
-- Creates:
--   application_templates
--   application_packages
--   application_materials
--   application_material_evidence
--   applications
--   application_submitted_materials
--
-- Core model:
--
-- Candidate Knowledge
--        +
-- Application Template
--        +
-- Opportunity
--        ↓
-- Application Package
--        ↓
-- Working Material Versions
--        ↓
-- Candidate Approval
--        ↓
-- Application
--        ↓
-- Submitted Material Snapshot
--
-- ============================================================


-- ============================================================
-- 1. APPLICATION PERMISSIONS
-- ============================================================
--
-- Preparation, approval, submission, and confirmation are
-- intentionally separate capabilities.
--
-- Future example:
--
-- Application Agent
--
-- application.prepare = allowed
-- application.approve = denied
-- application.submit = denied
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
        'application.read',
        'application',
        'read',
        'View Application records and materials'
    ),
    (
        'application_template.manage',
        'application',
        'manage_template',
        'Create and maintain reusable Application Templates'
    ),
    (
        'application.prepare',
        'application',
        'prepare',
        'Prepare Application Packages and Materials'
    ),
    (
        'application.approve',
        'application',
        'approve',
        'Approve Application Packages and Materials'
    ),
    (
        'application.submit',
        'application',
        'submit',
        'Record or perform an Application submission'
    ),
    (
        'application.confirm',
        'application',
        'confirm',
        'Confirm that an Application submission was received'
    )
on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT APPLICATION PERMISSIONS TO OWNER
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
      'application.read',
      'application_template.manage',
      'application.prepare',
      'application.approve',
      'application.submit',
      'application.confirm'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. APPLICATION TEMPLATES
-- ============================================================
--
-- A Template is reusable across Opportunities.
--
-- Example:
--
-- template_key:
--   enterprise_account_executive
--
-- version 1
-- version 2
-- version 3
--
-- Each version is a separate historical row.
--
-- ============================================================

create table public.application_templates (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    job_family_id uuid null,

    -- Stable identifier grouping versions of the same Template.
    template_key text not null,

    version_number integer not null,

    name text not null,

    description text null,

    resume_strategy text null,
    cover_letter_strategy text null,
    outreach_positioning text null,
    interview_themes text null,

    status text not null default 'draft'
        check (
            status in (
                'draft',
                'active',
                'retired'
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

    constraint application_templates_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_templates_key_version_unique
        unique (
            workspace_id,
            template_key,
            version_number
        ),

    constraint application_templates_version_positive
        check (version_number > 0),

    constraint application_templates_job_family_workspace_fk
        foreign key (
            workspace_id,
            job_family_id
        )
        references public.job_families(
            workspace_id,
            id
        )
        on delete restrict
);


create index application_templates_job_family_idx
on public.application_templates(
    workspace_id,
    job_family_id
)
where job_family_id is not null;


-- Only one version of a Template family should normally be
-- active at one time.

create unique index application_templates_one_active_version
on public.application_templates(
    workspace_id,
    template_key
)
where status = 'active';


create trigger set_application_templates_updated_at
before update on public.application_templates
for each row
execute function public.set_updated_at();


create trigger set_application_templates_actor_audit
before insert or update
on public.application_templates
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_templates_workspace_change
before update of workspace_id
on public.application_templates
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. AUTOMATIC TEMPLATE VERSION NUMBERING
-- ============================================================

create or replace function public.prepare_application_template_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    lock_key bigint;
begin

    new.template_key :=
        lower(
            trim(new.template_key)
        );


    if nullif(new.template_key, '') is null then
        raise exception
            'Application Template key is required';
    end if;


    lock_key :=
        hashtextextended(
            new.workspace_id::text
            || ':application_template:'
            || new.template_key,
            0
        );


    perform pg_advisory_xact_lock(lock_key);


    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.application_templates
    where workspace_id = new.workspace_id
      and template_key = new.template_key;


    -- New Template versions begin as drafts.

    new.status := 'draft';


    return new;

end;
$$;


create trigger prepare_application_template_before_insert
before insert
on public.application_templates
for each row
execute function public.prepare_application_template_insert();


-- ============================================================
-- 5. APPLICATION PACKAGES
-- ============================================================
--
-- The working RO.
--
-- A Package contains the material versions being prepared for a
-- specific Opportunity.
--
-- A Package is preparation.
--
-- It is NOT proof that an Application was submitted.
--
-- ============================================================

create table public.application_packages (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid not null,

    package_number integer not null,

    application_template_id uuid null,

    evaluation_id uuid null,

    status text not null default 'draft'
        check (
            status in (
                'draft',
                'preparing',
                'ready_for_review',
                'approved',
                'archived'
            )
        ),

    candidate_notes text null,

    prepared_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    approved_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    approved_at timestamptz null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint application_packages_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_packages_number_unique
        unique (
            workspace_id,
            opportunity_id,
            package_number
        ),

    constraint application_packages_number_positive
        check (package_number > 0),

    constraint application_packages_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_packages_template_workspace_fk
        foreign key (
            workspace_id,
            application_template_id
        )
        references public.application_templates(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_packages_evaluation_workspace_fk
        foreign key (
            workspace_id,
            evaluation_id
        )
        references public.evaluations(
            workspace_id,
            id
        )
        on delete restrict
);


create index application_packages_opportunity_idx
on public.application_packages(
    workspace_id,
    opportunity_id
);


create index application_packages_status_idx
on public.application_packages(
    workspace_id,
    status
);


create trigger set_application_packages_updated_at
before update on public.application_packages
for each row
execute function public.set_updated_at();


create trigger set_application_packages_actor_audit
before insert or update
on public.application_packages
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_packages_workspace_change
before update of workspace_id
on public.application_packages
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. AUTOMATIC APPLICATION PACKAGE NUMBERING
-- ============================================================

create or replace function public.prepare_application_package_insert()
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
            || ':application_package:'
            || new.opportunity_id::text,
            0
        );


    perform pg_advisory_xact_lock(lock_key);


    select coalesce(max(package_number), 0) + 1
    into new.package_number
    from public.application_packages
    where workspace_id = new.workspace_id
      and opportunity_id = new.opportunity_id;


    new.status := 'draft';

    new.approved_by_principal_id := null;
    new.approved_at := null;


    return new;

end;
$$;


create trigger prepare_application_package_before_insert
before insert
on public.application_packages
for each row
execute function public.prepare_application_package_insert();


-- ============================================================
-- 7. APPLICATION MATERIALS
-- ============================================================
--
-- One specific version of one prepared artifact.
--
-- Example:
--
-- Resume
--   v1
--   v2
--   v3 ← approved
--
-- Cover Letter
--   v1
--   v2 ← approved
--
-- ============================================================

create table public.application_materials (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    application_package_id uuid not null,

    material_type text not null,

    version_number integer not null,

    content_text text null,

    file_url text null,

    storage_path text null,

    source_template_id uuid null,

    status text not null default 'draft'
        check (
            status in (
                'draft',
                'candidate_review',
                'approved',
                'rejected',
                'submitted',
                'archived'
            )
        ),

    is_current_package_version boolean not null default true,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint application_materials_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_materials_version_unique
        unique (
            workspace_id,
            application_package_id,
            material_type,
            version_number
        ),

    constraint application_materials_version_positive
        check (version_number > 0),

    constraint application_materials_package_workspace_fk
        foreign key (
            workspace_id,
            application_package_id
        )
        references public.application_packages(
            workspace_id,
            id
        )
        on delete cascade,

    constraint application_materials_template_workspace_fk
        foreign key (
            workspace_id,
            source_template_id
        )
        references public.application_templates(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_materials_has_content
        check (
            content_text is not null
            or file_url is not null
            or storage_path is not null
        )
);


create index application_materials_package_idx
on public.application_materials(
    workspace_id,
    application_package_id
);


-- At most one current version of each material type inside a
-- Package.

create unique index application_materials_one_current_version
on public.application_materials(
    workspace_id,
    application_package_id,
    material_type
)
where is_current_package_version = true;


create trigger set_application_materials_updated_at
before update on public.application_materials
for each row
execute function public.set_updated_at();


create trigger set_application_materials_actor_audit
before insert or update
on public.application_materials
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_materials_workspace_change
before update of workspace_id
on public.application_materials
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 8. AUTOMATIC MATERIAL VERSION NUMBERING
-- ============================================================

create or replace function public.prepare_application_material_insert()
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
            || ':application_material:'
            || new.application_package_id::text
            || ':'
            || new.material_type,
            0
        );


    perform pg_advisory_xact_lock(lock_key);


    select coalesce(max(version_number), 0) + 1
    into new.version_number
    from public.application_materials
    where workspace_id = new.workspace_id
      and application_package_id =
          new.application_package_id
      and material_type =
          new.material_type;


    -- The newly created version becomes the working version.

    update public.application_materials
    set
        is_current_package_version = false,
        updated_at = now()
    where workspace_id = new.workspace_id
      and application_package_id =
          new.application_package_id
      and material_type =
          new.material_type
      and is_current_package_version = true;


    new.is_current_package_version := true;

    new.status := 'draft';


    return new;

end;
$$;


create trigger prepare_application_material_before_insert
before insert
on public.application_materials
for each row
execute function public.prepare_application_material_insert();


-- ============================================================
-- 9. APPLICATION MATERIAL ↔ CANDIDATE EVIDENCE
-- ============================================================
--
-- Answers:
--
-- "Which Candidate Knowledge supported this specific material?"
--
-- We use one evidence source per relationship row.
--
-- ============================================================

create table public.application_material_evidence (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    application_material_id uuid not null,

    evidence_story_id uuid null,
    project_id uuid null,
    skill_id uuid null,

    usage_context text null,

    -- Snapshot of the evidence as it existed when this
    -- relationship was created.
    evidence_snapshot jsonb null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint application_material_evidence_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_material_evidence_one_source
        check (
            num_nonnulls(
                evidence_story_id,
                project_id,
                skill_id
            ) = 1
        ),

    constraint application_material_evidence_material_workspace_fk
        foreign key (
            workspace_id,
            application_material_id
        )
        references public.application_materials(
            workspace_id,
            id
        )
        on delete cascade,

    constraint application_material_evidence_story_workspace_fk
        foreign key (
            workspace_id,
            evidence_story_id
        )
        references public.evidence_stories(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_material_evidence_project_workspace_fk
        foreign key (
            workspace_id,
            project_id
        )
        references public.projects(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_material_evidence_skill_workspace_fk
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


create index application_material_evidence_material_idx
on public.application_material_evidence(
    workspace_id,
    application_material_id
);


create trigger set_application_material_evidence_actor
before insert
on public.application_material_evidence
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_material_evidence_workspace_change
before update of workspace_id
on public.application_material_evidence
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 10. APPLICATION MATERIAL EVIDENCE SNAPSHOT
-- ============================================================

create or replace function public.prepare_application_material_evidence()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    story_record public.evidence_stories%rowtype;
    project_record public.projects%rowtype;
    skill_record public.skills%rowtype;
    skill_supported boolean := false;
    skill_support_snapshot jsonb := '[]'::jsonb;
begin

    if new.evidence_story_id is not null then

        select *
        into story_record
        from public.evidence_stories
        where workspace_id = new.workspace_id
          and id = new.evidence_story_id;


        if not found then
            raise exception
                'Evidence Story does not exist in this Workspace';
        end if;


        if story_record.validation_status <> 'confirmed' then
            raise exception
                'Only confirmed Evidence Stories may support Application Materials';
        end if;


        new.evidence_snapshot :=
            jsonb_build_object(
                'type',
                'evidence_story',
                'id',
                story_record.id,
                'title',
                story_record.title,
                'situation',
                story_record.situation,
                'candidate_role',
                story_record.candidate_role,
                'actions_taken',
                story_record.actions_taken,
                'outcome',
                story_record.outcome,
                'quantitative_impact',
                story_record.quantitative_impact,
                'professional_translation',
                story_record.professional_translation,
                'validation_status',
                story_record.validation_status,
                'snapshot_at',
                now()
            );


    elsif new.project_id is not null then

        select *
        into project_record
        from public.projects
        where workspace_id = new.workspace_id
          and id = new.project_id;


        if not found then
            raise exception
                'Project does not exist in this Workspace';
        end if;


        if project_record.validation_status <> 'confirmed' then
            raise exception
                'Only confirmed Projects may support Application Materials';
        end if;


        new.evidence_snapshot :=
            jsonb_build_object(
                'type',
                'project',
                'id',
                project_record.id,
                'name',
                project_record.name,
                'summary',
                project_record.summary,
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
                'snapshot_at',
                now()
            );


    elsif new.skill_id is not null then

        select *
        into skill_record
        from public.skills
        where workspace_id = new.workspace_id
          and id = new.skill_id;


        if not found then
            raise exception
                'Skill does not exist in this Workspace';
        end if;


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
                    ess.evidence_strength,
                    'validation_status',
                    es.validation_status
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
                    ps.evidence_strength,
                    'validation_status',
                    p.validation_status
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


        skill_supported :=
            jsonb_array_length(skill_support_snapshot) > 0;


        if not skill_supported then
            raise exception
                'Skill must be supported by confirmed Candidate Knowledge before it may support Application Materials';
        end if;


        new.evidence_snapshot :=
            jsonb_build_object(
                'type',
                'skill',
                'id',
                skill_record.id,
                'name',
                skill_record.name,
                'category',
                skill_record.category,
                'description',
                skill_record.description,
                'supporting_evidence',
                skill_support_snapshot,
                'snapshot_at',
                now()
            );

    end if;


    return new;

end;
$$;


create trigger prepare_application_material_evidence_before_insert
before insert
on public.application_material_evidence
for each row
execute function public.prepare_application_material_evidence();


-- ============================================================
-- 11. APPLICATIONS
-- ============================================================
--
-- The final RO.
--
-- Represents one actual submission attempt.
--
-- Preparation states do NOT belong here.
--
-- Those live on application_packages.
--
-- An Application begins when an actual submission attempt is
-- initiated or recorded.
--
-- ============================================================

create table public.applications (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid not null,

    application_package_id uuid null,

    attempt_number integer not null,

    application_stage text not null
        default 'submission_started'
        check (
            application_stage in (
                'submission_started',
                'submitted',
                'confirmed',
                'submission_failed',
                'withdrawn'
            )
        ),

    submission_method text null,

    application_url text null,

    submitted_at timestamptz null,

    confirmed_at timestamptz null,

    submitted_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    approved_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    confirmation_type text null,

    confirmation_reference text null,

    notes text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint applications_workspace_id_id_unique
        unique (workspace_id, id),

    constraint applications_attempt_unique
        unique (
            workspace_id,
            opportunity_id,
            attempt_number
        ),

    constraint applications_attempt_positive
        check (attempt_number > 0),

    constraint applications_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict,

    constraint applications_package_workspace_fk
        foreign key (
            workspace_id,
            application_package_id
        )
        references public.application_packages(
            workspace_id,
            id
        )
        on delete restrict
);


create index applications_opportunity_idx
on public.applications(
    workspace_id,
    opportunity_id
);


create index applications_stage_idx
on public.applications(
    workspace_id,
    application_stage
);


-- A Package may be reused after a failed or withdrawn
-- submission attempt.
--
-- But the same Package should not produce more than one
-- successful submitted/confirmed Application.

create unique index applications_active_package_unique
on public.applications(
    workspace_id,
    application_package_id
)
where application_package_id is not null
  and application_stage not in (
      'submission_failed',
      'withdrawn'
  );


create trigger set_applications_updated_at
before update on public.applications
for each row
execute function public.set_updated_at();


create trigger set_applications_actor_audit
before insert or update
on public.applications
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_applications_workspace_change
before update of workspace_id
on public.applications
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 12. AUTOMATIC APPLICATION ATTEMPT NUMBERING
-- ============================================================

create or replace function public.prepare_application_insert()
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
            || ':application:'
            || new.opportunity_id::text,
            0
        );


    perform pg_advisory_xact_lock(lock_key);


    select coalesce(max(attempt_number), 0) + 1
    into new.attempt_number
    from public.applications
    where workspace_id = new.workspace_id
      and opportunity_id = new.opportunity_id;


    new.application_stage :=
        'submission_started';

    new.submitted_at := null;
    new.confirmed_at := null;


    return new;

end;
$$;


create trigger prepare_application_before_insert
before insert
on public.applications
for each row
execute function public.prepare_application_insert();


-- ============================================================
-- 13. SUBMITTED MATERIALS
-- ============================================================
--
-- This is the frozen final-RO record.
--
-- It links the exact Material version to the Application AND
-- stores a snapshot of the actual contents.
--
-- Why both?
--
-- Reference:
--   lets us navigate back to the Material.
--
-- Snapshot:
--   protects historical truth even if a future bug or privileged
--   administrative operation changes the Material row.
--
-- ============================================================

create table public.application_submitted_materials (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    application_id uuid not null,

    application_material_id uuid not null,

    material_type text not null,

    submitted_material_snapshot jsonb not null,

    submitted_at timestamptz not null default now(),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint application_submitted_materials_workspace_id_id_unique
        unique (workspace_id, id),

    constraint application_submitted_materials_unique
        unique (
            workspace_id,
            application_id,
            application_material_id
        ),

    constraint application_submitted_materials_application_workspace_fk
        foreign key (
            workspace_id,
            application_id
        )
        references public.applications(
            workspace_id,
            id
        )
        on delete restrict,

    constraint application_submitted_materials_material_workspace_fk
        foreign key (
            workspace_id,
            application_material_id
        )
        references public.application_materials(
            workspace_id,
            id
        )
        on delete restrict
);


create index application_submitted_materials_application_idx
on public.application_submitted_materials(
    workspace_id,
    application_id
);


create trigger set_application_submitted_materials_actor
before insert
on public.application_submitted_materials
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_application_submitted_materials_workspace_change
before update of workspace_id
on public.application_submitted_materials
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 14. SUBMITTED MATERIAL VALIDATION + SNAPSHOT
-- ============================================================
--
-- Protects against attaching:
--
-- Mor Furniture Application
--
-- to:
--
-- Resume prepared for Salesforce
--
-- by accident.
--
-- The Material must belong to the Package used by the
-- Application.
--
-- ============================================================

create or replace function public.prepare_submitted_application_material()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    application_record public.applications%rowtype;
    material_record public.application_materials%rowtype;
begin

    select *
    into application_record
    from public.applications
    where workspace_id = new.workspace_id
      and id = new.application_id;


    if not found then
        raise exception
            'Application does not exist in this Workspace';
    end if;


    select *
    into material_record
    from public.application_materials
    where workspace_id = new.workspace_id
      and id = new.application_material_id;


    if not found then
        raise exception
            'Application Material does not exist in this Workspace';
    end if;


    if application_record.application_package_id is null then
        raise exception
            'Application must reference an Application Package before submitted materials can be attached';
    end if;


    if material_record.application_package_id
       <> application_record.application_package_id then

        raise exception
            'Submitted Material belongs to a different Application Package';

    end if;


    if material_record.status not in (
        'approved',
        'submitted'
    ) then

        raise exception
            'Only approved Application Materials may be recorded as submitted';

    end if;


    new.material_type :=
        material_record.material_type;


    new.submitted_material_snapshot :=
        jsonb_build_object(

            'application_material_id',
            material_record.id,

            'application_package_id',
            material_record.application_package_id,

            'material_type',
            material_record.material_type,

            'version_number',
            material_record.version_number,

            'content_text',
            material_record.content_text,

            'file_url',
            material_record.file_url,

            'storage_path',
            material_record.storage_path,

            'source_template_id',
            material_record.source_template_id,

            'status_at_submission',
            material_record.status,

            'snapshot_at',
            now()
        );


    return new;

end;
$$;


create trigger prepare_submitted_application_material_before_insert
before insert
on public.application_submitted_materials
for each row
execute function public.prepare_submitted_application_material();


-- ============================================================
-- 15. APPLICATION MODEL RECAP
-- ============================================================
--
-- Candidate Knowledge
--        ↓
--
-- Application Template
--        ↓
--
-- Application Package
--        ↓
--
-- Resume v1
-- Resume v2
-- Resume v3 ← approved
--
-- Cover Letter v1
-- Cover Letter v2 ← approved
--
--        ↓
--
-- Application
-- attempt #1
--
--        ↓
--
-- Submitted Materials
--
-- Resume v3 snapshot
-- Cover Letter v2 snapshot
--
-- ============================================================


-- ============================================================
-- 16. ADP / REPAIR ORDER ANALOGY
-- ============================================================
--
-- Working RO
--
--   parts change
--   labor changes
--   notes change
--   recommendations change
--
--       ↓
--
-- Finalized RO
--
--   preserves what actually happened on that visit
--
--
-- Our system:
--
-- Application Package
--
--   drafts change
--   evidence changes
--   resume versions change
--
--       ↓
--
-- Application
--
--   preserves what actually happened in that submission
--
-- ============================================================


-- ============================================================
-- 17. IMPORTANT V1 DEFERRAL
-- ============================================================
--
-- Application Answer Packets are intentionally NOT created in
-- this migration.
--
-- Deferred tables include:
--
--   application_answer_packets
--   application_answers
--   application_answer_evidence
--   application_submitted_answers
--
-- When ATS question automation is added, exact submitted
-- answers will receive the same historical snapshot treatment
-- as submitted Materials.
--
-- ============================================================


-- ============================================================
-- MIGRATION 014 COMPLETE
-- ============================================================
--
-- Application structure now exists.
--
-- NEXT MIGRATION:
--
-- Application RLS + lifecycle controls
--
-- That migration will enforce:
--
--   Template lifecycle
--   Package lifecycle
--   Material version protection
--   Approval authority
--   Application submission lifecycle
--   Submitted-material immutability
--   Principal validation
--   Workspace RLS
--
-- ============================================================
