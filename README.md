# Egg Hunt

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

A small browser game: many procedurally drawn Easter eggs fill the screen with stripes, dots, bands, and speckles. One egg is the hidden target — click it to win, then play again for a new layout.

## Run locally

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`).

## Build for static hosting

```bash
npm run build
```

Upload the `dist/` folder to any static host (GitHub Pages, Netlify, etc.).

## iOS (Capacitor)

```bash
npm run sync:ios    # builds and syncs to the Xcode project
npx cap open ios    # opens Xcode
```

Select a simulator and press **Run (⌘R)**.

## How it works

Use a mouse or touch. The topmost egg under your pointer wins the hit test, so overlapping eggs behave like stacked cutouts. Score points by finding the target egg before time runs out — reach 250 points to unlock the Golden Yolk round.

## Contributing

Issues and pull requests are welcome. Please open an issue first if you'd like to discuss a larger change.

## License

[MIT](./LICENSE)
