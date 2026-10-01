-- PROPOSED ONLY. Not in the automatic migration inventory. Production requires
-- one domain approval covering this file, the permission impact, and rollout.
-- Canonical reusable relationship model; no external communication is performed.
begin;

insert into public.permissions(permission_key, domain, action, description) values
 ('contact.read','contact','read','Read professional contacts in a workspace'),
 ('contact.manage','contact','manage','Maintain professional contacts and role relationships'),
 ('outreach.read','outreach','read','Read relationship workstreams and exact message history'),
 ('outreach.manage','outreach','manage','Maintain engagement and opportunity relationships'),
 ('outreach.draft','outreach','draft','Save versioned drafts or request existing worker preparation'),
 ('outreach.approve','outreach','approve','Human approval of an exact draft version'),
 ('outreach.record_sent','outreach','record_sent','Human attestation of an already-sent exact message; never transport authority'),
 ('outreach.record_received','outreach','record_received','Record a verified incoming communication'),
 ('outreach.record_interaction','outreach','record_interaction','Record professional relationship activity')
on conflict(permission_key) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.workspace_id is null and lower(r.name)='owner'
and p.permission_key in ('contact.read','contact.manage','outreach.read','outreach.manage',
 'outreach.draft','outreach.approve','outreach.record_sent','outreach.record_received','outreach.record_interaction')
on conflict(role_id, permission_id) do nothing;
-- No agent is provisioned or granted any permission. No outreach.send permission.

create table public.contacts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id) on delete restrict,
 company_id uuid,
 full_name text not null check(length(btrim(full_name)) between 1 and 300),
 title text, email text, linkedin_url text, phone text, location_text text,
 relationship_type text, relationship_context text,
 source_system text not null, source_reference text,
 status text not null default 'active' check(status in ('active','inactive','archived')),
 revision integer not null default 1 check(revision>0),
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 updated_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id),
 foreign key(workspace_id,company_id) references public.companies(workspace_id,id) on delete restrict,
 check(email is null or (length(email)<=320 and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 check(linkedin_url is null or linkedin_url ~ '^https://(www\.)?linkedin\.com/in/[^[:space:]?#@]+/?$')
);
create index contacts_company_idx on public.contacts(workspace_id,company_id);
-- Names/email are not globally unique: shared mailboxes and namesakes are valid.
create index contacts_name_idx on public.contacts(workspace_id,lower(full_name));

create table public.opportunity_contacts (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 opportunity_id uuid not null, contact_id uuid not null,
 relationship_role text not null default 'outreach_target', is_primary boolean not null default false,
 selection_method text not null check(selection_method in ('recommended','manual')),
 relevance text not null check(length(btrim(relevance)) between 1 and 2000),
 source_system text not null, source_reference text, notes text,
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,opportunity_id,contact_id,relationship_role),
 foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id) on delete restrict,
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id) on delete restrict
);
create index opportunity_contacts_contact_idx on public.opportunity_contacts(workspace_id,contact_id);
create unique index opportunity_contacts_primary_idx on public.opportunity_contacts(workspace_id,opportunity_id,relationship_role) where is_primary;

create table public.outreach_engagements (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 contact_id uuid not null, company_id uuid, goal text, relationship_context text,
 relationship_state text not null default 'cold' check(relationship_state in ('cold','warm','known','active','dormant','strong')),
 outreach_state text not null default 'target_identified' check(outreach_state in
  ('not_started','target_identified','warming','message_ready','contacted','engaged','waiting','closed')),
 status text not null default 'active' check(status in ('active','dormant','closed','archived')),
 last_meaningful_interaction_at timestamptz, next_follow_up_at timestamptz,
 revision integer not null default 1 check(revision>0),
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 updated_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,id,contact_id),
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id) on delete restrict,
 foreign key(workspace_id,company_id) references public.companies(workspace_id,id) on delete restrict
);
create index outreach_engagements_contact_idx on public.outreach_engagements(workspace_id,contact_id);
create index outreach_engagements_company_idx on public.outreach_engagements(workspace_id,company_id);

create table public.outreach_engagement_opportunities (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 outreach_engagement_id uuid not null, opportunity_id uuid not null,
 relationship_type text, is_current boolean not null default true,
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,outreach_engagement_id,opportunity_id),
 foreign key(workspace_id,outreach_engagement_id) references public.outreach_engagements(workspace_id,id) on delete restrict,
 foreign key(workspace_id,opportunity_id) references public.opportunities(workspace_id,id) on delete restrict
);
create index outreach_engagement_opportunities_opportunity_idx on public.outreach_engagement_opportunities(workspace_id,opportunity_id);

create table public.outreach_messages (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 outreach_engagement_id uuid not null, contact_id uuid not null, opportunity_id uuid,
 draft_series_id uuid not null, version_number integer not null check(version_number>0), supersedes_message_id uuid,
 channel text not null check(channel in ('email','linkedin','phone','sms','other')),
 direction text not null check(direction in ('inbound','outbound')), purpose text,
 subject text, content text not null check(length(btrim(content)) between 1 and 20000),
 message_status text not null check(message_status in ('draft','review','approved','sent','received','rejected','archived')),
 approval_status text check(approval_status in ('pending','approved','rejected')),
 prepared_by_principal_id uuid references public.principals(id) on delete restrict,
 approved_by_principal_id uuid references public.principals(id) on delete restrict,
 approved_at timestamptz, sent_by_principal_id uuid references public.principals(id) on delete restrict,
 sent_at timestamptz, received_at timestamptz, recorded_at timestamptz not null default now(),
 response_status text not null default 'none' check(response_status in ('none','waiting','responded')),
 response_to_message_id uuid, external_reference text,
 -- Immutable recipient/role snapshot captured at mark-sent/receive, independent
 -- of later contact/company edits. Exact sent content is this immutable row.
 recipient_snapshot jsonb, opportunity_snapshot jsonb,
 review_next_action_id uuid, send_next_action_id uuid,
 revision integer not null default 1 check(revision>0),
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(workspace_id,id), unique(workspace_id,outreach_engagement_id,id), unique(workspace_id,draft_series_id,version_number),
 foreign key(workspace_id,outreach_engagement_id,contact_id) references public.outreach_engagements(workspace_id,id,contact_id) on delete restrict,
 foreign key(workspace_id,outreach_engagement_id,opportunity_id) references public.outreach_engagement_opportunities(workspace_id,outreach_engagement_id,opportunity_id) on delete restrict,
 foreign key(workspace_id,supersedes_message_id) references public.outreach_messages(workspace_id,id) on delete restrict,
 foreign key(workspace_id,response_to_message_id) references public.outreach_messages(workspace_id,id) on delete restrict,
 foreign key(workspace_id,review_next_action_id) references public.next_actions(workspace_id,id) on delete restrict,
 foreign key(workspace_id,send_next_action_id) references public.next_actions(workspace_id,id) on delete restrict,
 check((direction='inbound' and message_status='received' and received_at is not null and sent_at is null)
    or (direction='outbound' and message_status<>'received' and received_at is null)),
 check((message_status='sent' and sent_at is not null and sent_by_principal_id is not null
   and approved_by_principal_id is not null and approved_at is not null and approval_status='approved'
   and recipient_snapshot is not null) or (message_status<>'sent' and sent_at is null and sent_by_principal_id is null)),
 check(message_status<>'approved' or (approval_status='approved' and approved_by_principal_id is not null and approved_at is not null)),
 check(approval_status is distinct from 'approved' or (approved_by_principal_id is not null and approved_at is not null))
);
create index outreach_messages_engagement_idx on public.outreach_messages(workspace_id,outreach_engagement_id,created_at);
create index outreach_messages_opportunity_idx on public.outreach_messages(workspace_id,outreach_engagement_id,opportunity_id);
create index outreach_messages_previous_idx on public.outreach_messages(workspace_id,supersedes_message_id);
create index outreach_messages_response_idx on public.outreach_messages(workspace_id,response_to_message_id);
create index outreach_messages_review_idx on public.outreach_messages(workspace_id,review_next_action_id);
create index outreach_messages_send_idx on public.outreach_messages(workspace_id,send_next_action_id);
create unique index outreach_messages_external_idx on public.outreach_messages(workspace_id,channel,direction,external_reference) where external_reference is not null;

create table public.outreach_message_evidence (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 outreach_message_id uuid not null, evidence_story_id uuid, project_id uuid, skill_id uuid,
 usage_context text not null,
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), unique(workspace_id,id),
 check(num_nonnulls(evidence_story_id,project_id,skill_id)=1),
 foreign key(workspace_id,outreach_message_id) references public.outreach_messages(workspace_id,id) on delete restrict,
 foreign key(workspace_id,evidence_story_id) references public.evidence_stories(workspace_id,id) on delete restrict,
 foreign key(workspace_id,project_id) references public.projects(workspace_id,id) on delete restrict,
 foreign key(workspace_id,skill_id) references public.skills(workspace_id,id) on delete restrict
);
create index outreach_message_evidence_message_idx on public.outreach_message_evidence(workspace_id,outreach_message_id);
create index outreach_message_evidence_story_idx on public.outreach_message_evidence(workspace_id,evidence_story_id);
create index outreach_message_evidence_project_idx on public.outreach_message_evidence(workspace_id,project_id);
create index outreach_message_evidence_skill_idx on public.outreach_message_evidence(workspace_id,skill_id);

create table public.outreach_interactions (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 outreach_engagement_id uuid not null, contact_id uuid not null, opportunity_id uuid,
 interaction_type text not null check(interaction_type in ('follow','connect','connection_accepted','comment','call','referral','meeting','introduction','other')),
 summary text not null check(length(btrim(summary)) between 1 and 2000), occurred_at timestamptz not null,
 source_system text not null, source_reference text,
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,outreach_engagement_id,contact_id) references public.outreach_engagements(workspace_id,id,contact_id) on delete restrict,
 foreign key(workspace_id,outreach_engagement_id,opportunity_id) references public.outreach_engagement_opportunities(workspace_id,outreach_engagement_id,opportunity_id) on delete restrict
);
create index outreach_interactions_engagement_idx on public.outreach_interactions(workspace_id,outreach_engagement_id,contact_id,occurred_at);
create index outreach_interactions_opportunity_idx on public.outreach_interactions(workspace_id,outreach_engagement_id,opportunity_id);

create table public.relationship_notes (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 contact_id uuid not null, outreach_engagement_id uuid,
 note_type text not null default 'professional_context', note_text text not null check(length(btrim(note_text)) between 1 and 4000),
 validation_status text not null check(validation_status in ('confirmed','inferred','candidate_review_needed')),
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), unique(workspace_id,id),
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id) on delete restrict,
 foreign key(workspace_id,outreach_engagement_id,contact_id) references public.outreach_engagements(workspace_id,id,contact_id) on delete restrict
);
create index relationship_notes_contact_idx on public.relationship_notes(workspace_id,contact_id);
create index relationship_notes_engagement_idx on public.relationship_notes(workspace_id,outreach_engagement_id,contact_id);

-- Typed routing for the existing task engine, not another queue. Worker result
-- acceptance and follow-up reconciliation use these exact task/message IDs.
create table public.outreach_task_links (
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 internal_task_id uuid not null, outreach_engagement_id uuid not null, outreach_message_id uuid,
 purpose text not null check(purpose in ('draft','review','follow_up')),
 created_by_principal_id uuid not null references public.principals(id) on delete restrict,
 created_at timestamptz not null default now(), unique(workspace_id,id), unique(workspace_id,internal_task_id),
 foreign key(workspace_id,internal_task_id) references public.internal_tasks(workspace_id,id) on delete restrict,
 foreign key(workspace_id,outreach_engagement_id) references public.outreach_engagements(workspace_id,id) on delete restrict,
 foreign key(workspace_id,outreach_engagement_id,outreach_message_id) references public.outreach_messages(workspace_id,outreach_engagement_id,id) on delete restrict
);
create index outreach_task_links_engagement_idx on public.outreach_task_links(workspace_id,outreach_engagement_id);
create index outreach_task_links_message_idx on public.outreach_task_links(workspace_id,outreach_message_id);
create index outreach_task_links_context_idx on public.outreach_task_links(workspace_id,outreach_engagement_id,outreach_message_id);

-- Cover every new FK, including historical Principal audit attribution.
create index outreach_messages_contact_idx on public.outreach_messages(workspace_id,outreach_engagement_id,contact_id);
do $$ declare name text; begin
 foreach name in array array['contacts','opportunity_contacts','outreach_engagements',
  'outreach_engagement_opportunities','outreach_messages','outreach_message_evidence',
  'outreach_interactions','relationship_notes','outreach_task_links'] loop
  execute format('create index %I on public.%I(created_by_principal_id)',name||'_creator_idx',name);
 end loop;
end $$;
create index contacts_updater_idx on public.contacts(updated_by_principal_id);
create index outreach_engagements_updater_idx on public.outreach_engagements(updated_by_principal_id);
create index outreach_messages_preparer_idx on public.outreach_messages(prepared_by_principal_id);
create index outreach_messages_approver_idx on public.outreach_messages(approved_by_principal_id);
create index outreach_messages_sender_idx on public.outreach_messages(sent_by_principal_id);

-- All exposed new tables fail closed even if Supabase default grants exist.
do $$ declare name text; begin
 foreach name in array array['contacts','opportunity_contacts','outreach_engagements',
  'outreach_engagement_opportunities','outreach_messages','outreach_message_evidence',
  'outreach_interactions','relationship_notes','outreach_task_links'] loop
  execute format('alter table public.%I enable row level security',name);
  execute format('revoke all on table public.%I from public, anon, authenticated',name);
  execute format('grant select on table public.%I to authenticated',name);
  execute format('create policy outreach_read on public.%I for select to authenticated using (
   public.is_active_workspace_principal(workspace_id,public.current_principal_id())
   and public.has_permission(workspace_id,%L)
   and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status=''active''))',
   name,case when name in ('contacts','opportunity_contacts') then 'contact.read' else 'outreach.read' end);
 end loop;
end $$;

-- Immutable message body/identity, frozen sent/received records, append-only
-- relationship/evidence/task links. Even privileged local maintenance cannot
-- accidentally rewrite exact historical communications.
create function private.outreach_history_guard() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='DELETE' then raise exception 'Outreach history must be retained'; end if;
 if tg_table_name='outreach_messages' then
  if old.message_status in ('sent','received','archived','rejected') then raise exception 'Historical outreach messages are immutable'; end if;
  if (to_jsonb(new)-array['message_status','approval_status','approved_by_principal_id','approved_at',
   'sent_by_principal_id','sent_at','response_status','recipient_snapshot','opportunity_snapshot',
   'review_next_action_id','send_next_action_id','revision','updated_at'])
   is distinct from (to_jsonb(old)-array['message_status','approval_status','approved_by_principal_id','approved_at',
   'sent_by_principal_id','sent_at','response_status','recipient_snapshot','opportunity_snapshot',
   'review_next_action_id','send_next_action_id','revision','updated_at']) then
   raise exception 'Create a new message version instead of rewriting content or identity';
  end if;
 elsif tg_table_name='opportunity_contacts' then
  if (to_jsonb(new)-'is_primary') is distinct from (to_jsonb(old)-'is_primary') then
   raise exception 'Contact relationship history is immutable apart from primary selection';
  end if;
 elsif tg_table_name in ('contacts','outreach_engagements') then
  if new.id<>old.id or new.workspace_id<>old.workspace_id or new.created_at<>old.created_at
   or new.created_by_principal_id<>old.created_by_principal_id then raise exception 'Outreach identity and creator are immutable'; end if;
  if tg_table_name='outreach_engagements' and (to_jsonb(new)->'contact_id') is distinct from (to_jsonb(old)->'contact_id') then
   raise exception 'Engagement contact is immutable';
  end if;
 else raise exception 'Outreach links, evidence, interactions and notes are append-only';
 end if;
 return new;
end $$;
revoke all on function private.outreach_history_guard() from public,anon,authenticated;
do $$ declare name text; begin
 foreach name in array array['contacts','opportunity_contacts','outreach_engagements',
  'outreach_engagement_opportunities','outreach_messages','outreach_message_evidence',
  'outreach_interactions','relationship_notes','outreach_task_links'] loop
  execute format('create trigger outreach_history before update or delete on public.%I for each row execute function private.outreach_history_guard()',name);
 end loop;
end $$;

-- Preserve the historical validator unchanged for every old/unknown type.
-- New domain types get a separate validator and keep the same workspace check.
create function private.validate_outreach_activity_link() returns trigger
language plpgsql security definer set search_path='' as $$
declare valid boolean; begin
 case new.entity_type
 when 'contact' then select exists(select 1 from public.contacts where workspace_id=new.workspace_id and id=new.entity_id) into valid;
 when 'outreach_engagement' then select exists(select 1 from public.outreach_engagements where workspace_id=new.workspace_id and id=new.entity_id) into valid;
 when 'outreach_message' then select exists(select 1 from public.outreach_messages where workspace_id=new.workspace_id and id=new.entity_id) into valid;
 when 'outreach_interaction' then select exists(select 1 from public.outreach_interactions where workspace_id=new.workspace_id and id=new.entity_id) into valid;
 else raise exception 'Unsupported outreach entity type'; end case;
 if not valid then raise exception 'Outreach activity target must exist in the same workspace'; end if;
 return new;
end $$;
revoke all on function private.validate_outreach_activity_link() from public,anon,authenticated;
drop trigger validate_activity_event_link_before_insert on public.activity_event_links;
create trigger validate_activity_event_link_before_insert before insert on public.activity_event_links
for each row when (new.entity_type not in ('contact','outreach_engagement','outreach_message','outreach_interaction'))
execute function private.validate_activity_event_link();
create trigger validate_outreach_activity_link_before_insert before insert on public.activity_event_links
for each row when (new.entity_type in ('contact','outreach_engagement','outreach_message','outreach_interaction'))
execute function private.validate_outreach_activity_link();

-- Controlled writer in the existing non-exposed private schema. Only a small
-- public invoker wrapper is exposed. Every command checks actual Auth mapping,
-- current active membership/workspace and explicit domain/workflow permissions.
create function private.hq_outreach_action(
 target_workspace_id uuid, request_id uuid, command text, payload jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := public.current_principal_id(); human boolean := public.current_principal_is_human();
 required text[] := array['workspace.read','activity.read','activity.create']; permission_key text;
 input jsonb; previous public.activity_events%rowtype; result jsonb := '{}'::jsonb;
 contact public.contacts%rowtype; engagement public.outreach_engagements%rowtype; message public.outreach_messages%rowtype;
 task public.internal_tasks%rowtype; route public.outreach_task_links%rowtype;
 op public.opportunities%rowtype; ref_op uuid := (payload->>'opportunity_id')::uuid;
 event_id uuid; entity_id uuid; entity_type text; action_id uuid; task_id uuid;
 series uuid; version integer; new_id uuid; summary text; allowed text[];
 follow_at timestamptz; occurred timestamptz; recipient jsonb; evidence jsonb; evidence_key text; evidence_id uuid;
begin
 if actor is null or not public.is_active_workspace_principal(target_workspace_id,actor)
 or not exists(select 1 from public.workspaces where id=target_workspace_id and status='active') then
  raise exception using errcode='42501',message='An active workspace principal is required';
 end if;
 if request_id is null or command is null or payload is null or jsonb_typeof(payload)<>'object'
 or octet_length(payload::text)>40000 then raise exception 'Request ID and bounded object input are required'; end if;
 case command
 when 'save_contact' then required:=required||array['contact.read','contact.manage','company.read'];
  allowed:=array['contact_id','expected_revision','company_id','full_name','title','email','linkedin_url','phone','location_text','relationship_type','relationship_context','source_system','source_reference','status'];
 when 'link_contact' then required:=required||array['contact.read','contact.manage','opportunity.read'];
  allowed:=array['contact_id','opportunity_id','relationship_role','is_primary','selection_method','relevance','source_system','source_reference','notes'];
 when 'select_primary_contact' then required:=required||array['contact.read','contact.manage','opportunity.read'];
  allowed:=array['contact_id','opportunity_id','relationship_role'];
 when 'create_engagement' then required:=required||array['contact.read','outreach.read','outreach.manage','company.read'];
  allowed:=array['contact_id','company_id','goal','relationship_context','relationship_state'];
 when 'update_engagement' then required:=required||array['outreach.read','outreach.manage','company.read'];
  allowed:=array['engagement_id','expected_revision','company_id','goal','relationship_context','relationship_state','status'];
 when 'link_engagement' then required:=required||array['outreach.read','outreach.manage','opportunity.read'];
  allowed:=array['engagement_id','expected_revision','opportunity_id','relationship_type'];
 when 'save_draft','complete_draft' then required:=required||array['contact.read','outreach.read','outreach.draft','opportunity.read',
  'internal_task.read','internal_task.create','next_action.read','next_action.create','next_action.update'];
  allowed:=array['engagement_id','expected_revision','opportunity_id','message_id','channel','purpose','subject','content','evidence','task_id'];
  if command='complete_draft' then required:=required||array['internal_task.execute']; end if;
 when 'request_draft' then required:=required||array['contact.read','outreach.read','outreach.draft','opportunity.read','internal_task.read','internal_task.create'];
  allowed:=array['engagement_id','expected_revision','opportunity_id','message_id','instructions'];
 when 'approve_message' then required:=required||array['outreach.read','outreach.approve','internal_task.read','next_action.read','next_action.create','next_action.complete'];
  allowed:=array['engagement_id','expected_revision','message_id','confirmed'];
 when 'mark_sent' then required:=required||array['contact.read','outreach.read','outreach.approve','outreach.record_sent','opportunity.read',
  'internal_task.read','internal_task.create','internal_task.update','next_action.read','next_action.complete'];
  allowed:=array['engagement_id','expected_revision','message_id','confirmed','exact_content','exact_subject','recipient','sent_at','follow_up_at','follow_up_choice','external_reference','resolves_follow_up_task_id'];
 when 'resolve_follow_up' then required:=required||array['outreach.read','outreach.manage','internal_task.read','internal_task.update','next_action.read','next_action.complete'];
  allowed:=array['engagement_id','expected_revision','task_id','reason'];
 when 'record_received' then required:=required||array['contact.read','outreach.read','outreach.record_received','opportunity.read',
  'internal_task.read','internal_task.create','internal_task.update','next_action.read','next_action.create','next_action.update'];
  allowed:=array['engagement_id','expected_revision','opportunity_id','channel','subject','content','received_at','external_reference','response_to_message_id','source_system'];
 when 'record_interaction' then required:=required||array['contact.read','outreach.read','outreach.record_interaction','opportunity.read'];
  allowed:=array['engagement_id','expected_revision','opportunity_id','interaction_type','summary','occurred_at','source_system','source_reference'];
 when 'add_note' then required:=required||array['contact.read','outreach.read','outreach.manage'];
  allowed:=array['contact_id','engagement_id','note_type','note_text','validation_status'];
 when 'reconcile_follow_up' then required:=required||array['outreach.read','internal_task.read','internal_task.execute','next_action.read','next_action.create'];
  allowed:=array['task_id'];
 else raise exception 'Unsupported Outreach command'; end case;
 if exists(select 1 from jsonb_object_keys(payload) k where not k=any(allowed)) then raise exception 'Unexpected Outreach input field'; end if;
 if command in ('approve_message','mark_sent','request_draft','select_primary_contact','resolve_follow_up') and not human then
  raise exception using errcode='42501',message='Explicit human action is required';
 end if;
 foreach permission_key in array required loop
  if not public.has_permission(target_workspace_id,permission_key) then
   raise exception using errcode='42501',message='Required Outreach permission is missing';
  end if;
 end loop;
 -- Coarse workspace serialization is intentional for low-volume V1 relationship
 -- transitions. It protects creation, version allocation, idempotency and queue
 -- reconciliation with one lock order, including two different retry IDs.
 perform id from public.workspaces where id=target_workspace_id for update;
 input:=jsonb_build_object('command',command,'payload',payload);
 select * into previous from public.activity_events where workspace_id=target_workspace_id
 and idempotency_key='hq-outreach:'||actor::text||':'||request_id::text;
 if found then
  if previous.details::jsonb->'request' is distinct from input then raise exception 'Request ID was used with different input'; end if;
  return previous.details::jsonb->'result';
 end if;

 if ref_op is not null then
  select * into op from public.opportunities where workspace_id=target_workspace_id and id=ref_op;
  if not found then raise exception 'Opportunity is unavailable'; end if;
 end if;
 if payload->>'contact_id' is not null then
  select * into contact from public.contacts where workspace_id=target_workspace_id and id=(payload->>'contact_id')::uuid;
  if not found then raise exception 'Contact is unavailable'; end if;
 end if;
 if payload->>'engagement_id' is not null then
  select * into engagement from public.outreach_engagements where workspace_id=target_workspace_id and id=(payload->>'engagement_id')::uuid;
  if not found or (engagement.status<>'active' and command<>'update_engagement') then raise exception 'Active engagement is unavailable'; end if;
  if command<>'add_note' and engagement.revision is distinct from (payload->>'expected_revision')::integer then
   raise exception using errcode='40001',message='Engagement changed; reload and review';
  end if;
  select * into contact from public.contacts where workspace_id=target_workspace_id and id=engagement.contact_id;
  if ref_op is not null and not exists(select 1 from public.outreach_engagement_opportunities
   where workspace_id=target_workspace_id and outreach_engagement_id=engagement.id and opportunity_id=ref_op and is_current) and command<>'link_engagement' then
   raise exception 'Opportunity must be currently linked to this engagement';
  end if;
 end if;
 if payload->>'message_id' is not null then
  select * into message from public.outreach_messages where workspace_id=target_workspace_id and id=(payload->>'message_id')::uuid;
  if not found or message.outreach_engagement_id is distinct from engagement.id then raise exception 'Message is unavailable for this engagement'; end if;
  if exists(select 1 from public.outreach_messages where workspace_id=target_workspace_id
   and draft_series_id=message.draft_series_id and version_number>message.version_number) then raise exception 'Review the latest message version'; end if;
 end if;

 if command='save_contact' then
  if payload->>'company_id' is not null and not exists(select 1 from public.companies
   where workspace_id=target_workspace_id and id=(payload->>'company_id')::uuid) then raise exception 'Company is unavailable'; end if;
  if nullif(btrim(payload->>'full_name'),'') is null or nullif(btrim(payload->>'source_system'),'') is null then raise exception 'Contact name and source are required'; end if;
  if contact.id is null then
   insert into public.contacts(workspace_id,company_id,full_name,title,email,linkedin_url,phone,location_text,
    relationship_type,relationship_context,source_system,source_reference,status,created_by_principal_id,updated_by_principal_id)
   values(target_workspace_id,(payload->>'company_id')::uuid,btrim(payload->>'full_name'),payload->>'title',nullif(btrim(payload->>'email'),''),
    nullif(btrim(payload->>'linkedin_url'),''),payload->>'phone',payload->>'location_text',payload->>'relationship_type',payload->>'relationship_context',
    payload->>'source_system',payload->>'source_reference',coalesce(payload->>'status','active'),actor,actor) returning id into new_id;
  else
   if contact.revision is distinct from (payload->>'expected_revision')::integer then raise exception using errcode='40001',message='Contact changed; reload and review'; end if;
   update public.contacts set company_id=(payload->>'company_id')::uuid,full_name=btrim(payload->>'full_name'),
    title=payload->>'title',email=nullif(btrim(payload->>'email'),''),linkedin_url=nullif(btrim(payload->>'linkedin_url'),''),
    phone=payload->>'phone',location_text=payload->>'location_text',relationship_type=payload->>'relationship_type',
    relationship_context=payload->>'relationship_context',source_system=payload->>'source_system',source_reference=payload->>'source_reference',
    status=coalesce(payload->>'status','active'),revision=revision+1,updated_at=now(),updated_by_principal_id=actor
   where workspace_id=target_workspace_id and id=contact.id returning id into new_id;
  end if;
  result:=jsonb_build_object('contact_id',new_id); entity_id:=new_id;entity_type:='contact';summary:='Professional contact saved';
 elsif command='link_contact' then
  if contact.id is null or contact.status<>'active' or ref_op is null then raise exception 'Active contact and opportunity are required'; end if;
  if payload->>'selection_method'='manual' and not human then raise exception 'Manual selection requires a human'; end if;
  insert into public.opportunity_contacts(workspace_id,opportunity_id,contact_id,relationship_role,is_primary,selection_method,
   relevance,source_system,source_reference,notes,created_by_principal_id)
  values(target_workspace_id,ref_op,contact.id,coalesce(payload->>'relationship_role','outreach_target'),coalesce((payload->>'is_primary')::boolean,false),
   payload->>'selection_method',payload->>'relevance',payload->>'source_system',payload->>'source_reference',payload->>'notes',actor) returning id into new_id;
  result:=jsonb_build_object('opportunity_contact_id',new_id);entity_id:=contact.id;entity_type:='contact';summary:='Contact linked to opportunity';
 elsif command='select_primary_contact' then
  if contact.id is null or contact.status<>'active' or ref_op is null or not exists(select 1 from public.opportunity_contacts
   where workspace_id=target_workspace_id and opportunity_id=ref_op and contact_id=contact.id
   and relationship_role=coalesce(payload->>'relationship_role','outreach_target')) then raise exception 'An existing active opportunity contact is required'; end if;
  update public.opportunity_contacts set is_primary=false where workspace_id=target_workspace_id and opportunity_id=ref_op
   and relationship_role=coalesce(payload->>'relationship_role','outreach_target') and is_primary;
  update public.opportunity_contacts set is_primary=true where workspace_id=target_workspace_id and opportunity_id=ref_op and contact_id=contact.id
   and relationship_role=coalesce(payload->>'relationship_role','outreach_target');
  result:=jsonb_build_object('contact_id',contact.id);entity_id:=contact.id;entity_type:='contact';summary:='Human selected the primary opportunity contact';
 elsif command='create_engagement' then
  if contact.id is null or contact.status<>'active' then raise exception 'An active contact is required'; end if;
  if payload->>'company_id' is not null and not exists(select 1 from public.companies where workspace_id=target_workspace_id and id=(payload->>'company_id')::uuid) then raise exception 'Company is unavailable'; end if;
  insert into public.outreach_engagements(workspace_id,contact_id,company_id,goal,relationship_context,relationship_state,created_by_principal_id,updated_by_principal_id)
  values(target_workspace_id,contact.id,coalesce((payload->>'company_id')::uuid,contact.company_id),payload->>'goal',payload->>'relationship_context',
   coalesce(payload->>'relationship_state','cold'),actor,actor) returning * into engagement;
  result:=jsonb_build_object('engagement_id',engagement.id);entity_id:=engagement.id;entity_type:='outreach_engagement';summary:='Relationship workstream created';
 elsif command='update_engagement' then
  if engagement.id is null then raise exception 'Engagement is required'; end if;
  if payload ? 'company_id' and payload->>'company_id' is not null and not exists(select 1 from public.companies
   where workspace_id=target_workspace_id and id=(payload->>'company_id')::uuid) then raise exception 'Company is unavailable'; end if;
  update public.outreach_engagements set
   company_id=case when payload ? 'company_id' then (payload->>'company_id')::uuid else company_id end,
   goal=case when payload ? 'goal' then payload->>'goal' else goal end,
   relationship_context=case when payload ? 'relationship_context' then payload->>'relationship_context' else relationship_context end,
   relationship_state=coalesce(payload->>'relationship_state',relationship_state),status=coalesce(payload->>'status',status)
   where workspace_id=target_workspace_id and id=engagement.id;
  result:=jsonb_build_object('engagement_id',engagement.id);summary:='Relationship workstream updated';
 elsif command='link_engagement' then
  if engagement.id is null or ref_op is null then raise exception 'Engagement and opportunity are required'; end if;
  insert into public.outreach_engagement_opportunities(workspace_id,outreach_engagement_id,opportunity_id,relationship_type,created_by_principal_id)
  values(target_workspace_id,engagement.id,ref_op,payload->>'relationship_type',actor) returning id into new_id;
  result:=jsonb_build_object('engagement_opportunity_id',new_id);summary:='Relationship linked to opportunity';
 elsif command in ('save_draft','complete_draft') then
  if engagement.id is null or contact.status<>'active' then raise exception 'Active engagement and contact are required'; end if;
  if command='save_draft' and payload->>'task_id' is not null then raise exception 'Use worker completion for a preparation task'; end if;
  if command='complete_draft' then
   select * into route from public.outreach_task_links where workspace_id=target_workspace_id and internal_task_id=(payload->>'task_id')::uuid;
   select * into task from public.internal_tasks where workspace_id=target_workspace_id and id=route.internal_task_id;
   if route.purpose is distinct from 'draft' or route.outreach_engagement_id is distinct from engagement.id
    or task.domain is distinct from 'outreach' or task.task_type is distinct from 'prepare_outreach_draft'
    or task.trigger_type is distinct from 'candidate_action' or task.trigger_reference is distinct from 'candidate_requested_outreach_draft'
    or task.status is distinct from 'running' or task.owner_principal_id is distinct from actor
    or task.opportunity_id is distinct from ref_op or route.outreach_message_id is distinct from message.id then
    raise exception 'Exact running Outreach preparation task owned by this worker is required';
   end if;
  elsif not human then raise exception 'Workers must publish through their exact preparation task'; end if;
  if message.id is not null then
   if message.message_status not in ('draft','review','approved') or message.direction<>'outbound' or message.opportunity_id is distinct from ref_op then
    raise exception 'Create a new message series for a different role or a follow-up'; end if;
   series:=message.draft_series_id;version:=message.version_number+1;
   update public.next_actions set status='superseded' where workspace_id=target_workspace_id and status='open'
    and id in (message.review_next_action_id,message.send_next_action_id);
   update public.outreach_messages set message_status='archived',revision=revision+1,updated_at=now() where workspace_id=target_workspace_id and id=message.id;
  else series:=gen_random_uuid();version:=1; end if;
  insert into public.outreach_messages(workspace_id,outreach_engagement_id,contact_id,opportunity_id,draft_series_id,version_number,
   supersedes_message_id,channel,direction,purpose,subject,content,message_status,approval_status,prepared_by_principal_id,created_by_principal_id)
  values(target_workspace_id,engagement.id,contact.id,ref_op,series,version,message.id,payload->>'channel','outbound',payload->>'purpose',
   payload->>'subject',payload->>'content','review','pending',actor,actor) returning id into new_id;
  insert into public.internal_tasks(workspace_id,opportunity_id,task_type,domain,title,status,waiting_condition,approval_required,idempotency_key)
  values(target_workspace_id,ref_op,'review_outreach_message','outreach','Review the exact outreach draft','waiting','human_review',true,
   'outreach-review:'||new_id::text) returning id into task_id;
  insert into public.outreach_task_links(workspace_id,internal_task_id,outreach_engagement_id,outreach_message_id,purpose,created_by_principal_id)
  values(target_workspace_id,task_id,engagement.id,new_id,'review',actor);
  insert into public.next_actions(workspace_id,opportunity_id,internal_task_id,action_type,title,approval_required)
  values(target_workspace_id,ref_op,task_id,'review','Review and send outreach when you choose',true) returning id into action_id;
  update public.outreach_messages set review_next_action_id=action_id where workspace_id=target_workspace_id and id=new_id;
  if payload ? 'evidence' then
   if jsonb_typeof(payload->'evidence')<>'array' or jsonb_array_length(payload->'evidence')>30 then raise exception 'Evidence must be a bounded array'; end if;
   foreach permission_key in array array['candidate_knowledge.read'] loop
    if not public.has_permission(target_workspace_id,permission_key) then raise exception 'Candidate knowledge read permission is required'; end if;
   end loop;
   for evidence in select value from jsonb_array_elements(payload->'evidence') loop
    evidence_key:=evidence->>'type';evidence_id:=(evidence->>'id')::uuid;
    if evidence_key not in ('evidence_story','project','skill') or evidence_id is null or nullif(btrim(evidence->>'usage_context'),'') is null then raise exception 'Exact candidate evidence and usage context are required'; end if;
    insert into public.outreach_message_evidence(workspace_id,outreach_message_id,evidence_story_id,project_id,skill_id,usage_context,created_by_principal_id)
    values(target_workspace_id,new_id,case when evidence_key='evidence_story' then evidence_id end,
     case when evidence_key='project' then evidence_id end,case when evidence_key='skill' then evidence_id end,evidence->>'usage_context',actor);
   end loop;
  end if;
  if command='complete_draft' then update public.internal_tasks set status='completed',completed_at=now(),result_summary='Versioned outreach draft ready for human review'
   where workspace_id=target_workspace_id and id=task.id; end if;
  update public.outreach_engagements set outreach_state='message_ready' where workspace_id=target_workspace_id and id=engagement.id;
  result:=jsonb_build_object('message_id',new_id,'version_number',version,'review_action_id',action_id,'review_task_id',task_id);
  entity_id:=new_id;entity_type:='outreach_message';summary:='Versioned outreach draft saved for human review';
 elsif command='request_draft' then
  if engagement.id is null or contact.status<>'active' then raise exception 'An active relationship target is required'; end if;
  if message.id is not null and (message.message_status not in ('draft','review','approved') or message.opportunity_id is distinct from ref_op) then raise exception 'Request a new series for a sent message'; end if;
  if exists(select 1 from public.outreach_task_links l join public.internal_tasks t on t.workspace_id=l.workspace_id and t.id=l.internal_task_id
   where l.workspace_id=target_workspace_id and l.outreach_engagement_id=engagement.id and l.purpose='draft'
    and l.outreach_message_id is not distinct from message.id and t.opportunity_id is not distinct from ref_op
    and t.status not in ('completed','cancelled')) then raise exception 'An equivalent preparation request is already active'; end if;
  insert into public.internal_tasks(workspace_id,opportunity_id,task_type,domain,title,description,status,trigger_type,trigger_reference,idempotency_key)
  values(target_workspace_id,ref_op,'prepare_outreach_draft','outreach','Prepare an outreach draft',payload->>'instructions','ready',
   'candidate_action','candidate_requested_outreach_draft','outreach-draft:'||request_id::text) returning id into task_id;
  insert into public.outreach_task_links(workspace_id,internal_task_id,outreach_engagement_id,outreach_message_id,purpose,created_by_principal_id)
  values(target_workspace_id,task_id,engagement.id,message.id,'draft',actor);
  result:=jsonb_build_object('task_id',task_id);entity_id:=task_id;entity_type:='internal_task';summary:='Outreach preparation requested from the existing worker queue';
 elsif command in ('approve_message','mark_sent') then
  if message.id is null or message.direction<>'outbound' or message.message_status not in ('draft','review','approved') then raise exception 'A current unsent outbound version is required'; end if;
  if payload->'confirmed' is distinct from 'true'::jsonb then raise exception 'Explicit confirmation of this exact message version is required'; end if;
  ref_op:=message.opportunity_id;
  if ref_op is not null then
   select * into op from public.opportunities where workspace_id=target_workspace_id and id=ref_op;
   if not public.has_permission(target_workspace_id,'opportunity.read') then raise exception 'Opportunity read permission is required'; end if;
  end if;
  if command='approve_message' then
   if message.message_status='approved' then raise exception 'This message version is already approved'; end if;
   update public.outreach_messages set message_status='approved',approval_status='approved',approved_by_principal_id=actor,approved_at=now(),revision=revision+1,updated_at=now()
    where workspace_id=target_workspace_id and id=message.id;
   update public.next_actions set status='completed',completed_at=now() where workspace_id=target_workspace_id and id=message.review_next_action_id
    and status='open' and (assigned_to_principal_id is null or assigned_to_principal_id=actor);
   if not found then raise exception 'The exact review action is unavailable to this human'; end if;
   select internal_task_id into task_id from public.outreach_task_links where workspace_id=target_workspace_id and outreach_message_id=message.id and purpose='review';
   insert into public.next_actions(workspace_id,opportunity_id,internal_task_id,action_type,title,approval_required)
   values(target_workspace_id,ref_op,task_id,'send','Send the reviewed outreach when you choose',true) returning id into action_id;
   update public.outreach_messages set send_next_action_id=action_id where workspace_id=target_workspace_id and id=message.id;
   result:=jsonb_build_object('message_id',message.id,'send_action_id',action_id);summary:='Exact outreach draft approved without sending';
  else
   occurred:=(payload->>'sent_at')::timestamptz;follow_at:=(payload->>'follow_up_at')::timestamptz;
   if occurred is null or occurred>clock_timestamp()+interval '1 minute' then raise exception 'A valid actual sent time is required'; end if;
   if (follow_at is null and payload->>'follow_up_choice' is distinct from 'none')
    or (follow_at is not null and (follow_at<=greatest(occurred,now()) or payload->>'follow_up_choice'='none')) then
    raise exception 'Choose a future follow-up time or explicitly choose no follow-up';
   end if;
   if payload->>'exact_content' is distinct from message.content then raise exception 'Exact sent content must match this saved version; save edits as a new version'; end if;
   if message.subject is not null and payload->>'exact_subject' is distinct from message.subject then raise exception 'Exact sent subject must match the saved subject'; end if;
   if contact.status<>'active' then raise exception 'An active recipient contact is required'; end if;
   recipient:=payload->'recipient';
   if jsonb_typeof(recipient) is distinct from 'object' or recipient->>'name' is distinct from contact.full_name
    or nullif(btrim(recipient->>'address'),'') is null or octet_length(recipient::text)>2000 then raise exception 'Confirm the exact named recipient and destination'; end if;
   if message.channel='email' and recipient->>'address' is distinct from contact.email then raise exception 'Recipient email changed; review the contact'; end if;
   if message.channel='linkedin' and recipient->>'address' is distinct from contact.linkedin_url then raise exception 'Recipient profile changed; review the contact'; end if;
   if message.channel in ('phone','sms') and recipient->>'address' is distinct from contact.phone then raise exception 'Recipient phone changed; review the contact'; end if;
   update public.next_actions set status='completed',completed_at=now()
    where workspace_id=target_workspace_id and id=coalesce(message.send_next_action_id,message.review_next_action_id)
    and status='open' and (assigned_to_principal_id is null or assigned_to_principal_id=actor);
   if not found then raise exception 'The exact outreach action is unavailable to this human'; end if;
   update public.outreach_messages set message_status='sent',approval_status='approved',approved_by_principal_id=coalesce(approved_by_principal_id,actor),
    approved_at=coalesce(approved_at,now()),sent_by_principal_id=actor,sent_at=occurred,response_status='waiting',
    recipient_snapshot=recipient,opportunity_snapshot=case when ref_op is not null then jsonb_build_object('id',op.id,'title',op.title,'company_id',op.company_id) end,
    external_reference=nullif(payload->>'external_reference',''),revision=revision+1,updated_at=now()
    where workspace_id=target_workspace_id and id=message.id;
   if payload->>'resolves_follow_up_task_id' is not null then
    select t.* into task from public.internal_tasks t join public.outreach_task_links l on l.workspace_id=t.workspace_id and l.internal_task_id=t.id
     where t.workspace_id=target_workspace_id and t.id=(payload->>'resolves_follow_up_task_id')::uuid
      and l.outreach_engagement_id=engagement.id and l.purpose='follow_up' and t.opportunity_id is not distinct from ref_op
      and t.task_type='outreach_follow_up' and t.domain='outreach' and t.status not in ('completed','cancelled');
    if not found then raise exception 'Exact previous follow-up task is unavailable'; end if;
    if exists(select 1 from public.next_actions where workspace_id=target_workspace_id and internal_task_id=task.id and status='open'
     and assigned_to_principal_id is not null and assigned_to_principal_id<>actor) then raise exception 'Follow-up action belongs to another human'; end if;
    update public.next_actions set status='completed',completed_at=now() where workspace_id=target_workspace_id and internal_task_id=task.id and status='open';
    update public.internal_tasks set status='completed',completed_at=now(),result_summary='Human recorded an exact subsequent outreach message'
     where workspace_id=target_workspace_id and id=task.id;
   end if;
   select internal_task_id into task_id from public.outreach_task_links where workspace_id=target_workspace_id and outreach_message_id=message.id and purpose='review';
   update public.internal_tasks set status='completed',completed_at=now(),result_summary='Human recorded the exact sent outreach'
    where workspace_id=target_workspace_id and id=task_id and status not in ('completed','cancelled');
   task_id:=null;
   if follow_at is not null then
   insert into public.internal_tasks(workspace_id,opportunity_id,task_type,domain,title,status,not_before,waiting_condition,
    trigger_type,trigger_reference,idempotency_key)
   values(target_workspace_id,ref_op,'outreach_follow_up','outreach','Check for an outreach response','waiting',follow_at,
    'outreach_response_or_due','candidate_action','candidate_recorded_outreach_sent','outreach-follow-up:'||message.id::text) returning id into task_id;
   insert into public.outreach_task_links(workspace_id,internal_task_id,outreach_engagement_id,outreach_message_id,purpose,created_by_principal_id)
   values(target_workspace_id,task_id,engagement.id,message.id,'follow_up',actor);
   end if;
   update public.outreach_engagements set outreach_state=case when follow_at is null then 'contacted' else 'waiting' end,last_meaningful_interaction_at=greatest(last_meaningful_interaction_at,occurred),
    next_follow_up_at=follow_at where workspace_id=target_workspace_id and id=engagement.id;
   result:=jsonb_build_object('message_id',message.id,'follow_up_task_id',task_id);summary:='Human confirmed exact outreach was sent externally';
  end if;
  entity_id:=message.id;entity_type:='outreach_message';
 elsif command='resolve_follow_up' then
  if engagement.id is null or nullif(btrim(payload->>'reason'),'') is null then raise exception 'Engagement and follow-up decision reason are required'; end if;
  select t.* into task from public.internal_tasks t join public.outreach_task_links l on l.workspace_id=t.workspace_id and l.internal_task_id=t.id
   where t.workspace_id=target_workspace_id and t.id=(payload->>'task_id')::uuid and l.outreach_engagement_id=engagement.id
    and l.purpose='follow_up' and t.domain='outreach' and t.task_type='outreach_follow_up' and t.status not in ('completed','cancelled');
  if not found then raise exception 'Exact follow-up task is unavailable'; end if;
  if exists(select 1 from public.next_actions where workspace_id=target_workspace_id and internal_task_id=task.id and status='open'
   and assigned_to_principal_id is not null and assigned_to_principal_id<>actor) then raise exception 'Follow-up action belongs to another human'; end if;
  update public.next_actions set status='completed',completed_at=now() where workspace_id=target_workspace_id and internal_task_id=task.id and status='open';
  update public.internal_tasks set status='completed',completed_at=now(),result_summary='Human resolved follow-up review: '||btrim(payload->>'reason')
   where workspace_id=target_workspace_id and id=task.id;
  ref_op:=task.opportunity_id;result:=jsonb_build_object('task_id',task.id);entity_id:=task.id;entity_type:='internal_task';summary:='Human resolved outreach follow-up without claiming a send';
 elsif command='record_received' then
  if engagement.id is null or nullif(btrim(payload->>'source_system'),'') is null or nullif(btrim(payload->>'external_reference'),'') is null then raise exception 'Engagement and verified external source reference are required'; end if;
  occurred:=(payload->>'received_at')::timestamptz;
  if occurred is null or occurred>clock_timestamp()+interval '1 minute' then raise exception 'A valid received time is required'; end if;
  if exists(select 1 from public.outreach_messages where workspace_id=target_workspace_id and channel=payload->>'channel'
   and direction='inbound' and external_reference=payload->>'external_reference') then raise exception 'External message is already recorded'; end if;
  if payload->>'response_to_message_id' is not null then
   select * into message from public.outreach_messages where workspace_id=target_workspace_id and id=(payload->>'response_to_message_id')::uuid;
   if not found or message.outreach_engagement_id<>engagement.id or message.message_status<>'sent' or message.opportunity_id is distinct from ref_op then raise exception 'Response must identify an exact sent message in this workstream'; end if;
   if occurred<message.sent_at then raise exception 'Response cannot precede the sent message'; end if;
  end if;
  insert into public.outreach_messages(workspace_id,outreach_engagement_id,contact_id,opportunity_id,draft_series_id,version_number,
   channel,direction,subject,content,message_status,received_at,response_to_message_id,external_reference,recipient_snapshot,created_by_principal_id)
  values(target_workspace_id,engagement.id,contact.id,ref_op,gen_random_uuid(),1,payload->>'channel','inbound',payload->>'subject',payload->>'content',
   'received',occurred,message.id,payload->>'external_reference',jsonb_build_object('name',contact.full_name,'email',contact.email,'linkedin_url',contact.linkedin_url),actor) returning id into new_id;
  -- A general message never cancels an unrelated follow-up. Only explicit
  -- response_to resolves the exact sent-message wait task and its action.
  if message.id is not null then
   for task in select t.* from public.internal_tasks t join public.outreach_task_links l on l.workspace_id=t.workspace_id and l.internal_task_id=t.id
    where t.workspace_id=target_workspace_id and l.outreach_message_id=message.id and l.purpose='follow_up' and t.status not in ('completed','cancelled') loop
    update public.next_actions set status='superseded' where workspace_id=target_workspace_id and internal_task_id=task.id and status='open';
    update public.internal_tasks set status='completed',completed_at=now(),result_summary='Exact outreach response received' where workspace_id=target_workspace_id and id=task.id;
   end loop;
  end if;
  insert into public.internal_tasks(workspace_id,opportunity_id,task_type,domain,title,status,waiting_condition,idempotency_key)
  values(target_workspace_id,ref_op,'review_outreach_response','outreach','Review the outreach response','waiting','human_response_review','outreach-response:'||new_id::text) returning id into task_id;
  insert into public.outreach_task_links(workspace_id,internal_task_id,outreach_engagement_id,outreach_message_id,purpose,created_by_principal_id)
  values(target_workspace_id,task_id,engagement.id,new_id,'review',actor);
  insert into public.next_actions(workspace_id,opportunity_id,internal_task_id,action_type,title)
  values(target_workspace_id,ref_op,task_id,'review','Review the outreach response') returning id into action_id;
  update public.outreach_engagements set outreach_state='engaged',last_meaningful_interaction_at=greatest(last_meaningful_interaction_at,occurred)
   where workspace_id=target_workspace_id and id=engagement.id;
  result:=jsonb_build_object('message_id',new_id,'review_action_id',action_id);entity_id:=new_id;entity_type:='outreach_message';summary:='Verified outreach response recorded';
 elsif command='record_interaction' then
  if engagement.id is null then raise exception 'An engagement is required'; end if;
  occurred:=(payload->>'occurred_at')::timestamptz;
  if occurred is null or occurred>clock_timestamp()+interval '1 minute' then raise exception 'A valid actual interaction time is required'; end if;
  insert into public.outreach_interactions(workspace_id,outreach_engagement_id,contact_id,opportunity_id,interaction_type,summary,occurred_at,source_system,source_reference,created_by_principal_id)
  values(target_workspace_id,engagement.id,contact.id,ref_op,payload->>'interaction_type',payload->>'summary',occurred,payload->>'source_system',payload->>'source_reference',actor) returning id into new_id;
  update public.outreach_engagements set last_meaningful_interaction_at=greatest(last_meaningful_interaction_at,occurred),
   outreach_state=case when outreach_state in ('not_started','target_identified') then 'warming' else outreach_state end
   where workspace_id=target_workspace_id and id=engagement.id;
  result:=jsonb_build_object('interaction_id',new_id);entity_id:=new_id;entity_type:='outreach_interaction';summary:='Professional relationship interaction recorded';
 elsif command='add_note' then
  if contact.id is null or (engagement.id is not null and contact.id<>(payload->>'contact_id')::uuid) then raise exception 'Matching contact and workstream are required'; end if;
  if not human and payload->>'validation_status'='confirmed' then raise exception 'Agent notes cannot assert candidate confirmation'; end if;
  insert into public.relationship_notes(workspace_id,contact_id,outreach_engagement_id,note_type,note_text,validation_status,created_by_principal_id)
  values(target_workspace_id,contact.id,engagement.id,coalesce(payload->>'note_type','professional_context'),payload->>'note_text',payload->>'validation_status',actor) returning id into new_id;
  result:=jsonb_build_object('note_id',new_id);entity_id:=contact.id;entity_type:='contact';summary:='Professional relationship context recorded';
 elsif command='reconcile_follow_up' then
  select * into route from public.outreach_task_links where workspace_id=target_workspace_id and internal_task_id=(payload->>'task_id')::uuid;
  select * into task from public.internal_tasks where workspace_id=target_workspace_id and id=route.internal_task_id;
  select * into message from public.outreach_messages where workspace_id=target_workspace_id and id=route.outreach_message_id;
  select * into engagement from public.outreach_engagements where workspace_id=target_workspace_id and id=route.outreach_engagement_id;
  if route.purpose is distinct from 'follow_up' or task.domain is distinct from 'outreach' or task.task_type is distinct from 'outreach_follow_up'
   or task.owner_principal_id is distinct from actor or task.status not in ('waiting','ready','running') or message.message_status is distinct from 'sent'
   or engagement.status is distinct from 'active' then raise exception 'Exact owned Outreach wait task is required'; end if;
  ref_op:=task.opportunity_id;
  if exists(select 1 from public.outreach_messages where workspace_id=target_workspace_id and response_to_message_id=message.id and direction='inbound') then
   result:=jsonb_build_object('disposition','responded','task_id',task.id);
  elsif task.not_before is null or task.not_before>now() then raise exception 'Follow-up is not due';
  else
   select id into action_id from public.next_actions where workspace_id=target_workspace_id and internal_task_id=task.id and action_type='follow_up';
   if action_id is null then
    insert into public.next_actions(workspace_id,opportunity_id,internal_task_id,action_type,title,due_at)
    values(target_workspace_id,ref_op,task.id,'follow_up','Review whether outreach follow-up is worthwhile',task.not_before) returning id into action_id;
   end if;
   result:=jsonb_build_object('disposition','candidate_review','action_id',action_id);
  end if;
  entity_id:=task.id;entity_type:='internal_task';summary:='Outreach waiting condition reconciled without sending';
 end if;
 if engagement.id is not null and command<>'add_note' then
  update public.outreach_engagements set revision=revision+1,updated_at=now(),updated_by_principal_id=actor
   where workspace_id=target_workspace_id and id=engagement.id;
  -- Cache the earliest outstanding wait only; authoritative task state wins.
  update public.outreach_engagements set next_follow_up_at=(select min(t.not_before)
   from public.internal_tasks t join public.outreach_task_links l on l.workspace_id=t.workspace_id and l.internal_task_id=t.id
   where l.workspace_id=target_workspace_id and l.outreach_engagement_id=engagement.id and l.purpose='follow_up' and t.status not in ('completed','cancelled'))
   where workspace_id=target_workspace_id and id=engagement.id;
  result:=result||jsonb_build_object('engagement_revision',engagement.revision+1);
  entity_id:=coalesce(entity_id,engagement.id);entity_type:=coalesce(entity_type,'outreach_engagement');
 end if;
 insert into public.activity_events(workspace_id,opportunity_id,event_type,event_timestamp,actor_principal_id,summary,details,source_system,
  source_reference,idempotency_key,created_by_principal_id)
 values(target_workspace_id,ref_op,'outreach_'||command,coalesce(occurred,now()),actor,summary,
  jsonb_build_object('request',input,'result',result)::text,
  case when command in ('record_received','record_interaction') then payload->>'source_system' else 'job_hunt_hq' end,
  case when command='record_received' then payload->>'external_reference' when command='record_interaction' then payload->>'source_reference' else request_id::text end,
  'hq-outreach:'||actor::text||':'||request_id::text,actor) returning id into event_id;
 insert into public.activity_event_links(workspace_id,activity_event_id,entity_type,entity_id,relationship_type)
 values(target_workspace_id,event_id,entity_type,entity_id,'outreach_domain');
 if engagement.id is not null and entity_type<>'outreach_engagement' then
  insert into public.activity_event_links(workspace_id,activity_event_id,entity_type,entity_id)
  values(target_workspace_id,event_id,'outreach_engagement',engagement.id);
 end if;
 -- Relationship-wide activity is discoverable from every linked role without
 -- moving or closing any backend Opportunity and without duplicating the event.
 if engagement.id is not null then
  insert into public.activity_event_links(workspace_id,activity_event_id,entity_type,entity_id)
  select target_workspace_id,event_id,'opportunity',opportunity_id from public.outreach_engagement_opportunities
   where workspace_id=target_workspace_id and outreach_engagement_id=engagement.id and is_current;
 end if;
 return result;
end $$;
revoke all on function private.hq_outreach_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function private.hq_outreach_action(uuid,uuid,text,jsonb) to authenticated;
create function public.hq_outreach_action(target_workspace_id uuid,request_id uuid,command text,payload jsonb default '{}'::jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select private.hq_outreach_action(target_workspace_id,request_id,command,payload);
$$;
revoke all on function public.hq_outreach_action(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.hq_outreach_action(uuid,uuid,text,jsonb) to authenticated;
commit;
