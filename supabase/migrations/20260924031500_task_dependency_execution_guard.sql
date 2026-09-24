-- ============================================================
-- Job Search AI Agent
-- Migration 020: Task Dependency Execution Guard
-- ============================================================
--
-- Workflow testing found that dependency cycles were prevented,
-- but a dependent Task could still enter running state before a
-- prerequisite was satisfied.
--
-- This migration makes Task Dependencies operational, not only
-- descriptive.
--
-- Dependency semantics:
--
--   informational
--       Does not block execution.
--
--   must_succeed
--       Predecessor must be completed successfully.
--
--   must_complete
--       Predecessor must be finished before execution continues.
--       Satisfied by:
--         completed
--         cancelled
--         failed with all attempts exhausted
--
-- A retryable failed predecessor therefore continues to block.
-- ============================================================

create or replace function private.assert_task_dependencies_satisfied()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    blocking_dependency record;
begin

    if old.status is distinct from new.status
       and new.status = 'running' then

        select
            td.dependency_type,
            predecessor.id as predecessor_task_id,
            predecessor.status as predecessor_status,
            predecessor.attempt_count,
            predecessor.max_attempts
        into blocking_dependency
        from public.task_dependencies td
        join public.internal_tasks predecessor
          on predecessor.workspace_id = td.workspace_id
         and predecessor.id = td.depends_on_task_id
        where td.workspace_id = new.workspace_id
          and td.task_id = new.id
          and td.dependency_type <> 'informational'
          and (
                (
                    td.dependency_type = 'must_succeed'
                    and predecessor.status <> 'completed'
                )
                or
                (
                    td.dependency_type = 'must_complete'
                    and not (
                        predecessor.status in (
                            'completed',
                            'cancelled'
                        )
                        or (
                            predecessor.status = 'failed'
                            and predecessor.attempt_count
                                >= predecessor.max_attempts
                        )
                    )
                )
          )
        order by td.created_at
        limit 1;


        if found then
            raise exception
                'Internal Task dependency is not satisfied: prerequisite % is % for dependency type %',
                blocking_dependency.predecessor_task_id,
                blocking_dependency.predecessor_status,
                blocking_dependency.dependency_type;
        end if;

    end if;


    return new;

end;
$$;


revoke all on function
    private.assert_task_dependencies_satisfied()
from public;

revoke all on function
    private.assert_task_dependencies_satisfied()
from anon;

revoke all on function
    private.assert_task_dependencies_satisfied()
from authenticated;


create trigger enforce_task_dependencies_before_running
before update of status
on public.internal_tasks
for each row
execute function private.assert_task_dependencies_satisfied();


-- ============================================================
-- MIGRATION 020 COMPLETE
-- ============================================================
