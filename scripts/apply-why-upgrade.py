#!/usr/bin/env python3
"""Why & Sources upgrade (applied by workflow).

1. scripts/ipo-protools.js - adds a 5th Pro Tools tab "Why & Sources":
   - why the current IPOs are ranked 1-2-3 (live, computed, transparent)
   - how the 1L / 2L / 3L budget plans work
   - full list of data sources
2. index.html - nav CSS: Research & Tools buttons become a 2-row grid
   (3 on top, 2 below) of slightly bigger buttons - mobile friendly.
Idempotent; exits non-zero if anchors are missing.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PT = os.path.join(ROOT, 'scripts', 'ipo-protools.js')
IDX = os.path.join(ROOT, 'index.html')

NAV_CSS = ('<style id="nav-grid-css">#nav-tools.nav{display:grid !important;'
           'grid-template-columns:repeat(3,minmax(0,1fr)) !important;gap:8px !important;'
           'overflow:visible !important}#nav-tools.nav button{width:100% !important;'
           'min-height:46px !important;padding:11px 8px !important;font-size:12.5px !important;'
           'white-space:nowrap}</style>\n')

TABWHY = r'''  function tabWhy(el) {
    const rows = [];
    IPO.forEach(x => {
      if (!x || !x.name) return;
      const b = band(x.price);
      if (!b) return;
      rows.push({ x: x, b: b, gp: num(x.gmp_pct), cost: Math.round(b.hi * (num(x.lot) || 1)),
                  isSme: /sme/i.test(String(x.type || x.board || '')) });
    });
    rows.sort((a, b) => (b.gp == null ? -999 : b.gp) - (a.gp == null ? -999 : a.gp));
    const top = rows.filter(r => r.gp != null && r.gp > 0).slice(0, 3);
    let rank = '';
    if (top.length) {
      rank = '<table class="pt-tbl"><tr><th>Rank</th><th>IPO</th><th>1 lot</th><th>GMP</th><th>Main reason</th></tr>'
        + top.map((r, i) => '<tr><td><b>#' + (i + 1) + '</b></td><td>' + E(r.x.name) + '</td><td class="pt-mono">' + money(r.cost)
          + '</td><td class="pt-mono" style="color:' + (r.gp >= 25 ? '#22c55e' : '#fbbf24') + '">+' + r.gp + '%</td><td>'
          + (r.gp >= 25 ? 'GMP above the 25% bar - historically almost no such IPO listed at a loss'
                        : 'best available GMP of the currently open set')
          + (r.isSme ? ' (SME: 2 lots minimum)' : '') + '</td></tr>').join('') + '</table>';
    } else {
      rank = '<div class="pt-hint">Ranking appears as soon as open IPOs have live GMP quotes.</div>';
    }
    const buds = [100000, 200000, 300000].map(bud => {
      let left = bud;
      const picks = [];
      for (const r of top) {
        const c = r.isSme ? r.cost * 2 : r.cost;
        if (c <= left) { picks.push({ r: r, c: c }); left -= c; }
      }
      return { bud: bud, picks: picks, left: left };
    });
    const plan = '<table class="pt-tbl"><tr><th>If you have</th><th>What the plans suggest</th></tr>'
      + buds.map(b => '<tr><td class="pt-mono">' + money(b.bud) + '</td><td>'
        + (b.picks.length
           ? b.picks.map(p => '1 lot ' + E(p.r.x.name.replace(/ Limited$/, '')) + ' (' + money(p.c) + ')').join(' + ')
             + (b.left > 5000 ? ' + ' + money(b.left) + ' kept free' : '')
           : 'No top-ranked IPO fits this budget right now')
        + '</td></tr>').join('') + '</table>';
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-hint">Full transparency: this is exactly how the Coach, Decision and budget plans pick IPOs - computed live from data, nothing hand-picked.</div>'
      + '<h4 style="margin:4px 0 6px;font-size:14px">Why these IPOs are ranked 1-2-3</h4>'
      + '<div class="pt-hint">Ranking = GMP% first (the 25%+ bar from 5 years of listing data), then TimesFM forecast trend, then P/E vs peers, then SME risk. The order changes automatically as data changes.</div>'
      + rank
      + '<h4 style="margin:16px 0 6px;font-size:14px">How the \u20B91L / \u20B92L / \u20B93L budget plans work</h4>'
      + '<div class="pt-hint">Money is spread as 1 lot each across the top-ranked open IPOs (diversifying lottery entries), not stacked into one. More lots in the same category do not raise your chances - more family names do (Tip 27).</div>'
      + plan
      + '<h4 style="margin:16px 0 6px;font-size:14px">Our data sources</h4>'
      + '<div class="pt-hint">\u2022 <b>GMP, price bands, dates, subscriptions:</b> Chittorgarh.com, auto-scraped every 5 minutes.<br>'
      + '\u2022 <b>Daily GMP history:</b> our own log, built since 19 Sep 2026 (data/history.json).<br>'
      + '\u2022 <b>Forecasts:</b> Google TimesFM 3.0 model, running daily on GitHub Actions at 07:15 IST - accuracy published openly in Track Record.<br>'
      + '\u2022 <b>Selection & exit rules:</b> Anant Ladha\'s published research (Rule of 15 / Rule of 5, category odds, one-PAN rule).<br>'
      + '\u2022 <b>Documents:</b> RHP / DRHP from the exchanges - buttons on every IPO card.<br>'
      + 'Research heuristics for education - not investment advice. Verify in the RHP before applying.</div>';
  }

'''


def main():
    failed = []

    # --- 1) protools.js: add the Why & Sources tab ---
    src = open(PT, encoding='utf-8').read()
    if 'tabWhy' in src:
        print('skip: why tab already present')
    else:
        a1 = "['cal', '\\uD83D\\uDCC5 Calendar']]"
        a2 = '    else tabCal(el);'
        a3 = '  const tabs = () =>'
        for a, name in ((a1, 'tabs list'), (a2, 'render dispatch'), (a3, 'tabs fn')):
            if a not in src:
                failed.append('protools ' + name)
        if not failed:
            src = src.replace(a1, "['cal', '\\uD83D\\uDCC5 Calendar'], ['why', '\\u2753 Why & Sources']]", 1)
            src = src.replace(a2, "    else if (tab === 'why') tabWhy(el);\n" + a2, 1)
            src = src.replace(a3, TABWHY + a3, 1)
            open(PT, 'w', encoding='utf-8').write(src)
            print('patched: protools why tab')

    # --- 2) index.html: nav grid CSS (2 rows of 3 bigger buttons) ---
    idx = open(IDX, encoding='utf-8').read()
    if 'nav-grid-css' in idx:
        print('skip: nav grid css')
    elif '</head>' in idx:
        idx = idx.replace('</head>', NAV_CSS + '</head>', 1)
        open(IDX, 'w', encoding='utf-8').write(idx)
        print('patched: nav grid css')
    else:
        failed.append('nav css (no </head>)')

    if failed:
        print('FAILED:', failed)
        sys.exit(1)
    print('why & sources upgrade applied cleanly')


if __name__ == '__main__':
    main()
