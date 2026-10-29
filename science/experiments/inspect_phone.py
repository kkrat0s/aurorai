"""Recompute canonical TypeScript QC and inspect an owner-provided private export.

Outputs always stay under ignored data/private. No upload or raw-data publication.
Optional --plot requires matplotlib; all numerical analysis uses the standard library.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import tempfile
from datetime import datetime

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "data" / "private"


def seconds(value: str) -> float:
    return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()


def recompute(raw_path: Path, qc_path: Path) -> dict:
    """Verify all original QC fields, metadata and any new interaction annotation."""
    PRIVATE.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="phone-qc-", dir=PRIVATE) as temporary:
        # TemporaryDirectory is explicitly constrained to the private repository folder.
        Path(temporary).resolve().relative_to(PRIVATE.resolve())
        subprocess.run([
            "node", str(ROOT / "node_modules/typescript/bin/tsc"),
            str(ROOT / "packages/shared/src/sensor.ts"),
            str(ROOT / "packages/shared/src/capture.ts"),
            "--outDir", temporary, "--module", "commonjs", "--moduleResolution", "node",
            "--target", "ES2022", "--skipLibCheck", "--strict",
        ], cwd=ROOT, check=True, capture_output=True, text=True)
        script = """
const fs = require('node:fs'); const assert = require('node:assert/strict');
const api = require(require('node:path').join(process.argv[3], 'sensor.js'));
const session = api.parseSensorSession(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')));
const supplied = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
assert.equal(supplied.sourceSessionId, session.id); assert.equal(supplied.kind, session.kind);
const {sourceSessionId, kind, interactionContext, ...quality} = supplied;
const calculated = api.analyzeSensorSession(session); assert.deepStrictEqual(calculated, quality);
if (interactionContext !== undefined) assert.deepStrictEqual(interactionContext, api.analyzeInteractionContext(session, calculated));
process.stdout.write(JSON.stringify(calculated));
"""
        completed = subprocess.run(["node", "-e", script, str(raw_path), str(qc_path), temporary],
                                   cwd=ROOT, check=True, capture_output=True, text=True)
        return json.loads(completed.stdout)


def summarize(raw: dict, qc: dict) -> dict:
    samples = raw["samples"]
    origin = samples[0]["sensorTimestampSeconds"]
    times = [sample["sensorTimestampSeconds"] - origin for sample in samples]
    intervals = [b - a for a, b in zip(times, times[1:])]
    anchor = seconds(raw["utcAnchor"]["utc"])
    # Relative marker times use the same UTC callback anchor as the QC output.
    markers = [{"kind": marker["kind"], "seconds": seconds(marker["atUtc"]) - anchor,
                "origin": marker.get("origin", "LEGACY_UNKNOWN")}
               for marker in raw["markers"] if marker["kind"] != "SCREEN_INTERACTION"]
    action = {marker["kind"]: marker["seconds"] for marker in markers}
    windows = [("fixed_baseline", 0, min(120, qc["durationSeconds"] + 0.001))]
    if all(key in action for key in ["INTERFERENCE_START", "INTERFERENCE_END", "MOTION_START", "MOTION_END"]):
        windows.extend([
            ("pre_interference", 120, action["INTERFERENCE_START"]),
            ("marked_interference", action["INTERFERENCE_START"], action["INTERFERENCE_END"]),
            ("after_interference_before_motion", action["INTERFERENCE_END"], action["MOTION_START"]),
            ("marked_motion", action["MOTION_START"], action["MOTION_END"]),
            ("after_motion", action["MOTION_END"], qc["durationSeconds"] + 0.001),
        ])
    summaries = []
    for name, start, end in windows:
        selected = [row for time, row in zip(times, qc["sampleResults"]) if start <= time < end]
        fields = [row["magnitudeMicroT"] for row in selected if row["magnitudeMicroT"] is not None]
        summaries.append({"window": name, "startSeconds": start, "endSeconds": end,
                          "samples": len(selected), "usableSamples": sum(row["usable"] for row in selected),
                          "minimumMicroT": min(fields) if fields else None,
                          "maximumMicroT": max(fields) if fields else None,
                          "medianMicroT": statistics.median(fields) if fields else None,
                          "flags": dict(collections.Counter(flag for row in selected for flag in row["flags"]))})
    first_fields = [row["magnitudeMicroT"] for time, row in zip(times, qc["sampleResults"])
                    if time < 30 and row["magnitudeMicroT"] is not None]
    last_fields = [row["magnitudeMicroT"] for time, row in zip(times, qc["sampleResults"])
                   if time >= max(0, qc["durationSeconds"] - 30) and row["magnitudeMicroT"] is not None]
    first_median = statistics.median(first_fields) if first_fields else None
    last_median = statistics.median(last_fields) if last_fields else None
    return {
        "source": "Owner-provided export; kind is a file declaration; independent hardware provenance remains unverified",
        "kind": raw["kind"], "unit": raw["unit"], "frame": raw["frame"], "device": raw["device"],
        "algorithmVersion": qc["algorithmVersion"],
        "sampleCount": len(samples), "durationSeconds": qc["durationSeconds"], "actualHz": qc["actualHz"],
        "stopReason": raw["stopReason"], "lastReceiptToStopMs": (seconds(raw["endedAtUtc"]) - seconds(samples[-1]["receivedAtUtc"])) * 1000,
        "intervalSeconds": {"minimum": min(intervals), "median": statistics.median(intervals), "maximum": max(intervals),
                            "nonIncreasing": sum(value <= 0 for value in intervals), "gapsAboveHalfSecond": sum(value > 0.5 for value in intervals)},
        "baselineMicroT": qc["baselineMicroT"], "baselineMadNt": qc["noiseMadNt"],
        "baselineCoverageSeconds": qc["baselineCoverageSeconds"], "accepted": qc["accepted"],
        "descriptiveDrift": {
            "windowSeconds": 30, "firstMedianMicroT": first_median, "lastMedianMicroT": last_median,
            "lastMinusFirstNt": (last_median - first_median) * 1000 if first_median is not None and last_median is not None else None,
            "qualityScreened": False,
            "interpretation": "Exploratory fixed 30-second endpoint summaries of raw measured variation; not a drift correction or causal attribution.",
        },
        "usableSamples": qc["usableCount"], "usableCoverageSeconds": qc["highWater"][0]["observedCoverageSeconds"],
        "flags": dict(collections.Counter(flag for row in qc["sampleResults"] for flag in row["flags"])),
        "markers": markers, "windows": summaries, "regionalVerdict": qc["regionalVerdict"],
        "limitations": [
            "One participant run is not a sensor calibration or regional disturbance detection.",
            "Baseline MAD includes all first-120-second variation; it is not a measured sensor noise floor.",
            "Marker presses and nearby objects confound action attribution; legacy markers have no interaction origin.",
            "Scheduled cue markers describe planned actions, never proof that an action occurred.",
            "SATURATION_SUSPECT is an engineering range screen, not proof of native hardware saturation.",
            "UTC is callback-anchored; original sensor latency and clock accuracy are unknown.",
            "No late quiet subwindow is selected to re-tune acceptance or claim calibrated sensitivity.",
        ],
    }


def plot(raw: dict, qc: dict, destination: Path) -> None:
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    origin = raw["samples"][0]["sensorTimestampSeconds"]
    time = [sample["sensorTimestampSeconds"] - origin for sample in raw["samples"]]
    field = [row["magnitudeMicroT"] for row in qc["sampleResults"]]
    delta = [row["deltaNt"] if row["usable"] else math.nan for row in qc["sampleResults"]]
    fig, axes = plt.subplots(3, 1, figsize=(11, 8), sharex=True, layout="constrained")
    axes[0].plot(time, field, color="#8254c6", linewidth=1)
    axes[0].set_ylabel("Raw |B| (µT)")
    axes[1].plot(time, delta, color="#16806a", linewidth=1)
    if not any(row["usable"] for row in qc["sampleResults"]):
        axes[1].text(0.5, 0.5, "No QC-usable samples\nRaw measurements remain visible above",
                     transform=axes[1].transAxes, ha="center", va="center", color="#744f1a")
    axes[1].set_ylabel("QC-usable Δ|B| (nT)")
    axes[2].plot(time, [len(row["flags"]) for row in qc["sampleResults"]], color="#bf7b18", linewidth=1)
    axes[2].set_ylabel("QC flag count")
    axes[2].set_xlabel("Seconds from first sensor sample (callback UTC anchor; unknown latency)")
    anchor = seconds(raw["utcAnchor"]["utc"])
    for marker in raw["markers"]:
        if marker["kind"] == "BASELINE" or marker["kind"] == "SCREEN_INTERACTION":
            continue
        relative = seconds(marker["atUtc"]) - anchor
        for axis in axes:
            axis.axvline(relative, color="#777777", linestyle="--", linewidth=0.7)
        axes[0].annotate(marker["kind"].replace("_", " "), (relative, 1), xycoords=("data", "axes fraction"), rotation=90, va="top", fontsize=7)
    for axis in axes:
        axis.axvspan(0, 120, color="#297bbb", alpha=0.06)
        axis.grid(alpha=0.2)
    fig.suptitle(f"{raw['kind']} · owner-provided {raw['device']['model']} export · {qc['algorithmVersion']}\nDevice frame; unverified calibration; raw data retained; single-phone regional verdict INCONCLUSIVE", fontsize=11)
    fig.savefig(destination, dpi=160)
    plt.close(fig)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    parser.add_argument("qc", type=Path)
    parser.add_argument("--output", type=Path, default=PRIVATE / "phone-analysis")
    parser.add_argument("--plot", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(PRIVATE.resolve()):
        parser.error("Outputs must remain under ignored data/private; public review is a separate step.")
    for path in (args.raw, args.qc):
        if path.stat().st_size > 8_000_000:
            parser.error("Input exceeds the 8 MB local analysis limit.")
    raw = json.loads(args.raw.read_text(encoding="utf-8"))
    quality = recompute(args.raw.resolve(), args.qc.resolve())
    result = summarize(raw, quality)
    result["recomputedQcExactlyMatched"] = True
    result["rawSha256"] = hashlib.sha256(args.raw.read_bytes()).hexdigest()
    result["suppliedQcSha256"] = hashlib.sha256(args.qc.read_bytes()).hexdigest()
    output.mkdir(parents=True, exist_ok=True)
    (output / "summary.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    if args.plot:
        plot(raw, quality, output / "trace.png")
    print(json.dumps({"recomputedQcExactlyMatched": True, "sampleCount": result["sampleCount"],
                      "durationSeconds": result["durationSeconds"], "accepted": result["accepted"],
                      "output": str(output)}, indent=2))


if __name__ == "__main__":
    main()
