-- ============================================================================
-- Report photos: a private Storage bucket + access policies.
-- Run this in the Supabase SQL Editor.
--
-- Photos are stored at path: <request_id>/<uuid>.<ext>
-- Access reuses the inspection_requests RLS:
--   * READ  — anyone who can already see that request (client, the inspection
--             company's dispatcher, the assigned inspector)
--   * WRITE/DELETE — only the assigned inspector
-- ============================================================================

-- Private bucket (not public — files are served via short-lived signed URLs).
insert into storage.buckets (id, name, public)
values ('report-photos', 'report-photos', false)
on conflict (id) do nothing;

-- READ: the request_id is the first folder in the path. The subquery runs as
-- the current user, so inspection_requests RLS decides if they may see it.
drop policy if exists "report_photos_read" on storage.objects;
create policy "report_photos_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'report-photos'
    and exists (
      select 1 from public.inspection_requests r
      where r.id::text = (storage.foldername(name))[1]
    )
  );

-- INSERT: only the assigned inspector, into their request's folder.
drop policy if exists "report_photos_insert" on storage.objects;
create policy "report_photos_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'report-photos'
    and public.my_role() = 'inspector'
    and exists (
      select 1 from public.inspection_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.inspector_id = auth.uid()
    )
  );

-- DELETE: only the assigned inspector.
drop policy if exists "report_photos_delete" on storage.objects;
create policy "report_photos_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'report-photos'
    and public.my_role() = 'inspector'
    and exists (
      select 1 from public.inspection_requests r
      where r.id::text = (storage.foldername(name))[1]
        and r.inspector_id = auth.uid()
    )
  );
