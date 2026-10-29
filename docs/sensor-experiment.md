# Foreground phone acquisition and local QC

Implemented 2026-10-28. **Two owner-provided iPhone recordings have been inspected:** a partial interference run (3,042 samples / 304.844 s / background stop) and an uninterrupted stationary attempt (5,987 samples / 600.032 s / automatic stop). Canonical QC exactly matches both exports. The second run fails the frozen baseline-stability gate despite no detected motion. See [the measured report](phone-experiment-2026-10-28.md). Android, a usable quiet-noise profile and guided-cue hardware verification remain open gates.

## Run the collector

The mobile app is a standalone npm package, outside the web workspace, so Expo's React Native dependencies remain isolated.

```powershell
cd D:\coding\AurorAI\apps\mobile
npm ci
npm start
```

Open the development server using Expo Go matching SDK 58 on a physical Android phone or iPhone, on the same LAN. The current package uses Expo 58.0.21, React 19.3.0 and React Native 0.88.0, with Expo-selected native modules. If the installed Expo Go is incompatible, install a compatible client or use a managed development build; do not mistake a simulator for physical validation. No app-store publishing or paid build is necessary to run the local collector in a compatible Expo Go client.

### Available devices and connection handoff — 2026-10-28

The owner reports a **Google Pixel 11 Pro XL** and **iPhone 14 Pro Max** available. OS versions and actual sensor behavior remain unverified. Use the Pixel for the first acquisition, then repeat on iPhone as a separate platform check. Co-located phones do not become independent regional evidence.

Install the compatible client using [Expo's official Android SDK 58 download page](https://expo.dev/go?device=true&platform=android&sdkVersion=58). The project connection QR is printed by `npm start`; connect the phone and computer to the same Wi-Fi, then scan it in Expo Go. The LAN address can change when the computer changes networks. For physical iOS, current [Expo instructions](https://docs.expo.dev/get-started/start-developing/) require Expo CLI and Expo Go to use the same Expo account; that account sign-in has not been performed in this session. Do not share credentials in chat.

The online compatibility check found React Native 0.88.1 versus expected 0.88.0, and TypeScript 5.9.3 versus expected ~6.0.3. `npx expo install --fix` aligned both, updating the mobile lockfile. Afterwards mobile type checking, lint and `expo install --check` passed. Fresh Android/iOS Hermes exports passed (771/772 modules; about 1.9 MB each). This supersedes the earlier offline-only compatibility check below. Eight inherited Expo tooling audit findings remain unchanged.

The browser dashboard accepts the exported **raw session JSON**, not the QC-report JSON. There is no enabled live cloud bridge: export from the phone and import through Ground Truth. Browser import processes data in memory. Supabase synchronization is a subsequent authenticated integration gate.

## Actual capture behavior

- The recorder requires adult confirmation, recording consent, physical hardware, foreground app state, available magnetometer/accelerometer and native sensor permission.
- Requests 10 Hz. Stores delivered native sensor timestamp (seconds), independent callback monotonic receipt time (milliseconds), UTC receipt time, device-frame x/y/z (µT), latest accelerometer vector (g), and its callback age.
- UTC is anchored to the first sensor callback's receipt time; sensor transport latency and device clock accuracy are **unknown**, recorded as `uncertaintyMs: null`. This is not precision-synchronized observatory timing.
- Visible Stop, backgrounding, consent withdrawal and unmount remove listeners. Permission responses arriving after cancellation cannot start collection. A watchdog stops stalled acquisition and enforces ten minutes even if sensor events stop. Returning to foreground does not auto-resume.
- Saves a private local checkpoint every ten seconds and on stop. Abrupt process loss can lose the last uncheckpointed interval. One retained session must be explicitly deleted before a new session begins.
- Exports raw JSON, CSV with derived QC, or a QC report through an explicit OS share action. Local delete removes the retained recording and this app's cached export directory; already-shared external copies require separate deletion.
- No GPS, background service, API key, automatic cloud upload, sensor activation by an agent, or automatic public publishing is implemented.

## Prespecified engineering QC v0.1

`packages/shared/src/sensor.ts` is the common implementation used by mobile and web. Raw samples are not modified. The baseline is the median scalar magnitude of samples in the first **120 seconds**, only after at least 120 samples and 108 seconds of genuinely contiguous baseline coverage exist. It does not slide to absorb a later artifact.

| Check | Frozen screening rule |
|---|---|
| Units / frame | 1 µT = 1000 nT; all phone axes remain DEVICE |
| Actual cadence | Delivered sample intervals over measured elapsed time, accounting for gaps |
| Gaps | Consecutive sensor interval > 0.5 seconds |
| Sensor time | Nonfinite or nonincreasing sensor/receipt monotonic time fails session QC |
| Clock continuity | Receipt UTC elapsed differs from monotonic elapsed by >1 second |
| Motion | Acceleration magnitude departure from 1 g or baseline-vector difference >0.06 g |
| Unknown motion | Missing/nonfinite acceleration, or age outside 0–500 milliseconds |
| Device orientation | Magnetic vector angle differs from fixed baseline by >5 degrees |
| Abrupt jump | Consecutive scalar change >1 µT |
| Large local deviation | Absolute baseline-relative magnitude >max(2 µT, 8 × baseline MAD) |
| Noisy baseline | Scalar median absolute deviation >250 nT |
| Range screening | Scalar magnitude <1 µT or >2000 µT; hardware saturation range itself is unknown |
| Session acceptance | Valid baseline, ≥80% usable samples, and no invalid time/value/consent, large local deviation, abrupt jump, orientation or range failure |

The rules conservatively identify **local/unknown** contamination, not its causal source. A real disturbance could also cross a screening threshold; these are not calibrated sensitivity or false-alarm rates. Sensor accuracy and OS calibration state are unavailable through this API and are labeled unknown. Single-phone regional verdict is always `INCONCLUSIVE`.

### What QC means, and what household noise can be handled

QC means **quality control**: deciding which measurements support a particular inference. A continuous export can pass acquisition checks while failing a stability screen. Failed regional-use QC does not erase the measurements or their value for diagnosing instrument behavior. The 250 nT baseline-MAD rule is a frozen initial engineering threshold, not a universal physical limit or an empirically calibrated decision boundary.

Random short-timescale jitter can sometimes be reduced by robust averaging. Brief interactions can be annotated and assessed separately. Sustained baseline drift is harder: filtering it out can also remove a real geomagnetic variation occurring on the same timescale. Corrections therefore need a characterized device response and evaluation against reference measurements, with raw and corrected data retained. The current prototype has not validated such a correction. Baseline MAD measures variation from all causes; it does not isolate electronic noise.

Cats walking elsewhere are not an identified explanation for either recording. An animal could indirectly affect a measurement by disturbing the phone/support or bringing a magnetic/metal object close, but no such action was documented. Do not assign a cause from the trace alone. NOAA's [CrowdMag tutorial](https://www.ncei.noaa.gov/products/crowdmag/tutorial) demonstrates the role of nearby environmental metal in phone magnetic readings.

A relevant hypothesis to investigate is sensor settling or calibration history after the strong first perturbation. [Odenwald (2019)](https://doi.org/10.5334/cstp.158) reports settling, offsets and temperature sensitivity in older tested phone models. Those findings motivate a diagnostic check; they do not establish the cause or settling time of this iPhone 14 Pro Max. Keep this uncertainty visible and do not retrospectively subtract a fitted drift and call the remainder a verified storm signal.

### Missing device-state diagnostics — verified inventory, not implemented telemetry

The current recorder stores calibrated x/y/z, scalar derivations, accelerometer data/age, sensor/receipt times, model/platform, consent, touch/cue markers and a generic stop reason. The current GP uses scalar magnitude and elapsed time only. The earlier exports cannot retrospectively reveal charging/radio/call/temperature state.

| Additional measurement/context | Scientific value | Current feasibility |
|---|---|---|
| Gyroscope angular rate; gravity/attitude | Detect rotation, including rotation about gravity that an accelerometer can miss | Expo sensors provides gyroscope; not yet subscribed/exported. Treat magnetometer-derived heading as a dependent measurement, not independent corroboration. |
| Calibrated and uncalibrated magnetic streams; calibration/bias status | Investigate OS correction jumps versus sensor/environment variation | Expo provides separate streams, requiring actual per-device availability tests. Its current measurement types expose x/y/z/time, not calibration accuracy or bias estimates. Native Apple/Android APIs expose additional fields; these may require a custom native build. |
| Battery level, charging state, low-power mode | Correlate changing electrical/thermal operating conditions | Available through Expo Battery; not currently collected. Charging state does not by itself identify wireless versus wired charging. |
| Thermal state, ambient/device temperature | Investigate warm-up and drift | iOS has a native coarse thermal-state API; it is not a temperature in degrees. Actual sensor temperature is not available through the current Expo interface. Do not invent a temperature from battery percentage. |
| Network type and changes; declared radio settings | Correlate connection transitions with disturbances | Expo Network exposes connection type/state and Android airplane-mode state. This is not general Wi-Fi/Bluetooth enabled-state, traffic, or transmitter-power telemetry; iOS airplane state is not provided by that API. Store unknown/manual provenance where needed. |
| Exact app-state/focus/blur timeline and known interruption annotations | Separate app interruption from field disturbance | AppState is already used to stop collection, but its full event history is not exported. A call-specific observer is not implemented. Generic inactivity must not be labeled as a verified call. |
| Ringer/vibration/audio activity, charger/case/accessory declarations | Test current-carrying components, moving magnets and physical vibration as confounds | Automated system-wide access varies. Explicit pre-session declarations or controlled event records may be necessary; caller identity/content and Bluetooth/network identifiers are not needed. |
| OS/app/runtime version, startup age, own rendering/QC load, screen state | Reproduce calibration/runtime differences and examine self-generated load | Device/runtime metadata and own processing timings can be instrumented. They are not presently in exports; Expo Go development behavior must not be assumed identical to a release build. |
| Synchronized professional reference and independent sites | Distinguish shared regional behavior from local/device variation | Not established for the 2026 phone sessions. Co-located phones can diagnose devices but cannot count as independent regional sites. |

**Radios and calls:** do not equate a radio being enabled with proven magnetic contamination. Manufacturer guidance identifies current paths, speakers and motors as potential interference sources; radio-related current/thermal effects are plausible hypotheses to test, not established causes in these recordings. See [NXP magnetometer placement guidance](https://www.nxp.com/company/about-nxp/smarter-world-blog/BL-MAGNETOMETER-PLACEMENT-WHERE-WHY). This magnetometer trace is not a measurement of Wi-Fi/Bluetooth RF power.

An incoming call can ring/vibrate, alter device activity and put iOS into `inactive`. The existing recorder stops on any non-active AppState, including inactive, with `APP_BACKGROUNDED` as a generic reason. Not every banner/notification necessarily causes the same state transition. Android notification-drawer blur can occur without AppState changing and is not currently logged. See [React Native AppState](https://reactnative.dev/docs/appstate).

**Prospective experiment:** add timestamped context first, then compare repeated preconfigured conditions while changing one setting at a time and retaining every run. Counterbalance order to avoid mistaking warm-up/time drift for a radio effect. Do not open Control Center midway through a stationary session and assume that event is harmless; it can interrupt foreground acquisition. A Wi-Fi-off baseline should use a suitably verified offline/standalone setup rather than assume the current LAN-served Expo Go workflow is unchanged. A call experiment keeps foreground-stop policy in force and marks the resulting truncation.

API references: [Expo Battery](https://docs.expo.dev/versions/latest/sdk/battery/), [Expo Network](https://docs.expo.dev/versions/latest/sdk/network/), [Apple calibration accuracy](https://developer.apple.com/documentation/coremotion/cmmagneticfieldcalibrationaccuracy), [Android uncalibrated field and bias](https://developer.android.com/develop/sensors-and-location/sensors/sensors_position), [Apple thermal state](https://developer.apple.com/documentation/foundation/processinfo/thermalstate-swift.property). This inventory records available mechanisms and limitations; none of the new channels has yet been physically verified in AuroraSense.

### Owner-provided reference identified: EZIE-Mag — data inspection pending

The owner identifies the separate instrument as **EZIE-Mag**. Its current official documentation and a primary campaign paper have been inspected. No measurement from this particular unit, software/version settings, calibration status or clock/GPS status has yet been inspected; it remains a local reference candidate, not automatically a calibrated professional observatory.

Verified sources: [APL getting started](https://eziemag.jhuapl.edu/website/getting_started/), the 2026 [operating manual](https://eziemag.jhuapl.edu/documentation/26-01497_EZIE-Mag-Manual-2026-Update_v11.pdf), [explanation guide](https://eziemag.jhuapl.edu/documentation/26-10363_EZIE-Mag-Explanation_v03_FINAL.pdf), and [Mesquita et al. (2025)](https://doi.org/10.3389/fspas.2025.1601396). The guides describe UTC/nT displays, temperature diagnostics and multiple download averaging levels. The operating manual's Latest Data page covers the last 24 hours, with daily/weekly archives separately available. Annotated text is preferable for initial schema/metadata inspection; preserve original raw/archive data as well.

The paper identifies the PNI RM3100-based instrument and reports Wi-Fi-dependent variation under its test conditions; these are not certified specifications of the owner's particular unit. It also describes thermal correction requiring longer operation. Actual calibration/temperature history must be checked before treating the unit as a clean training label. Do not infer a live disturbance or accuracy from disagreement with IGRF alone; a main-field model is not a contemporaneous local reference trace.

**Immediate data request:** if EZIE-Mag was operating on October 28, 2026, retain data covering **18:45–19:40 UTC** (14:45–15:40 America/New_York). That brackets both phone records: approximately 18:51–18:56 and 19:20–19:30 UTC. Use local Latest Data rather than the current previous-hour shortcut if the earlier interval is no longer in that window. Place originals in ignored `data/private/ezie/`. Exports can contain exact GPS, station fingerprints and operator metadata: no public upload or repository commit is authorized. The precise file schema and decoder remain unverified until a sample is inspected.

Once its specifications are verified, a synchronized comparison can provide independent labels for the AI experiment. Compare the same quantity and units; phone DEVICE axes must not be treated as aligned with another instrument's axes. For a three-axis reference, scalar magnitude may simplify initial comparisons; a single-axis reference needs an appropriate aligned component. Preserve raw timestamps, timing uncertainty, calibration information, sampling gaps, separation and settings. Check instrument/phone mutual interference and local gradients before choosing fixed placement.

Begin with an unfiltered simultaneous baseline, then separately labeled controlled conditions and repeat sessions. Establish timing from independent clock/trigger information rather than searching for the lag that maximizes agreement on the test record. Fit simple bias/gain baselines and candidate ML corrections on designated training sessions, and evaluate on untouched whole sessions for field error, drift, signal retention and artifacts. Retain every trial. Shared local changes do not establish a regional geomagnetic cause; independent distant references/sites remain necessary for that verdict.

This reference could distinguish a phone-only change from a shared local field change and test whether the AI preserves a change observed by another instrument. Its suitability depends on documented capability and uncertainty; see [NIST measurement traceability guidance](https://www.nist.gov/metrology/metrological-traceability). A private sample export, unit status and clock/calibration information are the next required evidence for actual ingestion and paired evaluation. No parser is claimed tested on an EZIE-Mag file yet.

Output includes per-sample masks, fixed baseline, baseline noise MAD, final 30-second screened median displacement (a drift indicator, not a calibrated drift correction), observed duration and sampled baseline coverage. High-water maximum/p95 values for 1/6/24-hour windows use only usable samples and sum contiguous observed intervals; a ten-minute recording remains a partial window in all three summaries. Excluded spikes are not counted as geomagnetic extremes.

## Interaction-aware acquisition added after the first run

The owner reported that taps move the phone and bring hands/objects close to it. The original `phone-qc-0.1.0` rules and original result are preserved. New `hands-free-protocol-0.1.0` metadata accounts for interactions without granting them an automatic scientific exemption:

- A **Guided local experiment** switch, off by default, enables visual cues fixed at 180/185 seconds for accessory approach/removal and 300/305 seconds for motion/return. No marker taps are needed after Start. The cue banner remains visible above the scrolling recorder.
- Cues are exported with `origin: SCHEDULED_CUE`, planned seconds and actual delivery time. They are planned prompts, not independently verified physical actions. A cue delivered more than two seconds late visibly invalidates timely protocol delivery.
- Manual screen contacts and marker presses are annotated with `origin: MANUAL_TOUCH`. A separate fixed context summary counts samples from one second before through three seconds after a recorded touch, and usable coverage away from those windows. These are prospective engineering annotation windows, not empirically calibrated settling times. Older markers retain unknown origin.
- The annotation does not change raw values, QC masks, thresholds, acceptance or high-water results. Extended interference cannot be hidden by a touch marker. No field change is attributed specifically to the participant's body from this data.
- Expo KeepAwake is active only while the recording component is mounted. Backgrounding, Stop and consent withdrawal still stop collection. The second owner-provided run completed ten uninterrupted minutes with only the initial Start interaction and automatic stop. This is consistent with the revised foreground workflow; guided cues still need a physical test, and no independent OS wake-lock instrumentation was obtained.

For the next platform check, use the Pixel with **Guided local experiment OFF**, disconnected from charging and without magnetic accessories/cases. Keep it untouched on a nonmagnetic support, keep the interference source well away, and let it stop automatically. The iPhone stationary repeat already completed but its noise/stability gate failed; it must remain in the evidence record. Use guided mode for a separate controlled test. Do not reuse a magnetically perturbed interval as clean sensor-noise evidence.

To verify future exports locally:

```powershell
python -m science.experiments.inspect_phone path/to/private-raw.json path/to/private-qc.json --plot
```

The command compiles the canonical TypeScript QC, checks the supplied report exactly, and writes summaries/optional figures only under ignored `data/private/phone-analysis/`. Plotting optionally requires matplotlib. Native root export filename patterns are also ignored. Raw records remain private.

## Physical protocol still to execute

1. Record phone model, OS, app version and actual sensor availability. Do not record exact volunteer locations in public artifacts.
2. On a stable nonmagnetic surface, opt in and begin a ten-minute recording. Keep at least the first three minutes stationary; the first two are the fixed analysis baseline.
3. Mark interference start. Briefly bring a small magnetic accessory nearby without contact, remove it, then mark interference end. Do not move the phone in the same interval.
4. Later mark a separate motion/orientation interval, rotate/move the phone, then return it to a stable position. Marker presses can themselves move the device; include that limitation in analysis.
5. Stop and export JSON and QC. Save raw data privately, verify units/cadence/time mapping, compare flags with experiment markers, and record false negatives/false positives without changing thresholds after seeing the result.
6. Demonstrate background stop and consent revocation in separate short sessions. Confirm local delete and retained-export cleanup.
7. Import the JSON in web Ground Truth. The current historical professional reference is a separate event window and must not be described as synchronized with today's phone recording.
8. Only then create a sanitized public acquisition manifest and fit any empirical noise simulation. No empirical phone noise profile or measured local interference outcome exists yet.

## Verification performed

- `npm test -- packages/shared/src`: **16 tests passed** (12 scientific/parser cases and 4 lifecycle cases).
- `npm run typecheck --workspace @aurorasense/shared`: passed.
- `npm run typecheck` in `apps/mobile`: passed.
- `npx eslint apps/mobile/App.tsx packages/shared --max-warnings 0`: passed.
- `npx expo install --check`: local SDK dependency-map check passed. Network was disabled for this check; it does not verify Expo Go compatibility on a phone.
- Android production Hermes export succeeded: 771 modules, approximately 1.9 MB bytecode. Initial sandbox attempt failed because Hermes could not write a temporary output file; the authorized local compiler run outside the sandbox succeeded.
- iOS production Hermes export succeeded: 772 modules, approximately 1.9 MB bytecode. Neither JavaScript bundle proves native device behavior or signing.

Final source recheck: mobile TypeScript, ESLint covering App/Metro/entrypoint/shared modules, all 16 shared tests, and both Android/iOS Hermes exports passed after the local-storage and strict UTC validation fixes. Final bytecode names: Android `index-0518db4e311d18429eb6faddfb06c11a.hbc`; iOS `index-6c47c90046575d62eb4bbe74bd19541a.hbc`. Generated `dist/` output is ignored.

Dependency audit: `npm audit --omit=dev --json` returned 8 inherited Expo tooling findings (3 high, 5 low) through CLI Zod 3.25.76 and config deepmerge 4.3.1. The suggested automatic remedy downgraded Expo to SDK 51 and was not applied. No externally accessible development server or deployment was created. Recheck upstream compatible fixes before public hosting; app parsing itself uses explicit bounded input validation without Zod.

## SDK evidence

Verified official documentation and installed native types/source on 2026-10-28: [Expo Magnetometer](https://docs.expo.dev/versions/latest/sdk/magnetometer/), [Accelerometer](https://docs.expo.dev/versions/latest/sdk/accelerometer/), [FileSystem](https://docs.expo.dev/versions/latest/sdk/filesystem/), [Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/). Magnetometer values are µT, timestamps are seconds, acceleration is in g, and subscriptions have explicit removal. SDK 58 File writes are asynchronous (`write`) or explicitly synchronous (`writeSync`); this implementation awaits export writes and uses `writeSync` for private checkpoints.
