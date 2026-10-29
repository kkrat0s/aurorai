begin;
-- Trusted acquisition jobs populate these derived, minute-binned summaries.
-- Existing RLS/grants keep QC writes server-only. No client-uploaded QC is accepted.
alter table public.sensor_qc add column event_id text references public.events(id);
alter table public.sensor_qc add column region_cell text;
alter table public.sensor_qc add column regional_summary jsonb;
alter table public.reference_series add column event_id text references public.events(id);
alter table public.reference_series add column region_cell text;
alter table public.reference_series add column regional_summary jsonb;
alter table public.participant_consents add column coarse_cell text;
create index sensor_qc_event_region on public.sensor_qc(event_id,region_cell);
create index reference_event_region on public.reference_series(event_id,region_cell);
commit;
