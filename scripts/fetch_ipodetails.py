#!/usr/bin/env python3
"""Fetch per-IPO detail pages and build data/ipo-details.json.

For every OPEN IPO: locate its IPO page via listing/GMP sources, fetch it,
and extract:
  - sector
  - live subscription by category (RII / NII / QIB / Total, in x times)
  - anchor book summary (total raised, mutual-fund / FII portion, investor count)
  - peer comparison table (name + P/E)
  - the working page URL (shown to users as the source link)

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

    def handle_starttag(self, tag, attrs):
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
        return d1 - dt.timedelta(days=3) <= today <= d2 + dt.timedelta(days=1)
    return str(ipo.get('status') or '').lower() in ('open', 'live')


def extract_sector(rows):
    for r in rows:
        if len(r) >= 2 and 'sector' in r[0].lower():
            v = r[1]
            if v not in EMPTY:
                return v
    return None


def extract_subs(rows):
    """subscription table: headers containing rii + qib; take last data row."""
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
                if rec:
                    best = rec
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
            name = r[0]
            if not name or len(name) > 60 or name.lower() in ('peer', 'company', 'peers'):
                continue
            item = {'name': name}
            for j, v in enumerate(r[1:], 1):
                if j >= len(heads):
                    break
                hj = re.sub(r'[^a-z/]', '', heads[j]).strip()
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
            for k in list(got.keys())[:15]:
                print('   sample:', k[:50], '->', got[k][:80])
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
            misses.append(name)
            print('NO LINK for:', name)
            continue
        entry = {}
        if url:
            entry['url'] = url
            try:
                page = fetch(url)
                parser = TableParser()
                parser.feed(page)
                rows = parser.rows
                sec = extract_sector(rows)
                if sec:
                    entry['sector'] = sec
                subs = extract_subs(rows)
                if subs:
                    entry['subs'] = subs
                anc = extract_anchor(page)
                if anc:
                    entry['anchor'] = anc
                peers = extract_peers(rows)
                if peers:
                    entry['peers'] = peers
                print('fetched %-45s sector=%s subs=%s anchor=%s peers=%d' % (
                    name[:45], entry.get('sector'), bool(entry.get('subs')),
                    bool(entry.get('anchor')), len(entry.get('peers') or [])))
            except Exception as e:
                print('page failed:', name, e)
        result['ipos'][name] = entry

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1), encoding='utf-8')
    got = sum(1 for v in result['ipos'].values() if v.get('url'))
    print('ipo-details.json written: %d IPOs, %d with pages, %d without links' % (
        len(result['ipos']), got, len(misses)))


if __name__ == '__main__':
    main()
