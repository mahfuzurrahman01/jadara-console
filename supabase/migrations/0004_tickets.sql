-- Human-handoff tickets. When a customer asks to speak with a real person (detected by the agent)
-- or an owner escalates manually, we open a ticket, pause the agent on that conversation, and route
-- it to the tenant owner. Tenant-scoped like the rest of the app data.

create table if not exists tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  assigned_user_id uuid references users(id) on delete set null,
  reason text not null default '',
  source text not null default 'ai',        -- 'ai' | 'manual'
  status text not null default 'open',       -- 'open' | 'in_progress' | 'resolved'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists tickets_tenant_idx on tickets (tenant_id);
create index if not exists tickets_conversation_idx on tickets (conversation_id);

-- At most one active (non-resolved) ticket per conversation, so a repeated handoff ask or a race
-- never opens duplicates. A resolved ticket does not block a later, genuinely new one.
create unique index if not exists tickets_one_active_per_conversation
  on tickets (conversation_id)
  where status <> 'resolved';

alter table tickets enable row level security;
alter table tickets force row level security;
create policy tenant_isolation on tickets
  using (tenant_id = app_current_tenant())
  with check (tenant_id = app_current_tenant());
