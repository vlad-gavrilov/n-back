#!/usr/bin/env python3
"""Regenerate the bundled letter names with the installed macOS Samantha voice."""

import argparse
from array import array
import json
import math
from pathlib import Path
import platform
import shutil
import subprocess
import sys
import tempfile
import wave


PRONUNCIATIONS = {
    "B": "bee",
    "F": "eff",
    "H": "aitch",
    "J": "jay",
    "M": "em",
    "Q": "cue",
    "R": "are",
    "W": "double you",
}
SAMPLE_RATE = 22050
PEAK_LIMIT = int(32767 * 0.9)
RMS_TARGET = 32767 * 0.18
ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "public" / "audio"


def read_pcm(path):
    with wave.open(str(path), "rb") as clip:
        if (clip.getnchannels(), clip.getsampwidth(), clip.getframerate()) != (1, 2, SAMPLE_RATE):
            raise ValueError(f"Unexpected PCM format: {path.name}")
        samples = array("h", clip.readframes(clip.getnframes()))
    if sys.byteorder != "little":
        samples.byteswap()
    if not samples or not max(map(abs, samples)):
        raise ValueError(f"Empty or silent recording: {path.name}")
    return samples


def prepare_clip(raw, destination):
    samples = read_pcm(raw)
    peak = max(map(abs, samples))
    threshold = max(32, int(peak * 0.003))
    active = [index for index, sample in enumerate(samples) if abs(sample) > threshold]
    padding = round(SAMPLE_RATE * 0.025)
    samples = samples[max(0, active[0] - padding):min(len(samples), active[-1] + padding + 1)]
    voiced = [sample for sample in samples if abs(sample) > max(64, peak * 0.01)]
    rms = math.sqrt(sum(sample * sample for sample in voiced) / len(voiced))
    gain = min(RMS_TARGET / rms, PEAK_LIMIT / peak)
    samples = array("h", (round(sample * gain) for sample in samples))
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(destination), "wb") as clip:
        clip.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
        clip.writeframes(samples.tobytes())


def validate(path):
    samples = read_pcm(path)
    peak = max(map(abs, samples))
    duration = len(samples) / SAMPLE_RATE
    if not 0.1 <= duration <= 1.5:
        raise ValueError(f"Unexpected duration: {path.name}: {duration:.3f}s")
    if peak >= 32767:
        raise ValueError(f"Clipped recording: {path.name}")
    threshold = max(32, peak * 0.003)
    active = [index for index, sample in enumerate(samples) if abs(sample) > threshold]
    leading = active[0] / SAMPLE_RATE
    trailing = (len(samples) - active[-1] - 1) / SAMPLE_RATE
    if leading > 0.05 or trailing > 0.05:
        raise ValueError(f"Excessive surrounding silence: {path.name}")
    voiced = [sample for sample in samples if abs(sample) > max(64, peak * 0.01)]
    rms = math.sqrt(sum(sample * sample for sample in voiced) / len(voiced))
    return {"letter": path.stem, "seconds": round(duration, 3), "peak": peak, "active_rms_dbfs": round(20 * math.log10(rms / 32767), 2), "leading_ms": round(leading * 1000, 1), "trailing_ms": round(trailing * 1000, 1)}


def validate_set(directory):
    results = [validate(directory / f"{letter}.wav") for letter in PRONUNCIATIONS]
    levels = [result["active_rms_dbfs"] for result in results]
    if max(levels) - min(levels) > 6:
        raise ValueError("Letter recordings differ by more than 6 dB in active RMS")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate existing WAVs without regenerating them")
    args = parser.parse_args()
    if args.check:
        print(json.dumps(validate_set(OUTPUT), indent=2))
        return
    if platform.system() != "Darwin":
        raise SystemExit("Generation requires macOS with the Samantha voice; normal builds use the bundled WAVs")
    cache = ROOT / ".cache"
    cache.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="letter-audio-", dir=cache) as temporary:
        staging = Path(temporary)
        for letter, pronunciation in PRONUNCIATIONS.items():
            speech = staging / f"{letter}.aiff"
            raw = staging / f"{letter}-raw.wav"
            subprocess.run(["/usr/bin/say", "-v", "Samantha", "-r", "180", "-o", str(speech), pronunciation], check=True)
            subprocess.run(["/usr/bin/afconvert", "-f", "WAVE", "-d", f"LEI16@{SAMPLE_RATE}", "-c", "1", str(speech), str(raw)], check=True)
            prepare_clip(raw, staging / f"{letter}.wav")
        results = validate_set(staging)
        # Keep the previous set until every candidate passes validation
        OUTPUT.mkdir(parents=True, exist_ok=True)
        for letter in PRONUNCIATIONS:
            shutil.copyfile(staging / f"{letter}.wav", OUTPUT / f"{letter}.wav")
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
