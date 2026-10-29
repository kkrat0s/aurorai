# Synthetic phone import fixture

`synthetic-phone-local-interference.json` is a **mathematical software test**, not a physical phone recording, measured noise profile, empirical sensor simulation or historical phone network. Its consent fields describe a synthetic test actor, not a person. No region-wide conclusion or phone sensitivity claim can be drawn from it.

The exact shared session schema contains 1,601 samples at a prescribed 10 Hz over 160 seconds, anchored to 2026-10-28 15:00:00 UTC. The first 120 seconds provide a stable generated baseline. A prescribed 12 µT device-z pulse occurs at 135–140 seconds, and a constant-magnitude vector rotation plus motion occurs at 145–148 seconds. Small sinusoidal variation is mathematical, not fitted to any sensor.

Regenerate from the repository root:

```powershell
python demo/replay/generate_sensor_fixture.py
```

Import this JSON through Ground Truth to exercise the browser file workflow. Expected: **SYNTHETIC PHONE SIMULATION** label; local-interference, jump, motion and orientation flags; failing whole-session QC; screened high-water values that exclude the pulse; partial coverage in every 1/6/24-hour window; regional verdict `INCONCLUSIVE`. Do not use this fixture to satisfy the physical-hardware acceptance gate.
