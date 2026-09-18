"""Enrich missing IPO card fields from current public web articles.

Priority:
1) Existing structured collector data.
2) Public web article evidence for missing fields.
3) Google Sheet DATA_OVERRIDES is applied later by the workflow as the final fallback.

This script never overwrites a non-missing field and records the source used.
"""
from __future__ import annotations

import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "ipo-data.json"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal-WebFallback/1.0"
RSS = "https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en"
MISSING = {None, "", "-", "—", "N/A", "NA", "null", "None", "₹0 Cr", "0 Cr"}

TRUST = {
    "zerodha.com": 100,
    "moneycontrol.com": 95,
    "economictimes.indiatimes.com": 95,
    "livemint.com": 92,
    "goodreturns.in": 90,
    "valueresearchonline.com": 88,
    "indmoney.com": 86,
    "kotakneo.com": 84,
    "chittorgarh.com": 82,
    "equitytale.com": 78,
    "ipowatch": 74,
}

def clean(v):
    v = html.unescape(str(v or ""))
    v = re.sub(r"<[^>]+>", " ", v)
    return " ".join(v.split()).strip()

def request_text(url, timeout=20):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", "ignore")

def domain_score(url):
    low = str(url or "").lower()
    for domain, score in TRUST.items():
        if domain in low:
            return score
    return 50

def norm_name(v):
    s = clean(v).lower()
    s = re.sub(r"\b(limited|ltd|india|private|pvt|company|technologies|technology)\b", " ", s)
    return re.sub(r"[^a-z0-9]+", "", s)

def number(v):
    m = re.search(r"-?[0-9]+(?:\.[0-9]+)?", str(v or "").replace(",", ""))
    return float(m.group(0)) if m else None

def fmt_num(x):
    if x is None:
        return ""
    return str(int(x)) if float(x).is_integer() else str(round(float(x), 2))

def parse_price(text):
    patterns = [
        r"(?:price\s*band|price\s*range|issue\s*price)[^₹0-9]{0,80}(?:₹|rs\.?\s*)\s*([0-9]{2,6}(?:\.[0-9]+)?)\s*(?:-|to|–|—)\s*(?:₹|rs\.?\s*)?\s*([0-9]{2,6}(?:\.[0-9]+)?)",
        r"(?:₹|rs\.?\s*)\s*([0-9]{2,6}(?:\.[0-9]+)?)\s*(?:-|to|–|—)\s*(?:₹|rs\.?\s*)?\s*([0-9]{2,6}(?:\.[0-9]+)?)\s*(?:per\s*share)?",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            a, b = float(m.group(1)), float(m.group(2))
            return f"₹{fmt_num(a)}-{fmt_num(b)}"
    return None

def parse_lot(text):
    patterns = [
        r"(?:lot\s*size|minimum\s*lot|1\s*lot)[^0-9]{0,50}([0-9]{2,6}(?:,[0-9]{3})?)\s*(?:shares?)?",
        r"(?:lot\s*size)[^0-9]{0,20}([0-9]{2,6}(?:,[0-9]{3})?)",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            n = int(m.group(1).replace(",", ""))
            if 10 <= n <= 100000:
                return str(n)
    return None

def parse_size(text):
    patterns = [
        r"(?:issue\s*size|issue\s*of)[^₹0-9]{0,80}(?:₹|rs\.?\s*)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:crore|cr\.?|crores)",
        r"(?:₹|rs\.?\s*)\s*([0-9]+(?:\.[0-9]+)?)\s*(?:crore|cr\.?|crores)[^\n]{0,80}(?:issue|ipo)",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return f"₹{fmt_num(float(m.group(1)))} Cr"
    return None

def parse_gmp(text):
    # Do not infer GMP from an estimated listing price. Only accept an explicit GMP label.
    patterns = [
        r"(?:gmp|grey\s*market\s*premium)[^₹0-9-]{0,80}(?:₹|rs\.?\s*)\s*(-?[0-9]+(?:\.[0-9]+)?)",
        r"(?:gmp|grey\s*market\s*premium)[^\n]{0,80}\b(0)\b",
    ]
    for p in patterns:
        m = re.search(p, text, re.I)
        if m:
            return f"₹{fmt_num(float(m.group(1)))}"
    if re.search(r"no\s+(?:gmp|grey\s*market\s*premium)|gmp\s*(?:is\s*)?(?:not\s*)?(?:available|reported)", text, re.I):
        return "₹0"
    return None

def parse_subscription(text):
    m = re.search(r"(?:subscription|subscribed)[^0-9]{0,60}([0-9]+(?:\.[0-9]+)?)\s*x", text, re.I)
    return f"{m.group(1)}x" if m else None

def parse_article(url):
    try:
        raw = request_text(url)
        return clean(raw)[:600000]
    except Exception:
        return ""

def current_missing(row):
    return any(row.get(k) in MISSING for k in ("price", "lot", "size", "gmp"))

def enrich_row(row):
    name = clean(row.get("name"))
    if not name or not current_missing(row):
        return 0

    query = urllib.parse.quote_plus(f'"{name}" IPO "price band" "lot size"')
    try:
        root = ET.fromstring(request_text(RSS.format(query=query), timeout=20))
    except Exception as exc:
        print(f"WEB FALLBACK: RSS failed for {name}: {exc}")
        return 0

    candidates = []
    for item in root.findall(".//item")[:8]:
        title = clean(item.findtext("title", ""))
        link = clean(item.findtext("link", ""))
        desc = clean(item.findtext("description", ""))
        pub_raw = item.findtext("pubDate", "")
        try:
            published = parsedate_to_datetime(pub_raw).astimezone(dt.timezone.utc)
        except Exception:
            published = dt.datetime.now(dt.timezone.utc)
        # Avoid unrelated companies with only a generic IPO word.
        joined = f"{title} {desc}".lower()
        base = norm_name(name)
        if base and base not in norm_name(joined):
            # Allow two meaningful name words to match.
            words = [w for w in re.findall(r"[a-z0-9]+", name.lower()) if len(w) >= 4 and w not in {"limited", "india", "technology", "technologies"}]
            if not words or sum(1 for w in words if w in joined) < min(2, len(words)):
                continue

        article = parse_article(link) if link else ""
        text = f"{title}\n{desc}\n{article}"
        candidates.append({
            "score": domain_score(link),
            "published": published,
            "url": link,
            "source": clean(item.findtext("source", "")) or link,
            "price": parse_price(text),
            "lot": parse_lot(text),
            "size": parse_size(text),
            "gmp": parse_gmp(text),
            "sub": parse_subscription(text),
        })

    if not candidates:
        return 0

    candidates.sort(key=lambda x: (x["score"], x["published"]), reverse=True)
    changed = 0
    used = {}
    for field in ("price", "lot", "size", "gmp", "sub"):
        if row.get({"price":"price","lot":"lot","size":"size","gmp":"gmp","sub":"sub"}[field]) not in MISSING:
            continue
        hit = next((c for c in candidates if c.get(field) not in MISSING), None)
        if not hit:
            continue
        value = hit[field]
        key = {"price":"price","lot":"lot","size":"size","gmp":"gmp","sub":"sub"}[field]
        row[key] = value
        row.setdefault("_internet_fallback", {})[key] = {
            "source": hit["source"],
            "url": hit["url"],
            "published_at": hit["published"].isoformat(),
            "priority_score": hit["score"],
        }
        used[key] = hit["url"]
        changed += 1

    return changed

def main():
    if not DATA.exists():
        print("WEB FALLBACK: data/ipo-data.json not found")
        return
    payload = json.loads(DATA.read_text(encoding="utf-8"))
    rows = payload.get("ipos", []) if isinstance(payload, dict) else []
    total = 0
    checked = 0
    for row in rows:
        if not isinstance(row, dict) or not row.get("name"):
            continue
        if current_missing(row):
            checked += 1
            n = enrich_row(row)
            total += n
            if n:
                print(f"WEB FALLBACK: {row['name']} -> {n} fields")
    payload["web_fallback_updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    payload.setdefault("sources", {})["WEB_FALLBACK"] = {
        "ok": total > 0,
        "checked": checked,
        "fields_filled": total,
        "source": "Google News RSS + public IPO article pages",
    }
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"WEB FALLBACK: checked={checked}, fields_filled={total}")

if __name__ == "__main__":
    main()
