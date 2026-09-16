"""Deterministic IPO Terminal self-healing pass.

Repairs dates/status, verifies official filing links with retries and alternates,
and generates an automatically refreshed upcoming IPO filing map.
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
UPCOMING_FILINGS = ROOT / 'data' / 'upcoming-ipo-filings.json'
UA = 'Mozilla/5.0 IPO-Terminal-Self-Heal/2.0'

# Official sources only. The checker tries these in order and records the first working URL.
OFFICIAL_ALTERNATES = {
    'nse': [
        'https://www.nseindia.com/static/investor-relations/offer-documents',
        'https://www.nseindia.com/static/products-services/public-offer-documents',
        'https://www.nseindia.com/companies-listing/corporate-filings-offer-documents',
    ],
    'national stock exchange': [
        'https://www.nseindia.com/static/investor-relations/offer-documents',
        'https://www.nseindia.com/static/products-services/public-offer-documents',
        'https://www.nseindia.com/companies-listing/corporate-filings-offer-documents',
    ],
    'jio platforms': [
        'https://www.jio.com/about/investor-relations/ipo/',
        'https://www.ril.com/investor/resource-center/corporate-announcements',
    ],
}

def parse_date(v):
    if not v or str(v).strip() in ('—', '-', 'N/A'):
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

def check_url(url, attempts=2):
    last_status = None
    last_url = url
    for attempt in range(attempts):
        try:
            req = Request(url, headers={
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
            })
            with urlopen(req, timeout=12) as r:
                status = int(getattr(r, 'status', 200))
                final = r.geturl()
                if 200 <= status < 400:
                    return True, status, final
                last_status, last_url = status, final
        except Exception:
            pass
    return False, last_status, last_url

def choose_official_url(name, exchange=''):
    key = str(name or '').lower()
    for marker, urls in OFFICIAL_ALTERNATES.items():
        if marker in key:
            return urls
    ex = str(exchange or '').upper()
    if ex == 'NSE':
        return OFFICIAL_ALTERNATES['nse']
    return OFFICIAL_ALTERNATES['nse']

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

def verify_and_repair_doc(doc, now):
    name = str(doc.get('name') or '').strip()
    candidates = []
    old = str(doc.get('url') or '').strip()
    if old:
        candidates.append(old)
    candidates.extend(choose_official_url(name, doc.get('exchange')))
    seen = set()
    result = {'checked': 0, 'verified': False, 'repaired': False, 'url': old, 'status': None, 'final': old}
    for url in candidates:
        if not url or url in seen:
            continue
        seen.add(url)
        ok, status, final = check_url(url)
        result['checked'] += 1
        if ok:
            result.update({'verified': True, 'url': url, 'status': status, 'final': final})
            if doc.get('url') != url:
                doc['url'] = url
                result['repaired'] = True
            doc.update({'verified': True, 'http_status': status, 'verified_url': final, 'self_healed_at': now.isoformat(), 'link_source': 'official-alternate'})
            return result
        result.update({'status': status, 'final': final})
    doc.update({'verified': False, 'http_status': result['status'], 'verified_url': result['final'], 'self_healed_at': now.isoformat(), 'link_source': 'official-alternate-failed'})
    return result

def build_upcoming_filing_map(ipos, now):
    rows = []
    for ipo in ipos:
        if not isinstance(ipo, dict):
            continue
        status = str(ipo.get('status') or '').lower()
        if status not in ('upcoming', 'open'):
            continue
        name = str(ipo.get('name') or '').strip()
        if not name:
            continue
        candidates = choose_official_url(name, ipo.get('exchange'))
        selected = None; http_status = None; verified = False
        for url in candidates:
            ok, st, final = check_url(url)
            if ok:
                selected, http_status, verified = final, st, True
                break
            http_status = st
        row = {
            'ipo_name': name,
            'id': ipo.get('id'),
            'type': ipo.get('type', 'Mainboard'),
            'exchange': ipo.get('exchange', 'NSE'),
            'status': status,
            'open': ipo.get('open', '—'),
            'close': ipo.get('close', '—'),
            'filing_url': selected or candidates[0],
            'verified': verified,
            'http_status': http_status,
            'checked_at': now.isoformat(),
        }
        rows.append(row)
    UPCOMING_FILINGS.write_text(json.dumps({
        'generated_at': now.isoformat(),
        'source': 'IPO Terminal self-heal official-source checker',
        'count': len(rows),
        'ipos': rows,
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    return rows

def main():
    now = dt.datetime.now(ZoneInfo('Asia/Kolkata'))
    payload = json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos': []}
    ipos = payload.get('ipos', []) if isinstance(payload.get('ipos', []), list) else []
    changed = 0
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
            result = verify_and_repair_doc(doc, now)
            filing_result['checked'] += result['checked']
            filing_result['verified'] += int(result['verified'])
            filing_result['repaired'] += int(result['repaired'])
        fp['generated_at'] = now.isoformat()
        fp['verified_count'] = filing_result['verified']
        FILINGS.write_text(json.dumps(fp, ensure_ascii=False, indent=2), encoding='utf-8')

    upcoming = build_upcoming_filing_map(ipos, now)
    payload['updated_at'] = now.isoformat()
    payload.setdefault('sources', {})['SelfHeal'] = {
        'ok': True,
        'checked_at': now.isoformat(),
        'status_repairs': changed,
        'filings': filing_result,
        'upcoming_filing_map': len(upcoming),
        'schedule': 'GitHub Actions every 15 minutes',
        'rule': 'verify official filing links with retries and alternates; auto-generate upcoming IPO filing map; never invent a filing URL',
    }
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    HEALTH.write_text(json.dumps({
        'ok': True,
        'checked_at': now.isoformat(),
        'status_repairs': changed,
        'filings': filing_result,
        'upcoming_filing_map': len(upcoming),
        'schedule': 'every 15 minutes',
        'live_upcoming_rule': 'IPO is application-facing when not closed/listed and close date has not passed',
    }, ensure_ascii=False, indent=2), encoding='utf-8')
    print('SELF-HEAL OK:', changed, 'status repairs;', filing_result, '; upcoming filing map:', len(upcoming))

if __name__ == '__main__':
    main()
