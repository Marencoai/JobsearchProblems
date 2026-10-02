-- PROPOSED ONLY. Separate approval required; exact approved Phase 2 SQL unchanged.
-- Queue existing company/opportunity research under caller's existing authority.
-- No browser research, fact overwrite, evaluation mutation or pursuit authority.
create function public.hq_request_research_refresh(target_workspace_id uuid, target_opportunity_id uuid, expected_updated_at timestamptz, request_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=public.current_principal_id(); k text; e public.activity_events; t public.internal_tasks; o public.opportunities; request jsonb; result jsonb; event_id uuid:=gen_random_uuid(); task_id uuid;
begin
 if actor is null or request_id is null or expected_updated_at is null
 or not public.is_active_workspace_human(target_workspace_id,actor)
 or not exists(select 1 from public.workspaces w where w.id=target_workspace_id and w.status='active')
 or not public.has_permission(target_workspace_id,'opportunity.read')
 or not public.has_permission(target_workspace_id,'company_intelligence.read')
 or not public.has_permission(target_workspace_id,'activity.create') or not public.has_permission(target_workspace_id,'activity.read')
 or not public.has_permission(target_workspace_id,'internal_task.create') or not public.has_permission(target_workspace_id,'internal_task.read')
 then raise exception 'Active human research-request authority required' using errcode='42501'; end if;
 k:='hq:research-refresh:'||actor::text||':'||request_id::text;
 request:=jsonb_build_object('opportunity_id',target_opportunity_id,'expected_updated_at',expected_updated_at);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_workspace_id::text||k,0));
 select * into e from public.activity_events where workspace_id=target_workspace_id and idempotency_key=k;
 if e.id is not null then
  if e.event_type <> 'research_refresh_requested' or e.details::jsonb->'request' is distinct from request then raise exception 'Retry key belongs to a different research request' using errcode='40001'; end if;
  return e.details::jsonb->'result';
 end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_workspace_id::text||':research:'||target_opportunity_id::text,0));
 select * into o from public.opportunities where workspace_id=target_workspace_id and id=target_opportunity_id;
 if o.id is null then raise exception 'Accessible opportunity required' using errcode='42501'; end if;
 if o.updated_at is distinct from expected_updated_at then raise exception 'Opportunity changed; reload before requesting research' using errcode='40001'; end if;
 if not o.is_currently_active or o.opportunity_stage='closed' then raise exception 'This opportunity is no longer active'; end if;
 select * into t from public.internal_tasks where workspace_id=target_workspace_id and opportunity_id=o.id
 and task_type='refresh_company_intelligence' and domain='company_intelligence'
 and trigger_type='candidate_action' and trigger_reference='candidate_requested_research_refresh'
 and status in ('pending','ready','running','waiting','blocked') order by created_at,id limit 1;
 task_id:=coalesce(t.id,gen_random_uuid());
 result:=jsonb_build_object('command','request_research_refresh','event_id',event_id,'task_id',task_id,'status',coalesce(t.status,'ready'));
 insert into public.activity_events(id,workspace_id,opportunity_id,event_type,actor_principal_id,summary,details,source_system,source_reference,idempotency_key)
 values(event_id,target_workspace_id,o.id,'research_refresh_requested',actor,'Candidate requested updated research',jsonb_build_object('request',request,'result',result)::text,'job_hunt_hq',request_id::text,k) returning * into e;
 if t.id is null then
  insert into public.internal_tasks(id,workspace_id,opportunity_id,source_activity_event_id,task_type,domain,title,description,status,trigger_type,trigger_reference,idempotency_key)
  values(task_id,target_workspace_id,o.id,e.id,'refresh_company_intelligence','company_intelligence','Refresh company and listing research',jsonb_build_object('contract_version',1,'workspace_id',target_workspace_id,'opportunity_id',o.id,'company_id',o.company_id,'activity_event_id',e.id,'preserve_completed_evaluations',true,'authorizes_preparation',false)::text,'ready','candidate_action','candidate_requested_research_refresh',k||':task') returning * into t;
 end if;
 return result;
end $$;
revoke all on function public.hq_request_research_refresh(uuid,uuid,timestamptz,uuid) from public,anon;
grant execute on function public.hq_request_research_refresh(uuid,uuid,timestamptz,uuid) to authenticated;
