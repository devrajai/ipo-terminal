import json, re, urllib.request, datetime
from pathlib import Path

OUT=Path(__file__).resolve().parents[1]/'data'/'ipo-data.json'
UA='Mozilla/5.0 (compatible; IPO-Terminal/1.0; +https://github.com/)'

def get(url, timeout=25):
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'text/html,application/xhtml+xml,application/json'})
    with urllib.request.urlopen(req,timeout=timeout) as r:
        return r.read().decode('utf-8','ignore')

def extract_sebi_links(html):
    out=[]
    # Conservative discovery: capture links whose text/URL indicates public-issue filings.
    for m in re.finditer(r'<a[^>]+href=["\']([^"\']+)["\'][^>]*>(.*?)</a>',html,re.I|re.S):
        url=re.sub(r'&amp;','&',m.group(1)); text=re.sub('<[^>]+>',' ',m.group(2)); text=' '.join(text.split())
        if any(x in (url+' '+text).lower() for x in ('rhp','drhp','prospectus','public-issues')):
            if url.startswith('/'):
                url='https://www.sebi.gov.in'+url
            if url.startswith('http'):
                out.append({'title':text[:180], 'url':url})
    seen=set(); clean=[]
    for x in out:
        if x['url'] not in seen:
            seen.add(x['url']); clean.append(x)
    return clean[:200]

def main():
    now=datetime.datetime.now(datetime.timezone.utc).isoformat()
    docs=[]
    sources=[]
    # Official SEBI public-issues index. Discovery is intentionally conservative;
    # failed sources do not destroy the previous generated file.
    urls=['https://www.sebi.gov.in/filings/public-issues/']
    for u in urls:
        try:
            h=get(u)
            docs.extend(extract_sebi_links(h)); sources.append('SEBI')
        except Exception as e:
            print('SEBI failed:',e)
    # Keep only actual filing-like records.
    documents=[]
    for d in docs:
        low=d['title'].lower()
        typ='RHP' if 'rhp' in low else ('DRHP' if 'drhp' in low else 'Filing')
        documents.append({'name':d['title'] or 'SEBI Public Issue Filing','type':typ,'url':d['url'],'date':'—'})
    # Do not invent IPO facts. The frontend's embedded dataset is the safe fallback.
    old={}
    if OUT.exists():
        try: old=json.loads(OUT.read_text(encoding='utf-8'))
        except Exception: old={}
    payload={'source':'SEBI official discovery' if documents else old.get('source','Automatic sources'),
             'updated_at':now,
             'ipos':old.get('ipos',[]), 'listed':old.get('listed',[]), 'news':old.get('news',[]),
             'documents':documents or old.get('documents',[])}
    OUT.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
    print('Wrote',OUT,'documents:',len(documents),'sources:',sources)

if __name__=='__main__': main()
