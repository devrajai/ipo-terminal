"""Deterministic IPO Terminal self-healing pass.

Repairs data/state that can be derived safely from dates and known official sources.
It does not invent market data or rewrite arbitrary application code.
"""
import datetime as dt
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'ipo-data.json'
FILINGS = ROOT / 'data' / 'live-filings.json'
HEALTH = ROOT / 'data' / 'self-heal-health.json'
UA = 'Mozilla/5.0 IPO-Terminal-Self-Heal/1.0'
OVERRIDES = {
    'nse': 'https://www.nseindia.com/static/investor-relations/offer-documents',
    'national stock exchange': 'https://www.nseindia.com/static/investor-relations/offer-documents',
    'jio platforms': 'https://www.ril.com/investor/resource-center/corporate-announcements',
}

def parse_date(v):
    if not v or str(v).strip() == '—':
        return None
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$', s)
    if m:
        y = int(m.group(3)); y += 2000 if y < 100 else 0
        return dt.datetime(y, int(m.group(2)), int(m.group(1)), 23, 59, tzinfo=ZoneInfo('Asia/Kolkata'))
    try:
        return dt.datetime.fromisoformat(s.replace('Z', '+00:00')).astimezone(ZoneInfo('Asia/Kolkata'))
    except Exception:
        return None

def check_url(url):
    try:
        req = Request(url, headers={'User-Agent': UA, 'Range': 'bytes=0-2048'})
        with urlopen(req, timeout=8) as r:
            return True, int(getattr(r, 'status', 200)), r.geturl()
    except Exception:
        return False, None, url

def normalize_status(ipo, now):
    old = str(ipo.get('status') or '').strip().lower()
    opening = parse_date(ipo.get('open'))
    closing = parse_date(ipo.get('close'))
    listing = parse_date(ipo.get('listing')) or parse_date(ipo.get('listing_date'))
    if listing and now > listing:
        new = 'listed'
    elif closing and now > closing:
        new = 'closed'
    elif opening and now >= opening and closing and now <= closing:
        new = 'open'
    elif opening and now < opening:
        new = 'upcoming'
    else:
        new = old or 'upcoming'
    if new != old:
        ipo['status'] = new
        ipo['status_auto'] = True
        return True
    return False

def main():
    now = dt.datetime.now(ZoneInfo('Asia/Kolkata'))
    payload = json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos': []}
    changed = 0
    ipos = payload.get('ipos', []) if isinstance(payload.get('ipos', []), list) else []
    for ipo in ipos:
        if isinstance(ipo, dict) and normalize_status(ipo, now):
            changed += 1

    filing_result = {'checked': 0, 'verified': 0, 'repaired': 0}
    if FILINGS.exists():
        fp = json.loads(FILINGS.read_text(encoding='utf-8'))
        docs = fp.get('documents', []) if isinstance(fp.get('documents', []), list) else []
        for doc in docs:
            if not isinstance(doc, dict) or not doc.get('url'):
                continue
            key = str(doc.get('name') or '').strip().lower()
            replacement = next((url for name, url in OVERRIDES.items() if name in key), None)
            if replacement and doc.get('url') != replacement:
                doc['url'] = replacement
                filing_result['repaired'] += 1
            ok, status, final = check_url(doc['url'])
            doc.update({'verified': ok, 'http_status': status, 'verified_url': final, 'self_healed_at': now.isoformat()})
            filing_result['checked'] += 1
            filing_result['verified'] += int(ok)
        fp['generated_at'] = now.isoformat()
        fp['verified_count'] = filing_result['verified']
        FILINGS.write_text(json.dumps(fp, ensure_ascii=False, indent=2), encoding='utf-8')

    payload['updated_at'] = now.isoformat()
    payload.setdefault('sources', {})['SelfHeal'] = {
        'ok': True,
        'checked_at': now.isoformat(),
        'status_repairs': changed,
        'filings': filing_result,
        'rule': 'closed/listed IPOs are excluded by close/listing dates; official filing overrides are deterministic',
    }
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    HEALTH.write_text(json.dumps({
        'ok': True,
        'checked_at': now.isoformat(),
        'status_repairs': changed,
        'filings': filing_result,
        'live_upcoming_rule': 'IPO is eligible for application-facing views only when not closed/listed and close date has not passed',
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('SELF-HEAL OK:', changed, 'status repairs;', filing_result)

if __name__ == '__main__':
    main()
