import datetime as dt
import html
import json
import re
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'ipo-data.json'
UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/1.4'
SOURCES = {
    'Groww': 'https://groww.in/ipo/subscription',
    'Mint': 'https://www.livemint.com/market/ipo/subscription-status',
    'EconomicTimes': 'https://economictimes.indiatimes.com/markets/ipo/upcoming',
    'EconomicTimesListed': 'https://economictimes.indiatimes.com/markets/ipo/recently-listed',
}
EMPTY = {'—', '-', '', None, 'NA', 'N/A'}

class TableParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.rows=[]; self.row=[]; self.cell=[]; self.in_cell=False; self.in_row=False
    def handle_starttag(self, tag, attrs):
        if tag.lower() == 'tr': self.in_row=True; self.row=[]
        elif tag.lower() in ('td','th') and self.in_row: self.in_cell=True; self.cell=[]
    def handle_endtag(self, tag):
        if tag.lower() in ('td','th') and self.in_cell:
            self.row.append(' '.join(self.cell).strip()); self.in_cell=False
        elif tag.lower() == 'tr' and self.in_row:
            if self.row: self.rows.append(self.row)
            self.in_row=False
    def handle_data(self, data):
        if self.in_cell: self.cell.append(data)

def clean(v):
    return re.sub(r'\s+', ' ', html.unescape(str(v or ''))).strip()

def norm(v):
    s=clean(v).lower()
    s=re.sub(r'\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b',' ',s)
    return re.sub(r'[^a-z0-9]+','',s)

def fetch(url):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml','Accept-Language':'en-US,en;q=0.9'})
    with urllib.request.urlopen(req,timeout=30) as r: return r.read().decode('utf-8','ignore')

def parse_tables(text):
    p=TableParser(); p.feed(text); return p.rows

def rows_to_dicts(rows):
    out=[]
    for i,h in enumerate(rows):
        headers=[norm(x) for x in h]
        if not any(x in headers for x in ('companyname','company','name')) or len(headers)<3: continue
        for r in rows[i+1:i+200]:
            if len(r)<2: continue
            d={}
            for j,v in enumerate(r[:len(headers)]):
                if headers[j]: d[headers[j]]=clean(v)
            name=d.get('companyname') or d.get('company') or d.get('name')
            if name and norm(name) not in ('companyname','company','name'): out.append(d)
    return out

def first(d,*keys):
    for k in keys:
        v=d.get(k)
        if v not in EMPTY: return v
    return None

def display_date(v):
    if v in EMPTY: return None
    s=clean(v)
    for fmt in ('%d %b %Y','%d %B %Y','%d-%b-%Y','%d/%m/%Y','%Y-%m-%d'):
        try: return dt.datetime.strptime(s,fmt).strftime('%d/%m/%y')
        except ValueError: pass
    return s

def merge_by_name(ipos, records):
    idx={norm(i.get('name')):i for i in ipos if i.get('name')}
    matched=0
    for r in records:
        name=first(r,'companyname','company','name')
        if not name: continue
        key=norm(name); target=idx.get(key)
        if not target: target=next((i for k,i in idx.items() if key and k and (key in k or k in key)),None)
        if not target: continue
        fields={
            'sub_qib':first(r,'qib','qibx'),
            'sub_nii':first(r,'nii','niix','niihni'),
            'sub_retail':first(r,'retail','ri','riix'),
            'sub_employee':first(r,'employee','er','employeex'),
            'sub':first(r,'total','totalsubscription','subscription','overallsubscription'),
            'size':first(r,'issuesize','issuesizecr'),
            'lot':first(r,'lotsize','lot'),
            'min_investment':first(r,'mininvestment','minimuminvestment'),
            'listing':display_date(first(r,'listingdate','listing')),
            'close':display_date(first(r,'closedate','closed')),
            'price':first(r,'issueprice','priceband','price'),
            'listing_price':first(r,'listingprice'),
            'ltp':first(r,'ltp','currentprice'),
            'listing_gain':first(r,'listingdayperformance','listinggain'),
            'current_gain':first(r,'gainasoftoday','gainasof'),
        }
        changed=False
        for k,v in fields.items():
            if v not in EMPTY: target[k]=v; changed=True
        if changed: matched+=1
    return matched

def add_missing_upcoming(ipos, records):
    existing={norm(i.get('name')) for i in ipos if i.get('name')}
    added=0
    for r in records:
        name=first(r,'companyname','company','name')
        if not name: continue
        key=norm(name)
        if key in existing: continue
        price=first(r,'issueprice','priceband','price')
        open_date=display_date(first(r,'opendate','open'))
        close=display_date(first(r,'closedate','close'))
        board='SME' if 'sme' in ' '.join(r.values()).lower() else 'Mainboard'
        item={'id':re.sub(r'[^a-z0-9]+','-',name.lower()).strip('-'),'name':name,'type':board,'price':price or '—','lot':first(r,'lotsize','lot') or '—','size':first(r,'issuesize','issuesizecr') or '—','open':open_date or '—','close':close or '—','listing':display_date(first(r,'listingdate','listing')) or '—','sub':'—','gmp':'—','gmp_pct':'—','est_list':'—','sector':'—','fresh':'—','ofs':'—','pe':'—','roe':'—','roce':'—','rev':'—','pat':'—','ebitda':'—','de':'—','growth':'—','prom':'—','status':'upcoming','exchange':'NSE/BSE','symbol':'','source':'Economic Times','source_url':SOURCES['EconomicTimes']}
        ipos.append(item); existing.add(key); added+=1
    return added

def main():
    if not OUT.exists(): return
    payload=json.loads(OUT.read_text(encoding='utf-8')); ipos=payload.get('ipos',[])
    health=payload.setdefault('sources',{}).setdefault('PublicAggregators',{})
    health.update({'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'sources':[]})
    totals={}
    for label,url in SOURCES.items():
        try:
            rows=parse_tables(fetch(url)); recs=rows_to_dicts(rows)
            matched=merge_by_name(ipos,recs)
            added=add_missing_upcoming(ipos,recs) if label=='EconomicTimes' else 0
            totals[label]={'ok':bool(recs),'records':len(recs),'matched':matched,'added':added,'url':url}
        except Exception as e:
            totals[label]={'ok':False,'records':0,'matched':0,'added':0,'url':url,'error':str(e)[:220]}
    payload['ipos']=ipos
    health['sources']=totals
    health['ok']=any(v.get('ok') for v in totals.values())
    payload['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print(json.dumps(totals,indent=2))

if __name__=='__main__': main()
