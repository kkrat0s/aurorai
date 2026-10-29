# iPhone acquisition experiments — 2026-10-28

Two owner-provided runs are now inspected: an initial controlled-interference recording and a full-duration stationary repeat. Both raw/QC pairs exactly reproduce under the unchanged `phone-qc-0.1.0` rules. Neither is accepted as a calibrated quiet-noise profile.

The owner operated an iPhone 14 Pro Max and supplied raw session JSON and its QC export after accidentally backgrounding the app. This is a real participant-provided acquisition record, not generated test noise. Hardware provenance is supported by the owner's report and native export; no independent video, calibrated field reference or native instrumentation log was obtained.

## Executed verification

The raw export passed the strict session parser. Every recomputed `phone-qc-0.1.0` field and sample mask exactly matched the supplied QC report. The original files were retained unchanged and excluded from Git. No threshold was adjusted after inspecting the run.

| Measurement | Actual result |
|---|---:|
| Samples | 3,042 |
| Sensor elapsed duration | 304.844 s (5 min 4.8 s) |
| Delivered mean cadence | 9.9756 Hz |
| Median native interval | 0.100244 s |
| Non-increasing sensor intervals | 0 |
| Gaps above 0.5 seconds | 0 |
| Fixed baseline sampled coverage | 119.992 s |
| Baseline scalar median | 51.8578 µT |
| First-120-second scalar MAD | 238.657 nT |
| Usable samples | 1,446 / 3,042 |
| Contiguous usable coverage | 144.452 s |
| Stop reason | APP_BACKGROUNDED |
| Last received sample to recorded stop | about 48 ms |
| Whole-session QC acceptance | false |
| Single-phone regional verdict | INCONCLUSIVE |

Stop metadata and the end of the exported stream are consistent with foreground-only cancellation. This is not independent proof of native listener state after every lifecycle transition. Explicit Stop, consent revocation, deletion, and Android behavior need their own physical checks.

## What the controlled perturbation establishes

Times below are relative to the first sample using the callback UTC anchor; unknown sensor latency and marker-touch timing limit physical alignment.

| Interval | Samples | QC-usable | Findings |
|---|---:|---:|---|
| First 120 s | 1,198 | 1,166 | Startup transients: 31 local-deviation flags, two abrupt jumps, one initially missing motion sample |
| 120–146.62 s | 265 | 265 | No frozen QC flags in this short interval |
| Marked interference, 146.62–181.02 s | 343 | 15 | 325 local-deviation, 290 abrupt-jump, 319 orientation and 240 range-screen flags; flags overlap |
| After interference until motion, 181.02–279.95 s | 987 | 0 | Local-deviation and orientation flags persisted throughout; cannot explain the entire interval as a brief marker tap |
| Marked motion, 279.95–303.10 s | 231 | 0 | 218 motion flags, with magnetic/orientation contamination |

The raw scalar peak was **3,092.079 µT** versus a baseline near **51.858 µT**. `SATURATION_SUSPECT` means the engineering range screen exceeded 2,000 µT; the hardware's actual saturation status remains unknown. A nearby object, device movement, altered orientation and OS recalibration can confound interpretation. This experiment does not identify their individual contributions.

The large perturbation is retained in raw plots and excluded from usable high-water statistics. Remaining quality-screened values include up to 1,908 nT deviation over only 144.452 seconds of usable coverage; they are not a regional geomagnetic high-water claim. No one-hour window was completely measured.

The baseline includes startup transients and slow variation. Its 238.657 nT MAD is **not an intrinsic sensor noise floor**, calibrated detection threshold or false-positive estimate. The later unflagged 26.6-second interval was inspected descriptively; it was not selected for model fitting or acceptance retuning. No empirical-noise network simulation was built from this run. The May 2024 BOU replay is a different time window and cannot validate correlation with this phone session.

## Resulting acquisition changes and next test

Touches are now recorded as optional explicit metadata, with bounded interaction-context summaries. Guided mode supplies visual cues without marker taps; recording-only screen wake prevention avoids touching merely to keep the display active. Original `phone-qc-0.1.0` classification is unchanged. Scheduled prompts are clearly distinguished from observed actions. These changes require a fresh prospective phone test.

Next: a stationary repeat with guided mode off, accessories away and no deliberate screen interaction after Start. Export privately after automatic completion. Use a separate guided run for controlled perturbation; use a smaller/distant stimulus to avoid repeating the extreme field range. Do not change QC thresholds to make the new recording pass.

## Reproduction and privacy

Run `python -m science.experiments.inspect_phone` with the two private paths and optional `--plot`. The utility recompiles canonical QC, verifies metadata and all QC fields, and creates `data/private/phone-analysis/summary.json` and `trace.png`. Plotting requires optional matplotlib. Outputs are constrained to ignored private storage; no acquisition samples or participant locations are committed.

Raw export SHA-256: `335e403d7ffd3e510511b99feae744b2b97f8f4b0d6516a30f8da988befc4905`.

QC export SHA-256: `98cd90fffab4643dc214ce058004d3a902ef3e0d48c720a55f107ea98f31da08`.

## Second run: uninterrupted stationary repeat

The owner reports no interruptions, with the iPhone screen-up on a wooden chair near a window. Charging and case/accessory state were not established. No exact location is recorded. This run used the updated recorder with guided experiment mode off. The export contains only the initial Start marker, with explicit manual-touch origin; no subsequent screen interactions or scheduled cues are recorded.

| Measurement | Actual result |
|---|---:|
| Samples | 5,987 |
| Sensor duration | 600.032 s |
| Actual mean cadence | 9.97614 Hz |
| Median native interval | 0.100239 s |
| Non-increasing intervals / gaps >0.5 s | 0 / 0 |
| Stop reason | DURATION_COMPLETE |
| Last received sample to recorded stop | about 4 ms |
| Baseline sampled coverage | 119.9866 s |
| First-120-second median | 155.6448 µT |
| First-120-second MAD | 801.466 nT |
| Frozen noisy-baseline threshold | 250 nT |
| QC-usable samples | 0 |
| Whole-session acceptance | false |
| Regional verdict | INCONCLUSIVE |

All 5,987 samples carry `NOISY_BASELINE` because v0.1 applies this failed baseline gate to the whole session. There are also 2,700 local-deviation flags, one abrupt jump and one orientation flag. There are **no MOTION flags**, no missing accelerometer samples and no stale accelerometer rows; the maximum reported acceleration age is about 37 ms. Maximum vector departure from baseline acceleration is about 0.0511 g, below the frozen 0.06 g threshold. These checks support absence of detected motion, not independent proof of perfect stationarity.

The first and final 30-second raw scalar medians are **158.2442 µT** and **149.1478 µT**, respectively: **−9,096.434 nT** change. These fixed-duration endpoint summaries were added during exploratory inspection; they are not a preregistered validation score, drift correction, or threshold fit. The raw full-run range is 146.6376–159.7722 µT. Its baseline is substantially different from the earlier session's 51.8578 µT, but the setup/calibration history is insufficient to identify why.

The absence of later recorded touches rules out explaining the whole trajectory solely with marked screen interactions. Local environmental fields, nearby objects, instrument behavior and OS calibration remain unresolved possibilities. The run does not establish which one caused the variation, does not isolate intrinsic sensor noise, and provides no regional-storm or aurora evidence. No empirical-noise simulation is fitted from it.

**Acquisition outcome:** a full ten-minute native iPhone stream and automatic stop are supported by the owner report and matching export. Screen-wake behavior is consistent with the uninterrupted run, without independent OS instrumentation. Guided cues remain physically untested; Android remains untested.

**Next experiment:** validate the Pixel recorder with an untouched stationary run, guided mode off, on a plain nonmagnetic support. Disconnect charging, remove magnetic accessories/cases and place the earlier interference source well away before starting. Record the setup; retain failed runs alongside passing ones. A later two-phone comparison can investigate shared versus device-specific variation, but co-located phones do not count as independent regional sites. Do not relax thresholds or select a favorable quiet interval to obtain acceptance.

The new private analysis is `data/private/phone-analysis-stationary/summary.json` and `trace.png`; the raw exports remain unchanged and ignored.

Second raw SHA-256: `e44eee960e06ef5602c3a563c9e21ebc9b0e3f90a5cbbfac58f6a6663cf45566`.

Second QC SHA-256: `8f3de44751411a058f6ca4e729bf60af872b7381e3536c840e760489cee15ead`.
