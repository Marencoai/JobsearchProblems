# Proposed shared Contacts contract

Status: proposal only; production off. Outreach owns this table. Interview references it and must not recreate it.

Base: reviewed Phase 2 branch, commit `a18ff51`. Isolated branch: `codex/job-hunt-hq-outreach`.
Migration proposal: `supabase/proposals/outreach/20261001230000_outreach_domain.sql`.

```sql
public.contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete restrict,
  company_id uuid null,
  full_name text not null,
  title text null, email text null, linkedin_url text null,
  phone text null, location_text text null,
  relationship_type text null, relationship_context text null,
  source_system text not null, source_reference text null,
  status text not null default 'active', -- active, inactive, archived
  revision integer not null default 1,
  created_by_principal_id uuid not null,
  updated_by_principal_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workspace_id, id),
  foreign key (workspace_id, company_id)
    references public.companies(workspace_id, id) on delete restrict
)
```

Interview/contact junctions must use `FOREIGN KEY (workspace_id, contact_id) REFERENCES public.contacts(workspace_id, id) ON DELETE RESTRICT`. Contacts are professional people, distinct from internal Principals. They survive role closure, and no real contacts are seeded by the proposal. Names and email addresses deliberately have no global uniqueness constraint; namesakes and shared mailboxes are valid.

RLS enables workspace-scoped SELECT for an active principal/member in an active workspace with `contact.read`. `authenticated` receives SELECT only. `anon` has no table or RPC privilege. No caller, including Owner, can INSERT/UPDATE/DELETE raw Contacts. The public invoker RPC `hq_outreach_action(workspace_uuid, request_uuid, command, payload)` delegates to a narrowly checked writer in the existing private schema. `save_contact` requires `contact.manage` and existing workspace/company/activity read/create capabilities, resolves the actual caller, and creates append-only audit history. Updates require the reviewed integer revision. Existing permission helpers and Auth mappings remain unchanged. The proposed global Owner receives new domain capabilities; existing agent roles receive none.

Consumers must require active contacts when planning new work, preserve archived historical references, and use the existing principal/member permission chain. Contact edits cannot change frozen sent-message recipient snapshots. Contact UI and RPC rollout remain disabled until the complete Outreach package receives production approval.

Outreach RLS does not automatically grant Interview permission, and Interview permission must not automatically grant Contacts management. The Interview review package should specify any additional `contact.read` grants needed by its future roles separately. Migration order is Contacts/Outreach before Interview/contact junctions; production migration inventory and final timestamps must be reconciled once all domain packages are reviewed.
