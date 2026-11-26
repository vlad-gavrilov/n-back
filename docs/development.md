# Development and testing

Use the Node.js version in [.nvmrc](../.nvmrc). The [README](../README.md#run-locally) has the install and start commands. To test from a phone on the same trusted network, open the computer’s LAN address and the port printed by Vite.

## Run checks

```sh
npm run check
python3 -B -m unittest discover -s scripts
python3 scripts/generate-audio.py --check
```

`npm run check` runs ESLint, unit tests, TypeScript checking and a production build. To inspect that build locally, run `npm run preview`. For a build on its own, use `npm run build`. The Python commands exercise the audio generator and verify the bundled recordings. See [Assets and licenses](assets.md) for regeneration instructions.

## Browser and device tests

Install the Playwright browsers once. Build the current checkout before running the browser suite.

```sh
npx playwright install chromium firefox webkit
npm run build
npm run test:e2e
```

Playwright starts its own preview of `dist/` on port 4187. Browser tests use silent audio output to exercise loading errors, timeouts, retry, interruptions and Dual controls. One test decodes all eight bundled recordings with the browser’s native offline audio decoder.

On a physical phone or tablet, play a Dual round through speakers or headphones. Check letter pronunciation at the fastest pace, press both response buttons together and check the layout as the browser toolbars move. Rotate the device and return to the page after locking it to check how the round handles interruptions.

## Source layout

| Path | Responsibility |
| --- | --- |
| [src/game/](../src/game/) | Supported settings and round constants in `config.ts`, stimuli in `sequence.ts`, scores and level recommendations in `scoring.ts`. `session.ts` schedules cues on a monotonic clock, accepts responses and publishes round state. |
| [src/training/](../src/training/) | `controller.ts` owns the settings, current round and pending audio operation. A failed start retains the requested level for retry. Cancelling preparation prevents a late completion from starting a round. `useTraining.ts` connects the controller to React and the page lifecycle. |
| [src/audio/player.ts](../src/audio/player.ts) | Web Audio context, decoded letter buffers and playing sources. |
| [src/input/](../src/input/) | Keyboard shortcuts, input timestamps, focused-button activation and focus indicators. |
| [src/App.tsx](../src/App.tsx), [components](../src/components/) and [styles](../src/styles/) | Screen composition, dialogs, audio feedback, board, results, tutorial and responsive layout. |
| [src/i18n/](../src/i18n/) and [src/preferences/](../src/preferences/) | English and Russian dictionaries, number formats and document settings. The selected language is stored under `nback-locale` and a manual theme choice under `nback-theme`. |

`Session.stop()` cancels timers and audio during teardown without notifying subscribers. The user-facing Stop action calls `interrupt('stopped')` so subscribers receive the interrupted state. Stopping playback disconnects active sources and keeps the decoded letters for the next round. Switching to Visual or unmounting the trainer clears those buffers and closes the audio context.
