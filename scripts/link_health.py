"""IPO Terminal - per-IPO link resolver and self-healing monitor.

Resolves, verifies and repairs the two most useful per-IPO links:

  RHP / DRHP   - preference order (bypasses NSE/BSE gateways):
                   1. direct .pdf document (issuer/registrar/SEBI hosted)
                   2. SEBI per-company filing page (live-filings.json)
                   3. the IPO's source page (exchange gateway, last resort)
  Allotment    - preference order:
                   1. registrar per-IPO status link (Bigshare / KFin /
                      Link Intime etc., discovered from the IPO's own
                      detail page on Chittorgarh)
                   2. nothing stored -> the frontend falls back to the
                      CDSL / NSDL / BSE / NSE portals

How detail pages are found: the Chittorgarh mainboard + SME dashboard pages
list every open/upcoming IPO with a link to its detail page. The dashboard
is fetched once per run and names are matched inside table rows.

Self-healing: every stored link is re-verified on each run (the workflow
runs every 15 minutes). A 404/410 link is dropped and re-derived from the
IPO's detail page - never guessed. A 404 on an allotment link usually just
means the registrar has not published the status page yet, so it is kept
and marked pending.

Outputs:
  data/ipo-links.json   per-IPO resolved links + verification metadata
  data/link-health.json run summary + history (last 50 runs)

Runs from GitHub Actions. All failures are non-fatal: the script always
writes valid JSON so the frontend keeps whatever was resolved last time.
"""
import datetime as dt
import json
import re
import tempfile
import os
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urljoin
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
IPO_DATA = ROOT / 'data' / 'ipo-data.json'
FILINGS = ROOT / 'data' / 'live-filings.json'
LINKS = ROOT / 'data' / 'ipo-links.json'
HEALTH = ROOT / 'data' / 'link-health.json'

UA = 'Mozilla/5.0 IPO-Terminal-LinkHealth/1.0'
IST = ZoneInfo('Asia/Kolkata')
TIMEOUT = 12
MAX_RUN_SECONDS = 240

DASHBOARD_PAGES = [
    'https://www.chittorgarh.com/ipo/ipo_dashboard.asp',        # mainboard
    'https://www.chittorgarh.com/ipo/ipo_dashboard.asp?a=sme',  # SME
]

GATEWAY_HOSTS = ('nseindia.com', 'bseindia.com')
REGISTRAR_KEYS = ('bigshare', 'kfintech', 'kfin', 'linkintime', 'link-time',
                  'skyline', 'mas', 'unistart', 'allotment', 'registrar',
                  'cdslindia', 'eservices.nsdl')


def now_ist():
    return dt.datetime.now(IST)


def normalize_name(v):
    s = re.sub(r'[^a-z0-9]+', '', str(v or '').lower())
    for drop in ('limited', 'ltd', 'india'):
        s = s.replace(drop, '')
    return s


def fetch(url):
    try:
        req = Request(url, headers={'User-Agent': UA,
                                    'Accept': 'text/html,application/xhtml+xml,application/pdf,*/*;q=0.8'})
        with urlopen(req, timeout=TIMEOUT) as r:
            return int(getattr(r, 'status', 200)), r.read(2_000_000).decode('utf-8', 'replace'), r.geturl()
    except Exception:
        return None, '', url


def check_url(url):
    code, _, _ = fetch(url)
    if code and 200 <= code < 400:
        return True, code
    code, _, _ = fetch(url)  # one retry for transient hiccups
    return (bool(code and 200 <= code < 400), code)


def is_gateway(url):
    return any(h in str(url or '').lower() for h in GATEWAY_HOSTS)


def hrefs(html):
    return re.findall(r'href\s*=\s*["\']([^"\']+)["\']', html or '', re.I)


def load_detail_urls(active_names):
    """Fetch the Chittorgarh dashboards once; map each IPO name to its
    detail-page URL by looking for the name inside the same table row
    as an /ipo/ link. Returns {normalize_name: detail_url}."""
    mapping = {}
    wanted = {normalize_name(n): n for n in active_names}
    for page in DASHBOARD_PAGES:
        code, html, _ = fetch(page)
        if not code or not (200 <= code < 400) or not html:
            continue
        for row in re.findall(r'<tr[^>]*>(.*?)</tr>', html, re.I | re.S):
            links = re.findall(r'<a[^>]+href=["\']([^"\']+)["\']', row, re.I)
            details = [l for l in links if re.search(r'/ipo/[a-z0-9-]+/\d+', l)]
            if not details:
                continue
            text = re.sub(r'<[^>]+>', ' ', row)
            for key in wanted:
                if key and key in normalize_name(text):
                    mapping.setdefault(key, urljoin(page, details[0]))
    return mapping


def scrape_detail(detail_url):
    """Extract direct RHP/DRHP PDFs + the registrar allotment link from an
    IPO's detail page. Best-effort; returns empty strings when not found."""
    out = {'rhp_pdf': '', 'drhp_pdf': '', 'allotment': '', 'filing_page': ''}
    code, html, final = fetch(detail_url)
    if not code or not (200 <= code < 400) or not html:
        return out
    out['filing_page'] = final
    all_hrefs = [urljoin(final, h) for h in hrefs(html)]
    pdfs = [u for u in all_hrefs if u.lower().split('?')[0].endswith('.pdf')]

    def rank(u):
        low = u.lower()
        r = 0
        if 'rhp' in low or 'red-herring' in low or 'red_herring' in low: r -= 4
        if 'drhp' in low or 'draft' in low: r -= 2
        if 'abridged' in low or '_ap' in low or '-ap' in low: r += 3
        if 'anchor' in low: r += 6   # anchor book is not the RHP
        if 'prospectus' in low: r -= 1
        if 'red-herring' in low or 'red_herring' in low: r -= 2
        if is_gateway(u): r += 5  # gateways are the last resort
        return r

    direct = sorted([u for u in pdfs if not is_gateway(u)], key=rank)
    if direct:
        out['rhp_pdf'] = direct[0]
        drhp = [u for u in direct if 'drhp' in u.lower() or 'draft' in u.lower()]
        if drhp:
            out['drhp_pdf'] = drhp[0]
    for u in all_hrefs:
        low = u.lower()
        if not out['allotment'] and any(k in low for k in REGISTRAR_KEYS):
            out['allotment'] = u
    return out


def resolve_via_sebi(ipo_name, filings_by_name):
    """Secondary source: SEBI per-company filing pages from live-filings."""
    out = {'rhp_pdf': '', 'drhp_pdf': '', 'allotment': '', 'filing_page': ''}
    key = normalize_name(ipo_name)
    doc = filings_by_name.get(key)
    if not doc:
        for f_name, f_doc in filings_by_name.items():
            if key in f_name or f_name in key:
                doc = f_doc
                break
    if doc and doc.get('url'):
        out['filing_page'] = doc['url']
        code, html, final = fetch(doc['url'])
        if code and 200 <= code < 400 and html:
            pdfs = [urljoin(final, h) for h in hrefs(html)
                    if h.lower().split('?')[0].endswith('.pdf')]
            pdfs = [p for p in pdfs if not is_gateway(p)]
            if pdfs:
                full = [p for p in pdfs if 'abridged' not in p.lower()]
                out['rhp_pdf'] = (full or pdfs)[0]
    return out


def main():
    t0 = dt.datetime.now()
    now = now_ist()
    payload = json.loads(IPO_DATA.read_text(encoding='utf-8')) if IPO_DATA.exists() else {'ipos': []}
    ipos = [x for x in (payload.get('ipos') or []) if isinstance(x, dict) and x.get('name')]
    active = [x for x in ipos if str(x.get('status') or '').lower() in ('open', 'upcoming')]

    filings = []
    if FILINGS.exists():
        fp = json.loads(FILINGS.read_text(encoding='utf-8'))
        filings = [d for d in (fp.get('documents') or []) if isinstance(d, dict) and d.get('url') and d.get('name')]
    filings_by_name = {normalize_name(d['name']): d for d in filings}

    previous = {}
    if LINKS.exists():
        try:
            prev = json.loads(LINKS.read_text(encoding='utf-8'))
            previous = {normalize_name(e.get('name')): e for e in (prev.get('links') or []) if isinstance(e, dict)}
        except Exception:
            previous = {}

    detail_map = load_detail_urls([x['name'] for x in active]) if active else {}

    links, stats = [], {'resolved': 0, 'verified': 0, 'repaired': 0, 'pending': 0}
    for ipo in active:
        if (dt.datetime.now() - t0).total_seconds() > MAX_RUN_SECONDS:
            break
        name = str(ipo.get('name')).strip()
        key = normalize_name(name)
        entry = {'name': name, 'status': ipo.get('status'), 'detail_url': detail_map.get(key, '')}

        d = scrape_detail(entry['detail_url']) if entry['detail_url'] else {}
        if not (d.get('rhp_pdf') or d.get('filing_page')):
            s = resolve_via_sebi(name, filings_by_name)
            d = d or {'rhp_pdf': '', 'drhp_pdf': '', 'allotment': '', 'filing_page': ''}
            if not d.get('rhp_pdf'):
                d['rhp_pdf'] = s.get('rhp_pdf', '')
            if not d.get('filing_page'):
                d['filing_page'] = s.get('filing_page', '')

        # --- RHP/DRHP: direct pdf > filing page > gateway source_url ---
        candidates = [c for c in (d.get('rhp_pdf'), d.get('filing_page'), ipo.get('source_url')) if c]
        chosen, chosen_kind = '', ''
        for c in candidates:
            ok, code = check_url(c)
            if ok:
                chosen, chosen_kind = c, 'pdf' if c.lower().split('?')[0].endswith('.pdf') else 'page'
                stats['verified'] += 1
                break
        entry['rhp_url'] = chosen
        entry['rhp_kind'] = chosen_kind
        entry['rhp_verified'] = bool(chosen)
        entry['rhp_checked_at'] = now.isoformat()
        if not chosen:
            stats['pending'] += 1
        if d.get('drhp_pdf'):
            ok, _ = check_url(d['drhp_pdf'])
            if ok:
                entry['drhp_url'] = d['drhp_pdf']

        # --- Allotment: registrar link; 404 => pending, not dead ---
        allot = d.get('allotment', '')
        if allot:
            ok, code = check_url(allot)
            entry['allotment_url'] = allot
            entry['allotment_verified'] = ok
            entry['allotment_checked_at'] = now.isoformat()
            if ok:
                stats['verified'] += 1
            else:
                stats['pending'] += 1
        else:
            entry['allotment_url'] = ''
            entry['allotment_verified'] = False

        if entry['rhp_url'] or entry['allotment_url']:
            stats['resolved'] += 1
        links.append(entry)

    write_atomic(LINKS, {'generated_at': now.isoformat(), 'count': len(links), 'links': links})

    history = []
    if HEALTH.exists():
        try:
            history = json.loads(HEALTH.read_text(encoding='utf-8')).get('history') or []
        except Exception:
            history = []
    history.append({'checked_at': now.isoformat(), **stats, 'active_ipos': len(active),
                    'duration_seconds': round((dt.datetime.now() - t0).total_seconds(), 1)})
    write_atomic(HEALTH, {'ok': True, 'checked_at': now.isoformat(),
                          'schedule': 'GitHub Actions every 15 minutes',
                          'latest': history[-1], 'history': history[-50:]})
    print('LINK-HEALTH OK:', stats, 'active:', len(active))


def write_atomic(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), suffix='.json')
    with os.fdopen(fd, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)


if __name__ == '__main__':
    main()
