import datetime as dt
import html
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'ipo-data.json'
NEWS=ROOT/'data'/'live-news.json'
FILINGS=ROOT/'data'/'live-filings.json'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 IPO-Terminal/2.0'
FEEDS=[
 ('Google News · IPO India','https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':'IPO India','hl':'en-IN','gl':'IN','ceid':'IN:en'})),
 ('Google News · IPO allotment','https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':'IPO allotment India','hl':'en-IN','gl':'IN','ceid':'IN:en'})),
 ('Google News · IPO upcoming/listing','https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':'IPO upcoming listing India','hl':'en-IN','gl':'IN','ceid':'IN:en'})),
 ('Google News · RHP DRHP','https://news.google.com/rss/search?'+urllib.parse.urlencode({'q':'RHP DRHP IPO India','hl':'en-IN','gl':'IN','ceid':'IN:en'})),
]

def fetch(url,timeout=25):
 req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/rss+xml,application/xml,text/xml,*/*'})
 with urllib.request.urlopen(req,timeout=timeout) as r:return r.read().decode('utf-8','ignore')

def clean(v):return re.sub(r'\s+',' ',html.unescape(re.sub(r'<[^>]+>',' ',str(v or '')))).strip()

def tag(title):
 t=title.lower()
 if any(x in t for x in ('allotment','basis of allotment','allotted','refund','registrar')):return 'ALLOTMENT'
 if any(x in t for x in ('listing','listed')):return 'LISTING'
 if any(x in t for x in ('rhp','drhp','prospectus')):return 'FILING'
 return 'IPO'

def parse_feed(xml,source):
 out=[]
 for block in re.findall(r'<item\b.*?</item>',xml,re.I|re.S):
  def val(k):
   m=re.search(r'<'+k+r'[^>]*>(.*?)</'+k+r'>',block,re.I|re.S);return clean(m.group(1)) if m else ''
  title=val('title');url=val('link');pub=val('pubDate') or val('dc:date')
  if not title or not url:continue
  # Google News may include the publisher after a separator.
  publisher=source
  sm=re.search(r'<source[^>]*>(.*?)</source>',block,re.I|re.S)
  if sm:publisher=clean(sm.group(1)) or source
  out.append({'title':title[:300],'url':url,'published':pub[:80],'source':publisher,'feed_source':source,'tag':tag(title)})
 return out

def verify(url):
 try:
  req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'*/*'})
  with urllib.request.urlopen(req,timeout=15) as r:return True,int(getattr(r,'status',200)),r.geturl()
 except Exception:
  try:
   req=urllib.request.Request(url,headers={'User-Agent':UA,'Range':'bytes=0-2048'})
   with urllib.request.urlopen(req,timeout=15) as r:return True,int(getattr(r,'status',200)),r.geturl()
  except Exception:return False,None,url

def filing_records(payload,now):
 docs=[]
 for d in payload.get('documents',[]) if isinstance(payload.get('documents',[]),list) else []:
  if not isinstance(d,dict) or not d.get('url'):continue
  ok,status,final=verify(d['url'])
  x=dict(d);x['verified']=ok;x['http_status']=status;x['verified_at']=now.isoformat();x['verified_url']=final;docs.append(x)
 return docs

def main():
 now=dt.datetime.now(dt.timezone.utc);payload=json.loads(DATA.read_text(encoding='utf-8')) if DATA.exists() else {'ipos':[]}
 items=[];health={}
 for source,url in FEEDS:
  try:
   got=parse_feed(fetch(url),source);items.extend(got);health[source]={'ok':bool(got),'records':len(got),'url':url}
  except Exception as exc:health[source]={'ok':False,'records':0,'url':url,'error':str(exc)[:220]}
 # newest first, de-duplicate by URL/title, keep 30.
 uniq={}
 for x in items:uniq[(x['url'],x['title'])]=x
 items=list(uniq.values())[:200]
 # Allotment panel needs one recent item per IPO. Preserve broad news but mark likely IPO name from title.
 for x in items:
  low=x['title'].lower()
  for ipo in payload.get('ipos',[]):
   name=str(ipo.get('name','')).strip()
   words=[w.lower() for w in re.findall(r'[A-Za-z]{4,}',name)[:2]]
   if words and any(w in low for w in words):x['ipo']=name;break
 NEWS.write_text(json.dumps({'version':'1.0.0','generated_at':now.isoformat(),'items':items,'sources':health},ensure_ascii=False,indent=2),encoding='utf-8')
 docs=filing_records(payload,now)
 FILINGS.write_text(json.dumps({'version':'1.0.0','generated_at':now.isoformat(),'documents':docs,'verified_count':sum(1 for x in docs if x.get('verified'))},ensure_ascii=False,indent=2),encoding='utf-8')
 payload.setdefault('sources',{})['LiveNews']={'ok':bool(items),'records':len(items),'checked_at':now.isoformat(),'feeds':health}
 payload.setdefault('sources',{})['FilingVerification']={'ok':bool(docs),'records':len(docs),'verified':sum(1 for x in docs if x.get('verified')),'checked_at':now.isoformat()}
 DATA.write_text(json.dumps(payload,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Live content:',len(items),'news;',len(docs),'filings;',sum(1 for x in docs if x.get('verified')),'verified')

if __name__=='__main__':main()
