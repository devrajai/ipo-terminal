#!/usr/bin/env python3
"""Open-IPO card cleanup: remove the GMP / RHP-DRHP / Allotment buttons
from open IPO cards in index.html (they stay available in the dedicated
GMP Live, Allotment and Why & Sources sections).
Idempotent: skips if already applied.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGET = ROOT / 'index.html'
src = TARGET.read_text(encoding='utf-8')

OLD_ACTIONS = "const actions=(!up&&!closed)?(gmpButton(x)+rhpButton(x)+allotButton(x)):'';"
NEW_ACTIONS = "const actions='';"

OLD_TIP = 'The RHP / DRHP button on every IPO card opens the document directly.'
NEW_TIP = 'The RHP / DRHP buttons in Pro Tools \u2192 Why & Sources open the document directly.'

if NEW_ACTIONS in src:
    print('card-fix already applied - nothing to do')
    sys.exit(0)

if OLD_ACTIONS not in src:
    raise SystemExit('actions line not found - aborting')

src = src.replace(OLD_ACTIONS, NEW_ACTIONS)

lines = src.split('\n')
kept = []
removed = 0
for ln in lines:
    s = ln.strip()
    if (s.startswith('function gmpButton(') or s.startswith('function rhpButton(')
            or s.startswith('function allotButton(')):
        removed += 1
        continue
    kept.append(ln)
src = '\n'.join(kept)

tip_fixed = 0
if OLD_TIP in src:
    src = src.replace(OLD_TIP, NEW_TIP)
    tip_fixed = 1

TARGET.write_text(src, encoding='utf-8')
print('card-fix applied: actions emptied, %d button functions removed, tip updated=%d' % (removed, tip_fixed))
if removed != 3:
    raise SystemExit('expected to remove 3 button functions, removed %d - aborting push' % removed)
