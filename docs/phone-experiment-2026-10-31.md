# Owner-provided iPhone acquisition: 2026-10-31

Independently recomputed on 2026-11-04 using the existing inspection CLI and unchanged `phone-qc-0.1.0`. The supplied raw recording and QC export are present locally, remain ignored by Git, and were not uploaded. This report contains aggregate statistics only.

**Result: 5,985 samples passed the frozen acquisition QC, with a first-120-second scalar MAD of 62.0108 nT. Regional evidence remains INCONCLUSIVE.** The MAD measures variability in this recording. It does not isolate intrinsic sensor noise, establish calibrated detection sensitivity, or identify a geomagnetic cause.

## Provenance and reproducibility

The owner reports using an iPhone 14 Pro Max. The session declares `MEASURED_LIVE`, DEVICE-frame axes in microtesla and OS-calibrated sensor values with unknown absolute accuracy. That declaration and the owner's report support its provenance; independent hardware verification was not performed. EZIE-Mag correlation testing remains deferred at the user's request.

```powershell
python -m science.experiments.inspect_phone phone-1793471459272-json.json phone-1793471459272-qc.json --output data/private/phone-analysis-oct31-verification
```

The command succeeded on 2026-11-04. `parseSensorSession` parsed the raw recording and the existing TypeScript QC engine recomputed it. The recomputed QC object and every sample result were deeply equal to the supplied QC object (`recomputedQcExactlyMatched: true`); this is equality of parsed calculations, not a claim about identical JSON serialization. The current sensor QC source had no working-tree changes during this verification.

- Raw export SHA-256: `ae366dcc0ad1df0feadf4733101fa24e7a5968e5cdf83757c3802eb0ae42aed2`
- Supplied QC SHA-256: `6412598ea1e682ae2568ddc2aa2bb384ba5c8f6dc5e8b9aff6b933fd12d49663`
- Private verification output: `data/private/phone-analysis-oct31-verification/summary.json`
- Both input files and output path passed `git check-ignore`.

## Verified aggregate measurements

| Measurement | Recomputed value | Interpretation |
|---|---:|---|
| Samples | 5,985 | Actual delivered samples |
| Sensor elapsed duration | 600.023431 s | Monotonic sensor timestamps |
| Delivered mean cadence | 9.972944 Hz | Actual cadence, not requested rate |
| Median native interval | 0.100271 s | Actual inter-sample interval |
| Smallest / largest native interval | 0.100266 / 0.100279 s | Timestamp spacing, not hardware accuracy |
| Non-increasing timestamps | 0 | Passed time-order screening |
| Gaps exceeding 0.5 s | 0 | Passed acquisition gap screening |
| Fixed baseline coverage | 119.927363 s | Coverage in predetermined first 120 seconds |
| Baseline scalar median | 46.095242 µT | 46,095.242 nT; absolute calibration unknown |
| Baseline scalar MAD | 62.010769 nT | Median absolute deviation about the fixed baseline median |
| QC-usable samples | 5,985 / 5,985 | 100% under existing engineering rules |
| QC flags | None | No detected violation of those rules |
| Usable observed coverage | 600.023431 s | Ten minutes, not a complete 1/6/24-hour window |
| Stop reason | `DURATION_COMPLETE` | Normal scheduled completion |
| Acquisition acceptance | `true` | Local engineering QC passed |
| Regional scientific verdict | `INCONCLUSIVE` | No independently validated regional detection |

## Descriptive change during the recording

The existing inspector calculates predetermined 30-second endpoint summaries using raw scalar magnitudes:

| Endpoint statistic | Value |
|---|---:|
| First 30-second median | 46.139538 µT |
| Last 30-second median | 45.760098 µT |
| Last minus first | −379.439972 nT |

This is an exploratory raw-variation summary, not a drift correction or causal attribution. It is explicitly marked `qualityScreened: false` by the inspector even though this particular session has all samples QC-usable. Temperature drift, OS calibration, changes in local magnetic conditions, motion below screening sensitivity and genuine environmental variation remain possible explanations. No simultaneous independently verified professional or EZIE reference establishes the cause of this change.

## What this result supports

The application can acquire a complete ten-minute owner-provided phone session, preserve native cadence and source metadata, export raw samples, and reproduce acceptance under the existing deterministic QC rules. The measured baseline variability is useful for designing subsequent paired experiments and for explicitly labeled simulations based on this recording, provided those simulations preserve its provenance and limitations.

No motion flags means the recorded accelerometer and orientation features did not violate their screening rules. It does not prove absolute standstill or rule out small rotation, nearby metal, case magnets, electric currents, thermal effects or OS calibration changes. Accelerometer measurements cannot detect all changes in the local magnetic environment.

## What this result does not support

- **Intrinsic noise floor:** the fixed-baseline MAD includes both instrument and environmental variation. A controlled calibrated reference experiment is needed to separate them.
- **A 100–150 nT detection threshold:** a single recording does not establish sensitivity, specificity or an operating threshold. The QC thresholds are engineering screens, not calibrated detection claims.
- **A NOAA G level:** a phone scalar excursion or percentile cannot be converted into a planetary storm category. No G2/G3/G4/G5 claim follows from these values.
- **A space-weather cause:** slow variation or a smoother curve does not identify the source. Filtering changes temporal structure and can conceal local effects.
- **Forecast improvement:** no controlled experiment here compares predictions with and without independent phone measurements.
- **Regional independence or visible aurora:** a single indoor device cannot establish either.

The prior version of this report overstated noise-floor, sensitivity, absolute-stationarity and storm-class interpretations. Those claims are withdrawn; the verified numerical acquisition results above are retained. Additional unverified minute-by-minute, derivative and accelerometer summary tables are omitted from this corrected report.

## Next physical validation

When the owner resumes EZIE-Mag testing, record paired stationary sessions with independently checked timing, calibration/status metadata, fixed protocols and controlled interference trials. Compare quiet periods and disturbances across independent devices and sites. Preserve the original raw records; freeze proposed filters before evaluating held-out events; report failures and false positives. Until then, demonstrate this session as an acquisition/QC result and leave its geomagnetic interpretation inconclusive.
