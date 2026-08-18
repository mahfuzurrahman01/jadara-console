-- WhatsApp AI Agent SaaS: core multi-tenant schema.
-- Every table has RLS enabled and is scoped by tenant_id.
-- Child tables carry a denormalized tenant_id so RLS policies stay simple and fast.
-- (Design note: the brief's column lists omit tenant_id on some child tables; we add it
--  everywhere on purpose so tenant isolation is enforceable at the row level without joins.)

create extension if not exists pgcrypto;

-- Tenant context helper. The backend sets this per request with
--   select set_config('app.current_tenant', '<uuid>', true);
-- The Supabase service_role bypasses RLS entirely, so this only gates anon/authenticated access.
create or replace function app_current_tenant()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_tenant', true), '')::uuid
$$;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name text not null,
  vertical text,
  system_prompt text not null default '',
  model text not null default 'gemini-flash-latest',
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on agents (tenant_id);

create table field_defs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  key text not null,
  label text not null,
  type text not null default 'string',
  required boolean not null default true,
  question_hint text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (agent_id, key)
);
create index on field_defs (agent_id);

create table qualification_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  logic text not null default 'AND',
  conditions jsonb not null default '[]'::jsonb,
  on_qualified jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on qualification_rules (agent_id);

create table integrations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  name text not null,
  description text,
  method text not null default 'POST',
  url text not null,
  auth_type text not null default 'bearer',
  auth_secret_ref text,
  input_schema jsonb not null default '{}'::jsonb,
  field_mapping jsonb not null default '{}'::jsonb,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);
create index on integrations (agent_id);

create table secrets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  key text not null,
  ciphertext text not null,
  iv text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, key)
);

create table channel_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  provider text not null default 'openwa',
  external_session_id text not null,
  status text not null default 'disconnected',
  created_at timestamptz not null default now(),
  unique (provider, external_session_id)
);
create index on channel_connections (tenant_id);

create table contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  wa_id text not null,
  name text,
  attributes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, wa_id)
);
create index on contacts (tenant_id);

create table conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  agent_id uuid not null references agents(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index on conversations (tenant_id);
create index on conversations (agent_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null,          -- 'inbound' | 'outbound'
  type text not null default 'text',
  content text not null default '',
  external_message_id text,
  created_at timestamptz not null default now()
);
create index on messages (conversation_id);

create table conversation_state (
  conversation_id uuid primary key references conversations(id) on delete cascade,
  tenant_id uuid not null references tenants(id) on delete cascade,
  collected_data jsonb not null default '{}'::jsonb,
  current_step text,
  qualification_status text not null default 'pending',
  qualified_flag boolean not null default false,
  updated_at timestamptz not null default now()
);

create table integration_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  integration_id uuid not null references integrations(id) on delete cascade,
  request jsonb not null default '{}'::jsonb,
  response jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);
create index on integration_runs (conversation_id);

create table qualification_results (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  status text not null,
  matched_rules jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index on qualification_results (conversation_id);

-- Mock external CRM (stands in for the tenant's real system).
create table mock_beneficiaries (
  id uuid primary key default gen_random_uuid(),
  name text,
  income numeric,
  district text,
  children_under_18 int,
  has_national_id boolean,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'tenants','agents','field_defs','qualification_rules','integrations','secrets',
    'channel_connections','contacts','conversations','messages','conversation_state',
    'integration_runs','qualification_results','mock_beneficiaries'
  ] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
  end loop;
end $$;

-- Tenants: match on id.
create policy tenant_isolation on tenants
  using (id = app_current_tenant())
  with check (id = app_current_tenant());

-- Every tenant-scoped table: match on tenant_id.
do $$
declare t text;
begin
  foreach t in array array[
    'agents','field_defs','qualification_rules','integrations','secrets',
    'channel_connections','contacts','conversations','messages','conversation_state',
    'integration_runs','qualification_results'
  ] loop
    execute format($f$
      create policy tenant_isolation on %I
        using (tenant_id = app_current_tenant())
        with check (tenant_id = app_current_tenant());
    $f$, t);
  end loop;
end $$;

-- mock_beneficiaries has no tenant_id (it is an external system). RLS stays enabled with
-- no permissive policy, so only the service_role (which bypasses RLS) can touch it.
