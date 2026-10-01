-- PROPOSED ONLY; apply after separately reviewed Outreach contacts migration.
-- Requires public.contacts(id, workspace_id) UNIQUE(workspace_id,id).
-- No contacts creation, grants, or RLS changes are included here.
begin;
alter table public.interview_processes add column recruiter_contact_id uuid;
alter table public.interview_processes add constraint interview_processes_recruiter_workspace_fk foreign key(workspace_id,recruiter_contact_id) references public.contacts(workspace_id,id) on delete restrict;
create index interview_processes_recruiter_idx on public.interview_processes(workspace_id,recruiter_contact_id);
create table public.interview_contacts(
 id uuid primary key default gen_random_uuid(), workspace_id uuid not null references public.workspaces(id) on delete restrict,
 interview_id uuid not null, contact_id uuid not null, interviewer_role text, is_primary boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 created_by_principal_id uuid references public.principals(id), updated_by_principal_id uuid references public.principals(id),
 unique(workspace_id,id), unique(workspace_id,interview_id,contact_id),
 foreign key(workspace_id,interview_id) references public.interviews(workspace_id,id) on delete restrict,
 foreign key(workspace_id,contact_id) references public.contacts(workspace_id,id) on delete restrict
);
create index interview_contacts_contact_idx on public.interview_contacts(workspace_id,contact_id);
alter table public.interview_contacts enable row level security;
revoke all on public.interview_contacts from public,anon,authenticated;
grant select,insert,update on public.interview_contacts to authenticated;
create policy interview_contacts_read on public.interview_contacts for select to authenticated using(public.has_permission(workspace_id,'interview.read') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_contacts_create on public.interview_contacts for insert to authenticated with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create policy interview_contacts_update on public.interview_contacts for update to authenticated using(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active')) with check(public.current_principal_is_human() and public.is_active_workspace_human(workspace_id,public.current_principal_id()) and public.has_permission(workspace_id,'interview.manage') and exists(select 1 from public.workspaces w where w.id=workspace_id and w.status='active'));
create trigger a_guard before insert or update on public.interview_contacts for each row execute function public.hq_interview_guard();
create trigger b_actor before insert or update on public.interview_contacts for each row execute function public.set_actor_audit_fields();
create trigger c_updated before update on public.interview_contacts for each row execute function public.set_updated_at();
create index interview_contacts_creator_idx on public.interview_contacts(created_by_principal_id);
create index interview_contacts_updater_idx on public.interview_contacts(updated_by_principal_id);
commit;
