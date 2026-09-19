#!/usr/bin/env python3
"""Daily forecast job: TimesFM 3.0 zero-shot GMP trend forecasts per IPO.

Reads data/history.json (built by scripts/append_history.py), forecasts the
next HORIZON days of grey-market premium for every IPO with enough history,
and writes data/forecasts.json for the site.

TimesFM 3.0 (google/timesfm-3.0-pytorch, 330M params) runs zero-shot on CPU:
no training, no GPU, no API key. If the timesfm package is unavailable
(install failed, out of memory...) the script falls back to a simple trend
continuation so the site always receives a valid forecasts file - check the
workflow log / "model" field to see which path produced it.
"""
import datetime as dt
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HIST = os.path.join(ROOT, 'data', 'history.json')
OUT = os.path.join(ROOT, 'data', 'forecasts.json')
GMP = os.path.join(ROOT, 'data', 'gmp.json')

HORIZON = 3
MIN_POINTS = 3
CONTEXT = 128
# TimesFM 3.0 returns 9 deciles per step; index 4 is the median.
QLOW, QMID, QHIGH = 0, 4, 8


def num(v):
    m = re.search(r'-?\d+(?:\.\d+)?', str(v).replace(',', ''))
    return float(m.group()) if m else None


def stamp():
    return dt.datetime.now(dt.timezone.utc).isoformat()


def load_history():
    if not os.path.exists(HIST):
        return {}
    try:
        return json.load(open(HIST, encoding='utf-8'))
    except Exception as e:
        print('history.json unreadable:', repr(e))
        return {}


def forecast_timesfm(usable):
    """Returns {name: [ {date, low, mid, high} x HORIZON ]} via TimesFM 3.0."""
    import numpy as np
    from timesfm3 import TimesFM3Evaluator, ModelConfig

    config = ModelConfig(
        checkpoint_path='google/timesfm-3.0-pytorch',
        per_core_batch_size=8,
        device='cpu',
    )
    forecaster = TimesFM3Evaluator(config)
    names = sorted(usable)
    contexts = [np.asarray(usable[n][1], dtype=np.float32) for n in names]
    outs = list(forecaster.predict_batch(
        contexts, horizon=HORIZON,
        return_quantiles=True, use_symmetric_averaging=False))
    results = {}
    for name, out in zip(names, outs):
        q = getattr(out, 'quantiles', None)
        f = getattr(out, 'forecast', None)
        points = []
        for i in range(HORIZON):
            mid = float(q[i][QMID]) if q is not None and len(q) > i else float(f[i])
            low = float(q[i][QLOW]) if q is not None and len(q) > i else mid
            high = float(q[i][QHIGH]) if q is not None and len(q) > i else mid
            points.append({
                'date': str(dt.date.today() + dt.timedelta(days=i + 1)),
                'low': round(low, 1), 'mid': round(mid, 1), 'high': round(high, 1),
            })
        results[name] = points
    return results


def forecast_naive(usable):
    """Trend continuation fallback: last value + mean daily drift, wide band."""
    results = {}
    for name, (_, vals) in usable.items():
        diffs = [vals[i + 1] - vals[i] for i in range(len(vals) - 1)]
        drift = sum(diffs) / len(diffs) if diffs else 0.0
        spread = (max(diffs) - min(diffs)) / 2 * 1.5 if diffs else max(1.0, abs(vals[-1]) * 0.08)
        points = []
        cur = float(vals[-1])
        for i in range(HORIZON):
            cur = cur + drift
            points.append({
                'date': str(dt.date.today() + dt.timedelta(days=i + 1)),
                'low': round(cur - spread, 1), 'mid': round(cur, 1),
                'high': round(cur + spread, 1),
            })
        results[name] = points
    return results


def add_est_listing(results):
    """est. listing = lower price band + forecast GMP, when the band is known."""
    try:
        raw = json.load(open(GMP, encoding='utf-8'))
        arr = raw.get('data', raw) if isinstance(raw, dict) else raw
        for g in arr or []:
            name = (g or {}).get('name')
            if name not in results:
                continue
            band = str(g.get('issue_price') or '')
            lo = num(band.split('-')[0]) if band else None
            if lo:
                last = results[name]['points'][-1]
                results[name]['est_listing'] = {
                    'low': round(lo + last['low'], 1),
                    'mid': round(lo + last['mid'], 1),
                    'high': round(lo + last['high'], 1),
                }
    except Exception as e:
        print('est_listing skipped:', repr(e))


def main():
    hist = load_history()
    usable = {}
    for name, pts in (hist.get('series') or {}).items():
        vals = [p.get('gmp') for p in (pts or [])
                if isinstance(p.get('gmp'), (int, float))]
        if len(vals) >= MIN_POINTS:
            usable[name] = (pts, vals[-CONTEXT:])
    print('series with enough history:', len(usable),
          '(need >=' + str(MIN_POINTS) + ' daily points each)')

    model = 'naive-fallback'
    results = {}
    if usable:
        try:
            results = forecast_timesfm(usable)
            model = 'timesfm-3.0'
            print('timesfm-3.0 forecast for', len(results), 'series')
        except Exception as e:
            print('TimesFM unavailable, using naive fallback:', repr(e))
            results = forecast_naive(usable)

    payload = {}
    for name, points in results.items():
        payload[name] = {'horizon_days': HORIZON, 'points': points}
    add_est_listing(payload)
    ready = {n: len(v[1]) for n, v in usable.items()}

    out = {
        'generated_at': stamp(),
        'model': model,
        'min_points_required': MIN_POINTS,
        'ipos': payload,
        'points_ready': ready,
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
    print('wrote', OUT, '| series:', len(payload), '| model:', model)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        # Never break the workflow: always leave a valid file for the site.
        json.dump({'generated_at': stamp(), 'model': 'error', 'error': repr(e),
                   'ipos': {}}, open(OUT, 'w', encoding='utf-8'), indent=1)
        print('wrote EMPTY fallback file after error:', repr(e))
