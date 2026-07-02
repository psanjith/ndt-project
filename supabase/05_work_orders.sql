-- ============================================================================
-- Work Orders: dispatcher-created orders become the primary object.
-- Run this in the Supabase SQL Editor (after the earlier migrations).
--
-- We extend inspection_requests with work-order fields (reusing the existing
-- report / photos / ETA / inspector machinery), let dispatchers create them,
-- let clients see orders addressed to their email, and add work-order numbering.
-- ============================================================================

-- ---------- New columns -----------------------------------------------------
alter table public.inspection_requests
  add column if not exists client_name           text,
  add column if not exists client_address        text,
  add column if not exists client_contact        text,
  add column if not exists client_phone          text,
  add column if not exists client_email          text,
  add column if not exists items_for_inspection  text,
  add column if not exists directions            text,
  add column if not exists special_instructions  text,
  add column if not exists methods               text[],
  add column if not exists date_of_request       date,
  add column if not exists required_datetime      timestamptz,
  add column if not exists quote_amount          numeric,
  add column if not exists company_code          text,
  add column if not exists work_order_no         text;

-- ---------- Helper: current user's email -----------------------------------
create or replace function public.my_email() returns text
  language sql stable security definer set search_path = public as $$
  select email from public.profiles where id = auth.uid()
$$;
grant execute on function public.my_email() to authenticated;

-- ---------- Access: clients also see orders addressed to their email --------
drop policy if exists req_select on public.inspection_requests;
create policy req_select on public.inspection_requests
  for select to authenticated using (
       (public.my_role() = 'client'
          and (client_org_id = public.my_org()
               or lower(client_email) = lower(public.my_email())))
    or (public.my_role() = 'dispatcher' and (status = 'open' or inspection_org_id = public.my_org()))
    or (public.my_role() = 'inspector'  and inspector_id = auth.uid())
  );

-- ---------- Access: dispatchers can create work orders ----------------------
drop policy if exists req_insert_dispatcher on public.inspection_requests;
create policy req_insert_dispatcher on public.inspection_requests
  for insert to authenticated with check (
    public.my_role() = 'dispatcher'
    and inspection_org_id = public.my_org()
    and created_by = auth.uid()
  );

-- ---------- Work order numbering: sequential per company code ---------------
create table if not exists public.work_order_counters (
  company_code text primary key,
  last_n       integer not null default 0
);
alter table public.work_order_counters enable row level security;  -- access only via the RPC below

-- Returns e.g. 20260625-ACME-1, incrementing per company code (never resets).
create or replace function public.next_work_order_no(p_company_code text)
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_n   integer;
  v_code text := upper(trim(p_company_code));
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if coalesce(v_code, '') = '' then raise exception 'Company code required'; end if;

  insert into public.work_order_counters (company_code, last_n)
    values (v_code, 1)
    on conflict (company_code)
    do update set last_n = public.work_order_counters.last_n + 1
    returning last_n into v_n;

  return to_char(current_date, 'YYYYMMDD') || '-' || v_code || '-' || v_n::text;
end $$;
grant execute on function public.next_work_order_no(text) to authenticated;
