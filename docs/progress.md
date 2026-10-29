# AuroraSense implementation progress

## 2026-10-28 — session started

- Read all of `goal.md`, `assets.md`, `plan.md`; inspected the approved 1672 × 941 wireframe.
- Initial repository has specifications, wireframe and source ZIP only; no application code, dependency manifests or Git checkout detected.
- Started milestone 1: scaffold, foreground sensor acquisition and deterministic interference QC. Data verification and backend policy are parallel work.
- No physical phone recordings, external API results, model metrics, real Meta tool calls, hosted database tests or deployments have yet been achieved.

### Gates requiring real evidence

1. Physical phone stationary baseline, motion and controlled interference export.
2. Verified historical CME ensemble, USGS station samples and NOAA product schemas.
3. Broomfield checksum/schema/license/overlap decision.
4. Event-blocked OMNI/observatory measured baseline comparison.
5. Credentialed Muse Spark loop and hosted Supabase authorization/storage tests.

Progress below must describe actual executed work; planned work is not an achievement.

## Milestone 1 — sensor and runnable scaffold

**Working:** npm monorepo with Next.js 16.4.3/React 19, standalone Expo SDK 58 recorder, shared TypeScript sensor/QC contracts, safe local JSON import. Local Git repository initialized on `main`; no remote, push or public deployment. Root and mobile dependency lockfiles exist. MIT applies to original software only; source rights remain separate.

**Sensor implementation:** explicit adult/recording consent, 10-minute foreground recorder, stop/background/revocation/watchdog cancellation, monotonic sensor time with UTC callback anchor, device axes in µT, scalar magnitude and baseline-relative nT, fresh IMU data, stable-baseline coverage gate, motion/interference/gap screening, local recovery checkpoints, JSON/CSV/QC export and delete. No GPS requested. High-water statistics include actual usable coverage and exclude contaminated samples.

**Executed:** 16 shared sensor/lifecycle tests passed; mobile and shared TypeScript checks passed; mobile lint passed. Android and iOS Hermes JavaScript exports succeeded (771/772 modules, approximately 1.9 MB each). A 500 ms gap threshold is used for the phone plot. Native bundle success is not a device test.

**Limitations:** no physical phone connected or recorded; no measured device-noise distribution, empirical phone simulation, calibrated sensitivity, actual mobile sampling rate, or platform-specific hardware validation. Eight inherited Expo development-tool dependency advisories are documented in `docs/sensor-experiment.md`; no public mobile dev server was exposed. Root schema validation was upgraded to patched Zod 4.6.7.

**Next exact action:** run `npm start` in `apps/mobile` on an available physical device, record the protocol in `docs/sensor-experiment.md`, export privately and inspect in Ground Truth. Keep the baseline stationary for 120 seconds before controlled interference.

## Milestone 2 — verified source replay and measured science

**Working sources:** `demo/fixtures/verified-sources.json` contains actual bounded NASA CCMC, NOAA and USGS results with upstream byte hashes. Ten pre-outcome original CME submissions from seven methods are retained for the May 8, 2024 event. The parser rejects January 2025 aggregate submissions from a 2024 as-issued presentation. Real adjusted BOU minute X/F spans May 10–13; the source's missing Z is preserved. NOAA has separate observed/forecast times and provider-selected active, quality-valid RTSW measurements.

**Broomfield actual inspection:** official 30,765,514-byte archive MD5 matched. API metadata establishes CC BY 4.0. 1,289 CSVs, 38 exact duplicates skipped, one invalid-UTF8 file, 2,871,517 parsed rows. Parsed date range is April 2, 2024–September 18, 2025. May 10–13 overlap: 4,369 rows across 735 unique minutes. Missing physical-device IDs, calibration and motion/stationarity prevent quality acceptance. The 622,560 non-increasing adjacent timestamp pairs are equal second-resolution timestamps, not reversed times. Five overlapping exports were compared at fixed UTC alignment with BOU F; median-centered residual RMSE ranges about 345–4,253 nT. These comparisons are exploratory. **NO-GO for a validated historical phone-storm claim.** Raw files and locations stay ignored under `data/raw/`; sanitized report is public-safe.

**Learning actually measured:** frozen `bou-x-30m-v1` protocol predicts signed five-minute mean BOU geographic X during [issue+30m, issue+35m), minus the preceding hour's median. Three 2023 train blocks; two disjoint 2024 test blocks; ≥24-hour embargo; training-only scaler/model fit; no target/future features. 2,191 training cases and 851 complete test cases. Of 846 possible cases per held-out block, only 370 quiet and 481 storm cases have complete data.

| Model | Test MAE nT | Test RMSE nT |
|---|---:|---:|
| Persistence | 29.09395 | 61.38399 |
| Southward coupling ridge | 32.82133 | 64.44572 |
| Instantaneous + prior ground | 29.08333 | 58.12375 |
| History + prior ground candidate | 29.48010 | 58.69383 |

The candidate is worse on MAE than persistence, lower on RMSE than persistence, and worse on both than the instantaneous model. No phone inputs were used; phone incremental value was not tested. Scores are conditional on available complete cases. OMNI is retrospective and time-shifted; original availability is null, so this is not an operational backtest or an optical-visibility model.

**Executed:** `python -m unittest discover -s science/tests -v` — 17 passed. `python -m science.experiments.learn --offline` reproduced the saved scores exactly using frozen derived cases with protocol/case SHA-256 checks. Source acquisition/inspection requests succeeded. Frame, fill-value, timestamp, malicious archive, split membership, embargo, duplicate case and future-input checks are covered.

**Next exact action:** obtain empirical phone baseline noise before any network simulation; retain this negative/conditional model result rather than tuning on the test storm. Independent science review found and fixed minute-cadence and constant-offset regional-validator edge cases.

## Milestone 3 — connected interface and deterministic coordination

**Working:** responsive Storm Track / Aurora Map / Ground Truth with shared Live/Replay clock, reset, actual forecast submissions/observatory plots, NOAA live refresh, explicit missing/stale states, approximate geographic solar/twilight context, distinct modeled/ground/optical layers, local phone import, Why story, measured score table, source manifests and exportable audit. No verified optical sightings, weather feed or historical 2024 OVATION frame is claimed. Map uses a geographic polar graticule, not a copied basemap. Current phone exports stay separate from 2024 observatory data.

**Coordinator:** seven strict typed tools; deterministic QC/coherence verdict; co-location/environment merging; fixed minute bins and temporal coverage; safe canonical publication; synthetic data cannot establish a real regional claim; adult opt-in invitations; idempotency; old assessment invalidation. Scripted browser workflow rejects a local-spike fixture, simulates an already-opted-in volunteer, rechecks and returns INCONCLUSIVE. It makes no model call, sends no external message and activates no sensor. Model transport and durable budget/journal adapter exist; actual provider behavior remains unmeasured.

**Executed checkpoints:** initial 53 TypeScript tests passed, `npm run typecheck`, `npm run lint` and optimized `npm run build` passed. Additional adversarial cases are being included in final verification below. Five identical coordinator resets are unit-tested. Browser review found and fixed an SVG-title hydration mismatch; subsequent reload did not emit a new hydration error. Live/replay map separation, phone viewport navigation, no horizontal overflow at 390 × 844 viewport, research scores and rendered sources were inspected. Mobile screenshot saved at `docs/screenshots/ground-truth-mobile.jpg`.

**Limitations:** browser audit persists only in memory until export. Physical-phone sample ingestion into trusted minute regional summaries, verified cloud auth/storage/delete, actual hosted RLS and real Spark execution are distinct pending gates. Supabase migrations and pgTAP tests are prepared but have not run on a database. CI workflow is written, not remotely executed. No final video, public GitHub push, deployment or submission.

**Next exact action:** configure an authorized isolated Supabase project; apply/test migrations with real participant roles; implement and exercise signed chunk ingress/deletion; populate trusted source summaries. Then record a bounded authenticated Muse Spark loop with durable spend and audit records. Preserve scripted labels until that real execution succeeds.

## Final verification checkpoint — 2026-10-28

**Executed:** root type checking and linting passed; **76 TypeScript tests across seven files passed** (17 sensor/capture, 50 coordinator/backend, nine web/science-display). The optimized Next.js build passed with `/`, `/api/noaa`, and `/api/agent`. The Python suite passed **17 tests**, and the offline fit reproduced the frozen results. Android/iOS JavaScript bundle exports passed earlier in this session; no native hardware run occurred. Root production dependency audit reported zero advisories after the Zod update. The CI mobile commands now explicitly export Android and iOS, matching the platforms verified locally; remote CI remains unexecuted.

**Actual HTTP check:** local `POST /api/agent` returned HTTP 503, `AGENT_NOT_CONFIGURED`, `mode: UNAVAILABLE`, `modelCalled: false` with cloud configuration absent. This confirms the local boundary does not silently fall back to the scripted coordinator. Server tests cover auth/consent/scope, trusted-source consistency, input caps, privacy filtering, and fail-closed behavior. They do not establish hosted RLS or provider behavior.

**Actual browser import check:** imported `demo/fixtures/synthetic-phone-local-interference.json` through the file picker. The 1,601-sample mathematical fixture retained its explicit SYNTHETIC PHONE SIMULATION label. QC flagged abrupt jump, orientation, local interference and motion; the high-water calculation excluded the pulse. Its noise is generated mathematically and is **not measured phone noise**. This fixture validates software behavior only. The imported session was then forgotten and replay reset. No real phone data has been obtained.

**Rendered evidence:** inspected desktop and narrow phone layouts, source timestamps, current NOAA refresh, replay isolation, all three tabs, Why and Research, and the imported interference rejection. Saved screenshots: `docs/screenshots/storm-track-desktop.jpg`, `ground-truth-mobile.jpg`, `research-results.jpg`, and `synthetic-import-rejection.jpg`. The loopback preview remains running at `http://127.0.0.1:3000`.

**Submission gates still open:** physical sensor experiment and empirically measured noise; trusted cloud ingestion/deletion; deployed Auth/RLS/Storage verification; actual bounded Muse Spark run; transactional opt-in invitation delivery; source presentation notification described in `docs/provenance-rights.md`; final video, public deployment and submission. No public deployment, paid service purchase or external notification occurred. The central phone-network hypothesis remains unproven.

**Next exact action:** follow `docs/sensor-experiment.md` on a physical phone: obtain 120 stationary baseline seconds, record marked controlled interference and motion, export privately, and inspect the real export in Ground Truth. Use those measurements to decide whether an empirical-noise simulation is justified. Cloud preparation can proceed separately when an authorized test project and credentials are available.

## Physical-device preparation — 2026-10-28

**Owner-reported availability:** Google Pixel 11 Pro XL and iPhone 14 Pro Max. Android is selected for the first recording; iPhone follows as a separate platform check. Neither OS version, client installation, native permission flow nor physical sensor recording has yet been observed.

**Executed:** started Expo on private LAN port 8081. The initial sandboxed process was unreachable from the host LAN; it was stopped and restarted with approved network access. The restarted server returned HTTP 200 with `packager-status:running` on its LAN endpoint. A local connection QR was generated under ignored `data/private/`, not added to public fixtures.

**Compatibility correction:** online `npx expo install --check` identified React Native 0.88.1 versus expected 0.88.0 and TypeScript 5.9.3 versus expected ~6.0.3. `npx expo install --fix` updated the mobile manifest and lockfile. Mobile `npm run typecheck`, ESLint over mobile/shared sources, and a second online `expo install --check` passed. Fresh Android/iOS exports passed with 771/772 modules and approximately 1.9 MB each; output directories are ignored. This remains compiled-code evidence, not hardware evidence.

**Next exact action:** owner installs SDK-58-compatible Expo Go from the official Expo page on the Pixel, joins the computer's Wi-Fi, scans the connection QR and opens AuroraSense. Then follow the frozen ten-minute physical protocol and export raw session JSON privately. For iPhone, current Expo documentation additionally requires CLI/client sign-in to the same Expo account; sign-in has not been performed here.

### iPhone connection troubleshooting — 2026-10-28

Owner supplied an iPhone screenshot showing Expo Go's requirement to sign in to both Expo Go and Expo CLI. `npx expo whoami` confirmed the CLI was not logged in. Official Expo troubleshooting confirms the accounts must match on physical iOS and that Android is unaffected by this particular gate. No AuroraSense sensor session has opened or recorded yet.

Started the supported browser login flow. Expo's default Windows browser launcher exited with an error; retrying with its supported `BROWSER=none` option kept the PKCE callback alive. The Codex browser-opening tool rejected the request, so the official authentication page was handed to the default browser using PowerShell `Start-Process`. Passwords/2FA must be entered directly on Expo's page, never in chat. Login completion remains pending. After CLI sign-in and matching Expo Go sign-in, tap Try Again; the running server can read new credentials without a restart when logging in from a previously unsigned state.

### iPhone connected — 2026-10-28

Owner confirmed matching account sign-in and connection from Expo Go on iPhone. The CLI authentication process independently returned `Logged in`, and the running Metro server successfully delivered the iOS development bundle (868 modules). This establishes authenticated client connection and bundle delivery; it does not yet establish magnetometer availability, native permission behavior, sample cadence, QC outcomes or an exported recording.

Next physical run: iPhone 14 Pro Max, ten-minute foreground protocol. Keep the first three minutes stationary (first 120 seconds fixed baseline); perform a marked brief nearby magnetic perturbation at about three minutes and a separately marked motion interval at about five minutes; export raw JSON and QC after stopping. Keep the screen awake and app foreground throughout. Thresholds remain unchanged. No measured phone results are recorded until the actual export is inspected.

## First physical iPhone export and interaction-confound fix — 2026-10-28

**Actual participant evidence:** owner supplied a partial iPhone 14 Pro Max session and QC export. Strict parsing passed; complete recomputation matched all exported QC fields and masks exactly. Raw files are unchanged, ignored by Git, and not copied into public fixtures. The reusable `python -m science.experiments.inspect_phone` command verifies canonical TypeScript QC and writes only private summary/plot artifacts. The public aggregate report is `docs/phone-experiment-2026-10-28.md`.

**Measured:** 3,042 samples over 304.844 seconds (5 min 4.8 s), 9.9756 Hz, no non-increasing native intervals or gaps >0.5 s. Fixed-baseline coverage 119.992 s, median 51.8578 µT, MAD 238.657 nT. 1,446 usable samples / 144.452 usable seconds. The first baseline contains startup transients, so MAD is not an intrinsic noise floor. The marked interference interval reached 3,092.079 µT; it had 325 local-deviation flags across 343 samples. All 987 samples after interference-end and before motion-start remained flagged. Whole-session acceptance is false and regional verdict INCONCLUSIVE. No empirical noise model or network simulation was fitted.

**Lifecycle evidence:** owner reported accidental backgrounding at motion-end; the file records APP_BACKGROUNDED, ending about 48 ms after the final received sample. This is consistent with intended cancellation, without independent native instrumentation. No full ten-minute session, Android acquisition, explicit Stop/revocation/delete physical test or synchronized professional comparison is claimed.

**User-identified confound:** pressing/scrolling can move the phone and bring objects near it. Added prospective `hands-free-protocol-0.1.0`: opt-in visual experiment cues at 180/185 and 300/305 seconds; planned cue time and actual delivery are distinct; delayed cues are visible; no vibration/sound; keep-awake is mounted only while recording. Manual touches carry explicit origin and a separate fixed 1-second-before / 3-second-after context summary. Older markers remain unclassified. The banner stays visible above the scrolling UI. The original QC thresholds, masks, acceptance and high-water semantics remain unchanged; interaction metadata cannot exempt sustained magnetic excursions.

**Executed software checks:** root and mobile type checking, root/mobile lint, **82 TypeScript tests**, **20 Python tests**, optimized Next production build, Android/iOS Hermes exports (775/776 modules, about 1.9 MB each), and online Expo compatibility check all passed. The original export again reproduced exactly after the changes. New cue/wake/interaction behavior has not been physically verified or visually inspected on the iPhone yet. Eight inherited Expo tooling audit findings remain as documented earlier.

**Next exact action:** reload the stopped recorder, preserve the exported first run, delete only its retained on-device copy when ready, and record a completely untouched stationary repeat with guided mode off and accessories away. Let it stop automatically; export raw/QC privately. Use a separate guided run for a weaker controlled perturbation. Do not relax frozen thresholds based on either result.

## Full stationary iPhone attempt — 2026-10-28

**Executed:** inspected the second owner-provided raw/QC pair using `python -m science.experiments.inspect_phone` with a separate `data/private/phone-analysis-stationary` output folder and plot. Strict schema, metadata, all QC fields/sample masks and the new interaction-context export exactly reproduced. Raw exports and detailed artifacts remain unchanged/private and are confirmed ignored by Git. The owner describes screen-up placement on a wooden chair near a window, without interruptions; charging and accessory state remain unknown.

**Actual acquisition success:** 5,987 samples, 600.032 seconds, 9.97614 Hz, zero non-increasing native intervals, zero gaps >0.5 s, DURATION_COMPLETE about 4 ms after the last received sample. Only the Start interaction is annotated; no later touch/cue markers. The uninterrupted ten-minute workflow is supported by the owner report and export. Guided cues, explicit Stop/revocation/delete and Android still need physical verification.

**Actual scientific failure retained:** baseline median 155.6448 µT, MAD 801.466 nT versus frozen 250 nT threshold. NOISY_BASELINE applies to all samples, giving zero QC-usable samples. Additional flags: 2,700 local-deviation, one jump, one orientation; no MOTION or missing/stale-IMU flags. First/final 30-second raw medians are 158.2442/149.1478 µT, an exploratory −9,096.434 nT change. This endpoint diagnostic was added after inspection and is explicitly labeled exploratory, not a preregistered score, drift correction or acceptance adjustment. Environment/instrument/calibration causes remain unresolved. No noise-floor, phone-network, forecast-improvement or regional-event claim follows.

**Code/report update:** inspector now reports fixed 30-second exploratory raw endpoint summaries and visibly labels plots with no usable samples rather than showing an unexplained empty trace. Added a test that descriptive raw summaries cannot imply QC acceptance or verified recomputation. `python -m unittest discover -s science/tests -v`: **21 passed**. Both private raw/QC recomputation and plot generation passed for the current run. No web/mobile runtime or QC thresholds changed in this milestone, so unrelated builds were not repeated. Aggregate report, sensor protocol and README updated.

**Next exact action:** validate the Pixel with guided mode off and an untouched stationary recording on a plain nonmagnetic support, disconnected from charging, magnetic accessories/cases removed and the interference source well away. Export privately after automatic completion. Keep the failed iPhone runs in the record; use device/environment comparisons to investigate instability rather than relaxing thresholds.

### QC/noise interpretation clarification — 2026-10-28

Owner asked whether household activity, including cats, can be accounted for. Reviewed current QC implementation, NOAA CrowdMag guidance and the primary Odenwald 2019 sensor study (DOI 10.5334/cstp.158). Clarified that QC is inference-specific screening; the 250 nT MAD rule is an initial engineering gate, not a validated phone sensitivity limit. Baseline MAD includes drift/environmental variation and is not an isolated electronic-noise estimate. A failed gate does not make the raw acquisition scientifically worthless.

The paper documents settling/calibration and temperature effects in older tested phones. This introduces a hypothesis relevant to the prior large magnetic exposure, not a diagnosis or a transferable settling-time guarantee for the current iPhone. Cats are not identified as the cause; only documented contact or nearby magnetic objects could be assessed from additional evidence. Added plain-language QC/noise notes to the sensor protocol. No filtering, threshold, acceptance decision, data, or runtime behavior changed; documentation-only clarification required no new build/test run.

## Threshold-independent AI filtering exploration — 2026-10-28

**User steering:** ignore initial thresholds for now and use AI to understand/filter the observations. Implemented a separate exploratory research path using all finite measured values regardless of original QC acceptance. Original raw data, masks, scientific acceptance and regional verdict remain in the audit. This explicit user instruction authorizes exploration without changing the meaning of past results.

**Working code:** `science/experiments/phone_denoising.py` and a protocol frozen before the first fit/injection scores. The original phone/BOU traces were already inspected, disclosed in the protocol. 600 full one-second median bins (one terminal sample omitted) feed a bounded Gaussian-process model trained at five-second stride: 120 points, Matérn kernel plus white-variation term, learned 75.893-second length scale, ten optimizer iterations, no warnings. Standardized input parameters and the GP response are frozen before tests. No clean-phone training target, GPU, model API or cloud request is involved.

**Actually measured:** rapid-variation MAD of one-second differences is 102.921 nT for unchanged one-second medians, 9.952 nT for the simple 15-second median, 28.528 nT for GP smooth, 102.921 nT for linear detrending and 100.737 nT for GP residual. These are descriptive roughness measures, not noise floors or accuracy. No across-the-board ML superiority is claimed.

**Synthetic signal-preservation test:** every complete nonoverlapping ten-minute window of the saved May 10–13, 2024 USGS BOU F source was injected at original amplitude into the 2026 phone series: 432 blocks, no missing blocks. Minute values were interpolated to seconds; adjacent intervals share a boundary value. With model parameters fixed, `filter(phone+injection)-filter(phone)` has median centered gain 100.000% unchanged, 99.694% median filter, 30.553% linear detrend, 99.961% GP smooth, 0.039% GP residual. Median shape RMSE is approximately zero / 0.08824 / 1.20648 / 0.01199 / 1.88645 nT, respectively. Retention is not detection probability or recovery accuracy: differencing cancels the background output, and no clean real-phone reference exists.

**Interpretation:** GP subtraction flattens the endpoint change from −9,137.577 to −26.502 nT at one-second cadence but removes almost all tested minute-scale geomagnetic shapes. The smooth component preserves those shapes alongside the unexplained phone drift. This is useful diagnostic ML, without validated drift separation, storm detection or a regional verdict change. All processing uses future samples and is retrospective.

**Verification/privacy:** 28 Python tests passed, with seven new tests for missing/invalid data, units, synthetic response controls, no cross-case mixing and frozen/complementary GP responses. A second full run exactly reproduced numerical metrics and the frozen protocol hash. Plots were rendered and inspected. Scores/curves/figures are in ignored `data/private/phone-ai-exploration/`; public `docs/ai-phone-filtering.md` contains aggregates and caveats. Only science code/docs changed; unrelated web/mobile builds were not repeated. New code uses existing pinned libraries. Model and filter behavior have not been validated on a held-out physical phone.

**Next exact action:** retain both smooth and residual views for investigation, then obtain synchronized reference/device data to train and evaluate a source-aware correction. A Pixel run remains useful for platform diagnosis. The existing Muse coordinator can eventually inspect derived model summaries and request the missing evidence through its approved tools; no actual Muse run has been claimed.

### Missing contextual measurements and interruption behavior — 2026-10-28

Owner asked about radio/Wi-Fi/Bluetooth state and incoming calls. Reviewed installed sensor types/current lifecycle code and primary Expo, React Native, Apple, Android and NXP documentation. Current exports lack gyroscope, paired uncalibrated field, calibration accuracy/bias, power/thermal/network state, explicit call/audio/haptic events, detailed lifecycle history, OS/runtime/load diagnostics and synchronized current professional references. Added a clearly prospective inventory to the existing sensor protocol, distinguishing Expo-accessible state from native-only/unknown/manual fields.

Confirmed current code stops on any non-active AppState. iOS inactive can accompany an incoming call; generic APP_BACKGROUNDED cannot identify the cause, and Android blur is not currently logged. Connection type is not radio enabled-state/traffic/transmit power; no present data establishes that radios caused the observed drift. Proposed controlled, counterbalanced context-labeled tests and minimum useful metadata, without caller identity or network/device identifiers. This was a research/documentation clarification; no new telemetry, permissions, radio toggles, calls or runtime changes were performed, and no unrelated tests/builds were repeated.

### Physical reference magnetometer offered — 2026-10-28

Owner reports a separate physical magnetometer at home. Requested make/model and timestamped-export/calibration information; details remain pending. No measurements, calibration certificates or specifications have yet been inspected. Added instrument-identification and synchronized comparison requirements to the existing protocol, including DC/AC suitability, units/frame matching, timing/separation/mutual interference, raw/reference preservation and whole-session held-out evaluation. Reviewed primary NIST and USGS metrology guidance; a second instrument alone does not certify accuracy or a regional storm.

Next exact action: identify the instrument from its model number, verify official manufacturer specifications, inspect a private sample export, then implement the matching importer and freeze a paired phone/reference collection and ML evaluation protocol. No instrument settings, raw records, QC, code or deployment changed at this step; no new tests/builds were warranted.

### EZIE-Mag identified and official export workflow verified — 2026-10-28

Owner identifies the instrument as EZIE-Mag. Inspected APL's current getting-started/dashboard pages, the 30-page 2026 operating manual and 15-page explanation guide, and the primary 2025 campaign publication. The web reader could not render the JavaScript gateway; the browser displayed the official document links. Public PDFs were cached under ignored `data/raw/ezie-guides/`, hashed, text-extracted with pypdf and relevant download/units pages rendered with Poppler and visually inspected. First download correctly failed the 25 MB bound because the official manual is 27.9 MB; verified headers and retried with a 32 MB bound. Bundled dependency locator returned an app-tool error; existing local pypdf/Poppler provided the read-only workflow. No PDF was edited or redistributed.

Confirmed local Latest Data covers the prior 24 hours; prior-hour downloads provide multiple averaging levels and annotated text. The official local dashboard address is `http://eziemag.local` when connected to the unit's network; no connection/network-setting change was attempted. UTC/nT display and temperature context are documented. Specific unit health, calibration, clock/GPS fix, settings and file schema remain unverified. No public station lookup, precise location retrieval, upload, software update or account action occurred.

This could provide synchronized labels for phone/AI assessment if it was operating during the existing recordings. Requested interval is 18:45–19:40 UTC on October 28, covering both phone sessions. Created ignored incoming-data folder `data/private/ezie/`; no dummy measurement file or parser based on a guessed format was created. Official PDFs and primary-paper specifications do not establish calibration of this unit. Source inventory adds PH-13 as a private local reference candidate, separate from professional observatories and independent regional sites.

Next exact action: owner confirms whether the dashboard/data collection is running and provides a local original/annotated export covering the requested interval. Inspect headers, timestamps, quantities, temperature, quality/clock metadata and privacy fields; then implement and test the exact decoder/importer and compare against the existing phone traces. Documentation and source inspection only; no runtime or QC change required additional tests/builds.

### EZIE-Mag assembled but not operating — 2026-10-28

Owner confirms assembled/not running. No overlap with existing phone runs is established; plan a new synchronized run after startup. Read and visually inspected the official manual's power/network startup pages (printed pp. 15–16), plus status/sensor/deployment instructions. Prepared a short owner-operated boot path: provided USB power connection, wait through boot, verify green data LEDs, access the kit hotspot/local dashboard from a separate device, check instrument banner, UTC clock, changing measurements and temperature. Keep the computer/phone acquisition network available by using a separate dashboard device where practical.

Actual physical power-up, SD/software state, Wi-Fi connection, GPS/RTC validity, unit configuration, calibration history and sensor output remain unverified. No device connection, network/configuration change, reflash, external upload or runtime code modification was performed. Next exact action: owner powers the assembled unit and reports the banner/LED state, displayed UTC, total-field value and temperature without station coordinates; diagnose any boot/clock/sensor issue before collecting paired phone/reference data. Initial functionality checks do not certify calibration or eliminate thermal stabilization needs.

## Judge-facing README, participant-guide review and production rehearsal — 2026-10-28

**Owner steering:** defer EZIE correlation and prepare the rest of the competition demo. Owner selected Indie Developer and supplied the official participant-guide link plus its text. EZIE remains assembled/not running; no further instrument operation was attempted.

**Deliverables:** replaced README with a full clone/setup guide, exact screen-by-screen positive/negative checks and expected sample values, local/phone/cloud distinction, three-minute storyboard, scientific reproduction/results, seven tool contracts, environment/security boundaries, actual readiness matrix, troubleshooting and reviewed-Git upload procedure. Added `docs/hackathon-contributions.md` to distinguish October 28 implementation, supplied specifications/design, historical scientific inputs and upstream dependencies, with accurate AI-assistance disclosure. Added the actual production UI acceptance record and screenshot.

**Competition verification:** read the public event page and full rendered Official Rules/Event Waiver. Browser-rendered waiver establishes 30/25/20/25 impact/Meta tooling/technical/demo scoring, one track, up to four Indie members, eligibility, originality and broad organizer material licenses. Owner-provided Participant Guide establishes public repository, three-minute video, new hackathon work/clear contribution attribution, accessible links/contributors and stage-one reasonable Meta API/open-weight use. The details URL redirects this unauthenticated browser to sign-in; the supplied text was used as the guide content and linked without republishing it. Final form fields remain inaccessible in the unauthenticated portal. No agreement was accepted or submission sent; owner acceptance/eligibility are not certified.

**Executed checks:** `npm run typecheck`, `npm run lint`, `npm test` (**82 passed / 8 files**), `npm run build`, `npm run typecheck --prefix apps/mobile`, `python -m unittest discover -s science/tests -v` (**28 passed**) and `python -m science.experiments.learn --offline` all passed. Offline output again matched 2,191 training / 851 test cases and saved scores. Prior same-day native exports/compatibility remain separately documented; they were not repeated for README-only changes. No test files or product runtime were changed.

**Rendered production UI:** followed NASA revision table and replay Home (10→4 visible submissions), shared reset/time, historical map missing state, live north/south/shading/region controls, NOAA refresh, USGS F, public synthetic import and malformed `{}` rejection retaining valid data, ten-action INCONCLUSIVE coordinator workflow, export downloads, measured Research/source manifests/audit, all five Why? steps, import retention on reset, explicit Forget and preparation instructions. All three downloaded JSON files parsed, including SCRIPTED_DEMO / INCONCLUSIVE / ten actions. NOAA refresh manifests retrieved 21:51:50 UTC. Actual unconfigured `/api/agent` returned HTTP 503 AGENT_NOT_CONFIGURED with modelCalled false. See `docs/ui-acceptance-2026-10-28.md`; desktop production screenshot saved. Earlier phone-width inspection remains valid for unchanged code; this milestone did not repeat physical or full mobile-accessibility testing.

**Repository preflight:** `git check-ignore` confirmed private/raw/env/phone probes ignored. `git add --dry-run .` succeeded outside the Git-metadata sandbox restriction and listed publication candidates only; no files staged/committed. Candidate review found no private/raw/phone export paths, no files above 20 MB, no matches for a limited private-key/GitHub/AWS/JWT credential-pattern scan, empty `.env.example` values and no missing README relative files. This limited pattern scan is not a complete secret/rights review. At the first scan: 112 candidates / 7,396,503 bytes, before the final UI report/screenshot/progress additions. Raw phone/Broomfield/EZIE files remain ignored. No GitHub remote, push, deployment, billing change or external outreach performed.

**Remaining scientific/integration limits:** two iPhone runs retain failed unchanged QC; no accepted noise-floor calibration, synchronized EZIE/phone comparison, regional network support, optical confirmation or phone forecast gain. Actual Muse Spark execution is now explicitly identified as a **stage-one submission blocker**, not merely optional polish. Hosted auth/private ingestion/delete, RLS execution and transactional invitations remain incomplete; a labeled scripted replay is insufficient evidence of real Meta use.

**Next exact action:** owner can rehearse the local production UI at `http://127.0.0.1:3000` using README's portable fixture. For final submission, complete the authorized test-project/backend path and record a genuine bounded Muse Spark evidence/tool run, then rehearse/record the required three-minute video with contribution captions, finish CCMC notification/rights review, publish reviewed source publicly, run remote CI and verify all judge links before November 4, 21:00 America/New_York. No phone/EZIE test is being requested as a prerequisite to reviewing the screens.

Final documentation check: 114 publication candidates / 7,478,085 bytes before the small cache-limit notes; README and both new documentation files have valid relative file links and balanced code fences. No files were staged. Runtime log exposed a nonfatal Next fetch-cache limit: the NOAA wind payload was 3,174,049 bytes (>2 MB). UI refresh and source exports succeeded, but raw fetch caching is bypassed for that product; documented this limitation instead of claiming verified hosted caching. No runtime fix or extra unrelated tests were introduced. The app-tool attempt to open the README panel returned an invalid-request error; the saved file and final clickable link remain available.
