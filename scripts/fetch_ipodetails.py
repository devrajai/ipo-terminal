#!/usr/bin/env python3
"""Fetch per-IPO detail pages and build data/ipo-details.json.

For every OPEN IPO: locate its IPO page via listing/GMP sources (with a
search-engine fallback), fetch it, and extract:
  - sector (table rows only - no text regex, avoids garbage)
  - live subscription by category (RII / NII / QIB / Total, sane x-times only)
  - anchor book summary (total raised, mutual-fund / FII portion, investor count)
  - peer comparison table (name + P/E)
  - company financials per FY (assets, income, PAT, EBITDA, net worth,
    borrowing, in Rs Cr) from the restated consolidated table
  - KPI table (ROE, ROCE, Debt/Equity, PAT margin, EBITDA margin, NAV)
  - promoter pre-IPO holding
  - the working page URL (shown to users as the source link)

Also backfills fundamentals into data/ipo-data.json (missing fields only)
so the Radar / Coach / Decision cards get real numbers too.

Writes data/ipo-details.json. Tolerant: anything not found is left null and
the run never crashes on one bad page. Stdlib only.
"""
import datetime as dt
import html
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
IPODATA = DATA / 'ipo-data.json'
OUT = DATA / 'ipo-details.json'

UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/2.0'
SOURCES = [
    ('chittorgarh-mainboard', 'https://www.chittorgarh.com/report/mainboard-ipo-list-in-india-bse-nse/80/', 'https://www.chittorgarh.com'),
    ('chittorgarh-sme', 'https://www.chittorgarh.com/report/sme-ipo-list-in-india-bse-nse/83/', 'https://www.chittorgarh.com'),
    ('chittorgarh-gmp', 'https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/', 'https://www.chittorgarh.com'),
    ('chittorgarh-current-mb', 'https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/mainboard/', 'https://www.chittorgarh.com'),
    ('chittorgarh-current-sme', 'https://www.chittorgarh.com/report/ipo-in-india-list-main-board-sme/82/sme/', 'https://www.chittorgarh.com'),
    ('investorgain', 'https://www.investorgain.com/report/ipo-gmp-live/331/all/', 'https://www.investorgain.com'),
]

EMPTY = ('', None, '\u2014', '-', 'NA', 'N/A')


def clean(v):
    return re.sub(r'\s+', ' ', html.unescape(str(v or ''))).strip()


def norm(v):
    return re.sub(r'[^a-z0-9]', '', clean(v).lower()
                  .replace('limited', '').replace('india', '').replace('pvt', ''))


def fetch(url, timeout=30):
    req = urllib.request.Request(url, headers={
        'User-Agent': UA, 'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode('utf-8', 'ignore')


class TableParser(HTMLParser):
    """Collect all <table> rows as lists of cell texts."""

    def __init__(self):
        super().__init__()
        self.rows, self._row, self._cell = [], None, None
        self.tids, self._tid = [], 0

    def handle_starttag(self, tag, attrs):
        if tag == 'table':
            self._tid += 1
        if tag == 'tr':
            self._row = []
        elif tag in ('td', 'th') and self._row is not None:
            self._cell = []

    def handle_endtag(self, tag):
        if tag in ('td', 'th') and self._cell is not None and self._row is not None:
            self._row.append(clean(''.join(self._cell)))
            self._cell = None
        elif tag == 'tr' and self._row is not None:
            if any(x for x in self._row):
                self.rows.append(self._row)
                self.tids.append(self._tid)
            self._row = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def num(v):
    m = re.search(r'-?\d[\d,]*\.?\d*', clean(v))
    return float(m.group(0).replace(',', '')) if m else None


def is_open(ipo, today):
    o, c = str(ipo.get('open') or ''), str(ipo.get('close') or '')

    def dmy(v):
        try:
            p = [int(x) for x in v.strip().split('/')]
            return dt.date(2000 + p[2], p[1], p[0]) if len(p) == 3 else None
        except (ValueError, IndexError):
            return None
    d1, d2 = dmy(o), dmy(c)
    if d1 and d2:
        if d1 - dt.timedelta(days=3) <= today <= d2 + dt.timedelta(days=1):
            return True
        return 0 <= (d1 - today).days <= 10  # upcoming: pre-collect details
    return str(ipo.get('status') or '').lower() in ('open', 'live')


def extract_sector(rows):
    for r in rows:
        if len(r) >= 2 and 'sector' in r[0].lower():
            v = r[1]
            if v not in EMPTY:
                return v
    return None


def extract_subs(rows, tids=None):
    """subscription table: headers containing rii + qib; sane x-times only."""
    best = None
    for i, h in enumerate(rows):
        heads = [x.lower() for x in h]
        joined = ' '.join(heads)
        if ('rii' in joined or 'retail' in joined) and ('qib' in joined or 'nii' in joined):
            for r in rows[i + 1:i + 40]:
                cells = [x.lower() for x in r]
                line = ' '.join(cells)
                if not re.search(r'\d', line):
                    continue
                rec = {}
                for j, cell in enumerate(cells):
                    v = num(cell)
                    if v is None:
                        continue
                    if 'total' in cell or (j == 0 and 'total' in line):
                        rec.setdefault('total', v)
                    elif 'qib' in cell:
                        rec.setdefault('qib', v)
                    elif 'nii' in cell or 'hni' in cell:
                        rec.setdefault('nii', v)
                    elif 'rii' in cell or 'retail' in cell:
                        rec.setdefault('rii', v)
                # positional fallback: day row like [day 1, rii, nii, qib, total]
                if len(cells) >= 5 and not rec:
                    rec = {'rii': num(cells[1]), 'nii': num(cells[2]),
                           'qib': num(cells[3]), 'total': num(cells[4])}
                if rec and all(0 < v < 1000 for v in rec.values()):
                    best = rec
    # transposed layout: inside ONE table, rows = RII/NII/QIB/Total,
    # columns = day 1..N (latest day = last numeric cell)
    if tids:
        groups = {}
        for r, t in zip(rows, tids):
            groups.setdefault(t, []).append(r)
        for grp in groups.values():
            trans = {}
            for r in grp:
                if len(r) < 2 or not r[0]:
                    continue
                lab = clean(r[0]).lower()
                key = None
                if 'rii' in lab or 'retail' in lab:
                    key = 'rii'
                elif 'qib' in lab:
                    key = 'qib'
                elif 'nii' in lab or 'hni' in lab:
                    key = 'nii'
                elif 'total' in lab:
                    key = 'total'
                if not key or key in trans:
                    continue
                vals = [num(c) for c in r[1:]]
                vals = [v for v in vals if v is not None and 0 < v < 500]
                if vals:
                    trans[key] = vals[-1]
            if len(set(trans) & {'rii', 'nii', 'qib'}) >= 2:
                best = {**trans, **best} if best else trans
    return best


def extract_anchor(text):
    out = {}
    low = text.lower()
    m = (re.search(r'anchor[^.]{0,300}?(\d[\d,.]*)\s*(?:crore|cr\b)', low)
         or re.search(r'(\d[\d,.]*)\s*(?:crore|cr\b)[^.]{0,300}?anchor', low))
    if m:
        out['total_cr'] = num(m.group(1))
    m = re.search(r'(\d[\d,]*)\s*anchor\s*investors', low) or \
        re.search(r'anchor[^.]{0,200}?(\d[\d,]*)\s*investors', low)
    if m:
        out['investors'] = int(num(m.group(1)))
    m = re.search(r'mutual\s*funds?[^0-9]{0,80}(\d[\d,.]*)\s*(?:crore|cr\b)', low)
    if m:
        out['mf_cr'] = num(m.group(1))
    m = re.search(r'(?:fii|foreign)[^0-9]{0,80}(\d[\d,.]*)\s*(?:crore|cr\b)', low)
    if m:
        out['fii_cr'] = num(m.group(1))
    return out


def extract_financials(rows):
    """restated consolidated financials table: 'Period Ended' header + metric rows."""
    for i, h in enumerate(rows):
        if not h or 'period ended' not in clean(h[0]).lower() or len(h) < 3:
            continue
        periods = [clean(p) for p in h[1:]]
        labels = {'assets': 'assets', 'total income': 'income', 'revenue': 'income',
                  'profit after tax': 'pat', 'total borrowing': 'borrowing',
                  'net worth': 'networth', 'ebitda': 'ebitda'}
        out = {'periods': periods}
        for r in rows[i + 1:i + 12]:
            if not r or not r[0]:
                continue
            lab = re.sub(r'[^a-z ]', '', clean(r[0]).lower()).strip()
            lab = re.sub(r'\s+', ' ', lab)
            k = None
            if 'profit' in lab and 'tax' in lab:
                k = 'pat'
            elif lab in labels:
                k = labels[lab]
            if k:
                vals = [num(c) for c in r[1:len(h)]]
                while len(vals) < len(periods):
                    vals.append(None)
                out[k] = vals
        if 'income' in out and 'pat' in out:
            return out
    return None


def fy_growth(fin):
    """YoY growth (pct) for income and PAT using the two most recent FULL
    financial years (periods containing 'Mar')."""
    out = {}
    idx = [i for i, p in enumerate(fin['periods']) if 'mar' in p.lower()]
    if len(idx) < 2:
        return out
    a, b = idx[0], idx[1]
    for key, name in (('income', 'rev_growth'), ('pat', 'pat_growth')):
        v = fin.get(key)
        if v and v[a] is not None and v[b] not in (None, 0) and v[b] > 0:
            out[name] = round((v[a] - v[b]) / v[b] * 100, 1)
    return out


def extract_kpi(rows):
    """KPI table rows: ROE / ROCE / Debt-Equity / PAT Margin / EBITDA Margin / NAV."""
    kmap = {'roe': 'roe', 'roce': 'roce', 'debt/equity': 'de', 'debt equity': 'de',
            'debt to equity': 'de', 'pat margin': 'pat_margin',
            'ebitda margin': 'ebitda_margin', 'net profit margin': 'pat_margin',
            'nav': 'nav'}
    out = {}
    for r in rows:
        if len(r) < 2 or not r[0]:
            continue
        lab = re.sub(r'[^a-z/ ]', '', clean(r[0]).lower()).strip()
        lab = re.sub(r'\s+', ' ', lab)
        if lab in kmap and kmap[lab] not in out:
            v = clean(r[1])
            if num(v) is not None and v not in EMPTY:
                out[kmap[lab]] = v
    return out if len(out) >= 2 else None


def extract_promoter(rows):
    """pre-IPO promoter holding pct from the shareholding table."""
    for r in rows:
        if len(r) >= 2 and r[0] and 'promoter' in clean(r[0]).lower():
            v = num(r[1])
            if v is not None and 0 < v <= 100:
                return round(v, 2)
    return None


def extract_peers(rows):
    peers = []
    for i, h in enumerate(rows):
        heads = [x.lower() for x in h]
        joined = ' '.join(heads)
        if 'peer' not in joined and 'company' not in joined:
            continue
        if 'pe' not in joined and 'roe' not in joined:
            continue
        for r in rows[i + 1:i + 12]:
            if len(r) < 2:
                continue
            vals = list(r)
            if vals and re.fullmatch(r'[\d.,%]+', vals[0] or '') and len(vals) >= 2:
                vals = vals[1:]
            name = vals[0] if vals else ''
            if (not name or len(name) > 60 or len(name) < 3
                    or name.lower() in ('peer', 'company', 'peers', 'total')):
                continue
            item = {'name': name}
            hh = heads[1:] if len(r) == len(vals) + 1 else heads
            for j, v in enumerate(vals[1:], 1):
                if j >= len(hh):
                    break
                hj = re.sub(r'[^a-z/]', '', hh[j]).strip()
                if hj in ('pe', 'p/e', 'peratio', 'p/ex') and 'pe' not in item:
                    item['pe'] = clean(v)
                elif hj in ('roe', 'ronw') and 'roe' not in item:
                    item['roe'] = clean(v)
            if len(item) > 1:
                peers.append(item)
    return peers[:6]


def collect_links(text, base_domain):
    """all <a> links whose href mentions ipo; returns {normtext: url}"""
    out = {}
    for href, title in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', text, re.I | re.S):
        h = href.strip()
        if 'ipo' not in h.lower():
            continue
        if h.startswith('//'):
            h = 'https:' + h
        elif h.startswith('/'):
            h = base_domain + h
        if not h.startswith('http'):
            continue
        t = clean(title)
        if not t:
            continue
        k = norm(t)
        if k and k not in out:
            out[k] = h
        # also index by URL slug: /ipo/{slug}-ipo/{id}/ holds the full company name
        parts = [p for p in h.split('/') if p]
        for p in parts:
            if 'ipo' not in p.lower() and len(norm(p)) > 8:
                sp = norm(p)
                out.setdefault(sp, h)
    return out


def search_link(name):
    """Search engines -> chittorgarh IPO page URL for a company name."""
    import urllib.parse
    q = urllib.parse.quote(name + ' site:chittorgarh.com')
    for engine in (
            'https://html.duckduckgo.com/html/?q=',
            'https://lite.duckduckgo.com/lite/?q=',
            'https://www.bing.com/search?q='):
        for _ in range(2):
            try:
                text = fetch(engine + q, timeout=20)
                # direct links
                m = re.search(r'https://www\.chittorgarh\.com/ipo/[a-z0-9\-]+/\d+', text)
                if m:
                    return m.group(0)
                # ddg redirect params
                for mm in re.finditer(r'uddg=([^&"\']+)', text):
                    u = urllib.parse.unquote(mm.group(1))
                    if re.search(r'chittorgarh\.com/ipo/[a-z0-9\-]+/\d+', u):
                        return u
            except Exception:
                pass
    return None


def main():
    payload = json.loads(IPODATA.read_text(encoding='utf-8'))
    all_ipos = payload.get('ipos', [])
    today = dt.date.today()
    open_ipos = [x for x in all_ipos if x.get('name') and is_open(x, today)]
    print('open IPOs:', len(open_ipos))

    links = {}
    for sname, lp, dom in SOURCES:
        try:
            page = fetch(lp)
            got = collect_links(page, dom)
            print('%s: %d ipo links' % (sname, len(got)))
            links.update(got)
        except Exception as e:
            print('source failed:', sname, e)
    print('total listing links found:', len(links))

    result = {'updated_at': dt.datetime.now(dt.timezone.utc).isoformat(), 'ipos': {}}
    misses = []
    for ipo in open_ipos:
        name = ipo['name']
        key = norm(name)
        url = None
        best = None
        for k, u in links.items():
            if k == key:
                url = u
                break
            if len(k) > 6 and (k in key or key in k):
                if best is None or len(k) > len(best[0]):
                    best = (k, u)
        if not url and best:
            url = best[1]
        if not url:
            url = search_link(name)
            if url:
                print('search found:', name, '->', url)
        if not url:
            misses.append(name)
            print('NO LINK for:', name)
            result['ipos'][name] = {}
            continue
        entry = {}
        entry['url'] = url
        try:
            page = fetch(url)
            parser = TableParser()
            parser.feed(page)
            rows = parser.rows
            sec = extract_sector(rows)
            if sec:
                entry['sector'] = sec
            subs = extract_subs(rows, parser.tids)
            if subs:
                entry['subs'] = subs
            anc = extract_anchor(page)
            if anc:
                entry['anchor'] = anc
            peers = extract_peers(rows)
            if peers:
                entry['peers'] = peers
            fin = extract_financials(rows)
            if fin:
                entry['fin'] = fin
                for gk, gv in fy_growth(fin).items():
                    entry[gk] = gv
            kpi = extract_kpi(rows)
            if kpi:
                entry['kpi'] = kpi
            prom = extract_promoter(rows)
            if prom is not None:
                entry['promoter_pct'] = prom
            print('fetched %-42s sector=%-3s subs=%-3s anchor=%-3s peers=%d fin=%s kpi=%s prom=%s' % (
                name[:42], bool(entry.get('sector')), bool(entry.get('subs')),
                bool(entry.get('anchor')), len(entry.get('peers') or []),
                'fin' in entry, 'kpi' in entry, 'promoter_pct' in entry))
        except Exception as e:
            print('page failed:', name, e)
        result['ipos'][name] = entry

    # backfill real fundamentals into ipo-data.json (missing fields only)
    byname = {x.get('name'): x for x in all_ipos if x.get('name')}

    def missing(field):
        cur = str(x.get(field) or '').strip()
        return cur in ('', '-', '\u2014', 'None', 'NA', 'N/A') or cur.lower() in ('tba',)

    backfilled = 0
    for name, entry in result['ipos'].items():
        x = byname.get(name)
        if not x:
            continue
        kpi = entry.get('kpi') or {}
        fin = entry.get('fin') or {}
        fills = []
        if kpi.get('roe') and missing('roe'):
            fills.append(('roe', kpi['roe']))
        if kpi.get('roce') and missing('roce'):
            fills.append(('roce', kpi['roce']))
        if kpi.get('de') and missing('de'):
            fills.append(('de', kpi['de']))
        if entry.get('rev_growth') is not None and missing('growth'):
            fills.append(('growth', str(round(entry['rev_growth'])) + '%'))
        fyi = [i for i, p in enumerate(fin.get('periods') or []) if 'mar' in p.lower()]
        if fin.get('income') and fyi and fin['income'][fyi[0]] is not None and missing('rev'):
            fills.append(('rev', '\u20b9' + str(fin['income'][fyi[0]]) + ' Cr'))
        if fin.get('pat') and fyi and fin['pat'][fyi[0]] is not None and missing('pat'):
            fills.append(('pat', '\u20b9' + str(fin['pat'][fyi[0]]) + ' Cr'))
        if entry.get('promoter_pct') is not None and missing('prom'):
            fills.append(('prom', str(entry['promoter_pct']) + '%'))
        for fld, val in fills:
            x[fld] = val
        backfilled += len(fills)
    IPODATA.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding='utf-8')
    print('ipo-data.json: %d fundamental fields backfilled' % backfilled)

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    got = sum(1 for v in result['ipos'].values() if v.get('url'))
    print('ipo-details.json written: %d IPOs, %d with pages, %d without links' % (
        len(result['ipos']), got, len(misses)))


if __name__ == '__main__':
    main()
