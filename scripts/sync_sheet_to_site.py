"""Sync the 'IPO Tracker - India' Google Sheet into data/ipo-data.json.

Reads the Open / Upcoming / Closed / Listed tabs as public CSV (gviz).
Requires the sheet to be shared as 'Anyone with link -> Viewer'.
Merges sheet rows over the existing JSON (news / documents are kept),
then writes data/last-updated.json.
"""
import csv
import io
import json
import os
import re
import sys
import urllib.request
from datetime import datetime, timezone

SHEET_ID = os.environ.get("SHEET_ID", "1Ey8GNZ6yqg4Wu3Wtg92cbNrbgs-VL0jNnkiUUWWwsEQ")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
TABS = ["Open", "Upcoming", "Closed", "Listed"]
HEADERS = ["name","sector","openDate","closeDate","listingDate","priceLow","priceHigh",
           "lotSize","lotValue","issueSize","rii","qib","nii","overallSub","gmp",
           "estGain","de","roe","revGrowth","listingPrice","actualGain","source",
           "updatedAt","detailUrl"]


def fetch_csv(tab):
    url = ("https://docs.google.com/spreadsheets/d/%s/gviz/tq?tqx=out:csv&sheet=%s"
           % (SHEET_ID, tab.replace(" ", "%20")))
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as resp:
        text = resp.read().decode("utf-8")
    rows = list(csv.reader(io.StringIO(text)))
    if not rows:
        return []
    out = []
    for r in rows[1:]:
        if not r or not (r and r[0].strip()):
            continue
        d = {}
        for i, h in enumerate(HEADERS):
            d[h] = r[i].strip() if i < len(r) else ""
        if d["name"].lower() == "ipo name":
            continue
        out.append(d)
    return out


def num(v):
    try:
        return float(str(v).replace(",", ""))
    except (TypeError, ValueError):
        return None


def fmt_date(v):
    # accept 2026-09-08, 08/09/2026, 08/09/2026 18:30:00 -> dd/mm/yy
    if not v:
        return ""
    v = str(v).split(" ")[0].split("T")[0]
    m = re.match(r"(\d{4})-(\d{2})-(\d{2})", v)
    if m:
        return "%s/%s/%s" % (m.group(3), m.group(2), m.group(1)[2:])
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", v)
    if m:
        return "%s/%s/%s" % (m.group(1), m.group(2), m.group(3)[2:])
    return v


def slug(name):
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-") + "-ltd"


def to_site(d, status):
    low, high = num(d.get("priceLow")), num(d.get("priceHigh"))
    gmp, est = num(d.get("gmp")), num(d.get("estGain"))
    listing_price, actual_gain = num(d.get("listingPrice")), num(d.get("actualGain"))
    size = num(d.get("issueSize"))
    lot = num(d.get("lotSize"))
    o = {
        "id": slug(d["name"]),
        "name": d["name"],
        "type": "SME" if "SME" in d.get("source", "") else "Mainboard",
        "price": ("\u20b9%s-%s" % (int(low), int(high))) if low and high and low != high
                 else (("\u20b9%s" % int(low)) if low else "\u2014"),
        "lot": str(int(lot)) if lot else "\u2014",
        "size": ("\u20b9%s Cr" % size) if size else "\u2014",
        "open": fmt_date(d.get("openDate")),
        "close": fmt_date(d.get("closeDate")),
        "listing": fmt_date(d.get("listingDate")),
        "sub": ("%sx" % d["overallSub"]) if d.get("overallSub") else "\u2014",
        "gmp": ("\u20b9%s" % int(gmp)) if gmp is not None else "\u2014",
        "gmp_pct": ("%+.1f%%" % est) if est is not None else "\u2014",
        "est_list": ("\u20b9%s" % int(high + gmp)) if (high and gmp is not None) else "\u2014",
        "sector": d.get("sector") or "\u2014",
        "de": (str(num(d.get("de"))) if num(d.get("de")) is not None else "\u2014"),
        "roe": (str(num(d.get("roe"))) if num(d.get("roe")) is not None else "\u2014"),
        "growth": (str(num(d.get("revGrowth"))) if num(d.get("revGrowth")) is not None else "\u2014"),
        "status": status,
        "source": "Google Sheet IPO Tracker",
        "source_url": d.get("detailUrl", ""),
        "gmp_source": "IPO Ji / IPO360 / IPOSathi",
        "gmp_updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if status == "listed":
        o["listingPrice"] = listing_price
        o["gainPercent"] = actual_gain
        o["gainRupees"] = (listing_price - low) if (listing_price is not None and low is not None) else None
    return o


def main():
    path = os.path.join(DATA, "ipo-data.json")
    existing = {}
    keep = {"news": [], "documents": []}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            old = json.load(f)
        for x in old.get("ipos", []):
            existing[x.get("name", "").lower()] = x
        keep["news"] = old.get("news", [])
        keep["documents"] = old.get("documents", [])

    counts = {}
    sheet_entries = {}
    for tab in TABS:
        rows = fetch_csv(tab)
        counts[tab] = 0
        for d in rows:
            if not d.get("name"):
                continue
            entry = to_site(d, tab.lower())
            sheet_entries[d["name"].lower()] = entry
            counts[tab] += 1

    merged = dict(existing)
    merged.update(sheet_entries)
    ipos = list(merged.values())

    out = {
        "source": "google-sheet-ipo-tracker",
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "sources": {"GOOGLE_SHEET": {"ok": True, "records": len(ipos), "errors": []}},
        "ipos": ipos,
        "listed": [x for x in ipos if x.get("status") == "listed"],
        "news": keep["news"],
        "documents": keep["documents"],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)

    with open(os.path.join(DATA, "last-updated.json"), "w") as f:
        json.dump({"updated_at": out["updated_at"], "source": "google-sheet"}, f, indent=2)

    print("Sheet sync done: %s" % counts)
    if not any(counts.values()):
        print("ERROR: no rows read - is the sheet shared 'Anyone with link'?")
        sys.exit(1)


if __name__ == "__main__":
    main()
