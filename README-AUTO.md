# IPO Terminal — free automatic mode

This version keeps the existing single-file website but adds a free automatic data layer.

## How it works
- `index.html` loads `data/ipo-data.json` automatically.
- If the generated file is unavailable, the existing embedded data remains as a fallback.
- `.github/workflows/update-ipo-data.yml` runs every 15 minutes.
- `scripts/update_data.py` starts with official SEBI public-issue discovery and can be expanded with NSE/BSE/dividend adapters.

## GitHub Pages
Upload these files to a GitHub repository and enable **Settings → Pages → Deploy from branch**.

GitHub Actions is used for scheduled collection. No paid API is required for this first layer.

## Important
Do not treat scraped/grey-market values as guaranteed facts. Keep source URL and retrieval time with every record when additional adapters are added.
