-- Keep only applied (and rolled_back) upload rows in history storage.
-- Draft/failed previews must not remain as durable upload history.

delete from public.vina_employee_uploads
where status in ('draft', 'failed');

create index if not exists vina_employee_uploads_status_uploaded_at_idx
  on public.vina_employee_uploads (status, uploaded_at desc);
