-- Auth + tenant onboarding: users, tenant membership, and server-side sessions.
-- These tables are NOT tenant-scoped by app_current_tenant(); they are the layer that
-- decides which tenant a request belongs to. RLS is forced with no permissive policy,
-- so only the service_role (which bypasses RLS) can read or write them. All access goes
-- through the server-side data access layer.

create extension if not exists citext;

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  password_hash text not null,
  name text not null default '',
  created_at timestamptz not null default now()
);

-- A user belongs to one or more tenants. For the MVP a registration creates exactly one
-- tenant and one owner membership, but the shape supports multi-tenant users later.
create table if not exists tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'owner',
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);
create index if not exists tenant_members_user_idx on tenant_members (user_id);
create index if not exists tenant_members_tenant_idx on tenant_members (tenant_id);

-- Server-side sessions. The browser cookie holds a random opaque token; we store only its
-- SHA-256 hash, so a database leak does not hand out live sessions.
create table if not exists user_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists user_sessions_user_idx on user_sessions (user_id);

-- Lock these tables to the service_role only.
do $$
declare t text;
begin
  foreach t in array array['users','tenant_members','user_sessions'] loop
    execute format('alter table %I enable row level security;', t);
    execute format('alter table %I force row level security;', t);
  end loop;
end $$;
