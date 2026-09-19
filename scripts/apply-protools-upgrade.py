#!/usr/bin/env python3
"""Pro Tools upgrade for IPO Terminal (applied by workflow).

Idempotent. Adds two script tags to index.html:
  - scripts/ipo-sparkline.js  (GMP trend + forecast sparkline on cards, movers)
  - scripts/ipo-protools.js   (Pro Tools section: Track Record, My Apps,
                               Family Planner, Calendar)
Exits non-zero if the insertion point is missing.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, 'index.html')

TAGS = ('<script src="scripts/ipo-sparkline.js"></script>\n'
        '<script src="scripts/ipo-protools.js"></script>\n')


def main():
    src = open(IDX, encoding='utf-8').read()
    if 'scripts/ipo-protools.js' in src:
        print('skip: pro tools script tags already present')
        return
    if '</body>' not in src:
        print('FAILED: no </body>')
        sys.exit(1)
    src = src.replace('</body>', TAGS + '</body>', 1)
    open(IDX, 'w', encoding='utf-8').write(src)
    print('patched: pro tools script tags')


if __name__ == '__main__':
    main()
