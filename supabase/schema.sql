-- ============================================================================
-- NDT Inspection Portal — database schema + Row-Level Security
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- Safe to re-run: it drops and recreates policies/functions.
-- ============================================================================

-- ---------- Tables ----------------------------------------------------------

create table if not exists public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text not null check (type in ('client', 'inspection')),
  join_code   text unique not null default upper(substr(md5(random()::text), 1, 6)),
  created_at  timestamptz not null default now()
);

create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  org_id      uuid not null references public.organizations (id) on delete restrict,
  full_name   text not null,
  email       text,
  role        text not null check (role in ('client', 'dispatcher', 'inspector')),
  created_at  timestamptz not null default now()
);

create table if not exists public.inspection_requests (
  id                   uuid primary key default gen_random_uuid(),
  -- who asked
  client_org_id        uuid not null references public.organizations (id),
  client_org_name      text not null,
  created_by           uuid not null references auth.users (id),
  -- what
  project              text not null,
  site                 text not null,
  method               text not null,
  requested_date       date,
  notes                text,
  -- lifecycle
  status               text not null default 'open'
                         check (status in ('open','claimed','assigned','in_progress','completed','cancelled')),
  -- who is doing it (set as it progresses; denormalized names for display)
  inspection_org_id    uuid references public.organizations (id),
  inspection_org_name  text,
  inspector_id         uuid references auth.users (id),
  inspector_name       text,
  scheduled_date       date,
  -- outcome
  result               text check (result in ('Pass','Fail')),
  inspector_notes      text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create index if not exists idx_requests_status   on public.inspection_requests (status);
create index if not exists idx_requests_client   on public.inspection_requests (client_org_id);
create index if not exists idx_requests_insporg  on public.inspection_requests (inspection_org_id);
create index if not exists idx_requests_inspector on public.inspection_requests (inspector_id);

-- ---------- Helper functions (SECURITY DEFINER → bypass RLS, no recursion) --

create or replace function public.my_org() returns uuid
  language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

grant execute on function public.my_org()  to authenticated;
grant execute on function public.my_role() to authenticated;

-- updated_at trigger
create or replace function public.touch_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists trg_requests_touch on public.inspection_requests;
create trigger trg_requests_touch before update on public.inspection_requests
  for each row execute function public.touch_updated_at();

-- ---------- Onboarding RPC: create profile + create/join org atomically ----

create or replace function public.setup_account(
  p_full_name text,
  p_role      text,
  p_mode      text,            -- 'create' | 'join'
  p_org_name  text default null,
  p_join_code text default null
) returns void
  language plpgsql security definer set search_path = public as $$
declare
  v_org_id uuid;
  v_type   text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if exists (select 1 from public.profiles where id = auth.uid()) then
    raise exception 'Profile already exists';
  end if;
  if p_role not in ('client','dispatcher','inspector') then
    raise exception 'Invalid role';
  end if;

  v_type := case when p_role = 'client' then 'client' else 'inspection' end;

  if p_mode = 'create' then
    if coalesce(p_org_name,'') = '' then raise exception 'Organization name required'; end if;
    insert into public.organizations (name, type)
      values (p_org_name, v_type)
      returning id into v_org_id;
  elsif p_mode = 'join' then
    select id into v_org_id from public.organizations
      where join_code = upper(p_join_code) and type = v_type;
    if v_org_id is null then
      raise exception 'No % organization found for that code', v_type;
    end if;
  else
    raise exception 'Invalid mode';
  end if;

  insert into public.profiles (id, org_id, full_name, role, email)
    values (
      auth.uid(), v_org_id, p_full_name, p_role,
      (select email from auth.users where id = auth.uid())
    );
end $$;

grant execute on function public.setup_account(text,text,text,text,text) to authenticated;

-- ---------- Enable + force Row-Level Security ------------------------------

alter table public.organizations      enable row level security;
alter table public.profiles           enable row level security;
alter table public.inspection_requests enable row level security;

-- organizations: you can only read your own org row
drop policy if exists org_select on public.organizations;
create policy org_select on public.organizations
  for select to authenticated using (id = public.my_org());

-- profiles: read yourself + teammates in your org
drop policy if exists prof_select on public.profiles;
create policy prof_select on public.profiles
  for select to authenticated using (id = auth.uid() or org_id = public.my_org());

drop policy if exists prof_update_self on public.profiles;
create policy prof_update_self on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- inspection_requests: the core access rules ------------------------------

drop policy if exists req_select on public.inspection_requests;
create policy req_select on public.inspection_requests
  for select to authenticated using (
       (public.my_role() = 'client'     and client_org_id = public.my_org())
    or (public.my_role() = 'dispatcher' and (status = 'open' or inspection_org_id = public.my_org()))
    or (public.my_role() = 'inspector'  and inspector_id = auth.uid())
  );

-- only clients can create, and only for their own org
drop policy if exists req_insert on public.inspection_requests;
create policy req_insert on public.inspection_requests
  for insert to authenticated with check (
    public.my_role() = 'client'
    and client_org_id = public.my_org()
    and created_by = auth.uid()
  );

-- dispatchers can claim open jobs and manage their own company's jobs
drop policy if exists req_update_dispatcher on public.inspection_requests;
create policy req_update_dispatcher on public.inspection_requests
  for update to authenticated
  using  (public.my_role() = 'dispatcher' and (status = 'open' or inspection_org_id = public.my_org()))
  with check (public.my_role() = 'dispatcher' and inspection_org_id = public.my_org());

-- inspectors can update only jobs assigned to them
drop policy if exists req_update_inspector on public.inspection_requests;
create policy req_update_inspector on public.inspection_requests
  for update to authenticated
  using  (public.my_role() = 'inspector' and inspector_id = auth.uid())
  with check (public.my_role() = 'inspector' and inspector_id = auth.uid());

-- clients can update (e.g. cancel) their own org's requests
drop policy if exists req_update_client on public.inspection_requests;
create policy req_update_client on public.inspection_requests
  for update to authenticated
  using  (public.my_role() = 'client' and client_org_id = public.my_org())
  with check (public.my_role() = 'client' and client_org_id = public.my_org());

-- ---------- Realtime (live updates across roles) --------------------------
alter publication supabase_realtime add table public.inspection_requests;
