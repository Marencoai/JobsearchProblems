-- PROPOSED ONLY. Not part of automatic migration inventory. No production apply authorized.
-- Core Interview proposal; 002 separately requires reviewed Outreach contacts.
begin;
insert into public.permissions(permission_key,domain,action,description) values
 ('interview.read','interview','read','Read structured interview history'),
 ('interview.manage','interview','manage','Human manages interview records and preparation')
on conflict(permission_key) do nothing;
-- Proposed grants only to existing human Owner role; no agent role changes.
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.workspace_id is null and lower(r.name)='owner' and p.permission_key in ('interview.read','interview.manage')
on conflict do nothing;
create table public.interview_processes(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
opportunity_id uuid not null, status text not null default 'active' check(status in ('active','paused','completed','closed')),
current_stage text, known_process_structure text, started_at timestamptz, completed_at timestamptz, candidate_notes text,
unique(workspace_id,id,opportunity_id),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,id), foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id) on delete restrict);
create unique index interview_one_active on public.interview_processes(workspace_id,opportunity_id) where status='active';
create table public.interviews(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
interview_process_id uuid not null, opportunity_id uuid not null, interview_type text not null check(length(trim(interview_type))>0),
stage_name text, scheduled_start_at timestamptz, scheduled_end_at timestamptz, duration_minutes integer check(duration_minutes>0),
format text, meeting_url text check(meeting_url is null or meeting_url ~ '^https://'), location_text text, calendar_event_id text, instructions text,
preparation_status text not null default 'not_started' check(preparation_status in ('not_started','preparing','ready','completed')),
interview_status text not null default 'scheduled' check(interview_status in ('scheduled','completed','cancelled','rescheduled','no_show')),
outcome text check(outcome in ('advanced','rejected','pending','unknown')), candidate_notes text,
source_system text not null, source_reference text not null check(length(trim(source_reference))>0),
unique(workspace_id,source_system,source_reference), check(scheduled_end_at is null or scheduled_start_at is not null and scheduled_end_at>scheduled_start_at),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,id), foreign key(workspace_id,interview_process_id,opportunity_id) references public.interview_processes(workspace_id,id,opportunity_id) on delete restrict);
create table public.interview_preparations(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
interview_id uuid not null, evaluation_id uuid, summary text, what_they_are_likely_evaluating text, company_context text,
known_risks text, candidate_questions text, interviewer_research text, research_as_of timestamptz,
status text not null default 'draft' check(status in ('draft','ready','reviewed','completed')),
prepared_by_principal_id uuid references public.principals(id), unique(workspace_id,id,interview_id),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,id), foreign key(workspace_id,interview_id) references public.interviews(workspace_id,id) on delete restrict, foreign key(workspace_id,evaluation_id) references public.evaluations(workspace_id,id) on delete restrict);
create table public.interview_questions(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
interview_id uuid not null, interview_preparation_id uuid, question_text text not null check(length(trim(question_text))>0),
question_source text not null check(question_source in ('predicted','actual','prior_interview','employer_provided')),
question_category text, what_they_are_evaluating text, priority text check(priority in ('high','medium','low')),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,id), foreign key(workspace_id,interview_id) references public.interviews(workspace_id,id) on delete restrict, foreign key(workspace_id,interview_preparation_id,interview_id) references public.interview_preparations(workspace_id,id,interview_id) on delete restrict);
create table public.interview_question_evidence(id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
interview_question_id uuid not null, evidence_story_id uuid, project_id uuid, skill_id uuid, relevance_summary text,
priority_rank integer check(priority_rank>0), check(num_nonnulls(evidence_story_id,project_id,skill_id)=1),
created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,id), foreign key(workspace_id,interview_question_id) references public.interview_questions(workspace_id,id) on delete restrict, foreign key(workspace_id,evidence_story_id) references public.evidence_stories(workspace_id,id) on delete restrict, foreign key(workspace_id,project_id) references public.projects(workspace_id,id) on delete restrict, foreign key(workspace_id,skill_id) references public.skills(workspace_id,id) on delete restrict);
create function public.hq_interview_guard() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='UPDATE' then
  if new.workspace_id<>old.workspace_id or new.id<>old.id or new.created_by_principal_id is distinct from old.created_by_principal_id or new.created_at<>old.created_at then raise exception 'Interview identity and attribution are immutable'; end if;
  if (to_jsonb(new)->'opportunity_id') is distinct from (to_jsonb(old)->'opportunity_id') or (to_jsonb(new)->'interview_process_id') is distinct from (to_jsonb(old)->'interview_process_id') or (to_jsonb(new)->'interview_id') is distinct from (to_jsonb(old)->'interview_id') or (to_jsonb(new)->'interview_preparation_id') is distinct from (to_jsonb(old)->'interview_preparation_id') or (to_jsonb(new)->'contact_id') is distinct from (to_jsonb(old)->'contact_id') or (to_jsonb(new)->'source_system') is distinct from (to_jsonb(old)->'source_system') or (to_jsonb(new)->'source_reference') is distinct from (to_jsonb(old)->'source_reference') or (to_jsonb(new)->'interview_question_id') is distinct from (to_jsonb(old)->'interview_question_id') then raise exception 'Interview relationships are immutable'; end if;
  if tg_table_name='interview_preparations' and to_jsonb(old)->>'status' in ('reviewed','completed') then raise exception 'Reviewed preparation is immutable; create a new package'; end if;
  if tg_table_name='interviews' and to_jsonb(old)->>'interview_status' in ('completed','cancelled','no_show') then raise exception 'Historical interview is immutable'; end if;
  if tg_table_name='interview_processes' and to_jsonb(old)->>'status' in ('closed','completed') then raise exception 'Historical process is immutable'; end if;
 end if;
 if tg_table_name='interview_preparations' then
  if new.evaluation_id is not null and not exists(select 1 from public.evaluations ev join public.interviews iv on iv.workspace_id=ev.workspace_id and iv.opportunity_id=ev.opportunity_id where ev.workspace_id=new.workspace_id and ev.id=new.evaluation_id and iv.id=new.interview_id) then raise exception 'Preparation evaluation belongs to another role'; end if;
  new.prepared_by_principal_id:=public.current_principal_id();
 end if;
 if tg_table_name='interview_questions' and exists(select 1 from public.interview_preparations p where p.workspace_id=new.workspace_id and p.id=(to_jsonb(new)->>'interview_preparation_id')::uuid and p.status in ('reviewed','completed')) then raise exception 'Reviewed preparation questions are immutable'; end if;
 if tg_table_name='interview_question_evidence' and exists(select 1 from public.interview_questions q join public.interview_preparations p on p.workspace_id=q.workspace_id and p.id=q.interview_preparation_id where q.workspace_id=new.workspace_id and q.id=(to_jsonb(new)->>'interview_question_id')::uuid and p.status in ('reviewed','completed')) then raise exception 'Reviewed preparation evidence is immutable'; end if;
 return new;
end $$;
revoke all on function public.hq_interview_guard() from public;
alter table public.interview_processes enable row level security;
grant select,insert,update on public.interview_processes to authenticated;
create policy interview_processes_read on public.interview_processes for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_processes_create on public.interview_processes for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_processes_update on public.interview_processes for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interview_processes for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interview_processes for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interview_processes for each row execute function public.set_updated_at();
alter table public.interviews enable row level security;
grant select,insert,update on public.interviews to authenticated;
create policy interviews_read on public.interviews for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interviews_create on public.interviews for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interviews_update on public.interviews for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interviews for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interviews for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interviews for each row execute function public.set_updated_at();
alter table public.interview_preparations enable row level security;
grant select,insert,update on public.interview_preparations to authenticated;
create policy interview_preparations_read on public.interview_preparations for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_preparations_create on public.interview_preparations for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_preparations_update on public.interview_preparations for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interview_preparations for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interview_preparations for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interview_preparations for each row execute function public.set_updated_at();
alter table public.interview_questions enable row level security;
grant select,insert,update on public.interview_questions to authenticated;
create policy interview_questions_read on public.interview_questions for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_questions_create on public.interview_questions for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_questions_update on public.interview_questions for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interview_questions for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interview_questions for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interview_questions for each row execute function public.set_updated_at();
alter table public.interview_question_evidence enable row level security;
grant select,insert,update on public.interview_question_evidence to authenticated;
create policy interview_question_evidence_read on public.interview_question_evidence for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_question_evidence_create on public.interview_question_evidence for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_question_evidence_update on public.interview_question_evidence for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interview_question_evidence for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interview_question_evidence for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interview_question_evidence for each row execute function public.set_updated_at();
create index interviews_interview_process_id_idx on public.interviews(workspace_id,interview_process_id);
create index interview_preparations_interview_id_idx on public.interview_preparations(workspace_id,interview_id);
create index interview_questions_interview_id_idx on public.interview_questions(workspace_id,interview_id);
create index interview_questions_interview_preparation_id_idx on public.interview_questions(workspace_id,interview_preparation_id);
create index interview_question_evidence_interview_question_id_idx on public.interview_question_evidence(workspace_id,interview_question_id);
create index interview_question_evidence_evidence_story_id_idx on public.interview_question_evidence(workspace_id,evidence_story_id);
create index interview_question_evidence_project_id_idx on public.interview_question_evidence(workspace_id,project_id);
create index interview_question_evidence_skill_id_idx on public.interview_question_evidence(workspace_id,skill_id);
create index interview_preparations_evaluation_id_idx on public.interview_preparations(workspace_id,evaluation_id);

-- Verified-source adapter contract: caller is an active human reviewing source,
-- not an email/calendar worker. Agent ingestion authority is separately gated.
create function public.hq_interview_action(target_workspace_id uuid,target_opportunity_id uuid,expected_updated_at timestamptz,
 request_id uuid,command text,payload jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare
 actor uuid:=public.current_principal_id(); o public.opportunities%rowtype; i public.interviews%rowtype;
 e public.activity_events%rowtype; process_id uuid; prep_id uuid; event_id uuid; result jsonb;
 request jsonb; event_key text; permission text; prep public.interview_preparations%rowtype; q jsonb; question_id uuid;
begin
 if actor is null or not public.current_principal_is_human() or not public.is_active_workspace_human(target_workspace_id,actor) then raise exception using errcode='42501',message='Active workspace human required'; end if;
 if not exists(select 1 from public.workspaces where id=target_workspace_id and status='active') then raise exception using errcode='42501',message='Active workspace required'; end if;
 foreach permission in array array['workspace.read','opportunity.read','opportunity.update','interview.read','interview.manage','activity.read','activity.create','next_action.read','next_action.create','next_action.complete'] loop
  if not public.has_permission(target_workspace_id,permission) then raise exception using errcode='42501',message='Interview action permission missing'; end if;
 end loop;
 if request_id is null or expected_updated_at is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>24000 then raise exception 'Reviewed version, request ID and bounded payload required'; end if;
 select * into o from public.opportunities where workspace_id=target_workspace_id and id=target_opportunity_id for update;
 if not found then raise exception 'Opportunity unavailable'; end if;
 event_key:='hq-interview:'||actor::text||':'||request_id::text;
 request:=jsonb_build_object('opportunity_id',target_opportunity_id,'version',expected_updated_at,'command',command,'payload',payload);
 select * into e from public.activity_events where workspace_id=target_workspace_id and idempotency_key=event_key;
 if found then
  if e.details::jsonb->'request' is distinct from request then raise exception 'Request ID input mismatch'; end if;
  return e.details::jsonb->'result';
 end if;
 if o.updated_at is distinct from expected_updated_at then raise exception using errcode='40001',message='Opportunity changed; reload'; end if;
 if not o.is_currently_active or o.opportunity_stage in ('closed','offer') then raise exception 'Interview opportunity is not active'; end if;
 if command='record_verified_interview' then
  if payload->>'verified' is distinct from 'true' or nullif(trim(payload->>'source_reference'),'') is null or nullif(trim(payload->>'source_system'),'') is null or nullif(trim(payload->>'interview_type'),'') is null then raise exception 'Explicit reviewed source and interview type required'; end if;
  select * into i from public.interviews where workspace_id=target_workspace_id and source_system=payload->>'source_system' and source_reference=payload->>'source_reference';
  if found then
   if i.opportunity_id<>target_opportunity_id or i.interview_type is distinct from payload->>'interview_type' or i.scheduled_start_at is distinct from (payload->>'scheduled_start_at')::timestamptz then raise exception 'Source already linked; review existing interview'; end if;
   return jsonb_build_object('interview_id',i.id,'matched',true);
  end if;
  select id into process_id from public.interview_processes where workspace_id=target_workspace_id and opportunity_id=target_opportunity_id and status='active';
  if process_id is null then insert into public.interview_processes(workspace_id,opportunity_id,started_at) values(target_workspace_id,target_opportunity_id,now()) returning id into process_id; end if;
  insert into public.interviews(workspace_id,opportunity_id,interview_process_id,interview_type,stage_name,scheduled_start_at,scheduled_end_at,meeting_url,format,instructions,source_system,source_reference)
  values(target_workspace_id,target_opportunity_id,process_id,payload->>'interview_type',payload->>'stage_name',(payload->>'scheduled_start_at')::timestamptz,(payload->>'scheduled_end_at')::timestamptz,payload->>'meeting_url',payload->>'format',payload->>'instructions',payload->>'source_system',payload->>'source_reference') returning * into i;
  update public.opportunities set opportunity_stage='interviewing' where workspace_id=target_workspace_id and id=target_opportunity_id;
 elsif command='start_prep' then
  select * into i from public.interviews where workspace_id=target_workspace_id and opportunity_id=target_opportunity_id and id=(payload->>'interview_id')::uuid for update;
  if not found or i.interview_status<>'scheduled' then raise exception 'Scheduled interview required'; end if;
  if i.updated_at is distinct from (payload->>'interview_updated_at')::timestamptz then raise exception using errcode='40001',message='Interview changed; reload'; end if;
  select id into prep_id from public.interview_preparations where workspace_id=target_workspace_id and interview_id=i.id and status='draft' order by created_at desc limit 1;
  if prep_id is null then insert into public.interview_preparations(workspace_id,interview_id) values(target_workspace_id,i.id) returning id into prep_id; end if;
  update public.interviews set preparation_status='preparing' where workspace_id=target_workspace_id and id=i.id;
 elsif command='save_prep' then
  select * into i from public.interviews where workspace_id=target_workspace_id and opportunity_id=target_opportunity_id and id=(payload->>'interview_id')::uuid for update;
  if not found or i.interview_status<>'scheduled' then raise exception 'Scheduled interview required'; end if;
  select * into prep from public.interview_preparations where workspace_id=target_workspace_id and interview_id=i.id and id=(payload->>'preparation_id')::uuid for update;
  if not found or prep.status not in ('draft','ready') then raise exception 'Editable preparation required'; end if;
  if prep.updated_at is distinct from (payload->>'preparation_updated_at')::timestamptz then raise exception using errcode='40001',message='Preparation changed; reload'; end if;
  if nullif(trim(payload->>'summary'),'') is null then raise exception 'Concise preparation summary required'; end if;
  if payload ? 'questions' and (jsonb_typeof(payload->'questions')<>'array' or jsonb_array_length(payload->'questions')>20) then raise exception 'At most 20 structured questions'; end if;
  for q in select value from jsonb_array_elements(coalesce(payload->'questions','[]'::jsonb)) loop
   insert into public.interview_questions(workspace_id,interview_id,interview_preparation_id,question_text,question_source,what_they_are_evaluating)
   values(target_workspace_id,i.id,prep.id,q->>'question_text',q->>'question_source',q->>'what_they_are_evaluating') returning id into question_id;
   if num_nonnulls(q->>'evidence_story_id',q->>'project_id',q->>'skill_id')>0 then
    insert into public.interview_question_evidence(workspace_id,interview_question_id,evidence_story_id,project_id,skill_id,relevance_summary)
    values(target_workspace_id,question_id,(q->>'evidence_story_id')::uuid,(q->>'project_id')::uuid,(q->>'skill_id')::uuid,q->>'relevance_summary');
   end if;
  end loop;
  update public.interview_preparations set summary=payload->>'summary',what_they_are_likely_evaluating=payload->>'what_they_are_likely_evaluating',company_context=payload->>'company_context',interviewer_research=payload->>'interviewer_research',known_risks=payload->>'known_risks',candidate_questions=payload->>'candidate_questions',research_as_of=(payload->>'research_as_of')::timestamptz,status=case when payload->>'reviewed'='true' then 'reviewed' else 'ready' end where workspace_id=target_workspace_id and id=prep.id;
  update public.interviews set preparation_status='ready' where workspace_id=target_workspace_id and id=i.id;
  prep_id:=prep.id;
  if payload->>'reviewed'='true' then
   update public.next_actions a set status='completed',completed_at=now() where a.workspace_id=target_workspace_id and a.opportunity_id=target_opportunity_id and a.status='open' and a.action_type='prepare' and (a.assigned_to_principal_id is null or a.assigned_to_principal_id=actor) and exists(select 1 from public.activity_events ae where ae.workspace_id=a.workspace_id and ae.id=a.source_activity_event_id and ae.source_system='hq' and ae.source_reference=i.id::text and ae.event_type like 'interview_%');
  end if;
 else raise exception 'Unsupported interview action'; end if;
 result:=jsonb_build_object('interview_id',i.id,'preparation_id',prep_id);
 insert into public.activity_events(workspace_id,opportunity_id,event_type,summary,details,source_system,source_reference,idempotency_key)
 values(target_workspace_id,target_opportunity_id,'interview_'||command,case when command='start_prep' then 'Interview preparation started' else 'Verified interview recorded' end,
 jsonb_build_object('request',request,'result',result)::text,'hq',i.id::text,event_key) returning id into event_id;
 -- Reconcile only this interview's explicit linked action; never unrelated workflows.
 if command<>'save_prep' and not exists(select 1 from public.next_actions a join public.activity_events ae on ae.workspace_id=a.workspace_id and ae.id=a.source_activity_event_id where a.workspace_id=target_workspace_id and a.opportunity_id=target_opportunity_id and a.status='open' and ae.source_system='hq' and ae.source_reference=i.id::text and ae.event_type like 'interview_%') then
  insert into public.next_actions(workspace_id,opportunity_id,source_activity_event_id,assigned_to_principal_id,action_type,title,context_summary,priority,due_at)
  values(target_workspace_id,target_opportunity_id,event_id,actor,'prepare','Prepare for interview','Review questions, evidence and company context',85,i.scheduled_start_at);
 end if;
 return result;
end $$;
revoke all on function public.hq_interview_action(uuid,uuid,timestamptz,uuid,text,jsonb) from public,anon;
grant execute on function public.hq_interview_action(uuid,uuid,timestamptz,uuid,text,jsonb) to authenticated;
commit;
