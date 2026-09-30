-- ============================================================
-- Job Search AI Agent
-- Candidate Application Data: Employment Exit Details + References
-- ============================================================
--
-- Adds application-specific candidate data without mixing it into
-- the general Candidate Knowledge evidence model.
--
-- Creates:
--   candidate_application_data permissions
--   work_experience_application_details
--   professional_references
--   work_experience_references
--
-- Application Agent receives READ ONLY access.
-- Owner retains create/update/validation authority.
-- ============================================================

-- ============================================================
-- 1. PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values
    (
        'candidate_application_data.read',
        'candidate_application_data',
        'read',
        'View reusable candidate application facts and professional references'
    ),
    (
        'candidate_application_data.create',
        'candidate_application_data',
        'create',
        'Create reusable candidate application facts and professional references'
    ),
    (
        'candidate_application_data.update',
        'candidate_application_data',
        'update',
        'Update reusable candidate application facts and professional references'
    ),
    (
        'candidate_application_data.validate',
        'candidate_application_data',
        'validate',
        'Confirm or reject reusable candidate application facts and professional references'
    )
on conflict (permission_key) do nothing;

-- Owner gets full authority.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.workspace_id is null
  and lower(r.name) = 'owner'
  and p.permission_key in (
      'candidate_application_data.read',
      'candidate_application_data.create',
      'candidate_application_data.update',
      'candidate_application_data.validate'
  )
on conflict (role_id, permission_id) do nothing;

-- Existing/future Application Agent roles get read-only access.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where lower(r.name) = 'application agent'
  and p.permission_key = 'candidate_application_data.read'
on conflict (role_id, permission_id) do nothing;

-- ============================================================
-- 2. VALIDATION GUARD
-- ============================================================

create or replace function public.enforce_candidate_application_data_validation()
returns trigger
language plpgsql
set search_path = public
as $$
declare
    may_validate boolean;
begin
    may_validate := public.has_permission(
        new.workspace_id,
        'candidate_application_data.validate'
    );

    if tg_op = 'INSERT' then
        if new.validation_status in ('confirmed', 'rejected')
           and not may_validate then
            raise exception
                'Permission candidate_application_data.validate is required to create confirmed or rejected candidate application data';
        end if;
        return new;
    end if;

    if tg_op = 'UPDATE' then
        if old.validation_status is distinct from new.validation_status
           and not may_validate then
            raise exception
                'Permission candidate_application_data.validate is required to change validation status';
        end if;

        if old.validation_status in ('confirmed', 'rejected')
           and not may_validate then
            raise exception
                'Confirmed or rejected candidate application data requires validation permission to modify';
        end if;

        return new;
    end if;

    return new;
end;
$$;

-- ============================================================
-- 3. WORK EXPERIENCE APPLICATION DETAILS
-- ============================================================

create table public.work_experience_application_details (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    work_experience_id uuid not null,

    reason_for_leaving text null,
    may_contact_employer boolean null,
    employer_contact_note text null,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    source_type text null,
    source_reference text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint work_experience_application_details_workspace_id_id_unique
        unique (workspace_id, id),

    constraint work_experience_application_details_one_per_work_experience
        unique (workspace_id, work_experience_id),

    constraint work_experience_application_details_work_workspace_fk
        foreign key (workspace_id, work_experience_id)
        references public.work_experiences(workspace_id, id)
        on delete cascade
);

create index work_experience_application_details_work_idx
on public.work_experience_application_details(
    workspace_id,
    work_experience_id
);

create trigger set_work_experience_application_details_updated_at
before update on public.work_experience_application_details
for each row
execute function public.set_updated_at();

create trigger set_work_experience_application_details_actor
before insert or update on public.work_experience_application_details
for each row
execute function public.set_actor_audit_fields();

create trigger prevent_work_experience_application_details_workspace_change
before update of workspace_id
on public.work_experience_application_details
for each row
execute function public.prevent_workspace_change();

create trigger enforce_work_experience_application_details_validation
before insert or update
on public.work_experience_application_details
for each row
execute function public.enforce_candidate_application_data_validation();

-- ============================================================
-- 4. PROFESSIONAL REFERENCES
-- ============================================================

create table public.professional_references (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    full_name text not null,
    email text null,
    phone text null,

    reference_title text null,
    reference_company text null,
    relationship_summary text null,

    may_contact boolean not null default false,

    preferred_contact_method text null
        check (
            preferred_contact_method is null
            or preferred_contact_method in (
                'phone',
                'email',
                'either'
            )
        ),

    notes text null,

    status text not null default 'active'
        check (
            status in (
                'active',
                'archived'
            )
        ),

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    source_type text null,
    source_reference text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint professional_references_workspace_id_id_unique
        unique (workspace_id, id),

    constraint professional_references_name_nonblank
        check (nullif(btrim(full_name), '') is not null)
);

create index professional_references_workspace_idx
on public.professional_references(workspace_id);

create index professional_references_active_idx
on public.professional_references(workspace_id, status);

create trigger set_professional_references_updated_at
before update on public.professional_references
for each row
execute function public.set_updated_at();

create trigger set_professional_references_actor
before insert or update on public.professional_references
for each row
execute function public.set_actor_audit_fields();

create trigger prevent_professional_references_workspace_change
before update of workspace_id
on public.professional_references
for each row
execute function public.prevent_workspace_change();

create trigger enforce_professional_references_validation
before insert or update
on public.professional_references
for each row
execute function public.enforce_candidate_application_data_validation();

-- ============================================================
-- 5. WORK EXPERIENCE ↔ PROFESSIONAL REFERENCE
-- ============================================================

create table public.work_experience_references (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    work_experience_id uuid not null,
    professional_reference_id uuid not null,

    relationship_type text not null
        check (
            relationship_type in (
                'supervisor',
                'colleague',
                'employment_reference',
                'industry_reference',
                'client',
                'other'
            )
        ),

    title_at_time text null,
    relationship_context text null,

    is_primary boolean not null default false,
    is_active boolean not null default true,

    validation_status text not null
        default 'candidate_review_needed'
        check (
            validation_status in (
                'confirmed',
                'candidate_review_needed',
                'inferred',
                'rejected'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint work_experience_references_workspace_id_id_unique
        unique (workspace_id, id),

    constraint work_experience_references_unique
        unique (
            workspace_id,
            work_experience_id,
            professional_reference_id
        ),

    constraint work_experience_references_work_workspace_fk
        foreign key (workspace_id, work_experience_id)
        references public.work_experiences(workspace_id, id)
        on delete cascade,

    constraint work_experience_references_reference_workspace_fk
        foreign key (workspace_id, professional_reference_id)
        references public.professional_references(workspace_id, id)
        on delete restrict
);

create unique index work_experience_references_one_primary
on public.work_experience_references(
    workspace_id,
    work_experience_id
)
where is_primary = true
  and is_active = true
  and validation_status <> 'rejected';

create index work_experience_references_reference_idx
on public.work_experience_references(
    workspace_id,
    professional_reference_id
);

create trigger set_work_experience_references_updated_at
before update on public.work_experience_references
for each row
execute function public.set_updated_at();

create trigger set_work_experience_references_actor
before insert or update on public.work_experience_references
for each row
execute function public.set_actor_audit_fields();

create trigger prevent_work_experience_references_workspace_change
before update of workspace_id
on public.work_experience_references
for each row
execute function public.prevent_workspace_change();

create trigger enforce_work_experience_references_validation
before insert or update
on public.work_experience_references
for each row
execute function public.enforce_candidate_application_data_validation();

-- ============================================================
-- 6. RLS
-- ============================================================

alter table public.work_experience_application_details enable row level security;
alter table public.professional_references enable row level security;
alter table public.work_experience_references enable row level security;

create policy "authorized principals can view work experience application details"
on public.work_experience_application_details
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.read'
    )
);

create policy "authorized principals can create work experience application details"
on public.work_experience_application_details
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.create'
    )
);

create policy "authorized principals can update work experience application details"
on public.work_experience_application_details
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
);

create policy "authorized principals can view professional references"
on public.professional_references
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.read'
    )
);

create policy "authorized principals can create professional references"
on public.professional_references
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.create'
    )
);

create policy "authorized principals can update professional references"
on public.professional_references
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
);

create policy "authorized principals can view work experience references"
on public.work_experience_references
for select
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.read'
    )
);

create policy "authorized principals can create work experience references"
on public.work_experience_references
for insert
to authenticated
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.create'
    )
);

create policy "authorized principals can update work experience references"
on public.work_experience_references
for update
to authenticated
using (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
)
with check (
    public.has_permission(
        workspace_id,
        'candidate_application_data.update'
    )
);

-- ============================================================
-- 7. TABLE PRIVILEGES
-- ============================================================

revoke all on table public.work_experience_application_details from anon;
revoke all on table public.work_experience_application_details from authenticated;
grant select, insert, update
on table public.work_experience_application_details
to authenticated;

revoke all on table public.professional_references from anon;
revoke all on table public.professional_references from authenticated;
grant select, insert, update
on table public.professional_references
to authenticated;

revoke all on table public.work_experience_references from anon;
revoke all on table public.work_experience_references from authenticated;
grant select, insert, update
on table public.work_experience_references
to authenticated;

-- ============================================================
-- COMPLETE
-- ============================================================
