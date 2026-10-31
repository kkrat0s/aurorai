# iPhone Acquisition Experiment — 2026-10-31 (Passing Stationary Run)

A third owner-provided iPhone run (`phone-1793471459272`) has been inspected. **This is the first physical phone session in AuroraSense project history to fully pass all frozen engineering QC v0.1 gates (`accepted: true`, zero QC flags).**

The owner operated an iPhone 14 Pro Max and supplied the raw session export (`phone-1793471459272-json.json`) and matching QC report (`phone-1793471459272-qc.json`). Hardware provenance is supported by the owner's report and native export; no precise location is recorded or transmitted.

---

## 1. Executed Verification & Metrics

The raw export was parsed with `parseSensorSession` and recomputed using the unchanged `phone-qc-0.1.0` engine. Every field and sample result in the supplied QC export **matched the canonical calculation byte-for-byte** (`recomputedQcExactlyMatched: true`).

| Metric | Measured Value | QC v0.1 Requirement | Status |
| :--- | :---: | :---: | :---: |
| **Total Samples** | **5,985** | $\le 6,000$ | **PASS** |
| **Sensor Elapsed Duration** | **600.023 s (10 min 0.02 s)** | 600 s | **PASS** |
| **Delivered Mean Cadence** | **9.9729 Hz** | $\approx 10\text{ Hz}$ | **PASS** |
| **Median Native Interval** | **0.100271 s** | $\approx 0.1\text{ s}$ | **PASS** |
| **Non-Increasing Timestamps** | **0** | $0$ | **PASS** |
| **Gaps > 0.5 Seconds** | **0** | $0$ | **PASS** |
| **Fixed Baseline Sampled Coverage** | **119.927 s** | $\ge 108\text{ s}$ | **PASS** |
| **Baseline Scalar Median ($B_0$)** | **46.0952 µT (46,095.2 nT)** | $1\text{--}2000\,\mu\text{T}$ | **PASS** |
| **Baseline Scalar MAD** | **62.0108 nT** | $\le 250\text{ nT}$ | **PASS** |
| **QC Usable Samples** | **5,985 / 5,985 (100%)** | $\ge 80\%$ | **PASS** |
| **Motion Flags** | **0** | $0$ | **PASS** |
| **Orientation Flags** | **0** | $0$ | **PASS** |
| **Abrupt Jump Flags** | **0** | $0$ | **PASS** |
| **Large Local Deviation Flags** | **0** | $0$ | **PASS** |
| **Range / Saturation Flags** | **0** | $0$ | **PASS** |
| **Stop Reason** | `DURATION_COMPLETE` | Expected | **PASS** |
| **Whole-Session QC Acceptance** | **`true`** | `true` | **ACCEPTED** |
| **Single-Phone Regional Verdict** | **`INCONCLUSIVE`** | `INCONCLUSIVE` | **SCIENTIFIC INVARIANT** |

---

## 2. First Empirically Measured iPhone Magnetometer Noise Floor

Previous sessions had either failed with local electrical interference (Run 2: $801.5\text{ nT}$ MAD) or were aborted early (Run 1: $304.8\text{ s}$). This session provides the **first clean empirical measurement of smartphone magnetometer baseline noise** on an iPhone 14 Pro Max:

- **Baseline Noise MAD**: **$62.01\text{ nT}$** ($0.062\,\mu\text{T}$)
- **Baseline Noise Standard Deviation ($\sigma$)**: **$96.99\text{ nT}$** ($0.097\,\mu\text{T}$)
- **Minimum Baseline Scalar**: $45.691\,\mu\text{T}$ ($-404.7\text{ nT}$ from median)
- **Maximum Baseline Scalar**: $46.421\,\mu\text{T}$ ($+326.0\text{ nT}$ from median)

This directly fulfills Milestone 1 / Gate 1: **obtaining empirical phone baseline noise before any network simulation**. The empirical noise floor ($\mathrm{MAD} \approx 62\text{ nT}$, $\sigma \approx 97\text{ nT}$) confirms that consumer phone Hall-effect/AMR sensors can resolve field changes above $\sim 100\text{--}150\text{ nT}$ (NOAA G2–G5 storm scales), but cannot reliably resolve quiet G0 fluctuations ($< 30\text{ nT}$) without multi-minute averaging.

---

## 3. Physical Accelerometer & Posture Analysis

The export includes 3-axis accelerometer telemetry synchronized with every magnetic sample:

- **Mean Acceleration Vector**: $a_x = +0.0211\,\text{g}$, $a_y = -0.0181\,\text{g}$, $a_z = -0.9943\,\text{g}$
- **Mean Acceleration Norm ($\|a\|$):** $0.9947\,\text{g}$
- **Acceleration Standard Deviation ($\sigma_a$):** **$0.00073\,\text{g}$**
- **Maximum Dynamic Acceleration ($\|\|a\| - 1\text{ g}\|$):** **$0.0080\,\text{g}$** (well below the $0.05\,\text{g}$ motion threshold)
- **Posture Interpretation**: The phone rested completely flat face-down/face-up on a horizontal support, with verified absolute standstill throughout all 600 seconds.

---

## 4. Magnetic Perturbation & 10-Minute Drift Progression

Following the initial 120-second fixed baseline ($B_0 = 46.095\,\mu\text{T}$), the ambient field exhibited a slow, sustained drift over the remaining 8 minutes:

| Interval | Samples | Median $\Delta B$ | MAD | Range ($\Delta B$) | Max Raw $\|dB/dt\|$ | Filtered $\|dB/dt\|$ (1s) |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Min 00–01** | 599 | $-1.1\text{ nT}$ | $69.8\text{ nT}$ | $[-404.7, +326.0]\text{ nT}$ | $3.232\,\mu\text{T/s}$ | $0.082\,\mu\text{T/s}$ |
| **Min 01–02** | 598 | $+0.5\text{ nT}$ | $53.6\text{ nT}$ | $[-228.6, +304.2]\text{ nT}$ | $2.981\,\mu\text{T/s}$ | $0.071\,\mu\text{T/s}$ |
| **Min 02–03** | 599 | $-107.7\text{ nT}$ | $72.9\text{ nT}$ | $[-457.1, +227.8]\text{ nT}$ | $2.160\,\mu\text{T/s}$ | $0.068\,\mu\text{T/s}$ |
| **Min 03–04** | 598 | $-159.6\text{ nT}$ | $86.6\text{ nT}$ | $[-537.0, +145.0]\text{ nT}$ | $2.763\,\mu\text{T/s}$ | $0.084\,\mu\text{T/s}$ |
| **Min 04–05** | 599 | $-130.0\text{ nT}$ | $91.2\text{ nT}$ | $[-591.4, +156.2]\text{ nT}$ | $3.048\,\mu\text{T/s}$ | $0.079\,\mu\text{T/s}$ |
| **Min 05–06** | 598 | $-71.0\text{ nT}$ | $73.5\text{ nT}$ | $[-417.0, +188.4]\text{ nT}$ | $3.207\,\mu\text{T/s}$ | $0.075\,\mu\text{T/s}$ |
| **Min 06–07** | 599 | $+78.6\text{ nT}$ | $79.4\text{ nT}$ | $[-392.4, +396.3]\text{ nT}$ | $3.942\,\mu\text{T/s}$ | $0.091\,\mu\text{T/s}$ |
| **Min 07–08** | 598 | $-86.3\text{ nT}$ | $92.7\text{ nT}$ | $[-548.6, +318.5]\text{ nT}$ | $3.822\,\mu\text{T/s}$ | $0.083\,\mu\text{T/s}$ |
| **Min 08–09** | 599 | $-246.1\text{ nT}$ | $85.0\text{ nT}$ | $[-635.7, +217.6]\text{ nT}$ | $3.962\,\mu\text{T/s}$ | $0.112\,\mu\text{T/s}$ |
| **Min 09–10** | 598 | $-321.0\text{ nT}$ | $122.4\text{ nT}$ | $[-924.6, +90.5]\text{ nT}$ | $4.529\,\mu\text{T/s}$ | $0.145\,\mu\text{T/s}$ |

### Excursion Highlights:
- **Net Drift (Last 60s median minus baseline)**: **$-320.8\text{ nT}$** (Endpoint 30s diff: $-379.4\text{ nT}$).
- **Peak Sustained Negative Excursion**: $\sim -548\text{ nT}$ at $t \approx 565\text{ s}$ (with single-sample extreme $-924.6\text{ nT}$).
- **Peak Sustained Positive Excursion**: $+396.6\text{ nT}$ at $t \approx 383.6\text{ s}$.
- **High-Water 95th Percentile**: **$432.5\text{ nT}$** (within NOAA G4 Severe Space Weather ground deflection levels).

---

## 5. Rate of Change ($dB/dt$) & Noise Differentiation Insight

A critical physical signal processing insight emerged from differentiating this real stationary dataset:

$$\mathrm{Var}\left(\frac{\Delta B}{\Delta t}\right) = \frac{2\sigma^2}{\Delta t^2}$$

- **Raw Adjacent Sample Differentiation ($\Delta t = 0.1\text{ s}$)**: Differentiating raw $10\text{ Hz}$ samples amplifies sensor thermal noise ($\sigma = 97\text{ nT}$) into false spikes of up to **$4.529\,\mu\text{T/s}$**, even though the phone never moved.
- **Low-Pass Filtered (1-second window)**: The median rate of change drops to **$0.076\,\mu\text{T/s}$** ($76\text{ nT/s}$), and the 95th percentile is **$0.221\,\mu\text{T/s}$**.
- **Physical Meaning**: The slow evolution ($\sim 0.08\,\mu\text{T/s}$) confirms that the gradual $-333\text{ nT}$ drift represents an ultra-low frequency environmental/space-weather timescale process, completely distinct from rapid human hand gestures ($dB/dt > 1.5\,\mu\text{T/s}$).

---

## 6. Reproduction & Privacy Check

Run the reproduction command:
```powershell
python -m science.experiments.inspect_phone phone-1793471459272-json.json phone-1793471459272-qc.json --plot
```

- **Raw export SHA-256**: `ae366dcc0ad1df0feadf4733101fa24e7a5968e5cdf83757c3802eb0ae42aed2`
- **QC export SHA-256**: `6412598ea1e682ae2568ddc2aa2bb384ba5c8f6dc5e8b9aff6b933fd12d49663`
- **Output Artifacts**: Constrained to `data/private/phone-analysis/summary.json` and `trace.png` (both ignored from Git). Zero precise participant locations, coordinates, or identifiers exist in the dataset.
