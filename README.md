# N-back

A visual and dual N-back exercise with English and Russian interfaces, built with React, TypeScript and Vite. All game assets ship with the static site. No account, history, analytics or backend. Only the theme and interface language preferences are stored locally.

## Local development

Use Node.js 24 (see `.nvmrc`).

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. For a phone on the same network, use the computer's LAN address and the printed port. Allow network access only on a trusted network.

```sh
npm run check
npm run build
npm run preview
```

`check` runs ESLint, unit tests, TypeScript checking and the production build. `dist/` is the complete static site.

For browser tests, install the browsers once:

```sh
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

## Playing

Choose Visual or Dual, N from 1 to 9, and a field size from 2 to 6. Press only when the current position or spoken letter matches exactly N steps earlier. The first N trials are warm-up, followed by 20 scored trials. In Visual mode use Space. In Dual use V for position, A for audio, or both. Touch controls provide the same actions. Active-round shortcuts work throughout the active page without focusing the game region. A/V refer to physical key positions, including Russian ф/м; keyboards with incomplete physical codes also support these characters. Typing in editable controls and open dialogs does not answer trials. Space/Enter retain the focused button's action; holding a key does not answer later trials.

Dual mode needs sound. Use Test sound before starting; its loading, success and error messages appear beside that control in settings. Closing mobile settings during preparation lets the test continue and moves its feedback to the main screen, without starting a round. Errors offer retry and Visual mode. Backgrounding, rotation, a timing interruption or audio interruption ends the current round without a score; a separate card explains the interruption and offers a fresh round.

Adjust session opens mobile settings or focuses the desktop settings panel. Results remain available until a game parameter actually changes. Dialogs keep the background still and restore scroll position and focus when closed; clicking inside the panel, including its padding, keeps it open.

See [exercise parameters and sources](docs/research.md).

## Publication by the repository owner

No remote repository, Pages, DNS or HTTPS configuration is performed by the local project setup.

1. Create a GitHub repository and upload this project, including `package-lock.json`, excluding ignored files.
2. Set its default branch to `main` and enable Actions.
3. In Settings → Pages, choose GitHub Actions as the publication source.
4. If using a custom domain, add it in Pages settings before changing DNS.
5. At the DNS provider, create a CNAME record for the chosen subdomain pointing directly to `<github-owner>.github.io`, without a repository path.
6. Run the supplied Check and publish N-back workflow from `main`, or push a change to that branch. It checks and builds the site, runs browser tests, then publishes the artifact.
7. Wait for domain verification and certificate issuance; enable Enforce HTTPS in Pages settings.
8. Open the HTTPS domain, reload it, and check fonts, sounds and the complete game on the intended devices.

Vite uses `/` as the base for the custom domain. For publication under a repository subpath instead, change Vite's `base` before building. The workflow does not need a CNAME file.

## Device acceptance

Automated browser tests do not replace testing on physical phones and tablets. Verify sound, two simultaneous responses, browser toolbars, rotation and return after locking in the browsers being supported.

## Assets

Manrope is bundled by `@fontsource/manrope` under its included OFL license. Letter WAV files are generated using the macOS Samantha English (US) voice and explicit letter names, without a spoken “Capital” prefix. They are not copied from another N-back site. Each file is mono 16-bit PCM at 22050 Hz.

To regenerate on macOS with Samantha installed, run `python3 scripts/generate-audio.py`. Run `python3 scripts/generate-audio.py --check` to validate the existing files without synthesis. The script uses only the Python standard library and macOS tools; ordinary builds use the bundled WAVs on any supported build platform. After changing recordings, update the audio-set version in the loader URL to invalidate old browser caches. Listen to each file as well: waveform checks do not verify pronunciation.

## Interface languages

Use EN / RU in the desktop header or open Session settings beside the game heading on mobile (no flags). English is the initial language regardless of browser settings. Your selection is saved as `nback-locale`; unavailable storage falls back to English on the next visit. Language changes preserve settings, theme, tutorial step and results, and are disabled during audio preparation and active rounds. Dialogs also provide the language control. The interface and accessibility labels are translated; spoken letter stimuli and physical A/V keys remain English. Cyrillic Manrope fonts ship with the site.
