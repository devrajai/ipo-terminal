#!/usr/bin/env python3
"""
sync_from_pipeline.py - IPO Terminal data sync from the Notion pipeline.

Pulls the Notion "IPO Tracker" data (Notion -> GitHub Actions -> data.json)
and regenerates the local data files used by the site:

  data/ipos.json          - open / upcoming / closed IPOs (merged with existing rich fields)
  data/subscriptions.json - live subscription numbers
  data/listed.json        - recently listed IPOs with prices & gains
  data/last-updated.json  - sync timestamp

The data now comes from the local Notion fetch (data/notion-data.json,
refreshed daily by .github/workflows/notion-fetch.yml). The legacy remote
pipeline URL is kept only as a fallback.

Run daily via .github/workflows/notion-pipeline-sync.yml (or manually).
"""
import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

PIPELINE_URL = "https://raw.githubusercontent.com/devrajai/ipo-website/main/data.json"  # legacy fallback
ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
LOCAL_PIPELINE = DATA / "notion-data.json"

MONTHS = {m.lower(): i + 1 for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])}

def fetch_json(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return json.load(r)

def load_pipeline():
    """Prefer the local Notion fetch (data/notion-data.json, refreshed by
    notion-fetch.yml); fall back to the legacy remote pipeline only if the
    local file is missing or unreadable."""
    if LOCAL_PIPELINE.exists():
        try:
            return json.loads(LOCAL_PIPELINE.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"warning: could not parse {LOCAL_PIPELINE} ({e}); falling back to remote")
    return fetch_json(PIPELINE_URL)

def norm(name):
    """Same normalization the site's findSub/findLink uses, for matching."""
    return re.sub("limited|ltd|\.|\s+", "", str(name or "").lower())

def parse_issue_dates(s):
    """'17-21 Sep 2026' -> ('2026-09-17', '2026-09-21')."""
    if not s:
        return None, None
    m = re.match("(\d{1,2})\s*-\s*(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})", str(s).strip())
    if not m:
        return None, None
    d1, d2, mon, year = int(m.group(1)), int(m.group(2)), MONTHS.get(m.group(3).lower()), int(m.group(4))
    if not mon:
        return None, None
    return f"{year}-{mon:02d}-{d1:02d}", f"{year}-{mon:02d}-{d2:02d}"

def load_local(path, default):
    p = DATA / path
    if p.exists():
        try:
            return json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            return default
    return default

def main():
    ours = load_pipeline()
    now = dt.datetime.now(dt.timezone(dt.timedelta(hours=5, minutes=30))).isoformat()

    existing_ipos = load_local("ipos.json", [])
    exmap = {norm(x.get("name")): x for x in existing_ipos if isinstance(x, dict)}

    # ---------- ipos.json ----------
    out, seen = [], set()
    for i in ours.get("ipos", []):
        if i.get("status") == "Listed":
            continue  # listed IPOs live in listed.json
        key = norm(i.get("company"))
        entry = dict(exmap.get(key, {}))  # keep existing rich fields (gmp, pe, roe, ...)
        entry["name"] = entry.get("name") or i["company"]
        o, c = parse_issue_dates(i.get("issueDates"))
        if o:
            entry["open_date"] = o
        if c:
            entry["close_date"] = c
        if i.get("priceBand"):
            entry["price_band"] = i["priceBand"]
        if i.get("lotSize"):
            entry["lot_size"] = i["lotSize"]
        if i.get("issueSizeCr"):
            entry["issue_size"] = "₹{:,.2f} Cr".format(i["issueSizeCr"])
        if i.get("listingDate"):
            entry["listing_date"] = i["listingDate"]
        if i.get("subscription"):
            entry["sub"] = i["subscription"]
        entry["board"] = "Mainboard" if i.get("board") == "Mainboard" else "SME"
        if i.get("sourceUrl"):
            entry.setdefault("source_url", i["sourceUrl"])
        entry["status"] = (i.get("status") or "upcoming").lower()
        out.append(entry)
        seen.add(key)

    # keep their entries we don't have (already-closed SMEs etc.)
    for x in existing_ipos:
        if isinstance(x, dict) and norm(x.get("name")) not in seen:
            out.append(x)

    (DATA / "ipos.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---------- subscriptions.json ----------
    subs = [{
        "name": i["company"], "qib": "", "nii": "", "rii": "",
        "total": i.get("subscription") or "", "applications": "",
    } for i in ours.get("ipos", []) if i.get("subscription")]
    (DATA / "subscriptions.json").write_text(
        json.dumps({"updated_at": now, "data": subs}, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---------- listed.json ----------
    existing_listed = load_local("listed.json", [])
    if not isinstance(existing_listed, list):
        existing_listed = existing_listed.get("data", [])
    lmap = {norm(x.get("name")): x for x in existing_listed if isinstance(x, dict)}
    for i in ours.get("ipos", []):
        if i.get("status") != "Listed" or i.get("currentPrice") is None:
            continue
        cur, issue = float(i["currentPrice"]), float(i.get("issuePrice") or 0)
        entry = dict(lmap.get(norm(i["company"]), {}))
        entry.update({
            "name": i["company"],
            "listing_date": i.get("listingDate") or entry.get("listing_date") or "",
            "issue_price": issue,
            "listing_price": entry.get("listing_price") or cur,
            "current_price": cur,
            "gain_loss_percent": round((cur - issue) / issue * 100, 2) if issue else 0,
            "gain_loss_value": round(cur - issue, 2) if issue else 0,
            "exchange": entry.get("exchange", ""),
            "source": "Notion IPO Tracker",
            "source_url": i.get("sourceUrl") or entry.get("source_url", ""),
            "updated_at": now,
        })
        lmap[norm(i["company"])] = entry
    listed_out = sorted(lmap.values(), key=lambda x: str(x.get("listing_date") or ""), reverse=True)
    (DATA / "listed.json").write_text(
        json.dumps(listed_out, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")

    # ---------- last-updated.json ----------
    (DATA / "last-updated.json").write_text(
        json.dumps({"updated": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}) + "\n",
        encoding="utf-8")

    print(f"sync done: {len(out)} ipos, {len(subs)} subscriptions, {len(listed_out)} listed")

if __name__ == "__main__":
    main()
