-- PROPOSED ONLY: manual evidence -> existing discovery queue, and immutable
-- private artifacts for exact Material versions. No production approval yet.
-- Additive: no existing policy, permission, lifecycle or worker authority edits.
-- Storage deployment requires a separate full policy inventory first: permissive
-- policies combine with OR. RESTRICTIVE guards below also constrain any existing
-- broad policies for these two new buckets. No historical backfill/deletion.

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('hq-intake','hq-intake',false,8388608,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','text/plain']),
 ('hq-materials','hq-materials',false,16777216,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);

create table public.application_material_artifacts (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.workspaces(id),
 application_material_id uuid not null,
 format text not null check(format in ('pdf','docx')),
 bucket_id text not null default 'hq-materials' check(bucket_id='hq-materials'),
 storage_path text not null,
 sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
 byte_size bigint not null check(byte_size between 1 and 16777216),
 renderer_key text not null,
 input_sha256 text not null check(input_sha256 ~ '^[a-f0-9]{64}$'),
 source_docx_sha256 text not null check(source_docx_sha256 ~ '^[a-f0-9]{64}$'),
 qa jsonb not null check(jsonb_typeof(qa)='object' and qa ?& array['visual_pass','parse_back_pass','page_count','renderer_key','input_sha256','docx_sha256','pdf_sha256'] and qa->'visual_pass'='true'::jsonb and qa->'parse_back_pass'='true'::jsonb and jsonb_typeof(qa->'page_count')='number' and (qa->>'page_count')::numeric=trunc((qa->>'page_count')::numeric) and jsonb_typeof(qa->'renderer_key')='string' and jsonb_typeof(qa->'input_sha256')='string' and jsonb_typeof(qa->'docx_sha256')='string' and jsonb_typeof(qa->'pdf_sha256')='string'),
 created_by_principal_id uuid not null default public.current_principal_id() references public.principals(id),
 created_at timestamptz not null default now(),
 unique(workspace_id,application_material_id,format),
 unique(bucket_id,storage_path),
 foreign key(workspace_id,application_material_id) references public.application_materials(workspace_id,id) on delete restrict,
 check(storage_path=workspace_id::text || '/' || application_material_id::text || '/' || sha256 || '.' || format),
 check(format <> 'docx' or source_docx_sha256=sha256),
 check(qa->>'renderer_key'=renderer_key and qa->>'input_sha256'=input_sha256 and qa->>'docx_sha256'=source_docx_sha256 and qa->>'pdf_sha256' ~ '^[a-f0-9]{64}$' and (format <> 'pdf' or qa->>'pdf_sha256'=sha256))
);
alter table public.application_material_artifacts enable row level security;
revoke all on public.application_material_artifacts from anon,authenticated;
grant select,insert on public.application_material_artifacts to authenticated;
create policy hq_artifacts_read on public.application_material_artifacts for select to authenticated
 using(public.has_permission(workspace_id,'application.read'));
create policy hq_artifacts_prepare on public.application_material_artifacts for insert to authenticated
 with check(public.has_permission(workspace_id,'application.prepare') and created_by_principal_id=public.current_principal_id());

create function public.hq_check_material_artifact() returns trigger
language plpgsql security invoker set search_path='' as $$
declare m public.application_materials; sibling public.application_material_artifacts;
begin
 select * into m from public.application_materials where workspace_id=new.workspace_id and id=new.application_material_id for update;
 if m.id is null or m.status <> 'draft' or not m.is_current_package_version then raise exception 'Artifacts require the current draft Material'; end if;
 if m.material_type='resume' and (new.renderer_key <> 'executive-brief-two-page-v2' or (new.qa->>'page_count')::integer <> 2) then raise exception 'Resume requires the canonical two-page renderer and QA'; end if;
 if (new.qa->>'page_count')::numeric < 1 or (new.qa->>'page_count')::numeric > 20 then raise exception 'Invalid artifact page count'; end if;
 if not exists(select 1 from storage.objects where bucket_id=new.bucket_id and name=new.storage_path and (metadata->>'size')::bigint=new.byte_size and metadata->>'mimetype'=case new.format when 'pdf' then 'application/pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' end) then raise exception 'Upload the exact private artifact before registration'; end if;
 select * into sibling from public.application_material_artifacts where workspace_id=new.workspace_id and application_material_id=new.application_material_id and format<>new.format;
 if sibling.id is not null and (sibling.input_sha256 <> new.input_sha256 or sibling.source_docx_sha256 <> new.source_docx_sha256 or sibling.renderer_key <> new.renderer_key or sibling.qa <> new.qa) then raise exception 'PDF and DOCX must share the exact source and QA'; end if;
 return new;
end $$;
revoke all on function public.hq_check_material_artifact() from public,anon,authenticated;
create trigger hq_check_material_artifact before insert on public.application_material_artifacts for each row execute function public.hq_check_material_artifact();

-- Read exact objects under existing workspace permissions. Preparation may read
-- uploaded draft bytes for verification before artifact registration.
create function public.hq_storage_read(bucket text, object_name text) returns boolean
language sql stable security invoker set search_path='' as $$
 select case
 when bucket='hq-materials' then exists(
   select 1 from public.application_materials m where m.workspace_id::text=split_part(object_name,'/',1) and m.id::text=split_part(object_name,'/',2)
   and (exists(select 1 from public.application_material_artifacts a where a.workspace_id=m.workspace_id and a.application_material_id=m.id and a.storage_path=object_name)
        or (m.status='draft' and public.has_permission(m.workspace_id,'application.prepare'))))
 when bucket='hq-intake' then exists(
   select 1 from public.workspaces w where w.id::text=split_part(object_name,'/',1)
   and public.has_permission(w.id,'activity.read')
   and (split_part(object_name,'/',2)=public.current_principal_id()::text
        or exists(select 1 from public.activity_events e where e.workspace_id=w.id and e.event_type='manual_job_intake_requested' and case when pg_catalog.pg_input_is_valid(e.details,'jsonb') then e.details::jsonb->'input'->'upload'->>'storage_path'=object_name else false end)))
 else false end;
$$;
create function public.hq_storage_insert(bucket text, object_name text) returns boolean
language sql stable security invoker set search_path='' as $$
 select case
 when bucket='hq-materials' then object_name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9]{64}\.(pdf|docx)$' and exists(
   select 1 from public.application_materials m where m.workspace_id::text=split_part(object_name,'/',1) and m.id::text=split_part(object_name,'/',2) and m.status='draft' and m.is_current_package_version and public.has_permission(m.workspace_id,'application.prepare'))
 when bucket='hq-intake' then object_name ~ '^[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9-]{36}/[a-f0-9]{64}\.(pdf|docx|png|jpg|txt)$' and exists(
   select 1 from public.workspaces w where w.id::text=split_part(object_name,'/',1) and w.status='active' and split_part(object_name,'/',2)=public.current_principal_id()::text and public.is_active_workspace_human(w.id,public.current_principal_id()) and public.has_permission(w.id,'activity.create') and public.has_permission(w.id,'internal_task.create'))
 else false end;
$$;
revoke all on function public.hq_storage_read(text,text),public.hq_storage_insert(text,text) from public,anon;
grant execute on function public.hq_storage_read(text,text),public.hq_storage_insert(text,text) to authenticated;
create policy hq_storage_read on storage.objects for select to authenticated using(public.hq_storage_read(bucket_id,name));
create policy hq_storage_insert on storage.objects for insert to authenticated with check(public.hq_storage_insert(bucket_id,name));
create policy hq_storage_read_guard on storage.objects as restrictive for select to public using(case when bucket_id in ('hq-intake','hq-materials') then public.hq_storage_read(bucket_id,name) else true end);
create policy hq_storage_insert_guard on storage.objects as restrictive for insert to public with check(case when bucket_id in ('hq-intake','hq-materials') then public.hq_storage_insert(bucket_id,name) else true end);
create policy hq_storage_no_update on storage.objects as restrictive for update to public using(bucket_id not in ('hq-intake','hq-materials')) with check(bucket_id not in ('hq-intake','hq-materials'));
create policy hq_storage_no_delete on storage.objects as restrictive for delete to public using(bucket_id not in ('hq-intake','hq-materials'));

create function public.hq_request_job_intake(target_workspace_id uuid, request_id uuid, input jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor uuid := public.current_principal_id(); k text; e public.activity_events; t public.internal_tasks; mode text; u jsonb;
begin
 if request_id is null or actor is null or not public.is_active_workspace_human(target_workspace_id,actor)
 or not exists(select 1 from public.workspaces w where w.id=target_workspace_id and w.status='active')
 or not public.has_permission(target_workspace_id,'activity.create') or not public.has_permission(target_workspace_id,'activity.read')
 or not public.has_permission(target_workspace_id,'internal_task.create') or not public.has_permission(target_workspace_id,'internal_task.read') then raise exception 'Active human intake permission required' using errcode='42501'; end if;
 if jsonb_typeof(input) is distinct from 'object' or exists(select 1 from jsonb_object_keys(input) x where x not in ('mode','url','text','upload')) then raise exception 'Invalid intake input'; end if;
 mode := input->>'mode';
 if mode='url' then
   if input->>'url' is null or length(input->>'url')>2048 or jsonb_typeof(input->'url') is distinct from 'string' or input->>'url' !~ '^https://[A-Za-z0-9][A-Za-z0-9.-]*\.[A-Za-z]{2,63}(/[^[:space:]]*|\?[^[:space:]]*)?$' or input ? 'text' or input ? 'upload' then raise exception 'A public HTTPS job URL is required'; end if;
 elsif mode='text' then
   if jsonb_typeof(input->'text') is distinct from 'string' or length(btrim(coalesce(input->>'text',''))) not between 40 and 100000 or input ? 'url' or input ? 'upload' then raise exception 'Provide the full job description'; end if;
 elsif mode='upload' then
   u := input->'upload';
   if jsonb_typeof(u) is distinct from 'object' or not (u ?& array['storage_path','sha256','byte_size','mime_type','name']) or input ? 'url' or input ? 'text' or exists(select 1 from jsonb_object_keys(u) x where x not in ('storage_path','sha256','byte_size','mime_type','name'))
   or jsonb_typeof(u->'sha256') is distinct from 'string' or jsonb_typeof(u->'storage_path') is distinct from 'string' or jsonb_typeof(u->'name') is distinct from 'string' or jsonb_typeof(u->'mime_type') is distinct from 'string' or jsonb_typeof(u->'byte_size') is distinct from 'number' or u->>'byte_size' !~ '^[0-9]+$' or u->>'sha256' !~ '^[a-f0-9]{64}$' or length(coalesce(u->>'name','')) not between 1 and 200
   or u->>'mime_type' not in ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/png','image/jpeg','text/plain') or u->>'name' ~ '[[:cntrl:]/\\]' or (u->>'byte_size')::bigint not between 1 and 8388608
   or u->>'storage_path' is distinct from (target_workspace_id::text || '/' || actor::text || '/' || request_id::text || '/' || (u->>'sha256') || '.' || case u->>'mime_type' when 'application/pdf' then 'pdf' when 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' then 'docx' when 'image/png' then 'png' when 'image/jpeg' then 'jpg' when 'text/plain' then 'txt' end)
   or not exists(select 1 from storage.objects o where o.bucket_id='hq-intake' and o.name=u->>'storage_path' and (o.metadata->>'size')::bigint=(u->>'byte_size')::bigint and o.metadata->>'mimetype'=u->>'mime_type') then raise exception 'Upload the matching supported job document first'; end if;
 else raise exception 'Choose URL, job description, or upload'; end if;
 k := 'hq:manual-intake:' || actor::text || ':' || request_id::text;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(target_workspace_id::text || k,0));
 select * into e from public.activity_events where workspace_id=target_workspace_id and idempotency_key=k;
 if e.id is not null then
   if e.details::jsonb->'input' is distinct from input then raise exception 'This retry key belongs to different intake evidence' using errcode='40001'; end if;
   select * into t from public.internal_tasks where workspace_id=target_workspace_id and idempotency_key=k || ':task';
   if t.id is null then raise exception 'Recorded intake task is unavailable'; end if;
 else
   insert into public.activity_events(workspace_id,event_type,actor_principal_id,summary,details,source_system,source_reference,idempotency_key)
   values(target_workspace_id,'manual_job_intake_requested',actor,'Job supplied for review',jsonb_build_object('contract_version',1,'source_kind','user_provided','employer_verified',false,'input',input)::text,'job_hunt_hq',request_id::text,k) returning * into e;
   insert into public.internal_tasks(workspace_id,source_activity_event_id,task_type,domain,title,description,status,trigger_type,trigger_reference,idempotency_key)
   values(target_workspace_id,e.id,'job_alert_intake','discovery','Review supplied job',jsonb_build_object('contract_version',1,'source_kind','user_provided','activity_event_id',e.id)::text,'ready','event',e.id::text,k || ':task') returning * into t;
 end if;
 return jsonb_build_object('command','request_job_intake','event_id',e.id,'task_id',t.id,'status',t.status);
end $$;
revoke all on function public.hq_request_job_intake(uuid,uuid,jsonb) from public,anon;
grant execute on function public.hq_request_job_intake(uuid,uuid,jsonb) to authenticated;
