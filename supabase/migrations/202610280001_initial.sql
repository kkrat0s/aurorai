-- AuroraSense P0: private participant records, immutable scientific provenance,
-- server-owned QC/agent decisions and public rights-cleared source metadata.
begin;
create extension if not exists pgcrypto;

create table public.participant_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  adult_confirmed boolean not null default false,
  recording_consent boolean not null default false,
  invitation_opt_in boolean not null default false,
  consent_version text not null check (consent_version = 'aurorasense-v1'),
  updated_at timestamptz not null default now()
);
create table public.events (
  id text primary key, title text not null, starts_at timestamptz not null,
  ends_at timestamptz not null, mode text not null check (mode in ('live','historical','synthetic')),
  check (ends_at > starts_at)
);
create table public.source_records (
  id uuid primary key default gen_random_uuid(), source_id text not null,
  source_record_id text not null, version text not null, source_url text not null,
  kind text not null check (kind in ('MEASURED_LIVE','MEASURED_ARCHIVAL','ISSUED_FORECAST','RETROSPECTIVE_RECONSTRUCTION','SYNTHETIC','ML_PREDICTION')),
  observed_at timestamptz, issued_at timestamptz, valid_at timestamptz,
  available_at timestamptz, retrieved_at timestamptz not null default now(),
  checksum text not null check (checksum ~ '^[0-9a-f]{64}$'),
  license_id text, rights_evidence_url text,
  public_allowed boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  unique (source_id,source_record_id,version),
  check (not public_allowed or (license_id is not null and rights_evidence_url is not null))
);
create table public.forecast_issuances (
  id uuid primary key default gen_random_uuid(), event_id text not null references public.events(id),
  source_record_id uuid not null references public.source_records(id), method text not null,
  issued_at timestamptz not null, predicted_arrival timestamptz not null,
  revision text not null, unique (source_record_id,method,revision)
);
create table public.reference_series (
  id uuid primary key default gen_random_uuid(), source_record_id uuid not null references public.source_records(id),
  station_id text not null, starts_at timestamptz not null, ends_at timestamptz not null,
  unit text not null check (unit='nT'), component text not null, frame text not null,
  processing_status text not null, storage_path text, summary jsonb not null default '{}'::jsonb,
  check (ends_at>starts_at)
);
create table public.sensor_sessions (
  id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade,
  consent_version text not null check (consent_version='aurorasense-v1'),
  started_at timestamptz not null, ended_at timestamptz,
  coarse_cell text, kind text not null check (kind in ('MEASURED_LIVE','SYNTHETIC')),
  frame text not null default 'DEVICE' check (frame='DEVICE'),
  unit text not null default 'microT' check (unit='microT'),
  created_at timestamptz not null default now(),
  check (ended_at is null or ended_at>=started_at), unique(id,user_id)
);
create table public.sensor_chunks (
  session_id uuid not null, user_id uuid not null,
  chunk_seq integer not null check (chunk_seq>=0 and chunk_seq<100),
  storage_path text not null, sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  byte_count integer not null check (byte_count>0 and byte_count<=2097152),
  created_at timestamptz not null default now(),
  primary key (session_id,chunk_seq),
  foreign key(session_id,user_id) references public.sensor_sessions(id,user_id) on delete cascade,
  check (storage_path=user_id::text || '/' || session_id::text || '/' || chunk_seq::text || '.json')
);
create table public.sensor_qc (
  session_id uuid primary key references public.sensor_sessions(id) on delete cascade,
  accepted boolean not null, algorithm_version text not null,
  result jsonb not null, created_at timestamptz not null default now()
);
create table public.coverage_cells (
  id uuid primary key default gen_random_uuid(), region_cell text not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  independent_sites integer not null check (independent_sites>=0),
  public_allowed boolean not null default false, summary jsonb not null,
  check (ends_at>starts_at), check (not public_allowed or independent_sites>=3)
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(), event_id text not null references public.events(id),
  region_cell text not null, reason text not null,
  duration_minutes integer not null default 10 check (duration_minutes=10),
  created_at timestamptz not null default now(), expires_at timestamptz not null,
  simulated boolean not null default false, check (expires_at>created_at)
);
create table public.campaign_invitations (
  campaign_id uuid not null references public.campaigns(id), user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('INVITED','ACCEPTED','DECLINED','COMPLETED','EXPIRED')),
  created_at timestamptz not null default now(), primary key(campaign_id,user_id)
);
create table public.observations (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  observed_at timestamptz not null, submitted_at timestamptz not null default now(),
  kind text not null check(kind in ('ground','optical')), coarse_cell text,
  private_storage_path text, public_display_consent boolean not null default false,
  review_status text not null default 'PROVISIONAL' check (review_status in ('PROVISIONAL','VERIFIED','REJECTED'))
);
create table public.model_runs (
  id uuid primary key default gen_random_uuid(), run_hash text unique not null,
  model_version text not null, analysis_mode text not null check(analysis_mode in ('RETROSPECTIVE','OPERATIONAL')),
  split_manifest jsonb not null, metrics jsonb not null, public_allowed boolean not null default false,
  created_at timestamptz not null default now()
);
create table public.agent_actions (
  id bigint generated always as identity primary key, correlation_id text unique not null,
  run_id text not null, actor_id uuid,
  tool_name text not null, args_sha256 text not null check (args_sha256 ~ '^[0-9a-f]{64}$'),
  result jsonb not null, mode text not null check(mode in ('SCRIPTED_DEMO','LIVE_AGENT')),
  created_at timestamptz not null default now()
);
create table public.evidence_reports (
  id uuid primary key default gen_random_uuid(), assessment_id text not null,
  evidence_revision integer not null, evidence_sha256 text not null,
  verdict text not null check(verdict in ('SUPPORTED','INCONCLUSIVE','REJECTED')),
  summary text not null, analysis_version text not null, source_ids text[] not null,
  synthetic boolean not null, public_allowed boolean not null default false,
  created_at timestamptz not null default now(),
  check (not public_allowed or not synthetic), unique(assessment_id,evidence_revision)
);

-- Every table denies access until a deliberate grant and policy below allows it.
do $$ declare table_name text; begin
  foreach table_name in array array['participant_consents','events','source_records','forecast_issuances','reference_series','sensor_sessions','sensor_chunks','sensor_qc','coverage_cells','campaigns','campaign_invitations','observations','model_runs','agent_actions','evidence_reports'] loop
    execute format('alter table public.%I enable row level security',table_name);
    execute format('revoke all on public.%I from anon, authenticated',table_name);
    execute format('grant all on public.%I to service_role',table_name);
  end loop;
end $$;

grant select,insert,update on public.participant_consents to authenticated;
create policy consent_owner_read on public.participant_consents for select to authenticated using(user_id=(select auth.uid()));
create policy consent_owner_insert on public.participant_consents for insert to authenticated with check(user_id=(select auth.uid()));
create policy consent_owner_update on public.participant_consents for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select,insert,delete on public.sensor_sessions,public.sensor_chunks to authenticated;
create policy session_owner_read on public.sensor_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy session_owner_delete on public.sensor_sessions for delete to authenticated using(user_id=(select auth.uid()));
create policy session_owner_insert on public.sensor_sessions for insert to authenticated with check(
  user_id=(select auth.uid()) and kind='MEASURED_LIVE' and exists(select 1 from public.participant_consents c where c.user_id=(select auth.uid()) and c.adult_confirmed and c.recording_consent and c.consent_version=sensor_sessions.consent_version)
);
create policy chunk_owner_read on public.sensor_chunks for select to authenticated using(user_id=(select auth.uid()));
create policy chunk_owner_delete on public.sensor_chunks for delete to authenticated using(user_id=(select auth.uid()));
create policy chunk_owner_insert on public.sensor_chunks for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.participant_consents c where c.user_id=(select auth.uid()) and c.adult_confirmed and c.recording_consent));
grant select on public.sensor_qc to authenticated;
create policy qc_owner_read on public.sensor_qc for select to authenticated using(exists(select 1 from public.sensor_sessions s where s.id=session_id and s.user_id=(select auth.uid())));
grant select on public.campaign_invitations,public.campaigns to authenticated;
create policy invitation_owner_read on public.campaign_invitations for select to authenticated using(user_id=(select auth.uid()));
create policy invited_campaign_read on public.campaigns for select to authenticated using(exists(select 1 from public.campaign_invitations i where i.campaign_id=id and i.user_id=(select auth.uid())));
grant select,insert,delete on public.observations to authenticated;
create policy observation_owner_read on public.observations for select to authenticated using(user_id=(select auth.uid()));
create policy observation_owner_delete on public.observations for delete to authenticated using(user_id=(select auth.uid()));
create policy observation_owner_insert on public.observations for insert to authenticated with check(user_id=(select auth.uid()) and review_status='PROVISIONAL');

grant select on public.events,public.source_records,public.forecast_issuances,public.reference_series,public.coverage_cells,public.model_runs,public.evidence_reports to anon,authenticated;
create policy event_read on public.events for select to anon,authenticated using(true);
create policy source_public on public.source_records for select to anon,authenticated using(public_allowed);
create policy forecast_public on public.forecast_issuances for select to anon,authenticated using(exists(select 1 from public.source_records s where s.id=forecast_issuances.source_record_id and s.public_allowed));
create policy reference_public on public.reference_series for select to anon,authenticated using(exists(select 1 from public.source_records s where s.id=reference_series.source_record_id and s.public_allowed));
create policy coverage_public on public.coverage_cells for select to anon,authenticated using(public_allowed and independent_sites>=3);
create policy model_public on public.model_runs for select to anon,authenticated using(public_allowed);
create policy report_public on public.evidence_reports for select to anon,authenticated using(public_allowed and not synthetic);

create function public.reject_audit_mutation() returns trigger language plpgsql set search_path='' as $$ begin raise exception 'append-only record'; end; $$;
revoke all on function public.reject_audit_mutation() from public,anon,authenticated;
create trigger immutable_agent_actions before update or delete on public.agent_actions for each row execute function public.reject_audit_mutation();
create trigger immutable_reports before update or delete on public.evidence_reports for each row execute function public.reject_audit_mutation();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('sensor-raw','sensor-raw',false,2097152,array['application/json'])
on conflict(id) do nothing;
create policy private_sensor_read on storage.objects for select to authenticated using(bucket_id='sensor-raw' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_sensor_delete on storage.objects for delete to authenticated using(bucket_id='sensor-raw' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy private_sensor_insert on storage.objects for insert to authenticated with check(
  bucket_id='sensor-raw' and (storage.foldername(name))[1]=(select auth.uid())::text
  and exists(select 1 from public.sensor_sessions s where s.id::text=(storage.foldername(name))[2] and s.user_id=(select auth.uid()))
  and exists(select 1 from public.participant_consents c where c.user_id=(select auth.uid()) and c.adult_confirmed and c.recording_consent)
);
-- No UPDATE policy: original sensor objects are immutable; delete remains the owner's choice.
commit;
