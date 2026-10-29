"""Validate PH-01 without extracting ZIP members or publishing locations.

Run python -m science.experiments.inspect_broomfield. Public output contains
only aggregate coverage, device-model categories and audit checksums. The
download and per-file private information remain in ignored data/raw.
"""
from __future__ import annotations

import collections
import csv
import hashlib
import io
import json
import math
import re
import statistics
import zipfile
from datetime import datetime, timezone
from pathlib import PurePosixPath

from science.acquisition.sources import RAW, RESULTS, ROOT, fetch, fetch_json, normalize_usgs, utc_now, write_json

RECORD_URL = "https://zenodo.org/api/records/18928938"
EXPECTED_MD5 = "3bf46fe2e8893a671eabdc47ee08c1cd"
EXPECTED_HEADERS = ["Time (UTC)", "Latitude (deg)", "Longitude (deg)", "Total Field (nT)", "Horizontal Component (nT)", "Vertical Component (nT)"]


def safe_members(archive, max_uncompressed=300_000_000):
    members = archive.infolist()
    if len(members) > 3000 or sum(i.file_size for i in members) > max_uncompressed:
        raise ValueError("ZIP exceeds bounded file-count/uncompressed-size limits")
    for member in members:
        path = PurePosixPath(member.filename.replace("\\", "/"))
        if path.is_absolute() or ".." in path.parts or ":" in member.filename:
            raise ValueError("Unsafe ZIP member path")
        if member.flag_bits & 1:
            raise ValueError("Encrypted archive cannot be inspected")
        if member.file_size > 30_000_000 or member.file_size / max(1, member.compress_size) > 300:
            raise ValueError("ZIP member exceeds size/expansion limit")
        if ((member.external_attr >> 16) & 0o170000) == 0o120000:
            raise ValueError("Symlink ZIP members are not accepted")
    return members


def inspect():
    metadata, meta_manifest = fetch_json(RECORD_URL, "broomfield-record.json")
    files = metadata["files"]
    if len(files) != 1 or files[0]["checksum"] != "md5:" + EXPECTED_MD5:
        raise ValueError("Zenodo archive identity/checksum changed; manual review required")
    file = files[0]
    raw, manifest = fetch(file["links"]["self"], "broomfield.zip", max_bytes=35_000_000)
    md5 = hashlib.md5(raw).hexdigest()
    if len(raw) != file["size"] or md5 != EXPECTED_MD5:
        raise ValueError("Downloaded archive does not match Zenodo size/checksum")
    archive = zipfile.ZipFile(io.BytesIO(raw))
    members = safe_members(archive)
    monthly, daily, devices, intervals, schemas = (collections.Counter() for _ in range(5))
    csv_count = rows = invalid_time = invalid_field = non_monotonic = equal_time = reversed_time = exact_duplicates = moving_files = 0
    first = last = None
    hashes, overlap_minutes = set(), set()
    may_rows = 0
    per_file, invalid_files, overlaps = [], [], []
    begin, end = datetime(2024, 5, 10, tzinfo=timezone.utc), datetime(2024, 5, 13, tzinfo=timezone.utc)
    for info in members:
        if info.is_dir() or not info.filename.lower().endswith(".csv"):
            continue
        csv_count += 1
        body = archive.read(info)  # CRC checked by zipfile; no filesystem extraction.
        digest = hashlib.sha256(body).hexdigest()
        if digest in hashes:
            exact_duplicates += 1
            continue
        hashes.add(digest)
        try:
            decoded = body.decode("utf-8-sig", errors="strict")
        except UnicodeDecodeError as error:
            invalid_files.append({"sha256": digest, "reason": "Invalid UTF-8 CSV encoding", "byteOffset": error.start})
            continue
        reader = csv.reader(io.StringIO(decoded))
        header = [s.strip() for s in next(reader)]
        schemas[tuple(header)] += 1
        if header != EXPECTED_HEADERS:
            invalid_files.append({"sha256": digest, "reason": "Unexpected CSV schema"})
            continue
        match = re.search(r"(iPhone\d+,\d+|iPad\d+,\d+)", info.filename)
        model = match.group(1) if match else "unknown"
        devices[model] += 1
        previous = None
        count = 0
        overlap = collections.defaultdict(list)
        min_lat = min_lon = float("inf")
        max_lat = max_lon = -float("inf")
        for row in reader:
            if not row:
                continue
            count += 1
            rows += 1
            if len(row) != len(header):
                invalid_field += 1
                continue
            try:
                # Header explicitly says UTC; filenames contain export dates, NOT observation dates.
                stamp = datetime.strptime(row[0], "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
            except ValueError:
                invalid_time += 1
                continue
            first = min(first, stamp) if first else stamp
            last = max(last, stamp) if last else stamp
            monthly[stamp.strftime("%Y-%m")] += 1
            daily[stamp.strftime("%Y-%m-%d")] += 1
            if previous is not None:
                delta = (stamp - previous).total_seconds()
                if delta <= 0:
                    non_monotonic += 1
                    equal_time += delta == 0
                    reversed_time += delta < 0
                else:
                    intervals[int(delta)] += 1
            previous = stamp
            try:
                lat, lon, total, horizontal, vertical = map(float, row[1:])
                if not all(math.isfinite(v) for v in (lat, lon, total, horizontal, vertical)) or not -90 <= lat <= 90 or not -180 <= lon <= 180:
                    raise ValueError()
                if total < 0 or total >= 1_000_000 or abs(horizontal) >= 1_000_000 or abs(vertical) >= 1_000_000:
                    raise ValueError()
                min_lat, max_lat = min(min_lat, lat), max(max_lat, lat)
                min_lon, max_lon = min(min_lon, lon), max(max_lon, lon)
            except ValueError:
                invalid_field += 1
                continue
            if begin <= stamp < end:
                may_rows += 1
                minute = stamp.replace(second=0).isoformat().replace("+00:00", "Z")
                overlap_minutes.add(minute)
                overlap[minute].append(total)
        # Aggregate evidence of movement only; no precise coordinates leave this process.
        span_km = math.hypot((max_lat - min_lat) * 111, (max_lon - min_lon) * 85) if count and math.isfinite(min_lat) else None
        if span_km is not None and span_km > 1:
            moving_files += 1
        per_file.append({"sha256": digest, "rows": count, "deviceModel": model})
        if overlap:
            overlaps.append({"sourceFileSha256": digest, "deviceModel": model, "minuteMediansNt": {t: statistics.median(values) for t, values in overlap.items()},
                             "geographicSpanClass": "over_1km" if span_km is not None and span_km > 1 else "at_most_1km_or_unknown"})
    sample_intervals = sorted(intervals.items())
    total_intervals = sum(intervals.values())
    halfway = total_intervals / 2
    cumulative, median_interval = 0, None
    for interval, n in sample_intervals:
        cumulative += n
        if cumulative >= halfway:
            median_interval = interval
            break
    reasons = ["No stable physical-device identifier: filename model strings are device models, not verified independent devices.",
               "No accelerometer, calibration/accuracy or stationary-observation metadata; usable stationary minutes cannot be established.",
               "CrowdMag exports contain geographic positions; no raw coordinates or filenames are redistributed.",
               "Magnitude and horizontal/vertical components are exported, not raw device-frame x/y/z."]
    if may_rows == 0:
        reasons.append("No valid observations overlap May 10–13 2024; cannot compare this archive with the selected May 2024 BOU storm.")
    else:
        reasons.append("Timestamp overlap alone does not validate stationary phone-storm evidence; local movement/interference and physical device identity remain unresolved.")
    report = {"sourceId": "PH-01", "recordUrl": "https://zenodo.org/records/18928938", "inspectedAtUtc": utc_now(),
              "status": "NO_GO_FOR_VALIDATED_HISTORICAL_PHONE_STORM_CLAIM", "checksumVerified": True, "md5": md5,
              "sha256": manifest["sha256"], "bytes": len(raw), "archiveMembers": len(members),
              "uncompressedBytes": sum(i.file_size for i in members), "csvFiles": csv_count,
              "exactDuplicateCsvFilesSkipped": exact_duplicates, "uniqueCsvFiles": len(hashes), "parsedRows": rows,
              "invalidFiles": invalid_files, "invalidFileCount": len(invalid_files),
              "headers": EXPECTED_HEADERS, "fieldUnits": "nT", "timeBasis": "Time (UTC) column; second-resolution timestamps",
              "firstObservedAtUtc": first.isoformat().replace("+00:00", "Z") if first else None,
              "lastObservedAtUtc": last.isoformat().replace("+00:00", "Z") if last else None,
              "monthlyRows": dict(sorted(monthly.items())), "dailyRows": dict(sorted(daily.items())),
              "deviceModelFileCounts": dict(devices), "distinctPhysicalDevices": None, "independentSites": None,
              "medianPositiveWithinFileCadenceSeconds": median_interval, "mostCommonPositiveCadencesSeconds": intervals.most_common(10),
              "invalidTimestampRows": invalid_time, "invalidFieldRows": invalid_field, "nonIncreasingTimestampPairs": non_monotonic,
              "equalTimestampPairs": equal_time, "reversedTimestampPairs": reversed_time,
              "filesWithCoordinateSpanOver1km": moving_files, "usableStationaryMinutes": None,
              "may2024Overlap": "YES" if may_rows else "NO", "may2024Rows": may_rows,
              "may2024UniqueMinutes": len(overlap_minutes), "license": metadata["metadata"].get("license"),
              "licenseEvidenceUrl": RECORD_URL, "licenseMetadataSha256": meta_manifest["sha256"],
              "attribution": "C L Stanton (2026), Broomfield, Colorado Citizen Magnetometer Dataset 2023–2025 (Raw CSV), Zenodo, doi:10.5281/zenodo.18928938, CC BY 4.0",
              "rawPublicRedistribution": False, "rawRedistributionReason": "Retain private due to precise location information, despite CC BY 4.0 license.",
              "reasons": reasons, "professionalComparisonStatus": "NOT_VALIDATED"}
    # Zero-lag, matched-minute descriptive comparison, never a validated detection.
    # Each source file is kept separate; filenames/models do not establish site independence.
    reference_path = RAW / "usgs-bou-may2024.json"
    reference_manifest = RAW / "usgs-bou-may2024.json.manifest.json"
    if reference_path.exists() and reference_manifest.exists():
        reference = normalize_usgs(json.loads(reference_path.read_text()), json.loads(reference_manifest.read_text()), components=("F",))[0]
        reference_values = {s["observedAtUtc"]: s["value"] for s in reference["samples"] if s["value"] is not None}
        comparisons = []
        for overlap in overlaps:
            times = sorted(set(overlap["minuteMediansNt"]) & set(reference_values))
            phone = [overlap["minuteMediansNt"][t] for t in times]
            station = [reference_values[t] for t in times]
            if len(times) < 10:
                continue
            phone_baseline, station_baseline = statistics.median(phone), statistics.median(station)
            centered_phone = [v - phone_baseline for v in phone]
            centered_station = [v - station_baseline for v in station]
            corr = statistics.correlation(phone, station) if statistics.pstdev(phone) > 0 and statistics.pstdev(station) > 0 else None
            comparisons.append({"sourceFileSha256": overlap["sourceFileSha256"], "deviceModel": overlap["deviceModel"],
                                "matchedMinutes": len(times), "firstMinuteUtc": times[0], "lastMinuteUtc": times[-1],
                                "geographicSpanClass": overlap["geographicSpanClass"], "zeroLagPearsonR": corr,
                                "phoneRangeNt": max(phone) - min(phone), "referenceRangeNt": max(station) - min(station),
                                "medianCenteredResidualRmseNt": math.sqrt(statistics.mean((p - g) ** 2 for p, g in zip(centered_phone, centered_station))),
                                "qualityAccepted": False, "qualityReason": "Stationarity/calibration/physical-site identity unverified"})
        report["exploratoryProfessionalComparison"] = {"stationId": "BOU", "component": "F", "unit": "nT", "lagSeconds": 0,
                  "phoneAggregation": "within-file median of rows sharing a UTC minute", "baseline": "separate full-overlap median per phone file and station; retrospective only",
                  "sourceUrl": reference["sourceUrl"], "sourceChecksum": reference["sourceChecksum"], "filesWithAtLeast10MatchedMinutes": comparisons,
                  "warning": "Descriptive comparison of unvalidated archive samples. Autocorrelation, movement, nonuniform sampling and duplicates across exports preclude significance or regional-detection claims. No lag search performed; no independent-site count inferred."}
        report["professionalComparisonStatus"] = "EXPLORATORY_ONLY_NOT_VALIDATED"
    write_json(RESULTS / "broomfield_archive_inspection.json", report)
    write_json(ROOT / "demo" / "fixtures" / "broomfield-inspection.json", report)
    print(json.dumps({k: report[k] for k in ("status", "checksumVerified", "csvFiles", "uniqueCsvFiles", "parsedRows", "firstObservedAtUtc", "lastObservedAtUtc", "medianPositiveWithinFileCadenceSeconds", "may2024Overlap", "may2024Rows", "license", "filesWithCoordinateSpanOver1km")}, indent=2))


if __name__ == "__main__":
    inspect()
