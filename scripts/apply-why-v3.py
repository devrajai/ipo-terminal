#!/usr/bin/env python3
"""Apply Why-tab v3 (sub-tabs: Best picks / Compare all / How we score / Anchor books).

Replaces the previous why segment (from `function whySignal(` to `const tabs = () =>`)
in scripts/ipo-protools.js with scripts/why-v3-segment.js.
Idempotent: skips if already applied.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEG = (ROOT / 'scripts' / 'why-v3-segment.js').read_text(encoding='utf-8')
TARGET = ROOT / 'scripts' / 'ipo-protools.js'

src = TARGET.read_text(encoding='utf-8')
if "let whyView = 'rank';" in src:
    print('why-v3 already applied - nothing to do')
    sys.exit(0)

START = '  function whySignal(x, d) {'
END = '  const tabs = () =>'
try:
    i = src.index(START)
except ValueError:
    raise SystemExit('whySignal marker not found - aborting (is why-v2 applied?)')
try:
    j = src.index(END)
except ValueError:
    raise SystemExit('tabs marker not found - aborting')
if j < i:
    raise SystemExit('markers out of order - aborting')
out = src[:i] + SEG.rstrip('\n') + '\n\n' + src[j:]
if not SEG.rstrip('\n').endswith('}'):
    raise SystemExit('segment does not end with } - aborting')
TARGET.write_text(out, encoding='utf-8')
print('tabWhy v3 applied: replaced %d chars with %d' % (j - i, len(SEG)))
