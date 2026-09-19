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
    m = re.search(r'(?:₹|Rs\\.?\\s*)\\s*(-?[0-9]+(?:\\.[0-9]+)?)', text, re.I)
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None

# GMP is unofficial, so IPO Terminal uses multiple public aggregators for
# cross-checking. The first successful source is the primary displayed value;
# all other successful quotes are retained for audit/conflict detection.
GMP_SOURCES = [
    ('InvestorGain', 'https://www.investorgain.com/report/ipo-gmp-live/331/all/'),
    ('Chittorgarh', 'https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/'),
    ('Moneycontrol', 'https://www.moneycontrol.com/ipo/ipo-gmp/'),
    ('IPODose', 'https://ipodose.com/in/ipo-gmp/'),
    ('GMPWatch', 'https://www.gmpwatch.in/'),
    ('IPOGram', 'https://ipogram.in/ipo-gmp/'),
    ('IPOMarket', 'https://www.ipomarket.in/'),
    ('LiveGMP', 'https://livegmp.com/ipo'),
]

def _gmp_aliases(name):
    clean = clean_text(name).lower()
    base = re.sub(r'\\b(limited|ltd|india|private|pvt|company|technologies|technology|inc)\\b', ' ', clean)
    base = re.sub(r'[^a-z0-9]+', ' ', base).strip()
    compact = re.sub(r'[^a-z0-9]', '', base)
    words = [w for w in base.split() if len(w) >= 4]
    aliases = {base, compact}
    if words:
        aliases.add(' '.join(words[:2]))
        aliases.add(words[0])
    return {x for x in aliases if x}

def _gmp_match_score(page_text, company):
    low = clean_text(page_text).lower()
    compact = re.sub(r'[^a-z0-9]+', '', low)
    scores = []
    for alias in _gmp_aliases(company):
        a = re.sub(r'[^a-z0-9]+', '', alias)
        if a and a in compact:
            scores.append(len(a))
    return max(scores) if scores else 0

def _extract_gmp_near_company(page_text, company):
    text = clean_text(page_text)
    if not _gmp_match_score(text, company):
        return None
    # Prefer a GMP-labelled quote close to the company name.
    aliases = sorted(_gmp_aliases(company), key=len, reverse=True)
    for alias in aliases:
        if not alias:
            continue
        pattern = re.compile(re.escape(alias).replace(r'\\ ', r'\\s+'), re.I)
        m = pattern.search(text)
        if not m:
            continue
        chunk = text[max(0, m.start()-80):m.end()+300]
        g = re.search(r'(?:gmp|grey market premium|premium)[^₹0-9-]{0,80}₹?\\s*(-?[0-9]{1,6}(?:\\.[0-9]+)?)', chunk, re.I)
        if not g:
            g = re.search(r'₹\\s*(-?[0-9]{1,6}(?:\\.[0-9]+)?)\\s*(?:gmp|grey market premium|premium)', chunk, re.I)
        if g:
            try:
                return float(g.group(1))
            except ValueError:
                pass
        # Many GMP pages put the numeric quote immediately after the company.
        nums = re.findall(r'(?:₹|Rs\\.?\\s*)\\s*(-?[0-9]{1,6}(?:\\.[0-9]+)?)', chunk, re.I)
        if nums:
            try:
                return float(nums[0])
            except ValueError:
                pass
    return None

def _parse_gmp_source(source_name, page_text):
    result = {}
    text = clean_text(page_text)
    # First parse table rows; this works well for InvestorGain/Chittorgarh style pages.
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', page_text, re.I | re.S)
    for row in rows:
        cells = [clean_text(x) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', row, re.I | re.S)]
        if len(cells) < 2:
            continue
        name = cells[0]
        gmp = None
        for cell in cells[1:7]:
            if '₹' in cell or 'rs' in cell.lower() or 'gmp' in cell.lower() or 'premium' in cell.lower():
                gmp = parse_gmp_value(cell)
                if gmp is not None:
                    break
        if gmp is not None and name:
            result[norm_name(name)] = {'name': name, 'gmp': gmp}
    return result

def _find_gmp_for_ipo(source_name, raw, parsed, ipo_name):
    key = norm_name(ipo_name)
    hit = parsed.get(key)
    if hit:
        return hit['gmp']
    # Fuzzy matching against parsed table names.
    for k, row in parsed.items():
        if key and k and (key in k or k in key):
            return row['gmp']
    return _extract_gmp_near_company(raw, ipo_name)

def apply_gmp(ipo, value, source, source_url, fetched_at, source_updated_at=None, all_quotes=None):
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
    if all_quotes:
        ipo['gmp_sources'] = all_quotes
        nums = [float(x['gmp']) for x in all_quotes if isinstance(x, dict) and isinstance(x.get('gmp'), (int,float))]
        if len(nums) >= 2:
            spread = max(nums) - min(nums)
            ipo['gmp_conflict'] = bool(spread >= 10)
            ipo['gmp_range'] = f'₹{int(min(nums))}–₹{int(max(nums))}'
    _, hi, _ = parse_price_band(ipo.get('price'))
    if hi and hi > 0:
        pct = g / hi * 100
        ipo['gmp_pct'] = f'{pct:+.1f}%'
        ipo['est_list'] = f'₹{int(hi + g) if float(hi + g).is_integer() else round(hi + g,2)}'
    return True

def collect_gmp(ipos, old_ipos):
    errors, matched = [], 0
    fetched_at = dt.datetime.now(dt.timezone.utc).isoformat()
    source_pages = []
    # Fetch each public source once per run. This gives redundancy without making
    # one IPO trigger many network requests.
    for source, url in GMP_SOURCES:
        try:
            raw = request_text(url, timeout=20)
            if raw and len(raw) > 300:
                source_pages.append((source, url, raw, _parse_gmp_source(source, raw)))
            else:
                errors.append(f'{source}: empty response')
        except Exception as exc:
            errors.append(f'{source}: {exc}')

    old_map = {norm_name(i.get('name')): i for i in old_ipos if isinstance(i, dict) and i.get('name')}

    for ipo in ipos:
        quotes = []
        for source, url, raw, parsed in source_pages:
            value = _find_gmp_for_ipo(source, raw, parsed, ipo.get('name',''))
            if value is not None:
                quotes.append({'source': source, 'gmp': value, 'url': url, 'fetched_at': fetched_at})

        # Prefer InvestorGain, then the remaining sources in declared order.
        chosen = None
        for preferred in [x[0] for x in GMP_SOURCES]:
            chosen = next((q for q in quotes if q['source'] == preferred), None)
            if chosen:
                break

        if chosen:
            if apply_gmp(ipo, chosen['gmp'], chosen['source'], chosen['url'], fetched_at, all_quotes=quotes):
                matched += 1
            continue

        # Keep the last verified quote if every public source is temporarily down.
        old = old_map.get(norm_name(ipo.get('name')))
        if old and old.get('gmp') not in (None, '', '—', '-'):
            for k in ('gmp','gmp_pct','est_list','gmp_source','gmp_source_url','gmp_updated_at','gmp_source_updated_at','gmp_sources','gmp_conflict','gmp_range'):
                if k in old:
                    ipo[k] = old[k]
            ipo['gmp_stale'] = True
        else:
            # Google Sheet fallback can still supply a missing GMP later in the pipeline.
            ipo['gmp_stale'] = False

    return matched, errors

def collect_listed(old_listed):
    """Refresh the rolling latest-9 listed IPOs with issue, listing and current prices."""
    errors, rows = [], []
    try:
        page = request_text(LISTED_URL, timeout=30)
        trs = re.findall(r'<tr[^>]*>(.*?)</tr>', page, re.I | re.S)
        for tr in trs:
            cells = [clean_text(x) for x in re.findall(r'<t[dh][^>]*>(.*?)</t[dh]>', tr, re.I | re.S)]
            if len(cells) < 6:
                continue
            name = re.sub(r'(Mainboard|SME)$', '', cells[0], flags=re.I).strip()
            if not name or name.lower() in ('company name', 'company'):
                continue
            listing_date = parse_date(cells[1])
            if not listing_date:
                continue
            nums = []
            for c in cells[3:]:
                m = re.search(r'₹?\s*(-?[0-9]+(?:\.[0-9]+)?)', c.replace(',', ''))
                nums.append(float(m.group(1)) if m else None)
            issue_price = nums[0] if len(nums) > 0 else None
            listing_price = nums[1] if len(nums) > 1 else None
            ltp = nums[2] if len(nums) > 2 else None
            gain = None
            for c in cells[3:]:
                m = re.search(r'(-?[0-9]+(?:\.[0-9]+)?)\s*%', c)
                if m:
                    gain = float(m.group(1))
                    break
            if gain is None and issue_price and ltp:
                gain = (ltp - issue_price) / issue_price * 100
            if issue_price is None:
                continue
            rows.append({
                'name': name,
                'listing_date': listing_date,
                'issue_price': issue_price,
                'listing_price': listing_price or issue_price,
                'current_price': ltp or listing_price or issue_price,
                'gain_loss_percent': round(gain, 2) if gain is not None else 0,
                'gain_loss_value': round((ltp or listing_price or issue_price) - issue_price, 2),
                'exchange': 'NSE & BSE',
                'source': 'Economic Times',
                'source_url': LISTED_URL,
                'updated_at': dt.datetime.now(dt.timezone.utc).isoformat()
            })
    except Exception as exc:
        errors.append(str(exc))

    merged = {}
    for x in rows + (old_listed if isinstance(old_listed, list) else []):
        if not isinstance(x, dict) or not x.get('name'):
            continue
        key = norm_name(x.get('name'))
        if key not in merged or str(x.get('updated_at', '')) > str(merged[key].get('updated_at', '')):
            merged[key] = x
    rows = sorted(merged.values(), key=lambda x: str(x.get('listing_date', '')), reverse=True)[:9]
    return rows, errors

def _ipo_status(ipo):
    """Derive status from issue dates so bucket changes happen automatically."""
    today = dt.date.today()
    op = parse_date(ipo.get('open'))
    cl = parse_date(ipo.get('close'))
    if op and today < dt.date.fromisoformat(op):
        return 'upcoming'
    if cl and today > dt.date.fromisoformat(cl):
        return 'closed'
    if op and cl:
        return 'open'
    return str(ipo.get('status') or 'upcoming').lower()

def _news_aliases(ipo):
    name = clean_text(ipo.get('name'))
    base = re.sub(r'\b(limited|ltd|india|private|pvt|company|technologies|technology)\b', ' ', name, flags=re.I)
    base = re.sub(r'[^a-z0-9]+', ' ', base.lower()).strip()
    aliases = {base, re.sub(r'\s+', '', base)}
    words = [w for w in base.split() if len(w) >= 4]
    if words:
        aliases.add(' '.join(words[:2]))
        aliases.add(words[0])
    symbol = clean_text(ipo.get('symbol')).lower()
    if symbol:
        aliases.add(symbol)
    special = {
        'national stock exchange of india': {'nse', 'national stock exchange'},
        'sonaselection': {'sona selection', 'sonaselection'},
        'ss retail': {'ss retail'},
        'jindal supreme': {'jindal supreme'},
        'spectraa technology solutions': {'spectraa technology', 'spectraa'},
        'kheria autocomp': {'kheria autocomp'},
        'axiom gas engineering': {'axiom gas', 'axiom gas engineering'},
    }
    compact = re.sub(r'[^a-z0-9]+', '', base)
    aliases.update(special.get(compact, set()))
    return {a for a in aliases if a}

def _match_news_ipo(title, candidates):
    low = clean_text(title).lower()
    compact = re.sub(r'[^a-z0-9]+', '', low)
    scored = []
    for ipo in candidates:
        aliases = _news_aliases(ipo)
        score = 0
        for alias in aliases:
            a = re.sub(r'[^a-z0-9]+', '', alias)
            if a and (a in compact or alias in low):
                score = max(score, len(a))
        if score:
            scored.append((score, ipo))
    return max(scored, key=lambda x: x[0])[1] if scored else None

def collect_news(ipos, old_news):
    """Build three current buckets: 3 OPEN + 3 UPCOMING + 3 CLOSED.
    Stories are limited to the latest 5 days and are tagged with the IPO/status
    they matched. As an IPO changes status, its news moves buckets automatically.
    """
    now = dt.datetime.now(dt.timezone.utc)
    cutoff = now - dt.timedelta(days=5)
    errors, buckets, seen = [], {'open': [], 'upcoming': [], 'closed': []}, set()

    status_map = {'open': [], 'upcoming': [], 'closed': []}
    for ipo in ipos if isinstance(ipos, list) else []:
        if isinstance(ipo, dict) and ipo.get('name'):
            status_map[_ipo_status(ipo)].append(ipo)

    # Query every current IPO, prioritising the three buckets needed by the UI.
    query_rows = []
    for bucket in ('open', 'upcoming', 'closed'):
        for ipo in status_map[bucket][:12]:
            name = clean_text(ipo.get('name'))
            if name:
                query_rows.append((f'"{name}" IPO India', ipo, bucket))

    # Broad queries help discover newer stories for dated upcoming/closed issues.
    query_rows += [
        ('India IPO latest September 2026', None, None),
        ('India upcoming IPO September 2026', None, None),
        ('India IPO allotment September 2026', None, None),
        ('India IPO subscription September 2026', None, None),
    ]

    def add_item(title, link, source, published, ipo_hint=None, bucket_hint=None):
        title = clean_text(title)
        link = html.unescape(str(link or '')).strip()
        if not title or not link or link in seen or published is None:
            return
        if published < cutoff or published > now + dt.timedelta(hours=2):
            return

        candidates = status_map.get(bucket_hint, []) if bucket_hint else [x for arr in status_map.values() for x in arr]
        ipo = _match_news_ipo(title, candidates)
        if not ipo and ipo_hint:
            ipo = ipo_hint
        if not ipo:
            return

        bucket = _ipo_status(ipo)
        if bucket not in buckets:
            return
        # A generic article is accepted only when it contains a meaningful IPO name match.
        seen.add(link)
        buckets[bucket].append({
            'title': title[:260],
            'date': published.astimezone(dt.timezone.utc).date().isoformat(),
            'source': clean_text(source) or 'News',
            'link': link,
            'published_at': published.astimezone(dt.timezone.utc).isoformat(),
            'topic': 'IPO News',
            'ipo_name': clean_text(ipo.get('name')),
            'ipo_status': bucket
        })

    for query, ipo_hint, bucket_hint in query_rows:
        try:
            url = NEWS_RSS.format(query=urllib.parse.quote_plus(query))
            root = ET.fromstring(request_text(url, timeout=20))
            for item in root.findall('.//item'):
                pub = item.findtext('pubDate', '')
                try:
                    published = parsedate_to_datetime(pub).astimezone(dt.timezone.utc) if pub else None
                except Exception:
                    published = None
                add_item(
                    item.findtext('title', ''),
                    item.findtext('link', ''),
                    item.findtext('source', ''),
                    published,
                    ipo_hint,
                    bucket_hint
                )
        except Exception as exc:
            errors.append(f'{query}: {exc}')

    # Reuse only recent old stories that can still be tied to a current IPO.
    for old in old_news if isinstance(old_news, list) else []:
        if not isinstance(old, dict):
            continue
        try:
            published = dt.datetime.fromisoformat(str(old.get('published_at')).replace('Z', '+00:00')) if old.get('published_at') else dt.datetime.combine(dt.date.fromisoformat(str(old.get('date'))), dt.time(), tzinfo=dt.timezone.utc)
        except Exception:
            continue
        title = clean_text(old.get('title'))
        ipo = None
        stored_name = clean_text(old.get('ipo_name'))
        if stored_name:
            all_current = [x for arr in status_map.values() for x in arr]
            ipo = next((x for x in all_current if norm_name(x.get('name')) == norm_name(stored_name)), None)
        if not ipo:
            all_current = [x for arr in status_map.values() for x in arr]
            ipo = _match_news_ipo(title, all_current)
        if ipo:
            add_item(title, old.get('link'), old.get('source'), published, ipo, _ipo_status(ipo))

    # Keep the newest three per bucket; never fabricate missing stories.
    stories = []
    for bucket in ('open', 'upcoming', 'closed'):
        rows = sorted(buckets[bucket], key=lambda x: x.get('published_at', ''), reverse=True)
        buckets[bucket] = rows[:3]
        stories.extend(buckets[bucket])

    if stories:
        NEWS_OUT.write_text(json.dumps(stories, ensure_ascii=False, indent=2), encoding='utf-8')
    elif NEWS_OUT.exists():
        try:
            stories = json.loads(NEWS_OUT.read_text(encoding='utf-8'))
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
    # Keep recently closed IPOs in the frontend dataset so the News panel can
    # always maintain a separate CLOSED bucket. Current/upcoming records from
    # NSE are merged with historical records whose close date has passed.
    today = dt.date.today()
    current_keys = {norm_name(x.get('name')) for x in final_ipos if isinstance(x, dict) and x.get('name')}
    for old_item in old.get('ipos', []) if isinstance(old.get('ipos', []), list) else []:
        if not isinstance(old_item, dict) or not old_item.get('name'): continue
        close = parse_date(old_item.get('close'))
        if close and close < today.isoformat():
            item = dict(old_item)
            item['status'] = 'closed'
            key = norm_name(item.get('name'))
            if key not in current_keys:
                final_ipos.append(item)
                current_keys.add(key)
    for item in final_ipos:
        close = parse_date(item.get('close'))
        if close and close < today.isoformat():
            item['status'] = 'closed'
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
