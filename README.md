# IPO Terminal

A continuously updating research terminal for Indian Mainboard and SME IPOs — a static site on GitHub Pages fed by an automatic 15-minute data pipeline. No server, no API keys, no cost.

**Live:** https://devrajai.github.io/ipo-terminal/

> **Repo consolidation (2026-09-21):** This is now the single IPO repository. The former
> `ipo-tracker-india` (Google Sheets tracker) and `ipo-website` (Notion-based tracker)
> repos were merged in — see [`archive/`](./archive/) for what was preserved, and the
> `notion-fetch.yml` + `scripts/fetch-notion.mjs` + `data/notion-data.json` pipeline
> that replaced the ipo-website data feed.

## What's on the terminal

- **Open / Upcoming / Closed IPO cards** — dates, price band, lot size, issue size, GMP with computed GMP %, subscription, and one-click actions:
  - **📈 GMP** — grey-market premium detail per IPO: premium in ₹, GMP % (computed as GMP ÷ lower price band), estimated listing, per-lot impact, and a use-with-care warning.
  - **📋 RHP / DRHP** — the most direct document link available: issuer/SEBI-hosted PDF first, SEBI filing page second, exchange gateway only as last resort.
  - **🎯 Allotment Link** — the registrar's per-IPO allotment status page when resolved; otherwise the CDSL / NSDL / BSE / NSE portals.
- **📈 GMP Live tab** — all live IPO names with GMP ₹ and GMP %, either from the repository data (refreshed by the pipeline) or from a **live Google Sheet feed** (see below).
- **Tips** — a detailed, vetted selection strategy: reading the RHP, judging the business, ratio checks, valuation vs peers, subscription quality, GMP usage, SME caution, and listing-day exit planning.
- **Glossary** — full explanations of P/E, P/B, ROE, ROCE, P/L and D/E with formulas and Indian-market benchmarks, plus the core IPO terms.
- **Listed / Allotment / News / RHP-DRHP** sections and a command-center header with IST clock.

## How the pieces fit

```
Chittorgarh / NSE / SEBI  (public sources)
        │  scripts/update_data.py + enrichers   (GitHub Actions, every 15 min)
        ▼
data/*.json  (ipos, gmp, subscriptions, drhp, news, ipo-links ...)
        │  scripts/link_health.py  - resolves per-IPO RHP/DRHP + allotment
        │                             links, verifies them, self-heals 404s
        ▼
GitHub Pages  (index.html + data, deployed on every push)
        │  (optional) data/feed-config.json -> live Google Sheet feed
        ▼
IPO Terminal
```

### Notion pipeline (merged from ipo-website)

```
Notion "IPO Tracker" database
        │  scripts/fetch-notion.mjs   (GitHub Actions, daily 08:30 IST — notion-fetch.yml)
        ▼
data/notion-data.json
        │  scripts/sync_from_pipeline.py  (daily 09:00 IST — notion-pipeline-sync.yml)
        ▼
data/ipos.json + subscriptions.json + listed.json
```

## Self-healing links

`scripts/link_health.py` runs inside the 15-minute pipeline:

- **RHP/DRHP resolution priority:** direct `.pdf` document → SEBI per-company filing page → exchange gateway (last resort).
- **Allotment resolution:** registrar status pages (Bigshare, KFin, Link Intime …) discovered from each IPO's detail page.
- Every stored link is re-verified each run. A 404/410 is dropped and **re-derived from the source page** — never guessed. A 404 on an allotment link usually means the registrar has not published yet, so it is kept and marked pending.
- Health history is written to `data/link-health.json` (last 50 runs).

## Live GMP feed (optional)

The GMP Live tab runs on repository data by default. To connect a live Google Sheet feed:

1. In the **IPO Tracker - India** spreadsheet: Extensions > Apps Script, make sure `IPO_Tracker_API.gs` (from this repo's `apps-script/IPO_Tracker_AllInOne.gs` — the single-file merged version) is in the project.
2. Deploy > New deployment > Web app — Execute as: Me, Who has access: Anyone.
3. Paste the `/exec` URL into `feed_url` in `data/feed-config.json` and commit.

The badge on the GMP tab turns green ("LIVE — Google Sheet feed") once connected.

## Data integrity

Missing data is displayed as unavailable rather than guessed. GMP is unofficial grey-market data and is treated as a supporting signal only. This is an informational research tool, **not investment advice**.

See `README-AUTO.md` for the full pipeline documentation.

## Google Sheet auto-tracker (Apps Script)

`apps-script/IPO_Tracker_AllInOne.gs` is the complete single-file Google Apps
Script behind the **"IPO Tracker - India"** Google Sheet - the Sheet-side
companion of this repository's Python pipeline:

- daily Chittorgarh scrape into **Upcoming / Open / Closed / Listed** tabs
  (price band, lot size, issue size, subscription, GMP + GMP Log history)
- **Fundamentals tab** - fresh issue %, OFS %, PAT margin, P/E, D/E per IPO,
  auto-collected with careful parsing; manual Score / Verdict columns are
  never overwritten
- **Lot Planner tab** - type a budget in B1 and see lots, money blocked,
  estimated gain and allotment odds for every open IPO (mainboard retail cap
  Rs 2 lakh lottery vs SME 2-lot rule)
- **doGet() JSON feed** - optional live feed for this website's GMP Live tab
  (Deploy > Web app, put the /exec URL in data/feed-config.json)
- **self-healing link monitor** - re-resolves dead RHP/DRHP/allotment links
  every 30 minutes

Install: Extensions > Apps Script in the Sheet, paste the file, run
`updateAll` once, then `installAllTriggers` once.

The two systems share the same free sources: the Python pipeline feeds the
website, the Apps Script feeds the Google Sheet.
