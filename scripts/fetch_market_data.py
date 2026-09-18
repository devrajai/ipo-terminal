#!/usr/bin/env python3
"""
Fetch live market data from FREE public sources (no API key, no cost) and
write data/market-data.json for the website. Designed to run inside the
GitHub Actions 5-minute auto-refresh workflow.

Sources (in priority order, with graceful fallback):
  1. NSE India allIndices API   -> India indices (Nifty/Bank/VIX/sectors)
  2. Yahoo Finance chart API    -> world indices, commodities, FX, Sensex
  3. Stooq CSV                  -> world indices/commodities fallback
  4. Frankfurter (ECB)          -> FX fallback
  5. Google Sheet gviz CSV      -> optional Way-2 bridge (GOOGLE_SHEET_ID env)

A failure in any single source or symbol NEVER breaks the run: the script
always writes valid JSON containing whatever it managed to collect.
"""
import csv
import io
import json
import os
import sys
import time
import datetime as dt
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from urllib.parse import quote

OUT = Path(__file__).resolve().parents[1] / "data" / "market-data.json"
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")

NSE_INDICES = [
    "NIFTY 50", "NIFTY BANK", "NIFTY NEXT 50", "INDIA VIX",
    "NIFTY MIDCAP 100", "NIFTY SMALLCAP 100", "NIFTY IT",
    "NIFTY AUTO", "NIFTY PHARMA", "NIFTY FMCG", "NIFTY METAL",
    "NIFTY ENERGY", "NIFTY REALTY", "NIFTY MEDIA",
]

YAHOO_WORLD = [
    ("S&P 500 (US)", "^GSPC"), ("Dow Jones (US)", "^DJI"),
    ("Nasdaq (US)", "^IXIC"), ("FTSE 100 (UK)", "^FTSE"),
    ("DAX (Germany)", "^GDAXI"), ("Nikkei 225 (Japan)", "^N225"),
    ("Hang Seng (HK)", "^HSI"), ("Euro Stoxx 50", "^STOXX50E"),
    ("ASX 200 (Australia)", "^AXJO"), ("KOSPI (Korea)", "^KS11"),
    ("Sensex (BSE)", "^BSESN"),
]

YAHOO_COMMODITIES = [
    ("Gold ($/oz)", "GC=F"), ("Silver ($/oz)", "SI=F"),
    ("Crude WTI ($/bbl)", "CL=F"), ("Crude Brent ($/bbl)", "BZ=F"),
    ("Natural Gas", "NG=F"),
]

YAHOO_FX = [
    ("USD/INR", "INR=X"), ("EUR/INR", "EURINR=X"),
    ("GBP/INR", "GBPINR=X"), ("JPY/INR", "JPYINR=X"),
]

STOOQ_WORLD = {
    "S&P 500 (US)": "^spx", "Dow Jones (US)": "^dji", "Nasdaq (US)": "^ndq",
    "FTSE 100 (UK)": "^ukx", "DAX (Germany)": "^dax", "Nikkei 225 (Japan)": "^nkx",
    "Hang Seng (HK)": "^hsi",
}
STOOQ_COMMODITIES = {"Gold ($/oz)": "xauusd", "Silver ($/oz)": "xagusd", "Crude WTI ($/bbl)": "cl.f"}


def get(url, timeout=20):
    req = Request(url, headers={"User-Agent": UA, "Accept": "application/json,text/csv,*/*"})
    with urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8")


def try_get(url, retries=2, sleep=2):
    for i in range(retries + 1):
        try:
            return get(url)
        except (HTTPError, URLError, TimeoutError, OSError):
            if i == retries:
                return None
            time.sleep(sleep)
    return None


def fetch_nse_india():
    out = []
    try:
        j = json.loads(get("https://www.nseindia.com/api/allIndices"))
        by_name = {d.get("index"): d for d in j.get("data", [])}
        for name in NSE_INDICES:
            d = by_name.get(name)
            if d and d.get("last") is not None:
                out.append({
                    "name": name.title().replace("Vix", "VIX"),
                    "symbol": name,
                    "price": d["last"],
                    "change": d.get("variation"),
                    "change_pct": d.get("percentChange"),
                })
    except Exception as e:  # noqa: BLE001
        print("WARN NSE indices failed:", e, file=sys.stderr)
    return out


def yahoo_quote(symbol):
    url = ("https://query1.finance.yahoo.com/v8/finance/chart/"
           + quote(symbol) + "?range=1d&interval=1d")
    txt = try_get(url)
    if not txt:
        return None
    meta = json.loads(txt)["chart"]["result"][0]["meta"]
    price = meta.get("regularMarketPrice")
    prev = meta.get("chartPreviousClose") or meta.get("previousClose")
    if price is None or not prev:
        return None
    return {"price": round(price, 2), "change": round(price - prev, 2),
            "change_pct": round((price - prev) / prev * 100, 2)}


def fetch_yahoo_group(pairs):
    out = []
    for name, sym in pairs:
        q = yahoo_quote(sym)
        if q:
            q.update({"name": name, "symbol": sym})
            out.append(q)
        time.sleep(0.6)  # be polite, avoid 429
    return out


def fetch_stooq(sym_map):
    out = []
    try:
        syms = "+".join(sym_map.values())
        txt = get(f"https://stooq.com/q/l/?s={syms}&f=sd2t2ohlcv&h&e=csv")
        rows = list(csv.DictReader(io.StringIO(txt)))
        rmap = {r["Symbol"].lower(): r for r in rows}
        for name, sym in sym_map.items():
            r = rmap.get(sym.lower())
            if r and r.get("Close") not in (None, "", "N/D"):
                close, prev = float(r["Close"]), float(r["Open"]) or None
                out.append({"name": name, "symbol": sym, "price": close,
                            "change": None, "change_pct": None})
    except Exception as e:  # noqa: BLE001
        print("WARN Stooq failed:", e, file=sys.stderr)
    return out


def merge_missing(primary, fallback):
    have = {i["name"] for i in primary}
    return primary + [i for i in fallback if i["name"] not in have]


def fetch_frankfurter_fx():
    out = []
    try:
        j = json.loads(get("https://api.frankfurter.app/latest?from=USD&to=INR"))
        usdinr = j.get("rates", {}).get("INR")
        if usdinr:
            out.append({"name": "USD/INR", "symbol": "USDINR",
                        "price": usdinr, "change": None, "change_pct": None})
    except Exception as e:  # noqa: BLE001
        print("WARN Frankfurter failed:", e, file=sys.stderr)
    return out


def fetch_sheet_csv(sheet_id, tab):
    if not sheet_id:
        return []
    try:
        txt = get(f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/"
                  f"tq?tqx=out:csv&sheet={tab}")
        return list(csv.reader(io.StringIO(txt)))
    except Exception as e:  # noqa: BLE001
        print(f"WARN sheet tab {tab} failed:", e, file=sys.stderr)
        return []


def main():
    data = {"updated_at": dt.datetime.now(dt.timezone.utc).isoformat()}

    india = fetch_nse_india()
    world = fetch_yahoo_group(YAHOO_WORLD)
    commodities = fetch_yahoo_group(YAHOO_COMMODITIES)
    fx = fetch_yahoo_group(YAHOO_FX)

    # fallbacks
    world = merge_missing(world, fetch_stooq(STOOQ_WORLD))
    commodities = merge_missing(commodities, fetch_stooq(STOOQ_COMMODITIES))
    fx = merge_missing(fx, fetch_frankfurter_fx())

    data["india"] = india
    data["world"] = world
    data["commodities"] = commodities
    data["fx"] = fx

    # derived MCX-style approximations
    fx_map = {i["name"]: i["price"] for i in fx if i.get("price")}
    com_map = {i["name"]: i["price"] for i in commodities if i.get("price")}
    usdinr = fx_map.get("USD/INR")
    data["derived"] = {}
    if usdinr and com_map.get("Gold ($/oz)"):
        data["derived"]["gold_inr_per_10g"] = round(com_map["Gold ($/oz)"] * usdinr / 31.1035 * 10, 2)
    if usdinr and com_map.get("Silver ($/oz)"):
        data["derived"]["silver_inr_per_kg"] = round(com_map["Silver ($/oz)"] * usdinr / 31.1035 * 1000, 2)

    # Way-2 bridge: pull editable Google Sheet tabs if configured
    sheet_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
    if sheet_id:
        data["sheet_listed_ipos"] = fetch_sheet_csv(sheet_id, "Listed_IPO_Tracker")
        data["sheet_corporate_actions"] = fetch_sheet_csv(sheet_id, "Corporate_Actions")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT}: india={len(india)} world={len(world)} "
          f"commodities={len(commodities)} fx={len(fx)}")


if __name__ == "__main__":
    main()
