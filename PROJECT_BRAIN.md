# IPO TERMINAL — PROJECT BRAIN

Single source of truth. Any AI session starts here. Owner: Dev (mobile-only user, Android Chrome).
Website: https://devrajai.github.io/ipo-terminal/ | Repo: devrajai/ipo-terminal

## Mission
Dev's personal all-in-one India IPO + market terminal. Free forever. Mobile-first. Goal: a personal poor-man's Aladdin.

## Hard Rules (from Dev)
- NO paid APIs ever. NO DR.VIDHI branding. Title style: IPO TERMINAL - AUTO.
- 12 toggle panels must stay: Open, Upcoming, DRHP Filed, Listed G/L, Comparison, Allotment, News, RHP/DRHP, Tips, Brokers, Glossary, Why Apply.
- Only 3 KPI cards: Open / Upcoming / Closed.
- Dates dd/mm/yy. All times IST — always use Asia/Kolkata explicitly.
- Sarvam AI assistant is the ONLY developer on this project (no GPT, no other AI).
- Dev is on a weekly message limit: be efficient, build in phases, never redo work.

## Architecture — Two Ways (both free)
1. WAY 1 — GitHub Actions auto-refresh every 5 min: .github/workflows/update-ipo-data.yml
   - scripts/update_data.py — IPO data from NSE/BSE/SEBI public sources
   - scripts/fetch_market_data.py — India indices (NSE allIndices API), world indices/commodities/FX (Yahoo chart API with 0.6s delay, Stooq and Frankfurter fallbacks), plus Google Sheet bridge (GOOGLE_SHEET_ID)
   - Writes data/*.json, auto-committed by github-actions bot
2. WAY 2 — Google Sheet "Market Data Hub" (ID: 1zdqNSE_1DGCGeh2xQ0ltSULo4ubW4cm_w06K_MFMVjI, public link, auto-recalc every minute, IST)
   - Tabs: Dashboard(Sheet1), India_Indices, World_Markets, Commodities_FX, Nifty50_Stocks, Sensex_Stocks, Listed_IPO_Tracker, IPO_GMP_Subscription, Corporate_Actions, How_To_Connect
   - Bridge active via repo variable GOOGLE_SHEET_ID (workflow reads vars.GOOGLE_SHEET_ID || secrets.GOOGLE_SHEET_ID)
   - Listed_IPO_Tracker + Corporate_Actions tabs are auto-pulled into data/market-data.json

## Current Status (updated 21/09/2026)
- Website live with 5-min auto data refresh; market data pipeline live (Way 1 + Way 2)
- Daily brain run cron scheduled 6:30 PM IST: research IPO news, fix stale data, deliver digest
- Pro Tools (scripts/ipo-protools.js) now has 6 tabs: Calculator (NEW 21/09/26 — Apply Cost / GMP Return / P&L, IPO dropdown auto-filled from live ipo-data.json, default tab), Track Record, My Apps, Planner, Calendar, Why & Sources
- Next: Phase 1 — Screener layer (Nifty 500: PE, PB, ROE, ROCE, D/E, promoter/DII/FII holding, EMA 20/200, RSI, MACD, 52w/200d high-low)

## Roadmap (one phase at a time — never all at once)
- Phase 1: Screener layer — Nifty 500 fundamentals + technicals auto-computed daily (compute technicals in Python from free price history)
- Phase 2: Pre-open movers 9:00-9:15, FII/DII flows, index add/remove, consecutive up/down days, volume spikes
- Phase 3: Super-investor portfolios (Kedia, Damani, Jhunjhunwala via quarterly shareholding), AMFI mutual funds, panchang calendar, war/world news
- Phase 4: Personal watchlist, education library (trader strategies, best books), quarterly results calendar, US mega-caps (NVDA/GOOGL/META)
- NOT possible free (do not waste time): live X/Twitter data, TX3 feeds, proprietary fund positions, tick-by-tick data, Finage (no India data, $599+/month)

## Data Source Facts (learned the hard way)
- NSE allIndices API (https://www.nseindia.com/api/allIndices): works, no key, 139 indices
- Yahoo query1 chart API: works but rate-limits rapid sequential calls — keep 0.6s delay
- GOOGLEFINANCE quirks: INDEXNSE:* works. Currencies work WITHOUT the price attribute. COMEX/NYMEX futures NOT supported. INDEXBSE:SENSEX NOT supported. Working index symbols: NIFTY_50, NIFTY_BANK, NIFTY_IT, NIFTY_MIDCAP_50, NIFTY_NEXT_50, INDIA_VIX, NIFTY_FIN_SERVICE. NOT working: NIFTY_MIDCAP_100, NIFTY_SMALLCAP_100
- Public sheet CSV: https://docs.google.com/spreadsheets/d/{ID}/gviz/tq?tqx=out:csv&sheet=TabName
- GitHub contents API GET fails on .github/ paths — fetch blob by SHA instead
- Sandbox: keep build scripts in /workspace/notes/ (durable); /scratch/work is wiped on restart

## Conventions
- data JSONs in data/, scripts in scripts/, commit prefixes feat:/chore:/fix:
- Allotment links: BSE https://www.bseindia.com/investors/appli_check.aspx | NSE https://www.nseindia.com/market-data/all-upcoming-issues-ipo
- GMP sources: Chittorgarh, IPO Watch, Livemint, Moneycontrol (GMP is unofficial — always label it)
