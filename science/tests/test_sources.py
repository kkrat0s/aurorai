import copy
import io
import json
import math
import unittest
import zipfile

from science.acquisition.sources import ROOT, finite, normalize_cme, normalize_omni, normalize_ovation, normalize_solar_wind, normalize_usgs, utc
from science.experiments.inspect_broomfield import safe_members


class SourceTests(unittest.TestCase):
    def test_nonfinite_sentinels_and_booleans(self):
        for v in (None, float("nan"), float("inf"), -float("inf"), 9999.99):
            self.assertIsNone(finite(v, fill="9999.99"))
        self.assertEqual(finite(-60.2), -60.2)
        with self.assertRaises(ValueError):
            finite(True)

    def test_timestamps_require_timezone_except_documented_provider(self):
        with self.assertRaises(ValueError):
            utc("2024-05-10T12:00:00")
        self.assertEqual(utc("2024-05-10T12:00:00", provider_naive_utc=True), "2024-05-10T12:00:00Z")
        self.assertEqual(utc("2024-05-10T08:00:00-04:00"), "2024-05-10T12:00:00Z")

    def test_cme_excludes_retrospective_aggregate_and_late_submissions(self):
        data = [{"cmeID": "test-event", "arrivalTime": "2024-05-10T16:36Z", "predictions": [
            {"predictedMethodName": "Model A", "submissionTime": "2024-05-08T16:00Z", "predictedArrivalTime": "2024-05-10T20:00Z"},
            {"predictedMethodName": "Average of all Methods", "submissionTime": "2025-01-07T20:56Z", "predictedArrivalTime": "2024-05-10T20:00Z"},
            {"predictedMethodName": "Model B", "submissionTime": "2024-05-10T18:00Z", "predictedArrivalTime": "2024-05-10T20:00Z"},
        ]}]
        result, excluded = normalize_cme(data)
        self.assertEqual(len(result), 1)
        self.assertEqual(len(excluded), 2)
        self.assertIsNone(result[0]["observedArrivalAvailableAtUtc"])

    def test_cme_preserves_revisions(self):
        event = {"cmeID": "test-event", "arrivalTime": None, "predictions": [
            {"predictedMethodName": "A", "submissionTime": "2024-05-08T16:00Z", "predictedArrivalTime": "2024-05-10T20:00Z"},
            {"predictedMethodName": "A", "submissionTime": "2024-05-09T16:00Z", "predictedArrivalTime": "2024-05-10T21:00Z"}]}
        rows, excluded = normalize_cme([event])
        self.assertEqual(len(rows), 2)
        self.assertNotEqual(rows[0]["id"], rows[1]["id"])
        self.assertEqual(excluded, [])

    def test_usgs_preserves_missing_and_rejects_mismatched_arrays(self):
        data = {"type": "Timeseries", "metadata": {"status": 200, "intermagnet": {"reported_orientation": "XYZF", "imo": {"iaga_code": "BOU"}, "sampling_period": 60, "data_type": "adjusted"}},
                "times": ["2024-05-10T00:00:00Z", "2024-05-10T00:01:00Z"], "values": [{"id": "X", "values": [20000, None]}]}
        manifest = {"sourceUrl": "https://example.test", "retrievedAtUtc": "2026-10-28T00:00:00Z", "sha256": "test"}
        rows = normalize_usgs(data, manifest)
        self.assertIsNone(rows[0]["samples"][1]["value"])
        self.assertIsNone(rows[0]["availableAtUtc"])
        self.assertEqual(rows[0]["frame"], "GEO")
        data["values"][0]["values"].pop()
        with self.assertRaises(ValueError):
            normalize_usgs(data, manifest)

    def test_ovation_never_changes_valid_time_for_replay(self):
        data = {"Data Format": "[Longitude, Latitude, Aurora]", "Observation Time": "2026-10-28T15:00:00Z", "Forecast Time": "2026-10-28T16:00:00Z", "coordinates": [[0, 60, 40], [2, 62, 50]]}
        manifest = {"sourceUrl": "https://example.test", "retrievedAtUtc": "2026-10-28T15:30:00Z", "sha256": "test"}
        frame = normalize_ovation(data, manifest)
        self.assertEqual(frame["validAtUtc"], "2026-10-28T16:00:00Z")
        self.assertIsNone(frame["issuedAtUtc"])
        data["coordinates"].append([2, 64, 101])
        with self.assertRaises(ValueError):
            normalize_ovation(data, manifest)

    def test_rtsw_active_source_identity_quality_and_missing_join(self):
        rows = [{"active": True, "overall_quality": 0, "time_tag": "2026-10-28T15:00:00", "source": "CURRENT_PROVIDER", "bz_gsm": -5},
                {"active": False, "overall_quality": 0, "time_tag": "2026-10-28T15:00:00", "source": "OTHER", "bz_gsm": 20},
                {"active": True, "overall_quality": 1, "time_tag": "2026-10-28T15:01:00", "source": "CURRENT_PROVIDER", "bz_gsm": -30}]
        result = normalize_solar_wind(rows, [], {"retrievedAtUtc": "2026-10-28T15:02:00Z"})
        self.assertEqual(len(result["samples"]), 1)
        self.assertEqual(result["samples"][0]["bzNt"], -5)
        self.assertEqual(result["samples"][0]["magneticSource"], "CURRENT_PROVIDER")
        self.assertIsNone(result["samples"][0]["speedKmS"])

    def test_fixture_real_issuances_precede_outcome_and_no_phantom_measurements(self):
        fixture = json.loads((ROOT / "demo/fixtures/verified-sources.json").read_text())
        self.assertGreaterEqual(len({r["method"] for r in fixture["cmeForecasts"]}), 2)
        for row in fixture["cmeForecasts"]:
            self.assertLess(row["issuedAtUtc"], row["observedArrivalUtc"])
            self.assertFalse(row["method"].startswith(("Average", "Median")))
        self.assertTrue(all(r["kind"] == "MEASURED_ARCHIVAL" for r in fixture["referenceSeries"]))
        self.assertLess(fixture["referenceSeries"][0]["samples"][-1]["observedAtUtc"], fixture["latestNoaa"]["ovation"]["validAtUtc"])

    def test_zip_path_traversal_and_size_are_rejected(self):
        for name in ("../outside.csv", "C:/outside.csv", "/outside.csv", "..\\outside.csv"):
            stream = io.BytesIO()
            with zipfile.ZipFile(stream, "w") as archive:
                archive.writestr(name, "test")
            with zipfile.ZipFile(stream) as archive, self.assertRaises(ValueError):
                safe_members(archive)
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, "w") as archive:
            archive.writestr("safe.csv", "123456789")
        with zipfile.ZipFile(stream) as archive, self.assertRaises(ValueError):
            safe_members(archive, max_uncompressed=2)


if __name__ == "__main__":
    unittest.main()
