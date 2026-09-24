-- ============================================================
-- Job Search AI Agent
-- Migration 011: Workflow RLS and Lifecycle Controls
-- ============================================================
--
-- Protects:
--   activity_events
--   activity_event_links
--   activity_replies
--   internal_tasks
--   task_dependencies
--   task_attempts
--   next_actions
--
-- Adds:
--   Workspace Principal validation helpers
--   Append-only Activity Events
--   Activity actor validation
--   Activity Reply authorship
--   Activity Event Link validation
--   Internal Task lifecycle controls
--   Task owner validation
--   Task dependency cycle prevention
--   Automatic Task Attempt numbering
--   Task Attempt lifecycle protection
--   Next Action assignment validation
--   Next Action lifecycle controls
--   Workflow RLS policies
--
-- ============================================================


-- ============================================================
-- 1. WORKSPACE PRINCIPAL HELPERS
-- ============================================================
--
-- We already know:
--
-- "Is the current Principal a member of this Workspace?"
--
-- We also need to ask:
--
-- "Is THIS Principal an active member of this Workspace?"
--
-- This matters for:
--
-- Task ownership
-- Next Action assignment
-- Activity authors
-- Agent coordination
--
-- ============================================================

create or replace function public.is_active_workspace_principal(
    target_workspace_id uuid,
    target_principal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_memberships wm
        join public.principals p
          on p.id = wm.principal_id
        where wm.workspace_id = target_workspace_id
          and wm.principal_id = target_principal_id
          and wm.status = 'active'
          and p.status = 'active'
    );
$$;


create or replace function public.is_active_workspace_human(
    target_workspace_id uuid,
    target_principal_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1
        from public.workspace_memberships wm
        join public.principals p
          on p.id = wm.principal_id
        where wm.workspace_id = target_workspace_id
          and wm.principal_id = target_principal_id
          and wm.status = 'active'
          and p.status = 'active'
          and p.principal_type = 'human'
    );
$$;


revoke all on function
    public.is_active_workspace_principal(uuid, uuid)
from public;

revoke all on function
    public.is_active_workspace_human(uuid, uuid)
from public;


grant execute on function
    public.is_active_workspace_principal(uuid, uuid)
to authenticated;

grant execute on function
    public.is_active_workspace_human(uuid, uuid)
to authenticated;


-- ============================================================
-- 2. ACTIVITY EVENTS ARE APPEND-ONLY
-- ============================================================
--
-- Activity Events answer:
--
-- "What happened?"
--
-- Once an Event exists, history should not silently change.
--
-- If something was recorded incorrectly, the preferred pattern
-- is to create a correction Event.
--
-- ============================================================

create or replace function public.prevent_activity_event_mutation()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    raise exception
        'Activity Events are append-only historical records';

end;
$$;


create trigger prevent_activity_event_update
before update
on public.activity_events
for each row
execute function public.prevent_activity_event_mutation();


create trigger prevent_activity_event_delete
before delete
on public.activity_events
for each row
execute function public.prevent_activity_event_mutation();


-- ============================================================
-- 3. ACTIVITY EVENT ACTOR VALIDATION
-- ============================================================
--
-- actor_principal_id may be null for an external actor.
--
-- Example:
--
-- Recruiter sent email
--
-- Recruiter is not necessarily a Principal.
--
-- But if actor_principal_id IS provided, that Principal must
-- belong to the same Workspace.
--
-- ============================================================

create or replace function public.validate_activity_event_actor()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if new.actor_principal_id is not null
       and not public.is_active_workspace_principal(
           new.workspace_id,
           new.actor_principal_id
       ) then

        raise exception
            'Activity Event actor must be an active Principal in the same Workspace';

    end if;

    return new;

end;
$$;


create trigger validate_activity_event_actor_before_insert
before insert
on public.activity_events
for each row
execute function public.validate_activity_event_actor();


-- ============================================================
-- 4. ACTIVITY REPLY AUTHORSHIP
-- ============================================================
--
-- A reply belongs to the authenticated Principal actually
-- writing it.
--
-- The caller does not get to claim:
--
-- author_principal_id = someone_else
--
-- ============================================================

create or replace function public.enforce_activity_reply_author()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    actor_id uuid;
begin

    actor_id := public.current_principal_id();

    if actor_id is null then
        raise exception
            'Authenticated Principal required to write an Activity Reply';
    end if;


    if tg_op = 'INSERT' then

        if not public.is_active_workspace_principal(
            new.workspace_id,
            actor_id
        ) then

            raise exception
                'Reply author is not an active member of this Workspace';

        end if;

        new.author_principal_id := actor_id;

        return new;

    end if;


    if tg_op = 'UPDATE' then

        if old.author_principal_id <> actor_id then
            raise exception
                'Only the original reply author may edit this reply';
        end if;

        if new.id <> old.id then
            raise exception
                'Activity Reply id is immutable';
        end if;

        new.author_principal_id := old.author_principal_id;
        new.created_at := old.created_at;

        return new;

    end if;


    return new;

end;
$$;


create trigger enforce_activity_reply_author_before_write
before insert or update
on public.activity_replies
for each row
execute function public.enforce_activity_reply_author();


-- ============================================================
-- 5. ACTIVITY EVENT LINK VALIDATION
-- ============================================================
--
-- activity_event_links is intentionally polymorphic.
--
-- That gives us flexibility, but normal foreign keys cannot
-- automatically verify entity_id.
--
-- This trigger validates the currently supported entity types
-- and ensures the referenced record belongs to the same
-- Workspace.
--
-- Future domain migrations may extend this function.
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


create trigger validate_activity_event_link_before_insert
before insert
on public.activity_event_links
for each row
execute function public.validate_activity_event_link();


-- ============================================================
-- 6. INTERNAL TASK OWNER VALIDATION
-- ============================================================

create or replace function public.validate_internal_task_owner()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if tg_op = 'INSERT'
       or old.owner_principal_id
          is distinct from new.owner_principal_id then

        if new.owner_principal_id is not null
           and not public.is_active_workspace_principal(
               new.workspace_id,
               new.owner_principal_id
           ) then

            raise exception
                'Internal Task owner must be an active Principal in the same Workspace';

        end if;

    end if;

    return new;

end;
$$;


create trigger validate_internal_task_owner_before_write
before insert or update of owner_principal_id
on public.internal_tasks
for each row
execute function public.validate_internal_task_owner();


-- ============================================================
-- 7. INTERNAL TASK LIFECYCLE
-- ============================================================
--
-- Internal Tasks are mutable workflow state.
--
-- But transitions should still be controlled.
--
-- Terminal:
--
--   completed
--   cancelled
--
-- Failed Tasks may be retried.
--
-- ============================================================

alter table public.internal_tasks
add constraint internal_tasks_attempt_limit_valid
check (
    attempt_count <= max_attempts
);


create or replace function public.enforce_internal_task_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_update boolean;
    may_execute boolean;

    old_protected_state jsonb;
    new_protected_state jsonb;
begin

    may_update :=
        public.has_permission(
            new.workspace_id,
            'internal_task.update'
        );

    may_execute :=
        public.has_permission(
            new.workspace_id,
            'internal_task.execute'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if new.status not in (
            'pending',
            'ready',
            'waiting',
            'blocked'
        ) then

            raise exception
                'New Internal Tasks must begin in pending, ready, waiting, or blocked status';

        end if;


        if new.status = 'waiting'
           and new.not_before is null
           and nullif(btrim(new.waiting_condition), '') is null then

            raise exception
                'Waiting Tasks require a waiting condition or not_before time';

        end if;


        new.completed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- UPDATE
    -- --------------------------------------------------------

    if not may_update
       and not may_execute then

        raise exception
            'Internal Task update or execute permission is required';

    end if;


    -- Immutable identity / audit origin.

    if new.id <> old.id then
        raise exception
            'Internal Task id is immutable';
    end if;

    if new.created_at <> old.created_at then
        raise exception
            'Internal Task created_at is immutable';
    end if;

    if new.created_by_principal_id
       is distinct from old.created_by_principal_id then

        raise exception
            'Internal Task creator is immutable';

    end if;


    -- Completed / cancelled Tasks are terminal.

    if old.status in (
        'completed',
        'cancelled'
    ) then

        raise exception
            'Completed or cancelled Internal Tasks are immutable';

    end if;


    -- --------------------------------------------------------
    -- Execute-only Principals may update execution state but
    -- may not redesign the Task.
    -- --------------------------------------------------------

    if may_execute
       and not may_update then

        old_protected_state :=
            to_jsonb(old)
            - array[
                'status',
                'attempt_count',
                'last_attempt_at',
                'completed_at',
                'result_summary',
                'not_before',
                'waiting_condition',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_protected_state :=
            to_jsonb(new)
            - array[
                'status',
                'attempt_count',
                'last_attempt_at',
                'completed_at',
                'result_summary',
                'not_before',
                'waiting_condition',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_protected_state
           is distinct from new_protected_state then

            raise exception
                'internal_task.execute may change execution state only';

        end if;

    end if;


    -- --------------------------------------------------------
    -- Status transitions
    -- --------------------------------------------------------

    if old.status is distinct from new.status then

        case old.status

            when 'pending' then

                if new.status not in (
                    'ready',
                    'running',
                    'waiting',
                    'blocked',
                    'completed',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: pending → %',
                        new.status;

                end if;


            when 'ready' then

                if new.status not in (
                    'running',
                    'waiting',
                    'blocked',
                    'completed',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: ready → %',
                        new.status;

                end if;


            when 'running' then

                if new.status not in (
                    'waiting',
                    'blocked',
                    'completed',
                    'failed',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: running → %',
                        new.status;

                end if;


            when 'waiting' then

                if new.status not in (
                    'ready',
                    'running',
                    'blocked',
                    'completed',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: waiting → %',
                        new.status;

                end if;


            when 'blocked' then

                if new.status not in (
                    'ready',
                    'running',
                    'completed',
                    'failed',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: blocked → %',
                        new.status;

                end if;


            when 'failed' then

                if new.status not in (
                    'ready',
                    'running',
                    'cancelled'
                ) then

                    raise exception
                        'Invalid Internal Task transition: failed → %',
                        new.status;

                end if;

        end case;

    end if;


    -- --------------------------------------------------------
    -- Waiting-state integrity
    -- --------------------------------------------------------

    if new.status = 'waiting'
       and new.not_before is null
       and nullif(btrim(new.waiting_condition), '') is null then

        raise exception
            'Waiting Tasks require a waiting condition or not_before time';

    end if;


    -- --------------------------------------------------------
    -- Completion timestamp
    -- --------------------------------------------------------

    if new.status in (
        'completed',
        'cancelled'
    ) then

        if new.completed_at is null then
            new.completed_at := now();
        end if;

    else

        new.completed_at := null;

    end if;


    return new;

end;
$$;


create trigger enforce_internal_task_lifecycle_before_write
before insert or update
on public.internal_tasks
for each row
execute function public.enforce_internal_task_lifecycle();


-- ============================================================
-- 8. TASK DEPENDENCY CYCLE PREVENTION
-- ============================================================
--
-- Invalid:
--
-- Task A depends on Task B
-- Task B depends on Task C
-- Task C depends on Task A
--
-- That would create an infinite dependency loop.
--
-- ============================================================

create or replace function public.prevent_task_dependency_cycle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    creates_cycle boolean;
begin

    if new.task_id = new.depends_on_task_id then
        raise exception
            'A Task cannot depend on itself';
    end if;


    with recursive dependency_chain as (

        select
            td.depends_on_task_id

        from public.task_dependencies td

        where td.workspace_id = new.workspace_id
          and td.task_id = new.depends_on_task_id


        union


        select
            td.depends_on_task_id

        from public.task_dependencies td

        join dependency_chain dc
          on td.task_id = dc.depends_on_task_id

        where td.workspace_id = new.workspace_id
    )

    select exists (
        select 1
        from dependency_chain
        where depends_on_task_id = new.task_id
    )
    into creates_cycle;


    if creates_cycle then
        raise exception
            'Task dependency would create a cycle';
    end if;


    return new;

end;
$$;


revoke all on function public.prevent_task_dependency_cycle()
from public;


create trigger prevent_task_dependency_cycle_before_insert
before insert
on public.task_dependencies
for each row
execute function public.prevent_task_dependency_cycle();


-- ============================================================
-- 9. TASK ATTEMPT PREPARATION
-- ============================================================
--
-- The database assigns:
--
-- attempt_number
-- executed_by_principal_id
--
-- and updates:
--
-- Internal Task attempt_count
-- Internal Task last_attempt_at
-- Internal Task status
--
-- The caller does not manually maintain those fields.
--
-- ============================================================

create or replace function public.prepare_task_attempt_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    task_record public.internal_tasks%rowtype;
    actor_id uuid;
begin

    if not public.has_permission(
        new.workspace_id,
        'internal_task.execute'
    ) then

        raise exception
            'Permission internal_task.execute is required';

    end if;


    actor_id := public.current_principal_id();

    if actor_id is null then
        raise exception
            'Authenticated Principal required to execute a Task';
    end if;


    select *
    into task_record
    from public.internal_tasks
    where workspace_id = new.workspace_id
      and id = new.internal_task_id
    for update;


    if not found then
        raise exception
            'Internal Task does not exist in this Workspace';
    end if;


    if task_record.status not in (
        'pending',
        'ready',
        'failed'
    ) then

        raise exception
            'Internal Task must be pending, ready, or failed before starting a new attempt';

    end if;


    if task_record.attempt_count
       >= task_record.max_attempts then

        raise exception
            'Internal Task has reached its maximum attempt count';

    end if;


    new.attempt_number :=
        task_record.attempt_count + 1;

    new.executed_by_principal_id :=
        actor_id;

    new.status := 'running';

    new.started_at :=
        coalesce(
            new.started_at,
            now()
        );

    new.completed_at := null;


    update public.internal_tasks
    set
        attempt_count = new.attempt_number,
        last_attempt_at = new.started_at,
        status = 'running',
        updated_by_principal_id = actor_id
    where workspace_id = new.workspace_id
      and id = new.internal_task_id;


    return new;

end;
$$;


revoke all on function public.prepare_task_attempt_insert()
from public;


create trigger prepare_task_attempt_before_insert
before insert
on public.task_attempts
for each row
execute function public.prepare_task_attempt_insert();


-- ============================================================
-- 10. TASK ATTEMPT LIFECYCLE
-- ============================================================

alter table public.task_attempts
add constraint task_attempts_time_valid
check (
    completed_at is null
    or completed_at >= started_at
);


create or replace function public.enforce_task_attempt_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if old.status in (
        'succeeded',
        'failed',
        'cancelled'
    ) then

        raise exception
            'Finalized Task Attempts are immutable';

    end if;


    if new.id <> old.id
       or new.internal_task_id <> old.internal_task_id
       or new.attempt_number <> old.attempt_number
       or new.executed_by_principal_id
          is distinct from old.executed_by_principal_id
       or new.started_at <> old.started_at
       or new.created_at <> old.created_at then

        raise exception
            'Task Attempt identity and execution origin are immutable';

    end if;


    if new.status not in (
        'running',
        'succeeded',
        'failed',
        'cancelled'
    ) then

        raise exception
            'Invalid Task Attempt status';

    end if;


    if new.status in (
        'succeeded',
        'failed',
        'cancelled'
    ) then

        if new.completed_at is null then
            new.completed_at := now();
        end if;

    else

        new.completed_at := null;

    end if;


    return new;

end;
$$;


create trigger enforce_task_attempt_lifecycle_before_update
before update
on public.task_attempts
for each row
execute function public.enforce_task_attempt_lifecycle();


-- ============================================================
-- 11. SYNC FINALIZED TASK ATTEMPTS TO PARENT TASK
-- ============================================================
--
-- A Task Attempt is execution history.
--
-- The parent Internal Task is current workflow state.
--
-- Finalizing an Attempt should therefore update the parent Task
-- in the same transaction so the two records cannot drift.
--
-- succeeded
--      ↓
-- Internal Task = completed
--
-- failed / cancelled attempt
--      ↓
-- Internal Task = failed
--
-- A failed Task may later be moved back to ready/running for a
-- retry while attempt history remains preserved.
-- ============================================================

create or replace function public.sync_task_from_finalized_attempt()
returns trigger
language plpgsql
security definer
set search_path = public
as $
declare
    task_result text;
begin

    if old.status = 'running'
       and new.status in (
           'succeeded',
           'failed',
           'cancelled'
       ) then

        if new.status = 'succeeded' then

            task_result :=
                coalesce(
                    new.result_summary,
                    'Task attempt succeeded'
                );

            update public.internal_tasks
            set
                status = 'completed',
                result_summary = task_result,
                updated_by_principal_id =
                    public.current_principal_id()
            where workspace_id = new.workspace_id
              and id = new.internal_task_id
              and status = 'running';


        else

            task_result :=
                coalesce(
                    new.result_summary,
                    new.error_message,
                    case
                        when new.status = 'cancelled'
                            then 'Task attempt cancelled'
                        else 'Task attempt failed'
                    end
                );

            update public.internal_tasks
            set
                status = 'failed',
                result_summary = task_result,
                updated_by_principal_id =
                    public.current_principal_id()
            where workspace_id = new.workspace_id
              and id = new.internal_task_id
              and status = 'running';

        end if;

    end if;


    return new;

end;
$;


revoke all on function
    public.sync_task_from_finalized_attempt()
from public;


create trigger sync_task_from_finalized_attempt_after_update
after update of status
on public.task_attempts
for each row
execute function public.sync_task_from_finalized_attempt();


-- ============================================================
-- 12. NEXT ACTION ASSIGNMENT VALIDATION
-- ============================================================
--
-- Next Actions are human-facing.
--
-- Therefore, when an assignee is provided, the Principal must:
--
--   belong to the Workspace
--   be active
--   be a human Principal
--
-- ============================================================

create or replace function public.validate_next_action_assignee()
returns trigger
language plpgsql
set search_path = public
as $$
begin

    if tg_op = 'INSERT'
       or old.assigned_to_principal_id
          is distinct from new.assigned_to_principal_id then

        if new.assigned_to_principal_id is not null
           and not public.is_active_workspace_human(
               new.workspace_id,
               new.assigned_to_principal_id
           ) then

            raise exception
                'Next Action assignee must be an active human Principal in the same Workspace';

        end if;

    end if;


    return new;

end;
$$;


create trigger validate_next_action_assignee_before_write
before insert or update of assigned_to_principal_id
on public.next_actions
for each row
execute function public.validate_next_action_assignee();


-- ============================================================
-- 13. NEXT ACTION LIFECYCLE
-- ============================================================
--
-- New Next Actions begin:
--
--   open
--
-- Open Actions may become:
--
--   completed
--   dismissed
--   superseded
--
-- Those states are historical and terminal.
--
-- ============================================================

create or replace function public.enforce_next_action_lifecycle()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_update boolean;
    may_complete boolean;

    old_protected_state jsonb;
    new_protected_state jsonb;
begin

    may_update :=
        public.has_permission(
            new.workspace_id,
            'next_action.update'
        );

    may_complete :=
        public.has_permission(
            new.workspace_id,
            'next_action.complete'
        );


    -- --------------------------------------------------------
    -- INSERT
    -- --------------------------------------------------------

    if tg_op = 'INSERT' then

        if new.status <> 'open' then
            raise exception
                'New Next Actions must begin in open status';
        end if;

        new.completed_at := null;

        return new;

    end if;


    -- --------------------------------------------------------
    -- UPDATE
    -- --------------------------------------------------------

    if not may_update
       and not may_complete then

        raise exception
            'Next Action update or complete permission is required';

    end if;


    if new.id <> old.id then
        raise exception
            'Next Action id is immutable';
    end if;

    if new.created_at <> old.created_at then
        raise exception
            'Next Action created_at is immutable';
    end if;

    if new.created_by_principal_id
       is distinct from old.created_by_principal_id then

        raise exception
            'Next Action creator is immutable';
    end if;


    if old.status in (
        'completed',
        'dismissed',
        'superseded'
    ) then

        raise exception
            'Completed, dismissed, or superseded Next Actions are immutable';

    end if;


    -- --------------------------------------------------------
    -- Complete-only authority may mark an Action completed,
    -- but may not rewrite its description or priority.
    -- --------------------------------------------------------

    if may_complete
       and not may_update then

        old_protected_state :=
            to_jsonb(old)
            - array[
                'status',
                'completed_at',
                'updated_at',
                'updated_by_principal_id'
            ];


        new_protected_state :=
            to_jsonb(new)
            - array[
                'status',
                'completed_at',
                'updated_at',
                'updated_by_principal_id'
            ];


        if old_protected_state
           is distinct from new_protected_state then

            raise exception
                'next_action.complete may complete the Action only';

        end if;

    end if;


    -- --------------------------------------------------------
    -- Status transition authorization
    -- --------------------------------------------------------

    if old.status is distinct from new.status then

        if new.status = 'completed' then

            if not may_complete then
                raise exception
                    'Permission next_action.complete is required';
            end if;


        elsif new.status in (
            'dismissed',
            'superseded'
        ) then

            if not may_update then
                raise exception
                    'Permission next_action.update is required';
            end if;


        else

            raise exception
                'Invalid Next Action transition: open → %',
                new.status;

        end if;

    end if;


    if new.status = 'completed' then

        if new.completed_at is null then
            new.completed_at := now();
        end if;

    else

        new.completed_at := null;

    end if;


    return new;

end;
$$;


create trigger enforce_next_action_lifecycle_before_write
before insert or update
on public.next_actions
for each row
execute function public.enforce_next_action_lifecycle();


-- ============================================================
-- 14. ENABLE WORKFLOW RLS
-- ============================================================

alter table public.activity_events
enable row level security;

alter table public.activity_event_links
enable row level security;

alter table public.activity_replies
enable row level security;

alter table public.internal_tasks
enable row level security;

alter table public.task_dependencies
enable row level security;

alter table public.task_attempts
enable row level security;

alter table public.next_actions
enable row level security;


-- ============================================================
-- 15. ACTIVITY EVENT POLICIES
-- ============================================================

create policy "authorized principals can view activity events"
on public.activity_events
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'activity.read'
    )
);


create policy "authorized principals can create activity events"
on public.activity_events
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'activity.create'
    )
);


-- No UPDATE policy.
-- No DELETE policy.
--
-- Activity Events are append-only.


-- ============================================================
-- 16. ACTIVITY EVENT LINK POLICIES
-- ============================================================

create policy "authorized principals can view activity event links"
on public.activity_event_links
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'activity.read'
    )
);


create policy "authorized principals can create activity event links"
on public.activity_event_links
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'activity.create'
    )
);


-- ============================================================
-- 17. ACTIVITY REPLY POLICIES
-- ============================================================

create policy "authorized principals can view activity replies"
on public.activity_replies
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'activity.read'
    )
);


create policy "authorized principals can create activity replies"
on public.activity_replies
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'activity.reply'
    )
);


create policy "authors can edit their activity replies"
on public.activity_replies
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'activity.reply'
    )
    and author_principal_id =
        public.current_principal_id()
)
with check (
    public.has_permission(
        workspace_id,
        'activity.reply'
    )
    and author_principal_id =
        public.current_principal_id()
);


-- No normal DELETE policy.


-- ============================================================
-- 18. INTERNAL TASK POLICIES
-- ============================================================

create policy "authorized principals can view internal tasks"
on public.internal_tasks
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.read'
    )
);


create policy "authorized principals can create internal tasks"
on public.internal_tasks
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'internal_task.create'
    )
);


create policy "authorized principals can update or execute internal tasks"
on public.internal_tasks
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.update'
    )
    or
    public.has_permission(
        workspace_id,
        'internal_task.execute'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'internal_task.update'
    )
    or
    public.has_permission(
        workspace_id,
        'internal_task.execute'
    )
);


-- No normal DELETE policy.


-- ============================================================
-- 19. TASK DEPENDENCY POLICIES
-- ============================================================

create policy "authorized principals can view task dependencies"
on public.task_dependencies
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.read'
    )
);


create policy "authorized principals can create task dependencies"
on public.task_dependencies
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'internal_task.create'
    )
    or
    public.has_permission(
        workspace_id,
        'internal_task.update'
    )
);


create policy "authorized principals can remove task dependencies"
on public.task_dependencies
for delete
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.update'
    )
);


-- Dependency changes use delete + insert rather than UPDATE.


-- ============================================================
-- 20. TASK ATTEMPT POLICIES
-- ============================================================

create policy "authorized principals can view task attempts"
on public.task_attempts
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.read'
    )
);


create policy "authorized principals can create task attempts"
on public.task_attempts
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'internal_task.execute'
    )
);


create policy "authorized principals can finalize task attempts"
on public.task_attempts
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'internal_task.execute'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'internal_task.execute'
    )
);


-- No DELETE policy.


-- ============================================================
-- 21. NEXT ACTION POLICIES
-- ============================================================

create policy "authorized principals can view next actions"
on public.next_actions
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'next_action.read'
    )
);


create policy "authorized principals can create next actions"
on public.next_actions
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'next_action.create'
    )
);


create policy "authorized principals can update or complete next actions"
on public.next_actions
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'next_action.update'
    )
    or
    public.has_permission(
        workspace_id,
        'next_action.complete'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'next_action.update'
    )
    or
    public.has_permission(
        workspace_id,
        'next_action.complete'
    )
);


-- No normal DELETE policy.


-- ============================================================
-- 22. WORKFLOW SECURITY EXAMPLE
-- ============================================================
--
-- Future Evaluation Agent:
--
-- permissions:
--
--   activity.create
--   internal_task.read
--   internal_task.execute
--   next_action.create
--
--
-- It may:
--
--   record meaningful Evaluation activity
--   execute Evaluation Tasks
--   surface a question to Diana
--
--
-- It does NOT automatically receive:
--
--   outreach.send
--   application.submit
--
-- Those are separate domains and permissions.
--
-- ============================================================


-- ============================================================
-- 23. WORKFLOW MODEL RECAP
-- ============================================================
--
-- Activity Event
--
--   Historical:
--   "What happened?"
--
--
-- Activity Reply
--
--   Contextual:
--   "What are we saying about this Event?"
--
--
-- Internal Task
--
--   Operational:
--   "What does the machine need to do?"
--
--
-- Task Attempt
--
--   Execution history:
--   "What happened when it tried?"
--
--
-- Next Action
--
--   Human attention:
--   "What does the person need to do?"
--
--
-- ============================================================


-- ============================================================
-- MIGRATION 011 COMPLETE
-- ============================================================
--
-- Workflow now has:
--
--   Workspace RLS
--   Append-only Activity Events
--   Authenticated Reply authorship
--   Workspace-valid actors
--   Workspace-valid Task owners
--   Dependency cycle protection
--   Controlled Task lifecycle
--   Automatic execution-attempt numbering
--   Immutable finalized Task Attempts
--   Human-only Next Action assignment
--   Controlled Next Action lifecycle
--
--
-- NEXT:
--
-- Daily Work Queue Foundation
--
--   daily_plans
--   work_blocks
--   daily_plan_items
--
-- including:
--
--   Today's One Thing
--   Work Blocks
--   historical queue snapshots
--   daily grade
--
-- ============================================================
