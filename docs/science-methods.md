# Executed scientific methods — 2026-10-28

The code and reports in `science/` implement bounded acquisition and one small retrospective experiment. None of these results establish phone forecasting value, a successful physical-device test, or a visible aurora observation.

## Reproduction

```powershell
python -m pip install -r science/requirements.txt
python -m science.acquisition.sources
python -m science.experiments.inspect_broomfield
python -m science.experiments.learn
python -m science.experiments.learn --offline
python -m unittest discover -s science/tests -v
```

The first three acquisition commands need public HTTPS access. Responses are cached with SHA-256, URL and actual retrieval UTC under ignored `data/raw/`; reruns verify hashes and use the exact cached bytes. `--refresh` on the source acquisition command refreshes the live source snapshot deliberately. The offline learning command uses the committed 3,042 derived cases and verifies their hash plus the frozen protocol hash before fitting. It makes no network calls.

## Historical CME ensemble

Queried NASA CCMC's documented Earth CME Scoreboard for CME launch dates May 8–11, 2024. The selected event is `2024-05-08T12:24:00-CME-001`: 10 pre-arrival submissions from seven named methods, with revisions retained. Its provider-recorded observed arrival is May 10 at 16:36 UTC. `submissionTime` becomes `issuedAtUtc`; availability is explicitly based on that provider field, not an independently archived publication log. Observed-arrival publication time remains unknown.

The response also includes average and median rows submitted **January 7, 2025**. Those retrospective rows are excluded from the historical as-issued ensemble. Submission must precede both predicted and observed arrival. Method spread and supplied uncertainty hours are not calibrated confidence probabilities. Full submitted prose is not redistributed. See the per-source checksum and exclusion report.

Source: [NASA CCMC API](https://ccmc.gsfc.nasa.gov/tools/API/) and [Earth CME Scoreboard](https://ccmc.gsfc.nasa.gov/scoreboards/cme/earth/).

## Professional ground measurements

USGS BOU adjusted one-minute XYZF data were acquired for May 10–13, 2024, including the endpoint: **4,321 timestamps**. X and F are used by the demo; missing values remain null. Z is unavailable in this acquired interval and is not synthesized from other components. All components are reported in nT with geographic orientation; these are professional reference fields, not device-coordinate phone axes. Historical operational availability is unknown and is never set to observation time.

The historical plot may subtract a declared baseline for readability. The preserved fixture stores original physical values. A single BOU station is not a claim of worldwide or optically confirmed activity.

Source: [USGS geomagnetism service](https://geomag.usgs.gov/ws/data/).

## NOAA live snapshot

The current OVATION JSON provides observation time, forecast time and `[longitude, latitude, activity]` cells. The fixture selects every second latitude/longitude cell from the actual grid; it does not interpolate or extend its forecast horizon. The field is modeled auroral activity, not calibrated local naked-eye visibility. The source does not give a separate issuance time, so it remains null. Retrieval time is the earliest proven availability for this local snapshot. An October 2026 frame cannot appear as a May 2024 issued forecast.

The currently working RTSW endpoints are `rtsw_mag_1m.json` and `rtsw_wind_1m.json` in the provider's `/json/rtsw/` directory. Only `active: true`, `overall_quality: 0` records are selected. Magnetic and plasma source identities are retained separately, Bz is GSM, and unmatched values stay missing. The fixture includes the most recent 120 selected minute timestamps. Older `/products/solar-wind/*-1-day.json` paths returned HTTP 404 and are not used.

Sources: [NOAA OVATION](https://services.swpc.noaa.gov/json/ovation_aurora_latest.json), [NOAA RTSW](https://services.swpc.noaa.gov/json/rtsw/), [aurora forecast interpretation](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast).

## Broomfield feasibility gate

The 30,765,514-byte Zenodo ZIP matches the advertised MD5. Inspection checks paths, symlinks, encryption, file count, individual/total expanded size, expansion ratio, UTF-8, CSV schema, finite values and timestamp syntax. Members are never extracted. Raw precise coordinates are never written to public artifacts or printed.

One invalid-UTF-8 file is excluded; exact duplicate files are skipped. The six-column export has UTC time, latitude/longitude and total/horizontal/vertical fields in nT. It lacks raw device x/y/z, stable physical-device IDs, motion, accuracy and calibration metadata. Filename hardware strings identify **models**, not independent devices. Equal second-resolution timestamps are counted separately from reversals; actual subsecond cadence cannot be recovered from them.

May 10–13 overlap is real, but usable stationary time is unverified. A zero-lag descriptive comparison independently aggregates each export into UTC-minute median total field and joins USGS BOU F. Each series is centered on its own overlap median; no lag search, filtering optimization, significance claim or regional detection is performed. The output is **exploratory and rejected as validated phone-storm evidence**. Residuals can include changing local field, calibration and unverified motion. No forecast benefit is inferred.

Source and attribution: C L Stanton (2026), [Broomfield, Colorado Citizen Magnetometer Dataset 2023–2025](https://doi.org/10.5281/zenodo.18928938), CC BY 4.0 as explicitly returned by the [Zenodo metadata API](https://zenodo.org/api/records/18928938). Despite the reuse license, raw position-bearing data remain ignored/private.

## Learning task and leakage controls

The frozen `science/experiments/learning_protocol.json` defines one station, target, horizon, windows, models and metrics before model fitting. Some May 2024 source data had already been acquired for the demo; this is not claimed as externally preregistered research.

At five-minute issue times, predict the mean BOU geographic X over **[issue + 30 min, issue + 35 min)** relative to median X over **[issue − 60 min, issue)**. Unit: nT. Prior ground observations end one minute before issuance. OMNI's latest five-minute bin starts five minutes before issuance, avoiding use of a bin that extends after issue time. Complete prior-hour solar-wind and ground data and all five target minutes are required. No gap interpolation is performed.

Training consists of March 22–26, April 22–26 and June 10–13, 2023. Entire May 1–4 and May 10–13, 2024 blocks are held out. Events have a minimum 24-hour embargo, and every feature/target window remains in its own block. Scaling is fit on training rows only. Ridge alpha is fixed at 10; no score-based hyperparameter selection occurs.

Models: current-ground persistence; a ridge fit on southward convective-field proxy `speed × max(−Bz_GSM, 0) × 10^-3` and pressure; instantaneous inputs plus prior ground; and that model plus one-hour Bz mean/standard deviation/southward fraction/reversals, pressure change and mean coupling. The instantaneous model is the fair matched-state ablation for the value of temporal features. This small coupling baseline is not a complete magnetospheric model or Newell implementation.

NASA OMNI HRO five-minute data are retrospectively time-shifted to the bow-shock nose. Their time tags are target-arrival times, not the original upstream instrument observation times. The original operational availability of these values and USGS adjusted values is unknown. **All cases retain null availability and `operationallyEligible: false`.** The experiment is observation-causal retrospective analysis, not an operational forecast backtest. The strict operational gate refuses unknown/late availability.

Sources: [NASA HRO construction and time shifting](https://omniweb.gsfc.nasa.gov/html/omni_min_data.html), [CDAWeb HAPI](https://cdaweb.gsfc.nasa.gov/hapi/), [OMNI acknowledgments](https://omniweb.gsfc.nasa.gov/html/ow_min_data.html). We acknowledge NASA GSFC/SPDF OMNIWeb, the underlying contributing instrument teams, and USGS.

No empirical phone-noise simulation is produced yet: it requires a genuine stationary phone export. Mathematical unit-test inputs are synthetic test cases and are never reported as physical observations.
