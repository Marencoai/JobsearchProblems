-- ============================================================
-- Job Search AI Agent
-- Migration 021: Daily Plan Completion Reconciliation Guard
-- ============================================================
--
-- Deployment testing found that an active Daily Plan could be
-- marked completed while child Work Blocks were still planned /
-- active and Daily Plan Items were still pending.
--
-- Because completed Daily Plans and their children are historical
-- and immutable, that would permanently preserve an internally
-- unfinished plan.
--
-- Completion now requires:
--
--   Work Blocks:
--     completed | skipped
--
--   Daily Plan Items:
--     completed | carried_forward | removed
--
-- A Daily Plan without Work Blocks remains valid as long as all
-- of its Plan Items have a finalized outcome.
-- ============================================================

create or replace function private.require_reconciled_daily_plan_completion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin

    if old.status = 'active'
       and new.status = 'completed' then

        if exists (
            select 1
            from public.work_blocks wb
            where wb.workspace_id = new.workspace_id
              and wb.daily_plan_id = new.id
              and wb.status not in (
                  'completed',
                  'skipped'
              )
        ) then

            raise exception
                'Daily Plan cannot be completed while Work Blocks remain planned or active';

        end if;


        if exists (
            select 1
            from public.daily_plan_items dpi
            where dpi.workspace_id = new.workspace_id
              and dpi.daily_plan_id = new.id
              and dpi.completion_status = 'pending'
        ) then

            raise exception
                'Daily Plan cannot be completed while Plan Items remain pending';

        end if;

    end if;


    return new;

end;
$$;


revoke all on function
    private.require_reconciled_daily_plan_completion()
from public;

revoke all on function
    private.require_reconciled_daily_plan_completion()
from anon;

revoke all on function
    private.require_reconciled_daily_plan_completion()
from authenticated;


create trigger enforce_daily_plan_completion_children_before_update
before update of status
on public.daily_plans
for each row
execute function private.require_reconciled_daily_plan_completion();


-- ============================================================
-- MIGRATION 021 COMPLETE
-- ============================================================
