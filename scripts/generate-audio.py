#!/usr/bin/env python3
"""Generate the eight letter WAVs from Robotnick2's English alphabet recording."""

import argparse
from array import array
from contextlib import contextmanager
import hashlib
import json
import math
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from uuid import uuid4
import wave


SOURCE = Path(__file__).with_name("English_alphabet.ogg")
SOURCE_SHA256 = "53f69d53ddb3844aa3f82eadad7a7b93e290db1bdad120e0e2342baeec3cfde0"
OUTPUT = Path(__file__).resolve().parents[1] / "public" / "audio"

# Start (inclusive) and end (exclusive), in milliseconds from the decoded start.
SEGMENTS_MS = {
    "B": (1110, 1555),
    "F": (4890, 5410),
    "H": (6620, 7365),
    "J": (8525, 9120),
    "M": (11450, 11875),
    "Q": (14910, 15520),
    "R": (15985, 16550),
    "W": (20585, 21225),
}
APPROVED_SHA256 = {
    "B.wav": "32ddf2a275b07c27def202a06db9a330902929f2ea0e388215991622b92d2d57",
    "F.wav": "f22d58c587efe009bc8536f6db06e6443564964a021cfbf387faf3e400464acf",
    "H.wav": "209912b095c42da1de4418e62fa37e070a369351c90741b35caf51ec7e6ae6de",
    "J.wav": "a171493f7fb17ded07f52a2614ea6a0ae5f515b06976e59d6bc3d5c6fcfec734",
    "M.wav": "3d9829e5ef13e634dbb2206625644b726ea5aab79c5f8ac04d9399b80ca338f6",
    "Q.wav": "c19693a333f8c369cd0ffc9c1c9c98ccc6da934fb815ef6d3f21bc2bd299d54d",
    "R.wav": "8510c4779d669c8296e611a7a3c511712f9f24a49143dcd21bec7ab513c52dfa",
    "W.wav": "1bab28c54881cc0327aa8e17a3dff5f6e89c0c38ca97dd8dcf7d7f1154b2aea0",
}
SAMPLE_RATE = 22050
FULL_SCALE = 32768
PEAK_LIMIT = int((FULL_SCALE - 1) * 0.9)
RMS_TARGET = FULL_SCALE * 0.10  # -20 dBFS active RMS
MIN_RMS = FULL_SCALE * 10 ** (-35 / 20)


def from_little_endian(data):
    samples = array("h", data)
    if sys.byteorder != "little":
        samples.byteswap()
    return samples


def active_rms(samples, name):
    peak = max(map(abs, samples), default=0)
    threshold = max(64, peak * 0.01)
    voiced = [value for value in samples if abs(value) > threshold]
    if not voiced:
        raise ValueError(f"Silent or weak signal in {name}")
    return math.sqrt(sum(value * value for value in voiced) / len(voiced))


def decode_source():
    if hashlib.sha256(SOURCE.read_bytes()).hexdigest() != SOURCE_SHA256:
        raise ValueError(f"SHA-256 mismatch for {SOURCE.name}")
    result = subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-cpuflags", "0", "-fflags", "+bitexact",
        "-i", str(SOURCE), "-ac", "1", "-ar", str(SAMPLE_RATE),
        "-flags:a", "+bitexact", "-f", "s16le", "pipe:1",
    ], check=True, stdout=subprocess.PIPE)
    return from_little_endian(result.stdout)


def prepare_clip(recording, start_ms, end_ms, destination):
    samples = recording[round(start_ms * SAMPLE_RATE / 1000):round(end_ms * SAMPLE_RATE / 1000)]
    # Taper the room tone at each cut to avoid a click when playback starts/stops.
    fade = round(SAMPLE_RATE * 0.008)
    for i in range(fade):
        samples[i] = round(samples[i] * i / fade)
        samples[-1 - i] = round(samples[-1 - i] * i / fade)
    rms = active_rms(samples, destination.name)
    gain = min(RMS_TARGET / rms, PEAK_LIMIT / max(map(abs, samples)))
    samples = array("h", (round(value * gain) for value in samples))
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(str(destination), "wb") as clip:
        clip.setparams((1, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
        clip.writeframes(samples.tobytes())


def validate(path):
    try:
        with wave.open(str(path), "rb") as clip:
            if (clip.getnchannels(), clip.getsampwidth(), clip.getframerate()) != (1, 2, SAMPLE_RATE):
                raise ValueError(f"Unexpected PCM format in {path.name}")
            frames = clip.getnframes()
            data = clip.readframes(frames)
    except (wave.Error, EOFError) as error:
        raise ValueError(f"Invalid WAV in {path.name}") from error
    if len(data) != frames * 2:
        raise ValueError(f"Truncated frame data in {path.name}")
    duration = frames / SAMPLE_RATE
    if not 0.1 <= duration <= 0.75:
        raise ValueError(f"Unexpected duration for {path.name}: {duration:.4f}s")
    samples = from_little_endian(data)
    bias = sum(samples) / len(samples)
    centered = [value - bias for value in samples]
    if sum(value * value for value in centered) < len(centered) * MIN_RMS ** 2:
        raise ValueError(f"Silent or weak signal in {path.name} (below -35 dBFS RMS)")
    peak = max(map(abs, samples))
    if peak >= FULL_SCALE - 1:
        raise ValueError(f"Clipped recording: {path.name}")
    threshold = max(32, max(map(abs, centered)) * 0.003)
    leading = next(i for i, value in enumerate(centered) if abs(value) > threshold) / SAMPLE_RATE
    trailing = next(i for i, value in enumerate(reversed(centered)) if abs(value) > threshold) / SAMPLE_RATE
    if leading > 0.05 or trailing > 0.05:
        raise ValueError(f"Excessive surrounding silence: {path.name}")
    rms = active_rms(centered, path.name)
    return {
        "letter": path.stem,
        "seconds": round(duration, 3),
        "peak": peak,
        "active_rms_dbfs": round(20 * math.log10(rms / FULL_SCALE), 2),
        "leading_ms": round(leading * 1000, 1),
        "trailing_ms": round(trailing * 1000, 1),
    }


def validate_set(directory):
    results = [validate(directory / f"{letter}.wav") for letter in SEGMENTS_MS]
    quietest = min(results, key=lambda clip: clip["active_rms_dbfs"])
    loudest = max(results, key=lambda clip: clip["active_rms_dbfs"])
    if loudest["active_rms_dbfs"] - quietest["active_rms_dbfs"] > 6:
        raise ValueError(f"Active RMS differs by more than 6 dB: {quietest['letter']}.wav and {loudest['letter']}.wav")
    return results


@contextmanager
def installation_lock(project):
    cache = project / ".cache"
    cache.mkdir(exist_ok=True)
    # Closing this handle releases the OS lock even when an installer dies.
    with (cache / "audio-install.lock").open("a+b") as lock:
        if sys.platform == "win32":
            import msvcrt
            lock.seek(0)
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def install_set(staging, output, prepare=None):
    output.parent.mkdir(parents=True, exist_ok=True)
    project = output.parent.parent
    transaction = project / f".{output.name}-install"
    backup = transaction / "previous"
    recordings = {f"{letter}.wav".casefold() for letter in SEGMENTS_MS}

    def skip_replaced_files(directory, names):
        if Path(directory) == output:
            return [name for name in names if name.casefold() in recordings]
        return ()

    def retire_transaction():
        return transaction.rename(project / ".cache" / f"audio-backup-{uuid4().hex}")

    with installation_lock(project):
        if backup.exists():
            if output.exists():
                # The output may have been recreated independently after a crash.
                saved = retire_transaction() / "previous"
                print(f"Kept the interrupted installation's previous files at {saved}", file=sys.stderr)
            else:
                backup.rename(output)
        if prepare is not None:
            prepare(staging)
        results = validate_set(staging)
        if output.exists():
            shutil.copytree(output, staging, dirs_exist_ok=True, symlinks=True, ignore=skip_replaced_files)
            transaction.mkdir(exist_ok=True)
            output.rename(backup)
        try:
            staging.rename(output)
        except BaseException:
            if backup.exists() and not output.exists():
                backup.rename(output)
            raise
        if backup.exists():
            retired = retire_transaction()
            try:
                shutil.rmtree(retired)
            except OSError as error:
                print(f"Audio installed. Previous files remain at {retired}: {error}", file=sys.stderr)
    return results


def generate_clips(staging):
    recording = decode_source()
    for letter, (start, end) in SEGMENTS_MS.items():
        prepare_clip(recording, start, end, staging / f"{letter}.wav")


def check_shipped_audio(output):
    public = output.parent
    approved = {f"{output.name}/{name}" for name in APPROVED_SHA256}
    actual = set()
    for directory, subdirs, names in os.walk(public):
        root = Path(directory)
        # Vite follows directory links. Require a finite, local public tree.
        for subdir in subdirs:
            child = root / subdir
            if child.is_symlink():
                raise ValueError(f"Cannot verify public directory symlink: {child.relative_to(public).as_posix()}")
        actual.update(
            (root / name).relative_to(public).as_posix()
            for name in names if name.casefold().endswith(".wav")
        )
    extra = actual - approved
    if extra:
        raise ValueError(f"Unexpected WAV files in public: {', '.join(sorted(extra))}")
    results = validate_set(output)
    for filename, expected in APPROVED_SHA256.items():
        if hashlib.sha256((output / filename).read_bytes()).hexdigest() != expected:
            raise ValueError(f"Unapproved audio in {filename}: SHA-256 mismatch")
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="Validate bundled WAVs without regenerating them")
    args = parser.parse_args()
    if args.check:
        results = check_shipped_audio(OUTPUT)
    else:
        with tempfile.TemporaryDirectory(prefix=".letter-audio-", dir=OUTPUT.parent.parent) as temporary:
            staging = Path(temporary) / "audio"
            staging.mkdir()
            results = install_set(staging, OUTPUT, prepare=generate_clips)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
