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
                        ­•ä€ô€¹¥¤œ(€€€€€€€€€€€€€€€•±¥˜€Ñ½Ñ…°œ¥¸±…ˆè(€€€€€€€€€€€€€€€€€€€€€€€­•ä€ô€Ñ½Ñ…°œ(€€€€€€€€€€€€€€€€¥˜¹½Ð­•ä½È­•ä¥¸ÑÉ…¹Î‚ˆÛÛ[YBˆ˜[ÈHÛ[JÊH›ÜˆÈ[ˆ–ÌN—WBˆ˜[ÈHÝˆ›Üˆˆ[ˆ˜[ÈYˆˆ\È›Ý›Û™H[™ˆLBˆYˆ˜[Î‚ˆ˜[œÖÚÙ^WHH˜[ÖËLWBˆYˆ[ŠÙ]
˜[œÊH	ˆÉÜšZIË	ÛšZIË	ÜZX‰ßJHHŽ‚ˆ™\ÝHÊŠ˜[œË
Š˜™\ÝHYˆ™\Ý[ÙH˜[œÂˆ™]\›ˆ™\Ý‚‚™Yˆ^˜XÝØ[˜ÚÜŠ^
N‚ˆÝ]HßBˆÝÈH^›ÝÙ\Š
BˆHH
™KœÙX\˜Ú
‰Ø[˜ÚÜ–×‹—^ÌÌOÊ×—JŠWÊŠÎ˜Ü›Ü™_Ü—ŠIËÝÊBˆÜˆ™KœÙX\˜Ú
‰Ê×—JŠWÊŠÎ˜Ü›Ü™_Ü—ŠV×‹—^ÌÌOØ[˜ÚÜ‰ËÝÊJBˆYˆN‚ˆÝ]ÉÝÝ[ØÜ‰×HH[JK™Ü›Ý\
JJBˆHH™KœÙX\˜Ú
‰Ê×JŠWÊ˜[˜ÚÜ—Êš[™\ÝÜœÉËÝÊHÜˆˆ™KœÙX\˜Ú
‰Ø[˜ÚÜ–×‹—^ÌŒOÊ×JŠWÊš[™\ÝÜœÉËÝÊBˆYˆN‚ˆÝ]ÉÚ[™\ÝÜœÉ×HH[
[JK™Ü›Ý\
JJJBˆHH™KœÙX\˜Ú
‰Û]]X[Ê™[™ÏÖ×ŒNW^ÌJ×—JŠWÊŠÎ˜Ü›Ü™_Ü—ŠIËÝÊBˆYˆN‚ˆÝ]ÉÛY—ØÜ‰×HH[JK™Ü›Ý\
JJBˆHH™KœÙX\˜Ú
‰ÊÎ™šZ_›Ü™ZYÛŠV×ŒNW^ÌJ×—JŠWÊŠÎ˜Ü›Ü™_Ü—ŠIËÝÊBˆYˆN‚ˆÝ]ÉÙšZWØÜ‰×HH[JK™Ü›Ý\
JJBˆ™]\›ˆÝ]‚‚™Yˆ^˜XÝÙš[˜[˜ÚX[Ê›ÝÜÊN‚ˆˆˆœ™\Ý]YÛÛœÛÛY]Yš[˜[˜ÚX[ÈX›Nˆ	Ô\š[Ù[™Y	ÈXY\ˆ
ÈY]šXÈ›ÝÜËˆˆˆ‚ˆ›ÜˆK[ˆ[[Y\˜]J›ÝÜÊN‚ˆYˆ›ÝÜˆ	Ü\š[Ù[™Y	È›Ý[ˆÛX[ŠÌJK›ÝÙ\Š
HÜˆ[Š
HÎ‚ˆÛÛ[YBˆ\š[ÙÈHØÛX[Š
H›Üˆ[ˆÌN—WBˆX™[ÈHÉØ\ÜÙ]ÉÎˆ	Ø\ÜÙ]ÉË	ÝÝ[[˜ÛÛYIÎˆ	Ú[˜ÛÛYIË	Ü™]™[YIÎˆ	Ú[˜ÛÛYIËˆ	Ü›Ùš]Y\ˆ^	Îˆ	Ü]	Ë	ÝÝ[›Üœ›ÝÚ[™ÉÎˆ	Ø›Üœ›ÝÚ[™ÉËˆ	Û™]ÛÜ	Îˆ	Û™]ÛÜ	Ë	ÙXš]IÎˆ	ÙXš]IßBˆÝ]HÉÜ\š[ÙÉÎˆ\š[ÙßBˆ›Üˆˆ[ˆ›ÝÜÖÚH
ÈNšH
ÈL—N‚ˆYˆ›ÝˆÜˆ›Ý–ÌN‚ˆÛÛ[YBˆXˆH™KœÝXŠ‰Ö×˜K^ˆIË	ÉËÛX[Š–ÌJK›ÝÙ\Š
JKœÝš\

BˆXˆH™KœÝXŠ‰×ÊÉË	È	ËXŠBˆÈH›Û™BˆYˆ	Ü›Ùš]	È[ˆXˆ[™	Ý^	È[ˆXŽ‚ˆÈH	Ü]	Âˆ[YˆXˆ[ˆX™[Î‚ˆÈHX™[ÖÛX—BˆYˆÎ‚ˆ˜[ÈHÛ[JÊH›ÜˆÈ[ˆ–ÌN›[Š
WWBˆÚ[H[Š˜[ÊH[Š\š[ÙÊN‚ˆ˜[Ë˜\[™
›Û™JBˆÝ]Ú×HH˜[ÂˆYˆ	Ú[˜ÛÛYIÈ[ˆÝ][™	Ü]	È[ˆÝ]‚ˆ™]\›ˆÝ]ˆ™]\›ˆ›Û™B‚‚™YˆžWÙÜ›ÝÝ
š[ŠN‚ˆˆˆ–[ÖHÜ›ÝÝ
Ý
H›Üˆ[˜ÛÛYH[™U\Ú[™ÈHÛÈ[ÜÝ™XÙ[•Sˆš[˜[˜ÚX[YX\œÈ
\š[ÙÈÛÛZ[š[™È	ÓX\‰ÊKˆˆˆ‚ˆÝ]HßBˆYHÚH›ÜˆK[ˆ[[Y\˜]Jš[–ÉÜ\š[ÙÉ×JHYˆ	ÛX\‰È[ˆ›ÝÙ\Š
WBˆYˆ[ŠY
HŽ‚ˆ™]\›ˆÝ]ˆKˆHYÌKYÌWBˆ›ÜˆÙ^K˜[YH[ˆ

	Ú[˜ÛÛYIË	Ü™]—ÙÜ›ÝÝ	ÊK
	Ü]	Ë	Ü]ÙÜ›ÝÝ	ÊJN‚ˆˆHš[‹™Ù]
Ù^JBˆYˆˆ[™–ØWH\È›Ý›Û™H[™–Ø—H›Ý[ˆ
›Û™K
H[™–Ø—Hˆ‚ˆÝ]Û˜[YWHH›Ý[™

–ØWHH–Ø—JHÈ–Ø—H
ˆLJBˆ™]\›ˆÝ]‚‚™Yˆ^˜XÝÚÜJ›ÝÜÊN‚ˆˆˆ’ÔHX›H›ÝÜÎˆ“ÑHÈ“ÐÑHÈXQ\]Z]HÈUX\™Ú[ˆÈP’UHX\™Ú[ˆÈU‹ˆˆˆ‚ˆÛX\HÉÜ›ÙIÎˆ	Ü›ÙIË	Ü›ØÙIÎˆ	Ü›ØÙIË	ÙXÙ\]Z]IÎˆ	ÙIË	ÙX\]Z]IÎˆ	ÙIËˆ	ÙXÈ\]Z]IÎˆ	ÙIË	Ü]X\™Ú[‰Îˆ	Ü]ÛX\™Ú[‰Ëˆ	ÙXš]HX\™Ú[‰Îˆ	ÙXš]WÛX\™Ú[‰Ë	Û™]›Ùš]X\™Ú[‰Îˆ	Ü]ÛX\™Ú[‰Ëˆ	Û˜]‰Îˆ	Û˜]‰ßBˆÝ]HßBˆ›Üˆˆ[ˆ›ÝÜÎ‚ˆYˆ[ŠŠHˆÜˆ›Ý–ÌN‚ˆÛÛ[YBˆXˆH™KœÝXŠ‰Ö×˜K^‹ÈIË	ÉËÛX[Š–ÌJK›ÝÙ\Š
JKœÝš\

BˆXˆH™KœÝXŠ‰×ÊÉË	È	ËXŠBˆYˆXˆ[ˆÛX\[™ÛX\ÛX—H›Ý[ˆÝ]‚ˆˆHÛX[Š–ÌWJBˆYˆ[JŠH\È›Ý›Û™H[™ˆ›Ý[ˆSTN‚ˆÝ]ÚÛX\ÛX—WHH‚ˆ™]\›ˆÝ]Yˆ[ŠÝ]
HHˆ[ÙH›Û™B‚‚™Yˆ^˜XÝÜ›Û[Ý\Š›ÝÜÊN‚ˆˆˆœ™KRTÈ›Û[Ý\ˆÛ[™ÈÝœ›ÛHHÚ\™ZÛ[™ÈX›Kˆˆˆ‚ˆ›Üˆˆ[ˆ›ÝÜÎ‚ˆYˆ[ŠŠHHˆ[™–ÌH[™	Ü›Û[Ý\‰È[ˆÛX[Š–ÌJK›ÝÙ\Š
N‚ˆˆH[J–ÌWJBˆYˆˆ\È›Ý›Û™H[™ˆHL‚ˆ™]\›ˆ›Ý[™
‹ŠBˆ™]\›ˆ›Û™B‚‚™Yˆ^˜XÝÜY\œÊ›ÝÜÊN‚ˆY\œÈH×Bˆ›ÜˆK[ˆ[[Y\˜]J›ÝÜÊN‚ˆXYÈHÞ›ÝÙ\Š
H›Üˆ[ˆBˆ›Ú[™YH	È	Ëš›Ú[ŠXYÊBˆYˆ	ÜY\‰È›Ý[ˆ›Ú[™Y[™	ØÛÛ\[žIÈ›Ý[ˆ›Ú[™Y‚ˆÛÛ[YBˆYˆ	ÜIÈ›Ý[ˆ›Ú[™Y[™	Ü›ÙIÈ›Ý[ˆ›Ú[™Y‚ˆÛÛ[YBˆ›Üˆˆ[ˆ›ÝÜÖÚH
ÈNšH
ÈL—N‚ˆYˆ[ŠŠHŽ‚ˆÛÛ[YBˆ˜[ÈH\Ý
ŠBˆYˆ˜[È[™™K™[X]Ú
‰Ö×‹	WJÉË˜[ÖÌHÜˆ	ÉÊH[™[Š˜[ÊHHŽ‚ˆ˜[ÈH˜[ÖÌN—Bˆ˜[YHH˜[ÖÌHYˆ˜[È[ÙH	ÉÂˆYˆ
›Ý˜[YHÜˆ[Š˜[YJHˆŒÜˆ[Š˜[YJHÂˆÜˆ˜[YK›ÝÙ\Š
H[ˆ
	ÜY\‰Ë	ØÛÛ\[žIË	ÜY\œÉË	ÝÝ[	ÊJN‚ˆÛÛ[YBˆ][HHÉÛ˜[YIÎˆ˜[Y_BˆHXYÖÌN—HYˆ[ŠŠHOH[Š˜[ÊH
ÈH[ÙHXYÂˆ›Üˆ‹ˆ[ˆ[[Y\˜]J˜[ÖÌN—KJN‚ˆYˆˆH[Š
N‚ˆœ™XZÂˆˆH™KœÝXŠ‰Ö×˜K^‹×IË	ÉËÚ—JKœÝš\

BˆYˆˆ[ˆ
	ÜIË	ÜÙIË	Ü\˜][ÉË	ÜÙ^	ÊH[™	ÜIÈ›Ý[ˆ][N‚ˆ][VÉÜI×HHÛX[ŠŠBˆ[Yˆˆ[ˆ
	Ü›ÙIË	Ü›ÛÉÊH[™	Ü›ÙIÈ›Ý[ˆ][N‚ˆ][VÉÜ›ÙI×HHÛX[ŠŠBˆYˆ[Š][JHˆN‚ˆY\œË˜\[™
][JBˆ™]\›ˆY\œÖÎ—B‚‚™YˆÛÛXÝÛ[šÜÊ^˜\ÙWÙÛXZ[ŠN‚ˆˆˆ˜[Oˆ[šÜÈÚÜÙH™YˆY[[ÛœÈ\ÎÈ™]\›œÈÛ›Ü›]^ˆ\›Hˆˆ‚ˆÝ]HßBˆ›Üˆ™Y‹]H[ˆ™K™š[™[
‰ÏV×—JÚ™YHŠ×ˆ—JÊH–×—JŠŠÊOØO‰Ë^™K’H™K”ÊN‚ˆH™Y‹œÝš\

BˆYˆ	Ú\ÉÈ›Ý[ˆ›ÝÙ\Š
N‚ˆÛÛ[YBˆYˆœÝ\ÝÚ]
	ËËÉÊN‚ˆH	ÚÎ‰È
Èˆ[YˆœÝ\ÝÚ]
	ËÉÊN‚ˆH˜\ÙWÙÛXZ[ˆ
ÈˆYˆ›ÝœÝ\ÝÚ]
	Ú	ÊN‚ˆÛÛ[YBˆHÛX[Š]JBˆYˆ›Ý‚ˆÛÛ[YBˆÈH›Ü›J
BˆYˆÈ[™È›Ý[ˆÝ]‚ˆÝ]Ú×HHˆÈ[ÛÈ[™^žHT“ÛYÎˆÚ\ËÞÜÛYßKZ\ËÞÚYKÈÛÈH[ÛÛ\[žH˜[YBˆ\ÈHÜ›Üˆ[ˆœÜ]
	ËÉÊHYˆBˆ›Üˆ[ˆ\Î‚ˆYˆ	Ú\ÉÈ›Ý[ˆ›ÝÙ\Š
H[™[Š›Ü›J
JHˆ‚ˆÜH›Ü›J
BˆÝ]œÙ]Y˜][
Ü
Bˆ™]\›ˆÝ]‚‚™YˆÙX\˜ÚÛ[šÊ˜[YJN‚ˆˆˆ”ÙX\˜Ú[™Ú[™\ÈOˆÚ]Ü™Ø\šTÈYÙHT“›ÜˆHÛÛ\[žH˜[YKˆˆˆ‚ˆ[\Ü\›X‹œ\œÙBˆHH\›X‹œ\œÙKœ][ÝJ˜[YH
È	ÈÚ]N˜Ú]Ü™Ø\š˜ÛÛIÊBˆ›Üˆ[™Ú[™H[ˆ
ˆ	ÚÎ‹ËÚ[™XÚÙXÚÙÛË˜ÛÛKÚ[ÏÜOIËˆ	ÚÎ‹ËÛ]K™XÚÙXÚÙÛË˜ÛÛKÛ]KÏÜOIËˆ	ÚÎ‹ËÝÝÝË˜š[™Ë˜ÛÛKÜÙX\˜ÚÜOIÊN‚ˆ›ÜˆÈ[ˆ˜[™ÙJŠN‚ˆžN‚ˆ^H™]Ú
[™Ú[™H
ÈK[Y[Ý]LŒ
BˆÈ\™XÝ[šÜÂˆHH™KœÙX\˜Ú
‰ÚÎ‹ËÝÝÝ×˜Ú]Ü™Ø\š˜ÛÛKÚ\ËÖØK^ŒNWWJË×
ÉË^
BˆYˆN‚ˆ™]\›ˆK™Ü›Ý\

BˆÈÈ™Y\™XÝ\˜[\Âˆ›Üˆ[H[ˆ™K™š[™]\Š‰ÝYÏJ×‰ˆ—	×JÊIË^
N‚ˆHH\›X‹œ\œÙK[œ][ÝJ[K™Ü›Ý\
JJBˆYˆ™KœÙX\˜Ú
‰ØÚ]Ü™Ø\š˜ÛÛKÚ\ËÖØK^ŒNWWJË×
ÉËJN‚ˆ™]\›ˆBˆ^Ù\^Ù\[ÛŽ‚ˆ\ÜÂˆ™]\›ˆ›Û™B‚‚™YˆXZ[Š
N‚ˆ^[ØYHœÛÛ‹›ØYÊTÑUKœ™XYÝ^
[˜ÛÙ[™ÏIÝ]‹N	ÊJBˆ[Ú\ÜÈH^[ØY™Ù]
	Ú\ÜÉË×JBˆÙ^HH™]KÙ^J
BˆÜ[—Ú\ÜÈHÞ›Üˆ[ˆ[Ú\ÜÈYˆ™Ù]
	Û˜[YIÊH[™\×ÛÜ[ŠÙ^JWBˆš[
	ÛÜ[ˆTÜÎ‰Ë[ŠÜ[—Ú\ÜÊJB‚ˆ[šÜÈHßBˆ›ÜˆÛ˜[YKÛH[ˆÓÕTÑTÎ‚ˆžN‚ˆYÙHH™]Ú

BˆÛÝHÛÛXÝÛ[šÜÊYÙKÛJBˆš[
	É\Îˆ	Y\È[šÜÉÈ	H
Û˜[YK[ŠÛÝ
JJBˆ[šÜË\]JÛÝ
Bˆ^Ù\^Ù\[Ûˆ\ÈN‚ˆš[
	ÜÛÝ\˜ÙH˜Z[Y‰ËÛ˜[YKJBˆš[
	ÝÝ[\Ý[™È[šÜÈ›Ý[™‰Ë[Š[šÜÊJB‚ˆ™\Ý[HÉÝ\]YØ]	Îˆ™]][YK››ÝÊ[Y^›Û™K]ÊKš\ÛÙ›Ü›X]

K	Ú\ÜÉÎˆß_BˆZ\ÜÙ\ÈH×Bˆ›Üˆ\È[ˆÜ[—Ú\ÜÎ‚ˆ˜[YHH\ÖÉÛ˜[YI×BˆÙ^HH›Ü›J˜[YJBˆ\›H›Û™Bˆ™\ÝH›Û™Bˆ›ÜˆËH[ˆ[šÜËš][\Ê
N‚ˆYˆÈOHÙ^N‚ˆ\›HBˆœ™XZÂˆYˆ[ŠÊHˆˆ[™
È[ˆÙ^HÜˆÙ^H[ˆÊN‚ˆYˆ™\Ý\È›Û™HÜˆ[ŠÊHˆ[Š™\ÝÌJN‚ˆ™\ÝH
ËJBˆYˆ›Ý\›[™™\Ý‚ˆ\›H™\ÝÌWBˆYˆ›Ý\›‚ˆ\›HÙX\˜ÚÛ[šÊ˜[YJBˆYˆ\›‚ˆš[
	ÜÙX\˜Ú›Ý[™‰Ë˜[YK	ËO‰Ë\›
BˆYˆ›Ý\›‚ˆZ\ÜÙ\Ë˜\[™
˜[YJBˆš[
	Ó“ÈS’È›ÜŽ‰Ë˜[YJBˆ™\Ý[ÉÚ\ÜÉ×VÛ˜[YWHHßBˆÛÛ[YBˆ[žHHßBˆ[žVÉÝ\›	×HH\›ˆžN‚ˆYÙHH™]Ú
\›
Bˆ\œÙ\ˆHX›T\œÙ\Š
Bˆ\œÙ\‹™™YY
YÙJBˆ›ÝÜÈH\œÙ\‹œ›ÝÜÂˆÙXÈH^˜XÝÜÙXÝÜŠ›ÝÜÊBˆYˆÙXÎ‚ˆ[žVÉÜÙXÝÜ‰×HHÙXÂˆÝXœÈH^˜XÝÜÝXœÊ›ÝÜË\œÙ\‹YÊBˆYˆÝXœÎ‚ˆ[žVÉÜÝXœÉ×HHÝXœÂˆ[˜ÈH^˜XÝØ[˜ÚÜŠYÙJBˆYˆ[˜Î‚ˆ[žVÉØ[˜ÚÜ‰×HH[˜ÂˆY\œÈH^˜XÝÜY\œÊ›ÝÜÊBˆYˆY\œÎ‚ˆ[žVÉÜY\œÉ×HHY\œÂˆš[ˆH^˜XÝÙš[˜[˜ÚX[Ê›ÝÜÊBˆYˆš[Ž‚ˆ[žVÉÙš[‰×HHš[‚ˆ›ÜˆÚËÝˆ[ˆžWÙÜ›ÝÝ
š[ŠKš][\Ê
N‚ˆ[žVÙÚ×HHÝ‚ˆÜHH^˜XÝÚÜJ›ÝÜÊBˆYˆÜN‚ˆ[žVÉÚÜI×HHÜBˆ›ÛHH^˜XÝÜ›Û[Ý\Š›ÝÜÊBˆYˆ›ÛH\È›Ý›Û™N‚ˆ[žVÉÜ›Û[Ý\—ÜÝ	×HH›ÛBˆš[
	Ù™]ÚY	KMœÈÙXÝÜIKLÜÈÝXœÏIKLÜÈ[˜ÚÜIKLÜÈY\œÏIYš[I\ÈÜOI\È›ÛOI\ÉÈ	H
ˆ˜[YVÎ—K›ÛÛ
[žK™Ù]
	ÜÙXÝÜ‰ÊJK›ÛÛ
[žK™Ù]
	ÜÝXœÉÊJKˆ›ÛÛ
[žK™Ù]
	Ø[˜ÚÜ‰ÊJK[Š[žK™Ù]
	ÜY\œÉÊHÜˆ×JKˆ	Ùš[‰È[ˆ[žK	ÚÜIÈ[ˆ[žK	Ü›Û[Ý\—ÜÝ	È[ˆ[žJJBˆ^Ù\^Ù\[Ûˆ\ÈN‚ˆš[
	ÜYÙH˜Z[Y‰Ë˜[YKJBˆ™\Ý[ÉÚ\ÜÉ×VÛ˜[YWHH[žB‚ˆÈ˜XÚÙš[™X[[™[Y[[È[È\ËY]KšœÛÛˆ
Z\ÜÚ[™ÈšY[ÈÛ›JBˆž[˜[YHHÞ™Ù]
	Û˜[YIÊNˆ›Üˆ[ˆ[Ú\ÜÈYˆ™Ù]
	Û˜[YIÊ_B‚ˆYˆZ\ÜÚ[™ÊšY[
N‚ˆÝ\ˆHÝŠ™Ù]
šY[
HÜˆ	ÉÊKœÝš\

Bˆ™]\›ˆÝ\ˆ[ˆ
	ÉË	ËIË	×LŒM	Ë	Ó›Û™IË	ÓIË	Ó‹ÐIÊHÜˆÝ\‹›ÝÙ\Š
H[ˆ
	Ý˜IË
B‚ˆ˜XÚÙš[YHˆ›Üˆ˜[YK[žH[ˆ™\Ý[ÉÚ\ÜÉ×Kš][\Ê
N‚ˆHž[˜[YK™Ù]
˜[YJBˆYˆ›Ý‚ˆÛÛ[YBˆÜHH[žK™Ù]
	ÚÜIÊHÜˆßBˆš[ˆH[žK™Ù]
	Ùš[‰ÊHÜˆßBˆš[ÈH×BˆYˆÜK™Ù]
	Ü›ÙIÊH[™Z\ÜÚ[™Ê	Ü›ÙIÊN‚ˆš[Ë˜\[™

	Ü›ÙIËÜVÉÜ›ÙI×JJBˆYˆÜK™Ù]
	Ü›ØÙIÊH[™Z\ÜÚ[™Ê	Ü›ØÙIÊN‚ˆš[Ë˜\[™

	Ü›ØÙIËÜVÉÜ›ØÙI×JJBˆYˆÜK™Ù]
	ÙIÊH[™Z\ÜÚ[™Ê	ÙIÊN‚ˆš[Ë˜\[™

	ÙIËÜVÉÙI×JJBˆYˆ[žK™Ù]
	Ü™]—ÙÜ›ÝÝ	ÊH\È›Ý›Û™H[™Z\ÜÚ[™Ê	ÙÜ›ÝÝ	ÊN‚ˆš[Ë˜\[™

	ÙÜ›ÝÝ	ËÝŠ›Ý[™
[žVÉÜ™]—ÙÜ›ÝÝ	×JJH
È	ÉIÊJBˆžZHHÚH›ÜˆK[ˆ[[Y\˜]Jš[‹™Ù]
	Ü\š[ÙÉÊHÜˆ×JHYˆ	ÛX\‰È[ˆ›ÝÙ\Š
WBˆYˆš[‹™Ù]
	Ú[˜ÛÛYIÊH[™žZH[™š[–ÉÚ[˜ÛÛYI×VÙžZVÌWH\È›Ý›Û™H[™Z\ÜÚ[™Ê	Ü™]‰ÊN‚ˆš[Ë˜\[™

	Ü™]‰Ë	×LŒŽIÈ
ÈÝŠš[–ÉÚ[˜ÛÛYI×VÙžZVÌWJH
È	ÈÜ‰ÊJBˆYˆš[‹™Ù]
	Ü]	ÊH[™žZH[™š[–ÉÜ]	×VÙžZVÌWH\È›Ý›Û™H[™Z\ÜÚ[™Ê	Ü]	ÊN‚ˆš[Ë˜\[™

	Ü]	Ë	×LŒŽIÈ
ÈÝŠš[–ÉÜ]	×VÙžZVÌWJH
È	ÈÜ‰ÊJBˆYˆ[žK™Ù]
	Ü›Û[Ý\—ÜÝ	ÊH\È›Ý›Û™H[™Z\ÜÚ[™Ê	Ü›ÛIÊN‚ˆš[Ë˜\[™

	Ü›ÛIËÝŠ[žVÉÜ›Û[Ý\—ÜÝ	×JH
È	ÉIÊJBˆ›Üˆ›˜[[ˆš[Î‚ˆÙ›HH˜[ˆ˜XÚÙš[Y
ÏH[Šš[ÊBˆTÑUKÜš]WÝ^
œÛÛ‹™[\Ê^[ØY[œÝ\™WØ\ØÚZOQ˜[ÙK[™[LJK[˜ÛÙ[™ÏIÝ]‹N	ÊBˆš[
	Ú\ËY]KšœÛÛŽˆ	Y[™[Y[[šY[È˜XÚÙš[Y	È	H˜XÚÙš[Y
B‚ˆÕUÜš]WÝ^
œÛÛ‹™[\Ê™\Ý[[œÝ\™WØ\ØÚZOQ˜[ÙK[™[LJK[˜ÛÙ[™ÏIÝ]‹N	ÊBˆÛÝHÝ[JH›Üˆˆ[ˆ™\Ý[ÉÚ\ÜÉ×K˜[Y\Ê
HYˆ‹™Ù]
	Ý\›	ÊJBˆš[
	Ú\ËY]Z[ËšœÛÛˆÜš][Žˆ	YTÜË	YÚ]YÙ\Ë	YÚ]Ý][šÜÉÈ	H
ˆ[Š™\Ý[ÉÚ\ÜÉ×JKÛÝ[ŠZ\ÜÙ\ÊJJB‚‚šYˆ×Û˜[YW×ÈOH	××ÛXZ[—×ÉÎ‚ˆXZ[Š
B