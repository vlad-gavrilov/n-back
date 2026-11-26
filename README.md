# N-back

A browser-based working memory exercise with Visual and Dual modes and an English or Russian interface. Built with React, TypeScript and Vite. Rounds run locally. The app stores only your theme and language preferences.

## How to play

Respond when the current position or spoken letter matches the one exactly **N steps earlier**. The first N trials are warm-up. The next 20 count toward your score.

| Mode | Position match | Letter match |
| --- | --- | --- |
| Visual | Space | — |
| Dual | F | J |

In Dual mode, press both keys if both match. On a touchscreen, tap the corresponding buttons.

## Run locally

Use Node.js 24 and run these commands from the project root.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. Run `npm run check` to lint, test and build the static site in `dist/`.

## Documentation

- [Player guide](docs/playing.md) — settings, sound, controls and interrupted rounds.
- [Exercise parameters and research](docs/research.md) — timing, scoring and level recommendations.
- [Development and testing](docs/development.md) — source layout, browser tests and device checks.
- [Deployment](docs/deployment.md) — GitHub Pages and custom domains.
- [Assets and licenses](docs/assets.md) — credits, notices and audio regeneration.
