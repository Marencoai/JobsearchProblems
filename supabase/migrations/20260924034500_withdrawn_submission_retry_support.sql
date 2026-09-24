-- ============================================================
-- Job Search AI Agent
-- Migration 022: Withdrawn Submission Retry Support
-- ============================================================
--
-- Deployment testing found a mismatch in the intended retry
-- model:
--
--   1. A Package may be reused after a withdrawn Application.
--   2. A successful submission marks its approved current
--      Materials as submitted.
--   3. After that Application is withdrawn, a new attempt could
--      be created, but it could not reach submitted because the
--      Package no longer contained status = approved Materials.
--
-- Submitted Material versions are immutable historical content
-- and are still valid exact Package selections. A retry using an
-- unchanged approved Package may therefore reuse current
-- Materials whose status is already submitted.
--
-- This does NOT reopen or edit those Material versions.
-- It only permits the same exact versions to be snapshotted for
-- a later submission attempt.
-- ============================================================

create or replace function private.enforce_application_lifecycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    actor_id uuid;

    may_submit boolean;
    may_confirm boolean;

    eligible_current_material_count integer;
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
            into eligible_current_material_count
            from public.application_materials
            where workspace_id = new.workspace_id
              and application_package_id =
                  new.application_package_id
              and status in (
                  'approved',
                  'submitted'
              )
              and is_current_package_version = true;


            if eligible_current_material_count = 0 then
                raise exception
                    'Approved Package must contain at least one eligible current Material before submission';
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

revoke all on function private.enforce_application_lifecycle()
from public;

revoke all on function private.enforce_application_lifecycle()
from anon;

revoke all on function private.enforce_application_lifecycle()
from authenticated;


create or replace function private.snapshot_materials_after_application_submit()
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
          and am.status in (
              'approved',
              'submitted'
          )
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

revoke all on function private.snapshot_materials_after_application_submit()
from public;

revoke all on function private.snapshot_materials_after_application_submit()
from anon;

revoke all on function private.snapshot_materials_after_application_submit()
from authenticated;

-- ============================================================
-- MIGRATION 022 COMPLETE
-- ============================================================
