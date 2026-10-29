"""Generated inspection inputs only; these are not physical-phone observations."""
import unittest
from science.experiments.inspect_phone import summarize


class PhoneInspectionTests(unittest.TestCase):
    def generated(self):
        samples = [{"sensorTimestampSeconds": time, "receivedAtUtc": utc} for time, utc in [
            (100, "2026-10-28T12:00:00Z"), (100.1, "2026-10-28T12:00:00.100Z"),
            (100.8, "2026-10-28T12:00:00.800Z"), (101, "2026-10-28T12:00:01Z")]]
        raw = {"samples": samples, "utcAnchor": {"utc": "2026-10-28T12:00:00Z"}, "markers": [],
               "kind": "SYNTHETIC", "unit": "microT", "frame": "DEVICE", "device": {"model": "TEST_GENERATOR"},
               "stopReason": "TEST", "endedAtUtc": "2026-10-28T12:00:01.050Z"}
        qc = {"algorithmVersion": "TEST", "sampleResults": [{"magnitudeMicroT": 50, "usable": True, "flags": []} for _ in samples],
              "durationSeconds": 1, "actualHz": 3, "baselineMicroT": None, "noiseMadNt": None,
              "baselineCoverageSeconds": 0, "accepted": False, "usableCount": 4,
              "highWater": [{"observedCoverageSeconds": 0.3}], "regionalVerdict": "INCONCLUSIVE"}
        return raw, qc

    def test_generated_kind_survives_and_summary_does_not_assert_recomputation(self):
        raw, qc = self.generated()
        summary = summarize(raw, qc)
        self.assertEqual(summary["kind"], "SYNTHETIC")
        self.assertNotIn("recomputedQcExactlyMatched", summary)

    def test_gap_and_stop_timing_come_from_records_not_requested_rate(self):
        raw, qc = self.generated()
        summary = summarize(raw, qc)
        self.assertEqual(summary["intervalSeconds"]["gapsAboveHalfSecond"], 1)
        self.assertEqual(summary["intervalSeconds"]["nonIncreasing"], 0)
        self.assertAlmostEqual(summary["lastReceiptToStopMs"], 50, places=3)
        self.assertEqual(summary["windows"][0]["samples"], 4)

    def test_legacy_and_scheduled_markers_keep_their_distinct_provenance(self):
        raw, qc = self.generated()
        raw["markers"] = [{"kind": "BASELINE", "atUtc": raw["utcAnchor"]["utc"], "elapsedSeconds": 0},
                          {"kind": "INTERFERENCE_START", "atUtc": raw["utcAnchor"]["utc"],
                           "elapsedSeconds": 0, "origin": "SCHEDULED_CUE"}]
        summary = summarize(raw, qc)
        self.assertEqual(summary["markers"][0]["origin"], "LEGACY_UNKNOWN")
        self.assertEqual(summary["markers"][1]["origin"], "SCHEDULED_CUE")
        self.assertTrue(any("never proof" in line for line in summary["limitations"]))

    def test_raw_endpoint_summary_does_not_reclassify_rejected_data(self):
        raw, qc = self.generated()
        raw["samples"][-1]["sensorTimestampSeconds"] = 140
        qc["durationSeconds"] = 40
        qc["sampleResults"][-1]["magnitudeMicroT"] = 49
        for row in qc["sampleResults"]:
            row["usable"] = False
            row["flags"] = ["NOISY_BASELINE"]
        summary = summarize(raw, qc)
        self.assertEqual(summary["descriptiveDrift"]["lastMinusFirstNt"], -1000)
        self.assertFalse(summary["descriptiveDrift"]["qualityScreened"])
        self.assertFalse(summary["accepted"])


if __name__ == "__main__":
    unittest.main()
