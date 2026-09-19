#!/usr/bin/env python3
"""Append today's GMP snapshot to data/history.json (idempotent per date).

Run daily from the timesfm-forecast workflow. Keeps the last 180 points per
IPO so the forecast job always has a usable series, and never touches any
other data file the 5-minute updater owns.
"""
import datetime as dt
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST = os.path.join(ROOT, 'data', 'history.json')
GMP = os.path.join(ROOT, 'data', 'gmp.json')
KEEP = 180


def num(v):
    m = re.search(r'-?\d+(?:\.\d+)?', str(v).replace(',', ''))
    return float(m.group()) if m else None


def main():
    today = dt.date.today().isoformat()
    if os.path.exists(HIST):
        hist = json.load(open(HIST, encoding='utf-8'))
    else:
        hist = {}
    hist.setdefault('series', {})
    hist.setdefault('market', [])
    added = 0
    try:
        raw = json.load(open(GMP, encoding='utf-8'))
        arr = raw.get('data', raw) if isinstance(raw, dict) else raw
        for g in arr or []:
            name = (g or {}).get('name')
            gmp = num(g.get('gmp'))
            if not name or gmp is None:
                continue
            s = hist['series'].setdefault(name, [])
            if not s or s[-1].get('d') != today:
                s.append({
                    'd': today,
                    'gmp': gmp,
                    'gmp_pct': num(g.get('gmp_pct')),
                    'listing_est': num(g.get('estimated_listing')),
                })
                added += 1
            if len(s) > KEEP:
                hist['series'][name] = s[-KEEP:]
    except FileNotFoundError:
        print('gmp.json missing - nothing to append')
    except Exception as e:
        print('history append error (kept old file):', repr(e))
    hist['updated'] = dt.datetime.now(dt.timezone.utc).isoformat()
    json.dump(hist, open(HIST, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('history updated for', today, '| new points:', added,
          '| total series:', len(hist['series']))


if __name__ == '__main__':
    main()
