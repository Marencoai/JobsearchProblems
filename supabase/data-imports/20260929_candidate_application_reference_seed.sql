-- Candidate application data seed
-- Diana Job Search workspace
-- User-approved employment exit reasons + professional references
-- Generated 2026-09-29

begin;

do $auth$
declare
  v_auth uuid;
begin
  select auth_user_id into v_auth
  from public.principals
  where id='5d469573-deae-4500-bacb-4bbecffad83b'::uuid;

  if v_auth is null then
    raise exception 'Owner auth user missing';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object('sub',v_auth::text,'role','authenticated')::text,
    true
  );
end
$auth$;

-- ------------------------------------------------------------
-- Employment-specific application facts
-- ------------------------------------------------------------

insert into public.work_experience_application_details (
  workspace_id,
  work_experience_id,
  reason_for_leaving,
  may_contact_employer,
  employer_contact_note,
  validation_status,
  source_type,
  source_reference
)
select
  '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,
  we.id,
  v.reason_for_leaving,
  true,
  v.contact_note,
  'confirmed',
  'candidate_confirmed',
  'ChatGPT calibration 2026-09-29'
from (
  values
    ('Alpine Development Collaborative',
     'Contract ended.',
     null::text),
    ('Levo Funding',
     'Leadership transition and change in company direction; accepted an opportunity to lead an AI-focused platform build.',
     'Business is no longer active; use the confirmed professional reference contact if employment verification or a reference is requested.'),
    ('Backd Business Funding',
     'Contract completed after successfully launching the satellite sales office.',
     null::text),
    ('Reliant Funding',
     'Company ceased operations.',
     'Business is no longer active; use the confirmed professional reference contact if employment verification or a reference is requested.'),
    ('Ferrari & Maserati of San Diego',
     'Role ended during COVID-19 dealership shutdowns.',
     null::text),
    ('Choice Financial Debt Relief',
     'Accepted an opportunity to move from sales management into operations leadership at a larger company and expand my skill set.',
     null::text),
    ('Park Place Mercedes-Benz',
     'Relocated to California and pursued a career transition into financial services.',
     null::text)
) as v(company_name, reason_for_leaving, contact_note)
join public.work_experiences we
  on we.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
 and we.company_name=v.company_name
on conflict (workspace_id, work_experience_id)
do update set
  reason_for_leaving=excluded.reason_for_leaving,
  may_contact_employer=excluded.may_contact_employer,
  employer_contact_note=excluded.employer_contact_note,
  validation_status='confirmed',
  source_type='candidate_confirmed',
  source_reference='ChatGPT calibration 2026-09-29';

-- ------------------------------------------------------------
-- Professional references
-- ------------------------------------------------------------

create temporary table _reference_seed (
  full_name text,
  email text,
  phone text,
  reference_title text,
  reference_company text,
  relationship_summary text,
  preferred_contact_method text
) on commit drop;

insert into _reference_seed values
  ('Mariana Crawford','mc@alpinecollab.org','503-709-5200','CEO','Alpine Development Collaborative',
   'Supervisor/reference for Alpine Development Collaborative.','either'),
  ('Christopher Ives',null,'480-221-6552',null,null,
   'Supervisor at Levo Funding and Reliant Funding. Both businesses are no longer active.','phone'),
  ('Mychail Myburg','michail@tasksuite.com','512-574-8115',null,null,
   'Employment reference for Backd Business Funding.','either'),
  ('Brian Durocher',null,'619-987-9357',null,null,
   'Employment reference for Choice Financial Debt Relief.','phone'),
  ('Larry Suarez',null,'858-602-9631',null,null,
   'Employment reference for Ferrari & Maserati of San Diego.','phone'),
  ('Randy Hernandez',null,'469-733-6922',null,null,
   'Employment reference for Park Place Mercedes-Benz.','phone'),
  ('Ryan Goodman','ryan@goodmangroupllc.com','858-699-7143','Head of Analytics','Reliant Funding',
   'Head of Analytics at Reliant Funding; professional reference and well known in the space.','either'),
  ('Ellie Obando','ellieobando@gmail.com','917-841-6793',null,null,
   'Colleague at Reliant Funding and Alpine Development Collaborative.','either'),
  ('Sarah Antonopoulos','sarahantonopoulos@yahoo.com','619-206-2557',null,null,
   'Colleague at Choice Financial Debt Relief, Ferrari & Maserati of San Diego, Reliant Funding, and Levo Funding.','either');

insert into public.professional_references (
  workspace_id,
  full_name,
  email,
  phone,
  reference_title,
  reference_company,
  relationship_summary,
  may_contact,
  preferred_contact_method,
  status,
  validation_status,
  source_type,
  source_reference
)
select
  '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,
  s.full_name,
  s.email,
  s.phone,
  s.reference_title,
  s.reference_company,
  s.relationship_summary,
  true,
  s.preferred_contact_method,
  'active',
  'confirmed',
  'candidate_confirmed',
  'ChatGPT calibration 2026-09-29'
from _reference_seed s
where not exists (
  select 1
  from public.professional_references pr
  where pr.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
    and lower(pr.full_name)=lower(s.full_name)
    and coalesce(pr.phone,'')=coalesce(s.phone,'')
);

update public.professional_references pr
set
  email=s.email,
  phone=s.phone,
  reference_title=s.reference_title,
  reference_company=s.reference_company,
  relationship_summary=s.relationship_summary,
  may_contact=true,
  preferred_contact_method=s.preferred_contact_method,
  status='active',
  validation_status='confirmed',
  source_type='candidate_confirmed',
  source_reference='ChatGPT calibration 2026-09-29'
from _reference_seed s
where pr.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
  and lower(pr.full_name)=lower(s.full_name)
  and coalesce(pr.phone,'')=coalesce(s.phone,'');

-- ------------------------------------------------------------
-- Link references to Work Experiences
-- ------------------------------------------------------------

create temporary table _reference_links (
  company_name text,
  reference_name text,
  reference_phone text,
  relationship_type text,
  title_at_time text,
  relationship_context text,
  is_primary boolean
) on commit drop;

insert into _reference_links values
  ('Alpine Development Collaborative','Mariana Crawford','503-709-5200','supervisor','CEO',
   'Supervisor/reference for Alpine Development Collaborative.',true),
  ('Alpine Development Collaborative','Ellie Obando','917-841-6793','colleague',null,
   'Colleague at Alpine Development Collaborative.',false),

  ('Levo Funding','Christopher Ives','480-221-6552','supervisor',null,
   'Supervisor at Levo Funding.',true),
  ('Levo Funding','Sarah Antonopoulos','619-206-2557','colleague',null,
   'Colleague at Levo Funding.',false),

  ('Backd Business Funding','Mychail Myburg','512-574-8115','employment_reference',null,
   'Employment reference for Backd Business Funding.',true),

  ('Reliant Funding','Christopher Ives','480-221-6552','supervisor',null,
   'Supervisor at Reliant Funding.',true),
  ('Reliant Funding','Ryan Goodman','858-699-7143','industry_reference','Head of Analytics',
   'Head of Analytics at Reliant Funding and a well-known professional in the space.',false),
  ('Reliant Funding','Ellie Obando','917-841-6793','colleague',null,
   'Colleague at Reliant Funding.',false),
  ('Reliant Funding','Sarah Antonopoulos','619-206-2557','colleague',null,
   'Colleague at Reliant Funding.',false),

  ('Ferrari & Maserati of San Diego','Larry Suarez','858-602-9631','employment_reference',null,
   'Employment reference for Ferrari & Maserati of San Diego.',true),
  ('Ferrari & Maserati of San Diego','Sarah Antonopoulos','619-206-2557','colleague',null,
   'Colleague at Ferrari & Maserati of San Diego.',false),

  ('Choice Financial Debt Relief','Brian Durocher','619-987-9357','employment_reference',null,
   'Employment reference for Choice Financial Debt Relief.',true),
  ('Choice Financial Debt Relief','Sarah Antonopoulos','619-206-2557','colleague',null,
   'Colleague at Choice Financial Debt Relief.',false),

  ('Park Place Mercedes-Benz','Randy Hernandez','469-733-6922','employment_reference',null,
   'Employment reference for Park Place Mercedes-Benz.',true);

insert into public.work_experience_references (
  workspace_id,
  work_experience_id,
  professional_reference_id,
  relationship_type,
  title_at_time,
  relationship_context,
  is_primary,
  is_active,
  validation_status
)
select
  '9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid,
  we.id,
  pr.id,
  l.relationship_type,
  l.title_at_time,
  l.relationship_context,
  l.is_primary,
  true,
  'confirmed'
from _reference_links l
join public.work_experiences we
  on we.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
 and we.company_name=l.company_name
join public.professional_references pr
  on pr.workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
 and lower(pr.full_name)=lower(l.reference_name)
 and coalesce(pr.phone,'')=coalesce(l.reference_phone,'')
on conflict (workspace_id, work_experience_id, professional_reference_id)
do update set
  relationship_type=excluded.relationship_type,
  title_at_time=excluded.title_at_time,
  relationship_context=excluded.relationship_context,
  is_primary=excluded.is_primary,
  is_active=true,
  validation_status='confirmed';

-- ------------------------------------------------------------
-- Teach the live Application workflow where these answers live
-- ------------------------------------------------------------

update public.automation_policies
set
  rules =
    jsonb_set(
      rules,
      '{collect}',
      case
        when (rules->'collect') ? 'reference_fields'
          then rules->'collect'
        else (rules->'collect') || '["reference_fields"]'::jsonb
      end
    )
    ||
    jsonb_build_object(
      'candidate_application_data_sources',
      jsonb_build_object(
        'employment_exit_details','work_experience_application_details',
        'professional_references','professional_references',
        'work_experience_reference_links','work_experience_references'
      ),
      'employment_history_answer_rule',
      'Use confirmed work_experience_application_details for reason-for-leaving and may-contact-employer answers. Never invent a reason or permission value.',
      'reference_answer_rule',
      'Use active confirmed professional references with may_contact=true. For employer-specific reference requests, prefer the active confirmed is_primary work_experience_references link, then other confirmed linked references. Never invent missing title, email, or phone values.'
    ),
  updated_at=now()
where workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
  and action_key='application.form_discovery';

update public.automation_policies
set
  rules =
    rules
    ||
    jsonb_build_object(
      'candidate_application_data',
      'Read confirmed work_experience_application_details, professional_references, and work_experience_references whenever the ATS asks employment-history exit reasons, employer-contact permission, or references. Missing fields remain candidate questions; never invent them.'
    ),
  updated_at=now()
where workspace_id='9341c194-c4f6-45c4-b3b1-37a832a7fc68'::uuid
  and action_key='application.queue';

commit;
