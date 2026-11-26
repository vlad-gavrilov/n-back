# Assets and licenses

## Spoken letters

The B, F, H, J, M, Q, R and W clips come from *English alphabet*, recorded by Robotnick2 on 19 October 2010. The source and the adapted clips use Creative Commons Attribution-ShareAlike 3.0 Unported. The site footer links to the shipped notice, which credits the author and describes the edits. [Original recording](https://commons.wikimedia.org/wiki/File:English_alphabet.ogg) · [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) · [Audio notice](../public/licenses/robotnick2-CC-BY-SA.txt)

Each clip is mono 16-bit PCM at 22050 Hz, with 8 ms fades at both edges and a target active RMS of −20 dBFS. Builds use the checked-in WAV files.

### Verify or regenerate the WAVs

Run the validator from the repository root. It uses only the Python standard library.

```sh
python3 scripts/generate-audio.py --check
```

The check verifies the eight approved filenames and SHA-256 digests and reports additional WAVs under `public/`. It checks PCM format, actual frame count, duration (100–750 ms), signal level, clipping, surrounding silence and differences in volume between letters.

To regenerate, install FFmpeg and run the command below. FFmpeg 9.1 produced the approved bytes. The generator checks the SHA-256 of the bundled source recording and uses the millisecond cut points in `SEGMENTS_MS`. [Source recording](../scripts/English_alphabet.ogg) · [Generator](../scripts/generate-audio.py)

```sh
python3 scripts/generate-audio.py
```

The generator validates the whole set before replacing it. On retry, it recovers an interrupted directory swap before decoding the source. If the audio directory has already been recreated, it preserves the previous files under `.cache/` and prints their location.

When intentionally changing the recordings or decoder version, listen to each letter at the fastest one-second trial interval. Update `APPROVED_SHA256` with the reviewed digests and bump the audio cache version in [the player](../src/audio/player.ts).

## Font and JavaScript notices

- **Manrope** ships through `@fontsource/manrope`, including the Cyrillic fonts for the Russian interface. [SIL Open Font License](../public/licenses/manrope-OFL.txt)
- **React, React DOM and Scheduler** use the MIT license. Vite collects their installed notices in `dist/licenses/dependencies.md` at build time. The Pages workflow checks each package’s notice before publication.
