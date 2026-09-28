do $$
declare
  v_workspace_id uuid := '9341c194-c4f6-45c4-b3b1-37a832a7fc68';
  v_owner_principal_id uuid := '5d469573-deae-4500-bacb-4bbecffad83b';
  v_owner_auth_user_id uuid;
  v_agent_auth_user_id uuid;
  v_agent_principal_id uuid;
  v_role_id uuid;
begin
  select auth_user_id into v_owner_auth_user_id
  from public.principals
  where id = v_owner_principal_id
    and principal_type = 'human'
    and status = 'active';

  if v_owner_auth_user_id is null then
    raise exception 'Active human owner principal is missing an auth_user_id';
  end if;

  perform set_config('request.jwt.claim.sub', v_owner_auth_user_id::text, true);

  select id into v_agent_auth_user_id
  from auth.users
  where lower(email) = 'applicationuser@marencoai.com'
  limit 1;

  if v_agent_auth_user_id is null then
    raise exception 'Supabase Auth user applicationuser@marencoai.com was not found';
  end if;

  select id into v_agent_principal_id
  from public.principals
  where auth_user_id = v_agent_auth_user_id;

  if v_agent_principal_id is null then
    insert into public.principals (principal_type, auth_user_id, name, status)
    values ('agent', v_agent_auth_user_id, 'Application Agent', 'active')
    returning id into v_agent_principal_id;
  else
    update public.principals
    set principal_type = 'agent',
        name = 'Application Agent',
        status = 'active'
    where id = v_agent_principal_id;
  end if;

  select id into v_role_id
  from public.roles
  where workspace_id = v_workspace_id
    and lower(name) = 'application agent'
  limit 1;

  if v_role_id is null then
    insert into public.roles (workspace_id, name, description, is_system_role)
    values (
      v_workspace_id,
      'Application Agent',
      'Prepare-only role for application packages and materials. May read required evaluation/candidate context and prepare application artifacts, but may not approve, submit, confirm, modify candidate knowledge, or administer workspace roles.',
      false
    )
    returning id into v_role_id;
  end if;

  insert into public.role_permissions (role_id, permission_id)
  select v_role_id, p.id
  from public.permissions p
  where p.permission_key in (
    'workspace.read',
    'company.read',
    'job_family.read',
    'opportunity.read',
    'opportunity_source.read',
    'company_intelligence.read',
    'candidate_knowledge.read',
    'settings.read',
    'evaluation.read',
    'application_gap.read',
    'application.read',
    'application.prepare'
  )
  on conflict (role_id, permission_id) do nothing;

  if exists (
    select 1
    from public.permissions
    where permission_key in (
      'workspace.read',
      'company.read',
      'job_family.read',
      'opportunity.read',
      'opportunity_source.read',
      'company_intelligence.read',
      'candidate_knowledge.read',
      'settings.read',
      'evaluation.read',
      'application_gap.read',
      'application.read',
      'application.prepare'
    )
    having count(*) <> 12
  ) then
    raise exception 'One or more required Application Agent permissions are missing from the permission catalog';
  end if;

  insert into public.workspace_memberships (workspace_id, principal_id, role_id, status)
  values (v_workspace_id, v_agent_principal_id, v_role_id, 'active')
  on conflict (workspace_id, principal_id)
  do update set role_id = excluded.role_id, status = 'active';
end
$$;
