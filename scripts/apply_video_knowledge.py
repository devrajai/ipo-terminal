import datetime as dt
import json
import re
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'ipo-data.json'
KNOW=ROOT/'data'/'video-knowledge-001.json'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/1.0'
PAGES={
 'veegalanddevelopers':('Veegaland Developers','https://ipocentral.in/veegaland-developers-ipo-gmp-price-allotment/'),
 'manikaplastech':('Manika Plastech','https://ipocentral.in/manika-plastech-ipo-gmp-price-date-allotment/'),
}
FIELDS=('sector','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom','size','lot','pb','eps','assets','borrowings','retail','min_investment','allotment','refund','shares','listing','use_of_proceeds')

def norm(v):
 s=re.sub(r'\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b',' ',str(v or '').lower())
 return re.sub(r'[^a-z0-9]+','',s)

def good(v): return v not in (None,'','—','-','TBA')

def fetch(url):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,*/*;q=0.8'})
 with urllib.request.urlopen(req,timeout=25) as r:return r.read().decode('utf-8','ignore')

def clean(s): return re.sub(r'<[^>]+>',' ',s or '').replace('&nbsp;',' ')

def gmp_from_page(html):
 text=' '.join(clean(html).split())
 pats=[r'(?:GMP Today|Current GMP|Latest GMP)[^₹0-9-]{0,100}₹?\+?([0-9]+(?:\.[0-9]+)?)',r'(?:13 Sep 2026|12 Sep 2026|11 Sep 2026)[^₹0-9-]{0,80}₹?\+?([0-9]+(?:\.[0-9]+)?)']
 for p in pats:
  m=re.search(p,text,re.I)
  if m:return float(m.group(1))
 return None

def apply_gmp(i,g):
 m=re.search(r'(\d+(?:\.\d+)?)\s*(?:-|–|—)\s*(\d+(?:\.\d+)?)',str(i.get('price','')))
 hi=float(m.group(2)) if m else None
 # Reject obviously malformed scraper matches. A GMP above 2x the upper issue price
 # is treated as unverified instead of being displayed as a false multi-thousand-percent premium.
 if hi is None or float(g) > hi*2 or float(g) < -hi:
  return False
 i['gmp']=f'₹{int(g) if float(g).is_integer() else g}'
 i['gmp_source']='IPO Central'
 i['gmp_source_url']=PAGES[norm(i['name'])][1]
 i['gmp_updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
 i['gmp_pct']=f'{g/hi*100:+.1f}%'
 i['est_list']=f'₹{int(hi+g) if float(hi+g).is_integer() else round(hi+g,2)}'
 return True

def main():
 if not OUT.exists() or not KNOW.exists(): return
 data=json.loads(OUT.read_text(encoding='utf-8')); knowledge=json.loads(KNOW.read_text(encoding='utf-8'))
 ipos=data.get('ipos',[]); overrides=knowledge.get('ipo_overrides',[]); om={norm(x.get('name')):x for x in overrides}
 for x in overrides:
  for a in x.get('aliases',[]):om[norm(a)]=x
 changed=0; live=0; rejected=0
 for i in ipos:
  x=om.get(norm(i.get('name')))
  if x:
   for f in FIELDS:
    if not good(i.get(f)) and good(x.get(f)):i[f]=x[f];changed+=1
   i['knowledge_source']='user-provided video transcript'
  key=norm(i.get('name'))
  if key in PAGES:
   try:
    g=gmp_from_page(fetch(PAGES[key][1]))
    if g is not None:
     if apply_gmp(i,g): live+=1
     else:
      i['gmp']='—';i['gmp_pct']='—';i['est_list']='—';i['gmp_source']='Rejected abnormal value';rejected+=1
   except Exception as exc:
    data.setdefault('knowledge_errors',[]).append(str(exc))
 data.setdefault('sources',{})['VideoKnowledge']={'ok':True,'records':len(overrides),'changed_fields':changed,'live_gmp_records':live,'rejected_gmp_records':rejected,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
 data['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
 OUT.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Video knowledge applied:',changed,'fields; live GMP:',live,'rejected abnormal GMP:',rejected)

if __name__=='__main__':main()
