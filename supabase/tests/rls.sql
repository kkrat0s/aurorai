-- Run against an isolated Supabase test database AFTER migration: supabase test db.
-- These tests roll back. They are not evidence of hosted security until actually executed.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);
insert into auth.users(id,email) values ('11111111-1111-4111-8111-111111111111','a@example.invalid'),('22222222-2222-4222-8222-222222222222','b@example.invalid');
insert into public.participant_consents(user_id,adult_confirmed,recording_consent,invitation_opt_in,consent_version) values('11111111-1111-4111-8111-111111111111',true,true,false,'aurorasense-v1'),('22222222-2222-4222-8222-222222222222',true,false,false,'aurorasense-v1');
insert into public.sensor_sessions(id,user_id,consent_version,started_at,kind) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111','aurorasense-v1',now(),'MEASURED_LIVE');
set local role authenticated;
set local request.jwt.claims='{"sub":"22222222-2222-4222-8222-222222222222","role":"authenticated"}';
select is((select count(*)::integer from public.sensor_sessions),0,'Another user cannot read a session');
select is((select count(*)::integer from public.participant_consents),1,'Consent records are owner-only');
select throws_ok($$insert into public.sensor_sessions(id,user_id,consent_version,started_at,kind) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222','aurorasense-v1',now(),'MEASURED_LIVE')$$,'42501',null,'No recording consent blocks creation');
select throws_ok($$insert into public.sensor_sessions(id,user_id,consent_version,started_at,kind) values('cccccccc-cccc-4ccc-8ccc-cccccccccccc','11111111-1111-4111-8111-111111111111','aurorasense-v1',now(),'MEASURED_LIVE')$$,'42501',null,'Owner spoofing fails');
select throws_ok($$insert into public.sensor_qc(session_id,accepted,algorithm_version,result) values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',true,'spoof','{}')$$,'42501',null,'Client cannot manufacture accepted QC');
select throws_ok($$select * from public.agent_actions$$,'42501',null,'Agent audit remains private');
set local request.jwt.claims='{"sub":"11111111-1111-4111-8111-111111111111","role":"authenticated"}';
select is((select count(*)::integer from public.sensor_sessions),1,'Owner can read session');
select throws_ok($$insert into public.sensor_sessions(id,user_id,consent_version,started_at,kind) values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','11111111-1111-4111-8111-111111111111','aurorasense-v1',now(),'SYNTHETIC')$$,'42501',null,'Client cannot use synthetic server path');
reset role;
select is((select public from storage.buckets where id='sensor-raw'),false,'Sensor bucket is private');
select is((select count(*)::integer from pg_policies where schemaname='storage' and policyname='private_sensor_insert' and cmd='INSERT'),1,'Explicit sensor upload policy exists');
select * from finish();
rollback;
