import json
import unittest

import numpy as np
import pandas as pd

from science.acquisition.sources import ROOT, normalize_omni, OMNI_FIELDS
from science.experiments.learn import FEATURES, check_operational_availability, make_cases, scores, validate_cases, validate_split


class LearningTests(unittest.TestCase):
    def test_omni_fill_values_do_not_become_training_numbers(self):
        payload = {"status": {"code": 1200}, "parameters": [{"name": "Time", "fill": None}] + [{"name": x, "fill": "9999.99"} for x in OMNI_FIELDS],
                   "data": [["2024-05-10T00:00:00Z", *([9999.99] * 6)]]}
        row = normalize_omni(payload)[0]
        self.assertTrue(all(row[x] is None for x in OMNI_FIELDS))
        self.assertIsNone(row["availableAtUtc"])

    def test_whole_events_and_embargo(self):
        events = [{"id": "a", "split": "train", "start": "2024-01-01T00:00:00Z", "end": "2024-01-02T00:00:00Z"},
                  {"id": "b", "split": "test", "start": "2024-01-02T12:00:00Z", "end": "2024-01-03T00:00:00Z"}]
        with self.assertRaises(ValueError):
            validate_split(events)
        events[1]["start"] = "2024-02-01T00:00:00Z"
        events[1]["end"] = "2024-02-02T00:00:00Z"
        validate_split(events)

    def test_unknown_or_late_availability_cannot_pass_operational_gate(self):
        self.assertFalse(check_operational_availability([{"availableAtUtc": None}], "2024-05-10T00:00:00Z"))
        self.assertFalse(check_operational_availability([{"availableAtUtc": "2024-05-11T00:00:00Z"}], "2024-05-10T00:00:00Z"))
        self.assertFalse(check_operational_availability([], "2024-05-10T00:00:00Z"))
        self.assertTrue(check_operational_availability([{"availableAtUtc": "2024-05-09T00:00:00Z"}], "2024-05-10T00:00:00Z"))

    def test_future_ground_changes_labels_not_past_features(self):
        event = {"id": "test-synthetic-mathematical-case", "split": "test", "start": "2024-05-10T00:00:00Z", "end": "2024-05-10T02:00:00Z"}
        gt = pd.date_range(event["start"], event["end"], freq="1min")
        ground = {"samples": [{"observedAtUtc": t.isoformat(), "value": 20000 + i} for i, t in enumerate(gt)]}
        sw = [{"observedAtUtc": t.isoformat(), "BX_GSE": 1, "BY_GSM": 2, "BZ_GSM": -3, "flow_speed": 400, "proton_density": 5, "Pressure": 2} for t in pd.date_range(event["start"], event["end"], freq="5min")]
        before, _ = make_cases(event, sw, ground)
        issue = pd.Timestamp(before[0]["issuedAtUtc"])
        for sample in ground["samples"]:
            if pd.Timestamp(sample["observedAtUtc"]) >= issue:
                sample["value"] += 1000
        after, _ = make_cases(event, sw, ground)
        self.assertEqual([before[0][f] for f in FEATURES], [after[0][f] for f in FEATURES])
        self.assertAlmostEqual(after[0]["targetNt"] - before[0]["targetNt"], 1000)
        self.assertLess(before[0]["latestInputObservedAtUtc"], before[0]["issuedAtUtc"])
        self.assertLess(before[0]["latestSolarWindBinStartUtc"], before[0]["issuedAtUtc"])

    def test_metrics_are_measured_and_can_report_a_loser(self):
        result = scores([1, 2, 3], [2, 3, 4])
        self.assertEqual(result, {"MAE_nT": 1.0, "RMSE_nT": 1.0, "bias_nT": 1.0})
        self.assertGreater(scores([1, 2], [5, 6])["MAE_nT"], result["MAE_nT"])

    def test_saved_run_has_no_event_overlap_or_operational_claim(self):
        result = json.loads((ROOT / "science/results/baseline_comparison.json").read_text())
        protocol = json.loads((ROOT / "science/experiments/learning_protocol.json").read_text())
        validate_split(protocol["events"])
        self.assertFalse(result["operationalClaim"])
        self.assertFalse(result["phoneContributionEvaluated"])
        self.assertGreater(result["trainingCases"], 0)
        self.assertGreater(result["testCases"], 0)
        self.assertEqual(set(result["pooledScores"]), set(protocol["models"]))

    def test_unknown_event_and_target_window_crossing_rejected(self):
        protocol = json.loads((ROOT / "science/experiments/learning_protocol.json").read_text())
        rows = json.loads((ROOT / "science/results/learning_cases.json").read_text())
        case = pd.DataFrame(rows[:1])
        validate_cases(case, protocol)
        invalid = case.copy()
        invalid.loc[0, "eventId"] = "unknown-storm"
        with self.assertRaises(ValueError):
            validate_cases(invalid, protocol)
        invalid = case.copy()
        invalid.loc[0, "issuedAtUtc"] = "2023-03-25T23:27:00Z"
        invalid.loc[0, "validAtUtc"] = "2023-03-25T23:57:00Z"
        with self.assertRaises(ValueError):
            validate_cases(invalid, protocol)

    def test_duplicate_cases_and_future_bin_rejected(self):
        protocol = json.loads((ROOT / "science/experiments/learning_protocol.json").read_text())
        rows = json.loads((ROOT / "science/results/learning_cases.json").read_text())
        case = pd.DataFrame(rows[:1])
        with self.assertRaises(ValueError):
            validate_cases(pd.concat([case, case]), protocol)
        case.loc[0, "latestSolarWindBinStartUtc"] = case.loc[0, "issuedAtUtc"]
        with self.assertRaises(ValueError):
            validate_cases(case, protocol)


if __name__ == "__main__":
    unittest.main()
