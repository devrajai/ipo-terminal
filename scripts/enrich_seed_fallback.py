import datetime as dt
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'data'/'ipo-data.json'
FUND=ROOT/'data'/'fundamentals-seed.json'
RHP=ROOT/'data'/'rhp-seed.json'
EMPTY={'',None,'—','-','NA','N/A'}
def clean(v): return str(v or '').strip()
def norm(v): return re.sub(r'[^a-z0-9]+','',re.sub(r'\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b',' ',clean(v).lower()))
def missing(v):
    if v in EMPTY:return True
    s=clean(v).lower()
    return s in {'tba','na','n/a'} or s in {'₹0 cr','0 cr','0'}
def main():
    if not OUT.exists():return
    p=json.loads(OUT.read_text(encoding='utf-8'));ipos=p.get('ipos',[])
    seed=json.loads(FUND.read_text(encoding='utf-8')).get('ipos',[]) if FUND.exists() else []
    smap={norm(x.get('name')):x for x in seed if x.get('name')}
    matched=0
    fields=('sector','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom','size','lot')
    for i in ipos:
        s=smap.get(norm(i.get('name')))
        if not s:continue
        changed=False
        for k in fields:
            if missing(i.get(k)) and not missing(s.get(k)):
                i[k]=s[k];changed=True
        if changed:
            i['fundamentals_source']=i.get('fundamentals_source') or 'IPO Terminal embedded research fallback'
            i['fundamentals_updated_at']=dt.datetime.now(dt.timezone.utc).isoformat();matched+=1
    docs=json.loads(RHP.read_text(encoding='utf-8')).get('documents',[]) if RHP.exists() else []
    existing=p.get('documents',[])
    if not existing and docs:p['documents']=docs
    p.setdefault('sources',{})['SeedFallback']={'ok':bool(seed or docs),'records':matched,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat(),'seed_fundamentals':len(seed),'seed_documents':len(docs)}
    p['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat()
    OUT.write_text(json.dumps(p,ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'Seed fallback: filled {matched} IPO records; documents={len(p.get("documents",[]))}')
if __name__=='__main__':main()
