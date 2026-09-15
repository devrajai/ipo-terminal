import datetime as dt
import json
import re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/'data'/'ipo-data.json'
KNOW=ROOT/'data'/'video-knowledge-002.json'

def norm(v):
 return re.sub(r'\b(limited|ltd|india|ipo|nse|bse)\b',' ',str(v or '').lower()).replace(' ','')

def main():
 if not DATA.exists() or not KNOW.exists():return
 data=json.loads(DATA.read_text(encoding='utf-8'));k=json.loads(KNOW.read_text(encoding='utf-8'));ipos=data.get('ipos',[]);changed=0
 for rec in k.get('records',[]):
  keys=[norm(rec.get('aliases',[rec.get('name','')])[0])]+[norm(x) for x in rec.get('aliases',[])]
  target=next((i for i in ipos if norm(i.get('name')) in keys or any(x and (x in norm(i.get('name')) or norm(i.get('name')) in x) for x in keys)),None)
  if not target:continue
  target['video_evidence']=rec.get('video_evidence','');target['video_evidence_source']=k.get('source','user-provided transcript');target['video_evidence_updated_at']=dt.datetime.now(dt.timezone.utc).isoformat();changed+=1
  for field,val in rec.get('facts',{}).items():
   if field in ('listing_gain_view','long_term_view'):continue
   if field in target and target[field] not in (None,'','—','-'):continue
   target[field]=val
 data.setdefault('sources',{})['TranscriptEvidence']={'ok':True,'records':changed,'checked_at':dt.datetime.now(dt.timezone.utc).isoformat()}
 data['updated_at']=dt.datetime.now(dt.timezone.utc).isoformat();DATA.write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
 print('Transcript evidence applied:',changed)
if __name__=='__main__':main()
