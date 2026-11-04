# Submission readiness, accuracy and app value — November 4, 2026

Deadline: November 4, 21:00 America/New_York (November 5, 02:00 UTC). Track: Indie Developer. Theme: Push the Frontier.

This is an implementation and evidence review, not a declaration that all submission gates are closed. The approved goal/assets/plan remain authoritative. Earlier progress entries describe historical work; this review supersedes their unsupported scientific and runtime claims.

## Executable plan and current outcomes

| Priority | Work | Implemented outcome | Remaining acceptance gate |
|---|---|---|---|
| P0 | Fix flaky local aurora assessment | Timestamped geographic OVATION lookup, real solar elevation, sustained sampled southward IMF, measured solar wind, planetary Kp and professional ground context; missing/stale/future states; no invented cloud/night/storm inputs | Prospective optical calibration; weather and independent optical sources unavailable |
| P0 | Repair NOAA ingestion | Identical active duplicates collapsed; conflicting timestamps quarantined; one failed product no longer discards all other products; bounded response size, timeout and warm cache | Operational uptime monitoring on deployment |
| P0 | Useful device fingerprint learning | Conservative feature matcher, unknown/ambiguity gate, human-confirmed/custom labels, persistent local library, context/cadence matching, independent-window and run-ID checks | Controlled device-held-out physical trials; precision/recall not measured |
| P0 | Actual phone/reference comparison | Five live USGS stations; scalar F in nT, UTC-minute alignment, simultaneous overlay, geography/QC/time gates, visible source hashes | New concurrent phone run with defensible UTC uncertainty; EZIE deferred by owner |
| P0 | Remove unsafe/fabricated results | No made-up clean phone baseline, fixed aurora percentages, phone-to-G/Kp conversion, fake SAM masks or public paid-model endpoint | Continue claim review when new features are added |
| P0 | Submission documentation | README, this review and component accuracy reviews describe reproducible commands, statuses, demo and limitations | Owner video, public repository and portal submission |
| P1 | Demonstrate genuine Muse Spark decisions | Real local Spark run COMPLETED: 4 requests, actual USGS reference, blocked invitation, canonical INCONCLUSIVE; redacted artifact saved | Hosted participant delivery/auth still unverified; show actual recorded run separately |
| P1 | Hosted participant service | Supabase schema/auth/RLS/budget/journal integration code retained; public filesystem upload fails closed | Real hosted RLS, private upload/delete, transactional delivery and consent tests |
| P2 | Calibrated aurora probability | No unsupported numerical result published | Multi-event, location/time-matched optical labels, weather, reliability curves, Brier/log loss and prospective holdout |
| P2 | Phone forecasting value | Existing event-blocked OMNI/BOU experiment and measured scores retained | Controlled paired ablation with genuine independent phone observations |

## What changed scientifically

The previous mobile journey supplied fixed Bz, wind speed, cloud cover, night state, accepted QC and station coherence. It showed latitude-based percentages without acquiring observations. Short local drift could be classified as a solar disturbance. Missing motion could default to standstill. These paths have been replaced with actual-only values, unknown states and conservative interpretation. Public filesystem recordings and unauthenticated model-spend routes were closed.

The working solar_storm project was inspected for source/product behavior. Its upstream NOAA magnetic field is **GSM IMF**, whereas a phone measures **device-frame axes and scalar magnitude** near the ground. The new direct reference uses **USGS scalar F**, with units and UTC aligned. No old solar_storm code or fabricated fallback readings were copied into an asserted new scientific achievement.

## Accuracy and coverage gaps

| Capability | Evidence available | Defensible claim | Unresolved gap |
|---|---|---|---|
| Phone acquisition | Three private iPhone exports; canonical QC recomputation | Actual foreground sampling and local interference screening work on the reported iPhone | Android, hardware accuracy, calibration, temperature and precise UTC uncertainty |
| Accepted October 31 session | 5,985 samples, 600.023 s, baseline MAD 62.0108 nT, zero QC flags | Accepted under unchanged phone-qc-0.1.0; measured baseline variability | MAD is not intrinsic sensor noise; drift cause and regional origin unknown |
| Human-confirmed patterns | Repeatable feature extraction and held-window exclusion tests | A user can label an example and retrieve compatible later patterns | No device-identity accuracy, causal verification or generalization benchmark |
| Local aurora guidance | Real NOAA model/wind/Kp and calculated darkness | Source-grounded qualitative assessment at a chosen coarse region | No calibrated sighting probability; clouds, terrain, moon/light pollution and sightings incomplete |
| Ground comparison | Actual one-minute USGS provisional readings and gated alignment | Same-unit, same-time variation comparison when requirements pass | Correlation alone is not causation; remote station and shared local noise remain confounders |
| Learned forecasting | 2,191 train / 851 test cases, whole-event split | Retrospective BOU-X forecasting experiment with reported losses | Unknown historical availability; one station, few events; no phone inputs |
| Muse Spark | Typed API transport and deterministic authorization/validator | Model can select allowed scientific actions; canonical verdict cannot be rewritten | Real provider run verified Nov4; hosted deployment still unverified |

Persistence MAE/RMSE: **29.094/61.384 nT**. Temporal-history candidate: **29.480/58.694 nT**. Candidate loses MAE to persistence and both metrics to the matched instantaneous-plus-ground model (29.083/58.124 nT). Do not claim a universal forecasting improvement.

Synthetic tests prove software behavior under specified inputs. They do not measure physical classification precision, aurora forecast calibration, sensor sensitivity or cloud RLS security.

## Blue-team case: why AuroraSense has value

1. It connects the causal chain from solar forecasts to local measurement without treating all evidence as interchangeable.
2. It turns a phone into a tangible citizen-science experiment: observe a change, identify contamination, confirm a known test object and preserve the result.
3. Human-confirmed pattern learning makes personalization useful immediately without asserting universal device recognition.
4. An agent that discovers a missing observation and chooses a permitted follow-up is a concrete scientific workflow, beyond a question-answer chatbot.
5. Shared replay, immutable source times, rejection cases and an inconclusive verdict are inspectable demonstrations of trustworthy behavior.
6. Retaining failed baselines and worse-than-baseline model scores gives judges evidence of scientific discipline.

## Red-team case: how the value proposition can fail

1. A phone can be a better detector of domestic interference than of regional geomagnetism. A beautiful trace alone has little scientific value.
2. Object signatures are not unique. Distance, orientation, phone hardware, charging and surrounding objects can dominate a label. A human confirms what was present, not that it caused every feature.
3. A smooth filter can erase a real storm or retain a domestic drift. Evaluate known signal retention and independent references; never promote a filtered trace to ground truth.
4. NOAA feeds are correlated inputs with different cadence, quality and forecast validity. Counting them as independent votes creates false confidence.
5. A remote professional trace and an old phone export are not a correlation experiment. Unknown clock accuracy must remain unknown.
6. Without a real Meta run, model-branded local rules will not substantiate the Stage-One Meta integration requirement.
7. A public raw-data endpoint, unbounded model spending or self-asserted network independence would undermine trust. Those prototype shortcuts must stay disabled.
8. The broad feature set can dilute the three-minute demo. Show one coherent evidence-gap workflow and one physical rejection before optional visual extras.

## Meta AI additions ranked for this submission

**First: real Spark evidence-gap coordinator.** Show actual provider-selected tool calls, missing coverage, a permitted observation request or an explicit no-eligible-volunteer result, deterministic validation and canonical report. The model selects actions; the system enforces consent and verdicts. This is the best incremental competition value.

**Next: Spark-assisted controlled experiments.** Supply a compact, consented feature summary and permitted experimental actions. Spark can suggest “repeat without the charger” or “hold distance fixed,” explain competing hypotheses, and ask the human to confirm/correct the object. Store the user-confirmed label locally. Accept new examples as unvalidated until later independent trials; never let the language model invent a fingerprint match score or relax QC.

**Next: explain changed aurora assessments.** Compare previous/current source-bound results and ask Spark to explain exactly what changed: model cell, Bz history, darkness, missing weather, or stale data. Deterministic evidence remains authoritative. This is useful once an authenticated runtime is wired into the screen.

**Optional later: Muse Wonder independent critique.** Useful for challenging causal interpretations and experimental design, with a clear advisory status. It adds little if it merely restates the same hard-coded guards; current local critique is not a Wonder call.

**Later: SAM-assisted optical evidence review.** Segmentation could support human review of clouds/sky/features in consented photos. Segmentation alone cannot confirm auroral emissions, wavelength, time or location. It needs verified imagery, metadata/privacy processing and a held-out optical evaluation. Do not add a cosmetic integration today.

Muse Image can create clearly educational illustrations; it does not improve measured scientific accuracy. Voice transcription is explicitly out of scope. Training/hosting a new open-weight model today adds operational risk without evidence of a better result.

Meta's current official [tool-calling guide](https://dev.meta.ai/docs/cookbook/tool-function-calling) and [Responses API](https://dev.meta.ai/docs/protocols/responses) support the proposed Spark workflow. Recommendations are product judgments, not promised judging scores.

## Release and owner gates

Before recording: run the README verification commands; load Live and inspect the source timestamps; retain a replay fallback; demonstrate unknown conditions as unknown. Complete a fresh independent pattern confirmation/retest if possible. A 30-second recording cannot satisfy a 120-second baseline or ten-minute reference experiment.

Before submission: verify a genuine Meta runtime artifact, review the public-file list and licenses, record a three-minute video of hackathon-built functionality, verify public repo/video access and submit through the organizer portal. No publication or account change is performed automatically. The pasted guide's judging table was omitted as `[table]`; do not invent rubric weights.

The owner explicitly deferred EZIE testing. It remains a follow-up validation experiment, not a blocker to a clearly labeled research demonstration and not a completed accuracy claim.

## Actual Meta execution verified

The local run with as-of time Nov4 12:22:20 UTC completed with muse-spark-1.3: 4 requests, 11,353 input tokens, 2,435 output tokens, estimated $0.02454. The final tool action occurred at 12:22:41.284 UTC. Tools selected: event context, regional coverage, reference stations, regional validator, opt-in request (BLOCKED), evidence report. It used genuine public USGS BOU data and zero phone/volunteer records. The nonsynthetic research report remained INCONCLUSIVE. The canonical report counts zero **aligned** references because zero phones permit no alignment; one actual professional reference was loaded. See [redacted record](meta-run-verification-2026-11-04.json). No public deployment or participant notification occurred.
