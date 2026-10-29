# AuroraSense — Asset, Dataset, API and Prior-Work Registry

> **Status:** Exhaustive **planning inventory**, not a local downloaded-data catalog.  
> **As of:** October 28, 2026. Paired with [`goal.md`](goal.md) and [`plan.md`](plan.md).  
> **Purpose:** The single reference list for all datasets, observations, models, papers, APIs, SDKs, visual material and local design assets identified across the AuroraSense planning discussion.  
> **Critical caveat:** A public webpage or DOI does **not** imply a complete downloadable time series, permission to redistribute it, or suitability for historical *as-issued* forecast evaluation.

## 0. How to use this registry

**Readiness labels:**

- **API verified:** Provider documents a public API or downloadable time series. Exact endpoint may still require a live smoke test/rate-limit check.
- **Public listing verified:** File/catalog entry exists, but **contents, metadata fields, recording dates or full license have not yet been inspected**.
- **Research access / restrictions:** Data may be accessed subject to registration, attribution, collaboration, noncommercial terms or institution-specific restrictions.
- **Published results only:** Paper/visualization exists; no raw/public dataset established.
- **Application reference:** Useful prior art or forecast baseline, but an archived issued-forecast sequence is not confirmed.
- **Our asset:** User-supplied or original hackathon project asset; check precise reproduction rights and source version before publication.

**Priority:** `P0` required for the demonstrator; `P1` if time/rights/format permit; `R` future research; `UX` references and visuals. Do not bulk-download large data or use any real participant location/photo before permissions are configured.

## 1. Local design assets — include in repository

| ID | Asset | Repository path / URL | Use and restrictions |
|---|---|---|---|
| UX-01 | **AuroraSense three-screen wireframe** (AI-generated concept, 1672 × 941 PNG) | [`assets/wireframes/aurorasense_three_screen_concept.png`](assets/wireframes/aurorasense_three_screen_concept.png) | Hero image in `goal.md`. **Every depicted number, curve and map is fictional**; do not imply scientific measurements or established forecast skill. |
| UX-02 | Three-screen design contract | [`goal.md`](goal.md) | Storm Track, Aurora Map, Ground Truth; common Live/Replay clock and contextual Why? drawer. |
| UX-03 | Demo storyboard and voiceover | [`plan.md`](plan.md), §2 | The three-minute performance is a contract: demonstrate genuine features, label replay/simulation. |
| UX-04 | Earlier detailed AuroraSense planning and voiceover (conversation artifacts) | Earlier generated Markdown documents, if retained separately | Historical planning inputs; the new three-file pack is the **source of truth** going forward. |
| UX-05 | Existing Eternal Brewing educational project / May 2024 story | https://www.eternalbrewing.com/ | Prior project context, not independently fetched in the latest site attempt. Verify exact text/media rights and author approval before reuse. |
| UX-06 | NASA Scientific Visualization Studio MAGE May 2024 simulation | https://svs.gsfc.nasa.gov/5435/ | Potential educational media/reference. Credit NASA SVS/CGS, inspect each media item's reuse/attribution terms before embedding or distributing. |
| UX-07 | NOAA OVATION current auroral oval imagery/data | https://services.swpc.noaa.gov/json/ovation_aurora_latest.json | Scientific visualization data; include issue/forecast valid time and distinguish modeled output from observations. |
| UX-08 | GFZ auroral activity forecast visual reference | https://spaceweather.gfz.de/products-data/forecasts/auroral-activity-forecast | Competitive design/model reference, not our forecast. Check map/content licensing before copying graphics. |
| UX-09 | AuroraTonight forecast consumer reference | https://aurora.umich.edu/ | Competitive UX/forecast baseline, not a free licensed design source. |

## 2. Solar event detection, CME arrival and heliospheric input

| ID | Asset / link | Historical or operational information | Status / priority / caveat |
|---|---|---|---|
| SW-01 | **NASA CCMC Earth CME Scoreboard** — https://ccmc.gsfc.nasa.gov/scoreboards/cme/earth/ | Historical CME arrival *predictions* with model, event ID, observed/forecast arrival; current REST docs at https://ccmc.gsfc.nasa.gov/tools/API/ | **API verified · P0.** Keep original issue time, method and eventual observed arrival separate. The arrival ensemble is the storm-spaghetti plot. |
| SW-02 | CME Scoreboard historical predictions API — https://ccmc.gsfc.nasa.gov/CMESB-Earth/WS/get/predictions | Filter by `CMEtimeStart`, `CMEtimeEnd`, `CMEID`, `method`, active/closed-out and no-arrival events | **API verified · P0.** Check exact JSON schema, pagination and original forecast submission timestamp; no invented probabilities. |
| SW-03 | **NASA DONKI** — https://kauai.ccmc.gsfc.nasa.gov/DONKI/ | Historical CME detections/analyses, related flares, shock/geomagnetic events, high-speed streams and ENLIL simulation references | **API documented · P0/P1.** Use NASA CCMC API index to select maintained endpoints; event catalogs are not continuous plasma time series. |
| SW-04 | **NASA OMNIWeb** — https://omniweb.gsfc.nasa.gov/ | Multi-decade near-Earth solar-wind/IMF and geomagnetic context; 1-min and 5-min records from ~1981, hourly longer historical span | **Public time series · P0.** Preserve frame, fill values, time shift, provenance and retrospective revision. |
| SW-05 | OMNI high-resolution annual/monthly files — https://cdaweb.gsfc.nasa.gov/pub/data/omni/high_res_omni/ | Downloadable minute and five-minute data; IMF vector, speed, density, temperature, pressure, coupling-related fields and indices | **API/files verified · P0.** Train/evaluate only against available-at-forecast-time inputs when claiming operational backtest. |
| SW-06 | NASA CDAWeb — https://cdaweb.gsfc.nasa.gov/ | Historical spacecraft observations; ACE, DSCOVR, THEMIS/ARTEMIS, MMS, SOHO, STEREO, GOES and others | **Public archive · P1/R.** Identify exact instrument dataset IDs and coordinate frames before analysis. |
| SW-07 | NOAA SWPC operational feed root — https://services.swpc.noaa.gov/json/ | Live operational auroral, solar-wind, K-index, solar regions and modeled time series | **API verified · P0.** Operational endpoint, **not** an automatically available archive of past issuance snapshots. |
| SW-08 | NOAA OVATION — https://services.swpc.noaa.gov/json/ovation_aurora_latest.json | Current modeled auroral power/oval grid | **API verified · P0.** Capture timestamps; use Live or explicitly archived snapshots only. |
| SW-09 | NOAA real-time solar wind magnetic/plasma feeds — https://services.swpc.noaa.gov/json/rtsw/ | Near-Earth upstream IMF, speed, density and other available real-time products | **API directory verified · P0.** Check current JSON filenames/fields; never hardcode a single retired spacecraft as the permanent source. |
| SW-10 | NOAA realtime solar-wind explanation — https://www.swpc.noaa.gov/products/real-time-solar-wind | Operational context for near-Earth monitoring and propagation | **Reference · UX/P0.** Near-L1/near-Earth lead time is not multi-day CME imaging. |
| SW-11 | NOAA OVATION product explanation — https://www.swpc.noaa.gov/products/aurora-30-minute-forecast | Forecast horizon, physical interpretation and limitations | **Reference · P0.** Distinguish modeled auroral activity from ground confirmation or visibility. |
| SW-12 | NOAA SWPC 45-day forecast and ENLIL time series — https://services.swpc.noaa.gov/json/45-day-forecast.json ; https://services.swpc.noaa.gov/json/enlil_time_series.json | Operational outlook/model signals | **API listing verified · P1.** Products serve different targets; do not substitute one for CME ensemble forecasts. |
| SW-13 | WSA–ENLIL / NASA CCMC simulations — https://ccmc.gsfc.nasa.gov/ | Heliospheric CME propagation and model run products | **Model/metadata available · P1.** Individual run grid availability and rights should be checked. |
| SW-14 | NASA/ESA solar imagery: SDO/AIA, SOHO/LASCO, STEREO coronagraphs, ESA Solar Orbiter | Eruption detection, projected CME geometry and solar morphology | **Research/archive sources · R.** Multiple upstream imagery sources were identified; exact instrument endpoints must be selected per task. Image-only CME data do not uniquely reveal eventual geoeffective Bz. |
| SW-15 | In-situ upstream platforms: ACE, DSCOVR, newer operational sources such as NOAA SOLAR-1 when in service | Magnetic field/plasma for near-Earth conditioning | **Operational/research · P0/R.** Source identity and uptime change; use product level, not a hardcoded spacecraft label. |
| SW-16 | ESA Cluster archive HAPI — https://csatools.esac.esa.int/HapiServer/hapi | In-situ magnetospheric plasma/magnetic observations | **Data service · R.** Physics research; not a 24-hour solar-eruption warning instrument. |
| SW-17 | THEMIS/ARTEMIS mission archive — https://themis.ssl.berkeley.edu/data_retrieval.shtml | In-situ plasma/field, lunar-orbit ARTEMIS and THEMIS ground data | **Mission archive · R/P1.** Valuable for Nykyri's 2024 case; use exact frames and timing. |
| SW-18 | MMS science archive (via CDAWeb / official mission services) | Magnetopause and reconnection-scale plasma/field observations | **Scientific archive · R.** Direct process studies, not the same as surface magnetometer readings. |
| SW-19 | GOES magnetometer and space-weather instruments — https://www.ncei.noaa.gov/products/goes-r-magnetometer | Geosynchronous magnetospheric magnetic field, energetic particles and X-rays via respective products | **Archive · P1/R.** Useful independent state and flare context. |
| SW-20 | NOAA/NCEI space-weather archives — https://www.ncei.noaa.gov/products/space-weather | Historical products and issued forecast bulletins, availability varies | **Catalog · R.** Individual forecast vintage completeness must be established. |

## 3. Geomagnetic activity indices, professional ground stations and ionosphere

| ID | Source / link | Measurements and cadence | Status / use |
|---|---|---|---|
| GR-01 | **USGS geomagnetism web service** — https://www.usgs.gov/tools/web-service-geomagnetism-data | Observatory X/Y/Z/F, H/D, variation, adjusted, definitive; supported 1 sec, 1 min, hourly | **API verified · P0.** Reference for Colorado phone dataset; select station `BOU`, appropriate data status and UTC windows. |
| GR-02 | USGS BOU historical example — https://geomag.usgs.gov/ws/data/?id=BOU&starttime=2024-05-10T00:00:00Z&endtime=2024-05-13T00:00:00Z&sampling_period=60&format=json | 1-min Boulder historical window across the May 2024 storm | **P0.** Smoke test data retrieval and USGS sample limits; plot real station measurement with attribution. |
| GR-03 | **FMI IMAGE network** — https://space.fmi.fi/image/www/?page=user_defined ; https://space.fmi.fi/image/www/wget_instructions.php | Historical 10-sec and 1-min station components; Fennoscandian auroral-electrojet activity | **Downloads documented · P0/P1.** Per-institute station licensing may differ; use selected research windows. |
| GR-04 | IMAGE scripted download — https://space.fmi.fi/image/www/data_download.php | Query `starttime`, `length`, `format`, `sample_rate`, `stations` | **API documented · P0/P1.** Validate output format and licensing, avoid excessive requests. |
| GR-05 | **INTERMAGNET HAPI** — https://imag-data.bgs.ac.uk/GIN_V1/hapi ; https://intermagnet.org/data_download.html | International observatory vector fields, many stations 1 min and some 1 sec | **Data API · P1.** Usually noncommercial attribution restrictions; use appropriately selected data and respect institute terms. |
| GR-06 | **SuperMAG** — https://supermag.jhuapl.edu/ | Multi-station ground fields and SML/SMU/electrojet measures | **Research access · R/P1.** Registration and collaboration/acknowledgment conditions; do not assume raw bulk redistribution rights. |
| GR-07 | **CARISMA** — https://carisma.ca/carisma-data-repository | Canadian magnetometer arrays including 1-Hz/historical datasets | **Research access / registration · R.** Useful out-of-region validation. |
| GR-08 | GFZ Kp and ap — https://kp.gfz.de/en/data | Kp/ap historical indices; Kp since 1932 | **Public archive · P0/P1.** Three-hour planetary values are baselines, not direct local auroral visibility labels. |
| GR-09 | GFZ Hp30/Hp60 — https://kp.gfz.de/en/data | Higher-time-resolution planetary geomagnetic activity | **Downloadable · P1.** Check actual historical start, coverage and license for requested product. |
| GR-10 | GFZ PAGER forecast statistics — https://spaceweather.gfz.de/products-data/forecasts | Forecast Kp/Hp and uncertainty, lead up to ~72 h for suitable products | **Operational forecast · P1.** Historical as-issued archives not established by current UI alone. |
| GR-11 | Kyoto Dst/SYM-H, AE/AL/AU indices — https://wdc.kugi.kyoto-u.ac.jp/ | Storm ring-current and auroral-electrojet related indices | **Historical scientific data · P1/R.** Final product publication/latency differs from real-time estimates. |
| GR-12 | Polar Cap index (PC) and geomagnetic indices | High-latitude coupling/context | **Research · R.** Provider/product to be selected; preserve coordinate/time basis. |
| GR-13 | GNSS ionospheric TEC (including processed Google-phone maps) — https://doi.org/10.1038/s41586-024-08072-x | Ionospheric response, not direct magnetometer or optical auroral signal | **Published research and processed products · R.** No general raw personal-phone dataset; distinct observable. |
| GR-14 | **HamSCI Personal Space Weather Station** — https://hamsci.org/ | Dedicated citizen-science magnetic sensors and space-weather observations | **Hardware/project reference · R.** More sensitive instruments can complement phones, but not smartphones. |
| GR-15 | World Magnetic Model (WMM) / IGRF references — https://www.ncei.noaa.gov/products/world-magnetic-model ; https://www.ngdc.noaa.gov/IAGA/vmod/igrf.html | Expected background field, geomagnetic coordinates/magnetic variation context | **Models · P1.** Subtract baseline only when measurement frame/location/time are valid. |

## 4. Smartphone magnetometer evidence and sensor-noise datasets — essential scientific gate

| ID | Source / link | Availability and purpose | Decision/rights gate |
|---|---|---|---|
| PH-01 | **Broomfield citizen phone measurements 2023–2025** — https://zenodo.org/records/18928938 | **30.8 MB ZIP public listing**, reportedly timestamped magnetometer readings and locations in the Boulder area | **Public listing verified, ZIP NOT YET INSPECTED · P0 feasibility gate.** Check exact dates, sampling, devices, independence, metadata, storm overlap, and license (Zenodo page does not clearly expose a reuse license). Never claim May 2024 phone storm detection until verified. |
| PH-02 | **Odenwald et al., Can Smartphones Detect Geomagnetic Storms?** — https://doi.org/10.1029/2020SW002669 | Controlled phone sensor tests; phone noise combined with historical professional-station storm signals | **Paper verified · P1.** Historical phone storm reconstructions are **simulated**, not contemporaneous recordings. |
| PH-03 | Odenwald NASA workbook — https://spacemath.gsfc.nasa.gov/data/MagStormPaper.xlsx | Approximately 20 MB workbook cited by study | **Download attempted previously, not confirmed · P1.** Verify URL and file contents; preserve original provenance. |
| PH-04 | **CIRES CrowdMag** — https://geomag.colorado.edu/crowdmag | World-wide phone magnetometer contributions; public rolling ~24-h, ~1-km-grid aggregate map | **Raw time-series DB non-public · R.** Research-data agreement required, map does not give individual second/minute historical traces. |
| PH-05 | CrowdMag data/privacy policy — https://geomag.colorado.edu/crowdmag-privacy-policy | Specifies transmitted field, time, location, accuracy and device model | **Policy verified · R.** Own user's app may export CSV/backups; not a public raw archive. |
| PH-06 | CIRES/NOAA Alaska/Boulder stationarity study — https://ciresevents.colorado.edu/boulderreu/37_Jannetta_Robinson.pdf | Preliminary phone vs professional observatory comparison in Boulder and Fairbanks | **Published presentation · P1/R.** Raw files not independently located; request authors' data if useful. |
| PH-07 | CIRES Deadhorse Alaska 2022 phone recordings | Publicly described preliminary phone/observatory comparison | **Results only; exact raw-record URL unverified · R.** Contact CIRES team for data. |
| PH-08 | **Tampere/U. Gustave Eiffel multi-sensor Android dataset** — https://zenodo.org/records/12566912 | 5.6 GB raw GNSS, accelerometer, gyro, magnetometer across indoor/outdoor environments | **Public CC BY 4.0 · P1/R.** Useful interference/motion QC, **not a storm-detection dataset**. |
| PH-09 | Tampere Android multi-sensor smaller dataset — https://zenodo.org/records/8340005 | 670.5 MB sensor/GNSS archive, Android Mimir | **Public CC BY 4.0 · R.** More tractable than 5.6 GB for IMU/sensor prototyping. |
| PH-10 | **TrainTrack magnetic/IMU dataset (2026)** — https://zenodo.org/records/22206115 ; https://github.com/mlsec-group/magtrack | ~164.5 GB, train magnetometer + inertial data; ~487.5 h train and ~78 h nontrain recordings | **Public listing verified · R.** Good adversarial examples of infrastructure interference; not a storm dataset and too large for hackathon. |
| PH-11 | **Our opt-in actual physical-phone sessions** — collected by AuroraSense Expo client | Raw x/y/z, magnitude, timestamp, sampling, device sensor, motion, baseline, quality and consent metadata | **Original to collect · P0.** At least one real device; no hidden background sampling or raw location disclosure. |
| PH-12 | **Synthetic network based on empirical phone noise** — generated by `science/` | Known professional storm truth plus measured device noise, drift, contamination, site geometry | **New derived simulation · P0/P1.** Explicit simulation label and random seed; not evidence of actual spatially distributed phone recording. |
| PH-13 | Google Research phone GNSS ionosphere science — https://doi.org/10.1038/s41586-024-08072-x | Processed ~millions-of-phones ionospheric TEC work | **Published comparator · R.** Proof-of-concept for massive noisy sensor fusion, **not public individual phone magnetic data**. |

## 5. Optical aurora observations, photos and precipitation

| ID | Source / link | Coverage / fields | Status / rights / applicability |
|---|---|---|---|
| AU-01 | **THEMIS all-sky aurora classification labels** — https://doi.org/10.5061/dryad.sbcc2frft | ~700 million labeled observations 2008–2022; arc/diffuse/discrete/cloudy/moon/clear; station+UTC | **Public ~23.41 GB package · P1/R.** Image labels are model-generated and need QC, don't call unobserved days negative. Not the May 2024 event. |
| AU-02 | THEMIS all-sky camera observations / mission data — https://themis.ssl.berkeley.edu/ | Original optical images, station/time and related ground observations | **Research archive · P1/R.** Frame/season availability and publication rights need review. |
| AU-03 | **Aurorasaurus 2014–2025 open observations** — https://zenodo.org/records/16783265 | Two CSV files (~16.8 MB total) with aurora yes/no/uncertain, time, location, sky/appearance, geomagnetic coordinates and reporting metadata | **Open download verified · P1.** Specific reuse license unclear on page; time of observation differs from submission; self-selection bias. Actual private photos not in public release. |
| AU-04 | Aurorasaurus data analysis notebooks — https://github.com/aurorasaurus/Aurorasaurus_on_Jupyter | Research analysis/examples for reports | **Public repository · R.** Inspect code license; not a replacement for scientific validation. |
| AU-05 | **FMI MIRACLE all-sky cameras** — https://space.fmi.fi/MIRACLE/ASC/?page=home | Northern Europe night optical station recordings and keograms, 1990s onward; station-specific cadence | **Partial public products / research access · R.** Strong pairing with IMAGE, rights/access must be checked. |
| AU-06 | FMI Auroras Now! — https://en.ilmatieteenlaitos.fi/wmo-spaceweatherportal | Real-time optical/ground nowcasting, including dX/dt thresholds | **Existing product · benchmark/reference.** Precedent for regional ground aurora alert, not raw phone dataset. |
| AU-07 | **GOLD dayside aurora 2018–2025** — https://doi.org/10.7294/30179767.v2 ; https://doi.org/10.1038/s41597-026-06884-2 | >47,000 northern dayside FUV scans, masks, background dayglow estimates and coordinates | **Public CC0 · R/P1.** Daytime UV aurora, **not human nighttime visibility**. Code: https://github.com/jah-26603/dayside_aurora_gold. |
| AU-08 | **DMSP SSUSI** — https://cdaweb.gsfc.nasa.gov/pub/data/dmsp/ | Satellite far-UV auroral morphology and intensity products | **Public archive · R.** Match orbit/time/geolocation, consider illumination/quality. |
| AU-09 | **DMSP SSJ particle precipitation AWS open data** — https://registry.opendata.aws/dmspssj/ | Precipitating electron/ion spectra and particle energy flux | **Open dataset · R.** Physical aurora proxy, not direct visible sky. |
| AU-10 | **ML-EPM paper/model** — https://doi.org/10.1029/2025SW004829 | Learned electron precipitation spectra using DMSP and upstream history | **Published model · R.** Code/data research package cited in article; exact file availability requires inspection. |
| AU-11 | **User-submitted AuroraSense photo/negative report** | Real capture UTC, approved geolocation, viewing azimuth/elevation, conditions, naked-eye vs camera, EXIF details, image | **To create · P1.** Scientific upload and public-display rights are separate; remove public EXIF, verify duplicates/fakes. |
| AU-12 | Optical negative observations | Clear-sky, observed-with-no-aurora at a defined time/site | **Derived labels · R.** Lack of a submission is **not** a negative, and cloudy-night “none seen” is not clear physical absence. |
| AU-13 | User-submitted camera aurora photos, optional Muse Spark visual analysis | Candidate classification, morphology, contamination/clouds | **P1/bonus.** Need validation; do not make generative classification authoritative ground truth. |

## 6. Viewing conditions and geospatial context

| ID | Asset | Source | Use/status |
|---|---|---|---|
| VX-01 | Historical/reanalysis cloud cover | https://cds.climate.copernicus.eu/ | ERA5 hourly total cloud fraction and related fields; **research access/licensing review · P1**. |
| VX-02 | Live local weather/cloud forecast | NOAA/other licensed weather API selected at build time | **P1.** A live cloud layer is separate from space-weather model confidence. |
| VX-03 | Solar position/twilight and moon ephemerides | Astronomy calculation packages with verified license | **P0 simple calculations.** Nighttime mask must use time zone and coordinates correctly. |
| VX-04 | Light pollution / sky background | Licensed public light-pollution map or satellite nightlight product | **Bonus.** Do not scrape commercial map imagery. |
| VX-05 | Geomagnetic coordinates, magnetic local time, dipole tilt | Verified scientific coordinate/conversion libraries; IGRF/WMM | **P1/R.** Store both geographic and geomagnetic coordinates plus model epoch. |
| VX-06 | Basemap / geographic cells | MapLibre, appropriate OpenStreetMap-derived tiles and spatial aggregation (H3 optionally) | **P0 map, P1 cells.** Honor tile/data attribution and service rate limits. |

## 7. Forecast/ML projects to benchmark, not reinvent or silently copy

| ID | Project / link | Predictive target / accessible asset | Availability and caution |
|---|---|---|---|
| ML-01 | **NOAA OVATION** — https://www.swpc.noaa.gov/products/aurora-30-minute-forecast | Auroral activity/power model (not observed human visibility) | **Operational baseline · P0.** Current JSON does not prove complete historical issued forecasts. |
| ML-02 | **NASA DAGGER** — https://github.com/Vishal-Upendran/geoeffectivenet-1 | AI ~30-min ground magnetic perturbation model, training scripts | **Code and publication · R.** Check checkpoint/input versions, code license and evaluation regions. |
| ML-03 | **University of Michigan GeoDGP** — https://github.com/HongfanChen/GeoDGP | ~1-h probabilistic ground magnetic disturbance forecasts; research code | **PolyForm Noncommercial · R.** Academic code not automatically reusable commercially. Data link https://doi.org/10.7302/6brp-0y03. |
| ML-04 | **Michigan AuroraTonight** — https://aurora.umich.edu/ | Public aurora visibility nowcasting informed by model outputs | **Operational comparator · UX/R.** Historic as-issued forecasts/complete API not verified. |
| ML-05 | **GFZ PAGER** — https://spaceweather.gfz.de/products-data/forecasts | Kp/Hp forecast ensemble | **Operational · R.** Complete historical issuance archive not established. |
| ML-06 | **GFZ Kp-driven UV oval ML** — https://spaceweather.gfz.de/products-data/forecasts/auroral-activity-forecast | Auroral oval/intensity from modeled Kp | **Operational · R.** Does not directly predict naked-eye visibility. Ref https://doi.org/10.1029/2024JH000543. |
| ML-07 | **NASA/IBM Surya** — https://science.nasa.gov/science-research/artificial-intelligence-model-heliophysics/ | Solar-image foundation model / flare-related tasks | **Model/research · R.** Not an end-to-end aurora predictor; large training resources. |
| ML-08 | **Google/Aerospace AI geomagnetic project** | AI-based geomagnetic storm warning research | **Public announcement · R.** No verified public deployable aurora predictor/checkpoint identified. |
| ML-09 | **Google DeepMind WeatherNext** | Atmospheric weather/cloud forecasting | **Indirect visibility comparator · R.** Not a solar-wind/reconnection model. |
| ML-10 | **Microsoft Aurora foundation model** | Atmospheric weather/Earth system | **Indirect only · R.** Name does not mean aurora borealis prediction. |
| ML-11 | **NASA ML-EPM** — https://doi.org/10.1029/2025SW004829 | Electron precipitation spectrum | **Published model · R.** Valuable future physically explicit auroral-energy target. |
| ML-12 | **Newell coupling and classical IMF/solar-wind physics proxies** | Derived reference predictors: southward Bz, convective E, Newell, Kan–Lee, epsilon | **Physics baselines · P0.** Evaluate against actual held-out ground/optical outcomes. |
| ML-13 | **LAUREN electrojet forecasting** — https://csem.engin.umich.edu/SWORD/lauren/ | AU/AL prediction | **In development at earlier review · R.** Not a public auroral photos dataset. |
| ML-14 | **Google phone-based global TEC (Nature 2024)** — https://doi.org/10.1038/s41586-024-08072-x | Large-scale ionosphere reconstruction | **Precedent · R.** Distinct GNSS observable; processed research dataset DOI https://doi.org/10.24433/CO.9149928.v1. |
| ML-15 | **FMI Auroras Now!** — https://en.ilmatieteenlaitos.fi/wmo-spaceweatherportal | Ground dX/dt-based local auroral alert, camera context | **Important benchmark · P1.** Local trigger is not direct proof of visible aurora. |

## 8. Scientific papers, educational assets and foundational context

| ID | Reference | Why retained |
|---|---|---|
| SCI-01 | **Nykyri (2024), Giant KH waves at CME boundaries** — https://doi.org/10.1029/2024GL110477 | Key motivating 2024 study: IMF Bz about −60 to +40 nT, 60–270 Earth-radius-scale KH structures, varying plasma and magnetic forcing. Does **not** alone tie each KH wave to an individual ground aurora. |
| SCI-02 | **Nykyri (2026), MMS energetic particles in CME KH waves** — https://doi.org/10.1029/2026GL124403 | Follow-on process study, potentially relevant physical interpretation; research use, not a direct optical label. |
| SCI-03 | **NASA SVS 5435, May 2024 MAGE simulation** — https://svs.gsfc.nasa.gov/5435/ | Scientifically credited educational video of simulated magnetospheric response. License/credits before reuse. |
| SCI-04 | **Odenwald et al. (2022), phone storm detectability** — https://doi.org/10.1029/2020SW002669 | Key phone sensitivity/noise and simulated historical test precedent. |
| SCI-05 | **GeoDGP (2025)** — https://doi.org/10.1029/2024SW004301 | High-quality quantitative benchmark and use of uncertainty. |
| SCI-06 | **GOLD dayside auroral dataset (2026)** — https://doi.org/10.1038/s41597-026-06884-2 | Optical UV target and data/code. |
| SCI-07 | **ML-EPM (2026)** — https://doi.org/10.1029/2025SW004829 | Magnetosphere/ionosphere electron precipitation modeling. |
| SCI-08 | **Google smartphone TEC (2024)** — https://doi.org/10.1038/s41586-024-08072-x | Scientifically relevant prior art for noisy crowd sensor networks. |
| SCI-09 | **Aurorasaurus 2026 release/report** — https://zenodo.org/records/16783265 | Human positive/negative report provenance, biases, date distinctions. |
| SCI-10 | **Eternal Brewing May 2024 educational work** — https://www.eternalbrewing.com/ | Pre-existing educational framing; live HTML/export not independently accessed during this review. |
| SCI-11 | NOAA aurora science primer — https://www.swpc.noaa.gov/phenomena/aurora | General education: coupling, emissions and viewing caveats. |
| SCI-12 | NASA heliophysics/aurora references — https://science.nasa.gov/heliophysics/ | Scientific review material for five-stage Why panel. |

## 9. Engineering, Meta and SaaS tooling assets

| ID | Technology / docs | Role | Priority / restrictions |
|---|---|---|---|
| DEV-01 | **Meta Muse Spark 1.3** — https://dev.meta.ai/models/muse-spark | Primary agentic model, reasoning/tool calls and evidence explanations | **P0**, Standard privacy mode. Must not be the numerical geophysical engine. |
| DEV-02 | **Meta Model API Responses** — https://dev.meta.ai/docs/api-reference/responses/create-response | Long-form/structured agent tool-call loop, continuation and streaming | **P0.** Persist workflow state in Supabase, not solely in response IDs. |
| DEV-03 | **Meta tool-calling cookbook** — https://dev.meta.ai/docs/cookbook/tool-function-calling | Tool schemas, invocation loop and return messages | **P0.** Cap tool depth, validate every argument/result. |
| DEV-04 | **Muse Wonder** — https://dev.meta.ai/docs/models | Optional independent scientific interpretation/red-team comparison | **Bonus**; no authority to modify evidence/results. |
| DEV-05 | **Muse Image** — https://dev.meta.ai/docs/overview | Educational conceptual illustration generation | **Bonus**; must be labeled artwork, never measurements. |
| DEV-06 | **SAM 3.1** — https://dev.meta.ai/docs/models | Experimental optical segmentation | **Experimental bonus** only if benchmark on auroral images succeeds. |
| DEV-07 | **Muse Code** — https://dev.meta.ai/docs/muse-code | Optional coding assistant | **Development only**; runtime credit spend decision separate. |
| DEV-08 | **Muse Glimmer / Muse Spark Open** — https://dev.meta.ai/docs/models | Alternative open-weight inference experiments | **Future/bonus**; operating own inference infrastructure conflicts with no-IaaS goal unless hosted eligible SaaS; check model use terms. |
| DEV-09 | Meta pricing / rate limits — https://dev.meta.ai/docs/pricing-rate-limits | $150 operational grant cost monitoring | **P0.** Set application-level hard request/token ceilings; billing alert isn't hard stop. |
| DEV-10 | Meta API terms — https://dev.meta.ai/legal/terms-of-service | Age/use, participant privacy and research constraints | **P0.** Current terms require integrated-product end users 18+; adult opt-in hackathon demo. |
| DEV-11 | **Vercel + Next.js** — https://vercel.com/docs | Three-screen dashboard + controlled API facade | **P0.** No user-provisioned VM/container; deploy using managed functions. |
| DEV-12 | **Supabase** — https://supabase.com/docs | Managed PostgreSQL/Auth/Storage/RLS/Edge Functions | **P0.** Raw time series stored as private compressed objects, summaries in tables. |
| DEV-13 | **Supabase Cron** — https://supabase.com/docs/guides/functions/schedule-functions | Regular upstream data polling, deduplication and agent job wake-ups | **P0.** Avoid heavy training in Edge Functions. |
| DEV-14 | **Expo React Native magnetometer** — https://docs.expo.dev/versions/latest/sdk/magnetometer/ | Native Android/iOS foreground x/y/z collection | **P0 one real platform; P1 both**. Calibrated/uncalibrated availability must be checked per device/platform. |
| DEV-15 | **Expo EAS Build** — https://docs.expo.dev/build/introduction/ | Managed iOS/Android build service | **P1.** Actual physical device validation required. |
| DEV-16 | **GitHub Actions hosted runners** — https://docs.github.com/en/actions | Reproducible Python training, dataset checks, tests and model artifacts | **P0.** Hosted managed execution; no user-managed server. Check build-minute and artifact size quotas. |
| DEV-17 | MapLibre GL JS — https://maplibre.org/projects/maplibre-gl-js/ | Browser map rendering and overlays | **P0.** Select licensed tile provider and observe attributions. |
| DEV-18 | Python scientific stack (NumPy/Pandas/SciPy/scikit-learn; optional XGBoost) | QC, coherence, statistics, compact learned models | **P0.** Lock dependencies and random seeds; keep numerical model separate from language model. |
| DEV-19 | Arrow/Parquet/CSV/gzip scientific interchange | Timestamped sensor chunks and reproducible analytics | **P0.** Avoid 1 row per high-frequency sample in Postgres. |
| DEV-20 | Supabase RLS and Auth | Volunteer consent, private data and ownership | **P0.** Never expose service-role credential or exact volunteer home GPS. |

## 10. Priority acquisition and rights-validation queue

**Immediate P0 fetch/test order:**

1. CCMC `SW-01/02`: obtain *historical* independent CME arrival submissions around May 2024; prove issue-time fields and ensemble members.
2. NOAA `SW-07/08/09`: obtain a current OVATION frame and current RTSW products; verify actual JSON schema, timestamps, rate limits and no-data behavior.
3. USGS `GR-01/02`: fetch true BOU 1-min May 2024 window, identify X/Y/Z/F fields and data quality.
4. Broomfield `PH-01`: download listed ZIP, validate checksum `3bf46fe2e8893a671eabdc47ee08c1cd`, inspect contained files for real overlap; **gate before any real phone-storm claim**.
5. OMNI `SW-04/05`: select fixed storm + quiet control windows with fill-value checks, train baseline/model.
6. One actual phone `PH-11`: stationary sensor sample + interference perturbation, empirical noise characterization.
7. IMAGE `GR-03/04` optional second professional region; preserve station-specific licensing.
8. Aurorasaurus `AU-03` and selected optical material `AU-01/07` if working on sighting model, not essential to first magnetic feasibility result.

**Rights gate per asset:** store `source_id`, URL/DOI, author/provider, stated license (exact evidence), obtained_at, date range, checksum, restrictions, required credit, sample consent and whether raw bytes may be committed to a public GitHub repository. Default to committing only original code, lightweight rights-cleared fixtures and acquisition scripts.

## 11. Canonical data fields and time semantics

All scientific records should carry the following whenever applicable:

```yaml
source_id: NASA_OMNI | NOAA_OVATION | USGS_BOU | AURORASENSE_PHONE | ...
source_url: https://...           # original citation or retrieval endpoint
source_version: ...              # product version/model/version or file hash
record_kind: observation | forecast | retrospective_reconstruction | synthetic
observed_at_utc: ...             # physical phenomenon or sensor sample
issued_at_utc: ...               # forecast issuance, when relevant
valid_at_utc: ...                # modeled forecast's target time
available_at_utc: ...            # operationally accessible timestamp
retrieved_at_utc: ...            # ingestion timestamp
latitude: null                   # secured precision, when volunteered
longitude: null
location_uncertainty_m: null
geomagnetic_latitude: null
magnetic_local_time_h: null
field_frame: DEVICE | GEO | GSE | GSM | ...
value: ...
unit: nT | microT | km/s | cm^-3 | ...
quality: valid | suspect | rejected | missing
quality_reason: ...
license_id: ...
privacy_scope: private | research_aggregate | public
provenance_checksum: ...
```

**Unit and time rules:** `1 µT = 1000 nT`; phone x/y/z are device-frame, not north/east/down unless transformed; instrument scalar magnitude is not immune to calibration error; UTC and `available_at_utc` must govern replay and forecasting. Corrected after-the-event values may appear on a retrospective science plot, not as if they had been available to a historical alert.

## 12. Negative findings and blockers — preserve them explicitly

- **CrowdMag:** a public rolling map exists, but a public downloadable **raw historical global phone time-series API is not established**. Request research access; do not scrape or imply data availability.
- **Broomfield:** publicly listed ZIP and size verified, but file contents/storm overlap are **not yet inspected**; no validated scientific outcome.
- **Odenwald historical phone storm reconstructions:** derived simulations with measured phone noise, not contemporaneous phone storms.
- **THEMIS classified dataset:** ends 2022; cannot serve as May 2024 aurora labels.
- **Aurorasaurus:** public CSV does not automatically include original images; human reporting bias and late submissions are material.
- **NOAA OVATION/GFZ operational products:** live snapshots do not automatically provide complete historical issued-forecast vintages.
- **Phones:** high variance, motion, magnetic accessories and calibration jumps can overwhelm weak regional nT signals; effective independent sites matter more than naive N.
- **Long-horizon CME Bz:** not reliably predicted solely from coronagraph imagery; avoid false precision for 24–72 h aurora severity.
- **Meta:** a model-generated narrative is not a validated scientific prediction; strict tool-result grounding is required. **No speech-transcription feature is part of this project scope.**

## 13. Implementation verification addendum — October 28, 2026

The original inventory above records planning-time status. Executed acquisition results now supersede the corresponding unverified status, without expanding product scope:

- **SW-01/02:** real CCMC `submissionTime` inspected. Ten original submissions from seven methods for `2024-05-08T12:24:00-CME-001` retained; January 2025 Average/Median entries excluded from 2024 as-issued replay. Submission time is an availability proxy; independent page-vintage publication logs remain unverified.
- **SW-08/09:** NOAA schemas fetched and hashed. Working RTSW paths are `/json/rtsw/rtsw_mag_1m.json` and `/json/rtsw/rtsw_wind_1m.json`; parser follows provider `active` and `overall_quality`, not a fixed spacecraft. OVATION retains observation/forecast times and actual provider cells. Current snapshots are never 2024 issuance.
- **GR-01/02:** May 10–13, 2024 USGS BOU minute records fetched. Adjusted X/F plotted; Z is missing in all 4,321 source rows and remains missing. Original operational availability is unknown.
- **PH-01:** official ZIP MD5 matched; Zenodo API metadata explicitly states CC BY 4.0. 1,289 CSVs inspected, one invalid-encoding file excluded. Parseable timestamps cover April 2, 2024–September 18, 2025; no parsed 2023 records. May 10–13 overlap exists, but missing device/calibration/stationarity information means **NO-GO for validated historical phone storm evidence**. Raw location-bearing files stay in ignored local storage. Sanitized inspection and exploratory comparisons are in `demo/fixtures/broomfield-inspection.json`.
- **SW-04/05:** actual `OMNI_HRO_5MIN` via NASA CDAWeb HAPI plus independent BOU X records support the executed, event-blocked retrospective 30-minute experiment. Original availability remains null; no operational forecast claim. Exact requests, hashes, time/frame semantics and conditional coverage are recorded in the scientific results.
- **VX-03:** approximate solar elevation is implemented from [NOAA fractional-year equations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF), with explicit geometric/accuracy limitations. No external map tiles or imagery were added.
- **DEV-01/02/03:** current official Responses schema and Standard-mode model ID verified; transport implemented and mock-tested, **no credentialed inference run**.

Read [`docs/provenance-rights.md`](docs/provenance-rights.md), [`docs/evaluation-results.md`](docs/evaluation-results.md) and the per-source manifests for measured facts. **PH-11 update:** the owner supplied a partial physical iPhone export: 3,042 samples over 304.844 seconds, canonical QC exactly reproduced, controlled perturbation flagged, APP_BACKGROUNDED stop recorded. Raw files stay private; the aggregate report is [`docs/phone-experiment-2026-10-28.md`](docs/phone-experiment-2026-10-28.md). Baseline transients prevent calling its MAD a calibrated noise floor; a clean stationary repeat and Android validation remain open. **PH-12 empirical-noise simulation remains unperformed.** Schema validation uses Zod; tests use Vitest/ESLint/TypeScript with locked package versions. Those software dependencies retain their package licenses; see `THIRD_PARTY_NOTICES.md`.

**Later PH-11 stationary attempt:** a second iPhone export completed 600.032 seconds with 5,987 samples at 9.97614 Hz and automatic stop. QC and interaction annotations exactly reproduced. There were no later recorded touches or detected motion; the fixed baseline MAD was 801.466 nT, failing the unchanged 250 nT stability rule. All samples remain unusable under that rule. A full acquisition is now evidenced, while an accepted quiet-noise profile, Android and guided-cue verification remain open. Raw values and detailed outputs remain private. No simulation or regional claim was created from the unstable run.

**PH-13 — owner-provided EZIE-Mag reference candidate:** identified by the owner; no data from the unit received yet. Official [2026 manual](https://eziemag.jhuapl.edu/documentation/26-01497_EZIE-Mag-Manual-2026-Update_v11.pdf) and [explanation guide](https://eziemag.jhuapl.edu/documentation/26-10363_EZIE-Mag-Explanation_v03_FINAL.pdf) inspected; local archived downloads, UTC/nT displays and temperature diagnostics documented. [Mesquita et al. (2025)](https://doi.org/10.3389/fspas.2025.1601396) supports its use as a ground-field instrument while noting thermal/environmental effects. Particular-unit calibration, timestamps, settings and export schema remain unverified. Rights: cite/link official documents; cached PDFs stay ignored, with no assumed redistribution license. Owner-provided measurements remain private, including embedded GPS/operator/station metadata. This candidate does not automatically satisfy the regional validator's professional-reference or independent-site gates.
