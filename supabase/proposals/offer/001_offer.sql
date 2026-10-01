-- PROPOSED ONLY. Not in automatic migration inventory. No production approval.
begin;
insert into public.permissions(permission_key,domain,action,description) values
 ('offer.read','offer','read','Read offer terms and history'),('offer.manage','offer','manage','Human records offer terms and negotiation'),('offer.decide','offer','decide','Human explicitly records final offer decision') on conflict do nothing;
insert into public.role_permissions(role_id,permission_id) select r.id,p.id from public.roles r cross join public.permissions p where r.workspace_id is null and lower(r.name)='owner' and p.permission_key in ('offer.read','offer.manage','offer.decide') on conflict do nothing;
create table public.offers(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete restrict,opportunity_id uuid not null,received_at timestamptz not null,
status text not null default 'received' check(status in ('received','negotiating','accepted','declined','withdrawn')),
source_system text not null,source_reference text not null check(length(trim(source_reference))>0),
negotiation_state text not null default 'not_started' check(negotiation_state in ('not_started','planning','in_progress','resolved')),
final_decision text check(final_decision in ('accepted','declined')),decision_at timestamptz,
updated_at timestamptz not null default now(),updated_by_principal_id uuid references public.principals(id),
unique(workspace_id,source_system,source_reference),check((status in ('accepted','declined') and final_decision is not null and final_decision=status and decision_at is not null) or (status not in ('accepted','declined') and final_decision is null and decision_at is null)),created_at timestamptz not null default now(), created_by_principal_id uuid references public.principals(id), unique(workspace_id,id),foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id) on delete restrict);
create unique index offers_one_active on public.offers(workspace_id,opportunity_id) where status in ('received','negotiating');
create table public.offer_terms(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete restrict,offer_id uuid not null,version_number integer not null check(version_number>0),currency text not null check(currency ~ '^[A-Z]{3}$'),
base numeric(14,2) check(base>=0),base_period text not null default 'annual' check(base_period in ('annual','monthly','hourly')),
variable numeric(14,2) check(variable>=0),ote numeric(14,2) check(ote>=0),variable_notes text,
equity text,equity_units numeric check(equity_units>=0),equity_percent numeric check(equity_percent between 0 and 100),equity_vesting text,
benefits_notes text,start_date date,location_travel text,travel_percent numeric check(travel_percent between 0 and 100),quota text,ramp text,territory text,expires_at timestamptz,terms_notes text,
unique(workspace_id,offer_id,version_number),unique(workspace_id,id,offer_id),created_at timestamptz not null default now(), created_by_principal_id uuid references public.principals(id), unique(workspace_id,id),foreign key(workspace_id,offer_id) references public.offers(workspace_id,id) on delete restrict);
create table public.offer_negotiations(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete restrict,offer_id uuid not null,offer_terms_id uuid not null,entry_type text not null check(entry_type in ('plan','candidate_proposal','employer_response','note')),
exact_text text not null check(length(trim(exact_text))>0),occurred_at timestamptz not null default now(),
source_reference text, external_message_sent boolean not null default false check(external_message_sent=false),created_at timestamptz not null default now(), created_by_principal_id uuid references public.principals(id), unique(workspace_id,id),foreign key(workspace_id,offer_terms_id,offer_id) references public.offer_terms(workspace_id,id,offer_id) on delete restrict);
create table public.offer_decisions(id uuid primary key default gen_random_uuid(),workspace_id uuid not null references public.workspaces(id) on delete restrict,offer_id uuid not null,offer_terms_id uuid not null,decision text not null check(decision in ('accepted','declined')),
reason text not null check(length(trim(reason))>0),confirmed boolean not null check(confirmed=true),decided_at timestamptz not null default now(),
unique(workspace_id,offer_id),created_at timestamptz not null default now(), created_by_principal_id uuid references public.principals(id), unique(workspace_id,id),foreign key(workspace_id,offer_terms_id,offer_id) references public.offer_terms(workspace_id,id,offer_id) on delete restrict);
create function public.hq_offer_guard() returns trigger language plpgsql security invoker set search_path='' as $$
declare parent public.offers%rowtype;
begin
 if tg_table_name='offers' then
  if tg_op='UPDATE' then
   if old.status in ('accepted','declined','withdrawn') then raise exception 'Final offer is immutable'; end if;
   if new.id<>old.id or new.workspace_id<>old.workspace_id or new.opportunity_id<>old.opportunity_id or new.source_system<>old.source_system or new.source_reference<>old.source_reference or new.created_by_principal_id is distinct from old.created_by_principal_id or new.created_at<>old.created_at then raise exception 'Offer identity is immutable'; end if;
  end if;
  if new.status in ('accepted','declined') then
   if not public.current_principal_is_human() or not public.has_permission(new.workspace_id,'offer.decide') or not exists(select 1 from public.offer_decisions d where d.workspace_id=new.workspace_id and d.offer_id=new.id and d.decision=new.status and d.confirmed and d.created_by_principal_id=public.current_principal_id()) then raise exception 'Explicit human decision record required'; end if;
  end if;
 else
  select * into parent from public.offers where workspace_id=new.workspace_id and id=new.offer_id for update;
  if not found or parent.status not in ('received','negotiating') then raise exception 'Active offer required'; end if;
  if tg_table_name='offer_decisions' and (to_jsonb(new)->>'offer_terms_id')::uuid is distinct from (select latest.id from public.offer_terms latest where latest.workspace_id=new.workspace_id and latest.offer_id=new.offer_id order by latest.version_number desc limit 1) then raise exception 'Explicit decision must reference latest terms'; end if;
  if tg_table_name='offer_terms' then
   select coalesce(max(version_number),0)+1 into new.version_number from public.offer_terms where workspace_id=new.workspace_id and offer_id=new.offer_id;
  end if;
 end if;
 return new;
end $$;
revoke all on function public.hq_offer_guard() from public;
alter table public.offers enable row level security;
revoke all on public.offers from public,anon,authenticated;
grant select,insert on public.offers to authenticated;
create policy offers_read on public.offers for select to authenticated using(public.has_permission(workspace_id,'offer.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy offers_insert on public.offers for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_offer_guard before insert on public.offers for each row execute function public.hq_offer_guard();
create trigger b_actor before insert on public.offers for each row execute function public.set_actor_audit_fields();
alter table public.offer_terms enable row level security;
revoke all on public.offer_terms from public,anon,authenticated;
grant select,insert on public.offer_terms to authenticated;
create policy offer_terms_read on public.offer_terms for select to authenticated using(public.has_permission(workspace_id,'offer.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy offer_terms_insert on public.offer_terms for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_offer_guard before insert on public.offer_terms for each row execute function public.hq_offer_guard();
create trigger b_actor before insert on public.offer_terms for each row execute function public.set_actor_audit_fields();
alter table public.offer_negotiations enable row level security;
revoke all on public.offer_negotiations from public,anon,authenticated;
grant select,insert on public.offer_negotiations to authenticated;
create policy offer_negotiations_read on public.offer_negotiations for select to authenticated using(public.has_permission(workspace_id,'offer.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy offer_negotiations_insert on public.offer_negotiations for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_offer_guard before insert on public.offer_negotiations for each row execute function public.hq_offer_guard();
create trigger b_actor before insert on public.offer_negotiations for each row execute function public.set_actor_audit_fields();
alter table public.offer_decisions enable row level security;
revoke all on public.offer_decisions from public,anon,authenticated;
grant select,insert on public.offer_decisions to authenticated;
create policy offer_decisions_read on public.offer_decisions for select to authenticated using(public.has_permission(workspace_id,'offer.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy offer_decisions_insert on public.offer_decisions for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.decide') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_offer_guard before insert on public.offer_decisions for each row execute function public.hq_offer_guard();
create trigger b_actor before insert on public.offer_decisions for each row execute function public.set_actor_audit_fields();
grant update on public.offers to authenticated;
create policy offers_update on public.offers for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_offer_update_guard before update on public.offers for each row execute function public.hq_offer_guard();
create trigger b_offer_update_actor before update on public.offers for each row execute function public.set_actor_audit_fields();
create trigger c_offer_update_time before update on public.offers for each row execute function public.set_updated_at();
create index offers_opportunity_idx on public.offers(workspace_id,opportunity_id);
create index offer_negotiations_terms_idx on public.offer_negotiations(workspace_id,offer_terms_id,offer_id);
create index offer_decisions_terms_idx on public.offer_decisions(workspace_id,offer_terms_id,offer_id);
-- Domain-private retry data: generic Activity readers must not receive exact prep/compensation input.
create table public.hq_offer_action_requests(
 workspace_id uuid not null references public.workspaces(id) on delete restrict,
 actor_principal_id uuid not null references public.principals(id) on delete restrict,
 request_id uuid not null,request jsonb not null,result jsonb not null,activity_event_id uuid not null,
 created_at timestamptz not null default now(),primary key(workspace_id,actor_principal_id,request_id),
 foreign key(workspace_id,activity_event_id) references public.activity_events(workspace_id,id) on delete restrict);
alter table public.hq_offer_action_requests enable row level security;
revoke all on public.hq_offer_action_requests from public,anon,authenticated;
grant select,insert on public.hq_offer_action_requests to authenticated;
create policy hq_offer_action_requests_read on public.hq_offer_action_requests for select to authenticated using(actor_principal_id=public.current_principal_id() and public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,actor_principal_id) and public.has_permission(workspace_id,'offer.read') and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy hq_offer_action_requests_insert on public.hq_offer_action_requests for insert to authenticated with check(actor_principal_id=public.current_principal_id() and public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,actor_principal_id) and public.has_permission(workspace_id,'offer.read') and public.has_permission(workspace_id,'offer.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create index hq_offer_action_requests_actor_idx on public.hq_offer_action_requests(actor_principal_id);
create index hq_offer_action_requests_event_idx on public.hq_offer_action_requests(workspace_id,activity_event_id);
create function public.hq_offer_action(target_workspace_id uuid,target_opportunity_id uuid,expected_updated_at timestamptz,request_id uuid,command text,payload jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor uuid:=public.current_principal_id();o public.opportunities%rowtype;f public.offers%rowtype;t public.offer_terms%rowtype;e public.activity_events%rowtype;
 replay public.hq_offer_action_requests%rowtype;event_key text;request jsonb;result jsonb;event_id uuid;permission text;term jsonb;note_id uuid;decision_id uuid;
begin
 if actor is null or not public.current_principal_is_human() or not public.is_active_workspace_human(target_workspace_id,actor) or not exists(select 1 from public.workspaces where id=target_workspace_id and status='active') then raise exception using errcode='42501',message='Active workspace human required'; end if;
 foreach permission in array array['workspace.read','opportunity.read','opportunity.update','offer.read','offer.manage','activity.read','activity.create','next_action.read','next_action.create','next_action.complete'] loop
  if not public.has_permission(target_workspace_id,permission) then raise exception using errcode='42501',message='Offer action permission missing'; end if;
 end loop;
 if command in ('accept','decline') and (not public.has_permission(target_workspace_id,'offer.decide') or not public.has_permission(target_workspace_id,'opportunity.close')) then raise exception using errcode='42501',message='Human offer decision permission required'; end if;
 if request_id is null or expected_updated_at is null or payload is null or jsonb_typeof(payload)<>'object' or octet_length(payload::text)>24000 then raise exception 'Reviewed version, request ID and bounded payload required'; end if;
 select * into o from public.opportunities where workspace_id=target_workspace_id and id=target_opportunity_id for update;
 if not found then raise exception 'Opportunity unavailable'; end if;
 request:=jsonb_build_object('opportunity_id',target_opportunity_id,'version',expected_updated_at,'command',command,'payload',payload);event_key:='hq-offer:'||actor::text||':'||request_id::text;
 select * into replay from public.hq_offer_action_requests where workspace_id=target_workspace_id and actor_principal_id=actor and hq_offer_action_requests.request_id=hq_offer_action.request_id;
 if found then if replay.request is distinct from request then raise exception 'Request ID input mismatch'; end if;return replay.result; end if;
 if o.updated_at is distinct from expected_updated_at then raise exception using errcode='40001',message='Opportunity changed; reload'; end if;
 if not o.is_currently_active or o.opportunity_stage='closed' then raise exception 'Active opportunity required'; end if;
 if command='record_offer' then
  if payload->>'verified' is distinct from 'true' or nullif(trim(payload->>'source_reference'),'') is null or nullif(trim(payload->>'source_system'),'') is null then raise exception 'Human-reviewed offer source required'; end if;
  insert into public.offers(workspace_id,opportunity_id,received_at,source_system,source_reference)
  values(target_workspace_id,target_opportunity_id,(payload->>'received_at')::timestamptz,payload->>'source_system',payload->>'source_reference') returning * into f;
  update public.opportunities set opportunity_stage='offer' where workspace_id=target_workspace_id and id=target_opportunity_id;
 else
  select * into f from public.offers where workspace_id=target_workspace_id and opportunity_id=target_opportunity_id and id=(payload->>'offer_id')::uuid for update;
  if not found or f.status not in ('received','negotiating') then raise exception 'Active offer required'; end if;
  if f.updated_at is distinct from (payload->>'offer_updated_at')::timestamptz then raise exception using errcode='40001',message='Offer changed; reload'; end if;
 end if;
 if command='revise_terms' then
  select * into t from public.offer_terms where workspace_id=target_workspace_id and offer_id=f.id order by version_number desc limit 1;
  if not found or t.id is distinct from (payload->>'offer_terms_id')::uuid then raise exception 'Review latest exact offer terms'; end if;
 end if;
 if command in ('record_offer','revise_terms') then
  term:=payload->'terms';if term is null or jsonb_typeof(term)<>'object' then raise exception 'Structured offer terms required'; end if;
  insert into public.offer_terms(workspace_id,offer_id,version_number,currency,base,base_period,variable,ote,variable_notes,equity,equity_units,equity_percent,equity_vesting,benefits_notes,start_date,location_travel,travel_percent,quota,ramp,territory,expires_at,terms_notes)
  values(target_workspace_id,f.id,1,term->>'currency',(term->>'base')::numeric,coalesce(term->>'base_period','annual'),(term->>'variable')::numeric,(term->>'ote')::numeric,term->>'variable_notes',term->>'equity',(term->>'equity_units')::numeric,(term->>'equity_percent')::numeric,term->>'equity_vesting',term->>'benefits_notes',(term->>'start_date')::date,term->>'location_travel',(term->>'travel_percent')::numeric,term->>'quota',term->>'ramp',term->>'territory',(term->>'expires_at')::timestamptz,term->>'terms_notes') returning * into t;
  if command='revise_terms' then update public.offers set negotiation_state='in_progress',status='negotiating' where workspace_id=target_workspace_id and id=f.id; end if;
 else
  select * into t from public.offer_terms where workspace_id=target_workspace_id and offer_id=f.id order by version_number desc limit 1;
  if not found or t.id is distinct from (payload->>'offer_terms_id')::uuid then raise exception 'Review latest exact offer terms'; end if;
  if command='negotiate' then
   insert into public.offer_negotiations(workspace_id,offer_id,offer_terms_id,entry_type,exact_text) values(target_workspace_id,f.id,t.id,coalesce(payload->>'entry_type','plan'),payload->>'exact_text') returning id into note_id;
   update public.offers set status='negotiating',negotiation_state='planning' where workspace_id=target_workspace_id and id=f.id;
  elsif command in ('accept','decline') then
   if payload->>'confirmed' is distinct from 'true' then raise exception 'Explicit human confirmation required'; end if;
   insert into public.offer_decisions(workspace_id,offer_id,offer_terms_id,decision,reason,confirmed) values(target_workspace_id,f.id,t.id,case command when 'accept' then 'accepted' else 'declined' end,payload->>'reason',true) returning id into decision_id;
   update public.offers set status=case command when 'accept' then 'accepted' else 'declined' end,final_decision=case command when 'accept' then 'accepted' else 'declined' end,decision_at=now(),negotiation_state='resolved' where workspace_id=target_workspace_id and id=f.id;
   -- Exact latest terms were reviewed; close only when no active offer remains.
   -- Existing lifecycle uses closed_reason=other; exact decision is preserved above.
   if not exists(select 1 from public.offers active_offer where active_offer.workspace_id=target_workspace_id and active_offer.opportunity_id=target_opportunity_id and active_offer.status in ('received','negotiating')) then
    update public.opportunities set opportunity_stage='closed',closed_reason='other' where workspace_id=target_workspace_id and id=target_opportunity_id;
   end if;
  else raise exception 'Unsupported offer action'; end if;
 end if;
 result:=jsonb_build_object('offer_id',f.id,'offer_terms_id',t.id,'negotiation_id',note_id,'decision_id',decision_id);
 insert into public.activity_events(workspace_id,opportunity_id,event_type,summary,details,source_system,source_reference,idempotency_key)
 values(target_workspace_id,target_opportunity_id,'offer_'||command,case command when 'record_offer' then 'Verified offer received' when 'negotiate' then 'Negotiation plan recorded' when 'accept' then 'Human acceptance decision recorded' when 'decline' then 'Human decline decision recorded' else 'New offer terms recorded' end,jsonb_build_object('result',result)::text,'hq',f.id::text,event_key) returning id into event_id;
 if command in ('accept','decline') then
  update public.next_actions a set status='completed',completed_at=now() where a.workspace_id=target_workspace_id and a.opportunity_id=target_opportunity_id and a.status='open' and a.action_type='decide' and (a.assigned_to_principal_id is null or a.assigned_to_principal_id=actor) and exists(select 1 from public.activity_events ae where ae.workspace_id=a.workspace_id and ae.id=a.source_activity_event_id and ae.source_system='hq' and ae.source_reference=f.id::text and ae.event_type like 'offer_%');
 elsif not exists(select 1 from public.next_actions a join public.activity_events ae on ae.workspace_id=a.workspace_id and ae.id=a.source_activity_event_id where a.workspace_id=target_workspace_id and a.opportunity_id=target_opportunity_id and a.status='open' and ae.source_system='hq' and ae.source_reference=f.id::text and ae.event_type like 'offer_%') then
  insert into public.next_actions(workspace_id,opportunity_id,source_activity_event_id,assigned_to_principal_id,action_type,title,context_summary,priority,due_at) values(target_workspace_id,target_opportunity_id,event_id,actor,'decide','Review offer and decide','Review compensation, terms and your negotiation plan',95,t.expires_at);
 end if;
 insert into public.hq_offer_action_requests(workspace_id,actor_principal_id,request_id,request,result,activity_event_id) values(target_workspace_id,actor,hq_offer_action.request_id,request,result,event_id);
 return result;
end $$;
revoke all on function public.hq_offer_action(uuid,uuid,timestamptz,uuid,text,jsonb) from public,anon;
grant execute on function public.hq_offer_action(uuid,uuid,timestamptz,uuid,text,jsonb) to authenticated;
create index offers_creator_idx on public.offers(created_by_principal_id);
create index offers_updater_idx on public.offers(updated_by_principal_id);
create index offer_terms_creator_idx on public.offer_terms(created_by_principal_id);
create index offer_negotiations_creator_idx on public.offer_negotiations(created_by_principal_id);
create index offer_decisions_creator_idx on public.offer_decisions(created_by_principal_id);
create index offer_negotiations_offer_history_idx on public.offer_negotiations(workspace_id,offer_id,occurred_at);
commit;
