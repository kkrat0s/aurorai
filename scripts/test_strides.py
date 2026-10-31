import json
import numpy as np

with open("phone-1793471459272-json.json", "r", encoding="utf-8") as f:
    session = json.load(f)

samples = session["samples"]
mags = [np.sqrt(s["x"]**2 + s["y"]**2 + s["z"]**2) for s in samples]
times = [s["sensorTimestampSeconds"] for s in samples]

# Calculate max rate of change with different strides
for stride in [1, 2, 3, 5, 8, 10]:
    rates = []
    for i in range(stride, len(mags)):
        dt = times[i] - times[i - stride]
        dm = abs(mags[i] - mags[i - stride])
        if dt > 0:
            rates.append(dm / dt)
    print(f"Stride {stride:2d} ({stride*100:4d} ms): max dB/dt = {np.max(rates):.3f} uT/s | 95th = {np.percentile(rates, 95):.3f} uT/s | median = {np.median(rates):.3f} uT/s")
