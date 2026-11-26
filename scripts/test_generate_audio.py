import contextlib
import io
import math
import os
import shutil
import subprocess
import sys
from importlib import import_module
from pathlib import Path
import struct
import tempfile
import unittest
from unittest.mock import patch
import wave


audio = import_module("generate-audio")
LETTERS = "BFHJMQRW"


def tone(path, frames=4410, amplitude=4000, bias=0):
    samples = [bias + round(amplitude * math.sin(i * 0.1)) for i in range(frames)]
    with wave.open(str(path), "wb") as clip:
        clip.setparams((1, 2, 22050, 0, "NONE", "not compressed"))
        clip.writeframes(struct.pack(f"<{frames}h", *samples))


class LetterAudioTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.staging = Path(temporary.name) / "new"
        self.staging.mkdir()
        self.output = Path(temporary.name) / "public" / "audio"
        self.output.mkdir(parents=True)
        self.clip = self.staging / "W.wav"

    def test_rejects_payload_shorter_than_its_header(self):
        tone(self.clip)
        self.clip.write_bytes(self.clip.read_bytes()[:-2])
        with self.assertRaisesRegex(ValueError, "W.wav"):
            audio.validate(self.clip)

    def test_rejects_silence_and_weak_recordings_by_name(self):
        for amplitude in (0, 1, 63, 128):
            with self.subTest(amplitude=amplitude):
                tone(self.clip, amplitude=amplitude)
                with self.assertRaisesRegex(ValueError, "W.wav"):
                    audio.validate(self.clip)

    def test_rejects_clip_longer_than_750_ms(self):
        tone(self.clip, frames=16538)
        with self.assertRaisesRegex(ValueError, "W.wav"):
            audio.validate(self.clip)

    def test_invalid_final_clip_preserves_installed_files(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        self.clip.write_bytes(self.clip.read_bytes()[:-2])
        previous = self.output / "B.wav"
        previous.write_bytes(b"previous")
        with self.assertRaises(ValueError):
            audio.install_set(self.staging, self.output)
        self.assertEqual([previous], list(self.output.iterdir()))
        self.assertEqual(b"previous", previous.read_bytes())

    def test_failed_final_rename_restores_the_original_directory(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        for name in ("B.wav", "F.wav", "W.wav", "NOTICE.txt"):
            (self.output / name).write_bytes(name.encode())
        rename = Path.rename

        def fail_final_rename(path, destination):
            if path == self.staging and destination == self.output:
                self.assertFalse(self.output.exists())
                self.assertEqual([], list(self.output.parent.iterdir()))
                raise OSError("simulated install failure")
            return rename(path, destination)

        original_inode = self.output.stat().st_ino
        with patch.object(Path, "rename", fail_final_rename):
            with self.assertRaisesRegex(OSError, "simulated install failure"):
                audio.install_set(self.staging, self.output)
        self.assertEqual(original_inode, self.output.stat().st_ino)
        self.assertEqual(
            {name: name.encode() for name in ("B.wav", "F.wav", "W.wav", "NOTICE.txt")},
            {path.name: path.read_bytes() for path in self.output.iterdir()},
        )

    def test_install_replaces_directory_and_retains_its_companions(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        (self.output / "W.wav").write_bytes(b"old recording")
        (self.output / "NOTICE.txt").write_text("attribution")
        nested = self.output / "notes"
        nested.mkdir()
        (nested / "W.wav").write_bytes(b"companion")
        original_inode = self.output.stat().st_ino
        audio.install_set(self.staging, self.output)
        self.assertNotEqual(original_inode, self.output.stat().st_ino)
        self.assertEqual((self.output / "NOTICE.txt").read_text(), "attribution")
        self.assertEqual((nested / "W.wav").read_bytes(), b"companion")
        self.assertEqual(len(audio.validate_set(self.output)), 8)

    def test_rejects_inaudible_signal_on_a_dc_offset(self):
        for amplitude in (0, 32):
            with self.subTest(amplitude=amplitude):
                tone(self.clip, amplitude=amplitude, bias=7000)
                with self.assertRaisesRegex(ValueError, "W.wav"):
                    audio.validate(self.clip)

    def test_shipped_check_rejects_a_different_valid_letter_by_name(self):
        root = self.output.parent.parent
        scripts = root / "scripts"
        scripts.mkdir()
        cli = scripts / "generate-audio.py"
        shutil.copy2(audio.__file__, cli)
        shutil.copytree(audio.OUTPUT, self.output, dirs_exist_ok=True)
        shutil.copyfile(self.output / "H.wav", self.output / "B.wav")
        check = subprocess.run([sys.executable, str(cli), "--check"], capture_output=True, text=True)
        self.assertNotEqual(check.returncode, 0)
        self.assertIn("B.wav", check.stderr)

    def test_drops_case_alias_from_previous_set(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        expected = (self.staging / "B.wav").read_bytes()
        (self.output / "b.wav").write_bytes(b"retired recording")
        audio.install_set(self.staging, self.output)
        self.assertEqual({f"{letter}.wav" for letter in LETTERS}, {p.name for p in self.output.iterdir()})
        self.assertEqual(expected, (self.output / "B.wav").read_bytes())

    def interrupt_swap(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        (self.output / "notes.txt").write_text("original companion")
        crash_install = """
import importlib, os, sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
audio = importlib.import_module('generate-audio')
staging, output = map(Path, sys.argv[2:])
original_rename = Path.rename
def rename(path, destination):
    if path == staging and destination == output:
        os._exit(75)
    return original_rename(path, destination)
Path.rename = rename
audio.install_set(staging, output)
"""
        crash = subprocess.run([
            sys.executable, "-B", "-c", crash_install, str(Path(audio.__file__).parent),
            str(self.staging), str(self.output),
        ], timeout=10)
        self.assertEqual(crash.returncode, 75)
        self.assertFalse(self.output.exists())
        # A restarted generator gets its own candidates, with no copied companions.
        shutil.rmtree(self.staging)
        self.staging.mkdir()
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")

    def test_retry_recovers_after_installer_dies_between_renames(self):
        self.interrupt_swap()
        audio.install_set(self.staging, self.output)
        self.assertEqual((self.output / "notes.txt").read_text(), "original companion")
        self.assertEqual(len(audio.validate_set(self.output)), 8)

    def test_cli_recovers_previous_output_before_trying_to_decode(self):
        self.interrupt_swap()
        root = self.output.parent.parent
        scripts = root / "scripts"
        scripts.mkdir()
        cli = scripts / "generate-audio.py"
        shutil.copy2(audio.__file__, cli)
        shutil.copy2(audio.SOURCE, scripts / audio.SOURCE.name)
        retry = subprocess.run(
            [sys.executable, str(cli)], env={**os.environ, "PATH": ""},
            capture_output=True, text=True,
        )
        self.assertNotEqual(retry.returncode, 0)
        self.assertIn("ffmpeg", retry.stderr)
        self.assertEqual((self.output / "notes.txt").read_text(), "original companion")

    def test_retry_preserves_backup_when_someone_recreated_the_output(self):
        self.interrupt_swap()
        self.output.mkdir()
        (self.output / "external.txt").write_text("external revision")
        with contextlib.redirect_stderr(io.StringIO()) as warning:
            audio.install_set(self.staging, self.output)
        self.assertEqual((self.output / "external.txt").read_text(), "external revision")
        saved = list((self.output.parent.parent / ".cache").rglob("notes.txt"))
        self.assertEqual([p.read_text() for p in saved], ["original companion"])
        self.assertIn(str(saved[0].parent), warning.getvalue())

    def test_post_promotion_cleanup_failure_can_be_retried(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        retry = self.staging.with_name("retry")
        shutil.copytree(self.staging, retry)
        (self.output / "notes.txt").write_text("old companion")
        with patch.object(shutil, "rmtree", side_effect=OSError("cleanup unavailable")):
            with contextlib.redirect_stderr(io.StringIO()) as warning:
                results = audio.install_set(self.staging, self.output)
                (self.output / "notes.txt").write_text("current companion")
                audio.install_set(retry, self.output)
        self.assertEqual(len(results), 8)
        self.assertIn("cleanup unavailable", warning.getvalue())
        self.assertEqual((self.output / "notes.txt").read_text(), "current companion")

    def test_second_installer_cannot_enter_during_promotion(self):
        for letter in LETTERS:
            tone(self.staging / f"{letter}.wav")
        other = self.staging.with_name("concurrent")
        shutil.copytree(self.staging, other)
        original_rename = Path.rename

        def rename(path, destination):
            if path == self.staging and destination == self.output:
                with self.assertRaises(OSError):
                    audio.install_set(other, self.output)
            return original_rename(path, destination)

        with patch.object(Path, "rename", rename):
            audio.install_set(self.staging, self.output)
        self.assertTrue(other.exists())
        self.assertEqual(len(audio.validate_set(self.output)), 8)

    def test_dc_offset_does_not_hide_silent_edges(self):
        bias = 6000
        samples = [bias] * 2205 + [bias + v for v in (4000, -4000) * 2205]
        for order in (samples, list(reversed(samples))):
            with wave.open(str(self.clip), "wb") as clip:
                clip.setparams((1, 2, 22050, 0, "NONE", "not compressed"))
                clip.writeframes(struct.pack(f"<{len(order)}h", *order))
            with self.assertRaisesRegex(ValueError, "W.wav"):
                audio.validate(self.clip)

    def test_shipped_check_only_allows_canonical_wav_paths_in_public(self):
        scripts = self.output.parent.parent / "scripts"
        scripts.mkdir()
        cli = scripts / "generate-audio.py"
        shutil.copy2(audio.__file__, cli)
        shutil.copytree(audio.OUTPUT, self.output, dirs_exist_ok=True)
        nested = self.output / "notes"
        nested.mkdir()
        (nested / "info.txt").write_text("companion")
        command = [sys.executable, str(cli), "--check"]
        subprocess.run(command, check=True, capture_output=True)
        for extra in (self.output / "old.wav", nested / "B.WAV", self.output.parent / "retired.WaV"):
            with self.subTest(extra=extra):
                extra.write_bytes(b"unexpected WAV")
                check = subprocess.run(command, capture_output=True, text=True)
                self.assertNotEqual(check.returncode, 0)
                self.assertIn(extra.name, check.stderr)
                extra.unlink()
        # Two renames also change the directory entry on case-insensitive volumes.
        b = self.output / "B.wav"
        b.rename(b.with_suffix(".tmp")).rename(self.output / "b.wav")
        check = subprocess.run(command, capture_output=True, text=True)
        self.assertNotEqual(check.returncode, 0)
        self.assertIn("b.wav", check.stderr)

    def test_shipped_check_rejects_a_public_directory_symlink(self):
        shutil.copytree(audio.OUTPUT, self.output, dirs_exist_ok=True)
        notes = self.output / "notes"
        notes.mkdir()
        loop = notes / "self"
        try:
            loop.symlink_to(".", target_is_directory=True)
        except OSError as error:
            self.skipTest(f"Directory symlinks are unavailable: {error}")
        with self.assertRaisesRegex(ValueError, "audio/notes/self"):
            audio.check_shipped_audio(self.output)
