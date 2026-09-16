import datetime as dt, html, json, re, urllib.parse, urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]; DATA=ROOT/'data'/'ipo-data.json'; NEWS=ROOT/'data'/'live-news.json'; FILINGS=ROOT/'data'/'live-filings.json'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/2.1'
FEEDS=[
 ('Google News · IPO India','IPO India'),('Google News · IPO allotment','IPO allotment India'),
 ('Google News · IPO upcoming/listing','IPO upcoming listing India'),('Google News · RHP DRHP','RHP DRHP IPO India')]
FILING_OVERRIDES={
 'nse':'https://www.nseindia.com/static/investor-relations/offer-documents',
 'jio platforms':'https://www.ril.com/investor/resource-center/corporate-announcements'
}

def fetch(url,timeout=15):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/rss+xml,application/xml,text/xml,*/*'})
 with urllib.request.urlopen(req,timeout=timeout) as r:return r.read().decode('utf-8','ignore')
def clean(v):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',str(v or '')))).strip()
def tag(t):
 t=t.lower();return 'ALLOTMENT' if any(x in t for x in ('allotment','basis of allotment','allotted','refund','registrar')) else ('LISTING' if 'list' in t else ('FILING' if any(x in t for x in ('rhp','drhp','prospectus')) else 'IPO'))
def parse(xml,source):
 out=[]
 for b in re.findall(r'<item\b.*?</item>',xml,re.I|re.S):
  def v(k):
   m=re.search(r'<'+k+r'[^>]*>(.*?)</'+k+r'>',b,re.I|re.S);return clean(m.group(1)) if m else ''
  title,url,pub=v('title'),v('link'),v('pubDate') or v('dc:date')
  if not title or not url:continue
  sm=re.search(r'<source[^>]*>(.*?)</source>',b,re.I|re.S);publisher=clean(sm.group(1)) if sm else source
  out.append({'title':title[:300],'url':url,'published':pub[:80],'source':publisher,'feed_source':source,'tag':tag(title)})
 return out
def verify(url):
 try:
  req=urllib.request.Request(url,headers={'User-Agent':UA,'Range':'bytes=0-2048'})
  with urllib.request.urlopen(req,timeout=5) as r:return True,int(getattr(r,'status',200)),r.geturl()
 except Exception:return False,None,url
def main():
 now=dt.datetime.now(dt.timezone.utc);payload=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos':[]};items=[];health={}
 for label,q in FEEDS:
  url='https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':q,'hl':'en-IN','gl':'IN','ceid':'IN:en'})
  try:
   got=parse(fetch(url),label);items.extend(got);health[label]={'ok':bool(got),'records':len(got),'url':url}
  except Exception as ex:health[label]={'ok':False,'records':0,'url':url,'error':str(ex)[:180]}
 uniq={}
 for x in items:uniq[(x['url'],x['title'])]=x
 items=list(uniq.values())[:200]
 for x in items:
  low=x['title'].lower()
  for ipo in payload.get('ipos',[]):
   words=[w.lower() for w in re.findall(r'[A-Za-z]{4,}',str(ipo.get('name','')))[:2]]
   if words and any(w in low for w in words):x['ipo']=ipo.get('name');break
 NEWS.write_text(json.dumps({'version':'1.1.0','generated_at':now.isoformat(),'items':items,'sources':health},ensure_ascii=False,indent=2),encoding='utf-8')
 docs=[]
 for d in (payload.get('documents',[]) if isinstance(payload.get('documents',[]),list) else [])[:25]:
  if not isinstance(d,dict) or not d.get('url'):continue
  x=dict(d)
  key=str(x.get('name','')).strip().lower()
  if key in FILING_OVERRIDES:
   x['url']=FILING_OVERRIDES[key]
  ok,status,final=verify(x['url']);x.update({'verified':ok,'http_status':status,'verified_at':now.isoformat(),'verified_url':final});docs.append(x)
 FILINGS.write_text(json.dumps({'version':'1.1.0','generated_at':now.isoformat(),'documents':docs,'verified_count':sum(1 for x in docs if x.get('verified'))},ensure_ascii=False,indent=2),encoding='utf-8')
 payload.setdefault('sources',{})['LiveNews']={'ok':bool(items),'records':len(items),'checked_at':now.isoformat(),'feeds':health};payload.setdefault('sources',{})['FilingVerification']={'ok':bool(docs),'records':len(docs),'verified':sum(1 for x in docs if x.get('verified')),'checked_at':now.isoformat()};payload['updated_at']=now.isoformat();DATA.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Live content:',len(items),'news;',len(docs),'filings;',sum(1 for x in docs if x.get('verified')),'verified')
if __name__=='__main__':main()
