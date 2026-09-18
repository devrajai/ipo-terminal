import datetime as dt
import html
import json
import re
import time
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from email.utils import parsedate_to_datetime
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
NEWS_OUT = ROOT / 'data' / 'news.json'
NEWS_RSS = 'https://news.google.com/rss/search?q={query}&hl=en-IN&gl=IN&ceid=IN:en'
LISTED_URL = 'https://economictimes.indiatimes.com/markets/ipo/recently-listed'

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

def collect_listed(old_listed):
    """Refresh the rolling latest-9 listed IPOs with issue, listing and current prices."""
    errors = []
    rows = []
    try:
        page = request_text(LISTED_URL, timeout=30)
        trs = re.findall(r'<tr[^>]*>(.*?)</tr>', page, re.I | re.S)
        for tr in trs:
            cells = [clean_text(x) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.I | re.S)]
            if len(cells) < 6: continue
            name = re.sub(r'(Mainboard|SME)
    """Collect exactly up to 9 fresh IPO stories from public RSS, tied to live/upcoming IPOs.
    The rolling window is today through the previous 5 days, so the set naturally changes each day.
    """
    now = dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=5)
    errors, stories, seen = [], [], set()

    live = []
    for ipo in ipos:
        status = str(ipo.get('status') or '').lower()
        if status in ('open', 'upcoming'):
            live.append(ipo)
    live.sort(key=lambda x: (0 if str(x.get('status')).lower() == 'open' else 1, str(x.get('open') or '')))

    queries = []
    for ipo in live[:6]:
        name = clean_text(ipo.get('name'))
        if name:
            queries.append((name + ' IPO', name.lower()))
    queries += [
        ('India IPO upcoming subscription listing', 'ipo'),
        ('India IPO news September 2026', 'ipo'),
        ('Indian IPO latest public issue', 'ipo'),
    ]

    def add_item(title, link, source, published, hint='ipo'):
        title = clean_text(title)
        link = html.unescape(str(link or '')).strip()
        if not title or not link or link in seen: return
        low = title.lower()
        if 'ipo' not in low and hint not in low:
            return
        if published is None or published < cutoff or published > now + dt.timedelta(hours=2):
            return
        seen.add(link)
        stories.append({
            'title': title[:260],
            'date': published.astimezone(dt.timezone.utc).date().isoformat(),
            'source': clean_text(source) or 'News',
            'link': link,
            'published_at': published.astimezone(dt.timezone.utc).isoformat(),
            'topic': 'Live / Upcoming IPO'
        })

    for query, hint in queries:
        try:
            url = NEWS_RSS.format(query=urllib.parse.quote_plus(query))
            root = ET.fromstring(request_text(url, timeout=20))
            for item in root.findall('.//item'):
                title = item.findtext('title', '')
                link = item.findtext('link', '')
                pub = item.findtext('pubDate', '')
                source = item.findtext('source', '')
                try:
                    published = parsedate_to_datetime(pub).astimezone(dt.timezone.utc) if pub else None
                except Exception:
                    published = None
                add_item(title, link, source, published, hint)
        except Exception as exc:
            errors.append(f'{query}: {exc}')

    # Keep company-specific/current IPO stories ahead of generic IPO headlines.
    def priority(item):
        low = item['title'].lower()
        for n, _ in [(clean_text(x.get('name')).lower(), '') for x in live[:6]]:
            if n and n in low: return 0
        return 1
    stories.sort(key=lambda x: (priority(x), x.get('published_at', '')), reverse=False)

    # Add previously successful recent stories only as a safety fallback when a feed is down.
    for old in old_news if isinstance(old_news, list) else []:
        if len(stories) >= 9: break
        if not isinstance(old, dict): continue
        try:
            published = dt.datetime.fromisoformat(str(old.get('published_at')).replace('Z', '+00:00')) if old.get('published_at') else dt.datetime.combine(dt.date.fromisoformat(str(old.get('date'))), dt.time(), tzinfo=dt.timezone.utc)
        except Exception:
            continue
        add_item(old.get('title'), old.get('link'), old.get('source'), published, 'ipo')

    stories.sort(key=lambda x: x.get('published_at', ''), reverse=True)
    stories = stories[:9]
    if stories:
        NEWS_OUT.write_text(json.dumps(stories, ensure_ascii=False, indent=2), encoding='utf-8')
    elif NEWS_OUT.exists():
        try: stories = json.loads(NEWS_OUT.read_text(encoding='utf-8'))[:9]
        except Exception: stories = []
    return stories, errors

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
    news, news_errors = collect_news(final_ipos, old.get('news', []))
    listed, listed_errors = collect_listed(old.get('listed', []))
    payload = {
        'source': 'multi-source-live-gmp',
        'updated_at': now,
        'sources': {
            'NSE': {'ok': bool(ipos), 'records': len(ipos), 'errors': nse_errors[:3]},
            'BSE': {'ok': not bse_errors, 'records': 0, 'errors': bse_errors[:3]},
            'SEBI': {'ok': bool(docs), 'records': len(docs), 'errors': sebi_errors[:3]},
            'GMP': {'ok': gmp_count > 0, 'records': gmp_count, 'sources': ['InvestorGain','Chittorgarh','Moneycontrol'], 'errors': gmp_errors[:5]},
            'NEWS': {'ok': len(news) > 0, 'records': len(news), 'source': 'Google News RSS public feeds', 'window_days': 5, 'errors': news_errors[:5]},
            'LISTED': {'ok': len(listed) > 0, 'records': len(listed), 'source': 'Economic Times recently-listed IPO table', 'errors': listed_errors[:5]}
        },
        'ipos': final_ipos,
        'listed': listed,
        'news': news,
        'documents': docs or old.get('documents', [])
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'updated_at': now, 'ipos': len(payload['ipos']), 'documents': len(payload['documents']), 'nse_ok': bool(ipos), 'bse_ok': not bse_errors, 'sebi_ok': bool(docs), 'gmp_records': gmp_count, 'news_records': len(news), 'listed_records': len(listed)}, indent=2))

if __name__ == '__main__': main()
, '', cells[0]).strip()
            if not name or name.lower() in ('company name', 'company'): continue
            listing_date = parse_date(cells[1])
            if not listing_date: continue
            nums = []
            for c in cells[3:]:
                m = re.search(r'₹?\\s*(-?[0-9]+(?:\\.[0-9]+)?)', c.replace(',', ''))
                nums.append(float(m.group(1)) if m else None)
            issue_price = nums[0] if len(nums) > 0 else None
            listing_price = nums[1] if len(nums) > 1 else None
            ltp = nums[2] if len(nums) > 2 else None
            gain = None
            for c in cells[3:]:
                m = re.search(r'(-?[0-9]+(?:\\.[0-9]+)?)\\s*%', c)
                if m:
                    gain = float(m.group(1)); break
            if gain is None and issue_price and ltp:
                gain = (ltp - issue_price) / issue_price * 100
            if issue_price is None: continue
            rows.append({
                'name': name, 'listing_date': listing_date,
                'issue_price': issue_price, 'listing_price': listing_price or issue_price,
                'current_price': ltp or listing_price or issue_price,
                'gain_loss_percent': round(gain, 2) if gain is not None else 0,
                'gain_loss_value': round((ltp or listing_price or issue_price) - issue_price, 2),
                'exchange': 'NSE & BSE', 'source': 'Economic Times', 'source_url': LISTED_URL,
                'updated_at': dt.datetime.now(dt.timezone.utc).isoformat()
            })
    except Exception as exc:
        errors.append(str(exc))

    # De-duplicate and keep the nine newest listing dates.
    merged = {}
    for x in rows + (old_listed if isinstance(old_listed, list) else []):
        if not isinstance(x, dict) or not x.get('name'): continue
        key = norm_name(x.get('name'))
        if key not in merged or str(x.get('updated_at','')) > str(merged[key].get('updated_at','')):
            merged[key] = x
    rows = sorted(merged.values(), key=lambda x: str(x.get('listing_date','')), reverse=True)[:9]
    return rows, errors

def collect_news(ipos, old_news):
    """Collect up to 9 recent news stories tied only to currently live/upcoming IPOs.
    The rolling 5-day window makes the feed refresh naturally each day and whenever IPO status changes.
    """
    now = dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=5)
    errors, stories, seen = [], [], set()

    live = [x for x in ipos if str(x.get('status') or '').lower() in ('open', 'upcoming')]
    live.sort(key=lambda x: (0 if str(x.get('status')).lower() == 'open' else 1, str(x.get('open') or '')))

    def aliases(ipo):
        name = clean_text(ipo.get('name'))
        words = [w.lower() for w in re.findall(r'[A-Za-z]+', name)
                 if len(w) >= 3 and w.lower() not in {'limited','ltd','india','ind','private','pvt','company','technologies','technology'}]
        compact = re.sub(r'[^a-z0-9]', '', name.lower())
        acronym = ''.join(w[0] for w in words)
        return name.lower(), words, compact, acronym

    def matches_ipo(title, ipo):
        low = clean_text(title).lower()
        norm = re.sub(r'[^a-z0-9]', '', low)
        name, words, compact, acronym = aliases(ipo)
        if name and name in low: return True
        if compact and compact in norm: return True
        if acronym and len(acronym) >= 2 and re.search(r'\\b' + re.escape(acronym) + r'\\b', low): return True
        hits = sum(1 for w in words if len(w) >= 5 and w in low)
        return hits >= (2 if len([w for w in words if len(w) >= 5]) >= 2 else 1)

    def add_item(title, link, source, published, ipo):
        title = clean_text(title)
        link = html.unescape(str(link or '')).strip()
        if not title or not link or link in seen or not matches_ipo(title, ipo):
            return
        if published is None or published < cutoff or published > now + dt.timedelta(hours=2):
            return
        seen.add(link)
        stories.append({
            'title': title[:260],
            'date': published.astimezone(dt.timezone.utc).date().isoformat(),
            'source': clean_text(source) or 'News',
            'link': link,
            'published_at': published.astimezone(dt.timezone.utc).isoformat(),
            'topic': 'Live / Upcoming IPO',
            'ipo_name': clean_text(ipo.get('name')),
            'ipo_status': str(ipo.get('status') or '').upper()
        })

    for ipo in live[:12]:
        name = clean_text(ipo.get('name'))
        if not name: continue
        query = urllib.parse.quote_plus(name + ' IPO')
        try:
            root = ET.fromstring(request_text(NEWS_RSS.format(query=query), timeout=20))
            for item in root.findall('.//item'):
                pub = item.findtext('pubDate', '')
                try:
                    published = parsedate_to_datetime(pub).astimezone(dt.timezone.utc) if pub else None
                except Exception:
                    published = None
                add_item(item.findtext('title', ''), item.findtext('link', ''),
                         item.findtext('source', ''), published, ipo)
        except Exception as exc:
            errors.append(f'{name}: {exc}')

    # Reuse only recent old stories that still belong to a currently live/upcoming IPO.
    for old in old_news if isinstance(old_news, list) else []:
        if len(stories) >= 9: break
        if not isinstance(old, dict): continue
        try:
            published = dt.datetime.fromisoformat(str(old.get('published_at')).replace('Z', '+00:00')) if old.get('published_at') else dt.datetime.combine(dt.date.fromisoformat(str(old.get('date'))), dt.time(), tzinfo=dt.timezone.utc)
        except Exception:
            continue
        for ipo in live:
            if matches_ipo(old.get('title', ''), ipo):
                add_item(old.get('title'), old.get('link'), old.get('source'), published, ipo)
                if len(stories) >= 9: break

    stories.sort(key=lambda x: x.get('published_at', ''), reverse=True)
    stories = stories[:9]
    if stories:
        NEWS_OUT.write_text(json.dumps(stories, ensure_ascii=False, indent=2), encoding='utf-8')
    elif NEWS_OUT.exists():
        try:
            old = json.loads(NEWS_OUT.read_text(encoding='utf-8'))
            stories = [x for x in old if isinstance(x, dict) and x.get('ipo_name')][:9]
        except Exception:
            stories = []
    return stories, errors

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
    news, news_errors = collect_news(final_ipos, old.get('news', []))
    payload = {
        'source': 'multi-source-live-gmp',
        'updated_at': now,
        'sources': {
            'NSE': {'ok': bool(ipos), 'records': len(ipos), 'errors': nse_errors[:3]},
            'BSE': {'ok': not bse_errors, 'records': 0, 'errors': bse_errors[:3]},
            'SEBI': {'ok': bool(docs), 'records': len(docs), 'errors': sebi_errors[:3]},
            'GMP': {'ok': gmp_count > 0, 'records': gmp_count, 'sources': ['InvestorGain','Chittorgarh','Moneycontrol'], 'errors': gmp_errors[:5]},
            'NEWS': {'ok': len(news) > 0, 'records': len(news), 'source': 'Google News RSS public feeds', 'window_days': 5, 'errors': news_errors[:5]}
        },
        'ipos': final_ipos,
        'listed': old.get('listed', []),
        'news': news,
        'documents': docs or old.get('documents', [])
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({'updated_at': now, 'ipos': len(payload['ipos']), 'documents': len(payload['documents']), 'nse_ok': bool(ipos), 'bse_ok': not bse_errors, 'sebi_ok': bool(docs), 'gmp_records': gmp_count, 'news_records': len(news)}, indent=2))

if __name__ == '__main__': main()
