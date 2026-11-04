# Device fingerprinting and recording interpretation review

Reviewed and revised 2026-11-04 for submission. This document describes implemented behavior, not measured object-identification accuracy.

## What works

The local TypeScript matcher extracts baseline-relative scalar amplitude, rate of change using actual timestamps, axis variation, step roughness, steadiness, scalar range and observed cadence. It runs on the phone without a model API call. It is distinct from the Meta scientific coordinator. A user can save an example under a known candidate category or give an unknown object a custom label. Subsequent eligible windows can match that label through a bounded nearest-example distance. This is a small local learning capability; it is not a pretrained universal device detector.

Protocol `local-pattern-2.0.0` rejects nonfinite data, impossible field/baseline ranges, nonincreasing timestamps, acquisition gaps, too-short windows and oversized windows. The acquisition minimum is eight samples spanning 400 ms, with no gap exceeding 1 s. These are engineering gates for a local display feature, not adequate duration or calibrated sensitivity for scientific storm inference. Up to 200 profiles are considered. Normalized feature distance must not exceed 0.7; competing labels within a distance margin of 0.15 cause abstention from learned identity. These constants were fixed before the new regression tests and have not been fitted to measured device accuracy.

Saved examples preserve algorithm version, bounded context, sample-derived features and acquisition-run identity. Matching requires compatible device key, measured/synthetic provenance, motion, touch, battery state and cadence. Profile imports are bounded, validated and copied through an approved-field allowlist. Invalid or legacy examples are ignored. Same-window reuse and overlapping windows from the same monotonic clock are excluded from learning evidence. Identical repeated examples do not increase support; contradictory labels remain visible to the ambiguity check. Nonidentifying acquisition-run IDs allow legitimate recordings after an app restart to use overlapping monotonic clock ranges. Reported example counts count nonoverlapping windows within each run, not independent volunteers or independent experimental trials.

Without a suitable learned example, conservative local heuristics can suggest quiet variation, handling-associated variation, charging-associated variation, or a nearby magnetic-object candidate. Otherwise the result is unknown. Missing motion context is unknown, not presumed stationary. Scores are uncalibrated similarities, not probabilities. A user's label is explicitly `UNVALIDATED_USER_LABEL`; a match does not verify the label's physical cause, manufacturer, model, or identity. A user cannot train this matcher to claim a solar disturbance.

## Corrections to scientific interpretation

- Removed the path that classified a short stationary drift as a solar event. The local classifier never emits `GEOMAGNETIC_SOLAR_DISTURBANCE`; regional inference belongs to the deterministic scientific validator and aligned independent evidence.
- Removed conversions from phone nT amplitude to Kp or NOAA G severity. NOAA's planetary G scale is based on Kp, and a single phone's local magnitude excursion is not an equivalent measurement. Source: [NOAA space-weather scales](https://www.spaceweather.gov/noaa-scales-explanation).
- Removed claims that waveform roughness identifies electronics switching frequency, that body proximity proves tissue diamagnetism, that reported charging proves cable causation, or that a particular windowsill has a known magnetic offset.
- Session reports now retain missing noise, high-water and drift as null. They do not manufacture 100 nT noise, estimate p95 as a fraction of the maximum, or invent a baseline. Timeline descriptions use only QC-usable samples and compute actual medians. Local amplitude bins are display categories, not storm or detection thresholds. The report's numeric quality score is the percentage of samples passing QC, not inferred placement quality.
- The motion detector returns unknown with null metrics for missing, insufficient, stale or invalid acceleration. It resets across acquisition discontinuities and screens vector change as well as magnitude variance, so pitch/roll changes at constant gravity magnitude are no longer called stationary. Accelerometer-only detection still cannot detect every yaw rotation or characterize the supporting surface.
- Removed invented phone readings, a default 90% quiet classification, and hardcoded phone/reference curves from the secondary Ground Truth layout. Its missing values remain unavailable. The amplitude scale no longer assigns object identity from amplitude bins.

## Validation evidence

Commands run from the repository unless otherwise noted:

```powershell
npm exec vitest run packages/shared/src/magnetic-classifier.test.ts packages/shared/src/prescriptive-evaluator.test.ts packages/shared/src/motion-detector.test.ts
npm run typecheck --workspace @aurorasense/shared
# From apps/mobile:
npm run typecheck
```

At 07:06 America/New_York on 2026-11-04, all 28 targeted tests passed: 21 local-pattern tests, 4 session-interpretation tests, and 3 motion-acquisition tests. Shared and mobile TypeScript checks passed in this work session. Later repository-wide checks are recorded in `docs/progress.md`.

The tests exercise unknown-object learning, ambiguity, conflicting labels, duplicate support, overlap leakage, app-restart clocks, context and cadence mismatch, synthetic-to-measured isolation, malformed profiles, invalid acquisitions, first-sample peak extraction, inability to teach solar origin, missing-statistic behavior, QC-only timelines and stale acceleration. One synthetic report fixture deliberately contains a 700 nT excursion: it is reported as local variation with unknown Kp, not G5. All these fixtures are generated software inputs. These tests establish specified software behavior, not physical source-identification accuracy.

## Accuracy gaps and a reproducible physical test

No labeled, held-out, multi-device object-identification benchmark has been completed. Precision, recall, calibration, unknown-object rejection rate and cross-device accuracy are therefore unknown. The stored examples are not a trained denoiser and do not subtract a purported interference component from raw evidence. Raw recordings and deterministic QC remain authoritative. The unrun EZIE-Mag comparison is not validation evidence.

To measure useful local-pattern performance, freeze this protocol version and collect repeated, separately timed absent/present/absent trials for each labeled object on a stationary phone. Preserve device model, sample timing, baseline, motion, charging, placement, orientation and distance. Use delayed cues to avoid touching the recording phone during trial boundaries. Include common confounds and genuinely unseen objects. Keep all windows from a trial in the same split; preferably hold out entire recording sessions, positions, days and phone models. Do not score overlapping buffers as independent successes. Report macro precision/recall for known labels, confusion matrix, unknown rejection, false matches on quiet controls and performance by device/context. Select any thresholds on training/validation trials only, then report the untouched test results even if poor.

For the geomagnetic hypothesis, collect synchronized professional-reference and phone data, verify timestamps/units/frame, estimate measured sensor noise and retain local-interference controls. An EZIE-Mag beside one phone can characterize a local event but does not establish regional spatial independence. Correlation alone may reflect shared local interference. A remote professional station provides context and must not be silently treated as a co-located calibration reference. Visible aurora needs separate viewing and optical evidence.

## Blue-team assessment

The app's useful near-term contribution is an inspectable observation workflow: real sensor acquisition, visible contamination/context, user-labeled local pattern memory, explicit abstention, raw-data preservation and a clear boundary between local variation and regional evidence. A previously unknown household source can acquire a useful personal label without pretending to recognize its manufacturer. The user can test whether that label recurs in separate recordings.

## Red-team assessment

Magnetic inverse source identification is underdetermined: different objects and positions can generate similar short traces, and the same object can change dramatically with distance, orientation and phone model. Users can enter incorrect labels; a confident-looking similarity can reinforce those mistakes. Closely spaced nonoverlapping windows can still be correlated. Quietness does not prove absence of interference. Charging state does not observe all radio/thermal/power behavior. Low-rate acquisition aliases fast signals; the current features cannot reconstruct switching spectra. The scientific outcome must remain inconclusive when independent, synchronized evidence is missing. Submission claims should present local pattern learning as an experimental aid, with accuracy unmeasured, rather than validated device identification, phone-based Kp estimation, or verified storm detection.

## Final acquisition follow-up (2026-11-04)

The phone preview now cancels pending asynchronous sensor initialization on backgrounding, removes both idle listeners, clears displayed live measurements and uses a generation guard against late callbacks. Explicit Stop or consent withdrawal prevents preview restart until a new explicit recording start. Native sample timestamps are used for fingerprint features; receipt monotonic time remains separate for touch age and acceleration freshness. Nonfinite idle readings cannot enter the display baseline, raw recordings stop on absent/nonfinite/backward native timestamps, and unknown battery state remains unknown. These lifecycle changes preserve recorded raw data and the existing deterministic QC thresholds.

A `RECENT_SCREEN_TOUCH` teaching gate keeps the full raw feature values but prevents saving examples while the rolling window overlaps screen interaction. The displayed eligible example can be captured before a save-button touch; no interference is subtracted from the raw measurement.

At 07:21 America/New_York, 33 targeted tests passed (22 fingerprint, 4 interpretation, 3 motion, and 4 existing capture-lifecycle tests). Mobile TypeScript and targeted shared ESLint passed. The full workspace typecheck also encountered a contemporaneous dashboard nullability error, reported to its owning contributor; see the final repository check in `docs/progress.md`. Native background/resume and sensor timestamp availability still require an on-device smoke test; compile checks and simulated lifecycle tests are not physical verification.

The primary phone recording screen now exposes separate unchecked adult (18+) and foreground-local-recording confirmations. Record remains disabled until both are selected, with a second guard in the start handler. Withdrawing either stops acquisition through the existing gate. The recording stage scrolls so the controls remain reachable on smaller phones. Automatic upload on recording completion was removed: local recording consent does not authorize cloud transfer, and Sync remains a separate explicit action. The mobile TypeScript check passed after this wiring change; native accessibility/visual confirmation is still a physical-device check.

The main insights stage now provides raw JSON, CSV and QC export, explicit local deletion confirmation, visible operation status, and a return-to-recording action. It scrolls to keep data controls and reference charts reachable. Starting another recording with an existing local session presents Cancel, Review/export, and explicit Replace choices; preparation no longer silently deletes the previous file. Export/delete controls are disabled during recording or another data operation. Mobile TypeScript passed after this final wiring change. Native Alert cancellation, sharing and replacement remain part of the final on-device smoke test.
