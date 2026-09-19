#!/usr/bin/env python3
"""Append today's TimesFM forecasts to data/forecast-log.json.

Every day the forecast workflow overwrites data/forecasts.json with the latest
prediction. For a public accuracy scorecard we ALSO keep an append-only log:
one entry per day with each IPO's latest forecast point. The Track Record tab
compares every logged prediction with the actual GMP recorded the next day.
Idempotent per date.
"""
import datetime as dt
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FC = os.path.join(ROOT, 'data', 'forecasts.json')
LOG = os.path.join(ROOT, 'data', 'forecast-log.json')
HIST = os.path.join(ROOT, 'data', 'history.json')


def main():
    try:
        with open(FC, encoding='utf-8') as f:
            fc = json.load(f)
    except (OSError, ValueError):
        print('no forecasts.json yet - skipping')
        return

    today = dt.date.today().isoformat()
    log = {'log': []}
    if os.path.exists(LOG):
        try:
            with open(LOG, encoding='utf-8') as f:
                log = json.load(f)
        except (OSError, ValueError):
            log = {'log': []}

    if any(e.get('d') == today for e in log['log']):
        print('already logged for', today)
        return

    entry = {'d': today, 'model': fc.get('model', '?'), 'ipos': {}}
    for name, f in (fc.get('ipos') or {}).items():
        pts = [p for p in (f.get('points') or []) if p.get('mid') is not None]
        if pts:
            entry['ipos'][name] = {'mid': pts[-1]['mid'], 'low': pts[-1].get('low'), 'high': pts[-1].get('high')}

    log['log'].append(entry)
    log['log'] = log['log'][-400:]
    with open(LOG, 'w', encoding='utf-8') as f:
        json.dump(log, f, indent=1)
    print('logged %d forecasts for %s (model=%s)' % (len(entry['ipos']), today, entry['model']))


if __name__ == '__main__':
    main()
