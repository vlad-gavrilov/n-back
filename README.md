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

Browser tests use a silent audio output and cover loading errors, timeouts, retry, interruption and Dual controls. One sound test decodes all eight bundled recordings with the browser's native offline audio decoder. Check pronunciation and speaker or headphone playback on the target device.

## Where to make changes

- `src/game/config.ts` defines the supported settings and round constants. `sequence.ts` generates the stimuli and `scoring.ts` computes statistics and the next level. `session.ts` schedules each cue with a monotonic clock, accepts responses and publishes the round state. The clock and random source can be replaced in tests.
- `src/training/controller.ts` owns the selected settings, the current round and the pending sound operation. A failed start carries the requested level into the retry. Cancelling an operation also prevents a late completion from starting a round. `useTraining.ts` connects the controller to React and the page lifecycle.
- `src/audio/player.ts` owns the Web Audio context, decoded letter buffers and playing sources. `src/input/` handles physical keys, focused button activation and focus indicators.
- `src/App.tsx` composes the screen and routes dialogs and audio feedback. `src/components/` contains the settings, board, results and tutorial. `src/styles/` holds their styles and responsive rules.
- `src/i18n/` contains the English and Russian dictionaries and number formats. `src/preferences/` synchronizes the selected language and theme with the document and browser storage.

## Playing

Choose Visual or Dual, N from 1 to 9, and a field size from 2 to 6. Press only when the current position or spoken letter matches exactly N steps earlier. The first N trials are warm-up, followed by 20 scored trials. In Visual mode use Space. In Dual use F for position, J for audio, or both. Touch controls provide the same actions. Active-round shortcuts work throughout the active page without focusing the game region. F and J are the physical keys marked А and О on a Russian keyboard. If the browser omits the physical key code, the game also recognizes these Latin and Cyrillic letters. Typing in editable controls and open dialogs does not answer trials. Space/Enter answer a focused response button on keydown and retain other focused buttons' actions; holding or releasing a key does not answer later trials. In forced-colors mode, field and tutorial markers use the system palette to remain visible.

Dual mode needs sound. Use Test sound before starting; its loading, success and error messages appear beside that control in settings. Closing mobile settings during preparation lets the test continue and moves its feedback to the main screen, without starting a round. Errors offer retry and Visual mode. Retrying a session from settings closes the dialog before preparing the round. Backgrounding, rotation or a timing interruption ends the current round without a score; an audio interruption also ends a Dual round. Events from a previously prepared audio context do not interrupt Visual rounds. A separate card explains interruptions and offers a fresh round.

Before a round, open Session settings if the window is at most 864 px wide or if a landscape window is at most 560 px tall (for example, 1200 × 500). At other sizes, settings sit to the left of the field. During play, progress and Stop appear above the field. The response buttons become available after warm-up, below the field in portrait and on either side when a short landscape window has enough room.

Adjust session opens the settings dialog on every screen. Result actions are disabled while preparing the next round. Results remain available until a game parameter actually changes. Dialogs keep the background still and restore scroll position and focus when closed; clicking inside the panel, including its padding, keeps it open.

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

See [Assets and licenses](docs/assets.md) for notices and audio regeneration instructions.

## Interface languages

Use EN / RU in the desktop header or open Session settings beside the game heading on mobile (no flags). English is the initial language regardless of browser settings. Your selection is saved as `nback-locale`; unavailable storage falls back to English on the next visit. Language changes preserve settings, theme, tutorial step and results, and are disabled during audio preparation and active rounds. Dialogs also provide the language control. Both languages use translated interface and accessibility labels, English spoken letters, and F/J shortcut labels. Cyrillic Manrope fonts ship with the site.
