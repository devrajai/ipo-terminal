import json
import urllib.request
from pathlib import Path
from datetime import datetime, timezone

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'ipo-data.json'
OUT=ROOT/'data'/'ipo-link-health.json'
UA='Mozilla/5.0 (IPO-Terminal Link Health)'
TIMEOUT=8

def check(url):
    if not isinstance(url,str) or not url.startswith(('http://','https://')):
        return False,'missing-url'
    for method in ('HEAD','GET'):
        try:
            req=urllib.request.Request(url,headers={'User-Agent':UA},method=method)
            with urllib.request.urlopen(req,timeout=TIMEOUT) as r:
                code=getattr(r,'status',200)
                return 200 <= code < 400,str(code)
        except Exception as ex:
            last=type(ex).__name__
    return False,last

def main():
    data=json.loads(DATA.read_text(encoding='utf-8'))
    items=[]
    for i in data.get('ipos',[]):
        source=i.get('source_url','')
        gmp=i.get('gmp_source_url','')
        filing=i.get('url') or i.get('document_url') or i.get('filing_url') or ''
        so,ss=check(source) if source else (False,'missing-url')
        go,gs=check(gmp) if gmp else (False,'missing-url')
        fo,fs=check(filing) if filing else (False,'missing-url')
        items.append({'id':i.get('id'),'name':i.get('name'),'source_url':source,'source_ok':so,'source_status':ss,'gmp_source_url':gmp,'gmp_ok':go,'gmp_status':gs,'filing_url':filing,'filing_ok':fo,'filing_status':fs,'has_valid_source':bool(so or go),'has_valid_filing':bool(fo)})
    OUT.write_text(json.dumps({'checked_at':datetime.now(timezone.utc).isoformat(),'items':items},ensure_ascii=False,indent=2),encoding='utf-8')

if __name__=='__main__': main()
