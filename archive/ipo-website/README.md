# Archived: ipo-website

This folder preserves the **ipo-website** repository (deleted 2026-09-21 after merging into ipo-terminal).

## What this was

A free, automatically-updated IPO tracker website for Mainboard and SME IPOs. A GitHub Action pulled the "IPO Tracker" Notion database daily and regenerated data.json for a GitHub Pages site.

## Where its parts live now

- **scripts/fetch-notion.mjs** — now [`scripts/fetch-notion.mjs`](../../scripts/fetch-notion.mjs) in this repo (writes `data/notion-data.json`)
- **.github/workflows/update-data.yml** — now [`.github/workflows/notion-fetch.yml`](../../.github/workflows/notion-fetch.yml)
- **data.json** — lives on as [`data/notion-data.json`](../../data/notion-data.json), refreshed daily by the workflow
- **index.html** — the old website's UI, kept here for reference (superseded by the IPO Terminal site)

## Setup note

The Notion secrets (`NOTION_TOKEN`, `NOTION_DATABASE_ID`) must be added to this repo's Settings → Secrets and variables → Actions for the daily fetch to run.
