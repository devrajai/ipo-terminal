import datetime as dt
import html
import json
import re
import time
import urllib.request
from http.cookiejar import CookieJar
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'ipo-data.json'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/1.0'
NSE_HOME = 'https://www.nseindia.com/'
NSE_CURRENT = 'https://www.nseindia.com/api/ipo-current-issue'
NSE_UPCOMING = 'https://www.nseindia.com/api/all-upcoming-issues?category=ipo'
SEBI_PUBLIC = 'https://www.sebi.gov.in/filings/public-issues/'

def clean_text(value):
    value = html.unescape(str(value or ''))
    value = re.sub(r'<[^>]+>', ' ', value)
    return ' '.join(value.split()).strip()

def request_text(url, opener=None, referer=None, timeout=30):
    headers = {'User-Agent': UA, 'Accept': 'application/json,text/html,application/xhtml+xml,*/*;q=0.8', 'Accept-Language': 'en-US,en;q=0.9'}
    if referer: headers['Referer'] = referer
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
    m = re.search(r'-?[0-9]+(?:\.[0-9]+)?', str(value or '').replace(',', ''))
    return float(m.group(0)) if m else None

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
    for fmt in ('%d-%b-%Y', '%d/%m/%Y', '%Y-%m-%d'):
        try: return dt.datetime.strptime(text, fmt).date().isoformat()
        except ValueError: pass
    return None

def slug(value):
    return re.sub(r'[^a-z0-9]+', '-', clean_text(value).lower()).strip('-') or 'ipo'

def map_nse_issue(row):
    company = clean_text(row.get('companyName') or row.get('company') or row.get('name'))
    if not company: return None
    start, end = parse_date(row.get('issueStartDate')), parse_date(row.get('issueEndDate'))
    _, hi, price = parse_price_band(row.get('issuePrice'))
    board = 'SME' if clean_text(row.get('series')).upper() == 'SME' else 'Mainboard'
    raw_status = clean_text(row.get('status')).lower()
    status = 'open' if raw_status in ('active','open') else ('upcoming' if raw_status in ('forthcoming','upcoming') else ('upcoming' if start and start > dt.date.today().isoformat() else 'open'))
    shares = parse_number(row.get('noOfSharesOffered') or row.get('issueSize'))
    size = f'₹{shares * hi / 1e7:,.0f} Cr' if shares and hi else '—'
    return {'id': slug(company), 'name': company, 'type': board, 'price': price, 'lot': '—', 'size': size,
            'open': dt.datetime.strptime(start,'%Y-%m-%d').strftime('%d/%m/%y') if start else '—',
            'close': dt.datetime.strptime(end,'%Y-%m-%d').strftime('%d/%m/%y') if end else '—',
            'listing': '—', 'sub': '—', 'gmp': '—', 'gmp_pct': '—', 'est_list': '—', 'sector': '—',
            'fresh': '—', 'ofs': '—', 'pe': '—', 'roe': '—', 'roce': '—', 'rev': '—', 'pat': '—',
            'ebitda': '—', 'de': '—', 'growth': '—', 'prom': '—', 'status': status,
            'exchange': 'BSE' if str(row.get('isBse','')).strip() == '1' else 'NSE',
            'symbol': clean_text(row.get('symbol')), 'source': 'NSE',
            'source_url': 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo'}

def collect_nse():
    rows, seen, errors = [], set(), []
    for endpoint in (NSE_CURRENT, NSE_UPCOMING):
        try:
            for row in get_json_with_nse_handshake(endpoint):
                if not isinstance(row, dict): continue
                item = map_nse_issue(row)
                if item and item['id'] not in seen: seen.add(item['id']); rows.append(item)
        except Exception as exc: errors.append(str(exc))
    return rows, errors

def classify_document(title):
    low = title.lower()
    return 'DRHP' if 'drhp' in low else ('RHP' if 'rhp' in low or 'red herring' in low else ('Prospectus' if 'prospectus' in low else 'Filing'))

def collect_sebi():
    docs, errors = [], []
    try:
        page = request_text(SEBI_PUBLIC, timeout=30)
        pattern = re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>', re.I|re.S)
        seen = set()
        for match in pattern.finditer(page):
            url, title = html.unescape(match.group(1)), clean_text(match.group(2))
            if not title or url in seen: continue
            if not any(x in (url+' '+title).lower() for x in ('rhp','drhp','prospectus','public-issue')): continue
            if url.startswith('/'): url = 'https://www.sebi.gov.in' + url
            if not url.startswith('http'): continue
            seen.add(url)
            docs.append({'name': title[:220], 'type': classify_document(title), 'url': url, 'date': '—', 'source': 'SEBI'})
            if len(docs) >= 150: break
    except Exception as exc: errors.append(str(exc))
    return docs, errors

def load_old():
    try: return json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    except Exception: return {}

def main():
    old = load_old(); now = dt.datetime.now(dt.timezone.utc).isoformat()
    ipos, nse_errors = collect_nse(); docs, sebi_errors = collect_sebi()
    payload = {'source': ' + '.join(x for x,ok in (('NSE',bool(ipos)),('SEBI',bool(docs))) if ok) or old.get('source','Embedded fallback'),
               'updated_at': now,
               'sources': {'NSE': {'ok':bool(ipos),'records':len(ipos),'errors':nse_errors[:3]}, 'SEBI': {'ok':bool(docs),'records':len(docs),'errors':sebi_errors[:3]}, 'BSE': {'ok':False,'records':0,'errors':['Phase 1B'] }},
               'ipos': ipos or old.get('ipos',[]), 'listed': old.get('listed',[]), 'news': old.get('news',[]), 'documents': docs or old.get('documents',[])}
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'updated_at':now,'ipos':len(payload['ipos']),'documents':len(payload['documents']),'nse_ok':bool(ipos),'sebi_ok':bool(docs),'nse_errors':nse_errors[:2],'sebi_errors':sebi_errors[:2]}, indent=2))

if __name__ == '__main__': main()
