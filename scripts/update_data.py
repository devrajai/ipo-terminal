import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'ipo-data.json'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/1.2'
NSE_HOME = 'https://www.nseindia.com/'
NSE_CURRENT = 'https://www.nseindia.com/api/ipo-current-issue'
NSE_UPCOMING = 'https://www.nseindia.com/api/all-upcoming-issues?category=ipo'
SEBI_PUBLIC = 'https://www.sebi.gov.in/filings/public-issues/'
BSE_PUBLIC = 'https://www.bseindia.com/markets/PublicIssues/IPOIssues_new.aspx'
GMP_DASHBOARD = 'https://www.investorgain.com/report/ipo-gmp-live/331/all/'
GMP_SOURCES = [
    ('InvestorGain', GMP_DASHBOARD),
    ('Chittorgarh', 'https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/'),
    ('Moneycontrol', 'https://www.moneycontrol.com/ipo/ipo-gmp/'),
]

def clean_text(value):
    value = html.unescape(str(value or ''))
    value = re.sub(r'<[^>]+>', ' ', value)
    return ' '.join(value.split()).strip()

def request_text(url, opener=None, referer=None, timeout=30):
    headers = {'User-Agent': UA, 'Accept': 'application/json,text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9', 'Connection': 'keep-alive'}
    if referer:
        headers['Referer'] = referer
    req = urllib.request.Request(url, headers=headers)
    with (opener or urllib.request.build_opener()).open(req, timeout=timeout) as response:
        return response.read().decode('utf-8', 'ignore')

def get_json_with_nse_handshake(url):
    jar = CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
    request_text(NSE_HOME, opener=opener, timeout=25)
    last = None
    for attempt in range(3):
        try:
            data = json.loads(request_text(url, opener=opener, referer=NSE_HOME, timeout=25))
            if isinstance(data, list): return data
            if isinstance(data, dict) and isinstance(data.get('data'), list): return data['data']
            return []
        except Exception as exc:
            last = exc
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f'NSE request failed: {last}')

def parse_number(value):
    text = str(value or '').replace(',', '')
    m = re.search(r'-?[0-9]+(?:\.[0-9]+)?', text)
    if not m: return None
    try: return float(m.group(0))
    except ValueError: return None

def parse_price_band(value):
    text = clean_text(value).replace('Rs.', '').replace('Rs', '').replace('₹', '').strip()
    nums = re.findall(r'[0-9]+(?:\.[0-9]+)?', text.replace(',', ''))
    if not nums: return None, None, '—'
    nums = [float(x) for x in nums]
    lo, hi = nums[0], nums[-1]
    fmt = lambda x: str(int(x)) if x.is_integer() else str(x)
    return lo, hi, (f'₹{fmt(lo)}' if lo == hi else f'₹{fmt(lo)}-{fmt(hi)}')

def parse_date(value):
    text = clean_text(value)
    for fmt in ('%d-%b-%Y', '%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y'):
        try: return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError: pass
    return None

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', clean_text(value).lower()).strip('-') or 'ipo'

def norm_name(value):
    text = clean_text(value).lower()
    text = re.sub(r'\b(ipo|nse|bse|limited|ltd|india|ind|technologies|technology)\b', ' ', text)
    return re.sub(r'[^a-z0-9]+', '', text)

def map_nse_issue(row):
    company = clean_text(row.get('companyName') or row.get('company') or row.get('name'))
    if not company: return None
    start, end = parse_date(row.get('issueStartDate')), parse_date(row.get('issueEndDate'))
    _, hi, price = parse_price_band(row.get('issuePrice'))
    series = clean_text(row.get('series')).upper()
    board = 'SME' if series == 'SME' else 'Mainboard'
    raw_status = clean_text(row.get('status')).lower()
    status = 'open' if raw_status in ('active', 'open') else ('upcoming' if raw_status in ('forthcoming', 'upcoming') else ('upcoming' if start and start > dt.date.today().isoformat() else 'open'))
    shares = parse_number(row.get('noOfSharesOffered') or row.get('issueSize'))
    size = f'₹{shares * hi / 1e7:,.0f} Cr' if shares and hi else '—'
    return {'id': slug(company), 'name': company, 'type': board, 'price': price, 'lot': '—', 'size': size,
            'open': dt.datetime.strptime(start, '%Y-%m-%d').strftime('%d/%m/%y') if start else '—',
            'close': dt.datetime.strptime(end, '%Y-%m-%d').strftime('%d/%m/%y') if end else '—',
            'listing': '—', 'sub': '—', 'gmp': '—', 'gmp_pct': '—', 'est_list': '—', 'sector': '—',
            'fresh': '—', 'ofs': '—', 'pe': '—', 'roe': '—', 'roce': '—', 'rev': '—', 'pat': '—',
            'ebitda': '—', 'de': '—', 'growth': '—', 'prom': '—', 'status': status,
            'exchange': 'BSE' if str(row.get('isBse', '')).strip() == '1' else 'NSE',
            'symbol': clean_text(row.get('symbol')), 'source': 'NSE',
            'source_url': 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo'}

def collect_nse():
    rows, seen, errors = [], set(), []
    for endpoint in (NSE_CURRENT, NSE_UPCOMING):
        try:
            for row in get_json_with_nse_handshake(endpoint):
                if not isinstance(row, dict): continue
                item = map_nse_issue(row)
                if item and item['id'] not in seen:
                    seen.add(item['id']); rows.append(item)
        except Exception as exc:
            errors.append(str(exc))
    return rows, errors

def collect_bse():
    try:
        page = request_text(BSE_PUBLIC, timeout=25)
        if page and ('public issue' in page.lower() or 'ipo' in page.lower()):
            return [], []
        return [], ['BSE response did not expose parseable IPO records']
    except Exception as exc:
        return [], [f'BSE unavailable: {exc}']

def classify_document(title):
    low = title.lower()
    return 'DRHP' if 'drhp' in low else ('RHP' if 'rhp' in low or 'red herring' in low else ('Prospectus' if 'prospectus' in low else 'Filing'))

def collect_sebi():
    docs, errors = [], []
    try:
        page = request_text(SEBI_PUBLIC, timeout=30)
        pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I | re.S)
        seen = set()
        for match in pattern.finditer(page):
            url, title = html.unescape(match.group(1)), clean_text(match.group(2))
            if not title or url in seen: continue
            if not any(x in (url + ' ' + title).lower() for x in ('rhp', 'drhp', 'prospectus', 'public-issue')): continue
            if url.startswith('/'): url = 'https://www.sebi.gov.in' + url
            if not url.startswith('http'): continue
            seen.add(url)
            docs.append({'name': title[:220], 'type': classify_document(title), 'url': url, 'date': '—', 'source': 'SEBI'})
            if len(docs) >= 150: break
    except Exception as exc:
        errors.append(str(exc))
    return docs, errors

def parse_gmp_value(text):
    m = re.search(r'(?:₹|Rs\.?\s*)\s*(-?[0-9]+(?:\.[0-9]+)?)', text, re.I)
    if not m: return None
    try: return float(m.group(1))
    except ValueError: return None

def parse_investorgain_dashboard(html_text):
    result, errors = {}, []
    try:
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', html_text, re.I | re.S)
        for row in rows:
            cells = re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.I | re.S)
            cells = [clean_text(x) for x in cells]
            if len(cells) < 2: continue
            name = cells[0]
            if not name or name.lower() in ('name', 'ipo name'): continue
            gmp = None
            for cell in cells[1:5]:
                if '₹' in cell or 'rs' in cell.lower() or '%' in cell:
                    gmp = parse_gmp_value(cell)
                    if gmp is not None: break
            if gmp is None: continue
            updated = next((x for x in cells if re.search(r'\d{1,2}[-/]\w{3}[-/]?\s*\d{0,4}\s*\d{1,2}:\d{2}', x)), '')
            result[norm_name(name)] = {'name': name, 'gmp': gmp, 'updated': updated}
    except Exception as exc:
        errors.append(str(exc))
    return result, errors

def extract_gmp(text, company):
    clean = clean_text(text)
    words = [w for w in re.split(r'\W+', company.lower()) if len(w) >= 4]
    low = clean.lower()
    if words and not any(w in low for w in words[:2]): return None
    patterns = [r'(?:gmp|grey market premium)[^₹0-9-]{0,50}₹?\s*(-?[0-9]{1,6}(?:\.[0-9]+)?)', r'₹\s*(-?[0-9]{1,6}(?:\.[0-9]+)?)\s*(?:gmp|grey market premium)']
    for pattern in patterns:
        m = re.search(pattern, clean, re.I)
        if m:
            try: return float(m.group(1))
            except ValueError: pass
    return None

def apply_gmp(ipo, value, source, source_url, fetched_at, source_updated_at=None):
    try:
        g = float(value)
    except (TypeError, ValueError):
        return False
    ipo['gmp'] = f'₹{int(g) if g.is_integer() else g}'
    ipo['gmp_source'] = source
    ipo['gmp_source_url'] = source_url
    ipo['gmp_updated_at'] = fetched_at
    if source_updated_at:
        ipo['gmp_source_updated_at'] = source_updated_at
    _, hi, _ = parse_price_band(ipo.get('price'))
    if hi and hi > 0:
        pct = g / hi * 100
        ipo['gmp_pct'] = f'{pct:+.1f}%'
        ipo['est_list'] = f'₹{int(hi + g) if float(hi + g).is_integer() else round(hi + g,2)}'
    return True

def collect_gmp(ipos, old_ipos):
    errors, matched = [], 0
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    dashboard = {}
    try:
        text = request_text(GMP_DASHBOARD, timeout=30)
        dashboard, parse_errors = parse_investorgain_dashboard(text)
        errors.extend(parse_errors)
    except Exception as exc:
        errors.append(f'InvestorGain: {exc}')
    old_map = {norm_name(i.get('name')): i for i in old_ipos if isinstance(i, dict) and i.get('name')}
    for ipo in ipos:
        key = norm_name(ipo.get('name'))
        hit = dashboard.get(key)
        if not hit:
            # Fuzzy token match for suffixes such as "India", "Limited" and exchange labels.
            for k, row in dashboard.items():
                if key and k and (key in k or k in key):
                    hit = row; break
        if hit and apply_gmp(ipo, hit['gmp'], 'InvestorGain', GMP_DASHBOARD, fetched_at, hit.get('updated')):
            matched += 1
            continue
        old = old_map.get(key)
        if old and old.get('gmp') not in (None, '', '—', '-'):
            ipo['gmp'] = old.get('gmp')
            ipo['gmp_pct'] = old.get('gmp_pct', '—')
            ipo['est_list'] = old.get('est_list', '—')
            ipo['gmp_source'] = old.get('gmp_source', 'previous successful source')
            ipo['gmp_source_url'] = old.get('gmp_source_url', '')
            ipo['gmp_updated_at'] = old.get('gmp_updated_at')
            ipo['gmp_source_updated_at'] = old.get('gmp_source_updated_at')
            continue
        # Per-source fallback for companies not present in the dashboard.
        for source, url in GMP_SOURCES[1:]:
            try:
                value = extract_gmp(request_text(url, timeout=20), ipo['name'])
                if value is not None and apply_gmp(ipo, value, source, url, fetched_at):
                    matched += 1; break
            except Exception as exc:
                errors.append(f'{source}: {exc}')
    return matched, errors

def merge_old_fields(new_ipos, old_ipos):
    old_map = {norm_name(i.get('name')): i for i in old_ipos if isinstance(i, dict) and i.get('name')}
    for item in new_ipos:
        old = old_map.get(norm_name(item.get('name')))
        if not old: continue
        for key in ('lot','sector','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom','sub','listing'):
            if item.get(key) in (None, '', '—', '-') and old.get(key) not in (None, '', '—', '-'):
                item[key] = old[key]
    return new_ipos

def load_old():
    try: return json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    except Exception: return {}

def main():
    old = load_old(); now = dt.datetime.now(dt.timezone.utc).isoformat()
    ipos, nse_errors = collect_nse()
    _, bse_errors = collect_bse()
    docs, sebi_errors = collect_sebi()
    final_ipos = merge_old_fields(ipos or old.get('ipos', []), old.get('ipos', []))
    gmp_count, gmp_errors = collect_gmp(final_ipos, old.get('ipos', []))
    if not final_ipos:
        final_ipos = old.get('ipos', [])
    payload = {
        'source': 'multi-source-live-gmp',
        'updated_at': now,
        'sources': {
            'NSE': {'ok': bool(ipos), 'records': len(ipos), 'errors': nse_errors[:3]},
            'BSE': {'ok': not bse_errors, 'records': 0, 'errors': bse_errors[:3]},
            'SEBI': {'ok': bool(docs), 'records': len(docs), 'errors': sebi_errors[:3]},
            'GMP': {'ok': gmp_count > 0, 'records': gmp_count, 'sources': ['InvestorGain','Chittorgarh','Moneycontrol'], 'errors': gmp_errors[:5]}
        },
        'ipos': final_ipos,
        'listed': old.get('listed', []),
        'news': old.get('news', []),
        'documents': docs or old.get('documents', [])
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'updated_at': now, 'ipos': len(payload['ipos']), 'documents': len(payload['documents']), 'nse_ok': bool(ipos), 'bse_ok': not bse_errors, 'sebi_ok': bool(docs), 'gmp_records': gmp_count}, indent=2))

if __name__ == '__main__': main()
