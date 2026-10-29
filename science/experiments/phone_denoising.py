"""Bounded, private GP filtering experiment; outputs are research, not corrected truth."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
from typing import Callable
import warnings

import numpy as np
import scipy
import sklearn
from scipy.linalg import cho_solve
from scipy.ndimage import median_filter
from scipy.optimize import minimize
from scipy.signal import detrend
from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, Matern, WhiteKernel
from threadpoolctl import threadpool_limits

from science.experiments.inspect_phone import PRIVATE, ROOT, recompute, seconds

PROTOCOL_PATH = Path(__file__).with_name("phone_denoising_protocol.json")


def phone_bins(raw: dict, protocol: dict) -> tuple[np.ndarray, np.ndarray]:
    if raw.get("frame") != "DEVICE" or raw.get("unit") != "microT":
        raise ValueError("Device-frame microtesla samples required.")
    rows = raw["samples"]
    time = np.array([row["sensorTimestampSeconds"] for row in rows], dtype=float)
    values = np.array([[row[axis] for axis in ("x", "y", "z")] for row in rows], dtype=float)
    if len(time) < 2 or not np.all(np.isfinite(time)) or not np.all(np.isfinite(values)) or np.any(np.diff(time) <= 0):
        raise ValueError("Finite values and strictly increasing sensor timestamps required.")
    time -= time[0]
    n = protocol["durationSeconds"]
    if time[-1] < n:
        raise ValueError("The fixed 600-second protocol requires a complete recording.")
    bins = np.floor(time).astype(int)
    magnitude_nt = np.linalg.norm(values, axis=1) * 1000
    result = []
    for index in range(n):
        selected = magnitude_nt[bins == index]
        if len(selected) < protocol["minimumSamplesPerBin"]:
            raise ValueError("Missing/undersampled one-second bin; this experiment never fills gaps.")
        result.append(float(np.median(selected)))
    return np.arange(n, dtype=float), np.array(result)


@dataclass
class FrozenGp:
    weights: np.ndarray
    training_indices: np.ndarray
    center: float
    scale: float
    metadata: dict

    def smooth(self, values: np.ndarray) -> np.ndarray:
        normalized = (values[self.training_indices] - self.center) / self.scale
        return self.center + self.weights @ normalized * self.scale


def fit_gp(time: np.ndarray, values: np.ndarray, protocol: dict) -> FrozenGp:
    if time.shape != values.shape or not np.all(np.isfinite(values)):
        raise ValueError("Finite equally sized one-dimensional training values required.")
    parameters = protocol["kernel"]
    indices = np.arange(0, len(time), protocol["trainingStrideSeconds"])
    center = float(np.mean(values))
    scale = max(float(np.std(values)), 1.0)
    kernel = (ConstantKernel(parameters["signalInitial"], parameters["signalBounds"])
              * Matern(parameters["lengthScaleInitialSeconds"], parameters["lengthScaleBoundsSeconds"], nu=1.5)
              + WhiteKernel(parameters["noiseInitial"], parameters["noiseBounds"]))
    optimizer_results = []

    def optimizer(objective, initial_theta, bounds):
        result = minimize(objective, initial_theta, method="L-BFGS-B", jac=True, bounds=bounds,
                          options={"maxiter": parameters["optimizerMaxIterations"]})
        optimizer_results.append({"success": bool(result.success), "iterations": int(result.nit), "message": str(result.message)})
        return result.x, result.fun

    model = GaussianProcessRegressor(kernel=kernel, alpha=parameters["alpha"], optimizer=optimizer,
                                    n_restarts_optimizer=parameters["optimizerRestarts"], normalize_y=False,
                                    random_state=protocol["seed"])
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        model.fit(time[indices, None], (values[indices] - center) / scale)
    # Freeze normalization, learned kernel and linear response BEFORE injections.
    cross_kernel = model.kernel_.k1(time[:, None], time[indices, None])
    weights = cross_kernel @ cho_solve((model.L_, True), np.eye(len(indices)))
    return FrozenGp(weights, indices, center, scale, {
        "class": "sklearn.gaussian_process.GaussianProcessRegressor", "kernel": str(model.kernel_),
        "learnedLengthScaleSeconds": float(model.kernel_.k1.k2.length_scale),
        "kernelLogTheta": model.kernel_.theta.tolist(),
        "learnedNormalizedWhiteVariance": float(model.kernel_.k2.noise_level),
        "trainingPoints": len(indices), "centerNt": center, "scaleNt": scale,
        "logMarginalLikelihood": float(model.log_marginal_likelihood_value_),
        "optimizerRuns": optimizer_results, "warnings": [str(warning.message) for warning in caught],
        "cleanTargetAvailable": False, "causalSourceIdentified": False,
        "modelUncertaintyIsNotPhysicalCalibration": True,
    })


def operators(gp: FrozenGp, protocol: dict) -> dict[str, Callable[[np.ndarray], np.ndarray]]:
    def median(values):
        size = (protocol["medianBaselineWindowSeconds"],) + (1,) * (values.ndim - 1)
        return median_filter(values, size=size, mode="reflect")
    return {
        "raw_1s_median": lambda values: values.copy(),
        "median_15s": median,
        "linear_detrended": lambda values: detrend(values, axis=0, type="linear"),
        "gp_smooth": gp.smooth,
        "gp_detrended": lambda values: values - gp.smooth(values),
    }


def observatory_injections(catalog: dict, protocol: dict) -> tuple[np.ndarray, list[str], dict]:
    config = protocol["injections"]
    reference = next(series for series in catalog["referenceSeries"]
                     if series["component"] == config["component"] and series["stationId"] == config["stationId"])
    if reference["unit"] != "nT" or reference["cadenceSeconds"] != 60:
        raise ValueError("Minute scalar F in nT required; components/units cannot be substituted.")
    rows = reference["samples"]
    signals = []; ids = []; excluded = 0
    for start in range(0, len(rows) - 10, 10):
        window = rows[start:start + 11]
        if (any(row["value"] is None or not np.isfinite(row["value"]) for row in window)
                or any(abs(seconds(b["observedAtUtc"]) - seconds(a["observedAtUtc"]) - 60) > 0.001
                       for a, b in zip(window, window[1:]))):
            excluded += 1
            continue
        signal = np.interp(np.arange(protocol["durationSeconds"]), np.arange(11) * 60,
                           [row["value"] for row in window])
        signal -= np.mean(signal)
        signals.append(signal)
        ids.append(window[0]["observedAtUtc"])
    if not signals:
        raise ValueError("No complete professional-reference blocks.")
    source = {key: value for key, value in reference.items() if key != "samples"}
    source.update({"kindOfExperiment": config["kind"], "completeBlocks": len(signals), "excludedBlocks": excluded,
                   "phoneAndObservatoryAreNotSimultaneous": True, "amplitudeScaling": 1.0,
                   "interpolatedSecondsAreNotIndependentMeasurements": True})
    return np.column_stack(signals), ids, source


def preservation_metrics(truth: np.ndarray, recovered: np.ndarray) -> dict:
    if truth.shape != recovered.shape:
        raise ValueError("Truth and response shapes must match.")
    expected = truth - truth.mean(axis=0)
    actual = recovered - recovered.mean(axis=0)
    energy = np.sum(expected ** 2, axis=0)
    variable = energy > 1e-12  # Numerical degeneracy only; no amplitude-based case selection.
    if not np.any(variable):
        raise ValueError("No varying injection blocks.")
    gain = np.sum(expected[:, variable] * actual[:, variable], axis=0) / energy[variable]
    error = np.sqrt(np.mean((actual[:, variable] - expected[:, variable]) ** 2, axis=0))
    normalized = error / np.sqrt(np.mean(expected[:, variable] ** 2, axis=0))
    return {"variableBlocks": int(np.sum(variable)), "constantBlocks": int(np.sum(~variable)),
            "medianGain": float(np.median(gain)), "p05Gain": float(np.quantile(gain, 0.05)), "p95Gain": float(np.quantile(gain, 0.95)),
            "medianShapeRmseNt": float(np.median(error)), "medianNormalizedShapeRmse": float(np.median(normalized)),
            "gainDefinition": "Centered least-squares amplitude response; one is retained, zero is removed; negative is inverted.",
            "interpretation": "Synthetic differential response only; not total denoising error or real detection skill."}


def roughness(values: np.ndarray) -> float:
    increments = np.diff(values)
    return float(np.median(np.abs(increments - np.median(increments))))


def make_plots(time, values, curves, signal, responses, metrics, output):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    from matplotlib.ticker import PercentFormatter
    center = float(np.median(values))
    fig, axes = plt.subplots(3, 1, figsize=(11, 9), layout="constrained")
    axes[0].plot(time, values - center, color="#b3b3b3", linewidth=0.8, label="Measured phone · 1 s medians")
    axes[0].plot(time, curves["median_15s"] - center, color="#16806a", linewidth=1, label="15 s median baseline")
    axes[0].plot(time, curves["gp_smooth"] - center, color="#8055bf", linewidth=1.2, label="Learned GP smooth component")
    axes[0].set_ylabel("Centered raw |B| (nT)")
    axes[0].legend(fontsize=8)
    axes[1].plot(time, curves["gp_detrended"], color="#ad6c11", linewidth=0.9)
    axes[1].set_ylabel("GP-subtracted residual (nT)")
    axes[1].set_xlabel("Phone elapsed seconds · retrospective whole-record fit")
    axes[1].set_title("Exploratory residual: flatter does not establish a recovered geomagnetic signal", fontsize=10)
    names = list(metrics)
    gains = [metrics[name]["medianGain"] for name in names]
    axes[2].barh(names, gains, color=["#999999", "#16806a", "#557cba", "#8055bf", "#ad6c11"])
    for index, gain in enumerate(gains):
        axes[2].text(gain + 0.01, index, f"{gain * 100:.2f}%", va="center", fontsize=9)
    axes[2].axvline(1, color="#777777", linestyle="--")
    axes[2].set_xlim(min(-0.1, min(gains) - 0.1), max(1.2, max(gains) + 0.1))
    axes[2].xaxis.set_major_formatter(PercentFormatter(1))
    axes[2].set_xlabel("Median retained injection amplitude across all complete BOU blocks (100% = retained)")
    axes[2].set_title("SYNTHETIC INJECTION of real May 2024 USGS BOU F shapes into the 2026 phone series", fontsize=10)
    for axis in axes:
        axis.grid(alpha=0.18)
    fig.suptitle("AI-assisted phone exploration · Gaussian-process regression\nNo QC rejection in this view; raw data retained; no validated correction or regional verdict", fontsize=12)
    fig.savefig(output / "overview.png", dpi=160)
    plt.close(fig)
    fig, axis = plt.subplots(figsize=(11, 4), layout="constrained")
    axis.plot(time, signal, color="black", linewidth=1.5, label="Known injected BOU F perturbation")
    for method in ["median_15s", "gp_smooth", "gp_detrended"]:
        response = responses[method] - np.mean(responses[method])
        axis.plot(time, response, label=method, linewidth=1)
    axis.set_xlabel("Relative seconds · historical example shape inserted into phone data")
    axis.set_ylabel("Differential injection response (nT)")
    axis.set_title("SYNTHETIC INJECTION · BOU F May 10, 2024 16:30 UTC shape\nFilter output with injection minus output without injection; no simultaneous phone observation", fontsize=11)
    axis.legend(fontsize=8); axis.grid(alpha=0.2)
    fig.savefig(output / "injection-example.png", dpi=160)
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw", type=Path)
    parser.add_argument("qc", type=Path)
    parser.add_argument("--output", type=Path, default=PRIVATE / "phone-ai-exploration")
    parser.add_argument("--plot", action="store_true")
    args = parser.parse_args()
    output = args.output.resolve()
    if not output.is_relative_to(PRIVATE.resolve()):
        parser.error("Outputs must remain under ignored data/private.")
    protocol = json.loads(PROTOCOL_PATH.read_text())
    if args.raw.stat().st_size > 8_000_000 or args.qc.stat().st_size > 8_000_000:
        parser.error("Input exceeds 8 MB.")
    raw_hash = hashlib.sha256(args.raw.read_bytes()).hexdigest()
    if raw_hash != protocol["phoneRawSha256"]:
        parser.error("Frozen exploration is tied to the specified stationary session; version a new protocol for another record.")
    qc = recompute(args.raw.resolve(), args.qc.resolve())
    raw = json.loads(args.raw.read_text())
    catalog_path = ROOT / "demo/fixtures/verified-sources.json"
    catalog = json.loads(catalog_path.read_text())
    time, values = phone_bins(raw, protocol)
    with threadpool_limits(limits=1):
        gp = fit_gp(time, values, protocol)
        filters = operators(gp, protocol)
        curves = {name: function(values) for name, function in filters.items()}
        signals, case_ids, reference = observatory_injections(catalog, protocol)
        metrics = {}; example_responses = {}
        example_index = case_ids.index(protocol["injections"]["exampleStartUtc"])
        for name, function in filters.items():
            response = function(values[:, None] + signals) - curves[name][:, None]
            metrics[name] = preservation_metrics(signals, response)
            example_responses[name] = response[:, example_index]
    result = {
        "version": protocol["version"], "mode": "EXPLORATORY_OFFLINE_ML", "modelApiCalled": False,
        "processedAtUtc": datetime.now(timezone.utc).isoformat(),
        "software": {"numpy": np.__version__, "scipy": scipy.__version__, "scikitLearn": sklearn.__version__},
        "usesAllFiniteSamplesRegardlessOfQcThresholds": True, "originalQcChanged": False,
        "originalQc": {"algorithmVersion": qc["algorithmVersion"], "accepted": qc["accepted"], "regionalVerdict": qc["regionalVerdict"]},
        "source": {"kind": raw["kind"], "sensorUnit": "microT", "analysisUnit": "nT", "frame": "DEVICE",
                   "observedStartUtc": raw["utcAnchor"]["utc"], "observedEndUtc": qc["sampleResults"][-1]["observedAtUtc"],
                   "availableAtUtc": None, "calibration": raw["device"]["calibration"],
                   "rawSamples": len(raw["samples"]), "completeOneSecondBins": len(values),
                   "incompleteTerminalSamplesNotBinned": sum(row["sensorTimestampSeconds"] - raw["samples"][0]["sensorTimestampSeconds"] >= 600 for row in raw["samples"]),
                   "rawSha256": raw_hash, "qcSha256": hashlib.sha256(args.qc.read_bytes()).hexdigest()},
        "protocolSha256": hashlib.sha256(PROTOCOL_PATH.read_bytes()).hexdigest(),
        "catalogSha256": hashlib.sha256(catalog_path.read_bytes()).hexdigest(), "protocol": protocol,
        "model": gp.metadata, "reference": reference, "caseIds": case_ids,
        "descriptiveRoughnessNt": {name: roughness(curve) for name, curve in curves.items()},
        "rawEndpointChangeNt": float(np.median(values[-30:]) - np.median(values[:30])),
        "residualEndpointChangeNt": float(np.median(curves["gp_detrended"][-30:]) - np.median(curves["gp_detrended"][:30])),
        "syntheticInjectionPreservation": metrics, "validatedGeomagneticCorrection": False,
        "limitations": protocol["limitations"],
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / "results.json").write_text(json.dumps(result, indent=2, allow_nan=False) + "\n")
    matrix = np.column_stack([time, values, *[curves[name] for name in curves]])
    np.savetxt(output / "curves.csv", matrix, delimiter=",", header="elapsed_s,raw_magnitude_nt," + ",".join(curves), comments="")
    if args.plot:
        make_plots(time, values, curves, signals[:, example_index], example_responses, metrics, output)
    print(json.dumps({"output": str(output), "model": gp.metadata, "roughnessNt": result["descriptiveRoughnessNt"],
                      "syntheticInjectionPreservation": metrics, "validatedGeomagneticCorrection": False}, indent=2))


if __name__ == "__main__":
    main()
