import json
import numpy as np

with open("phone-1793471459272-json.json", "r", encoding="utf-8") as f:
    session = json.load(f)

samples = session["samples"]
mags = [np.sqrt(s["x"]**2 + s["y"]**2 + s["z"]**2) for s in samples]
times = [s["sensorTimestampSeconds"] for s in samples]

baseline_mag = np.median(mags[:1200])

# Find where the minimum mag occurs (the -924 nT excursion)
min_idx = np.argmin(mags)
print(f"Min magnitude: {mags[min_idx]:.3f} uT at sample {min_idx} (t = {times[min_idx] - times[0]:.1f} s)")
print("Context around min_idx:")
for i in range(max(0, min_idx - 5), min(len(mags), min_idx + 6)):
    delta_nt = (mags[i] - baseline_mag) * 1000
    print(f"  Sample {i:4d} (t={times[i]-times[0]:5.1f}s): |B|={mags[i]:.3f} uT (Delta={delta_nt:+6.1f} nT)")

# Also check max magnitude
max_idx = np.argmax(mags)
print(f"\nMax magnitude: {mags[max_idx]:.3f} uT at sample {max_idx} (t = {times[max_idx] - times[0]:.1f} s)")
for i in range(max(0, max_idx - 5), min(len(mags), max_idx + 6)):
    delta_nt = (mags[i] - baseline_mag) * 1000
    print(f"  Sample {i:4d} (t={times[i]-times[0]:5.1f}s): |B|={mags[i]:.3f} uT (Delta={delta_nt:+6.1f} nT)")
