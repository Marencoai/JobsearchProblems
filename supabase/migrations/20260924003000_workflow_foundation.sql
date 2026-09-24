-- ============================================================
-- Job Search AI Agent
-- Migration 010: Workflow and Activity Foundation
-- ============================================================
--
-- Creates:
--   activity_events
--   activity_event_links
--   activity_replies
--   internal_tasks
--   task_dependencies
--   task_attempts
--   next_actions
--
-- Core distinction:
--
-- Activity Event
--   What happened?
--
-- Internal Task
--   What does the system need to do?
--
-- Next Action
--   What does a human need to do?
--
-- ============================================================


-- ============================================================
-- 1. WORKFLOW PERMISSIONS
-- ============================================================

insert into public.permissions (
    permission_key,
    domain,
    action,
    description
)
values

    -- Activity
    (
        'activity.read',
        'activity',
        'read',
        'View Activity Events and Replies'
    ),
    (
        'activity.create',
        'activity',
        'create',
        'Create Activity Events'
    ),
    (
        'activity.reply',
        'activity',
        'reply',
        'Reply to Activity Events'
    ),

    -- Internal Tasks
    (
        'internal_task.read',
        'internal_task',
        'read',
        'View Internal Tasks'
    ),
    (
        'internal_task.create',
        'internal_task',
        'create',
        'Create Internal Tasks'
    ),
    (
        'internal_task.update',
        'internal_task',
        'update',
        'Update Internal Task state'
    ),
    (
        'internal_task.execute',
        'internal_task',
        'execute',
        'Execute Internal Tasks and record attempts'
    ),

    -- Next Actions
    (
        'next_action.read',
        'next_action',
        'read',
        'View candidate-facing Next Actions'
    ),
    (
        'next_action.create',
        'next_action',
        'create',
        'Create Next Actions'
    ),
    (
        'next_action.update',
        'next_action',
        'update',
        'Update Next Action state'
    ),
    (
        'next_action.complete',
        'next_action',
        'complete',
        'Complete candidate-facing Next Actions'
    )

on conflict (permission_key) do nothing;


-- ============================================================
-- 2. GRANT WORKFLOW PERMISSIONS TO OWNER
-- ============================================================

insert into public.role_permissions (
    role_id,
    permission_id
)
select
    r.id,
    p.id
from public.roles r
cross join public.permissions p
where r.workspace_id is null
  and lower(r.name) = 'owner'
  and p.permission_key in (

      'activity.read',
      'activity.create',
      'activity.reply',

      'internal_task.read',
      'internal_task.create',
      'internal_task.update',
      'internal_task.execute',

      'next_action.read',
      'next_action.create',
      'next_action.update',
      'next_action.complete'
  )
on conflict (role_id, permission_id) do nothing;


-- ============================================================
-- 3. ACTIVITY EVENTS
-- ============================================================
--
-- Represents historical activity.
--
-- Examples:
--
-- Opportunity discovered
-- Evaluation completed
-- Candidate Knowledge added
-- Resume prepared
-- Application submitted
-- Recruiter replied
-- Interview scheduled
--
-- Activity Events are the durable timeline underneath the
-- Opportunity Activity Feed.
-- ============================================================

create table public.activity_events (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid null,

    event_type text not null,

    event_timestamp timestamptz not null default now(),

    -- Principal that actually performed the action when the actor
    -- is an internal human or agent.
    --
    -- Example:
    -- Diana submitted application
    -- Application Agent generated draft
    --
    -- An external recruiter is NOT a Principal, so a recruiter
    -- reply may leave this null and use source_system instead.
    actor_principal_id uuid null
        references public.principals(id)
        on delete set null,

    summary text not null,

    details text null,

    source_system text null,
    source_reference text null,

    requires_candidate_attention boolean not null default false,

    -- Principal that recorded this Event in the system.
    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint activity_events_workspace_id_id_unique
        unique (workspace_id, id),

    constraint activity_events_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict
);


create index activity_events_workspace_time_idx
on public.activity_events(
    workspace_id,
    event_timestamp desc
);


create index activity_events_opportunity_time_idx
on public.activity_events(
    workspace_id,
    opportunity_id,
    event_timestamp desc
)
where opportunity_id is not null;


create index activity_events_attention_idx
on public.activity_events(
    workspace_id,
    requires_candidate_attention
)
where requires_candidate_attention = true;


create trigger set_activity_events_actor_audit
before insert
on public.activity_events
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_activity_events_workspace_change
before update of workspace_id
on public.activity_events
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 4. ACTIVITY EVENT LINKS
-- ============================================================
--
-- One Activity Event may relate to multiple structured objects.
--
-- Example:
--
-- "Application submitted"
--
-- links to:
--
--   Application
--   Application Material
--   External Action
--
--
-- This intentionally uses a polymorphic reference because many
-- future domains may participate in Activity history.
--
-- entity_type tells us what kind of record entity_id refers to.
--
-- Referential validation for supported entity types may be
-- added as those domains are implemented.
-- ============================================================

create table public.activity_event_links (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    activity_event_id uuid not null,

    entity_type text not null,
    entity_id uuid not null,

    relationship_type text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint activity_event_links_workspace_id_id_unique
        unique (workspace_id, id),

    constraint activity_event_links_unique
        unique (
            workspace_id,
            activity_event_id,
            entity_type,
            entity_id
        ),

    constraint activity_event_links_event_workspace_fk
        foreign key (
            workspace_id,
            activity_event_id
        )
        references public.activity_events(
            workspace_id,
            id
        )
        on delete cascade
);


create index activity_event_links_entity_idx
on public.activity_event_links(
    workspace_id,
    entity_type,
    entity_id
);


create trigger set_activity_event_links_actor
before insert
on public.activity_event_links
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_activity_event_links_workspace_change
before update of workspace_id
on public.activity_event_links
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 5. ACTIVITY REPLIES
-- ============================================================
--
-- Lightweight contextual conversation attached to one Activity
-- Event.
--
-- These are intentionally shallow.
--
-- Example:
--
-- Event:
--   "Outreach draft ready."
--
-- Diana:
--   "Make it more direct."
--
-- Outreach Agent:
--   "Updated."
--
-- ============================================================

create table public.activity_replies (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    activity_event_id uuid not null,

    author_principal_id uuid not null
        references public.principals(id)
        on delete restrict,

    content text not null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint activity_replies_workspace_id_id_unique
        unique (workspace_id, id),

    constraint activity_replies_event_workspace_fk
        foreign key (
            workspace_id,
            activity_event_id
        )
        references public.activity_events(
            workspace_id,
            id
        )
        on delete cascade
);


create index activity_replies_event_idx
on public.activity_replies(
    workspace_id,
    activity_event_id,
    created_at
);


create trigger set_activity_replies_updated_at
before update on public.activity_replies
for each row
execute function public.set_updated_at();


create trigger prevent_activity_replies_workspace_change
before update of workspace_id
on public.activity_replies
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 6. INTERNAL TASKS
-- ============================================================
--
-- Machine-facing work units.
--
-- Examples:
--
-- Evaluate Opportunity
-- Wait four days for recruiter response
-- Refresh Company Intelligence
-- Prepare application packet
-- Verify candidate answer
--
-- The candidate should generally NOT maintain these manually.
-- ============================================================

create table public.internal_tasks (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid null,

    source_activity_event_id uuid null,

    task_type text not null,

    domain text not null
        check (
            domain in (
                'discovery',
                'company_intelligence',
                'candidate_knowledge',
                'evaluation',
                'application',
                'outreach',
                'interview',
                'safety',
                'system'
            )
        ),

    title text not null,
    description text null,

    owner_principal_id uuid null
        references public.principals(id)
        on delete set null,

    status text not null default 'pending'
        check (
            status in (
                'pending',
                'ready',
                'running',
                'waiting',
                'blocked',
                'completed',
                'failed',
                'cancelled'
            )
        ),

    priority integer not null default 50
        check (
            priority >= 0
            and priority <= 100
        ),

    trigger_type text null
        check (
            trigger_type is null
            or trigger_type in (
                'event',
                'schedule',
                'candidate_action',
                'agent_action',
                'manual',
                'system'
            )
        ),

    trigger_reference text null,

    due_at timestamptz null,

    -- A waiting Task should not resume before this time unless
    -- its waiting condition is satisfied earlier.
    not_before timestamptz null,

    waiting_condition text null,

    approval_required boolean not null default false,

    max_attempts integer not null default 3
        check (max_attempts > 0),

    attempt_count integer not null default 0
        check (attempt_count >= 0),

    last_attempt_at timestamptz null,

    completed_at timestamptz null,

    result_summary text null,

    idempotency_key text null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint internal_tasks_workspace_id_id_unique
        unique (workspace_id, id),

    constraint internal_tasks_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict,

    constraint internal_tasks_source_event_workspace_fk
        foreign key (
            workspace_id,
            source_activity_event_id
        )
        references public.activity_events(
            workspace_id,
            id
        )
        on delete restrict,

    constraint internal_tasks_completed_time_valid
        check (
            status not in (
                'completed',
                'cancelled'
            )
            or completed_at is not null
        )
);


create index internal_tasks_workspace_status_idx
on public.internal_tasks(
    workspace_id,
    status
);


create index internal_tasks_opportunity_idx
on public.internal_tasks(
    workspace_id,
    opportunity_id
)
where opportunity_id is not null;


create index internal_tasks_owner_idx
on public.internal_tasks(
    workspace_id,
    owner_principal_id
)
where owner_principal_id is not null;


create index internal_tasks_due_idx
on public.internal_tasks(
    workspace_id,
    due_at
)
where due_at is not null;


create unique index internal_tasks_idempotency_unique
on public.internal_tasks(
    workspace_id,
    idempotency_key
)
where idempotency_key is not null;


create trigger set_internal_tasks_updated_at
before update on public.internal_tasks
for each row
execute function public.set_updated_at();


create trigger set_internal_tasks_actor_audit
before insert or update
on public.internal_tasks
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_internal_tasks_workspace_change
before update of workspace_id
on public.internal_tasks
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 7. TASK DEPENDENCIES
-- ============================================================
--
-- Example:
--
-- Verify Opportunity
--        ↓
-- Evaluate Opportunity
--        ↓
-- Prepare Application
--
-- ============================================================

create table public.task_dependencies (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    task_id uuid not null,
    depends_on_task_id uuid not null,

    dependency_type text not null default 'must_complete'
        check (
            dependency_type in (
                'must_complete',
                'must_succeed',
                'informational'
            )
        ),

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),

    constraint task_dependencies_workspace_id_id_unique
        unique (workspace_id, id),

    constraint task_dependencies_unique
        unique (
            workspace_id,
            task_id,
            depends_on_task_id
        ),

    constraint task_dependencies_not_self
        check (
            task_id <> depends_on_task_id
        ),

    constraint task_dependencies_task_workspace_fk
        foreign key (
            workspace_id,
            task_id
        )
        references public.internal_tasks(
            workspace_id,
            id
        )
        on delete cascade,

    constraint task_dependencies_parent_workspace_fk
        foreign key (
            workspace_id,
            depends_on_task_id
        )
        references public.internal_tasks(
            workspace_id,
            id
        )
        on delete cascade
);


create index task_dependencies_parent_idx
on public.task_dependencies(
    workspace_id,
    depends_on_task_id
);


create trigger set_task_dependencies_actor
before insert
on public.task_dependencies
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_task_dependencies_workspace_change
before update of workspace_id
on public.task_dependencies
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 8. TASK ATTEMPTS
-- ============================================================
--
-- One Internal Task may have multiple execution attempts.
--
-- Example:
--
-- Prepare Application
--
-- Attempt 1:
-- ATS unavailable → failed
--
-- Attempt 2:
-- succeeded
--
-- The Task remains one Task.
--
-- Attempts preserve execution history.
-- ============================================================

create table public.task_attempts (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    internal_task_id uuid not null,

    attempt_number integer not null
        check (attempt_number > 0),

    executed_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    started_at timestamptz not null default now(),

    completed_at timestamptz null,

    status text not null default 'running'
        check (
            status in (
                'running',
                'succeeded',
                'failed',
                'cancelled'
            )
        ),

    error_code text null,
    error_message text null,

    result_summary text null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint task_attempts_workspace_id_id_unique
        unique (workspace_id, id),

    constraint task_attempts_number_unique
        unique (
            workspace_id,
            internal_task_id,
            attempt_number
        ),

    constraint task_attempts_task_workspace_fk
        foreign key (
            workspace_id,
            internal_task_id
        )
        references public.internal_tasks(
            workspace_id,
            id
        )
        on delete cascade,

    constraint task_attempts_completed_time_valid
        check (
            status = 'running'
            or completed_at is not null
        )
);


create index task_attempts_task_idx
on public.task_attempts(
    workspace_id,
    internal_task_id,
    attempt_number
);


create trigger set_task_attempts_updated_at
before update on public.task_attempts
for each row
execute function public.set_updated_at();


create trigger prevent_task_attempts_workspace_change
before update of workspace_id
on public.task_attempts
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 9. NEXT ACTIONS
-- ============================================================
--
-- Human-facing work.
--
-- Examples:
--
-- Review application packet
-- Approve outreach draft
-- Answer evidence question
-- Reply to recruiter
-- Choose interview availability
--
-- A Workspace may eventually contain multiple human users, so a
-- Next Action may be explicitly assigned to one Principal.
-- ============================================================

create table public.next_actions (
    id uuid primary key default gen_random_uuid(),

    workspace_id uuid not null
        references public.workspaces(id)
        on delete cascade,

    opportunity_id uuid null,

    internal_task_id uuid null,

    source_activity_event_id uuid null,

    assigned_to_principal_id uuid null
        references public.principals(id)
        on delete set null,

    action_type text not null
        check (
            action_type in (
                'review',
                'approve',
                'answer',
                'send',
                'prepare',
                'decide',
                'apply',
                'follow_up',
                'other'
            )
        ),

    title text not null,

    context_summary text null,

    priority integer not null default 50
        check (
            priority >= 0
            and priority <= 100
        ),

    due_at timestamptz null,

    estimated_minutes integer null
        check (
            estimated_minutes is null
            or estimated_minutes >= 0
        ),

    approval_required boolean not null default false,

    todays_one_thing_eligible boolean not null default true,

    status text not null default 'open'
        check (
            status in (
                'open',
                'completed',
                'dismissed',
                'superseded'
            )
        ),

    completed_at timestamptz null,

    created_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    updated_by_principal_id uuid null
        references public.principals(id)
        on delete set null,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint next_actions_workspace_id_id_unique
        unique (workspace_id, id),

    constraint next_actions_opportunity_workspace_fk
        foreign key (
            workspace_id,
            opportunity_id
        )
        references public.opportunities(
            workspace_id,
            id
        )
        on delete restrict,

    constraint next_actions_task_workspace_fk
        foreign key (
            workspace_id,
            internal_task_id
        )
        references public.internal_tasks(
            workspace_id,
            id
        )
        on delete restrict,

    constraint next_actions_event_workspace_fk
        foreign key (
            workspace_id,
            source_activity_event_id
        )
        references public.activity_events(
            workspace_id,
            id
        )
        on delete restrict,

    constraint next_actions_completion_time_valid
        check (
            status <> 'completed'
            or completed_at is not null
        )
);


create index next_actions_workspace_status_idx
on public.next_actions(
    workspace_id,
    status
);


create index next_actions_assignee_idx
on public.next_actions(
    workspace_id,
    assigned_to_principal_id,
    status
)
where assigned_to_principal_id is not null;


create index next_actions_opportunity_idx
on public.next_actions(
    workspace_id,
    opportunity_id
)
where opportunity_id is not null;


create index next_actions_due_idx
on public.next_actions(
    workspace_id,
    due_at
)
where status = 'open'
  and due_at is not null;


create trigger set_next_actions_updated_at
before update on public.next_actions
for each row
execute function public.set_updated_at();


create trigger set_next_actions_actor_audit
before insert or update
on public.next_actions
for each row
execute function public.set_actor_audit_fields();


create trigger prevent_next_actions_workspace_change
before update of workspace_id
on public.next_actions
for each row
execute function public.prevent_workspace_change();


-- ============================================================
-- 10. WORKFLOW RELATIONSHIP MAP
-- ============================================================
--
-- Something happens
--        ↓
-- Activity Event
--        ↓
-- Internal Task
--        ↓
-- Human attention required?
--       / \
--     No   Yes
--     ↓     ↓
-- Continue Next Action
--             ↓
--         Human acts
--             ↓
--      New Activity Event
--
-- ============================================================


-- ============================================================
-- 11. HISTORICAL VS MUTABLE
-- ============================================================
--
-- Historical:
--
-- activity_events
--
-- task_attempts
--   once an attempt is finalized
--
--
-- Contextual conversation:
--
-- activity_replies
--
--
-- Mutable workflow state:
--
-- internal_tasks
-- next_actions
--
--
-- This distinction is intentional.
--
-- The timeline tells us what happened.
--
-- Tasks tell us what the system is currently doing.
--
-- Next Actions tell the human what needs attention.
--
-- ============================================================


-- ============================================================
-- 12. IDEMPOTENCY
-- ============================================================
--
-- Internal Tasks may receive an idempotency_key.
--
-- Example:
--
-- Gmail message abc123 arrives twice.
--
-- Both processing attempts may produce the same key:
--
-- gmail:abc123:process_recruiter_reply
--
-- The unique index prevents the system from accidentally
-- creating the same Task twice.
--
-- This becomes especially important for:
--
-- retries
-- webhooks
-- scheduled processing
-- agent handoffs
--
-- ============================================================


-- ============================================================
-- 13. ASSIGNMENT MODEL
-- ============================================================
--
-- Internal Task:
--
-- owner_principal_id
--
-- answers:
--
-- "Who or what is responsible for doing the work?"
--
--
-- Next Action:
--
-- assigned_to_principal_id
--
-- answers:
--
-- "Which human Principal needs to pay attention?"
--
--
-- Example:
--
-- Evaluation Agent owns:
--
--   "Evaluate Mor Furniture Opportunity"
--
-- Diana is assigned:
--
--   "Answer one missing evidence question"
--
-- ============================================================


-- ============================================================
-- MIGRATION 010 COMPLETE
-- ============================================================
--
-- Workflow structure now exists.
--
-- NEXT MIGRATION:
--
-- Workflow RLS + lifecycle controls
--
-- That migration will enforce:
--
--   append-only Activity Events
--   reply authorship
--   Task ownership validity
--   Task lifecycle rules
--   Task Attempt lifecycle rules
--   dependency cycle prevention
--   Next Action assignment validity
--   Next Action completion controls
--   Workspace RLS
--
-- ============================================================
