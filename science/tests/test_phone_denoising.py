"""Synthetic software tests; never physical-phone validation or denoising scores."""
import copy
import json
import unittest

import numpy as np

from science.experiments.phone_denoising import (PROTOCOL_PATH, fit_gp, observatory_injections,
                                                  operators, phone_bins, preservation_metrics)


class PhoneDenoisingTests(unittest.TestCase):
    def protocol(self):
        return json.loads(PROTOCOL_PATH.read_text())

    def test_binning_keeps_finite_samples_without_a_qc_acceptance_gate(self):
        protocol = self.protocol(); protocol["durationSeconds"] = 2
        raw = {"frame": "DEVICE", "unit": "microT", "samples": [
            {"sensorTimestampSeconds": index / 10, "x": 30, "y": 0, "z": 40}
            for index in range(21)]}
        time, values = phone_bins(raw, protocol)
        np.testing.assert_allclose(time, [0, 1])
        np.testing.assert_allclose(values, [50000, 50000])
        raw["samples"] = raw["samples"][:3] + raw["samples"][10:]
        with self.assertRaisesRegex(ValueError, "undersampled"):
            phone_bins(raw, protocol)

    def test_bad_time_units_or_values_cannot_be_repaired_by_ai(self):
        protocol = self.protocol(); protocol["durationSeconds"] = 2
        original = {"frame": "DEVICE", "unit": "microT", "samples": [
            {"sensorTimestampSeconds": index / 10, "x": 30, "y": 0, "z": 40} for index in range(21)]}
        for change in ("time", "unit", "value"):
            raw = copy.deepcopy(original)
            if change == "time": raw["samples"][2]["sensorTimestampSeconds"] = 0
            elif change == "unit": raw["unit"] = "nT"
            else: raw["samples"][2]["x"] = float("nan")
            with self.assertRaises(ValueError): phone_bins(raw, protocol)

    def test_raw_reference_preserves_injection_exactly_and_reports_degeneracy(self):
        signal = np.column_stack([np.sin(np.arange(100) / 10), np.zeros(100)])
        result = preservation_metrics(signal, signal.copy())
        self.assertAlmostEqual(result["medianGain"], 1)
        self.assertEqual(result["medianShapeRmseNt"], 0)
        self.assertEqual(result["constantBlocks"], 1)
        self.assertEqual(result["variableBlocks"], 1)
        with self.assertRaises(ValueError): preservation_metrics(signal, signal[:1])

    def test_removing_signal_scores_zero_retention_and_complete_shape_loss(self):
        signal = np.sin(np.arange(100)[:, None] / 10)
        result = preservation_metrics(signal, np.zeros_like(signal))
        self.assertAlmostEqual(result["medianGain"], 0)
        self.assertAlmostEqual(result["medianNormalizedShapeRmse"], 1)

    def test_frozen_gp_response_and_residual_are_complementary_without_refitting(self):
        protocol = self.protocol()
        time = np.arange(60, dtype=float)
        values = 1000 + np.sin(time / 8) * 100 + np.cos(time) * 3
        gp = fit_gp(time, values, protocol)
        weights = gp.weights.copy()
        methods = operators(gp, protocol)
        signal = np.sin(time / 11) * 20
        smooth_response = methods["gp_smooth"](values + signal) - methods["gp_smooth"](values)
        residual_response = methods["gp_detrended"](values + signal) - methods["gp_detrended"](values)
        np.testing.assert_allclose(smooth_response + residual_response, signal, atol=1e-9)
        np.testing.assert_allclose(smooth_response, weights @ signal[gp.training_indices], atol=1e-9)
        np.testing.assert_array_equal(gp.weights, weights)
        self.assertFalse(gp.metadata["cleanTargetAvailable"])
        self.assertFalse(gp.metadata["causalSourceIdentified"])

    def test_multicolumn_filters_do_not_mix_independent_injection_cases(self):
        protocol = self.protocol()
        time = np.arange(60, dtype=float); values = time * 10 + np.sin(time)
        gp = fit_gp(time, values, protocol)
        matrix = np.column_stack([values, values + np.cos(time) * 50])
        for function in operators(gp, protocol).values():
            np.testing.assert_allclose(function(matrix)[:, 0], function(values), atol=1e-8)

    def test_reference_requires_correct_component_units_and_complete_minute_records(self):
        from datetime import datetime, timedelta, timezone
        start = datetime(2024, 5, 10, tzinfo=timezone.utc)
        rows = [{"observedAtUtc": (start + timedelta(minutes=index)).isoformat(), "value": 50000 + index}
                for index in range(21)]
        reference = {"stationId": "BOU", "component": "F", "unit": "nT", "cadenceSeconds": 60, "samples": rows}
        rows[5]["value"] = None
        signals, ids, source = observatory_injections({"referenceSeries": [reference]}, self.protocol())
        self.assertEqual(signals.shape, (600, 1))
        self.assertEqual(len(ids), 1)
        self.assertEqual(source["excludedBlocks"], 1)
        self.assertTrue(source["phoneAndObservatoryAreNotSimultaneous"])
        self.assertEqual(source["amplitudeScaling"], 1)
        reference["unit"] = "microT"
        with self.assertRaises(ValueError): observatory_injections({"referenceSeries": [reference]}, self.protocol())


if __name__ == "__main__":
    unittest.main()
