-- Adds an estimated arrival time the dispatcher communicates to the client,
-- so the client knows when the inspector will be on site.
-- Run this in the Supabase SQL Editor. Existing RLS already lets the
-- dispatcher update their own company's jobs and the client read their own.

alter table public.inspection_requests
  add column if not exists eta timestamptz;
