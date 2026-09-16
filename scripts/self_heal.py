"""Deterministic IPO Terminal self-healing pass.

Keeps Open and Upcoming mutually exclusive using India time. An IPO moves to
Open at 00:00 IST on its opening date, to Closed after its closing date, and to
Listed on/after its listing date. Official filing links are checked and the
upcoming filing map is regenerated on every run.
"""
import datetime as dt
import json
import re
from pathlib import Path
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data' / 'ipo-data.json'
SME = ROOT / 'data' / 'sme-ipos.json'
FILINGS = ROOT / 'data' / 'live-filings.json'
HEALTH = ROOT / 'data' / 'self-heal-health.json'
UPCOMING_FILINGS = ROOT / 'data' / 'upcoming-ipo-filings.json'
UA = 'Mozilla/5.0 IPO-Terminal-Self-Heal/4.0'
IST = ZoneInfo('Asia/Kolkata')
OFFICIAL_ALTERNATES = {
    'nse': ['https://www.nseindia.com/static/investor-relations/offer-documents','https://www.nseindia.com/static/products-services/public-offer-documents','https://www.nseindia.com/companies-listing/corporate-filings-offer-documents'],
    'national stock exchange': ['https://www.nseindia.com/static/investor-relations/offer-documents','https://www.nseindia.com/static/products-services/public-offer-documents','https://www.nseindia.com/companies-listing/corporate-filings-offer-documents'],
    'jio platforms': ['https://www.jio.com/about/investor-relations/ipo/','https://www.ril.com/investor/resource-center/corporate-announcements'],
}

def parse_date(v, end=False):
    if not v or str(v).strip() in ('—','-','N/A'): return None
    s=str(v).strip(); m=re.match(r'^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$',s)
    if m:
        y=int(m.group(3)); y += 2000 if y<100 else 0
        return dt.datetime(y,int(m.group(2)),int(m.group(1)),23 if end else 0,59 if end else 0,59 if end else 0,tzinfo=IST)
    try:
        x=dt.datetime.fromisoformat(s.replace('Z','+00:00'))
        if x.tzinfo is None: x=x.replace(tzinfo=IST)
        return x.astimezone(IST)
    except Exception: return None

def check_url(url, attempts=2):
    status=None; final=url
    for _ in range(attempts):
        try:
            req=Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/json,*/*;q=0.8'})
            with urlopen(req,timeout=12) as r:
                status=int(getattr(r,'status',200)); final=r.geturl()
                if 200<=status<400: return True,status,final
        except Exception: pass
    return False,status,final

def choose_official_url(name,exchange=''):
    key=str(name or '').lower()
    for marker,urls in OFFICIAL_ALTERNATES.items():
        if marker in key: return urls
    return OFFICIAL_ALTERNATES['nse']

def normalize_status(ipo,now):
    old=str(ipo.get('status') or '').strip().lower()
    opening=parse_date(ipo.get('open'),False); closing=parse_date(ipo.get('close'),True)
    listing=parse_date(ipo.get('listing') or ipo.get('listing_date'),False)
    if listing and now>=listing: new='listed'
    elif closing and now>closing: new='closed'
    elif opening and now>=opening and (not closing or now<=closing): new='open'
    elif opening and now<opening: new='upcoming'
    else: new=old or 'upcoming'
    ipo['status']=new; ipo['status_auto']=True; ipo['status_checked_at']=now.isoformat()
    return new!=old

def normalize_name(v): return re.sub(r'[^a-z0-9]+','',str(v or '').lower().replace('limited','').replace('ltd',''))

def import_missing_sme(ipos):
    added=0
    try:
        payload=json.loads(SME.read_text(encoding='utf-8')) if SME.exists() else []
        rows=payload.get('ipos',[]) if isinstance(payload,dict) else payload
        existing={normalize_name(x.get('name')) for x in ipos if isinstance(x,dict)}
        for row in rows if isinstance(rows,list) else []:
            if not isinstance(row,dict) or not row.get('name'): continue
            key=normalize_name(row.get('name'))
            if key in existing: continue
            item=dict(row); item.setdefault('type','SME'); item.setdefault('status','upcoming'); item.setdefault('exchange','NSE'); item.setdefault('listing','—'); item.setdefault('price','—'); item.setdefault('size','—')
            ipos.append(item); existing.add(key); added+=1
    except Exception as exc: print('SME import warning:',exc)
    return added

def verify_and_repair_doc(doc,now):
    name=str(doc.get('name') or '').strip(); old=str(doc.get('url') or '').strip(); candidates=([old] if old else [])+choose_official_url(name,doc.get('exchange')); seen=set()
    result={'checked':0,'verified':False,'repaired':False,'status':None,'final':old}
    for url in candidates:
        if not url or url in seen: continue
        seen.add(url); ok,status,final=check_url(url); result['checked']+=1; result['status']=status; result['final']=final
        if ok:
            result['verified']=True
            if doc.get('url')!=url: doc['url']=url; result['repaired']=True
            doc.update({'verified':True,'http_status':status,'verified_url':final,'self_healed_at':now.isoformat(),'link_source':'official-alternate'}); return result
    doc.update({'verified':False,'http_status':result['status'],'verified_url':result['final'],'self_healed_at':now.isoformat(),'link_source':'official-alternate-failed'}); return result

def build_upcoming_filing_map(ipos,now):
    rows=[]
    for ipo in ipos:
        if not isinstance(ipo,dict) or str(ipo.get('status') or '').lower()!='upcoming': continue
        name=str(ipo.get('name') or '').strip()
        if not name: continue
        candidates=choose_official_url(name,ipo.get('exchange')); selected=None; http_status=None; verified=False
        for url in candidates:
            ok,st,final=check_url(url); http_status=st
            if ok: selected=final; verified=True; break
        rows.append({'ipo_name':name,'id':ipo.get('id'),'type':ipo.get('type','Mainboard'),'exchange':ipo.get('exchange','NSE'),'status':'upcoming','open':ipo.get('open','—'),'close':ipo.get('close','—'),'filing_url':selected or candidates[0],'verified':verified,'http_status':http_status,'checked_at':now.isoformat()})
    UPCOMING_FILINGS.write_text(json.dumps({'generated_at':now.isoformat(),'source':'IPO Terminal self-heal official-source checker','count':len(rows),'ipos':rows},ensure_ascii=False,indent=2),encoding='utf-8'); return rows

def main():
    now=dt.datetime.now(IST); payload=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos':[]}; ipos=payload.get('ipos',[]) if isinstance(payload.get('ipos',[]),list) else []
    added=import_missing_sme(ipos); changed=sum(normalize_status(i,now) for i in ipos if isinstance(i,dict))
    filing={'checked':0,'verified':0,'repaired':0}
    if FILINGS.exists():
        fp=json.loads(FILINGS.read_text(encoding='utf-8')); docs=fp.get('documents',[]) if isinstance(fp.get('documents',[]),list) else []
        for doc in docs:
            if not isinstance(doc,dict) or not doc.get('url'): continue
            r=verify_and_repair_doc(doc,now); filing['checked']+=r['checked']; filing['verified']+=int(r['verified']); filing['repaired']+=int(r['repaired'])
        fp['generated_at']=now.isoformat(); fp['verified_count']=filing['verified']; FILINGS.write_text(json.dumps(fp,ensure_ascii=False,indent=2),encoding='utf-8')
    upcoming=build_upcoming_filing_map(ipos,now)
    payload['ipos']=ipos; payload['updated_at']=now.isoformat(); payload.setdefault('sources',{})['SelfHeal']={'ok':True,'checked_at':now.isoformat(),'status_repairs':changed,'sme_added':added,'filings':filing,'upcoming_filing_map':len(upcoming),'schedule':'GitHub Actions every 15 minutes','rule':'Open and Upcoming are mutually exclusive; opening date begins at 00:00 IST'}
    DATA.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    HEALTH.write_text(json.dumps({'ok':True,'checked_at':now.isoformat(),'status_repairs':changed,'sme_added':added,'filings':filing,'upcoming_filing_map':len(upcoming),'schedule':'every 15 minutes','open_upcoming_exclusive':True},ensure_ascii=False,indent=2),encoding='utf-8')
    print('SELF-HEAL OK:',changed,'status repairs;',added,'SME added; upcoming:',len(upcoming))

if __name__=='__main__': main()
