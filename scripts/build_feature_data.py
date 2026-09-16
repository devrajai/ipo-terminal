import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'data'
SRC = DATA / 'ipo-data.json'


def clean(v):
    return v if v not in (None, '') else '—'


def records(payload):
    if isinstance(payload, list):
        return payload
    for key in ('ipos', 'data', 'all_ipos', 'items', 'records'):
        value = payload.get(key) if isinstance(payload, dict) else None
        if isinstance(value, list):
            return value
    return []


def name(i):
    return clean(i.get('name') or i.get('company') or i.get('ipo_name'))


def write(path, updated_at, rows):
    path.write_text(json.dumps({'updated_at': updated_at, 'data': rows}, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def main():
    payload = json.loads(SRC.read_text(encoding='utf-8'))
    updated_at = payload.get('updated_at') if isinstance(payload, dict) else None
    ipos = [i for i in records(payload) if isinstance(i, dict) and name(i) != '—']

    gmp = []
    subscriptions = []
    sme = []
    for i in ipos:
        g = clean(i.get('gmp'))
        if g != '—':
            gmp.append({
                'name': name(i),
                'issue_price': clean(i.get('price') or i.get('issue_price')),
                'gmp': g,
                'estimated_listing': clean(i.get('est_list') or i.get('estimated_listing') or i.get('listing_price')),
                'gmp_pct': clean(i.get('gmp_pct')),
                'kostak': clean(i.get('kostak') or i.get('kostak_rate')),
                'updated_at': clean(i.get('gmp_updated_at') or updated_at),
            })
        q = i.get('sub_qib') or i.get('qib')
        n = i.get('sub_nii') or i.get('sub_hni') or i.get('nii') or i.get('hni')
        r = i.get('sub_retail') or i.get('retail') or i.get('rii')
        total = i.get('sub') or i.get('subscription') or i.get('total_subscription')
        if any(v not in (None, '', '—', '-') for v in (q, n, r, total)):
            subscriptions.append({'name': name(i), 'qib': clean(q), 'nii': clean(n), 'rii': clean(r), 'total': clean(total)})
        if str(i.get('type') or '').strip().upper() == 'SME':
            sme.append({
                'company': name(i),
                'exchange': clean(i.get('exchange')),
                'open_date': clean(i.get('open')),
                'close_date': clean(i.get('close')),
                'issue_size': clean(i.get('size')),
                'status': clean(i.get('status')),
            })

    write(DATA / 'gmp.json', updated_at, gmp)
    write(DATA / 'subscriptions.json', updated_at, subscriptions)
    write(DATA / 'sme-ipos.json', updated_at, sme)
    print(f'FEATURE DATA: GMP={len(gmp)}, subscriptions={len(subscriptions)}, SME={len(sme)}')


if __name__ == '__main__':
    main()
