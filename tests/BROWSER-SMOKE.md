# Browser acceptance test

`node tests/browser-smoke.mjs` runs a Chromium-based end-to-end test of maze editing, encounter notes, stereo drawing, photo wall detection and autosave. GitHub Actions installs Playwright and Chromium before invoking it.

Only the real iPhone + Cardboard hardware verification remains manual.
