import datetime as dt
import json
import hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
IPO = ROOT / 'data' / 'ipo-data.json'
STATE = ROOT / 'data' / 'terminal-state.json'
EVENTS = ROOT / 'data' / 'terminal-events.json'

IMPORTANT = ('price','size','lot','open','close','allotment','listing','sub','sub_qib','sub_nii','sub_retail','gmp','gmp_pct','est_list','pe','roe','roce','growth','de','fresh','ofs')
EMPTY = {'', None, '—', '-'}

def parse_date(v):
    if v in EMPTY: return None
    s = str(v).strip()
    for fmt in ('%d/%m/%y','%d/%m/%Y','%d-%m-%Y','%d-%b-%Y','%d %b %Y','%d %B %Y','%Y-%m-%d'):
        try: return dt.datetime.strptime(s, fmt).date()
        except ValueError: pass
    try: return dt.datetime.fromisoformat(s.replace('Z','+00:00')).date()
    except Exception: return None

def key_for(i):
    return str(i.get('id') or i.get('name') or '').strip().lower()

def fingerprint(i):
    data = {k:i.get(k) for k in IMPORTANT}
    return hashlib.sha256(json.dumps(data, sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:16]

def events(ipos, today):
    out=[]
    for i in ipos:
        name=i.get('name')
        if not name: continue
        for field,label in (('open','OPEN'),('close','CLOSE'),('allotment','ALLOTMENT'),('allot','ALLOTMENT'),('allotment_date','ALLOTMENT'),('listing','LISTING'),('listing_date','LISTING')):
            d=parse_date(i.get(field))
            if d: out.append({'date':d.isoformat(),'type':label,'ipo_id':key_for(i),'name':name,'source':i.get('source','—')})
    # De-duplicate aliases such as allot/allotment and listing/listing_date.
    uniq={ (x['date'],x['type'],x['ipo_id']):x for x in out }
    return sorted(uniq.values(), key=lambda x:(x['date'],x['type'],x['name']))

def main():
    payload=json.loads(IPO.read_text(encoding='utf-8')) if IPO.exists() else {'ipos':[],'sources':{}}
    ipos=[i for i in payload.get('ipos',[]) if isinstance(i,dict) and i.get('name')]
    now=dt.datetime.now(dt.timezone.utc)
    today=now.date()
    old={}
    if STATE.exists():
        try: old=json.loads(STATE.read_text(encoding='utf-8'))
        except Exception: old={}
    old_map={x.get('id'):x for x in old.get('ipos',[]) if isinstance(x,dict) and x.get('id')}
    changes=[]
    for i in ipos:
        k=key_for(i); fp=fingerprint(i); prev=old_map.get(k)
        if prev and prev.get('fingerprint') != fp:
            changed=[f for f in IMPORTANT if prev.get('fields',{}).get(f) != i.get(f)]
            changes.append({'at':now.isoformat(),'type':'DATA_CHANGE','ipo_id':k,'name':i['name'],'fields':changed[:12]})
    previous_events=old.get('events',[])
    current_events=events(ipos,today)
    current_keys={(x['date'],x['type'],x['ipo_id']) for x in current_events}
    known={(x.get('date'),x.get('type'),x.get('ipo_id')) for x in previous_events if isinstance(x,dict)}
    for x in current_events:
        if x['date'] >= today.isoformat() and (x['date'],x['type'],x['ipo_id']) not in known:
            changes.append({'at':now.isoformat(),'type':'NEW_EVENT','event':x})
    changes=(changes+old.get('changes',[]))[:300]
    source_health=payload.get('sources',{})
    total=len(ipos); populated=0; fields=0
    for i in ipos:
        for k in IMPORTANT:
            fields+=1
            if i.get(k) not in EMPTY: populated+=1
    coverage=round(populated/fields*100,1) if fields else 0
    state={
        'version':'2.0.0','generated_at':now.isoformat(),'today_ist':now.astimezone(dt.timezone(dt.timedelta(hours=5,minutes=30))).date().isoformat(),
        'data_updated_at':payload.get('updated_at'),'ipo_count':total,'field_coverage_pct':coverage,
        'sources':source_health,'ipos':[{'id':key_for(i),'name':i['name'],'fingerprint':fingerprint(i),'fields':{k:i.get(k) for k in IMPORTANT}} for i in ipos],
        'events':current_events,'changes':changes
    }
    STATE.write_text(json.dumps(state,ensure_ascii=False,indent=2),encoding='utf-8')
    upcoming=[e for e in current_events if e['date']>=today.isoformat()][:100]
    EVENTS.write_text(json.dumps({'version':'2.0.0','generated_at':now.isoformat(),'events':upcoming},ensure_ascii=False,indent=2),encoding='utf-8')
    print(f'IPO state: {total} IPOs, {coverage}% field coverage, {len(upcoming)} upcoming events, {len(changes)} tracked changes')

if __name__=='__main__': main()
