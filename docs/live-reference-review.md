# Live professional magnetic reference: implementation and limits

Review date: 2026-11-04. Source inventory: existing `assets.md` entries GR-01/GR-02. This is a working live-reference addition, not evidence that phones detect geomagnetic storms.

## Implemented

`GET /api/ground?station=BOU` acquires three hours of actual USGS total-field scalar F, at one-minute cadence, using provisional `variation` records. BOU, FRD, BSL, CMO and TUC are the only accepted station identifiers. The API rejects arbitrary URLs, historical windows and duplicate/unknown query parameters. It bounds requests to 10 seconds and 512 KB, validates station/channel/cadence/UTC ordering/request-window identity, preserves missing minutes, and computes SHA-256 of the received source bytes. Missing or failed data never become fabricated replacement observations. A bounded 60-second warm-instance cache deduplicates requests; no persistent service or paid infrastructure is added.

Both web Ground Truth and the mobile journey can display the actual station trace and simultaneous phone trace. The phone comparison runs on the client; raw phone records and selected coarse region are not sent to USGS or the API. Station selection is explicit. Mobile coarse-region selection defaults to Unknown and uses rounded coordinates when selected. Distance is approximate, not the volunteer's address or precise coordinates.

The display distinguishes measurement, provider generation and retrieval times. Original operational availability remains unknown. The response retains its original retrieval time when cached. A valid sample older than ten minutes is stale; missing or future data remain visible. `variation` is provisional processing status; it is not a claim that a raw sample is already a baseline-subtracted perturbation. The plotted ΔF is calculated explicitly from actual scalar samples.

USGS documentation identifies F as total scalar field and describes supported station, product and cadence choices: [data web service](https://www.usgs.gov/tools/web-service-geomagnetism-data), [USGS geomagnetic plots](https://www.usgs.gov/tools/geomag-plots). USGS-produced information is public domain with source acknowledgment requested: [USGS rights statement](https://www.usgs.gov/faqs/are-usgs-reportspublications-copyrighted). Only the public USGS observatory data are fetched here; no third-party images or privately supplied observations are redistributed.

## Comparison method

Version: `phone-usgs-minute-v1.0.0`. The following are explicit engineering screening rules, frozen before any paired real-world evaluation. Their sensitivity and false-positive rate are **not calibrated**.

1. Require an actual `MEASURED_LIVE` phone session accepted by current acquisition QC. Synthetic or rejected sessions cannot establish station agreement.
2. Convert device scalar magnitude `sqrt(x²+y²+z²)` from microtesla to nT (multiply by 1,000). Never compare a device axis directly with a geographic axis or upstream GSM Bz.
3. Bin usable samples into UTC minutes, requiring at least 45 seconds of covered time and 120 samples per minute. Inter-sample gaps over 500 ms do not count as covered time. Compute the median scalar value in each qualifying minute.
4. Match only identical UTC-minute timestamps in the station record. Do not shift dates, optimize a lag, interpolate missing minutes or normalize amplitudes to produce agreement. Plot both traces on one nT scale, offsetting each by the median of its first two common minutes.
5. Report descriptive Pearson correlation only with at least eight consecutive common minutes, fresh station data, no future matched minute, a selected coarse region within 500 km, and documented finite phone UTC-anchor uncertainty at most five seconds. Constant traces have no defined correlation. Fewer minutes may still be plotted with the limitation visible.
6. Retain `INCONCLUSIVE` for regional evidence regardless of descriptive correlation. One phone/reference pair cannot establish regional independence, causation, forecast improvement or visible aurora.

The UI intentionally still displays actual temporal overlap when clock uncertainty or distance prevents interpretation. Current Expo acquisition does not empirically establish UTC-anchor uncertainty, so genuine sessions with unknown uncertainty receive context-only plots. Do not fill this field with an invented number to unlock a correlation. Live station windows cover the last three hours; prior-day phone files will correctly show no overlap. Historical comparison requires a separately obtained matching reference interval, not relabeling current USGS values.

## Verification evidence

Commands run from the repository root:

```powershell
npx vitest run apps/web/lib/ground-reference.test.ts
npx eslint apps/web/lib/ground-reference.ts apps/web/lib/ground-reference.test.ts apps/web/components/live-reference-panel.tsx apps/web/app/api/ground/route.ts packages/shared/src/ground-reference.ts apps/mobile/components/LiveReferencePanel.tsx scripts/smoke-live-ground.ts --max-warnings 0
.\node_modules\.bin\vite-node.cmd scripts/smoke-live-ground.ts BOU FRD BSL CMO TUC
```

Nine targeted tests passed on 2026-11-04. Targeted lint passed with zero warnings. Tests cover parser identity/time/cadence errors, null and sentinel values, stale/future records, bounded HTTP payload, failed source requests, invalid API queries, correct unit conversion and known manufactured correlation, wrong-period/synthetic/rejected sessions, sparse sampling, gaps, unknown/distant location, unknown/invalid clock precision and constant signals. The manufactured phone/station test inputs are software tests; they are not physical measurements or measured sensor noise. Full application checks and rendered-screen review are recorded in `docs/progress.md` by the integration pass.

Live acquisition was independently run through the same TypeScript acquisition/parser code. Sandbox-blocked requests first failed closed; the authorized public-network smoke then succeeded. Each endpoint returned 181 UTC rows, including 180 valid scalar observations and one missing latest minute. All latest valid observations were **2026-11-04 12:05:00 UTC** and fresh at retrieval:

| Station | Retrieved UTC | Last F (nT) | SHA-256 of actual source bytes |
|---|---|---:|---|
| BOU | 12:06:25.232 | 51024.425 | `8e55d11ee524b79412ae499405b636c79ee03e022b074ce990bcc288f03ed21a` |
| FRD | 12:06:25.748 | 50031.676 | `c33599005fe1e7e073cc9dae3bd9c1b833443c5f10e73c9389d5b70fe0f1658e` |
| BSL | 12:06:26.060 | 46320.698 | `fa8a06c7af0ec784f556f727a01eed82519a9fa04aff2cabc63aa7668fa74ab8` |
| CMO | 12:06:43.492 | 56064.317 | `4ad3e180565f794c6838b3514f7b1415d8d33fc17e483aeb3c67e46528a91214` |
| TUC | 12:06:44.038 | 46256.072 | `0fb7c9004d4e5cb0795f76760d70cf1c276edf5ac4e0eadede04706080496e05` |

The requested window was 2026-11-04 09:06–12:06 UTC, `elements=F&sampling_period=60&type=variation&format=json`. These are smoke-check observations at a specified time, not durable replay fixtures or a promise of future source uptime. Live values will change. Raw response snapshots were not added to the repository.

## Relation to the existing solar_storm website

Read-only inspection of `D:/coding/solar_storm/index.html` found real NOAA solar-wind plasma, magnetic-field and planetary Kp collection and graphing. This supplied useful patterns for short public-source requests and recent history. It did not supply a local professional ground-magnetometer feed. Its upstream solar-wind GSM Bz is not the field quantity measured by a handheld phone. The new ground path therefore obtains a USGS scalar reference independently rather than mislabeling the website's upstream field as a local reference. No files in `solar_storm` were modified.

## Accuracy gaps and value assessment

**Blue team:** The application now has a falsifiable scientific comparison: real independently acquired observatory samples, explicit time overlap, compatible scalar units, shared plotting scales and visible negative outcomes. It can distinguish a local phone excursion from a contemporaneous reference trace without inventing a storm detection. Successful public-source acquisition is already demonstrated for five stations. Deterministic gating limits the coordinator's ability to narrate unsupported agreement.

**Red team:** A scalar total field can miss a vector disturbance perpendicular to the prevailing field. A minute median can suppress short phenomena and is not necessarily the same temporal filter used by an observatory. Nearby regions can experience different ionospheric currents; 500 km is an engineering context boundary, not established coherence length. Indoor bias, motion, temperature, OS calibration and local ferrous objects can dominate phone data. Shared smooth trends can produce high Pearson r without a useful independent signal; autocorrelation means ordinary independent-sample significance formulas are inappropriate. No statistical significance, causal attribution, calibrated sensitivity or forecasting gain is reported. The currently unavailable empirical phone timing precision also limits interpretations.

**Remaining physical validation:** The user explicitly deferred EZIE-Mag testing. It remains necessary to record stationary paired phone/EZIE observations with verified clocks, sensor calibration/status, controlled local-interference conditions and independently inspected provenance. Evaluate quiet periods and disturbances across multiple independent devices/sites, freeze the comparison protocol before outcomes, and report false positives and false negatives. This work cannot honestly be replaced by UI polish or model narration.

**Judge demonstration:** Start the web API, open Ground Truth in Live mode, choose a USGS station, inspect fresh timestamps and source provenance, then import or record a new phone session covering the same current minutes. Keep the phone stationary for ten minutes to allow complete minute bins. Select the true coarse recording region; do not select a closer city merely to pass the distance rule. Show the actual overlap and the reason a scientific conclusion remains inconclusive. Historical phone recordings should show no overlap against current data. Check airplane-mode or disconnected-source behavior: the panel should retain labeled old data or show unavailable, never manufacture a trace.
