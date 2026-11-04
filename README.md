# AuroraSense

**See the storm. Find the aurora. Measure Earth's response.**

A scientific observation prototype connecting NASA CME forecasts, NOAA auroral/solar-wind models, professional ground magnetometers and real phone measurements. Its central question is whether quality-controlled phones can add useful independent information about regional geomagnetic disturbances. **That hypothesis remains unresolved.**

Meta Global AI Developer Hackathon · **Indie Developer** · **Push the Frontier**
Deadline: **November 4, 2026, 9:00 PM America/New_York** (November 5, 02:00 UTC).

## Submission status — November 4

Working local web/mobile paths include historical replay, real public feeds, foreground phone capture, deterministic QC, human-confirmed magnetic pattern learning and timestamp-aligned professional comparisons. The aurora screen now uses actual location/time/source evidence; it does not invent a percentage chance of seeing aurora.

The runtime modes are deliberately separate:

- **Scripted policy replay:** synthetic workflow fixtures, no model call, deterministic reset/audit.
- **Local analysis:** feature matching, QC and aurora evidence evaluation run deterministically; these are not Muse Spark calls.
- **Real Muse Spark coordinator:** seven typed tools, deterministic authorization/verdict, bounded requests and durable audit/budget. See [local model demo](docs/local-meta-demo.md) and [hosted backend](docs/agent-backend.md) for execution requirements and limitations. **Verified November 4:** a real local Spark run completed in four model requests (11,353 input / 2,435 output tokens; estimated $0.02454), inspected actual USGS evidence, logged a blocked invitation and produced a canonical INCONCLUSIVE report. See [redacted execution record](docs/meta-run-verification-2026-11-04.json). This does not verify the hosted route.
- **Muse Wonder / Muse Image / SAM:** advisory or conceptual integrations, not demonstrated live model execution. No optical observation is confirmed by a conceptual illustration or segmentation schema.

Read the [submission plan, accuracy/gaps and blue/red-team review](docs/submission-readiness-2026-11-04.md) before presenting claims. [Progress](docs/progress.md) records actual commands and results; its newest entry supersedes old prototype claims.

![AuroraSense historical Storm Track](docs/screenshots/storm-track-desktop.jpg)

The screenshot is a historical UI capture. Current feeds and verification dates are shown in the running app.

## Run the web demo

Requirements: Node.js 24, npm, a modern browser. Python 3.12 plus `science/requirements.txt` is needed for scientific reproduction. No credentials are needed for replay, local import or public NOAA/USGS data.

```sh
npm ci
npm run dev
```

Open **http://localhost:3000**. For production verification:

```sh
npm run build
npm run start --workspace @aurorasense/web
```

The production command binds to loopback by default. No cloud deployment is required to inspect the demo.

## Test the full UI

| Path | Actions | Expected, honest result |
|---|---|---|
| Storm Track / Replay | Inspect original forecasts, move replay time, expand submissions, Reset demo | Original NASA submissions/revisions; no future issuance revealed; reset retains audit history |
| Storm Track / Live | Select Live; refresh NOAA | Actual IMF Bz and wind times; stale/missing failures visible |
| Aurora Map / Live | Select a coarse geographic region; inspect evidence and source table | Local OVATION cell, current/model-valid-time darkness, solar-wind/Kp/USGS context; clouds unknown |
| Aurora Map / Replay | Switch back to historical replay | No invented May 2024 OVATION issuance or current grid relabeled as historical |
| Ground Truth / Live | Select a USGS station; inspect the green trace and source hash | Actual provisional one-minute scalar F; missing minutes remain gaps |
| Phone import | Import an owner's exported JSON locally | Raw axes/magnitude, unchanged QC, measured statistics; no raw upload |
| Simultaneous comparison | Use a new ten-minute phone run and correct coarse region | Common-minute overlay only when sufficient real overlap exists; no correlation for missing timing/QC/geographic gates |
| Pattern teaching | On the physical phone, introduce a known object, confirm/correct its label or name a new object | Local persistent human-confirmed example; unknown is allowed; displayed pre-touch window is saved |
| Pattern retest | Remove object; wait for the rolling window to clear; repeat under matching conditions | A later compatible window may match; training/overlapping windows cannot validate themselves |
| Browser pattern demo | Adjust explicitly synthetic signal; label; Repeat synthetic trial | Teaching/retrieval workflow demonstration, never physical identification accuracy |
| Real Muse audit | Expand Recorded real Meta run on web, or open Muse Spark · Evidence on phone | Dated actual provider-selected actions, USGS source, blocked invitation and canonical INCONCLUSIVE; opening it makes no new request |
| Coordinator | Run policy workflow | Scripted evidence gap, simulated opt-in request, canonical INCONCLUSIVE verdict and audit; no real notification |
| Why? / Research | Traverse five physical explanations; inspect scientific results | Reconnection/precipitation/emission explanation and actual baseline comparison |

A successful result may be **UNKNOWN**, **UNAVAILABLE**, **REJECTED** or **INCONCLUSIVE**. These states are part of the product.

## Run the phone recorder

```sh
cd apps/mobile
npm ci
npm run check
npm start
```

Use Expo Go compatible with this project's Expo SDK 58. Sign in to the same Expo account on the CLI and phone when Expo requests it. `npx expo login` signs in interactively; never put a password or token in repository files. If the installed Expo Go cannot run this SDK, follow Expo's supported development-build route instead of changing dependencies blindly.

For phone access to NOAA/USGS through your web server, set **only the public server address** in ignored `apps/mobile/.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://YOUR_COMPUTER_LAN_IP:3000
```

Start a LAN-bound web server from the repository root, on a trusted network:

```sh
npm run dev --workspace @aurorasense/web -- --hostname 0.0.0.0
```

The phone and computer must be able to reach each other. `localhost` on the phone refers to the phone. Metro's Expo tunnel does not automatically tunnel the web API. Restart Metro after changing the environment. Never put a Meta or Supabase secret in an `EXPO_PUBLIC_` variable. The app can derive a LAN host from Metro during development, but an explicit API URL is more reliable.

Phone workflow:

1. Inspect the live field, then establish a stationary display baseline. The 3D field lines are conceptual, not a reconstructed spatial field.
2. Explore object patterns separately from the quiet baseline experiment. AI/local pattern suggestions are hypotheses; the human confirms or corrects the known object label. New labels are supported. The library is local and can be cleared.
3. Confirm adult participation and recording consent. Choose 30 seconds for acquisition feedback, two minutes for a baseline, or ten minutes for comparison. A 30-second scan cannot establish the 120-second QC baseline.
4. Keep the app foreground and phone stationary. Backgrounding, consent withdrawal and Stop terminate acquisition. Use automatic cues to reduce screen touches.
5. Export JSON/CSV/QC privately. Import JSON into the local web screen when needed. Touch/motion/charging context aids interpretation; it does not magically subtract interference.
6. In the reference panel, select the correct coarse region and station. A remote station is context, not a local ground truth. Unknown clock precision or insufficient overlap blocks correlation claims.

Private hosted recording upload is **disabled** until authenticated ingestion, private storage and deletion are verified. The Sync control reports this explicitly; it does not claim a successful upload. EZIE-Mag testing is deferred by the owner.

## Science and measured results

### Physical phone acquisition

Three private iPhone exports were inspected. The October 31 run was independently recomputed on November 4 with unchanged `phone-qc-0.1.0`: **5,985 samples**, **600.023 s**, **9.973 Hz**, **62.0108 nT baseline MAD**, **100% locally usable**, **zero QC flags**. Earlier runs retain their interference/noisy-baseline failures.

This is measured **baseline variability**, not intrinsic sensor noise, calibrated sensitivity or a geomagnetic detection. A single phone cannot establish regional origin. Android and paired EZIE accuracy tests are not completed. See [October 28](docs/phone-experiment-2026-10-28.md) and [corrected October 31 report](docs/phone-experiment-2026-10-31.md).

### Local aurora assessment

The evaluator uses geographic OVATION matching, observation/validity/retrieval times, measured solar wind, sampled southward-Bz duration, estimated Kp, calculated darkness and professional reference context. Related NOAA inputs are not independent votes. A phone reading never increases a numerical optical probability. Cloud cover and independently verified optical sightings remain unavailable.

A real ingestion defect was fixed: duplicate active NOAA records previously caused both solar-wind feeds to be discarded. Identical duplicates now collapse and conflicting minutes are quarantined. See [accuracy review](docs/aurora-accuracy-review.md) and [actual November 4 source verification](docs/noaa-live-verification-2026-11-04.json).

### Pattern learning and accuracy

Feature extraction and nearest-example matching support user-confirmed labels, new object names, context/cadence checks and unknown/ambiguous results. Profiles retain their algorithm version and acquisition run; duplicates/overlapping training windows do not count as independent evidence. User confirmation records what the user knows was present. It is not a measured classifier accuracy score or proof of magnetic cause.

Physical precision/recall, device-held-out generalization and false-positive rates are **unmeasured**. See [fingerprinting review and test protocol](docs/device-fingerprinting-review.md). No language model changes QC thresholds to make a session pass.

### Retrospective forecasting experiment

Task: predict USGS BOU's five-minute mean geographic X at +30 minutes relative to its preceding-hour median. Real NASA OMNI and independent USGS ground records; whole-event train/test split; **2,191 training / 851 test cases**. Errors are nT.

| Model | MAE | RMSE |
|---|---:|---:|
| Persistence | 29.094 | 61.384 |
| Southward-coupling ridge baseline | 32.821 | 64.446 |
| Instantaneous + prior-ground ridge | 29.083 | 58.124 |
| History + prior-ground candidate | 29.480 | 58.694 |

The history candidate **loses MAE to persistence** and loses both metrics to its matched instantaneous baseline. Historical operational availability is unknown; this is retrospective, coverage-conditional evaluation. No phone inputs were used and no phone forecasting improvement is claimed.

```sh
python -m pip install -r science/requirements.txt
python -m science.experiments.learn --offline
npm run test:science
```

See [full results](docs/evaluation-results.md), [methods](docs/science-methods.md) and `science/results/` for event splits, exclusions, coefficients and checksums. The Broomfield archive is **NO-GO for a validated historical phone-storm claim**; exploratory overlap does not establish stationary calibrated devices.

## Meta integration and seven scientific tools

| Tool | Function |
|---|---|
| `get_event_context` | Source IDs, time, event constraints |
| `get_regional_coverage` | Usable independent sites, excluding synthetic observations |
| `get_reference_magnetometers` | Authorized time-aligned professional reference metadata |
| `run_local_qc` | Deterministic acquisition quality |
| `run_regional_coherence` | Deterministic SUPPORTED / INCONCLUSIVE / REJECTED verdict |
| `request_opt_in_session` | Bounded invitation only for eligible already-opted-in adults; never activates a sensor |
| `publish_evidence_report` | Canonical report bound to the validator; model prose cannot replace it |

Muse Spark is most valuable when it chooses a useful observation or experiment after examining evidence. Additional recommended uses are controlled-test suggestions for unknown patterns and source-bound explanations of changed aurora assessments. These are discussed, with priorities, in the [blue/red review](docs/submission-readiness-2026-11-04.md).

`POST /api/agent` requires verified Supabase researcher auth, permitted cells, adult consent, trusted persisted evidence, durable budget and journal. It does not accept browser-supplied scientific truth. Real participant invitation delivery remains blocked until transactional delivery/acceptance is implemented. Hosted Auth/RLS/Storage checks remain outstanding.

Configure server secrets privately using `.env.example` or `apps/web/.env.local.example`. An optional one-call provider connectivity test is available:

```sh
npm run test:meta -- --dry-run
npm run test:meta
```

The second command incurs one real provider request and proves connectivity only. The old fabricated standalone `--loop` has been removed. Use the actual coordinator path documented above; never present a connectivity smoke as a scientific agent run.

Public endpoints: `/api/noaa` and `/api/ground?station=BOU` acquire actual feeds; `/api/meta` exposes clearly labeled local evaluations/configuration status. Public `spark_insight` returns 403. `/api/recordings` returns 503 because private ingestion is not configured.

## Architecture

```text
apps/web          Next.js / TypeScript: replay, live evidence, local import, API boundaries
apps/mobile       Expo: foreground magnetometer/accelerometer, touch/power context, local export
packages/shared   Acquisition contracts, deterministic QC, pattern learning, ground alignment
packages/coordinator  Seven tools, scientific validator, policy, Meta transport, hosted integration
science           Python acquisition, archive inspection, signal processing, event-blocked learning
supabase          Managed PostgreSQL/Auth/RLS/private Storage/budget migration and tests
```

No user-managed IaaS, Kubernetes, persistent GPU, background sensor collection or speech transcription. Public deployment is not performed by these instructions.

## Verification

```sh
npm run typecheck
npm run typecheck --prefix apps/mobile
npm run lint
npm test
npm run test:science
npm run build
```

November 4 verification: **170 TypeScript tests, 28 Python tests**, workspace/mobile typechecks, lint and production build passed. iOS and Android Hermes bundles also exported successfully. Exact commands and limits are recorded in [progress](docs/progress.md). Tests cover malformed data, units/times, duplicate feeds, missing/stale context, interference, same-window learning leakage, local/remote comparisons, unauthorized tools, budget/auth boundaries and event leakage. Tests and builds do not certify hardware or hosted RLS.

For a bounded live ground check on Windows:

```powershell
.\node_modules\.bin\vite-node.cmd --script scripts/smoke-live-ground.ts BOU
```

Other supported stations are FRD, BSL, CMO and TUC. See [live reference review](docs/live-reference-review.md). Feed downtime is shown as missing; historical fixtures remain available.

## Three-minute demo

| Time | Show | State explicitly |
|---|---|---|
| 0:00–0:35 | Real phone reading, controlled object perturbation, human confirmation/correction | Actual phone data; a known nearby object can contaminate measurements |
| 0:35–0:55 | Accepted and rejected QC examples | Acceptance means locally usable, not a confirmed storm |
| 0:55–1:20 | NASA May 2024 ensemble and replay | Original submissions and uncertainty; not a current forecast |
| 1:20–1:45 | Live aurora evidence and professional field | Modeled activity separate from optical observation; show source times and missing clouds |
| 1:45–2:25 | Recorded real Spark tool run, clearly dated; separate scripted replay | Gap → permitted request or blocked delivery → canonical INCONCLUSIVE; never imply a model ran when it did not |
| 2:25–2:45 | Forecast baseline comparison | Real retrospective scores; candidate loses MAE; no phone forecasting claim |
| 2:45–3:00 | Why? reconnection-to-emission explanation | Ground magnetic disturbance does not guarantee visible aurora |

Prepare recordings before filming; do not squeeze a ten-minute measurement into a misleading live claim. Keep deterministic replay available during external outages. Show the actual Meta execution mode in the video.

## Competition, privacy and rights

The supplied participant guide requires meaningful Meta runtime/model use, a **public repository**, a **three-minute video**, accessible links, all actual team members listed, and clear identification of features built during the hackathon. Maximum team size is four. The pasted guide omitted the judging table; this README does not invent rubric weights. The organizer decides eligibility and compliance.

Use the [event page](https://cerebralvalley.ai/e/meta-ai-developer-hackathon), [participant details](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details) and [submission portal](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/hackathon/submit). Confirm the current portal requirements, owner eligibility and rules acceptance before submitting.

Original hackathon work and prior-material boundaries are described in [contributions](docs/hackathon-contributions.md). The older solar_storm project informed source inspection; it is not presented as newly created competition work. NASA/NOAA/USGS sources retain provenance and applicable attribution; third-party data do not inherit the code license. See [assets](assets.md), [rights](docs/provenance-rights.md), `LICENSE` and `THIRD_PARTY_NOTICES.md` where provided.

Before making the repository public, inspect `git status --short`, `git diff --check` and `git ls-files`. Never add `.env.local`, `data/private`, `data/raw`, precise locations, private raw phone sessions, identifiable volunteers, restricted archives or provider credentials. `.gitignore` protects the known export patterns; it is not a substitute for reviewing the staged files. Review screenshots/video for private information.

**Owner actions still required:** review the recorded actual model-run artifact, complete any intended hosted integration checks, review/publish the repository, record/upload the three-minute video, verify link access and submit before the deadline. EZIE correlation testing is deferred. No calibrated optical probability, device recognition accuracy or phone forecast improvement is claimed.
