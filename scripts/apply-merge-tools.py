#!/usr/bin/env python3
"""Merge Decision + Coach + Pro Tools into one Smart Tools button:
adds scripts/merge-tools.js to index.html (loaded last).
Idempotent.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'index.html'
src = TARGET.read_text(encoding='utf-8')

ANCHOR = '<script src="scripts/ipo-protools.js"></script>'
TAG = '<script src="scripts/merge-tools.js"></script>'

if TAG in src:
    print('merge-tools already wired - nothing to do')
    sys.exit(0)

if ANCHOR not in src:
    raise SystemExit('protools script tag not found - aborting')

src = src.replace(ANCHOR, ANCHOR + TAG, 1)
TARGET.write_text(src, encoding='utf-8')
print('merge-tools script tag added after protools')
