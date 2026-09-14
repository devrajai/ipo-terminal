import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'ipo-data.json'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/2.0'
EMPTY = {'', None, '—', '-', 'NA', 'N/A'}
BASE = 'https://ipocentral.in/'

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_row=False; self.in_cell=False
    def handle_starttag(self, tag, attrs):
        tag=tag.lower()
        if tag=='tr': self.in_row=True; self.row=[]
        elif tag in ('td','th') and self.in_row: self.in_cell=True; self.cell=[]
    def handle_endtag(self, tag):
        tag=tag.lower()
        if tag in ('td','th') and self.in_cell:
            self.row.append(' '.join(self.cell).strip()); self.in_cell=False
        elif tag=='tr' and self.in_row:
            if self.row: self.rows.append(self.row)
            self.in_row=False
    def handle_data(self, data):
        if self.in_cell: self.cell.append(data)

def clean(v): return re.sub(r'\s+',' ',html.unescape(str(v or ''))).strip()
def norm(v):
    s=clean(v).lower()
    s=re.sub(r'\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b',' ',s)
    return re.sub(r'[^a-z0-9]+','',s)
def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9'})
    with urllib.request.urlopen(req,timeout=30) as r: return r.read().decode('utf-8','ignore')
def first(d,*keys):
    for k in keys:
        if d.get(k) not in EMPTY: return d[k]
    return None
def number(v):
    m=re.search(r'-?[0-9]+(?:\.[0-9]+)?',clean(v).replace(',',''))
    return m.group(0) if m else None
def slug(v): return re.sub(r'[^a-z0-9]+','-',clean(v).lower()).strip('-')
def page_candidates(name):
    s=slug(name)
    return [BASE+s+'-ipo-gmp-price-date-allotment/', BASE+s+'-ipo-gmp-price-date-details/', BASE+s+'-ipo-gmp-price-allotment/']
def parse_page(text):
    p=TableParser(); p.feed(text); return p.rows

def table_records(rows):
    out=[]
    for idx,h in enumerate(rows):
        headers=[clean(x).lower() for x in h]
        joined=' | '.join(headers)
        if idx+1>=len(rows): continue
        if not any(x in joined for x in ('roe','ronw','roce','ebitda','debt/equity','p/e','pe ratio')): continue
        for r in rows[idx+1:idx+12]:
            d={}
            for j,v in enumerate(r[:len(headers)]):
                key=re.sub(r'[^a-z0-9]+','_',headers[j]).strip('_')
                if key: d[key]=clean(v)
            if d: out.append(d)
    return out

def extract_metrics(rows):
    result={}
    for h in rows:
        headers=[clean(x).lower() for x in h]
        if not any(x in ' | '.join(headers) for x in ('roe','ronw','roce','ebitda','debt/equity','p/e','pe ratio')): continue
        for r in rows[rows.index(h)+1:rows.index(h)+8]:
            vals=[clean(x) for x in r]
            if not vals: continue
            text=' | '.join(vals).lower()
            if 'fy 2026' not in text and 'fy 2025' not in text and 'pre-issue' not in text: continue
            for j,head in enumerate(headers):
                if j>=len(vals): continue
                v=vals[j]
                if 'pe ratio' in head or head in ('pe','p/e'):
                    result.setdefault('pe',v)
                elif 'ronw' in head or head=='roe' or 'return on average equity' in head:
                    result.setdefault('roe',v); result.setdefault('ronw',v)
                elif 'roce' in head:
                    result.setdefault('roce',v)
                elif 'ebitda' in head:
                    result.setdefault('ebitda',v)
                elif 'debt/equity' in head or 'debt equity' in head:
                    result.setdefault('de',v)
    # More reliable row-label parsing for IPO Central's transposed valuation tables.
    for r in rows:
        if not r: continue
        label=clean(r[0]).lower()
        vals=[clean(x) for x in r[1:]]
        if not vals: continue
        if 'pe ratio' in label or label in ('pe','p/e'): result['pe']=vals[-1]
        elif 'ronw' in label: result['ronw']=vals[-1]; result['roe']=vals[-1]
        elif 'return on average equity' in label: result.setdefault('roe',vals[-1])
        elif 'roce' in label: result['roce']=vals[-1]
        elif 'ebitda' in label: result['ebitda']=vals[-1]
        elif 'debt/equity' in label or 'debt / equity' in label: result['de']=vals[-1]
        elif label=='revenue': result['rev']=vals[-1]
        elif label in ('net income','net profit','pat'): result['pat']=vals[-1]
    return result

def extract_financials(rows):
    out={}
    for r in rows:
        if not r: continue
        label=clean(r[0]).lower(); vals=[clean(x) for x in r[1:]]
        if not vals: continue
        latest=vals[-1]
        if label=='revenue': out['rev']=latest
        elif label in ('net income','net profit','pat','profit after tax'): out['pat']=latest
        elif label in ('margin (%)','net profit margin (%)'): out['pat_margin']=latest
    return out

def extract_docs(text):
    docs={}
    pat=re.compile(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',re.I|re.S)
    for href,title in pat.findall(text):
        title=clean(title); low=(title+' '+href).lower()
        if not any(x in low for x in ('rhp','drhp','prospectus','red herring')): continue
        if href.startswith('/'): href='https://ipocentral.in'+href
        if href.startswith('http'):
            if 'drhp' in low: docs.setdefault('drhp_url',href)
            elif 'rhp' in low or 'red herring' in low: docs.setdefault('rhp_url',href)
            elif 'prospectus' in low: docs.setdefault('prospectus_url',href)
    return docs

def extract_peers(rows):
    peers=[]
    for i,h in enumerate(rows):
        heads=[clean(x).lower() for x in h]
        joined=' | '.join(heads)
        if not any(x in joined for x in ('peer','company')) or not any(x in joined for x in ('pe','roe','roce')): continue
        for r in rows[i+1:i+15]:
            if len(r)<2: continue
            name=clean(r[0])
            if not name or len(name)>80: continue
            item={'name':name}
            for j,v in enumerate(r[1:],1):
                if j>=len(heads): break
                hh=heads[j]
                if 'pe' in hh: item['pe']=clean(v)
                elif 'roe' in hh or 'ronw' in hh: item['roe']=clean(v)
                elif 'roce' in hh: item['roce']=clean(v)
                elif 'ebitda' in hh: item['ebitda']=clean(v)
                elif 'debt' in hh: item['de']=clean(v)
            if len(item)>1: peers.append(item)
    return peers[:8]

def main():
    if not OUT.exists(): return
    payload=json.loads(OUT.read_text(encoding='utf-8')); ipos=payload.get('ipos',[])
    source=payload.setdefault('sources',{}).setdefault('ProspectusResearch',{'ok':False,'records':0,'matched':0,'errors':[]})
    source.update({'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'records':0,'matched':0,'errors':[]})
    matched=0
    for ipo in ipos:
        name=ipo.get('name')
        if not name: continue
        text=None; url=None
        for candidate in page_candidates(name):
            try:
                text=fetch(candidate); url=candidate
                if len(text)>5000: break
            except Exception: pass
        if not text: continue
        rows=parse_page(text)
        metrics={}; metrics.update(extract_financials(rows)); metrics.update(extract_metrics(rows))
        docs=extract_docs(text)
        peers=extract_peers(rows)
        for k,v in metrics.items():
            if v not in EMPTY: ipo[k]=v
        if docs: ipo.update(docs)
        ipo['fundamentals_source']='IPO Central / public prospectus-derived tables'
        ipo['fundamentals_source_url']=url
        ipo['fundamentals_updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
        if peers: ipo['comparable_stocks']=peers
        matched+=1
    source['records']=len(ipos); source['matched']=matched; source['ok']=matched>0
    payload['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Prospectus research: matched {matched}/{len(ipos)} IPO records')

if __name__=='__main__': main()
