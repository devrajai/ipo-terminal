#!/usr/bin/env python3
"""Full stock detail upgrade for the Why & Sources tab (applied by workflow).

Replaces the GMP-only tabWhy in scripts/ipo-protools.js with a full-detail
version: per-IPO selector, fundamentals with verdicts, anchor book summary,
live subscription (RII/NII/QIB), same-sector peers, and direct source links
(RHP PDF, Chittorgarh page, rules video, SEBI filings). Data comes from the
new data/ipo-details.json (scripts/fetch_ipodetails.py) plus existing fields.
Also adds perf CSS to index.html (smoother UI).

Idempotent; exits non-zero if anchors are missing.
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PT = os.path.join(ROOT, 'scripts', 'ipo-protools.js')
IDX = os.path.join(ROOT, 'index.html')

PERF_CSS = ('<style id="perf-css">html{scroll-behavior:smooth;-webkit-tap-highlight-color:transparent}'
            '#nav-tools.nav button{backdrop-filter:none;-webkit-backdrop-filter:none;'
            'box-shadow:0 6px 18px rgba(0,0,0,.18)}</style>\n')

NEWWHY = r'''  let DETAILS = null, detailsTried = false, whySel = null;

  async function ensureDetails() {
    if (detailsTried) return;
    detailsTried = true;
    try {
      DETAILS = await fetch('data/ipo-details.json?d=' + Date.now(), { cache: 'no-store' })
        .then(r => r.ok ? r.json() : null).catch(() => null);
    } catch (e) {}
  }

  function detailFor(name) {
    if (!DETAILS || !DETAILS.ipos) return null;
    const q = norm(name);
    for (const k of Object.keys(DETAILS.ipos)) {
      if (norm(k) === q || norm(k).includes(q) || q.includes(norm(k))) return DETAILS.ipos[k];
    }
    return null;
  }

  const chip = ok => ok == null
    ? '<span class="pt-chip" style="background:rgba(148,163,184,.13);color:#94a3b8">\u2014</span>'
    : (ok ? '<span class="pt-chip" style="background:rgba(34,197,94,.13);color:#22c55e">\u2713</span>'
          : '<span class="pt-chip" style="background:rgba(239,68,68,.13);color:#ef4444">\u2717</span>');
  const fnum = v => {
    const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };

  async function tabWhy(el) {
    await ensureDetails();
    const rows = [];
    IPO.forEach(x => {
      if (!x || !x.name) return;
      const b = band(x.price);
      if (!b) return;
      rows.push({ x: x, b: b, gp: num(x.gmp_pct), cost: Math.round(b.hi * (num(x.lot) || 1)),
                  isSme: /sme/i.test(String(x.type || x.board || '')) });
    });
    rows.sort((a, b) => (b.gp == null ? -999 : b.gp) - (a.gp == null ? -999 : a.gp));
    const selName = whySel && rows.find(r => r.x.name === whySel) ? whySel : (rows[0] ? rows[0].x.name : '');
    const r = rows.find(z => z.x.name === selName) || rows[0];
    let detail = '';
    if (r) {
      const x = r.x, d = detailFor(x.name) || {};
      const sub = d.subs || null;
      const anc = d.anchor || null;
      const sector = d.sector || x.sector;
      const peers = (d.peers && d.peers.length ? d.peers : null) || x.comparable_stocks || [];
      const rhp = x.rhp_url || x.drhp_url || x.prospectus_url || '';
      const pe = fnum(x.pe), roe = fnum(x.roe), roce = fnum(x.roce), de = fnum(x.de);
      const fund = '<table class="pt-tbl"><tr><th>Check</th><th>Value</th><th></th></tr>'
        + '<tr><td>Sector</td><td>' + E(sector || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
        + '<tr><td>P/E at issue price</td><td>' + E(x.pe || '\u2014') + '</td><td>' + chip(pe == null ? null : (pe > 0 && pe < 40)) + '</td></tr>'
        + '<tr><td>ROE</td><td>' + E(x.roe || '\u2014') + '</td><td>' + chip(roe == null ? null : roe >= 15) + '</td></tr>'
        + '<tr><td>ROCE</td><td>' + E(x.roce || '\u2014') + '</td><td>' + chip(roce == null ? null : roce >= 15) + '</td></tr>'
        + '<tr><td>Debt / Equity</td><td>' + E(x.de || '\u2014') + '</td><td>' + chip(de == null ? null : de <= 1) + '</td></tr>'
        + '<tr><td>Revenue (latest)</td><td>' + E(x.rev || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
        + '<tr><td>Profit (PAT, latest)</td><td>' + E(x.pat || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
        + '<tr><td>Promoter holding</td><td>' + E(x.prom || '\u2014') + '</td><td>' + chip(null) + '</td></tr></table>';
      let anchorHtml;
      if (anc && (anc.total_cr != null || anc.investors)) {
        const mfPct = (anc.mf_cr != null && anc.total_cr) ? Math.round(anc.mf_cr / anc.total_cr * 100) : null;
        anchorHtml = '<div class="pt-hint"><b>' + (anc.total_cr != null ? '\u20B9' + anc.total_cr + ' Cr' : '')
          + (anc.investors ? ' from ' + anc.investors + ' anchor investors' : '') + '</b>'
          + (anc.mf_cr != null ? ' \u2022 Mutual funds \u2248 \u20B9' + anc.mf_cr + ' Cr' + (mfPct != null ? ' (' + mfPct + '%)' : '') : '')
          + (anc.fii_cr != null ? ' \u2022 FIIs \u2248 \u20B9' + anc.fii_cr + ' Cr' : '') + '</div>'
          + '<div class="pt-hint">' + (mfPct != null && mfPct >= 40
             ? '<b style="color:#22c55e">Mutual-fund heavy anchor book \u2014 domestic institutions did their homework. Good sign.</b>'
             : 'Check the split: many Indian MF schemes plus marquee foreign funds = conviction (Tip 26, step 2).') + '</div>';
      } else {
        anchorHtml = '<div class="pt-hint">Anchor book details appear here once published and scraped (the day before the IPO opens).</div>';
      }
      let subHtml;
      if (sub && (sub.rii != null || sub.qib != null || sub.total != null)) {
        subHtml = '<div style="display:flex;gap:16px;flex-wrap:wrap;margin:6px 0">'
          + ['rii', 'nii', 'qib', 'total'].map(k => sub[k] != null
            ? '<div><div class="pt-hint" style="margin:0">' + ({ rii: 'Retail', nii: 'NII / HNI', qib: 'QIB', total: 'Total' })[k] + '</div><div class="pt-big" style="font-size:18px;color:' + (sub[k] >= 10 ? '#22c55e' : (sub[k] >= 2 ? '#fbbf24' : '#94a3b8')) + '">' + sub[k] + 'x</div></div>'
            : '').join('') + '</div>'
          + '<div class="pt-hint">QIB ' + (sub.qib != null && sub.qib >= 10 ? 'filling strongly \u2014 institutional conviction.' : 'still building \u2014 big institutions often commit in the final hours (Tip 26, step 5).') + '</div>';
      } else {
        subHtml = '<div class="pt-hint">Live subscription (Retail / HNI / QIB) fills in here during the IPO window.</div>';
      }
      let peersHtml = '';
      if (peers && peers.length) {
        peersHtml = '<h4 style="margin:16px 0 6px;font-size:13px">Same-sector peers</h4>'
          + '<table class="pt-tbl"><tr><th>Company</th><th>P/E</th></tr>'
          + peers.map(p => '<tr><td>' + E(p.name) + '</td><td class="pt-mono">' + E(p.pe || '\u2014') + '</td></tr>').join('')
          + '<tr><td><b>' + E(x.name.replace(/ Limited$/, '')) + ' (this IPO)</b></td><td class="pt-mono"><b>' + E(x.pe || '\u2014') + '</b></td></tr></table>'
          + '<div class="pt-hint">A good IPO prices ~20% cheaper than similar listed peers (Tip 26, step 4).</div>';
      }
      detail = '<h4 style="margin:4px 0 6px;font-size:14px">Full stock detail \u2014 ' + E(x.name) + '</h4>'
        + '<div class="pt-hint">' + E(x.type || 'Mainboard') + ' \u2022 1 lot \u2248 ' + money(r.cost)
        + ' \u2022 GMP ' + E(x.gmp_pct || '\u2014') + ' \u2022 closes ' + E(x.close || '\u2014') + '</div>'
        + '<h4 style="margin:10px 0 4px;font-size:13px">Fundamentals</h4>' + fund
        + '<h4 style="margin:16px 0 4px;font-size:13px">Anchor book (who invested the day before)</h4>' + anchorHtml
        + '<h4 style="margin:16px 0 4px;font-size:13px">Live subscription</h4>' + subHtml
        + peersHtml
        + '<h4 style="margin:16px 0 4px;font-size:13px">Direct sources</h4>'
        + '<div class="pt-hint" style="display:flex;gap:8px;flex-wrap:wrap">'
        + (rhp ? '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="' + E(rhp) + '">\uD83D\uDCC4 RHP / offer document</a>' : '')
        + (d.url ? '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="' + E(d.url) + '">\uD83D\uDD17 Chittorgarh page</a>' : '')
        + '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="https://youtu.be/W4VmJ8UaUjE">\uD83D\uDCFA Selection rules (video)</a>'
        + '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&smid=11&ssid=15">\uD83D\uDCE2 SEBI filings</a>'
        + '</div>';
    } else {
      detail = '<div class="pt-hint">No open IPOs with price bands right now \u2014 detail appears when the next IPO opens.</div>';
    }
    const selector = rows.length
      ? '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 10px">'
        + '<span class="pt-hint" style="margin:0">Inspect IPO:</span>'
        + '<select id="pt-why-select" class="pt-in" style="width:250px">'
        + rows.map((z, i) => '<option value="' + E(z.x.name) + '"' + (z.x.name === selName ? ' selected' : '') + '>'
          + E('#' + (i + 1) + ' \u00B7 ' + z.x.name) + '</option>').join('')
        + '</select></div>' : '';
    const top = rows.filter(z => z.gp != null && z.gp > 0).slice(0, 3);
    const buds = [100000, 200000, 300000].map(bud => {
      let left = bud;
      const picks = [];
      for (const z of top) {
        const c = z.isSme ? z.cost * 2 : z.cost;
        if (c <= left) { picks.push({ z: z, c: c }); left -= c; }
      }
      return { bud: bud, picks: picks, left: left };
    });
    const plan = '<table class="pt-tbl"><tr><th>If you have</th><th>What the plans suggest</th></tr>'
      + buds.map(b => '<tr><td class="pt-mono">' + money(b.bud) + '</td><td>'
        + (b.picks.length
           ? b.picks.map(p => '1 lot ' + E(p.z.x.name.replace(/ Limited$/, '')) + ' (' + money(p.c) + ')').join(' + ')
             + (b.left > 5000 ? ' + ' + money(b.left) + ' kept free' : '')
           : 'No top-ranked IPO fits this budget right now')
        + '</td></tr>').join('') + '</table>';
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-hint">Full transparency: how and why this site picks IPOs \u2014 with the underlying data and links.</div>'
      + selector + detail
      + '<h4 style="margin:18px 0 6px;font-size:14px">Why these IPOs are ranked 1-2-3</h4>'
      + '<div class="pt-hint">Ranking = GMP% first (the 25%+ bar from 5 years of listing data), then TimesFM forecast trend, then P/E vs peers, then SME risk.</div>'
      + (top.length
         ? '<table class="pt-tbl"><tr><th>Rank</th><th>IPO</th><th>1 lot</th><th>GMP</th></tr>'
           + top.map((z, i) => '<tr><td><b>#' + (i + 1) + '</b></td><td>' + E(z.x.name) + '</td><td class="pt-mono">' + money(z.cost)
             + '</td><td class="pt-mono" style="color:' + (z.gp >= 25 ? '#22c55e' : '#fbbf24') + '">+' + z.gp + '%</td></tr>').join('') + '</table>'
         : '<div class="pt-hint">Ranking appears as soon as open IPOs have live GMP quotes.</div>')
      + '<h4 style="margin:16px 0 6px;font-size:14px">How the \u20B91L / \u20B92L / \u20B93L budget plans work</h4>'
      + '<div class="pt-hint">Money is spread as 1 lot each across the top-ranked open IPOs \u2014 more family names, not more lots, raise your chances (Tip 27).</div>'
      + plan
      + '<h4 style="margin:16px 0 6px;font-size:14px">Our data sources</h4>'
      + '<div class="pt-hint">\u2022 <b>GMP, price bands, dates, subscriptions:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/">Chittorgarh GMP page</a>, auto-scraped every 5 minutes.<br>'
      + '\u2022 <b>Anchor book, peers, sector, live subscription:</b> each IPO\u2019s own Chittorgarh page (linked above per IPO), refreshed every 30 minutes.<br>'
      + '\u2022 <b>Daily GMP history:</b> our own log since 19 Sep 2026 (data/history.json).<br>'
      + '\u2022 <b>Forecasts:</b> Google TimesFM 3.0, daily 07:15 IST \u2014 accuracy published in Track Record.<br>'
      + '\u2022 <b>Selection & exit rules:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://youtu.be/W4VmJ8UaUjE">Anant Ladha\u2019s research</a> (Rule of 15 / Rule of 5, category odds, one-PAN rule).<br>'
      + '\u2022 <b>Offer documents:</b> RHP / DRHP from SEBI and exchanges \u2014 buttons on every IPO card.<br>'
      + 'Research heuristics for education \u2014 not investment advice.</div>';
    const s = el.querySelector('#pt-why-select');
    if (s) s.onchange = () => { whySel = s.value; tabWhy(el); };
  }

'''


def main():
    failed = []

    src = open(PT, encoding='utf-8').read()
    if 'ensureDetails' in src:
        print('skip: full detail tab already present')
    else:
        start = '  function tabWhy(el) {'
        end = '  const tabs = () =>'
        i = src.find(start)
        j = src.find(end, i if i >= 0 else 0)
        if i < 0 or j < 0:
            failed.append('protools tabWhy anchors')
        else:
            src = src[:i] + NEWWHY + src[j:]
            open(PT, 'w', encoding='utf-8').write(src)
            print('patched: protools full detail tab')

    idx = open(IDX, encoding='utf-8').read()
    if 'perf-css' in idx:
        print('skip: perf css')
    elif '</head>' in idx:
        idx = idx.replace('</head>', PERF_CSS + '</head>', 1)
        open(IDX, 'w', encoding='utf-8').write(idx)
        print('patched: perf css')
    else:
        failed.append('perf css (no </head>)')

    if failed:
        print('FAILED:', failed)
        sys.exit(1)
    print('full detail upgrade applied cleanly')


if __name__ == '__main__':
    main()
