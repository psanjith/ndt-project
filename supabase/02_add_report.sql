-- Adds a column to store the full examination report (JSON) on each request.
-- Run this in the Supabase SQL Editor after the initial schema.sql.
-- Existing RLS already lets the assigned inspector update their own rows,
-- and lets the client read their own rows, so no new policies are needed.

alter table public.inspection_requests
  add column if not exists report jsonb;
