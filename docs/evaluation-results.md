# Measured science results — 2026-10-28

## Held-out BOU X, 30-minute horizon

The small retrospective experiment ran on genuine NASA OMNI and USGS BOU data. The target is five-minute mean X at +30 minutes minus the previous-hour ground median. All errors below are **nT**, not visibility probabilities.

| Model | Pooled MAE | Pooled RMSE | Bias |
|---|---:|---:|---:|
| Persistence | 29.094 | 61.384 | +5.541 |
| Southward-coupling ridge | 32.821 | 64.446 | +7.659 |
| Instantaneous + prior-ground ridge | 29.083 | 58.124 | +8.295 |
| History + prior-ground ridge (candidate) | 29.480 | 58.694 | +10.050 |

The temporal-history candidate **did not improve MAE over persistence** and lost both MAE and RMSE to the matched instantaneous-plus-ground model. It reduced pooled RMSE relative to persistence in this small test, which is insufficient for a general improvement claim. No phone inputs were used.

| Held-out block | Cases | Persistence MAE / RMSE | Candidate MAE / RMSE |
|---|---:|---:|---:|
| May 1–4, 2024 control | 370 | 10.008 / 17.160 | 11.703 / 19.115 |
| May 10–13, 2024 storm | 481 | 43.775 / 80.249 | 43.155 / 76.249 |

Training: **2,191** complete cases in three whole 2023 blocks. Test: **851** complete cases in two whole 2024 blocks. Complete-case filtering excluded **1,764** of 4,806 potential cases across train/test due to missing prior ground or solar-wind values. Only 370/846 control cases and 481/846 storm cases were retained: these are **coverage-conditional** scores, not full-period performance. The target minutes and feature history are never shared across train/test events. These purposive windows, one station and one held-out major storm do not support population-level confidence intervals or broad scientific claims. Five-minute cases are autocorrelated; case count is not independent-event count.

Historical availability is unknown; scores are retrospective and **not operational backtest performance**. No optical aurora or phone forecasting improvement is measured. Numerical outputs, all exclusions, feature coefficients, source checksums and per-event scores are in `science/results/`; the exact frozen cases can be refit with `python -m science.experiments.learn --offline`.

## Broomfield gate and reference comparison

- ZIP checksum and 30,765,514-byte size verified against Zenodo.
- 1,289 CSV files; 38 byte-identical exports skipped; one invalid-UTF-8 file excluded.
- 2,871,517 parsed rows. Parseable timestamps range April 2, 2024–September 18, 2025; no 2023 records were found in parseable files.
- 7,182 invalid-field rows. 622,560 repeated second-resolution timestamp pairs, **zero reversed pairs**. Median positive timestamp interval is one second; this does not establish delivered sensor cadence.
- 478 exports have a geographic coordinate span exceeding 1 km; stationary measurement is not established for the remaining exports either.
- May 10–13 overlap: **4,369 valid rows, 735 unique UTC minutes**. Five individual exports have at least ten matched BOU-F minutes.
- Those five exploratory zero-lag correlations range −0.661 to +0.319. Median-centered phone-versus-station residual RMSE ranges **345–4,253 nT**. No file is accepted as validated stationary evidence.

The archive gate is **NO-GO for a validated historical phone-storm claim** because calibration, motion/stationarity and stable physical-device/site identity are absent. License is CC BY 4.0 in Zenodo API metadata, but precise position data stay private. The original scientific question remains unresolved; collecting a physical stationary baseline and controlled interference trace is still required.

## Executed verification

`python -m unittest discover -s science/tests -v`: **17 tests passed**. Tests cover finite/sentinel handling, UTC, original CME issuance filtering, revision retention, USGS missing fields/shape, NOAA current-time integrity and active-source selection, ZIP safety, whole-event embargoes, unknown availability, forbidden event membership, target-window crossing, duplicate cases, future solar-wind bins, and a counterfactual future-ground change that changes labels without changing earlier features. Offline refitting reproduced the stored scores exactly on the pinned local runtime.

Public NASA, NOAA, USGS and Zenodo endpoints returned HTTP 200 for the working adapters. No physical phone, hosted database, live model provider, or public deployment is tested by these science checks.
