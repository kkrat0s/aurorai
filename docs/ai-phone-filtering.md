# AI-assisted phone filtering — executed exploratory experiment

On October 28, 2026 the owner requested that initial amplitude/stability thresholds stop blocking exploratory analysis and that AI be used to understand/filter the observations. The local experiment uses all finite stationary-recording values independently of QC acceptance, preserving the original raw files, QC report and regional verdict. No Meta request or upload occurred.

## What ran

`science/experiments/phone_denoising.py` fits a **Gaussian-process regression** model to measured phone scalar magnitude. This is a learned statistical model. It learns covariance parameters by marginal-likelihood optimization; see [scikit-learn's documentation](https://scikit-learn.org/stable/modules/gaussian_process.html).

The 5,987-sample iPhone export is aggregated into 600 complete one-second medians; one sample in the incomplete terminal second is not binned. No value is excluded because of the 250 nT/MAD screening result. The model fits every fifth point (120 training values), using a Matérn smooth component and a white-variation term. Normalization, kernel and response operator are frozen before injection scoring.

The saved protocol was fixed before fitting this model or viewing injection scores. The phone trace and historical BOU data were already inspected; this is an exploratory demonstration, not an externally preregistered validation. No independently known clean-phone target or held-out device exists.

The bounded optimizer converged in ten iterations without warnings. Its learned length scale is **75.893 seconds**. The white-variation term is a model assumption, not an independently measured hardware noise floor. Full-precision kernel parameters, software versions, hashes, timestamps and warnings are saved privately.

Two outputs serve different purposes:

- **GP smooth:** an estimate of the slowly varying component, which may contain environmental effects, calibration drift and geomagnetic signal together. Its physical source is unidentified.
- **GP detrended:** observed values minus that component, useful for exploring faster fluctuations. A flatter residual does not establish a corrected measurement of Earth's field.

Comparisons include unchanged one-second medians, a 15-second median smoother and linear detrending. These filters use future samples and have not been validated for live operation.

## Synthetic injection check using real observatory shapes

Actual May 10–13, 2024 **USGS BOU scalar F variations** were added to the 2026 phone series as synthetic injections. All 432 complete nonoverlapping ten-minute intervals were evaluated without amplitude rescaling. Eleven measured minute values per interval are linearly interpolated to seconds; interpolation creates no new independent observations. Adjacent intervals share a boundary minute and can be correlated.

Each response is `filter(phone + injected variation) − filter(phone)`. The known shape is compared with this differential response. GP parameters and normalization never change after injection. Phone and observatory values are **not simultaneous**; this is **not a real historical phone storm or distributed phone-network observation**.

| Method | Rapid-variation measure, nT | Median retained injection amplitude | Median centered shape RMSE, nT |
|---|---:|---:|---:|
| Unchanged one-second medians | 102.921 | 100.000% | approximately zero |
| 15-second median | 9.952 | 99.694% | 0.08824 |
| Linear detrending | 102.921 | 30.553% | 1.20648 |
| Learned GP smooth | 28.528 | 99.961% | 0.01199 |
| Learned GP detrended residual | 100.737 | 0.039% | 1.88645 |

Rapid variation is the MAD of first differences at one-second cadence: a descriptive roughness metric, **not accuracy or clean-signal reconstruction error**. The simple median reduces this metric more than the GP; the GP preserves the tested slow shapes more closely. No universally best filter is established.

Retained amplitude is centered least-squares response gain: 100% means the added variation passes through; 0% means it is removed. It is not confidence or detection probability. **99.961% retention does not demonstrate recovering a tiny signal from a noisy observation**: the differential calculation cancels the unmodified background output. It measures filter transmission, not end-to-end detection skill or total denoising accuracy.

Subtracting the GP component reduces the one-second-median endpoint change from **−9,137.577 nT to −26.502 nT**, while removing almost all the tested minute-scale geomagnetic variations. It cannot be promoted as a validated correction just because it flattens the trace. This differs slightly from the earlier raw-sample endpoint statistic because the analysis now uses one-second medians.

The reference shapes have minute cadence and scalar F only. No preservation claim applies to sub-minute phenomena, vector components, other devices or locations. The original QC report remains unchanged and the regional verdict remains INCONCLUSIVE.

## How AI helps next

1. **Artifact understanding:** combine magnetic axes, inertial measurements, timing, interactions and labeled controlled tests to learn device-specific patterns. There are no observed cat-activity labels, so AI cannot attribute variations to cats.
2. **Reference-informed correction:** estimate a shared regional component separately from per-device drift using synchronized professional measurements and independent sites. Paired calibrated/uncalibrated streams and device-state metadata could help diagnose calibration effects; they are future diagnostics, not existing measurements.
3. **Signal-preservation validation:** retain raw, smooth and residual curves; evaluate losses, false alarms and recovery on held-out sessions/devices. Training and certification need separate data.
4. **Muse Spark coordination:** the existing seven-tool coordinator can inspect derived summaries, identify missing evidence and explain the qualified conclusion. The LLM selects authorized deterministic analyses/observations; it does not replace numeric measurements or override the validator. No credentialed Spark run occurred here.

There is precedent for reference-informed ML correction: [Inceoglu and Loto'aniu (2021)](https://repository.library.noaa.gov/view/noaa/44542) used supervised/unsupervised methods and spacecraft magnetometer references to correct offsets. This motivates an approach, not a validated phone denoiser or transferable performance guarantee.

## Reproduction and privacy

```powershell
python -m science.experiments.phone_denoising path/to/private-raw.json path/to/private-qc.json --plot
python -m unittest discover -s science/tests -v
```

The frozen protocol is tied by SHA-256 to the inspected stationary export; another recording requires a newly versioned protocol. Required NumPy/SciPy/scikit-learn versions are already pinned; optional plotting uses matplotlib.

Outputs remain under ignored `data/private/phone-ai-exploration/`: `results.json`, `curves.csv`, `overview.png` and `injection-example.png`. Phone-derived curves are not committed. Public documentation contains only aggregates and methods. No credential, exact participant location, GPU, cloud inference or deployment is involved.

**Verification:** 28 scientific/unit tests passed, including units/time, missing bins, independent injection columns, frozen GP response, complementary smooth/residual outputs and known zero/complete signal-removal controls. A second execution exactly reproduced every numerical score and protocol hash.
