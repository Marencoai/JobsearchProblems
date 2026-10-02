-- PROPOSED / NOT APPLIED. Existing database/worker hardening only.
-- No permission definitions, role memberships, backfill, Storage or flags.
begin;

alter table public.application_packages add column hq_preparation_task_id uuid null;
alter table public.application_packages add constraint hq_preparation_task_workspace_fk
  foreign key(workspace_id,hq_preparation_task_id) references public.internal_tasks(workspace_id,id) on delete restrict;
create unique index hq_preparation_task_one_package on public.application_packages(workspace_id,hq_preparation_task_id)
  where hq_preparation_task_id is not null;
alter table public.application_packages add constraint hq_package_task_binding_unique
  unique(workspace_id,id,hq_preparation_task_id);
alter table public.application_materials add column hq_preparation_task_id uuid null;
alter table public.application_materials add constraint hq_material_exact_task_package_fk
  foreign key(workspace_id,application_package_id,hq_preparation_task_id)
  references public.application_packages(workspace_id,id,hq_preparation_task_id) on delete restrict;
comment on column public.application_packages.hq_preparation_task_id is
  'Immutable scoped preparation handoff. New HQ revisions bind atomically; legacy initial packages remain unclassified until Owner handoff.';

-- Existing authority, never a planner-supplied candidate ID. Multi-Owner
-- workspaces require explicit classification rather than arbitrary selection.
create function private.hq_workspace_candidate(w uuid) returns uuid
language plpgsql stable security definer set search_path='' as $$
declare ids uuid[];
begin
  if not public.is_active_workspace_principal(w,public.current_principal_id())
     or not public.has_permission(w,'workspace.read')
     or not exists(select 1 from public.workspaces where id=w and status='active') then
    raise exception using errcode='42501',message='Active workspace authority required';
  end if;
  select array_agg(p.id order by p.id) into ids
    from public.workspace_memberships m join public.principals p on p.id=m.principal_id
    join public.roles r on r.id=m.role_id
    where m.workspace_id=w and m.status='active' and p.status='active'
      and p.principal_type='human' and r.workspace_id is null and lower(r.name)='owner';
  if coalesce(cardinality(ids),0)<>1 then
    raise exception 'Workspace candidate authority is ambiguous';
  end if;
  return ids[1];
end; $$;
revoke all on function private.hq_workspace_candidate(uuid) from public,anon,authenticated;

create function private.hq_assert_action_eligible(w uuid,a uuid) returns void
language plpgsql security definer set search_path='' as $$
declare candidate uuid; action public.next_actions%rowtype;
begin
  candidate:=private.hq_workspace_candidate(w);
  if not public.has_permission(w,'next_action.read') then
    raise exception using errcode='42501',message='Next Action read authority required';
  end if;
  select * into action from public.next_actions where workspace_id=w and id=a for share;
  if not found or action.status<>'open'
     or (action.assigned_to_principal_id is not null and action.assigned_to_principal_id<>candidate)
     or (action.available_after is not null and
       (not isfinite(action.available_after) or action.available_after>clock_timestamp())) then
    raise exception using errcode='40001',message='Next Action is not currently candidate-eligible';
  end if;
end; $$;
revoke all on function private.hq_assert_action_eligible(uuid,uuid) from public,anon,authenticated;

create function private.hq_plan_item_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform private.hq_assert_action_eligible(new.workspace_id,new.next_action_id);
  return new;
end; $$;
revoke all on function private.hq_plan_item_guard() from public,anon,authenticated;
create trigger hq_plan_item_eligibility before insert on public.daily_plan_items
  for each row execute function private.hq_plan_item_guard();

create function private.hq_plan_selection_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare a uuid;
begin
  -- Later deferral does not rewrite history or prohibit completion. Existing
  -- lifecycle guards still enforce historical immutability/completion rules.
  if new.status in ('completed','superseded') then return new; end if;
  if tg_op='UPDATE' and new.todays_one_thing_action_id is not distinct from old.todays_one_thing_action_id
     and not(old.status='draft' and new.status='active') then return new; end if;
  if new.todays_one_thing_action_id is not null then
    perform private.hq_assert_action_eligible(new.workspace_id,new.todays_one_thing_action_id);
  end if;
  if tg_op='UPDATE' and old.status='draft' and new.status='active' then
    for a in select i.next_action_id from public.daily_plan_items i
      where i.workspace_id=new.workspace_id and i.daily_plan_id=new.id order by i.next_action_id loop
      perform private.hq_assert_action_eligible(new.workspace_id,a);
    end loop;
  end if;
  return new;
end; $$;
revoke all on function private.hq_plan_selection_guard() from public,anon,authenticated;
create trigger zz_hq_plan_selection before insert or update of todays_one_thing_action_id,status on public.daily_plans
  for each row execute function private.hq_plan_selection_guard();

-- FOR SHARE on an invoker SELECT also consults UPDATE RLS. Perform only the
-- scoped locks privately so read-only planners do not gain mutation authority
-- or silently lock a smaller set than the public invoker subsequently reads.
create function private.hq_lock_planner_scope(w uuid,p uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare candidate uuid; action_ids uuid[];
begin
  candidate:=private.hq_workspace_candidate(w);
  if not public.has_permission(w,'next_action.read') or not public.has_permission(w,'daily_plan.read') then
    raise exception using errcode='42501',message='Planner read authority required';
  end if;
  if p is not null then
    perform id from public.daily_plans where workspace_id=w and id=p and status='active' for share;
    if not found then raise exception 'Active scoped Plan required'; end if;
  end if;
  -- Capture only rows actually locked by this statement. A later INSERT must
  -- not enter a subsequent invoker read without its own eligibility lock.
  select coalesce(array_agg(q.id order by q.id),'{}'::uuid[]) into action_ids
    from (select id from public.next_actions where workspace_id=w and status='open' order by id for share) q;
  return jsonb_build_object('candidate_principal_id',candidate,'locked_action_ids',action_ids,'checked_at',clock_timestamp());
end; $$;
revoke all on function private.hq_lock_planner_scope(uuid,uuid) from public,anon;
grant execute on function private.hq_lock_planner_scope(uuid,uuid) to authenticated;

create function public.hq_planner_inputs(target_workspace_id uuid,target_plan_id uuid default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare candidate uuid; t timestamptz; result jsonb; plan public.daily_plans%rowtype; snapshot jsonb; action_ids uuid[];
begin
  snapshot:=private.hq_lock_planner_scope(target_workspace_id,target_plan_id);
  candidate:=(snapshot->>'candidate_principal_id')::uuid;
  action_ids:=array(select value::uuid from jsonb_array_elements_text(snapshot->'locked_action_ids'));
  t:=(snapshot->>'checked_at')::timestamptz;
  if target_plan_id is not null then
    select * into plan from public.daily_plans where workspace_id=target_workspace_id and id=target_plan_id and status='active';
    if not found then raise exception 'Active scoped Plan required'; end if;
  end if;
  if exists(select 1 from public.next_actions where workspace_id=target_workspace_id and status='open'
    and id=any(action_ids) and available_after is not null and not isfinite(available_after)) then raise exception 'Invalid deferral timestamp'; end if;
  with eligible as (select id,todays_one_thing_eligible from public.next_actions where workspace_id=target_workspace_id and status='open' and id=any(action_ids)
    and (assigned_to_principal_id is null or assigned_to_principal_id=candidate)
    and (available_after is null or available_after<=t)),
  delivery as (select i.id,i.next_action_id from public.daily_plan_items i join eligible e on e.id=i.next_action_id
    where i.workspace_id=target_workspace_id and i.daily_plan_id=target_plan_id)
  select jsonb_build_object('checked_at',t,'candidate_principal_id',candidate,
    'deduplication_action_ids',coalesce((select jsonb_agg(id order by id) from public.next_actions where workspace_id=target_workspace_id and status='open' and id=any(action_ids)),'[]'::jsonb),
    'eligible_action_ids',coalesce((select jsonb_agg(id order by id) from eligible),'[]'::jsonb),
    'delivery_item_ids',coalesce((select jsonb_agg(id order by id) from delivery),'[]'::jsonb),
    'one_thing_action_id',(select id from eligible where id=plan.todays_one_thing_action_id and todays_one_thing_eligible)) into result;
  return result;
end; $$;
revoke all on function public.hq_planner_inputs(uuid,uuid) from public,anon;
grant execute on function public.hq_planner_inputs(uuid,uuid) to authenticated;

-- Private lookups expose no Task rows or new agent Task permissions. Opportunity
-- fences serialize preparation with the existing human-action revision writer.
-- INSERT takes this fence before the existing Package version advisory lock.
create function private.hq_package_insert_fence() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.is_active_workspace_principal(new.workspace_id,public.current_principal_id())
    or not public.has_permission(new.workspace_id,'application.prepare')
    or not exists(select 1 from public.workspaces where id=new.workspace_id and status='active') then
    raise exception using errcode='42501',message='Preparation authority required'; end if;
  perform id from public.opportunities where workspace_id=new.workspace_id and id=new.opportunity_id for update;
  if not found then raise exception 'Preparation Opportunity unavailable'; end if;
  return new;
end; $$;
revoke all on function private.hq_package_insert_fence() from public,anon,authenticated;
create trigger aaa_hq_package_insert_fence before insert on public.application_packages
  for each row execute function private.hq_package_insert_fence();

create function private.hq_assert_preparation_target(w uuid,o uuid,p uuid,wait_for_fence boolean default false) returns void
language plpgsql security definer set search_path='' as $$
declare pkg public.application_packages%rowtype; task public.internal_tasks%rowtype;
begin
  if not public.is_active_workspace_principal(w,public.current_principal_id()) or not public.has_permission(w,'application.prepare')
     or not exists(select 1 from public.workspaces where id=w and status='active') then
    raise exception using errcode='42501',message='Preparation authority required';
  end if;
  -- Raw UPDATE already owns a row lock before its trigger runs. Never wait
  -- backward for Opportunity: reject contention with 40001 and retry the whole
  -- operation after fresh handoff. INSERT has no prior row/version lock.
  begin
    if wait_for_fence then
      perform id from public.opportunities where workspace_id=w and id=o for update;
    else
      perform id from public.opportunities where workspace_id=w and id=o for update nowait;
    end if;
  exception when lock_not_available then
    raise exception using errcode='40001',message='Preparation changed concurrently; refresh handoff and retry';
  end;
  if not found then raise exception 'Preparation Opportunity unavailable'; end if;
  if not exists(select 1 from public.application_packages where workspace_id=w and opportunity_id=o and hq_preparation_task_id is not null) then return; end if;
  select * into pkg from public.application_packages where workspace_id=w and opportunity_id=o and id=p;
  if not found or pkg.hq_preparation_task_id is null or pkg.status not in ('draft','preparing')
     or exists(select 1 from public.application_packages where workspace_id=w and opportunity_id=o and status<>'archived' and package_number>pkg.package_number) then
    raise exception using errcode='40001',message='Exact current bound preparation target required';
  end if;
  select * into task from public.internal_tasks where workspace_id=w and id=pkg.hq_preparation_task_id for share;
  if not found or task.opportunity_id is distinct from o or task.task_type<>'prepare_application_package' or task.domain<>'application'
     or task.trigger_type is distinct from 'candidate_action' or task.trigger_reference is distinct from 'candidate_decided_to_pursue' or task.status not in ('ready','running') then
    raise exception 'Bound candidate preparation task is unavailable';
  end if;
  if not exists(select 1 from public.opportunities where workspace_id=w and id=o and is_currently_active and opportunity_stage in ('pursuing','interviewing','offer')) then
    raise exception 'Active candidate pursuit required';
  end if;
end; $$;
revoke all on function private.hq_assert_preparation_target(uuid,uuid,uuid,boolean) from public,anon,authenticated;

create function private.hq_package_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare task public.internal_tasks%rowtype; managed boolean;
begin
  if tg_op='UPDATE' and old.hq_preparation_task_id is not null and new.hq_preparation_task_id is distinct from old.hq_preparation_task_id then
    raise exception 'Preparation binding is immutable';
  end if;
  if (tg_op='INSERT' and new.hq_preparation_task_id is not null) or
     (tg_op='UPDATE' and new.hq_preparation_task_id is distinct from old.hq_preparation_task_id) then
    if not public.is_active_workspace_principal(new.workspace_id,public.current_principal_id())
       or not exists(select 1 from public.workspaces where id=new.workspace_id and status='active')
       or not public.has_permission(new.workspace_id,'internal_task.read') or not public.has_permission(new.workspace_id,'internal_task.create')
       or not public.has_permission(new.workspace_id,'application.prepare') then raise exception using errcode='42501',message='Owner handoff authority required'; end if;
    if tg_op='UPDATE' and old.status not in ('draft','preparing') then raise exception 'Only working Packages may receive a binding'; end if;
    begin
      perform id from public.opportunities where workspace_id=new.workspace_id and id=new.opportunity_id
        and is_currently_active and opportunity_stage in ('pursuing','interviewing','offer') for update nowait;
      if not found then raise exception 'Active candidate pursuit required'; end if;
    exception when lock_not_available then
      raise exception using errcode='40001',message='Preparation changed concurrently; refresh handoff and retry';
    end;
    select * into task from public.internal_tasks where workspace_id=new.workspace_id and id=new.hq_preparation_task_id for share;
    if not found or task.opportunity_id is distinct from new.opportunity_id or task.task_type<>'prepare_application_package'
       or task.domain<>'application' or task.trigger_type is distinct from 'candidate_action' or task.trigger_reference is distinct from 'candidate_decided_to_pursue'
       or task.status not in ('ready','running') then raise exception 'Valid candidate task binding required'; end if;
    if exists(select 1 from public.application_packages where workspace_id=new.workspace_id and opportunity_id=new.opportunity_id
      and status<>'archived' and package_number>new.package_number) then raise exception 'Latest Package binding required'; end if;
  end if;
  select exists(select 1 from public.application_packages where workspace_id=new.workspace_id and opportunity_id=new.opportunity_id and hq_preparation_task_id is not null) into managed;
  if tg_op='INSERT' and managed and new.hq_preparation_task_id is null then
    if not public.has_permission(new.workspace_id,'internal_task.read') or not public.has_permission(new.workspace_id,'internal_task.create') then
      raise exception using errcode='42501',message='Unbound managed Package creation is forbidden'; end if;
  end if;
  if tg_op='UPDATE' and new.status in ('preparing','ready_for_review') and new.status is distinct from old.status and managed then
    perform private.hq_assert_preparation_target(new.workspace_id,new.opportunity_id,new.id);
  end if;
  if tg_op='UPDATE' and new.status='archived' and new.status is distinct from old.status and managed
    and not(public.current_principal_is_human() and public.has_permission(new.workspace_id,'application.approve')) then
    perform private.hq_assert_preparation_target(new.workspace_id,new.opportunity_id,new.id);
  end if;
  return new;
end; $$;
revoke all on function private.hq_package_guard() from public,anon,authenticated;
create trigger zz_hq_preparation_package before insert or update on public.application_packages
  for each row execute function private.hq_package_guard();

create function private.hq_material_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare o uuid; binding uuid;
begin
  if tg_op='INSERT' then
    select opportunity_id,hq_preparation_task_id into o,binding from public.application_packages
      where workspace_id=new.workspace_id and id=new.application_package_id;
    if binding is not null and new.hq_preparation_task_id is distinct from binding then
      raise exception 'Exact preparation Task ID must accompany a managed Material write'; end if;
    if new.hq_preparation_task_id is not null and new.hq_preparation_task_id is distinct from binding then
      raise exception 'Material Task and Package binding must match'; end if;
  end if;
  if tg_op='INSERT' or (tg_op='UPDATE' and
    ((old.status in ('draft','candidate_review') and new.status in ('draft','candidate_review')) or
      ((new.is_current_package_version is distinct from old.is_current_package_version or
          (new.status='archived' and old.status in ('draft','candidate_review')))
        and not(new.status in ('archived','rejected') and not new.is_current_package_version
          and public.current_principal_is_human() and public.has_permission(new.workspace_id,'application.approve'))))) then
    select opportunity_id into o from public.application_packages where workspace_id=new.workspace_id and id=new.application_package_id;
    perform private.hq_assert_preparation_target(new.workspace_id,o,new.application_package_id,tg_op='INSERT');
  end if;
  return new;
end; $$;
revoke all on function private.hq_material_guard() from public,anon,authenticated;
create trigger hq_preparation_material before insert or update on public.application_materials
  for each row execute function private.hq_material_guard();

create function private.hq_bound_task_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.application_packages where workspace_id=old.workspace_id and hq_preparation_task_id=old.id)
    and (new.workspace_id,new.id,new.opportunity_id,new.task_type,new.domain,new.trigger_type,new.trigger_reference)
      is distinct from (old.workspace_id,old.id,old.opportunity_id,old.task_type,old.domain,old.trigger_type,old.trigger_reference) then
    raise exception 'Bound preparation task authority is immutable';
  end if;
  return new;
end; $$;
revoke all on function private.hq_bound_task_guard() from public,anon,authenticated;
create trigger hq_bound_task_authority before update on public.internal_tasks
  for each row execute function private.hq_bound_task_guard();

create function public.hq_preparation_target(target_workspace_id uuid,target_task_id uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare task public.internal_tasks%rowtype; pkg public.application_packages%rowtype; initial_o uuid; eval_id uuid;
begin
  if not public.is_active_workspace_principal(target_workspace_id,public.current_principal_id())
    or not exists(select 1 from public.workspaces where id=target_workspace_id and status='active')
    or not public.has_permission(target_workspace_id,'workspace.read') or not public.has_permission(target_workspace_id,'opportunity.read')
    or not public.has_permission(target_workspace_id,'internal_task.read') or not public.has_permission(target_workspace_id,'internal_task.create')
    or not public.has_permission(target_workspace_id,'application.read') or not public.has_permission(target_workspace_id,'application.prepare') then
    raise exception using errcode='42501',message='Owner preparation handoff authority required';
  end if;
  select opportunity_id into initial_o from public.internal_tasks where workspace_id=target_workspace_id and id=target_task_id;
  perform id from public.opportunities where workspace_id=target_workspace_id and id=initial_o and is_currently_active and opportunity_stage in ('pursuing','interviewing','offer') for update;
  if not found then raise exception 'Active pursued Opportunity required'; end if;
  select * into task from public.internal_tasks where workspace_id=target_workspace_id and id=target_task_id for update;
  if not found or task.opportunity_id is distinct from initial_o or task.task_type<>'prepare_application_package' or task.domain<>'application'
    or task.trigger_type is distinct from 'candidate_action' or task.trigger_reference is distinct from 'candidate_decided_to_pursue' or task.status not in ('ready','running','completed') then
    raise exception 'Explicit candidate preparation task required'; end if;
  select * into pkg from public.application_packages where workspace_id=target_workspace_id and hq_preparation_task_id=target_task_id for update;
  if not found then
    if task.status='completed' then return jsonb_build_object('disposition','completed','package_id',null); end if;
    if task.idempotency_key is distinct from 'hq:pursue:'||initial_o::text then
      raise exception 'Unclassified legacy preparation requires reviewed handoff'; end if;
    select * into pkg from public.application_packages where workspace_id=target_workspace_id and opportunity_id=initial_o and status<>'archived' order by package_number desc limit 1 for update;
    if not found then
      if not public.has_permission(target_workspace_id,'evaluation.read') then raise exception using errcode='42501',message='Evaluation read authority required'; end if;
      select id into eval_id from public.evaluations where workspace_id=target_workspace_id and opportunity_id=initial_o and evaluation_status='complete' order by version_number desc limit 1;
      if eval_id is null then raise exception 'Completed Evaluation required'; end if;
      insert into public.application_packages(workspace_id,opportunity_id,evaluation_id) values(target_workspace_id,initial_o,eval_id) returning * into pkg;
    end if;
    if pkg.status in ('draft','preparing') then
      update public.application_packages set hq_preparation_task_id=target_task_id where workspace_id=target_workspace_id and id=pkg.id returning * into pkg;
    end if;
  end if;
  if pkg.opportunity_id is distinct from initial_o or pkg.status='archived'
    or exists(select 1 from public.application_packages where workspace_id=target_workspace_id and opportunity_id=initial_o and status<>'archived' and package_number>pkg.package_number) then
    raise exception using errcode='40001',message='Exact latest preparation target required'; end if;
  if task.status='completed' and pkg.status not in ('ready_for_review','approved') then raise exception 'Completed task has no reviewed result'; end if;
  return jsonb_build_object('package_id',pkg.id,'task_id',task.id,'candidate_notes',pkg.candidate_notes,
    'disposition',case when pkg.status in ('ready_for_review','approved') then 'reuse' else 'prepare' end);
end; $$;
revoke all on function public.hq_preparation_target(uuid,uuid) from public,anon;
grant execute on function public.hq_preparation_target(uuid,uuid) to authenticated;

-- Explicit caller target/version for the final preparation transition. The
-- raw UPDATE trigger remains a second fence; this RPC carries the handoff pair.
create function private.hq_lock_preparation_ready(w uuid,t uuid,p uuid,o uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  if not public.has_permission(w,'application.read') then
    raise exception using errcode='42501',message='Preparation read authority required'; end if;
  perform private.hq_assert_preparation_target(w,o,p,true);
  if t is null or not exists(select 1 from public.application_packages
    where workspace_id=w and opportunity_id=o and id=p and hq_preparation_task_id=t) then
    raise exception 'Exact preparation Task and Package pair required'; end if;
end; $$;
revoke all on function private.hq_lock_preparation_ready(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function private.hq_lock_preparation_ready(uuid,uuid,uuid,uuid) to authenticated;

create function public.hq_preparation_ready(w uuid,t uuid,p uuid,expected_updated_at timestamptz) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare pkg public.application_packages%rowtype;
begin
  if not public.has_permission(w,'application.read') or not public.has_permission(w,'application.prepare') then
    raise exception using errcode='42501',message='Preparation authority required'; end if;
  select * into pkg from public.application_packages where workspace_id=w and id=p;
  if not found then raise exception 'Scoped preparation Package required'; end if;
  perform private.hq_lock_preparation_ready(w,t,p,pkg.opportunity_id);
  select * into pkg from public.application_packages where workspace_id=w and id=p for update;
  if not found or pkg.hq_preparation_task_id is distinct from t or t is null
    or pkg.updated_at is distinct from expected_updated_at or expected_updated_at is null or pkg.status<>'preparing' then
    raise exception using errcode='40001',message='Exact reviewed preparation target required'; end if;
  update public.application_packages set status='ready_for_review' where workspace_id=w and id=p;
  return jsonb_build_object('package_id',p,'task_id',t,'status','ready_for_review');
end; $$;
revoke all on function public.hq_preparation_ready(uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.hq_preparation_ready(uuid,uuid,uuid,timestamptz) to authenticated;

-- The existing human command changes only the atomic revision binding below.
create or replace function public.hq_human_action(
  target_workspace_id uuid,
  target_opportunity_id uuid,
  expected_updated_at timestamptz,
  request_id uuid,
  command text,
  payload jsonb default '{}'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  actor uuid := public.current_principal_id();
  role_record public.opportunities%rowtype;
  action_record public.next_actions%rowtype;
  package_record public.application_packages%rowtype;
  application_record public.applications%rowtype;
  existing_event public.activity_events%rowtype;
  event_key text;
  request_record jsonb;
  result jsonb := jsonb_build_object('command', command);
  required_permissions text[];
  permission_key text;
  event_summary text;
  task_id uuid;
  new_package_id uuid;
  current_material_ids jsonb;
  reviewed_material_ids jsonb;
  resume_at timestamptz;
begin
  if actor is null or not public.current_principal_is_human()
     or not public.is_active_workspace_human(target_workspace_id, actor) then
    raise exception using errcode = '42501', message = 'An active workspace human is required';
  end if;
  if not exists (select 1 from public.workspaces where id = target_workspace_id and status = 'active') then
    raise exception using errcode = '42501', message = 'An active workspace is required';
  end if;
  if request_id is null or expected_updated_at is null
     or payload is null or jsonb_typeof(payload) <> 'object' or octet_length(payload::text) > 24000 then
    raise exception 'A request ID, reviewed version, and object payload are required';
  end if;
  required_permissions := array['workspace.read', 'opportunity.read', 'activity.read', 'activity.create'];
  case command
    when 'pursue' then required_permissions := required_permissions || array['opportunity.update','evaluation.read','internal_task.read','internal_task.create','next_action.read','next_action.complete'];
    when 'pass' then required_permissions := required_permissions || array['opportunity.update','opportunity.close','next_action.read','next_action.update'];
    when 'defer' then required_permissions := required_permissions || array['next_action.read','next_action.update'];
    when 'approve_package' then required_permissions := required_permissions || array['application.read','application.approve','application_gap.read','next_action.read','next_action.complete','next_action.create'];
    when 'request_changes' then required_permissions := required_permissions || array['application.read','application.prepare','internal_task.read','internal_task.create','next_action.read','next_action.update'];
    when 'save_positioning' then required_permissions := required_permissions || array['application.read','application.prepare'];
    when 'confirm_submission' then required_permissions := required_permissions || array['application.read','application.submit','next_action.read','next_action.complete'];
    else raise exception 'Unsupported human action';
  end case;
  foreach permission_key in array required_permissions loop
    if not public.has_permission(target_workspace_id, permission_key) then
      raise exception using errcode = '42501', message = 'Required action permission is missing';
    end if;
  end loop;
  select * into role_record from public.opportunities
    where workspace_id = target_workspace_id and id = target_opportunity_id for update;
  if not found then raise exception using errcode = '42501', message = 'Opportunity is unavailable'; end if;
  event_key := 'hq:' || actor::text || ':' || request_id::text;
  request_record := jsonb_build_object('opportunity_id', target_opportunity_id,
    'expected_updated_at', expected_updated_at, 'command', command, 'payload', payload);
  select * into existing_event from public.activity_events
    where workspace_id = target_workspace_id and idempotency_key = event_key;
  if found then
    if existing_event.details::jsonb -> 'request' is distinct from request_record then
      raise exception 'Request ID was already used for different input';
    end if;
    return existing_event.details::jsonb -> 'result';
  end if;
  if role_record.updated_at is distinct from expected_updated_at then
    raise exception using errcode = '40001', message = 'This opportunity changed. Reload and review it again.';
  end if;
  if role_record.opportunity_stage = 'closed' or not role_record.is_currently_active then
    raise exception 'This opportunity is no longer active';
  end if;

  if command in ('pursue','pass','defer') then
    select * into action_record from public.next_actions
      where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
        and id = (payload ->> 'action_id')::uuid and status = 'open'
        and action_type = 'decide'
        and (assigned_to_principal_id is null or assigned_to_principal_id = actor)
        and internal_task_id is null
      for update;
    -- A decision linked to an evaluation task is also eligible, but never a
    -- decide action belonging to a later application/interview/offer workflow.
    if not found then
      select a.* into action_record from public.next_actions a
        join public.internal_tasks t on t.workspace_id = a.workspace_id and t.id = a.internal_task_id
        where a.workspace_id = target_workspace_id and a.opportunity_id = target_opportunity_id
          and a.id = (payload ->> 'action_id')::uuid and a.status = 'open'
          and a.action_type = 'decide' and t.domain = 'evaluation'
          and (a.assigned_to_principal_id is null or a.assigned_to_principal_id = actor)
        for update of a;
    end if;
    if action_record.id is null or role_record.opportunity_stage not in ('discovered','verified','evaluating') then
      raise exception 'No eligible candidate decision is open';
    end if;
    if action_record.updated_at is distinct from (payload ->> 'action_updated_at')::timestamptz then
      raise exception using errcode = '40001', message = 'The decision changed. Reload and review it again.';
    end if;
    if command = 'pursue' then
      if not exists (select 1 from public.evaluations
        where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
          and evaluation_status = 'complete') then raise exception 'A completed evaluation is required'; end if;
      update public.next_actions set status = 'completed', completed_at = now(), available_after = null
        where workspace_id = target_workspace_id and id = action_record.id;
      update public.opportunities set opportunity_stage = 'pursuing'
        where workspace_id = target_workspace_id and id = target_opportunity_id;
      -- Reuse an existing explicitly authorized queue item; never duplicate
      -- completed/running/preexisting preparation work on retry.
      select id into task_id from public.internal_tasks
        where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
          and task_type = 'prepare_application_package' and domain = 'application'
          and trigger_type = 'candidate_action' and trigger_reference = 'candidate_decided_to_pursue'
        order by created_at limit 1;
      if task_id is null then
        insert into public.internal_tasks(workspace_id, opportunity_id, task_type, domain, title,
          status, trigger_type, trigger_reference, idempotency_key)
        values(target_workspace_id, target_opportunity_id, 'prepare_application_package', 'application',
          'Prepare the application package', 'ready', 'candidate_action', 'candidate_decided_to_pursue',
          'hq:pursue:' || target_opportunity_id::text) returning id into task_id;
      end if;
      result := result || jsonb_build_object('task_id', task_id);
      event_summary := 'Candidate chose to pursue; application preparation requested';
    elsif command = 'pass' then
      if nullif(btrim(payload ->> 'reason'), '') is null then raise exception 'A reason for passing is required'; end if;
      update public.next_actions set status = 'dismissed', available_after = null
        where workspace_id = target_workspace_id and id = action_record.id;
      update public.opportunities set opportunity_stage = 'closed', closed_reason = 'withdrawn'
        where workspace_id = target_workspace_id and id = target_opportunity_id;
      event_summary := 'Candidate passed on the opportunity';
    else
      resume_at := (payload ->> 'available_after')::timestamptz;
      if resume_at is null or resume_at <= now() then raise exception 'Choose a future review time'; end if;
      update public.next_actions set available_after = resume_at
        where workspace_id = target_workspace_id and id = action_record.id;
      event_summary := 'Candidate saved the opportunity for later';
    end if;
  else
    if role_record.opportunity_stage not in ('pursuing','interviewing','offer') then
      raise exception 'Candidate pursuit is required before application actions';
    end if;
    select * into package_record from public.application_packages
      where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
        and id = (payload ->> 'package_id')::uuid for update;
    if not found then raise exception 'Application package is unavailable'; end if;
    if package_record.updated_at is distinct from (payload ->> 'package_updated_at')::timestamptz then
      raise exception using errcode = '40001', message = 'The package changed. Reload and review it again.';
    end if;
    if exists (select 1 from public.application_packages
      where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
        and status <> 'archived' and package_number > package_record.package_number) then
      raise exception 'Review the latest application package';
    end if;
    perform 1 from public.application_materials
      where workspace_id = target_workspace_id and application_package_id = package_record.id
      order by id for update;
    -- Existing historical handoffs may be unlinked. Resolve only the exact
    -- human review action explicitly shown/confirmed in the dialog; never
    -- infer unrelated unlinked approvals from free-form titles.
    if command in ('approve_package','request_changes') and payload ->> 'review_action_id' is not null then
      select a.* into action_record from public.next_actions a
        where a.workspace_id = target_workspace_id and a.opportunity_id = target_opportunity_id
          and a.id = (payload ->> 'review_action_id')::uuid and a.status = 'open'
          and (a.assigned_to_principal_id is null or a.assigned_to_principal_id = actor)
          and ((a.action_type = 'approve' and a.internal_task_id is null) or
            (a.action_type in ('approve','review') and a.internal_task_id in
              (select id from public.internal_tasks where workspace_id = target_workspace_id
                and opportunity_id = target_opportunity_id and domain = 'application')))
        for update;
      if not found or action_record.updated_at is distinct from (payload ->> 'review_action_updated_at')::timestamptz then
        raise exception using errcode = '40001', message = 'The package review action changed. Reload and review it again.';
      end if;
    end if;
    if command in ('approve_package','confirm_submission') then
      select coalesce(jsonb_agg(id::text order by id::text), '[]'::jsonb) into current_material_ids
        from public.application_materials where workspace_id = target_workspace_id
          and application_package_id = package_record.id and is_current_package_version;
      if jsonb_typeof(payload -> 'material_ids') is distinct from 'array' then
        raise exception 'Confirm the exact current material versions';
      end if;
      select coalesce(jsonb_agg(value order by value), '[]'::jsonb) into reviewed_material_ids
        from jsonb_array_elements_text(payload -> 'material_ids');
      if current_material_ids = '[]'::jsonb or current_material_ids is distinct from reviewed_material_ids then
        raise exception using errcode = '40001', message = 'Material versions changed. Review the current materials.';
      end if;
    end if;
    case command
      when 'approve_package' then
        if package_record.status <> 'ready_for_review' then raise exception 'The package is not ready for review'; end if;
        if exists (select 1 from public.application_gaps
          where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
            and (evaluation_id is null or evaluation_id = package_record.evaluation_id)
            and blocking_status in ('blocking','unknown') and resolution_status in ('open','investigating')) then
          raise exception 'Resolve blocking or unknown application gaps before approval';
        end if;
        if exists (select 1 from public.application_materials where workspace_id = target_workspace_id
          and application_package_id = package_record.id and is_current_package_version
          and (status not in ('draft','candidate_review','approved')
            or (nullif(btrim(content_text),'') is null and nullif(btrim(file_url),'') is null))) then
          raise exception 'Every current material must have resolved content';
        end if;
        update public.application_materials set status = 'approved'
          where workspace_id = target_workspace_id and application_package_id = package_record.id
            and is_current_package_version and status in ('draft','candidate_review');
        update public.application_packages set status = 'approved'
          where workspace_id = target_workspace_id and id = package_record.id;
        if action_record.id is not null then
          update public.next_actions set status = 'completed', completed_at = now()
            where workspace_id = target_workspace_id and id = action_record.id;
        end if;
        update public.next_actions a set status = 'completed', completed_at = now()
          where a.workspace_id = target_workspace_id and a.opportunity_id = target_opportunity_id
            and a.status = 'open' and a.action_type in ('approve','review')
            and (a.assigned_to_principal_id is null or a.assigned_to_principal_id = actor)
            and (a.internal_task_id in (select id from public.internal_tasks
              where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id and domain = 'application'));
        if not exists (select 1 from public.next_actions where workspace_id = target_workspace_id
          and opportunity_id = target_opportunity_id and status = 'open' and action_type = 'apply'
          and (assigned_to_principal_id is null or assigned_to_principal_id = actor)) then
          insert into public.next_actions(workspace_id, opportunity_id, assigned_to_principal_id,
            action_type, title, approval_required)
          values(target_workspace_id, target_opportunity_id, actor, 'apply', 'Complete the employer application', true);
        end if;
        event_summary := 'Candidate approved the exact current application materials';
      when 'request_changes' then
        if exists (select 1 from public.applications where workspace_id = target_workspace_id
          and application_package_id = package_record.id and application_stage in ('submitted','confirmed')) then
          raise exception 'Submitted package history cannot be reopened by a revision request';
        end if;
        if package_record.status not in ('draft','preparing','ready_for_review','approved') then
          raise exception 'This package cannot receive a revision request'; end if;
        if nullif(btrim(payload ->> 'notes'), '') is null then raise exception 'Describe the changes you need'; end if;
        -- Create a new package rather than reopening or overwriting approved
        -- history. Existing worker reuses a draft package and creates materials.
        insert into public.application_packages(workspace_id, opportunity_id, application_template_id,
          evaluation_id, candidate_notes)
        values(target_workspace_id, target_opportunity_id, package_record.application_template_id,
          package_record.evaluation_id, 'Revision of package ' || package_record.package_number::text || ': ' || (payload ->> 'notes'))
        returning id into new_package_id;
        insert into public.internal_tasks(workspace_id, opportunity_id, task_type, domain, title, description,
          status, trigger_type, trigger_reference, idempotency_key)
        values(target_workspace_id, target_opportunity_id, 'prepare_application_package', 'application',
          'Prepare requested application revisions', 'Use draft package ' || new_package_id::text || '. ' || (payload ->> 'notes'),
          'ready', 'candidate_action', 'candidate_decided_to_pursue', event_key)
        returning id into task_id;
        update public.application_packages set hq_preparation_task_id=task_id
          where workspace_id=target_workspace_id and id=new_package_id;
        if action_record.id is not null then
          update public.next_actions set status = 'superseded'
            where workspace_id = target_workspace_id and id = action_record.id;
        end if;
        update public.next_actions a set status = 'superseded'
          where a.workspace_id = target_workspace_id and a.opportunity_id = target_opportunity_id
            and a.status = 'open' and (a.assigned_to_principal_id is null or a.assigned_to_principal_id = actor)
            and (a.action_type = 'apply' or (a.action_type in ('approve','review') and a.internal_task_id in
              (select id from public.internal_tasks where workspace_id = target_workspace_id
                and opportunity_id = target_opportunity_id and domain = 'application')));
        result := result || jsonb_build_object('package_id', new_package_id, 'task_id', task_id);
        event_summary := 'Candidate requested new application material versions';
      when 'save_positioning' then
        if package_record.status not in ('draft','preparing','ready_for_review') then
          raise exception 'Approved positioning is frozen; request a new package'; end if;
        if nullif(btrim(payload ->> 'notes'), '') is null then raise exception 'Positioning notes are required'; end if;
        update public.application_packages set candidate_notes = payload ->> 'notes'
          where workspace_id = target_workspace_id and id = package_record.id;
        event_summary := 'Candidate updated application positioning notes';
      when 'confirm_submission' then
        if payload -> 'confirmed' is distinct from 'true'::jsonb then
          raise exception 'Explicit candidate submission confirmation is required'; end if;
        if package_record.status <> 'approved' then raise exception 'An approved package is required'; end if;
        select * into application_record from public.applications
          where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
            and application_package_id = package_record.id and application_stage in ('submission_started','submitted','confirmed')
          order by attempt_number desc limit 1 for update;
        if application_record.application_stage in ('submitted','confirmed') then
          return result || jsonb_build_object('application_id', application_record.id, 'already_submitted', true);
        end if;
        if exists (select 1 from public.application_materials where workspace_id = target_workspace_id
          and application_package_id = package_record.id and is_current_package_version and status <> 'approved') then
          raise exception 'Current materials must still be approved'; end if;
        if application_record.id is null then
          insert into public.applications(workspace_id, opportunity_id, application_package_id,
            submission_method, application_url)
          values(target_workspace_id, target_opportunity_id, package_record.id, 'candidate_confirmed', role_record.canonical_url)
          returning * into application_record;
        end if;
        -- Existing lifecycle trigger attributes the human and submission time;
        -- existing AFTER trigger snapshots and marks exact versions submitted.
        update public.applications set application_stage = 'submitted'
          where workspace_id = target_workspace_id and id = application_record.id;
        update public.next_actions set status = 'completed', completed_at = now()
          where workspace_id = target_workspace_id and opportunity_id = target_opportunity_id
            and status = 'open' and action_type = 'apply'
            and (assigned_to_principal_id is null or assigned_to_principal_id = actor);
        result := result || jsonb_build_object('application_id', application_record.id);
        event_summary := 'Candidate explicitly confirmed application submission';
    end case;
  end if;
  insert into public.activity_events(workspace_id, opportunity_id, event_type, actor_principal_id,
    summary, details, source_system, idempotency_key)
  values(target_workspace_id, target_opportunity_id, 'candidate_' || command, actor, event_summary,
    jsonb_build_object('request', request_record, 'result', result)::text, 'job_hunt_hq', event_key);
  return result;
end;
$$;

commit;
