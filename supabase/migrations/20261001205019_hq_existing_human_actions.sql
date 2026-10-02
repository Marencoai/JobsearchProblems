-- PROPOSED / NOT APPLIED TO PRODUCTION.
-- Additive human-action RPC; uses existing permissions, RLS, and lifecycle
-- triggers as the caller. No SECURITY DEFINER, role grants, or policy changes.
-- Workers retain preparation ownership. History and submitted snapshots retain
-- their existing protections. Each RPC is one transaction and locks the role.
begin;

alter table public.next_actions add column available_after timestamptz null;
comment on column public.next_actions.available_after is
  'Candidate deferral; consumers must exclude open actions until this timestamp. Null means available now. Does not authorize preparation.';

create function public.hq_human_action(
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
revoke all on function public.hq_human_action(uuid,uuid,timestamptz,uuid,text,jsonb) from public, anon;
grant execute on function public.hq_human_action(uuid,uuid,timestamptz,uuid,text,jsonb) to authenticated;
commit;
