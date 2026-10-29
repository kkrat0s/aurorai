"""Generate a mathematical software-test fixture, never empirical phone noise."""
from datetime import datetime, timedelta, timezone
from pathlib import Path
import json
import math


def timestamp(seconds: float) -> str:
    anchor = datetime(2026, 10, 28, 15, 0, tzinfo=timezone.utc)
    return (anchor + timedelta(seconds=seconds)).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def make_fixture() -> dict:
    samples = []
    for index in range(1601):
        elapsed = index / 10
        x, y, z = 30.0, 0.0, 40.0 + 0.015 * math.sin(index / 7)
        acceleration = {"x": 0.0, "y": 0.0, "z": 1.0}
        if 135 <= elapsed < 140:
            z += 12
        if 145 <= elapsed < 148:
            x, y = 0.0, 30.0
            acceleration = {"x": 0.2, "y": 0.0, "z": 0.98}
        samples.append({
            "x": x, "y": y, "z": z,
            "sensorTimestampSeconds": 100 + elapsed,
            "receivedMonotonicMs": 2000 + index * 100,
            "receivedAtUtc": timestamp(elapsed),
            "accelerationG": acceleration,
            "accelerationAgeMs": 0,
        })
    return {
        "schemaVersion": "aurorasense.sensor.v1",
        "id": "synthetic-phone-local-interference-v1",
        "kind": "SYNTHETIC",
        "sourceId": "AURORASENSE_TEST_GENERATOR",
        "frame": "DEVICE",
        "unit": "microT",
        "startedAtUtc": timestamp(0),
        "endedAtUtc": timestamp(160),
        "utcAnchor": {"sensorTimestampSeconds": 100, "utc": timestamp(0), "uncertaintyMs": None},
        "nominalHz": 10,
        "device": {
            "platform": "mathematical-test-fixture",
            "model": "Mathematical test fixture — not measured noise",
            "sensor": "TEST_GENERATOR: sin(index/7); prescribed pulse and rotation",
            "calibration": "OS_CALIBRATED_ACCURACY_UNKNOWN",
        },
        "consent": {"adultConfirmed": True, "recording": True, "version": "SYNTHETIC_TEST_CONSENT_NOT_A_PERSON", "atUtc": timestamp(0)},
        "stopReason": "SYNTHETIC_SOFTWARE_TEST_COMPLETE",
        "markers": [
            {"kind": kind, "atUtc": timestamp(elapsed), "elapsedSeconds": elapsed}
            for kind, elapsed in [("BASELINE", 0), ("INTERFERENCE_START", 135), ("INTERFERENCE_END", 140), ("MOTION_START", 145), ("MOTION_END", 148)]
        ],
        "samples": samples,
    }


if __name__ == "__main__":
    output = Path(__file__).resolve().parents[1] / "fixtures" / "synthetic-phone-local-interference.json"
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(make_fixture(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output.name}: 1,601 mathematical samples over 160 seconds; not measured phone noise.")
