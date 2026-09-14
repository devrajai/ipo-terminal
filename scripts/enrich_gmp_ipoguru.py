import json
import os
import re
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'data' / 'ipo-data.json'
API = 'https://www.ipoguru.in/api/v1/ipos'
UA = 'Mozilla/5.0 IPO-Terminal/1.3'

def norm(value):
    text = str(value or '').lower()
    text = re.sub(r'\b(ipo|nse|bse|limited|ltd|india|ind|technologies|technology)\b', ' ', text)
    return re.sub(r'[^a-z0-9]+', '', text)

def number(value):
    m = re.search(r'-?[0-9]+(?:\.[0-9]+)?', str(value or '').replace(',', ''))
    return float(m.group(0)) if m else None

def fetch():
    key = os.getenv('IPOGURU_API_KEY', '').strip()
    if not key:
        print('IPOGURU_API_KEY not configured; keeping existing GMP fallbacks.')
        return None
    req = urllib.request.Request(API, headers={'X-API-KEY': key, 'User-Agent': UA, 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8', 'ignore'))

def main():
    if not OUT.exists(): return
    payload = json.loads(OUT.read_text(encoding='utf-8'))
    data = fetch()
    if not data or not isinstance(data.get('data'), list): return
    api = {}
    for item in data['data']:
        if not isinstance(item, dict) or not item.get('name'): continue
        gmp = item.get('gmp') or {}
        value = number(gmp.get('price')) if isinstance(gmp, dict) else number(gmp)
        if value is not None: api[norm(item['name'])] = (value, gmp.get('updated_at', '') if isinstance(gmp, dict) else '')
    matched = 0
    for ipo in payload.get('ipos', []):
        key = norm(ipo.get('name'))
        hit = api.get(key)
        if not hit:
            hit = next((v for k, v in api.items() if key and k and (key in k or k in key)), None)
        if not hit: continue
        value, source_updated = hit
        ipo['gmp'] = f'₹{int(value) if value.is_integer() else value}'
        ipo['gmp_source'] = 'IPOGuru'
        ipo['gmp_source_url'] = API
        ipo['gmp_updated_at'] = datetime.now(timezone.utc).isoformat()
        if source_updated: ipo['gmp_source_updated_at'] = source_updated
        price = number(ipo.get('price'))
        if price and price > 0:
            ipo['gmp_pct'] = f'{value / price * 100:+.1f}%'
            est = price + value
            ipo['est_list'] = f'₹{int(est) if est.is_integer() else round(est, 2)}'
        matched += 1
    payload.setdefault('sources', {}).setdefault('GMP', {})['ipoguru_records'] = matched
    payload['sources']['GMP']['primary'] = 'IPOGuru'
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')
    print(f'IPOGuru GMP enrichment matched {matched} IPOs.')

if __name__ == '__main__': main()
