# Local aurora evidence and AI accuracy review — 2026-11-04

The submission now provides a source-grounded, qualitative local viewing assessment. It does **not** provide a validated numerical probability of seeing aurora, and no measured forecast-accuracy percentage can currently be reported. The most concrete reliability defect was reproduced against real NOAA data and fixed: duplicate active upstream rows caused the old parser to discard both complete IMF and plasma feeds.

## What changed and why

- `packages/coordinator/src/aurora-evidence.ts` is a shared, versioned deterministic evidence evaluator for web and mobile. Its input is actual parsed source records, geographic coordinates and UTC analysis time. Legacy hard-coded storm levels, phone amplitudes, asserted darkness and coherence booleans cannot manufacture an alert.
- Local NOAA OVATION cells are selected by geographic distance with longitude wrapping. Nearby activity is reported separately. A far-away bright oval cannot become a high local probability. No invented geomagnetic-latitude conversion is used.
- Astronomical solar elevation is calculated for both analysis time and the NOAA model valid time. Current darkness cannot falsely imply darkness an hour later at the forecast time. Clouds remain unknown unless a timestamped value is explicitly supplied; no weather-provider connection is claimed.
- Current IMF Bz, plasma speed/density, sampled negative-Bz intervals and estimated planetary Kp are separate context. Magnetic reference F, location separation and timestamp are contextual evidence, never a proxy for visible aurora or proof of phone coherence.
- Missing, stale, future, invalid and geographically distant sources are surfaced. An invalid optional source is excluded without hiding other valid sources. Replay cannot relabel today's feed as a May 2024 forecast.
- `apps/web/lib/noaa-acquisition.ts` isolates acquisition/validation failures by feed, caps raw streamed bytes before JSON parsing, keeps original retrieval times in a two-minute bounded cache and deduplicates concurrent requests. It retains valid IMF when plasma fails and vice versa. Current and legacy estimated-Kp schemas are supported; zero remains a valid observation.
- Exact same-source, same-measurement NOAA duplicates collapse deterministically. Conflicting same-time values or competing active providers become gaps for that feed and minute; genuine neighboring measurements survive. Counts are included in solar-wind quality metadata. Unknown historical operational availability is not invented.
- `meta-suite.ts` no longer attributes an actual model call to its deterministic narrative, labels a single phone a supported regional candidate, treats MAD as stationarity proof, assumes a universal 60–100 nT phone noise limit, imputes an unmeasured rate, or declares Pc5 frequency from a short trace. Invalid numeric summaries are rejected. A spectral peak is only described when supplied, below Nyquist and represented by at least three cycles; no source attribution follows.
- The conceptual SAM helper returns no masks and no confirmed emission. RGB color is not a spectrometer. The mobile oval is explicitly illustrative, separate from the sourced regional panel; invented magnetic latitude and an incorrectly placed reference marker were removed.

## Real public-feed check

At **2026-11-04 12:06:28 UTC**, the first full loader check obtained all four NOAA responses but rejected both RTSW feeds. Inspection found duplicated active SOLAR1 records at earlier timestamps. A repeated request after the fix at **12:08:25 UTC** succeeded without acquisition or schema errors:

| Product | Actual provider time/value from this check | Result |
| --- | --- | --- |
| OVATION | Observation 12:02 UTC; valid 13:05 UTC | 16,380 retained two-degree grid cells |
| IMF Bz, GSM | 12:05 UTC; −0.97 nT | Genuine current measurement |
| Solar-wind plasma | 12:04 UTC; 408.1 km/s, 1.93 cm⁻³ | Genuine current measurements; separate time from IMF |
| Estimated planetary Kp | 09:00 UTC; 2.33 | Three-hour planetary context |
| Provider duplicates | 3 exact duplicates collapsed; 0 ambiguous minutes | Both current feeds retained |

Raw source SHA-256 values and retrieval timestamps are in `docs/noaa-live-verification-2026-11-04.json`. These records document one successful acquisition, not continuous uptime, a forecast-validation dataset or a public deployment. The initial sandbox network failure was resolved by a reviewed public read-only network request. No phone raw data, precise participant location or Meta credentials were transmitted in these checks.

The existing `D:/coding/solar_storm/index.html` was inspected read-only. Its NOAA acquisition/display patterns informed this repair. Its fabricated missing-value defaults (400 km/s, density 5, Bz 0, Kp 2) were not copied. The two-hour endpoints referenced there returned 404 through the browser reader during this audit; the verified current RTSW JSON endpoints remain in use. No observatory ground feed was found in that file; the separate USGS integration supplies actual ground F.

## Frozen engineering rules and scientific limits

Algorithm identifier: `aurora-evidence-1.0.0`. These are transparent engineering screens, **not thresholds fitted to confirmed sightings**:

| Rule | Current choice | Limitation |
| --- | --- | --- |
| OVATION input age | At most 120 minutes | Does not validate an issuing system's uptime |
| Forecast time | Not before source observation; at most 120 minutes ahead of it; at most 15 minutes expired | No multi-hour extrapolation; respects the source's exact valid time |
| Nearest cell / neighborhood | At most 250 km / maximum within 500 km | Coarse geographic context, not full line-of-sight radiative geometry |
| IMF, plasma and ground freshness | 15 minutes | Different latencies remain visible |
| Kp freshness | 240 minutes | Kp represents a three-hour planetary product, not a local minute-scale observation |
| Optional cloud freshness | 90 minutes | Provider identity is unverified; current cloud cover may change before forecast validity |
| Darkness | Solar elevation ≤ −12°; daylight/civil twilight ≥ −6° | Geometric approximation; no terrain, refraction or light-pollution correction |
| Modeled watch | Nearest activity ≥20/100 or maximum within 500 km ≥40/100 | An uncalibrated qualitative screen; activity score is not the user's naked-eye probability |
| Other watch context | Fresh Bz <−5 nT and speed ≥500 km/s, or fresh Kp ≥5 | Context can prompt observation but cannot confirm local visibility |
| Southern/northern viewing | Poleward horizon | No claimed elevation angle or accurate magnetic-pole conversion |
| Phone and ground contribution | Context only | Cannot increase an optical likelihood category |

`numericalProbability` is always null and `calibrated` is always false. The evaluator never emits a high-confidence active optical alert. A moderate category describes qualitative opportunity under modeled activity and modeled darkness; it is not an empirically estimated frequency. Unknown clouds remain a limitation even in that category. NOAA OVATION uses solar-wind input, and sometimes Kp fallback, so these inputs are not independent votes.

NOAA describes OVATION as short-horizon auroral location/intensity guidance driven by upstream solar wind, with a Kp fallback that has no lead time. We retain its values and valid time without claiming a calibrated personal viewing probability. [NOAA OVATION documentation](https://www.swpc.noaa.gov/products/aurora-30-minute-forecast)

The estimated Kp product summarizes ground magnetic disturbances over three-hour intervals. Its spatial/temporal meaning is distinct from a selected location's sky conditions. [NOAA planetary K-index documentation](https://www.swpc.noaa.gov/products/planetary-k-index)

The RTSW `active` field identifies NOAA's selected primary spacecraft, not a universal data-quality rating; operational telemetry can be interrupted. The parser also requires its supported quality flag and never fills missing measurements with climatological guesses. [NOAA solar-wind documentation](https://www.swpc.noaa.gov/products/real-time-solar-wind)

## Accuracy gaps and the next controlled evaluation

1. **Optical calibration is absent.** Freeze an evaluation dataset of timestamped, independently verified optical outcomes with cloudy/dark/clear negatives, geographic selection rules and instrument/observer labels. Split by complete storm event and geography, including quiet periods. Evaluate calibration/Brier score, precision/recall at fixed thresholds, and reliability diagrams against NOAA-only and simple context baselines. Use issuance and operational-availability times; later revised records must not leak into earlier forecasts.
2. **No learned phone contribution is established.** First finish paired phone/EZIE-Mag stationary, controlled-interference and temperature/environment recordings. Compare baseline-relative scalar units over strictly overlapping UTC windows; exclude motion/tap guards and report clock uncertainty. These home co-located experiments test instrumentation, not independent regional coverage.
3. **No validated learned local-probability model exists.** LLM fluency is not calibration. A future compact calibrated model requires the preceding optical labels and held-out event tests. A sensor denoiser also needs independent ground truth and signal-preservation tests; it must not remove a true common geomagnetic signal to improve a noise metric.
4. **Weather, optical and spatial context remain incomplete.** No connected cloud nowcast, horizon/terrain model, moon/light-pollution correction, verified community photos, all-sky camera integration, or independently validated magnetic-coordinate transform is claimed. All-sky/partner data requires the inventory's rights review before use.
5. **The phone-vs-professional comparison has bounded meaning.** Live USGS scalar F provides genuine reference measurements. Distance, cadence, units and missingness are shown by that integration. A remote observatory and a single phone cannot by themselves establish a local regional disturbance; absolute field magnitudes are not interchangeable calibration standards.
6. **Live model operation is separate from deterministic analysis.** No paid model call was made during this audit. Credentials being present, a mock transport passing, or a connectivity smoke succeeding is not evidence of a persisted seven-tool scientific run. Capture a real authorized run using the existing authenticated `/api/agent` workflow when durable budget, journal, role and consent requirements are available.

## Meta model use recommendation

Keep **Muse Spark 1.3** as the deployed scientific coordinator. Meta currently recommends it for agentic workflows and supports tool calls and structured outputs. Its best role here is choosing the next useful observation/tool, summarizing exclusions and requesting evidence within permissions; deterministic science owns verdicts. **Muse Wonder 1.0** is a possible bounded second opinion for difficult methodology reviews, not a requirement for submission and not proof that an analysis is correct. The optional model identifiers were corrected to `muse-wonder-1.0` and `muse-image-1.0`; their local helper results remain explicitly conceptual/deterministic. [Meta model catalog](https://dev.meta.ai/docs/models)

Do not add a second live model, fine-tuning, an untested denoiser or provider web search in the final hours. Improve scientific inputs and record a genuine existing coordinator run first. A later Spark-vs-Wonder evaluation should score tool validity, correct gap detection, prohibited-action avoidance, unsupported-claim rate, latency and cost against the same blinded cases. Add neither a new scientific tool nor a new verdict authority.

The supported request endpoint is `https://api.meta.ai/v1/responses`. The local smoke script now makes at most one explicit connectivity request, performs no scientific dispatch, exposes no credential fragments, and offers a zero-network `--dry-run`. Its removed `--loop` previously returned hand-written QC, coherence, invitation and publication results that were not execution of the actual scientific engine. Use authenticated `/api/agent` instead. [Meta Responses API](https://dev.meta.ai/docs/api-reference/responses/create-response)

Meta lists standard Spark token pricing at $1.25/M input and $4.25/M output, versus Wonder at $4/M and $20/M. Retain standard mode for private participant context; the cheaper contributor variant permits training use and is not an equivalent privacy choice. No pricing or subscription changes were made. [Meta pricing and mode documentation](https://dev.meta.ai/docs/pricing-rate-limits)

## Verification

- `npm exec vitest run packages/coordinator/src/aurora-evidence.test.ts packages/coordinator/src/meta-suite.test.ts apps/web/lib/noaa-acquisition.test.ts apps/web/lib/science-ui.test.ts`: 47 tests passed after final additions (18 local-evidence, 8 Meta helper, 12 acquisition, 9 existing science/UI).
- `npm run typecheck --workspace @aurorasense/coordinator`: passed.
- `npm run typecheck --workspace @aurorasense/web`: passed.
- Focused ESLint over the changed coordinator/NOAA source and test files: passed.
- `node scripts/test-meta-api.mjs --dry-run`: configured credential present, **0 network requests**, no key material printed.
- Actual public NOAA acquisition: all four sources parsed, hashes retained, no synthetic source substitution.

Unit tests are constructed fixtures for invariants and failure handling, not new sensor observations or measured optical accuracy. The root milestone report tracks production build, rendered UI and full-repository verification separately.
