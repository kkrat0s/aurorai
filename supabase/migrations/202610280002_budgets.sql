begin;
create table public.meta_budget_reservations (
  request_id text primary key, reserved_usd numeric(12,8) not null check(reserved_usd>0 and reserved_usd<=1),
  actual_usd numeric(12,8), created_at timestamptz not null default now(),
  settled_at timestamptz, check(actual_usd is null or actual_usd>=0)
);
create table public.agent_run_journal (
  id bigint generated always as identity primary key,
  request_id text not null, kind text not null check(kind in ('before_model','after_model','after_tool','failed')),
  model text not null check(model='muse-spark-1.3'),
  payload jsonb not null, payload_sha256 text not null check(payload_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.meta_budget_reservations enable row level security;
alter table public.agent_run_journal enable row level security;
revoke all on public.meta_budget_reservations,public.agent_run_journal from anon,authenticated;
grant all on public.meta_budget_reservations,public.agent_run_journal to service_role;
grant usage,select on sequence public.agent_run_journal_id_seq,public.agent_actions_id_seq to service_role;
create trigger immutable_agent_journal before update or delete on public.agent_run_journal for each row execute function public.reject_audit_mutation();

-- Costs are conservatively reserved before any external request. A failed/uncertain request
-- retains its reservation. This cap is for the primary Spark coordinator only.
create function public.reserve_meta_budget(p_request_id text,p_maximum_usd numeric) returns boolean
language plpgsql security invoker set search_path='' as $$
declare total_spend numeric; daily_spend numeric; daily_requests integer; all_requests integer;
begin
  if p_request_id is null or length(p_request_id)>150 or p_maximum_usd<=0 or p_maximum_usd>1 then
    raise exception 'invalid budget reservation';
  end if;
  perform pg_advisory_xact_lock(918273645);
  -- Refuse repeated request IDs, including settled IDs, so retries cannot double-spend.
  if exists(select 1 from public.meta_budget_reservations where request_id=p_request_id) then return false; end if;
  select coalesce(sum(coalesce(actual_usd,reserved_usd)),0),count(*) into total_spend,all_requests from public.meta_budget_reservations;
  select coalesce(sum(coalesce(actual_usd,reserved_usd)),0),count(*) into daily_spend,daily_requests from public.meta_budget_reservations where created_at>=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
  -- The approved Spark orchestration allocation is $45 of the $150 grant.
  -- Limit daily use to $5/100 calls, and total use to $45/1000 calls.
  if total_spend+p_maximum_usd>45 or daily_spend+p_maximum_usd>5 or daily_requests>=100 or all_requests>=1000 then return false; end if;
  insert into public.meta_budget_reservations(request_id,reserved_usd) values(p_request_id,p_maximum_usd);
  return true;
end $$;
create function public.settle_meta_budget(p_request_id text,p_actual_usd numeric) returns void
language plpgsql security invoker set search_path='' as $$
declare reservation public.meta_budget_reservations;
begin
  perform pg_advisory_xact_lock(918273645);
  select * into reservation from public.meta_budget_reservations where request_id=p_request_id for update;
  if not found or p_actual_usd<0 or p_actual_usd>reservation.reserved_usd then raise exception 'invalid or excessive settlement'; end if;
  if reservation.actual_usd is not null and reservation.actual_usd<>p_actual_usd then raise exception 'settlement conflict'; end if;
  update public.meta_budget_reservations set actual_usd=p_actual_usd,settled_at=coalesce(settled_at,now()) where request_id=p_request_id;
end $$;
revoke all on function public.reserve_meta_budget(text,numeric),public.settle_meta_budget(text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_meta_budget(text,numeric),public.settle_meta_budget(text,numeric) to service_role;
commit;
