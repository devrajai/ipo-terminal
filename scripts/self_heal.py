"""Deterministic IPO Terminal self-healing pass.

Repairs dates/status, imports missing SME IPOs, verifies official filing links,
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
SME = ROOT / 'data' / 'sme-ipos.json'
FILINGS = ROOT / 'data' / 'live-filings.json'
HEALTH = ROOT / 'data' / 'self-heal-health.json'
UPCOMING_FILINGS = ROOT / 'data' / 'upcoming-ipo-filings.json'
UA = 'Mozilla/5.0 IPO-Terminal-Self-Heal/3.0'

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

IST = ZoneInfo('Asia/Kolkata')

def parse_date(v):
    if not v or str(v).strip() in ('—', '-', 'N/A'):
        return None
    s = str(v).strip()
    m = re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$', s)
    if m:
        y = int(m.group(3)); y += 2000 if y < 100 else 0
        return dt.datetime(y, int(m.group(2)), int(m.group(1)), 23, 59, 59, tzinfo=IST)
    try:
        x = dt.datetime.fromisoformat(s.replace('Z', '+00:00'))
        if x.tzinfo is None: x = x.replace(tzinfo=IST)
        return x.astimezone(IST)
    except Exception:
        return None

def check_url(url, attempts=2):
    last_status = None; last_url = url
    for _ in range(attempts):
        try:
            req = Request(url, headers={'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,application/json,*/*;q=0.8'})
            with urlopen(req, timeout=12) as r:
                status = int(getattr(r, 'status', 200)); final = r.geturl()
                if 200 <= status < 400: return True, status, final
                last_status, last_url = status, final
        except Exception:
            pass
    return False, last_status, last_url

def choose_official_url(name, exchange=''):
    key = str(name or '').lower()
    for marker, urls in OFFICIAL_ALTERNATES.items():
        if marker in key: return urls
    if str(exchange or '').upper() == 'NSE': return OFFICIAL_ALTERNATES['nse']
    return OFFICIAL_ALTERNATES['nse']

def normalize_status(ipo, now):
    old = str(ipo.get('status') or '').strip().lower()
    opening = parse_date(ipo.get('open'))
    closing = parse_date(ipo.get('close'))
    listing = parse_date(ipo.get('listing')) or parse_date(ipo.get('listing_date'))
    if listing and now > listing: new = 'listed'
    elif closing and now > closing: new = 'closed'
    elif opening and now >= opening and (not closing or now <= closing): new = 'open'
    elif opening and now < opening: new = 'upcoming'
    else: new = old or 'upcoming'
    ipo['status'] = new
    ipo['status_auto'] = True
    ipo['status_checked_at'] = now.isoformat()
    return new != old

def normalize_name(v):
    return re.sub(r'[^a-z0-9]+', '', str(v or '').lower().replace('limited', '').replace('ltd', ''))

def import_missing_sme(ipos):
    """Add SME records not already present so they automatically move upcoming -> open."""
    added = 0
    try:
        payload = json.loads(SME.read_text(encoding='utf-8')) if SME.exists() else []
        rows = payload.get('ipos', []) if isinstance(payload, dict) else payload
        existing = {normalize_name(x.get('name')) for x in ipos if isinstance(x, dict)}
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or not row.get('name'): continue
            key = normalize_name(row.get('name'))
            if not key or key in existing: continue
            item = dict(row)
            item.setdefault('type', 'SME')
            item.setdefault('status', 'upcoming')
            item.setdefault('exchange', 'NSE')
            item.setdefault('listing', '—')
            item.setdefault('price', '—')
            item.setdefault('size', '—')
            ipos.append(item); existing.add(key); added += 1
    except Exception as exc:
        print('SME import warning:', exc)
    return added

def verify_and_repair_doc(doc, now):
    name = str(doc.get('name') or '').strip(); candidates = []
    old = str(doc.get('url') or '').strip()
    if old: candidates.append(old)
    candidates.extend(choose_official_url(name, doc.get('exchange')))
    seen = set(); result = {'checked': 0, 'verified': False, 'repaired': False, 'url': old, 'status': None, 'final': old}
    for url in candidates:
        if not url or url in seen: continue
        seen.add(url); ok, status, final = check_url(url); result['checked'] += 1
        if ok:
            result.update({'verified': True, 'url': url, 'status': status, 'final': final})
            if doc.get('url') != url: doc['url'] = url; result['repaired'] = True
            doc.update({'verified': True, 'http_status': status, 'verified_url': final, 'self_healed_at': now.isoformat(), 'link_source': 'official-alternate'})
            return result
        result.update({'status': status, 'final': final})
    doc.update({'verified': False, 'http_status': result['status'], 'verified_url': result['final'], 'self_healed_at': now.isoformat(), 'link_source': 'official-alternate-failed'})
    return result

def build_upcoming_filing_map(ipos, now):
    rows = []
    for ipo in ipos:
        if not isinstance(ipo, dict): continue
        status = str(ipo.get('status') or '').lower()
        if status not in ('upcoming', 'open'): continue
        name = str(ipo.get('name') or '').strip()
        if not name: continue
        candidates = choose_official_url(name, ipo.get('exchange')); selected = None; http_status = None; verified = False
        for url in candidates:
            ok, st, final = check_url(url)
            if ok: selected, http_status, verified = final, st, True; break
            http_status = st
        rows.append({'ipo_name': name, 'id': ipo.get('id'), 'type': ipo.get('type', 'Mainboard'), 'exchange': ipo.get('exchange', 'NSE'), 'status': status, 'open': ipo.get('open', '—'), 'close': ipo.get('close', '—'), 'filing_url': selected or candidates[0], 'verified': verified, 'http_status': http_status, 'checked_at': now.isoformat()})
    UPCOMING_FILINGS.write_text(json.dumps({'generated_at': now.isoformat(), 'source': 'IPO Terminal self-heal official-source checker', 'count': len(rows), 'ipos': rows}, ensure_ascii=False, indent=2), encoding='utf-8')
    return rows

def main():
    now = dt.datetime.now(IST)
    payload = json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos': []}
    ipos = payload.get('ipos', []) if isinstance(payload.get('ipos', []), list) else []
    added_sme = import_missing_sme(ipos)
    changed = sum(normalize_status(ipo, now) for ipo in ipos if isinstance(ipo, dict))

    filing_result = {'checked': 0, 'verified': 0, 'repaired': 0}
    if FILINGS.exists():
        fp = json.loads(FILINGS.read_text(encoding='utf-8')); docs = fp.get('documents', []) if isinstance(fp.get('documents', []), list) else []
        for doc in docs:
            if not isinstance(doc, dict) or not doc.get('url'): continue
            r = verify_and_repair_doc(doc, now); filing_result['checked'] += r['checked']; filing_result['verified'] += int(r['verified']); filing_result['repaired'] += int(r['repaired'])
        fp['generated_at'] = now.isoformat(); fp['verified_count'] = filing_result['verified']; FILINGS.write_text(json.dumps(fp, ensure_ascii=False, indent=2), encoding='utf-8')

    upcoming = build_upcoming_filing_map(ipos, now)
    payload['ipos'] = ipos; payload['updated_at'] = now.isoformat(); payload.setdefault('sources', {})['SelfHeal'] = {'ok': True, 'checked_at': now.isoformat(), 'status_repairs': changed, 'sme_added': added_sme, 'filings': filing_result, 'upcoming_filing_map': len(upcoming), 'schedule': 'GitHub Actions every 15 minutes'}
    DATA.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    HEALTH.write_text(json.dumps({'ok': True, 'checked_at': now.isoformat(), 'status_repairs': changed, 'sme_added': added_sme, 'filings': filing_result, 'upcoming_filing_map': len(upcoming), 'schedule': 'every 15 minutes', 'rule': 'open when current IST time is on/after open date and before/equal close date; closed only after close date; listed only after listing date'}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('SELF-HEAL OK:', changed, 'status repairs;', added_sme, 'SME added;', filing_result, '; upcoming:', len(upcoming))

if __name__ == '__main__': main()
