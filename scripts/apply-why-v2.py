#!/usr/bin/env python3
"""Apply Why-tab v2 (split rankings + real fundamentals + radar) to ipo-protools.js.

Replaces the whole tabWhy() function (and adds kf/whySignal/radarSvg helpers
just before it) with the content of scripts/why-v2-segment.js.
Idempotent: skips if already applied.
"""
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SEG = (ROOT / 'scripts' / 'why-v2-segment.js').read_text(encoding='utf-8')
TARGET = ROOT / 'scripts' / 'ipo-protools.js'

src = TARGET.read_text(encoding='utf-8')
if 'function whySignal(' in src:
    print('why-v2 already applied - nothing to do')
    sys.exit(0)

START = '  async function tabWhy(el) {'
END = '  const tabs = () =>'
i = src.index(START)
j = src.index(END)
if j < i:
    raise SystemExit('markers out of order - aborting')
out = src[:i] + SEG.rstrip('\n') + '\n\n' + src[j:]
if not SEG.rstrip('\n').endswith('}'):
    raise SystemExit('segment does not end with } - aborting')
TARGET.write_text(out, encoding='utf-8')
print('tabWhy v2 applied: replaced %d chars with %d' % (j - i, len(SEG)))
