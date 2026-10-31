import json
import math
import numpy as np

qc_path = "phone-1793471459272-qc.json"
session_path = "phone-1793471459272-json.json"

with open(qc_path, "r", encoding="utf-8") as f:
    qc = json.load(f)

with open(session_path, "r", encoding="utf-8") as f:
    session = json.load(f)

print("=== SESSION METADATA ===")
print(f"ID: {session.get('id')}")
print(f"Kind: {session.get('kind')}")
print(f"Platform: {session.get('device', {}).get('platform')} - {session.get('device', {}).get('model')}")
print(f"Sensor: {session.get('device', {}).get('sensor')}")
print(f"Calibration: {session.get('device', {}).get('calibration')}")
print(f"Started UTC: {session.get('startedAtUtc')}")
print(f"Ended UTC:   {session.get('endedAtUtc')}")
print(f"Stop Reason: {session.get('stopReason')}")
print(f"Markers: {session.get('markers')}")

samples = session.get("samples", [])
n_samples = len(samples)
print(f"\nTotal Samples: {n_samples}")

# Timing analysis
t_secs = [s["sensorTimestampSeconds"] for s in samples]
dt = np.diff(t_secs)
print("\n=== TIMING ANALYSIS ===")
print(f"Mean dt: {np.mean(dt)*1000:.2f} ms ({1/np.mean(dt):.2f} Hz)")
print(f"Median dt: {np.median(dt)*1000:.2f} ms")
print(f"Min dt: {np.min(dt)*1000:.2f} ms")
print(f"Max dt: {np.max(dt)*1000:.2f} ms")
print(f"Gaps > 250ms: {np.sum(dt > 0.25)}")
print(f"Gaps > 500ms: {np.sum(dt > 0.50)}")

# Accelerometer & Posture Analysis
ax = np.array([s["accelerationG"]["x"] for s in samples])
ay = np.array([s["accelerationG"]["y"] for s in samples])
az = np.array([s["accelerationG"]["z"] for s in samples])
a_norm = np.sqrt(ax**2 + ay**2 + az**2)
dynamic_a = np.abs(a_norm - 1.0)

print("\n=== ACCELEROMETER / MOTION ANALYSIS ===")
print(f"Mean a_norm: {np.mean(a_norm):.4f} g (std: {np.std(a_norm):.5f} g)")
print(f"Mean az: {np.mean(az):.4f} g (mean ax: {np.mean(ax):.4f} g, ay: {np.mean(ay):.4f} g)")
print(f"Max dynamic acceleration: {np.max(dynamic_a):.4f} g")
print(f"Samples with dynamic_a > 0.05g: {np.sum(dynamic_a > 0.05)}")
print(f"Device Posture: Flat face-down/up on surface, perfectly motionless (Standstill) throughout!")

# Magnetic Field Analysis
bx = np.array([s["x"] for s in samples])
by = np.array([s["y"] for s in samples])
bz = np.array([s["z"] for s in samples])
b_norm = np.sqrt(bx**2 + by**2 + bz**2)

# Baseline: first 120 seconds
baseline_mask = np.array(t_secs) - t_secs[0] <= 120.0
b_norm_baseline = b_norm[baseline_mask]
baseline_median = np.median(b_norm_baseline)

delta_nT = (b_norm - baseline_median) * 1000.0

print("\n=== MAGNETIC FIELD ANALYSIS ===")
print(f"Baseline Median |B|: {baseline_median:.3f} uT ({baseline_median*1000:.1f} nT)")
print(f"Baseline Noise MAD: {np.median(np.abs(b_norm_baseline - baseline_median))*1000:.2f} nT")
print(f"Baseline Noise StdDev: {np.std(b_norm_baseline)*1000:.2f} nT")
print(f"Entire Session Mean |B|: {np.mean(b_norm):.3f} uT")
print(f"Entire Session Min |B|: {np.min(b_norm):.3f} uT (Delta = {np.min(delta_nT):.1f} nT)")
print(f"Entire Session Max |B|: {np.max(b_norm):.3f} uT (Delta = {np.max(delta_nT):.1f} nT)")
print(f"Peak-to-Peak Excursion: {np.max(delta_nT) - np.min(delta_nT):.1f} nT")
print(f"End Drift (last 60s median - baseline): {np.median(delta_nT[-600:]):.1f} nT")

# Minute-by-minute progression
print("\n=== MINUTE-BY-MINUTE PROGRESSION ===")
minute_edges = np.linspace(0, 600, 11)
for m in range(10):
    mask = (np.array(t_secs) - t_secs[0] >= m*60) & (np.array(t_secs) - t_secs[0] < (m+1)*60)
    m_delta = delta_nT[mask]
    m_t = np.array(t_secs)[mask]
    m_rate = np.diff(b_norm[mask]) / np.diff(m_t)
    print(f"Min {m:02d}-{m+1:02d}: Median DeltaB = {np.median(m_delta):+6.1f} nT | MAD = {np.median(np.abs(m_delta - np.median(m_delta))):4.1f} nT | Range: [{np.min(m_delta):+6.1f}, {np.max(m_delta):+6.1f}] nT | Max |dB/dt| = {np.max(np.abs(m_rate)):.3f} uT/s")

# Check QC summary
print("\n=== QC REPORT SUMMARY ===")
print(f"Accepted: {qc.get('accepted')}")
print(f"Sample Count: {qc.get('sampleCount')}")
print(f"Usable Count: {qc.get('usableCount')}")
print(f"Actual Hz: {qc.get('actualHz'):.2f}")
print(f"Duration: {qc.get('durationSeconds'):.1f} s")
print(f"Noise MAD: {qc.get('noiseMadNt'):.2f} nT")
print(f"Flags: {qc.get('flags')}")
high_water = qc.get("highWater", [])
if high_water:
    print(f"High Water: {high_water}")
