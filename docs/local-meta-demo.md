# Local Muse Spark scientific coordinator

This is an owner-operated CLI for the real existing seven-tool coordinator. It is separate from the authenticated cloud `/api/agent` route and does not bypass or prove Supabase authentication, hosted RLS, invitation delivery or deployment. It creates a private local research artifact. It never publishes a website, sends a message, activates a sensor or invents a participant.

## Run

From the repository root after `npm ci`, verify local configuration without any network request:

```powershell
.\node_modules\.bin\vite-node.cmd --script scripts/run-local-meta.ts --dry-run
```

The `--script` flag is required for vite-node to set the CLI entry point correctly. A successful dry run reports credential presence as a boolean, the persistent budget balance and zero network/model requests. It acquires and releases the exclusive local lock and initializes or validates the private budget ledger. On the first run of the new controls, it appends the project owner's 2026-11-04 budget authorization without rewriting earlier ledger records. No secret or credential fragment is printed. This is a configuration check, not an actual model run.

When the adult project owner explicitly intends to incur bounded provider usage:

```powershell
.\node_modules\.bin\vite-node.cmd --script scripts/run-local-meta.ts --run --operator-adult
```

`--operator-adult` is a local operator declaration, not verified identity from a cloud service. Both flags are required; the script makes no paid request by default. It reads the existing `META_MODEL_API_KEY` from the process environment, or the established private `.env.local` locations, without printing it. No key is accepted on the command line or stored in artifacts. The source and model URLs are fixed in the implementation. No arbitrary URL or phone-file argument is accepted.

## Real evidence and model behavior

The command acquires current USGS BOU total-field scalar F through the same bounded acquisition/parser used by the live Ground Truth panel. It selects up to 30 most recent consecutive valid minute readings, requires at least eight, and subtracts the median of the first two actual observations. It preserves the source URL, SHA-256, observation and retrieval times, provisional processing status and unknown original operational availability. Analysis is explicitly `RETROSPECTIVE` despite retrieving current records, because historical operational availability is not established. The schema's reference `baselineNoiseNt` field contains the descriptive MAD of those first two observations, not an inferred instrument-noise floor.

The coordinator contains exactly one genuine professional reference, **zero phone sessions and zero volunteers**. It uses the existing typed tools:

1. `get_event_context`
2. `get_regional_coverage`
3. `get_reference_magnetometers`
4. `run_local_qc`
5. `run_regional_coherence`
6. `request_opt_in_session`
7. `publish_evidence_report`

The model chooses calls under the existing deterministic authorization and schema rules. It should discover missing independent phone coverage, inspect the reference, run the validator and produce a research report. A fabricated phone ID fails local QC scope checks. An observation-request call is explicitly recorded in the action log as blocked with `INVITATION_DELIVERY_NOT_CONFIGURED`; no invitation is delivered. The validator can only conclude `INCONCLUSIVE` for this zero-phone context. Canonical report text comes from the validator; model prose does not become published scientific evidence. A run that fails to produce a research-audience, nonsynthetic inconclusive report exits unsuccessfully, even if the model otherwise finishes.

Successful model behavior is not guaranteed. Missing source data, network failure, provider rejection, incomplete reasoning, exhausted budget, invalid tool calls or a missing final report remain visible outcomes. A five-round cap stops an unproductive loop. There is no automatic retry and no fallback that masquerades as a model response.

## Local durable spending and audit controls

All artifacts remain under ignored `data/private/meta/`:

- `run.lock`: exclusive `wx` lock for the complete run, preventing simultaneous local owners from sharing the allowance.
- `ledger.jsonl`: append-only, hash-linked authorization, reservations and settlements. It preserves every earlier record under the original US$0.50 smoke-test allowance, then appends the owner's expanded authorization. Each reservation is flushed with `fsync` before a model call can begin. Successful provider-reported token usage settles the charge; failed/uncertain calls retain the conservative reservation. No CLI flag resets the ledger or reallocates the protected reserve.
- `journal.jsonl`: append-only model-boundary and tool-state journal; each record is flushed before returning. It contains scientific state and usage, not credentials or free-form model drafts.
- `local-…-input.json`: source provenance, public station data and the local operator context, saved before any possible paid request.
- `local-….json`: actual result, usage, authoritative reports, action trail and remaining allowance.

The owner reconfirmed **US$150 of available Meta credit on 2026-11-04**. The implementation follows the exact allocations in `plan.md` section 10:

| Allocation | Ceiling |
|---|---:|
| Science observation orchestration and grounded reports | $45 |
| Image understanding/community photo experiment | $20 |
| Agent fixture evaluations and failure testing | $30 |
| Wonder comparison/red-team | $15 |
| Optional image/SAM experiments | $10 |
| Protected reserve and final judged demonstration | $30 |
| Total | $150 |

This CLI performs science orchestration only, so it enforces the **$45 cumulative purpose allocation** rather than consuming the other categories. It also enforces **$20 per UTC day**, the **$120 operational ceiling** and **$150 total ceiling**, leaving the specified **$30 demo reserve** protected. Daily accounting uses each reservation's UTC day, with requests crossing midnight assigned individually. V1 ledger rows had no timestamps; they retain their original amounts and are conservatively attributed to science on the UTC migration date, rather than inventing old request times. The existing journal preserves the actual original timing.

There are additional bounds of 200 reserved requests per UTC day and 2,000 cumulative requests; five model rounds per invocation remain unchanged. Clock rollback, invalid ledger authorization, uncertain charges and unexpected reservation overruns fail closed. A repeated migration is idempotent: no additional authorization or fresh allowance is appended. These controls cover this local ledger; **usage made through separate web/hosted APIs or directly with the provider is not automatically reconciled into it**. Provider account totals remain the authority for remaining credit across all paths, and other spend must be reconciled before treating the full allocation as unused.

The command uses the existing adapter's conservative input-byte reservation and 1,500 maximum output tokens per request, with at most five model rounds. Rates were rechecked on 2026-11-04: Muse Spark 1.3 Standard input US$1.25 per million tokens and output US$4.25 per million. Cached-input discounts are not required to stay under the estimated allowance. See [Meta pricing](https://dev.meta.ai/docs/pricing-rate-limits) and the [Responses API](https://dev.meta.ai/docs/api-reference/responses/create-response). It uses the standard `muse-spark-1.3` model; no Contributor-mode variant or paid built-in web tool is enabled.

The budget is a conservative local request-authorization limit, not a provider billing-system credit limit. If reported charges unexpectedly exceed a reservation, the actual amount is durably recorded and further requests fail closed. A crash can leave the lock behind. An incomplete/corrupted ledger or missing ledger alongside an existing journal blocks execution. Do not delete or reset these files to bypass a hold; reconcile provider usage and inspect active processes before any manual recovery. Protect the project owner's filesystem access: these controls are not a multi-user authorization or tamper-proof billing service.

## Verification completed

On 2026-11-04, nine focused tests passed in `packages/coordinator/src/local-meta-cli.test.ts`. They cover the daily and science-purpose caps, legacy migration preserving old bytes and settled/unsettled usage, idempotent migration, clock rollback, altered authorization, settlement, concurrent lock denial, ledger corruption/truncation, missing ledger, unexpected billed overrun, uncertain-call retention, seven-tool scope, nonexistent phone rejection, disabled invitations, actual-value baseline arithmetic, deterministic inconclusive research publication and invalid/stale/future source coverage. Test evidence and failed transport are explicitly manufactured software inputs; they do not constitute a real model or phone run.

```powershell
npx vitest run packages/coordinator/src/local-meta-cli.test.ts
npx eslint scripts/run-local-meta.ts packages/coordinator/src/local-meta-cli.test.ts --max-warnings 0
npm run typecheck --workspace @aurorasense/coordinator
```

The initial configuration dry run succeeded with zero model requests under the original $0.50 allowance. The later authorized migration also made zero network/model requests. It preserved the original **2,280 ledger bytes exactly**, appended one 1,003-byte authorization record, and retained all **four settled requests** and **$0.024541** of conservatively rounded recorded usage. After migration, the science-purpose balance was $44.975459, with no unsettled reservations. Coordinator typecheck and targeted lint passed. No additional paid request was made during the migration.

## Actual successful Meta run, distinct from tests and hosted validation

The parent integration run completed against **`muse-spark-1.3`**, using real USGS BOU evidence, with as-of time **2026-11-04T12:22:20.438Z**. The private result is `data/private/meta/local-1853ee09-490c-4b1c-936e-2e0816e99ade.json`; the judge-facing redacted record is [Meta run verification](meta-run-verification-2026-11-04.json).

It made **four actual model requests**, totaling **11,353 input tokens and 2,435 output tokens**, for **$0.024540 estimated token cost**. Per-call upward micro-dollar rounding produces the ledger's $0.024541 retained balance. Its observed tool trace read event context, checked zero independent phone coverage, inspected the reference, ran regional coherence, attempted an observation request that was blocked, and created the canonical **INCONCLUSIVE** research report. The model did not call local phone QC because no phone session existed. There were no volunteers, no synthetic phone inputs and zero delivered invitations.

This verifies a real, bounded **local** model/tool/validator run with durable audit. It does not establish hosted authentication or RLS, a live observation-delivery system, successful phone/EZIE correlation, regional phone detection or visible aurora. Those remain separate gates. The public cloud agent route must retain its own verified-authentication and storage controls; this local success is not evidence that those hosted gates have passed.

For a judge-facing demonstration, disclose the local operator context and show the actual model call count, tool audit, verified USGS source, blocked invitation and canonical inconclusive conclusion. Do not describe the local `PUBLISHED` research-artifact status as public deployment or delivery. Inspect and redact artifacts before sharing; this CLI never automatically uploads them.
