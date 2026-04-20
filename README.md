# IsotopePatternSimulator

Static web app for isotopic pattern simulation from molecular formula input.

## Features

- Molecular formula parser with support for nested parentheses
- Isotopic envelope calculation from built-in natural abundance data
- Gaussian peak broadening with adjustable resolving power
- Interactive Plotly chart for zooming, hovering, and image export
- CSV download for centroid peaks and simulated profile data
- GitHub Pages-friendly deployment with no backend

## Run locally

Open [index.html](./index.html) in a browser, or serve the repository with any static file server.

## Smoke tests

Run:

```bash
npm test

# or run individual suites:
node tests/nmr-predictor-smoke.test.js
node tests/nmr-predictor-aromatic-trends.test.js
node tests/nmr-predictor-parser-edgecases.test.js
```

## Deploy to GitHub Pages

1. Push the repository to GitHub.
2. In repository settings, enable GitHub Pages from the default branch root.
3. The app will be served as static files directly from this repository.
