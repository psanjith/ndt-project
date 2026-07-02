-- ============================================================================
-- Tighten RLS after the work-order pivot. Run this in the Supabase SQL Editor.
--
-- 1) Clients are read-only on work orders now. The old req_update_client
--    policy (from the "client can cancel" design) let a client update ANY
--    column of their own orders — including quote_amount, work_order_no and
--    even the inspection result. Remove it. (If client-cancel is wanted later,
--    add a dedicated RPC that only flips status to 'cancelled'.)
--
-- 2) Work orders are created by clients; dispatchers only claim/manage them.
--    The req_insert_dispatcher policy from migration 05 is no longer part of
--    the flow and would let a dispatcher insert an order attributed to any
--    client org. Remove it.
-- ============================================================================

drop policy if exists req_update_client on public.inspection_requests;
drop policy if exists req_insert_dispatcher on public.inspection_requests;
