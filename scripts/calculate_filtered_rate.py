import json
import numpy as np

with open("phone-1793471459272-json.json", "r", encoding="utf-8") as f:
    session = json.load(f)

samples = session["samples"]
mags = np.array([np.sqrt(s["x"]**2 + s["y"]**2 + s["z"]**2) for s in samples])
times = np.array([s["sensorTimestampSeconds"] for s in samples])

# 1-second rolling median (10 samples)
window = 10
smoothed_mags = np.convolve(mags, np.ones(window)/window, mode='valid')
smoothed_times = times[window//2 : -window//2 + 1]

dt_smooth = np.diff(smoothed_times)
dB_smooth = np.diff(smoothed_mags)
rate_smooth = np.abs(dB_smooth) / dt_smooth

print(f"Raw single-sample max dB/dt: {np.max(np.abs(np.diff(mags))/np.diff(times)):.3f} uT/s")
print(f"Smoothed (1-sec window) max dB/dt: {np.max(rate_smooth):.3f} uT/s")
print(f"Smoothed (1-sec window) 95th percentile dB/dt: {np.percentile(rate_smooth, 95):.3f} uT/s")
print(f"Smoothed (1-sec window) median dB/dt: {np.median(rate_smooth):.3f} uT/s")
