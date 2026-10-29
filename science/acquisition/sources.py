"""Real NASA, NOAA and USGS adapters. No generated fallback measurements.

Run: python -m science.acquisition.sources
Raw responses stay in ignored data/raw; the public fixture contains factual
scientific subsets, source credits and immutable response checksums.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data" / "raw"
RESULTS = ROOT / "science" / "results"
FIXTURE = ROOT / "demo" / "fixtures" / "verified-sources.json"
CCMC_URL = "https://ccmc.gsfc.nasa.gov/CMESB-Earth/WS/get/predictions?CMEtimeStart=2024-05-08&CMEtimeEnd=2024-05-11"
OVATION_URL = "https://services.swpc.noaa.gov/json/ovation_aurora_latest.json"
MAG_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_mag_1m.json"
WIND_URL = "https://services.swpc.noaa.gov/json/rtsw/rtsw_wind_1m.json"
OMNI_FIELDS = ["BX_GSE", "BY_GSM", "BZ_GSM", "flow_speed", "proton_density", "Pressure"]


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def utc(value: str, *, provider_naive_utc: bool = False) -> str:
    if not isinstance(value, str):
        raise ValueError("Timestamp must be a string")
    stamp = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if stamp.tzinfo is None:
        if not provider_naive_utc:
            raise ValueError("Timestamp lacks an explicit timezone")
        stamp = stamp.replace(tzinfo=timezone.utc)
    return stamp.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def finite(value, *, fill=None, maximum=None):
    if value is None:
        return None
    if isinstance(value, bool):
        raise ValueError("Boolean is not a scientific numeric reading")
    number = float(value)
    if not math.isfinite(number) or (fill is not None and number == float(fill)):
        return None
    if maximum is not None and abs(number) >= maximum:
        return None
    return number


def write_json(path: Path, value, *, compact=False):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=None if compact else 2, allow_nan=False) + "\n", encoding="utf-8")


def fetch(url: str, name: str, *, max_bytes=8_000_000, refresh=False):
    """Cache exact bytes plus origin manifest. Bounded public HTTPS reads only."""
    if not url.startswith("https://"):
        raise ValueError("HTTPS required")
    RAW.mkdir(parents=True, exist_ok=True)
    target = RAW / name
    metadata_path = RAW / (name + ".manifest.json")
    if target.exists() and metadata_path.exists() and not refresh:
        body = target.read_bytes()
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if metadata["sourceUrl"] != url or hashlib.sha256(body).hexdigest() != metadata["sha256"]:
            raise ValueError("Cached source URL/checksum mismatch")
    else:
        req = Request(url, headers={"User-Agent": "AuroraSense/0.1 scientific reproducibility demo", "Accept": "application/json"})
        with urlopen(req, timeout=45) as response:
            body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ValueError("Response exceeds bounded acquisition size")
            metadata = {"sourceUrl": url, "retrievedAtUtc": utc_now(), "sha256": hashlib.sha256(body).hexdigest(),
                        "bytes": len(body), "httpStatus": response.status, "etag": response.headers.get("ETag")}
        target.write_bytes(body)
        write_json(metadata_path, metadata)
    return body, metadata


def fetch_json(url: str, name: str, **kwargs):
    body, manifest = fetch(url, name, **kwargs)
    return json.loads(body), manifest


def normalize_cme(data, source_url=CCMC_URL):
    if not isinstance(data, list):
        raise ValueError("CCMC predictions must be an event array")
    rows, excluded = [], []
    for event in data:
        event_id = event["cmeID"]
        observed = utc(event["arrivalTime"]) if event.get("arrivalTime") else None
        for p in event["predictions"]:
            method = p["predictedMethodName"]
            issued = utc(p["submissionTime"]) if p.get("submissionTime") else None
            predicted = utc(p["predictedArrivalTime"]) if p.get("predictedArrivalTime") else None
            # Retrospectively recomputed average/median rows are NOT original forecasts.
            if not issued or not predicted or issued >= predicted or (observed and issued >= observed) or method.lower().startswith(("average of", "median of")):
                excluded.append({"eventId": event_id, "method": method, "issuedAtUtc": issued,
                                 "reason": "Not a pre-event independently submitted arrival prediction"})
                continue
            identity = f"{event_id}|{method}|{issued}|{predicted}"
            rows.append({"id": hashlib.sha256(identity.encode()).hexdigest()[:20], "eventId": event_id,
                         "method": method, "issuedAtUtc": issued, "availableAtUtc": issued,
                         "availabilityBasis": "CCMC original submissionTime; no separate publication log",
                         "predictedArrivalUtc": predicted, "observedArrivalUtc": observed,
                         "observedArrivalAvailableAtUtc": None,
                         "uncertaintyMinusHours": finite(p.get("uncertaintyMinusInHrs")),
                         "uncertaintyPlusHours": finite(p.get("uncertaintyPlusInHrs")),
                         "sourceId": "NASA_CCMC_CME_SCOREBOARD", "sourceUrl": source_url,
                         "kind": "ISSUED_FORECAST", "issuanceVerified": True,
                         "noArrivalObserved": bool(event.get("noArrivalObserved"))})
    # Preserve every submitted revision; do not silently collapse different ETAs.
    return sorted(rows, key=lambda row: (row["eventId"], row["issuedAtUtc"], row["id"])), excluded


def usgs_url(start: str, end: str, station="BOU"):
    return "https://geomag.usgs.gov/ws/data/?" + urlencode({"id": station, "starttime": start, "endtime": end,
                                                        "sampling_period": 60, "format": "json"})


def normalize_usgs(data, manifest, components=("X", "F")):
    if data.get("type") != "Timeseries" or data["metadata"].get("status") != 200:
        raise ValueError("Invalid USGS time-series response")
    meta = data["metadata"]["intermagnet"]
    if meta["reported_orientation"] != "XYZF":
        raise ValueError("Unexpected USGS component orientation")
    times = [utc(t) for t in data["times"]]
    if times != sorted(set(times)):
        raise ValueError("USGS timestamps must be strictly increasing")
    result = []
    for component in data["values"]:
        if component["id"] not in components:
            continue
        if len(component["values"]) != len(times):
            raise ValueError("USGS timestamp/value length mismatch")
        values = [finite(v, maximum=99999) for v in component["values"]]
        result.append({"stationId": meta["imo"]["iaga_code"], "sourceId": "USGS_" + meta["imo"]["iaga_code"],
                       "sourceUrl": manifest["sourceUrl"], "kind": "MEASURED_ARCHIVAL",
                       "component": component["id"], "frame": "GEO", "unit": "nT",
                       "cadenceSeconds": meta["sampling_period"], "status": meta["data_type"],
                       "availableAtUtc": None, "retrievedAtUtc": manifest["retrievedAtUtc"],
                       "sourceChecksum": manifest["sha256"], "missingCount": values.count(None),
                       "samples": [{"observedAtUtc": t, "value": v} for t, v in zip(times, values)]})
    return result


def normalize_ovation(data, manifest, stride=2):
    if data.get("Data Format") != "[Longitude, Latitude, Aurora]":
        raise ValueError("Unexpected NOAA OVATION coordinate schema")
    observed, valid = utc(data["Observation Time"]), utc(data["Forecast Time"])
    coordinates = []
    for row in data["coordinates"]:
        if len(row) != 3:
            raise ValueError("Invalid OVATION grid cell")
        lon, lat, value = [finite(v) for v in row]
        if None in (lon, lat, value) or not 0 <= lon < 360 or not -90 <= lat <= 90 or not 0 <= value <= 100:
            raise ValueError("Invalid OVATION cell range")
        # Retain actual provider cells, not smoothed or fabricated interpolation.
        if lon % stride == 0 and lat % stride == 0:
            coordinates.append([lon, lat, value])
    return {"sourceId": "NOAA_OVATION", "sourceUrl": manifest["sourceUrl"], "kind": "ISSUED_FORECAST",
            "observedAtUtc": observed, "validAtUtc": valid, "issuedAtUtc": None,
            "availableAtUtc": manifest["retrievedAtUtc"], "retrievedAtUtc": manifest["retrievedAtUtc"],
            "sourceChecksum": manifest["sha256"], "gridStrideDegrees": stride,
            "valueMeaning": "NOAA modeled auroral activity; not calibrated local viewing probability",
            "coordinates": coordinates}


def normalize_solar_wind(mag, wind, manifest):
    selected = {}
    for rows, fields, prefix in ((mag, (("bz_gsm", "bzNt"),), "magnetic"),
                                 (wind, (("proton_speed", "speedKmS"), ("proton_density", "densityCm3")), "plasma")):
        if not isinstance(rows, list):
            raise ValueError("NOAA RTSW response must be an array")
        for row in rows:
            # Operational provider selects the active source. Keep the identity.
            if row.get("active") is not True or row.get("overall_quality") != 0:
                continue
            t = utc(row["time_tag"], provider_naive_utc=True)
            record = selected.setdefault(t, {"observedAtUtc": t, "bzNt": None, "speedKmS": None, "densityCm3": None})
            if prefix + "Source" in record:
                raise ValueError("Multiple active NOAA sources at the same time")
            record[prefix + "Source"] = row["source"]
            for upstream, ours in fields:
                record[ours] = finite(row.get(upstream), fill=-9999)
    if not selected:
        raise ValueError("No quality-valid active NOAA samples")
    # Last 2 hours only; preserve the one-minute delivered cadence and missing joins.
    samples = [selected[t] for t in sorted(selected)][-120:]
    return {"sourceId": "NOAA_RTSW", "sourceUrl": "https://services.swpc.noaa.gov/json/rtsw/",
            "kind": "MEASURED_LIVE", "frame": "GSM (Bz); scalar speed/density",
            "retrievedAtUtc": manifest["retrievedAtUtc"], "availableAtUtc": manifest["retrievedAtUtc"],
            "samples": samples}


def omni_url(start: str, end: str):
    return "https://cdaweb.gsfc.nasa.gov/hapi/data?" + urlencode({"id": "OMNI_HRO_5MIN", "parameters": ",".join(OMNI_FIELDS),
            "time.min": start, "time.max": end, "format": "json"})


def normalize_omni(data):
    if data.get("status", {}).get("code") != 1200:
        raise ValueError("CDAWeb did not return successful HAPI data")
    params = data["parameters"]
    expected = ["Time"] + OMNI_FIELDS
    if [p["name"] for p in params] != expected:
        raise ValueError("OMNI parameter schema/order changed")
    result = []
    for row in data["data"]:
        if len(row) != len(params):
            raise ValueError("OMNI parameter/value length mismatch")
        record = {"observedAtUtc": utc(row[0]), "availableAtUtc": None,
                  "timeBasis": "retrospective bow-shock-nose shifted arrival time, not spacecraft measurement time"}
        record.update({p["name"]: finite(v, fill=p.get("fill")) for p, v in zip(params[1:], row[1:])})
        result.append(record)
    times = [r["observedAtUtc"] for r in result]
    if times != sorted(set(times)):
        raise ValueError("OMNI timestamps not strictly increasing")
    return result


def build_fixture(refresh=False):
    fixture = {"schemaVersion": 1, "generatedAtUtc": utc_now(), "cmeForecasts": [], "referenceSeries": [],
               "latestNoaa": {"ovation": None, "solarWind": None}, "manifests": [], "limitations": []}
    jobs = [("CCMC", CCMC_URL, "cme-may2024.json"),
            ("USGS", usgs_url("2024-05-10T00:00:00Z", "2024-05-13T00:00:00Z"), "usgs-bou-may2024.json"),
            ("OVATION", OVATION_URL, "noaa-ovation.json"), ("MAG", MAG_URL, "noaa-mag.json"),
            ("WIND", WIND_URL, "noaa-wind.json")]
    acquired = {}
    for key, url, name in jobs:
        try:
            acquired[key] = fetch_json(url, name, refresh=refresh)
            rights = {
                "CCMC": {"provider": "NASA CCMC and named submitting forecast teams", "licenseId": "PUBLIC_FACTUAL_SUBSET_WITH_ATTRIBUTION",
                         "licenseEvidenceUrl": "https://ccmc.gsfc.nasa.gov/scoreboards/cme/earth/", "rawRedistribution": False,
                         "restrictions": "Only factual numeric predictions and method names included; full community notes not redistributed. CCMC requests notification before event/validation studies and presentations; outreach not yet authorized."},
                "USGS": {"provider": "U.S. Geological Survey", "licenseId": "US_GOVERNMENT_PUBLIC_DOMAIN",
                         "licenseEvidenceUrl": "https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits", "rawRedistribution": True,
                         "restrictions": "Credit U.S. Geological Survey; no endorsement implied."},
            }.get(key, {"provider": "NOAA Space Weather Prediction Center", "licenseId": "US_GOVERNMENT_PUBLIC_DOMAIN",
                       "licenseEvidenceUrl": "https://www.noaa.gov/office-education/outreach-communication/faq", "rawRedistribution": True,
                       "restrictions": "Credit NOAA SWPC. No endorsement or guaranteed forecast accuracy."})
            fixture["manifests"].append({"sourceId": key, **acquired[key][1], **rights})
            print(f"Acquired {key}: {acquired[key][1]['bytes']} bytes")
        except Exception as error:
            fixture["limitations"].append(f"{key} retrieval unavailable: {type(error).__name__}: {error}")
    if "CCMC" in acquired:
        rows, excluded = normalize_cme(acquired["CCMC"][0])
        fixture["cmeForecasts"] = [r for r in rows if r["eventId"] == "2024-05-08T12:24:00-CME-001"]
        write_json(RESULTS / "cme_scoreboard_issuance_validation.json", {"totalOriginalSubmissions": len(rows), "excluded": excluded,
                   "selectedEvent": "2024-05-08T12:24:00-CME-001", "selectedSubmissions": len(fixture["cmeForecasts"]),
                   "sourceManifest": acquired["CCMC"][1], "caveat": "Provider submission times, not independently archived page vintages. Observed arrival publication time unknown."})
    if "USGS" in acquired:
        fixture["referenceSeries"] = normalize_usgs(*acquired["USGS"])
        write_json(RESULTS / "usgs_bou_reference_manifest.json", {**acquired["USGS"][1],
                   "metadata": acquired["USGS"][0]["metadata"], "components": [{k: v for k, v in s.items() if k != "samples"} for s in normalize_usgs(*acquired["USGS"], components=("X", "Y", "Z", "F"))]})
    if "OVATION" in acquired:
        fixture["latestNoaa"]["ovation"] = normalize_ovation(*acquired["OVATION"])
    if "MAG" in acquired and "WIND" in acquired:
        fixture["latestNoaa"]["solarWind"] = normalize_solar_wind(acquired["MAG"][0], acquired["WIND"][0], acquired["MAG"][1])
    fixture["limitations"].extend([
        "The NOAA snapshot is current at its own October 2026 timestamps, not an issued May 2024 forecast; never overlay it on historical replay.",
        "USGS adjusted retrospective records have unknown original operational availability; they are historical evidence, not an as-issued alert backtest.",
        "CCMC original submissions include method revisions; aggregate rows submitted in January 2025 are excluded. Model spread is not calibrated confidence.",
        "No physical phone observations, empirical phone-noise simulation or independently verified optical sightings are included."])
    write_json(FIXTURE, fixture, compact=True)
    print(f"Wrote {FIXTURE.relative_to(ROOT)} ({FIXTURE.stat().st_size} bytes)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--refresh", action="store_true", help="Refresh cached public snapshots once")
    build_fixture(parser.parse_args().refresh)
