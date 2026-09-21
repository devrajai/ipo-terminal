# Archived: ipo-tracker-india

This folder preserves the **ipo-tracker-india** repository (deleted 2026-09-21 after merging into ipo-terminal).

## What this was

A self-updating IPO tracker for Indian Mainboard + SME IPOs, built with Google Sheets + Apps Script, with a public website served via GitHub Pages.

## Where its parts live now

- **Apps Script code** — already merged into [`apps-script/IPO_Tracker_AllInOne.gs`](../../apps-script/IPO_Tracker_AllInOne.gs) (a superset of the original IPO_Tracker_AppsScript.gs + IPO_Tracker_API.gs, which this repo already contained before the merge)
- **CSV snapshots** — [`data/`](./data/) here (open / upcoming / closed / listed / gmp_log / config, as of 17/09/2026)
- **config.js** — kept here (old site's feed configuration)
- **index.html** — the old website's UI, kept here for reference (superseded by the IPO Terminal site)

## Note on the Google Sheet

The "IPO Tracker - India" Google Sheet is unchanged — its Apps Script was pasted into the Sheet itself and runs independently of any GitHub repo. The Sheet keeps updating daily via its own triggers.
