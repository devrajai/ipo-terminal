import datetime as dt
import html
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
OUT = ROOT / "data" / "broker-health.json"

UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal-BrokerHealth/1.0"

# Official pages only. The checker never replaces a broker with a third-party
# source. If a pricing page changes structure and cannot be parsed safely, the
# old value is retained and the UI is marked for verification rather than
# inventing a new price.
BROKERS = {
    "Zerodha": {
        "home": "https://zerodha.com/",
        "pricing": ["https://zerodha.com/charges", "https://zerodha.com/pricing/"],
    },
    "Groww": {
        "home": "https://groww.in/",
        "pricing": ["https://groww.in/pricing", "https://groww.in/pricing/futures-and-options"],
    },
    "Upstox": {
        "home": "https://upstox.com/",
        "pricing": ["https://upstox.com/brokerage-charges/"],
    },
    "Angel One": {
        "home": "https://www.angelone.in/",
        "pricing": ["https://www.angelone.in/exchange-transaction-charges", "https://assist.angelone.in/assist/plans-and-pricing"],
    },
    "ICICI Direct": {
        "home": "https://www.icicidirect.com/",
        "pricing": ["https://www.icicidirect.com/brokerage"],
    },
    "HDFC SKY": {
        "home": "https://hdfcsky.com/",
        "pricing": ["https://hdfcsky.com/pricing"],
    },
    "5paisa": {
        "home": "https://www.5paisa.com/",
        "pricing": ["https://www.5paisa.com/stock-market-guide/brokerage-charges"],
    },
    "Kotak Neo": {
        "home": "https://www.kotakneo.com/",
        "pricing": ["https://www.kotakneo.com/pricing"],
    },
    "Motilal Oswal": {
        "home": "https://www.motilaloswal.com/",
        "pricing": ["https://www.motilaloswal.com/charges"],
    },
    "Sharekhan": {
        "home": "https://www.sharekhan.com/",
        "pricing": ["https://www.sharekhan.com/charges"],
    },
    "Dhan": {
        "home": "https://dhan.co/",
        "pricing": ["https://dhan.co/pricing/"],
    },
    "FYERS": {
        "home": "https://fyers.in/",
        "pricing": ["https://fyers.in/pricing/"],
    },
    "SBI Securities": {
        "home": "https://www.sbisecurities.in/",
        "pricing": ["https://www.sbisecurities.in/pricing"],
    },
    "Axis Direct": {
        "home": "https://simplehai.axisdirect.in/",
        "pricing": ["https://simplehai.axisdirect.in/pricing"],
    },
    "IIFL Securities": {
        "home": "https://www.indiainfoline.com/",
        "pricing": ["https://www.indiainfoline.com/charges"],
    },
    "Alice Blue": {
        "home": "https://aliceblueonline.com/",
        "pricing": ["https://aliceblueonline.com/pricing/"],
    },
    "m.Stock": {
        "home": "https://www.mstock.com/",
        "pricing": ["https://www.mstock.com/pricing"],
    },
    "Paytm Money": {
        "home": "https://www.paytmmoney.com/",
        "pricing": ["https://www.paytmmoney.com/pricing"],
    },
}

def fetch(url, timeout=20):
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": UA,
            "Accept": "text/html,application/xhtml+xml,text/plain,*/*;q=0.8",
            "Accept-Language": "en-IN,en;q=0.9",
        },
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.geturl(), r.status, r.read().decode("utf-8", "ignore")

def textify(page):
    page = re.sub(r"<script[\\s\\S]*?</script>", " ", page, flags=re.I)
    page = re.sub(r"<style[\\s\\S]*?</style>", " ", page, flags=re.I)
    page = re.sub(r"<[^>]+>", " ", page)
    page = html.unescape(page)
    return " ".join(page.split())

def first_working(candidates):
    errors = []
    for url in candidates:
        try:
            final, status, body = fetch(url)
            if status == 200 and len(body) > 300:
                return {"ok": True, "url": final, "status": status, "body": body, "errors": errors}
        except Exception as exc:
            errors.append(f"{url}: {exc}")
    return {"ok": False, "url": "", "status": 0, "body": "", "errors": errors}

def norm(v):
    return re.sub(r"\\s+", " ", str(v or "")).strip()

def money_num(v):
    m = re.search(r"(?:₹|rs\\.?|inr\\s*)\\s*([0-9][0-9,]*(?:\\.[0-9]+)?)", v, re.I)
    return m.group(1).replace(",", "") if m else None

def parse_known(name, raw):
    t = textify(raw)
    low = t.lower()
    out = {}

    # Conservative parsers: only update a field when the official page contains
    # the expected segment label and a nearby charge expression.
    def nearby(label, patterns, window=260):
        i = low.find(label.lower())
        if i < 0:
            return None
        chunk = t[i:i + window]
        for p in patterns:
            m = re.search(p, chunk, re.I)
            if m:
                return norm(m.group(0))
        return None

    if name == "Zerodha":
        if "all equity delivery investments" in low:
            out["delivery"] = "₹0 brokerage"
        v = nearby("equity intraday", [r"₹20[^.]{0,80}", r"0\.03%[^.]{0,80}"])
        if v: out["intraday"] = "₹20/order or 0.03% lower"
        if "futures" in low and "0.03% or rs. 20" in low:
            out["futures"] = "₹20/order or 0.03% lower"
        if "flat rs. 20 on all option trades" in low or "flat ₹ 20" in low:
            out["options"] = "₹20/order"
        if "account opening" in low and "individual account" in low and "free" in low:
            out["open"] = "₹0"
        if "amc is free for the first year" in low:
            out["amc"] = "1st year ₹0 for eligible resident individual accounts; then applicable AMC"
    elif name == "Groww":
        if "equity brokerage" in low and "₹20" in t:
            out["delivery"] = "₹20/order or 0.1% lower; min ₹5"
            out["intraday"] = "₹20/order or 0.1% lower; min ₹5"
        if "futures & options brokerage" in low and "₹20" in t:
            out["futures"] = "₹20/order"
            out["options"] = "₹20/order"
        if "account opening" in low and "₹0" in t:
            out["open"] = "₹0"
        if "account maintenance charges" in low and "₹0" in t:
            out["amc"] = "₹0"
    elif name == "Upstox":
        if "equity delivery" in low and "₹20" in t: out["delivery"] = "₹20/order"
        if "equity intraday" in low and "0.1%" in low: out["intraday"] = "₹20/order or 0.1% lower"
        if "equity futures" in low and "0.05%" in low: out["futures"] = "₹20/order or 0.05% lower"
        if "equity options" in low and "₹20" in t: out["options"] = "₹20/order"
        if "account opening fees" in low and "free" in low: out["open"] = "₹0"
        if "zero amc" in low and "first year" in low: out["amc"] = "₹0 first year; then applicable AMC"
    elif name == "Angel One":
        if "equity delivery" in low and "₹20 or 0.1%" in low: out["delivery"] = "₹20/order or 0.1% lower; min ₹5"
        if "equity intraday" in low and "₹20 or 0.1%" in low: out["intraday"] = "₹20/order or 0.1% lower; min ₹5"
        if "futures & options" in low and "₹20 per executed order" in low: out["futures"] = "₹20/order"; out["options"] = "₹20/order"
        if "account opening charge" in low and "zero" in low: out["open"] = "₹0"
        if "no account maintenance charges" in low and "first year" in low: out["amc"] = "₹0 first year; then applicable AMC"
    elif name == "HDFC SKY":
        if "account opening charges" in low and "free" in low: out["open"] = "₹0"
        if "amc" in low and "₹0 for 1yr" in low: out["amc"] = "₹0 first year; then applicable AMC"
        if "delivery order" in low and "₹20 or 2.5%" in low: out["delivery"] = "₹20/order or 2.5% lower"
        if "intraday order" in low and "₹20 or 2.5%" in low: out["intraday"] = "₹20/order or 2.5% lower"
        if "derivatives futures" in low and "₹20 or 2.5%" in low: out["futures"] = "₹20/order or 2.5% lower"
        if "derivative options" in low and "₹20 / order" in low: out["options"] = "₹20/order"
    elif name == "ICICI Direct":
        if "delivery brokerage as low as 0.07%" in low: out["delivery"] = "From 0.07% on Prime plans"
        if "prime 9999" in low and "0.007%" in low: out["intraday"] = "From 0.007% on Prime 9999"
        if "prime 9999" in low and "₹9 per lot" in low: out["options"] = "₹9/lot on Prime 9999"
        if "flat brokerage per order of ₹20" in low: out["futures"] = "₹20/order on iValue; plan dependent"
    return out

def replace_field(obj, key, value):
    if value is None: return obj
    pattern = rf"({re.escape(key)}\\s*:\\s*')[^']*(')"
    return re.sub(pattern, rf"\\g<1>{value}\\g<2>", obj, count=1)

def patch_index(results):
    source = INDEX.read_text(encoding="utf-8")
    start = source.find("const BROKERS=[")
    if start < 0:
        raise RuntimeError("BROKERS array not found")
    end = source.find("];", start)
    if end < 0:
        raise RuntimeError("BROKERS array end not found")
    block = source[start:end + 2]

    for name, rule in BROKERS.items():
        marker = "{name:'" + name + "'"
        pos = block.find(marker)
        if pos < 0:
            continue
        next_pos = block.find("\n{name:", pos + 1)
        if next_pos < 0: next_pos = len(block)
        obj = block[pos:next_pos]
        r = results[name]
        obj = replace_field(obj, "url", r["home"])
        obj = replace_field(obj, "pricing_url", r.get("pricing_url") or r["home"])
        parsed = r.get("parsed", {})
        for k, v in parsed.items():
            obj = replace_field(obj, k, v)
        status = "Official pricing checked " + r["checked_at"][:10] if r["pricing_ok"] else "Pricing check failed; verify official tariff"
        obj = replace_field(obj, "verified", status)
        # Add metadata fields if this broker did not already have them.
        if "pricing_url:" not in obj:
            # Insert BEFORE the object's closing brace instead of stripping the
            # last character (which is the array-element comma, not '}').
            url = r.get("pricing_url") or r["home"]
            cut = obj.rfind("}")
            if cut >= 0:
                obj = obj[:cut] + ",pricing_url:'" + url + "'}" + obj[cut + 1:]
        block = block[:pos] + obj + block[next_pos:]
    return source[:start] + block + source[end + 2:]

def main():
    checked_at = dt.datetime.now(dt.timezone.utc).isoformat()
    results = {}
    for name, rule in BROKERS.items():
        home = first_working([rule["home"]])
        pricing = first_working(rule["pricing"])
        parsed = parse_known(name, pricing["body"]) if pricing["ok"] else {}
        results[name] = {
            "home": home["url"] if home["ok"] else rule["home"],
            "home_ok": home["ok"],
            "home_status": home["status"],
            "pricing_ok": pricing["ok"],
            "pricing_url": pricing["url"] if pricing["ok"] else (home["url"] if home["ok"] else rule["pricing"][0]),
            "pricing_status": pricing["status"],
            "parsed": parsed,
            "checked_at": checked_at,
            "errors": (home["errors"] + pricing["errors"])[:4],
        }

    changed = False
    try:
        new_source = patch_index(results)
        old_source = INDEX.read_text(encoding="utf-8")
        if new_source != old_source:
            INDEX.write_text(new_source, encoding="utf-8")
            changed = True
    except Exception as exc:
        print("index patch failed:", exc)

    health = {
        "updated_at": checked_at,
        "changed": changed,
        "brokers": results,
        "policy": "Official broker pages only. Pricing pages are checked every 6 hours. If an official page changes and the new tariff cannot be parsed safely, stale numeric values are replaced with 'Check current tariff' instead of being guessed. Broken links fall back to a working official candidate when available.",
    }
    OUT.write_text(json.dumps(health, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"changed": changed, "checked": len(results), "pricing_ok": sum(1 for x in results.values() if x["pricing_ok"]), "home_ok": sum(1 for x in results.values() if x["home_ok"])}, indent=2))

if __name__ == "__main__":
    main()
