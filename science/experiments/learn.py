"""Bounded retrospective BOU/OMNI experiment with whole-event holdout.

Run python -m science.experiments.learn. The JSON protocol is fixed before
downloading outcomes. Scores are written even if the candidate performs worse.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

from science.acquisition.sources import ROOT, RESULTS, fetch_json, normalize_omni, normalize_usgs, omni_url, usgs_url, utc_now, write_json

PROTOCOL_PATH = Path(__file__).with_name("learning_protocol.json")
FEATURES = ["couplingNow", "pressureNow", "bzNow", "speedNow", "priorGround", "groundSlope", "bzMean", "bzStd", "southwardFraction", "bzReversals", "pressureDelta", "couplingMean"]


def validate_split(events):
    ids = [e["id"] for e in events]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate event IDs")
    ordered = sorted(events, key=lambda e: e["start"])
    for e in ordered:
        if e["split"] not in ("train", "test") or e["start"] >= e["end"]:
            raise ValueError("Invalid event split/window")
    for a, b in zip(ordered, ordered[1:]):
        if pd.Timestamp(a["end"]) > pd.Timestamp(b["start"]) - pd.Timedelta(hours=24):
            raise ValueError("Events overlap or lack the frozen 24-hour embargo")


def check_operational_availability(records, issued_at):
    """Strict gate for future operational use; unknown never means available."""
    return bool(records) and all(r.get("availableAtUtc") is not None and pd.Timestamp(r["availableAtUtc"]) <= pd.Timestamp(issued_at) for r in records)


def make_cases(event, omni_rows, reference):
    sw = pd.DataFrame(omni_rows).set_index("observedAtUtc")
    sw.index = pd.to_datetime(sw.index, utc=True)
    ground = pd.Series({s["observedAtUtc"]: s["value"] for s in reference["samples"]}, dtype=float)
    ground.index = pd.to_datetime(ground.index, utc=True)
    cases, exclusions = [], {"missingGround": 0, "missingSolarWind": 0}
    # Both features and labels remain inside their own complete event block.
    for issue in pd.date_range(pd.Timestamp(event["start"]) + pd.Timedelta(hours=1), pd.Timestamp(event["end"]) - pd.Timedelta(minutes=35), freq="5min"):
        past_times = pd.date_range(issue - pd.Timedelta(minutes=60), issue - pd.Timedelta(minutes=1), freq="1min")
        target_times = pd.date_range(issue + pd.Timedelta(minutes=30), issue + pd.Timedelta(minutes=34), freq="1min")
        past, target = ground.reindex(past_times), ground.reindex(target_times)
        if past.isna().any() or target.isna().any():
            exclusions["missingGround"] += 1
            continue
        sw_times = pd.date_range(issue - pd.Timedelta(minutes=60), issue - pd.Timedelta(minutes=5), freq="5min")
        window = sw.reindex(sw_times)
        cols = ["BY_GSM", "BZ_GSM", "flow_speed", "proton_density", "Pressure"]
        if window[cols].isna().any().any():
            exclusions["missingSolarWind"] += 1
            continue
        baseline = float(past.median())
        bz = window["BZ_GSM"].to_numpy(float)
        pressure = window["Pressure"].to_numpy(float)
        coupling = window["flow_speed"].to_numpy(float) * np.maximum(-bz, 0) * 1e-3  # mV/m southward electric-field proxy
        prior = float(past.iloc[-5:].mean()) - baseline
        slope = float(past.iloc[-5:].mean() - past.iloc[-10:-5].mean())
        feature_values = [coupling[-1], pressure[-1], bz[-1], float(window["flow_speed"].iloc[-1]), prior, slope,
                          float(bz.mean()), float(bz.std()), float(np.mean(bz < 0)), float(np.sum(bz[1:] * bz[:-1] < 0)),
                          float(pressure[-1] - pressure[0]), float(coupling.mean())]
        cases.append({"eventId": event["id"], "split": event["split"], "issuedAtUtc": issue.isoformat().replace("+00:00", "Z"),
                      "validAtUtc": (issue + pd.Timedelta(minutes=30)).isoformat().replace("+00:00", "Z"),
                      "latestInputObservedAtUtc": past_times[-1].isoformat().replace("+00:00", "Z"),
                      "latestSolarWindBinStartUtc": sw_times[-1].isoformat().replace("+00:00", "Z"),
                      "inputAvailableAtUtc": None, "operationallyEligible": False,
                      "baselineNt": baseline, "targetNt": float(target.mean()) - baseline,
                      **dict(zip(FEATURES, [float(x) for x in feature_values]))})
    return cases, exclusions


def scores(truth, pred):
    error = np.asarray(pred) - np.asarray(truth)
    return {"MAE_nT": float(np.mean(np.abs(error))), "RMSE_nT": float(np.sqrt(np.mean(error ** 2))), "bias_nT": float(np.mean(error))}


def validate_cases(df, protocol):
    """Reject leakage, unknown event membership, or windows crossing an embargo."""
    event_ids = {e["id"] for e in protocol["events"]}
    if not set(df.eventId).issubset(event_ids):
        raise ValueError("Case references an event outside the frozen protocol")
    if df.duplicated(["eventId", "issuedAtUtc"]).any():
        raise ValueError("Duplicate forecast cases")
    if not np.isfinite(df[FEATURES + ["targetNt", "baselineNt"]].to_numpy(float)).all():
        raise ValueError("Nonfinite feature or target")
    for event in protocol["events"]:
        rows = df[df.eventId == event["id"]]
        issue = pd.to_datetime(rows.issuedAtUtc, utc=True)
        valid = pd.to_datetime(rows.validAtUtc, utc=True)
        if ((rows.split != event["split"]).any()
            or (issue - pd.Timedelta(minutes=protocol["historyMinutes"]) < pd.Timestamp(event["start"])).any()
            or (valid + pd.Timedelta(minutes=protocol["targetWindowMinutes"]) > pd.Timestamp(event["end"])).any()
            or (valid != issue + pd.Timedelta(minutes=protocol["horizonMinutes"])).any()):
            raise ValueError("Case violates frozen event membership or target window")
    issue = pd.to_datetime(df.issuedAtUtc, utc=True)
    if (pd.to_datetime(df.latestInputObservedAtUtc, utc=True) >= issue).any() or (pd.to_datetime(df.latestSolarWindBinStartUtc, utc=True) + pd.Timedelta(minutes=5) > issue).any():
        raise ValueError("Future input leakage")


def run(offline=False):
    protocol_bytes = PROTOCOL_PATH.read_bytes()
    protocol = json.loads(protocol_bytes)
    validate_split(protocol["events"])
    dataset, manifests, coverage = [], [], []
    if offline:
        previous = json.loads((RESULTS / "baseline_comparison.json").read_text())
        cases_bytes = (RESULTS / "learning_cases.json").read_bytes()
        if previous["protocolSha256"] != hashlib.sha256(protocol_bytes).hexdigest() or previous["casesSha256"] != hashlib.sha256(cases_bytes).hexdigest():
            raise ValueError("Frozen protocol/case hash mismatch")
        dataset = json.loads(cases_bytes)
        manifests, coverage = previous["sourceManifests"], previous["eventCoverage"]
    for event in ([] if offline else protocol["events"]):
        print("Acquiring", event["id"], flush=True)
        sw_raw, sw_manifest = fetch_json(omni_url(event["start"], event["end"]), event["id"] + "-omni.json")
        station_raw, station_manifest = fetch_json(usgs_url(event["start"], event["end"]), event["id"] + "-bou.json")
        sw = normalize_omni(sw_raw)
        reference = normalize_usgs(station_raw, station_manifest, components=("X",))[0]
        cases, excluded = make_cases(event, sw, reference)
        dataset.extend(cases)
        manifests.extend([{ "eventId": event["id"], "sourceId": source, **manifest} for source, manifest in (("NASA_OMNI_HRO_5MIN", sw_manifest), ("USGS_BOU", station_manifest))])
        coverage.append({"eventId": event["id"], "split": event["split"], "usableCases": len(cases), "omniRows": len(sw), "groundRows": len(reference["samples"]), "excluded": excluded})
        print("Usable", len(cases), "excluded", excluded, flush=True)
    df = pd.DataFrame(dataset)
    if df.empty or set(df["split"]) != {"train", "test"}:
        raise ValueError("Insufficient genuine complete-case train/test observations; no scores produced")
    train, test = df[df.split == "train"], df[df.split == "test"]
    if set(train.eventId) & set(test.eventId):
        raise ValueError("Event leakage")
    validate_cases(df, protocol)
    model_features = {"southward-coupling-ridge": FEATURES[:2], "instantaneous-plus-ground-ridge": FEATURES[:6], "history-plus-ground-ridge": FEATURES}
    predictions = {"persistence": test["priorGround"].to_numpy()}
    exported = {}
    for name, features in model_features.items():
        model = make_pipeline(StandardScaler(), Ridge(alpha=protocol["ridgeAlpha"]))
        model.fit(train[features], train["targetNt"])
        predictions[name] = model.predict(test[features])
        scaler, ridge = model.steps[0][1], model.steps[1][1]
        exported[name] = {"features": features, "mean": scaler.mean_.tolist(), "scale": scaler.scale_.tolist(),
                          "coefficients": ridge.coef_.tolist(), "intercept": float(ridge.intercept_), "alpha": protocol["ridgeAlpha"]}
    result = {"status": "MEASURED_RETROSPECTIVE_EVALUATION", "protocolVersion": protocol["version"], "computedAtUtc": utc_now(),
              "protocolSha256": hashlib.sha256(protocol_bytes).hexdigest(), "task": protocol["task"], "unit": "nT", "horizonMinutes": 30,
              "operationalClaim": False, "phoneContributionEvaluated": False, "trainingCases": len(train), "testCases": len(test),
              "eventCoverage": coverage, "pooledScores": {name: scores(test["targetNt"], pred) for name, pred in predictions.items()},
              "eventScores": {}, "limitations": [protocol["availabilityPolicy"], *protocol["limitations"]], "sourceManifests": manifests}
    for event_id in test.eventId.unique():
        mask = (test.eventId == event_id).to_numpy()
        result["eventScores"][event_id] = {name: scores(test.loc[test.eventId == event_id, "targetNt"], pred[mask]) for name, pred in predictions.items()}
    write_json(RESULTS / "learning_cases.json", dataset, compact=True)
    result["casesSha256"] = hashlib.sha256((RESULTS / "learning_cases.json").read_bytes()).hexdigest()
    write_json(RESULTS / "baseline_comparison.json", result)
    write_json(RESULTS / "model_parameters.json", {"protocolVersion": protocol["version"], "models": exported})
    write_json(RESULTS / "train_test_event_split.json", protocol)
    with (RESULTS / "baseline_comparison.csv").open("w", newline="", encoding="utf-8") as stream:
        writer = csv.DictWriter(stream, fieldnames=["model", "MAE_nT", "RMSE_nT", "bias_nT"])
        writer.writeheader()
        writer.writerows({"model": name, **score} for name, score in result["pooledScores"].items())
    # Public demo keeps the measured result, never fabricated fallback scores.
    write_json(ROOT / "demo" / "fixtures" / "learning-results.json", result)
    print(json.dumps({"trainingCases": len(train), "testCases": len(test), "scores": result["pooledScores"]}, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--offline", action="store_true", help="Refit and score the frozen genuine derived cases without network")
    run(parser.parse_args().offline)
