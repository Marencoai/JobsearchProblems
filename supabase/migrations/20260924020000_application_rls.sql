-- ============================================================
-- Job Search AI Agent
-- Migration 015: Application RLS and Lifecycle Controls
-- ============================================================
--
-- Protects:
--   application_templates
--   application_packages
--   application_materials
--   application_material_evidence
--   applications
--   application_submitted_materials
--
-- Adds:
--   Application Template lifecycle protection
--   Application Package lifecycle and approval controls
--   Package / Evaluation consistency
--   Material version and approval protection
--   Material-evidence lifecycle controls
--   Application submission lifecycle
--   Automatic submitted-material snapshots
--   Submitted-material immutability
--   Principal / Workspace validation
--   Application Activity Event link support
--   Workspace RLS
--
-- Core principle:
--
-- Application Package
--      = working RO
--
-- Application
--      = actual submission attempt
--
-- Submitted Material Snapshot
--      = final historical RO
--
-- ============================================================


-- ============================================================
-- 1. APPLICATION TEMPLATE LIFECYCLE
-- ============================================================
--
-- draft
--   ↓
-- active
--   ↓
-- retired
--
-- Active and retired Template content is historical.
--
-- To change an active Template:
--
--   create a new Template version
--   activate the new version
--   retire the old version
--
-- ============================================================

create or replace function public.enforce_application_template_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_manage boolean;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    may_manage :=
        public.has_permission(
            new.workspace_id,
            'application_template.manage'
        );


    if not may_manage then
        raise exception
            'Permission application_template.manage is required';
    end if;


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then
        new.status := 'draft';
        return new;
    end if;


    -- --------------------------------------------------------
    -- Immutable identity / version fields.
    -- --------------------------------------------------------

    if new.id <> old.id
       or new.template_key <> old.template_key
       or new.version_number <> old.version_number
       or new.created_at <> old.created_at
       or new.created_by_principal_id
          is distinct from old.created_by_principal_id then

        raise exception
            'Application Template identity and version are immutable';

    end if;


    -- --------------------------------------------------------
    -- Retired Templates are immutable.
    -- --------------------------------------------------------

    if old.status = 'retired' then
        raise exception
            'Retired Application Templates are immutable';
    end if;


    -- --------------------------------------------------------
    -- Draft may be edited.
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'draft' then

        return new;

    end if;


    -- --------------------------------------------------------
    -- Draft → Active
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'active' then

        -- The unique partial index ensures only one active
        -- version exists for a template_key.

        return new;

    end if;


    -- --------------------------------------------------------
    -- Draft → Retired
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'retired' then

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
                'Template content cannot change while retiring it';

        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Active content is frozen.
    -- Active → Retired is the only valid transition.
    -- --------------------------------------------------------

    if old.status = 'active'
       and new.status = 'active' then

        raise exception
            'Active Application Templates are immutable; create a new version to change content';

    end if;


    if old.status = 'active'
       and new.status = 'retired' then

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
                'Template content cannot change while retiring it';

        end if;

        return new;

    end if;


    raise exception
        'Invalid Application Template transition: % → %',
        old.status,
        new.status;

end;
$$;


create trigger enforce_application_template_lifecycle_before_write
before insert or update
on public.application_templates
for each row
execute function public.enforce_application_template_lifecycle();


-- ============================================================
-- 2. APPLICATION PACKAGE CONTEXT VALIDATION
-- ============================================================
--
-- If a Package references an Evaluation:
--
--   Evaluation must belong to the same Opportunity.
--
-- When a Package is approved:
--
--   the referenced Evaluation, when present, must be complete.
--
-- ============================================================

create or replace function public.validate_application_package_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    evaluation_opportunity_id uuid;
    evaluation_status_value text;
begin

    if new.evaluation_id is null then
        return new;
    end if;


    select
        opportunity_id,
        evaluation_status
    into
        evaluation_opportunity_id,
        evaluation_status_value
    from public.evaluations
    where workspace_id = new.workspace_id
      and id = new.evaluation_id;


    if not found then
        raise exception
            'Evaluation does not exist in this Workspace';
    end if;


    if evaluation_opportunity_id <> new.opportunity_id then
        raise exception
            'Application Package Evaluation belongs to a different Opportunity';
    end if;


    if new.status = 'approved'
       and evaluation_status_value <> 'complete' then

        raise exception
            'Application Package cannot be approved using an incomplete Evaluation';

    end if;


    return new;

end;
$$;


revoke all on function public.validate_application_package_context()
from public;


create trigger validate_application_package_context_before_write
before insert or update of
    opportunity_id,
    evaluation_id,
    status
on public.application_packages
for each row
execute function public.validate_application_package_context();


-- ============================================================
-- 3. APPLICATION PACKAGE TEMPLATE VALIDATION
-- ============================================================
--
-- New preparation should start from the current active Template
-- version when a Template is used.
--
-- Historical Packages may continue pointing to a Template that
-- is retired later.
-- ============================================================

create or replace function public.validate_application_package_template()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
    template_status text;
    template_job_family_id uuid;
    opportunity_job_family_id uuid;
begin

    if new.application_template_id is null then
        return new;
    end if;


    if tg_op = 'UPDATE'
       and new.application_template_id
           is not distinct from old.application_template_id
       and new.opportunity_id
           is not distinct from old.opportunity_id then

        return new;

    end if;


    select
        status,
        job_family_id
    into
        template_status,
        template_job_family_id
    from public.application_templates
    where workspace_id = new.workspace_id
      and id = new.application_template_id;


    if not found then
        raise exception
            'Application Template does not exist in this Workspace';
    end if;


    if template_status <> 'active' then
        raise exception
            'New Application preparation must use an active Application Template';
    end if;


    select job_family_id
    into opportunity_job_family_id
    from public.opportunities
    where workspace_id = new.workspace_id
      and id = new.opportunity_id;


    if not found then
        raise exception
            'Application Package Opportunity does not exist in this Workspace';
    end if;


    -- A Template with no Job Family is intentionally generic.
    --
    -- When both sides are classified, they must agree.

    if template_job_family_id is not null
       and opportunity_job_family_id is not null
       and template_job_family_id <> opportunity_job_family_id then

        raise exception
            'Application Template Job Family does not match the Opportunity Job Family';

    end if;


    return new;

end;
$;


revoke all on function
    public.validate_application_package_template()
from public;


create trigger validate_application_package_template_before_write
before insert or update of application_template_id
on public.application_packages
for each row
execute function public.validate_application_package_template();


-- ============================================================
-- 4. APPLICATION PACKAGE LIFECYCLE
-- ============================================================
--
-- draft
--   ↓
-- preparing
--   ↓
-- ready_for_review
--   ↓
-- approved
--
-- Changes requested:
--
-- ready_for_review → preparing
--
-- Approved Package needs changes:
--
-- approved → preparing
--
-- Reopening an approved Package clears approval history.
--
-- Archived is terminal.
--
-- ============================================================

create or replace function public.enforce_application_package_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    actor_id uuid;

    may_prepare boolean;
    may_approve boolean;

    approved_material_count integer;
    unresolved_current_material_count integer;

    old_business_state jsonb;
    new_business_state jsonb;
begin

    actor_id := public.current_principal_id();

    may_prepare :=
        public.has_permission(
            new.workspace_id,
            'application.prepare'
        );

    may_approve :=
        public.has_permission(
            new.workspace_id,
            'application.approve'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;


        if actor_id is null then
            raise exception
                'Authenticated Principal required to create an Application Package';
        end if;


        new.status := 'draft';
        new.prepared_by_principal_id := actor_id;
        new.approved_by_principal_id := null;
        new.approved_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Immutable identity / origin.
    -- --------------------------------------------------------

    if new.id <> old.id
       or new.opportunity_id <> old.opportunity_id
       or new.package_number <> old.package_number
       or new.created_at <> old.created_at
       or new.created_by_principal_id
          is distinct from old.created_by_principal_id
       or new.prepared_by_principal_id
          is distinct from old.prepared_by_principal_id then

        raise exception
            'Application Package identity and preparation origin are immutable';

    end if;


    -- --------------------------------------------------------
    -- Archived Packages are immutable.
    -- --------------------------------------------------------

    if old.status = 'archived' then
        raise exception
            'Archived Application Packages are immutable';
    end if;


    -- --------------------------------------------------------
    -- Ordinary editing while not approved.
    -- --------------------------------------------------------

    if old.status in (
        'draft',
        'preparing',
        'ready_for_review'
    )
    and new.status = old.status then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required to edit an Application Package';
        end if;


        -- Approval fields cannot be spoofed.

        new.approved_by_principal_id :=
            old.approved_by_principal_id;

        new.approved_at :=
            old.approved_at;

        return new;

    end if;


    -- --------------------------------------------------------
    -- draft → preparing
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'preparing' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;

        new.approved_by_principal_id := null;
        new.approved_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- preparing → ready_for_review
    -- --------------------------------------------------------

    if old.status = 'preparing'
       and new.status = 'ready_for_review' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;

        new.approved_by_principal_id := null;
        new.approved_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- ready_for_review → preparing
    -- --------------------------------------------------------

    if old.status = 'ready_for_review'
       and new.status = 'preparing' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;

        new.approved_by_principal_id := null;
        new.approved_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- ready_for_review → approved
    -- --------------------------------------------------------

    if old.status = 'ready_for_review'
       and new.status = 'approved' then

        if not may_approve then
            raise exception
                'Permission application.approve is required';
        end if;


        if actor_id is null then
            raise exception
                'Authenticated Principal required to approve an Application Package';
        end if;


        select count(*)
        into approved_material_count
        from public.application_materials
        where workspace_id = new.workspace_id
          and application_package_id = new.id
          and status = 'approved'
          and is_current_package_version = true;


        if approved_material_count = 0 then
            raise exception
                'Application Package must contain at least one approved current Material before approval';
        end if;


        select count(*)
        into unresolved_current_material_count
        from public.application_materials
        where workspace_id = new.workspace_id
          and application_package_id = new.id
          and is_current_package_version = true
          and status in (
              'draft',
              'candidate_review'
          );


        if unresolved_current_material_count > 0 then
            raise exception
                'Application Package cannot be approved while current Materials still require preparation or review';
        end if;


        new.approved_by_principal_id := actor_id;
        new.approved_at := now();

        return new;

    end if;


    -- --------------------------------------------------------
    -- approved → preparing
    --
    -- Reopening invalidates previous approval.
    -- --------------------------------------------------------

    if old.status = 'approved'
       and new.status = 'preparing' then

        if not may_approve then
            raise exception
                'Permission application.approve is required to reopen an approved Package';
        end if;


        if exists (
            select 1
            from public.applications a
            where a.workspace_id = new.workspace_id
              and a.application_package_id = new.id
        ) then

            raise exception
                'Application Package cannot be reopened after it has been used by an Application attempt';

        end if;


        new.approved_by_principal_id := null;
        new.approved_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- approved → approved
    --
    -- Freeze approved Package content.
    -- --------------------------------------------------------

    if old.status = 'approved'
       and new.status = 'approved' then

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
                'Approved Application Packages are frozen; reopen the Package before making changes';

        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- Archive from any non-archived state.
    -- --------------------------------------------------------

    if new.status = 'archived'
       and old.status <> 'archived' then

        if not may_prepare
           and not may_approve then

            raise exception
                'Application prepare or approve permission is required to archive a Package';

        end if;


        if exists (
            select 1
            from public.applications a
            where a.workspace_id = new.workspace_id
              and a.application_package_id = new.id
        ) then

            raise exception
                'Application Package cannot be archived after it has been used by an Application attempt';

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
                'Package content cannot change while archiving it';

        end if;


        return new;

    end if;


    raise exception
        'Invalid Application Package transition: % → %',
        old.status,
        new.status;

end;
$$;


create trigger enforce_application_package_lifecycle_before_write
before insert or update
on public.application_packages
for each row
execute function public.enforce_application_package_lifecycle();


-- ============================================================
-- 5. APPLICATION MATERIAL PARENT STATUS HELPER
-- ============================================================

create or replace function public.get_application_package_status(
    target_workspace_id uuid,
    target_package_id uuid
)
returns text
language sql
stable
security definer
set search_path = public
as $$
    select status
    from public.application_packages
    where workspace_id = target_workspace_id
      and id = target_package_id
    limit 1;
$$;


revoke all on function
    public.get_application_package_status(uuid, uuid)
from public;


-- ============================================================
-- 6. APPLICATION MATERIAL LIFECYCLE
-- ============================================================
--
-- Material content is versioned.
--
-- Therefore:
--
--   content does NOT get edited in place
--
--   a changed resume becomes Resume v2
--
-- Only lifecycle metadata changes on an existing version.
--
-- ============================================================

create or replace function public.enforce_application_material_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    package_status text;

    may_prepare boolean;
    may_approve boolean;
    may_submit boolean;

    old_content_state jsonb;
    new_content_state jsonb;
begin

    may_prepare :=
        public.has_permission(
            new.workspace_id,
            'application.prepare'
        );

    may_approve :=
        public.has_permission(
            new.workspace_id,
            'application.approve'
        );

    may_submit :=
        public.has_permission(
            new.workspace_id,
            'application.submit'
        );


    package_status :=
        public.get_application_package_status(
            new.workspace_id,
            new.application_package_id
        );


    if package_status is null then
        raise exception
            'Application Package does not exist';
    end if;


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;


        if package_status not in (
            'draft',
            'preparing',
            'ready_for_review'
        ) then

            raise exception
                'New Material versions may only be added before Package approval';

        end if;


        new.status := 'draft';

        return new;

    end if;


    -- --------------------------------------------------------
    -- Immutable version content / identity.
    --
    -- Every content change creates another Material row.
    -- --------------------------------------------------------

    old_content_state :=
        to_jsonb(old)
        - array[
            'status',
            'is_current_package_version',
            'updated_at',
            'updated_by_principal_id'
        ];


    new_content_state :=
        to_jsonb(new)
        - array[
            'status',
            'is_current_package_version',
            'updated_at',
            'updated_by_principal_id'
        ];


    if old_content_state
       is distinct from new_content_state then

        raise exception
            'Application Material content and version identity are immutable; create a new Material version';

    end if;


    -- --------------------------------------------------------
    -- Submitted / rejected / archived are terminal.
    -- --------------------------------------------------------

    if old.status in (
        'submitted',
        'rejected',
        'archived'
    )
    and new.status is distinct from old.status then

        raise exception
            'Submitted, rejected, and archived Application Materials are terminal';

    end if;


    -- --------------------------------------------------------
    -- Package approval freezes ordinary Material changes.
    -- --------------------------------------------------------

    if package_status = 'approved'
       and old.status is distinct from new.status
       and new.status <> 'submitted' then

        raise exception
            'Approved Package Materials are frozen until the Package is reopened';

    end if;


    -- --------------------------------------------------------
    -- Prepare transitions.
    -- --------------------------------------------------------

    if old.status = 'draft'
       and new.status = 'candidate_review' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;

        return new;

    end if;


    if old.status = 'candidate_review'
       and new.status = 'draft' then

        if not may_prepare then
            raise exception
                'Permission application.prepare is required';
        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Approval / rejection.
    -- --------------------------------------------------------

    if old.status in (
        'draft',
        'candidate_review'
    )
    and new.status = 'approved' then

        if not may_approve then
            raise exception
                'Permission application.approve is required';
        end if;

        return new;

    end if;


    if old.status in (
        'draft',
        'candidate_review'
    )
    and new.status = 'rejected' then

        if not may_approve then
            raise exception
                'Permission application.approve is required';
        end if;

        new.is_current_package_version := false;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Approved → Submitted.
    -- --------------------------------------------------------

    if old.status = 'approved'
       and new.status = 'submitted' then

        if not may_submit then
            raise exception
                'Permission application.submit is required';
        end if;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Archive a non-submitted working version.
    -- --------------------------------------------------------

    if new.status = 'archived'
       and old.status in (
           'draft',
           'candidate_review',
           'approved'
       ) then

        if not may_prepare
           and not may_approve then

            raise exception
                'Application prepare or approve permission is required to archive Material';

        end if;

        new.is_current_package_version := false;

        return new;

    end if;


    -- No-op status update is allowed.

    if old.status = new.status then
        return new;
    end if;


    raise exception
        'Invalid Application Material transition: % → %',
        old.status,
        new.status;

end;
$$;


revoke all on function public.enforce_application_material_lifecycle()
from public;


create trigger enforce_application_material_lifecycle_before_write
before insert or update
on public.application_materials
for each row
execute function public.enforce_application_material_lifecycle();


-- ============================================================
-- 7. APPLICATION MATERIAL EVIDENCE LIFECYCLE
-- ============================================================
--
-- Evidence links may be changed only while the Material itself
-- is still a working draft / review version.
--
-- Once approved or submitted, the evidence trace is frozen.
--
-- ============================================================

create or replace function public.require_mutable_application_material()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    target_workspace_id uuid;
    target_material_id uuid;
    material_status text;
begin

    if tg_op = 'DELETE' then
        target_workspace_id := old.workspace_id;
        target_material_id := old.application_material_id;
    else
        target_workspace_id := new.workspace_id;
        target_material_id := new.application_material_id;
    end if;


    select status
    into material_status
    from public.application_materials
    where workspace_id = target_workspace_id
      and id = target_material_id;


    if not found then
        raise exception
            'Application Material does not exist';
    end if;


    if material_status not in (
        'draft',
        'candidate_review'
    ) then

        raise exception
            'Application Material evidence is frozen after Material approval';

    end if;


    if tg_op = 'DELETE' then
        return old;
    end if;


    return new;

end;
$$;


revoke all on function public.require_mutable_application_material()
from public;


create trigger require_mutable_material_for_evidence
before insert or update or delete
on public.application_material_evidence
for each row
execute function public.require_mutable_application_material();


-- ============================================================
-- 8. APPLICATION INSERT / PACKAGE CONSISTENCY
-- ============================================================
--
-- If an Application uses a Package:
--
--   Package must belong to the same Opportunity.
--   Package must be approved.
--
-- The Application copies the Package approver as the approval
-- historical reference.
--
-- ============================================================

create or replace function public.validate_application_submission_context()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    package_opportunity_id uuid;
    package_status text;
    package_approver uuid;
begin

    if new.application_package_id is null then
        return new;
    end if;


    select
        opportunity_id,
        status,
        approved_by_principal_id
    into
        package_opportunity_id,
        package_status,
        package_approver
    from public.application_packages
    where workspace_id = new.workspace_id
      and id = new.application_package_id;


    if not found then
        raise exception
            'Application Package does not exist in this Workspace';
    end if;


    if package_opportunity_id <> new.opportunity_id then
        raise exception
            'Application Package belongs to a different Opportunity';
    end if;


    if package_status <> 'approved' then
        raise exception
            'Application Package must be approved before submission begins';
    end if;


    new.approved_by_principal_id :=
        package_approver;


    return new;

end;
$$;


revoke all on function public.validate_application_submission_context()
from public;


create trigger validate_application_submission_context_before_insert
before insert
on public.applications
for each row
execute function public.validate_application_submission_context();


-- ============================================================
-- 9. APPLICATION PRINCIPAL VALIDATION
-- ============================================================
--
-- Any recorded approving / submitting Principal must belong to
-- the same Workspace.
--
-- ============================================================

create or replace function public.validate_application_principals()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if new.approved_by_principal_id is not null
       and not public.is_active_workspace_principal(
           new.workspace_id,
           new.approved_by_principal_id
       ) then

        raise exception
            'Application approver must be an active Principal in the same Workspace';

    end if;


    if new.submitted_by_principal_id is not null
       and not public.is_active_workspace_principal(
           new.workspace_id,
           new.submitted_by_principal_id
       ) then

        raise exception
            'Application submitter must be an active Principal in the same Workspace';

    end if;


    return new;

end;
$$;


create trigger validate_application_principals_before_write
before insert or update of
    approved_by_principal_id,
    submitted_by_principal_id
on public.applications
for each row
execute function public.validate_application_principals();


-- ============================================================
-- 10. APPLICATION LIFECYCLE
-- ============================================================
--
-- submission_started
--      ↓
-- submitted
--      ↓
-- confirmed
--
-- Alternate terminal outcomes:
--
-- submission_failed
-- withdrawn
--
-- Submission facts become immutable once submitted.
--
-- ============================================================

create or replace function public.enforce_application_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_id uuid;

    may_submit boolean;
    may_confirm boolean;

    approved_material_count integer;
    package_status_value text;

    old_submission_state jsonb;
    new_submission_state jsonb;
begin

    actor_id := public.current_principal_id();

    may_submit :=
        public.has_permission(
            new.workspace_id,
            'application.submit'
        );

    may_confirm :=
        public.has_permission(
            new.workspace_id,
            'application.confirm'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if not may_submit then
            raise exception
                'Permission application.submit is required to create an Application submission attempt';
        end if;


        if actor_id is null then
            raise exception
                'Authenticated Principal required to create an Application';
        end if;


        new.application_stage := 'submission_started';
        new.submitted_by_principal_id := null;
        new.submitted_at := null;
        new.confirmed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- Immutable identity / attempt origin.
    -- --------------------------------------------------------

    if new.id <> old.id
       or new.opportunity_id <> old.opportunity_id
       or new.application_package_id
          is distinct from old.application_package_id
       or new.attempt_number <> old.attempt_number
       or new.created_at <> old.created_at
       or new.created_by_principal_id
          is distinct from old.created_by_principal_id
       or new.approved_by_principal_id
          is distinct from old.approved_by_principal_id then

        raise exception
            'Application identity, Package, attempt number, and approval origin are immutable';

    end if;


    -- --------------------------------------------------------
    -- Failed / withdrawn attempts are terminal.
    -- --------------------------------------------------------

    if old.application_stage in (
        'submission_failed',
        'withdrawn'
    ) then

        raise exception
            'Failed or withdrawn Application attempts are immutable';

    end if;


    -- --------------------------------------------------------
    -- submission_started remains submission_started.
    -- --------------------------------------------------------

    if old.application_stage = 'submission_started'
       and new.application_stage = 'submission_started' then

        if not may_submit then
            raise exception
                'Permission application.submit is required';
        end if;


        new.submitted_by_principal_id := null;
        new.submitted_at := null;
        new.confirmed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- submission_started → submitted
    -- --------------------------------------------------------

    if old.application_stage = 'submission_started'
       and new.application_stage = 'submitted' then

        if not may_submit then
            raise exception
                'Permission application.submit is required';
        end if;


        if actor_id is null then
            raise exception
                'Authenticated Principal required to record submission';
        end if;


        if new.application_package_id is not null then

            select status
            into package_status_value
            from public.application_packages
            where workspace_id = new.workspace_id
              and id = new.application_package_id;


            if not found then
                raise exception
                    'Application Package does not exist in this Workspace';
            end if;


            if package_status_value <> 'approved' then
                raise exception
                    'Application Package must still be approved when submission occurs';
            end if;


            select count(*)
            into approved_material_count
            from public.application_materials
            where workspace_id = new.workspace_id
              and application_package_id =
                  new.application_package_id
              and status = 'approved'
              and is_current_package_version = true;


            if approved_material_count = 0 then
                raise exception
                    'Approved Package must contain at least one approved current Material before submission';
            end if;

        end if;


        new.submitted_by_principal_id := actor_id;
        new.submitted_at := now();
        new.confirmed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- submission_started → submission_failed / withdrawn
    -- --------------------------------------------------------

    if old.application_stage = 'submission_started'
       and new.application_stage in (
           'submission_failed',
           'withdrawn'
       ) then

        if not may_submit then
            raise exception
                'Permission application.submit is required';
        end if;


        new.submitted_by_principal_id := null;
        new.submitted_at := null;
        new.confirmed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- submitted → confirmed
    -- --------------------------------------------------------

    if old.application_stage = 'submitted'
       and new.application_stage = 'confirmed' then

        if not may_confirm then
            raise exception
                'Permission application.confirm is required';
        end if;


        -- Submission facts cannot change during confirmation.

        old_submission_state :=
            to_jsonb(old)
            - array[
                'application_stage',
                'confirmed_at',
                'confirmation_type',
                'confirmation_reference',
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_submission_state :=
            to_jsonb(new)
            - array[
                'application_stage',
                'confirmed_at',
                'confirmation_type',
                'confirmation_reference',
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_submission_state
           is distinct from new_submission_state then

            raise exception
                'Submission facts cannot change while confirming an Application';
        end if;


        new.confirmed_at :=
            coalesce(
                new.confirmed_at,
                now()
            );


        return new;

    end if;


    -- --------------------------------------------------------
    -- submitted → withdrawn
    -- confirmed → withdrawn
    -- --------------------------------------------------------

    if old.application_stage in (
        'submitted',
        'confirmed'
    )
    and new.application_stage = 'withdrawn' then

        if not may_submit then
            raise exception
                'Permission application.submit is required to withdraw an Application';
        end if;


        old_submission_state :=
            to_jsonb(old)
            - array[
                'application_stage',
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_submission_state :=
            to_jsonb(new)
            - array[
                'application_stage',
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_submission_state
           is distinct from new_submission_state then

            raise exception
                'Submission facts cannot change while withdrawing an Application';
        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- submitted remains submitted.
    --
    -- Only notes may change while waiting for confirmation.
    -- --------------------------------------------------------

    if old.application_stage = 'submitted'
       and new.application_stage = 'submitted' then

        if not may_submit
           and not may_confirm then

            raise exception
                'Application submit or confirm permission is required';
        end if;


        old_submission_state :=
            to_jsonb(old)
            - array[
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_submission_state :=
            to_jsonb(new)
            - array[
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_submission_state
           is distinct from new_submission_state then

            raise exception
                'Submitted Application facts are immutable';
        end if;


        return new;

    end if;


    -- --------------------------------------------------------
    -- confirmed remains confirmed.
    --
    -- Historical submission / confirmation facts are frozen.
    -- --------------------------------------------------------

    if old.application_stage = 'confirmed'
       and new.application_stage = 'confirmed' then

        old_submission_state :=
            to_jsonb(old)
            - array[
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_submission_state :=
            to_jsonb(new)
            - array[
                'notes',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_submission_state
           is distinct from new_submission_state then

            raise exception
                'Confirmed Application facts are immutable';
        end if;


        return new;

    end if;


    raise exception
        'Invalid Application lifecycle transition: % → %',
        old.application_stage,
        new.application_stage;

end;
$$;


revoke all on function public.enforce_application_lifecycle()
from public;


create trigger enforce_application_lifecycle_before_write
before insert or update
on public.applications
for each row
execute function public.enforce_application_lifecycle();


-- ============================================================
-- 11. AUTOMATIC SUBMITTED-MATERIAL SNAPSHOT
-- ============================================================
--
-- When an Application becomes submitted:
--
--   every approved current Material in its Package
--
-- is copied into:
--
--   application_submitted_materials
--
-- automatically.
--
-- This prevents the system from forgetting to preserve the
-- final-RO snapshot.
--
-- ============================================================

create or replace function public.snapshot_materials_after_application_submit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin

    if old.application_stage <> 'submitted'
       and new.application_stage = 'submitted'
       and new.application_package_id is not null then

        insert into public.application_submitted_materials (
            workspace_id,
            application_id,
            application_material_id,
            material_type,
            submitted_material_snapshot,
            submitted_at,
            created_by_principal_id
        )
        select
            new.workspace_id,
            new.id,
            am.id,
            am.material_type,

            jsonb_build_object(
                'application_material_id',
                am.id,
                'application_package_id',
                am.application_package_id,
                'material_type',
                am.material_type,
                'version_number',
                am.version_number,
                'content_text',
                am.content_text,
                'file_url',
                am.file_url,
                'storage_path',
                am.storage_path,
                'source_template_id',
                am.source_template_id,
                'status_at_submission',
                am.status,
                'snapshot_at',
                new.submitted_at
            ),

            new.submitted_at,

            public.current_principal_id()

        from public.application_materials am

        where am.workspace_id = new.workspace_id
          and am.application_package_id =
              new.application_package_id
          and am.status = 'approved'
          and am.is_current_package_version = true

        on conflict (
            workspace_id,
            application_id,
            application_material_id
        )
        do nothing;


        -- Mark the exact versions as submitted after the
        -- historical snapshots have been created.

        update public.application_materials
        set
            status = 'submitted',
            updated_by_principal_id =
                public.current_principal_id()
        where workspace_id = new.workspace_id
          and application_package_id =
              new.application_package_id
          and status = 'approved'
          and is_current_package_version = true;

    end if;


    return new;

end;
$$;


revoke all on function
    public.snapshot_materials_after_application_submit()
from public;


create trigger snapshot_materials_after_application_submit
after update of application_stage
on public.applications
for each row
execute function public.snapshot_materials_after_application_submit();


-- ============================================================
-- 12. SUBMITTED MATERIALS ARE APPEND-ONLY
-- ============================================================

create or replace function public.prevent_submitted_material_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    raise exception
        'Submitted Application Materials are immutable historical records';

end;
$$;


create trigger prevent_submitted_material_update
before update
on public.application_submitted_materials
for each row
execute function public.prevent_submitted_material_mutation();


create trigger prevent_submitted_material_delete
before delete
on public.application_submitted_materials
for each row
execute function public.prevent_submitted_material_mutation();


-- ============================================================
-- 13. ENABLE APPLICATION RLS
-- ============================================================

alter table public.application_templates
enable row level security;

alter table public.application_packages
enable row level security;

alter table public.application_materials
enable row level security;

alter table public.application_material_evidence
enable row level security;

alter table public.applications
enable row level security;

alter table public.application_submitted_materials
enable row level security;


-- ============================================================
-- 14. APPLICATION TEMPLATE POLICIES
-- ============================================================

create policy "authorized principals can view application templates"
on public.application_templates
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


create policy "authorized principals can create application templates"
on public.application_templates
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application_template.manage'
    )
);


create policy "authorized principals can update application templates"
on public.application_templates
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application_template.manage'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'application_template.manage'
    )
);


-- No normal DELETE policy.


-- ============================================================
-- 15. APPLICATION PACKAGE POLICIES
-- ============================================================

create policy "authorized principals can view application packages"
on public.application_packages
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


create policy "authorized principals can create application packages"
on public.application_packages
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
);


create policy "authorized principals can update application packages"
on public.application_packages
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
    or
    public.has_permission(
        workspace_id,
        'application.approve'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
    or
    public.has_permission(
        workspace_id,
        'application.approve'
    )
);


-- No normal DELETE policy.


-- ============================================================
-- 16. APPLICATION MATERIAL POLICIES
-- ============================================================

create policy "authorized principals can view application materials"
on public.application_materials
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


create policy "authorized principals can create application materials"
on public.application_materials
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
);


create policy "authorized principals can update application materials"
on public.application_materials
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
    or
    public.has_permission(
        workspace_id,
        'application.approve'
    )
    or
    public.has_permission(
        workspace_id,
        'application.submit'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
    or
    public.has_permission(
        workspace_id,
        'application.approve'
    )
    or
    public.has_permission(
        workspace_id,
        'application.submit'
    )
);


-- No normal DELETE policy.
-- New content should create a new Material version.


-- ============================================================
-- 17. APPLICATION MATERIAL EVIDENCE POLICIES
-- ============================================================

create policy "authorized principals can view application material evidence"
on public.application_material_evidence
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


create policy "authorized principals can create application material evidence"
on public.application_material_evidence
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
);


create policy "authorized principals can remove application material evidence"
on public.application_material_evidence
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.prepare'
    )
);


-- Relationship edits use delete + insert.
-- No UPDATE policy.


-- ============================================================
-- 18. APPLICATION POLICIES
-- ============================================================

create policy "authorized principals can view applications"
on public.applications
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


create policy "authorized principals can create application attempts"
on public.applications
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'application.submit'
    )
);


create policy "authorized principals can update applications"
on public.applications
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.submit'
    )
    or
    public.has_permission(
        workspace_id,
        'application.confirm'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'application.submit'
    )
    or
    public.has_permission(
        workspace_id,
        'application.confirm'
    )
);


-- No DELETE policy.
-- Submission attempts are historical.


-- ============================================================
-- 19. SUBMITTED MATERIAL POLICIES
-- ============================================================
--
-- Submitted Material snapshots are created automatically by the
-- controlled Application submission trigger.
--
-- Normal authenticated clients may READ them.
--
-- They may not directly insert, update, or delete them.
-- ============================================================

create policy "authorized principals can view submitted materials"
on public.application_submitted_materials
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'application.read'
    )
);


-- No INSERT policy.
-- No UPDATE policy.
-- No DELETE policy.


-- ============================================================
-- 20. APPLICATION ACTIVITY LINK SUPPORT
-- ============================================================
--
-- Migration 011 created a controlled polymorphic Activity link
-- validator.
--
-- Now that the Application domain exists, extend the supported
-- entity types.
--
-- ============================================================

create or replace function public.validate_activity_event_link()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    entity_exists boolean := false;
begin

    case new.entity_type

        when 'company' then
            select exists (
                select 1
                from public.companies
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'company_intelligence' then
            select exists (
                select 1
                from public.company_intelligence
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'job_family' then
            select exists (
                select 1
                from public.job_families
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'opportunity' then
            select exists (
                select 1
                from public.opportunities
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'opportunity_source' then
            select exists (
                select 1
                from public.opportunity_sources
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'work_experience' then
            select exists (
                select 1
                from public.work_experiences
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'project' then
            select exists (
                select 1
                from public.projects
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'evidence_story' then
            select exists (
                select 1
                from public.evidence_stories
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'skill' then
            select exists (
                select 1
                from public.skills
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'tool' then
            select exists (
                select 1
                from public.tools
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'evaluation' then
            select exists (
                select 1
                from public.evaluations
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application_gap' then
            select exists (
                select 1
                from public.application_gaps
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'internal_task' then
            select exists (
                select 1
                from public.internal_tasks
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'next_action' then
            select exists (
                select 1
                from public.next_actions
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application_template' then
            select exists (
                select 1
                from public.application_templates
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application_package' then
            select exists (
                select 1
                from public.application_packages
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application_material' then
            select exists (
                select 1
                from public.application_materials
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application' then
            select exists (
                select 1
                from public.applications
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        when 'application_submitted_material' then
            select exists (
                select 1
                from public.application_submitted_materials
                where workspace_id = new.workspace_id
                  and id = new.entity_id
            )
            into entity_exists;


        else
            raise exception
                'Unsupported Activity Event entity type: %',
                new.entity_type;

    end case;


    if not entity_exists then
        raise exception
            'Activity Event Link target does not exist in the same Workspace';
    end if;


    return new;

end;
$$;


revoke all on function public.validate_activity_event_link()
from public;


-- ============================================================
-- 21. APPLICATION SECURITY EXAMPLE
-- ============================================================
--
-- Future Application Agent:
--
-- application.read
-- application.prepare
--
-- but NOT:
--
-- application.approve
-- application.submit
--
--
-- It may:
--
--   generate Package
--   create Resume v1
--   create Resume v2
--   attach Candidate Evidence
--   move Material to candidate_review
--
--
-- It may NOT:
--
--   approve the Package
--   record a submission
--
--
-- Progressive autonomy may later grant those permissions
-- explicitly.
--
-- ============================================================


-- ============================================================
-- 22. HISTORICAL MODEL RECAP
-- ============================================================
--
-- Living / working:
--
-- Application Template draft
-- Application Package
-- Application Material draft versions
--
--
-- Approval boundary:
--
-- Approved Package
-- Approved Material versions
--
--
-- Historical:
--
-- Application submission attempt
-- Submitted Material snapshots
--
--
-- Future Candidate Knowledge improvements do NOT rewrite what
-- an employer previously received.
--
-- ============================================================


-- ============================================================
-- MIGRATION 015 COMPLETE
-- ============================================================
--
-- Application domain now has:
--
--   Workspace RLS
--   Versioned Templates
--   Template lifecycle protection
--   Package / Evaluation consistency
--   Controlled Package approval
--   Versioned immutable Material content
--   Frozen Material evidence after approval
--   Controlled Application submission lifecycle
--   Automatic exact submitted-material snapshots
--   Submitted-material immutability
--   Principal validation
--   Activity Feed relationship support
--
--
-- V1 MIGRATION BUILD PHASE COMPLETE.
--
-- NEXT:
--
-- DO NOT DEPLOY YET.
--
-- Run a full migration audit across:
--
--   001 → 015
--
-- Verify:
--
--   dependency order
--   SQL syntax
--   trigger interaction
--   RLS coverage
--   permission coverage
--   SECURITY DEFINER exposure
--   composite foreign keys
--   lifecycle consistency
--   historical immutability
--   V1 schema completeness
--
-- Only after the audit passes should these migrations be run
-- against Supabase.
--
-- ============================================================
