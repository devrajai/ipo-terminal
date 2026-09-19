  let whyView = 'rank';

  function whySignal(x, d) {
    const kpi = d.kpi || {};
    const roe = kf(kpi.roe) != null ? kf(kpi.roe) : fnum(x.roe);
    const roce = kf(kpi.roce) != null ? kf(kpi.roce) : fnum(x.roce);
    const de = kf(kpi.de) != null ? kf(kpi.de) : fnum(x.de);
    const g = fnum(x.growth) != null ? fnum(x.growth) : (d.rev_growth != null ? d.rev_growth : null);
    const pe = fnum(x.pe);
    const sub = fnum(x.sub) != null ? fnum(x.sub) : ((d.subs && d.subs.total != null) ? d.subs.total : null);
    let gp = fnum(x.gmp_pct);
    if (!(gp != null && gp >= -50 && gp <= 100)) gp = null;
    const lanes = { business: 50, valuation: 50, demand: 50, gmp: 50, structure: 50 };
    const why = [];
    if (g != null) { lanes.business = g >= 20 ? 90 : g >= 12 ? 78 : g >= 5 ? 62 : 38; if (g >= 12) why.push('fast revenue growth'); }
    if (roe != null || roce != null) { const rr = Math.max(roe || 0, roce || 0); lanes.business = Math.round((lanes.business + Math.min(rr, 45) * 1.6) / 2); if (rr >= 15) why.push('strong return ratios'); }
    if (pe != null && pe > 0 && pe < 100) { lanes.valuation = pe <= 20 ? 82 : pe <= 35 ? 62 : pe <= 50 ? 38 : 22; if (pe > 35) why.push('rich P/E'); }
    if (sub != null) { lanes.demand = sub >= 50 ? 95 : sub >= 20 ? 82 : sub >= 10 ? 70 : sub >= 3 ? 58 : sub < 1 ? 25 : 45; if (sub >= 10) why.push('strong subscription'); }
    if (gp != null) { lanes.gmp = gp >= 20 ? 90 : gp >= 10 ? 75 : gp >= 5 ? 68 : gp >= 0 ? 60 : 25; if (gp >= 10) why.push('positive GMP'); }
    if (de != null) { lanes.structure = de <= .3 ? 85 : de <= .6 ? 70 : de <= 1 ? 55 : 30; if (de > 1) why.push('high debt - check'); }
    const score = Math.round((lanes.business + lanes.valuation + lanes.demand + lanes.gmp + lanes.structure) / 5);
    const conflict = [];
    if (lanes.demand >= 75 && lanes.valuation <= 45) conflict.push('Demand strong but valuation stretched');
    if (lanes.gmp >= 75 && lanes.business <= 45) conflict.push('GMP ahead of business evidence');
    if (lanes.demand <= 35 && lanes.gmp >= 75) conflict.push('GMP and subscription disagree');
    const pm = kf(kpi.pat_margin), em = kf(kpi.ebitda_margin);
    if (pm != null && em != null && em - pm > 15) conflict.push('EBITDA margin ' + em + '% but PAT margin only ' + pm + '% - heavy interest/depreciation drag, check use of proceeds');
    return { score: score, lanes: lanes, why: why, conflict: conflict };
  }

  function radarSvg(s) {
    const L = [['Business', s.lanes.business], ['Valuation', s.lanes.valuation], ['Demand', s.lanes.demand], ['GMP', s.lanes.gmp], ['Structure', s.lanes.structure]];
    const cx = 100, cy = 90, R = 60;
    const pt = (i, f) => { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f]; };
    let svg = '<svg viewBox="0 0 200 190" style="width:100%;max-width:240px;display:block;margin:0 auto">';
    [0.25, 0.5, 0.75, 1].forEach(function (f) {
      svg += '<polygon points="' + [0, 1, 2, 3, 4].map(function (i) { return pt(i, f).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ') + '" fill="none" stroke="rgba(148,163,184,.22)" stroke-width="1"/>';
    });
    [0, 1, 2, 3, 4].forEach(function (i) { const p = pt(i, 1); svg += '<line x1="' + cx + '" y1="' + cy + '" x2="' + p[0].toFixed(1) + '" y2="' + p[1].toFixed(1) + '" stroke="rgba(148,163,184,.22)" stroke-width="1"/>'; });
    svg += '<polygon points="' + L.map(function (l, i) { return pt(i, Math.max(l[1], 3) / 100).map(function (v) { return v.toFixed(1); }).join(','); }).join(' ') + '" fill="rgba(59,130,246,.30)" stroke="#3b82f6" stroke-width="1.8"/>';
    L.forEach(function (l, i) { const p = pt(i, Math.max(l[1], 3) / 100); svg += '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3" fill="#93c5fd"/>'; });
    L.forEach(function (l, i) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      const lx = cx + Math.cos(a) * (R + 22), ly = cy + Math.sin(a) * (R + 22);
      svg += '<text x="' + lx.toFixed(1) + '" y="' + (ly + 3).toFixed(1) + '" text-anchor="middle" font-size="9.5" fill="#cbd5e1">' + l[0] + ' <tspan font-weight="700" fill="#e2e8f0">' + l[1] + '</tspan></text>';
    });
    return svg + '</svg>';
  }

  function laneChips(s) {
    const L = [['B', 'Business', s.lanes.business], ['V', 'Valuation', s.lanes.valuation], ['D', 'Demand', s.lanes.demand], ['G', 'GMP', s.lanes.gmp], ['S', 'Structure', s.lanes.structure]];
    return '<span style="white-space:nowrap">' + L.map(function (l) {
      const c = l[2] >= 70 ? '#22c55e' : l[2] >= 50 ? '#fbbf24' : '#ef4444';
      return '<span title="' + l[1] + ' ' + l[2] + '/100" style="display:inline-block;min-width:26px;text-align:center;margin:1px 2px 1px 0;padding:2px 3px;border-radius:6px;font-size:9.5px;font-weight:800;background:rgba(148,163,184,.10);color:' + c + '">' + l[0] + l[2] + '</span>';
    }).join('') + '</span>';
  }

  function howScoreHtml(r) {
    let worked = '';
    if (r) {
      const x = r.x, d = detailFor(x.name) || {}, kpi = d.kpi || {}, s = r.sig;
      const roe = kf(kpi.roe) != null ? kf(kpi.roe) : fnum(x.roe);
      const g = fnum(x.growth) != null ? fnum(x.growth) : d.rev_growth;
      const pe = fnum(x.pe), de = kf(kpi.de) != null ? kf(kpi.de) : fnum(x.de);
      const sub = (d.subs && d.subs.total != null) ? d.subs.total : fnum(x.sub);
      const row = function (lane, label, raw, pts) {
        return '<tr><td><b>' + lane + '</b> \u00B7 ' + label + '</td><td class="pt-mono">' + (raw == null ? 'missing \u2192 50' : raw) + '</td><td class="pt-mono"><b>' + pts + '</b>/100</td></tr>';
      };
      worked = '<h4 style="margin:16px 0 6px;font-size:13px">Worked example \u2014 ' + E(x.name) + ' (live numbers right now)</h4>'
        + '<table class="pt-tbl"><tr><th>Lane</th><th>Input data</th><th>Lane score</th></tr>'
        + row('B', 'revenue growth ' + (g != null ? g + '%' : '\u2014') + ' \u00B7 ROE ' + (roe != null ? roe + '%' : '\u2014'), (g != null ? g + '% growth, ' : '') + (roe != null ? roe + '% ROE' : ''), s.lanes.business)
        + row('V', 'P/E at issue ' + (pe != null ? pe : '\u2014'), pe != null ? 'P/E ' + pe : null, s.lanes.valuation)
        + row('D', 'subscription ' + (sub != null ? sub + 'x' : '\u2014'), sub != null ? sub + 'x' : null, s.lanes.demand)
        + row('G', 'GMP ' + (r.gp != null ? r.gp + '%' : '\u2014'), r.gp != null ? r.gp + '%' : null, s.lanes.gmp)
        + row('S', 'debt/equity ' + (de != null ? de : '\u2014'), de != null ? 'D/E ' + de : null, s.lanes.structure)
        + '<tr><td colspan="2"><b>Evidence score = average of the 5 lanes</b></td><td class="pt-mono"><b style="color:' + (s.score >= 70 ? '#22c55e' : s.score >= 50 ? '#fbbf24' : '#ef4444') + '">' + s.score + '/100</b></td></tr></table>'
        + '<div class="pt-hint">Every number above comes from the same offer-document tables you can open yourself \u2014 nothing is typed by hand. When a value is missing the lane stays neutral at 50; it is never guessed.</div>';
    }
    return '<h4 style="margin:4px 0 6px;font-size:14px">How the evidence score is calculated \u2014 the exact maths</h4>'
      + '<div class="pt-hint">Each of the 5 lanes scores 0\u2013100, then the evidence score is their plain average. Same maths for every IPO \u2014 no manual overrides.</div>'
      + '<table class="pt-tbl"><tr><th>Lane</th><th>What it measures</th><th>Points rule (0\u2013100)</th><th>Source</th></tr>'
      + '<tr><td><b>Business</b></td><td>Revenue growth + return ratios (quality of the company)</td><td class="pt-mono">growth \u226520%\u219290 \u00B7 \u226512%\u219278 \u00B7 \u22655%\u219262 \u00B7 else 38; then blended with max(ROE,ROCE)\u00D71.6 (capped 45)</td><td>RHP financials \u00B7 KPI table</td></tr>'
      + '<tr><td><b>Valuation</b></td><td>Price you pay (P/E at issue price)</td><td class="pt-mono">P/E \u226420\u219282 \u00B7 \u226435\u219262 \u00B7 \u226450\u219238 \u00B7 else 22</td><td>RHP / issue price</td></tr>'
      + '<tr><td><b>Demand</b></td><td>Live subscription (how many times oversubscribed)</td><td class="pt-mono">\u226550x\u219295 \u00B7 \u226520x\u219282 \u00B7 \u226510x\u219270 \u00B7 \u22653x\u219258 \u00B7 <1x\u219225</td><td>Live subscription feed</td></tr>'
      + '<tr><td><b>GMP</b></td><td>Grey-market premium (unofficial sentiment)</td><td class="pt-mono">\u226520%\u219290 \u00B7 \u226510%\u219275 \u00B7 \u22655%\u219268 \u00B7 \u22650\u219260 \u00B7 <0\u219225</td><td>GMP feed (every 5 min)</td></tr>'
      + '<tr><td><b>Structure</b></td><td>Debt on the balance sheet (D/E)</td><td class="pt-mono">\u22640.3\u219285 \u00B7 \u22640.6\u219270 \u00B7 \u22641\u219255 \u00B7 else 30</td><td>RHP financials</td></tr>'
      + '<tr><td colspan="4" style="font-size:10px;color:var(--tx3)">Missing data \u2192 lane = neutral 50. A data gap never becomes a fake plus or minus. Red-flag checks run on top: EBITDA margin vs PAT margin gap > 15 points \u21D2 flagged (heavy interest/depreciation drag); demand vs valuation and GMP vs business disagreements are listed, not averaged away.</td></tr></table>'
      + worked
      + '<h4 style="margin:16px 0 6px;font-size:13px">What we check from the RHP before trusting any IPO (analyst checklist)</h4>'
      + '<table class="pt-tbl"><tr><th>Check</th><th>Good sign</th><th>Warning sign</th></tr>'
      + '<tr><td>Use of proceeds</td><td>Fresh money funds capex / growth</td><td>Mostly loan repayment \u2014 the IPO mainly deleverages old shareholders</td></tr>'
      + '<tr><td>Revenue & PAT trend</td><td>Consistent multi-year growth</td><td>Profit appearing only in the year before filing</td></tr>'
      + '<tr><td>Margins</td><td>PAT margin close to EBITDA margin</td><td>Big gap \u2192 interest/depreciation eats profit</td></tr>'
      + '<tr><td>ROE / ROCE</td><td>\u226515% both</td><td>Single digits</td></tr>'
      + '<tr><td>P/E vs listed peers</td><td>IPO prices ~20% cheaper</td><td>More expensive than peers with weaker growth</td></tr>'
      + '<tr><td>Promoter stake</td><td>\u226550% and staying</td><td>Heavy selling / low post-issue stake</td></tr>'
      + '<tr><td>Anchor book</td><td>Many Indian MF schemes + marquee foreign funds</td><td>Only a few unknown anchors</td></tr>'
      + '<tr><td>OFS share</td><td>Mostly fresh issue</td><td>OFS > 50% \u2014 why are insiders exiting?</td></tr></table>'
      + '<div class="pt-hint">Methodology follows a SEBI-registered analyst\u2019s public IPO-review checklist (see the Selection rules video in Direct sources). Education and research only \u2014 not investment advice.</div>';
  }

  function compareTableHtml(scored) {
    if (!scored.length) return '<div class="pt-hint">No open IPOs right now.</div>';
    const rows = scored.map(function (z) {
      const x = z.x, d = detailFor(x.name) || {}, kpi = d.kpi || {};
      const roe = kf(kpi.roe) != null ? kf(kpi.roe) : fnum(x.roe);
      const de = kf(kpi.de) != null ? kf(kpi.de) : fnum(x.de);
      const pe = fnum(x.pe);
      const sub = (d.subs && d.subs.total != null) ? d.subs.total : fnum(x.sub);
      const g = fnum(x.growth) != null ? fnum(x.growth) : d.rev_growth;
      const sector = d.sector || x.sector || '\u2014';
      const cell = v => v == null ? '\u2014' : v;
      const flag = (z.sig.conflict && z.sig.conflict.length) ? '<span style="color:#fbbf24" title="' + E(z.sig.conflict.join(' \u00B7 ')) + '">\u26A0</span>' : '';
      return '<tr><td><b>' + E(x.name.replace(/ Limited$/, '')) + '</b>' + (z.isSme ? ' <span style="font-size:9px;padding:1px 5px;border-radius:5px;background:rgba(168,85,247,.15);color:#c084fc">SME</span>' : '')
        + '<br><span style="font-size:9.5px;color:var(--tx3)">' + E(String(sector).slice(0, 28)) + '</span></td>'
        + '<td class="pt-mono" style="color:' + (g == null ? '#94a3b8' : g >= 15 ? '#22c55e' : g >= 0 ? '#fbbf24' : '#ef4444') + '">' + cell(g != null ? g + '%' : null) + '</td>'
        + '<td class="pt-mono">' + cell(roe != null ? roe + '%' : null) + '</td>'
        + '<td class="pt-mono">' + cell(pe) + '</td>'
        + '<td class="pt-mono">' + cell(de) + '</td>'
        + '<td class="pt-mono">' + cell(d.promoter_pct != null ? d.promoter_pct + '%' : (fnum(x.prom) != null ? x.prom : null)) + '</td>'
        + '<td class="pt-mono">' + cell(z.gp != null ? z.gp + '%' : null) + '</td>'
        + '<td class="pt-mono">' + cell(sub != null ? sub + 'x' : null) + '</td>'
        + '<td class="pt-mono"><b style="color:' + (z.sig.score >= 70 ? '#22c55e' : z.sig.score >= 50 ? '#fbbf24' : '#ef4444') + '">' + z.sig.score + '</b>' + flag + '</td>'
        + '<td>' + laneChips(z.sig) + '</td></tr>';
    }).join('');
    return '<div class="pt-hint">Every open IPO side by side \u2014 same columns, same maths, sorted by evidence score. \u26A0 = a red-flag conflict is flagged (hover to read). Green = good, amber = watch, red = concern.</div>'
      + '<div style="overflow-x:auto"><table class="pt-tbl"><tr><th>IPO</th><th>Rev growth</th><th>ROE</th><th>P/E</th><th>D/E</th><th>Promoter</th><th>GMP</th><th>Sub</th><th>Score</th><th>Lanes B\u00B7V\u00B7D\u00B7G\u00B7S</th></tr>' + rows + '</table></div>'
      + '<div class="pt-hint">B = Business (growth+ROE) \u00B7 V = Valuation (P/E) \u00B7 D = Demand (subscription) \u00B7 G = grey-market premium \u00B7 S = Structure (debt). Open the Best-picks tab and pick any IPO to see its full RHP financials, anchor book and sources.</div>';
  }

  function anchorTableHtml(scored) {
    const withAnc = scored.filter(function (z) { const a = (detailFor(z.x.name) || {}).anchor; return a && (a.total_cr != null || a.investors); });
    if (!withAnc.length) return '<div class="pt-hint">No anchor books published for the currently open IPOs yet. Anchor books appear here the day before an IPO opens (auto-scraped every 30 minutes).</div>';
    const rows = withAnc.map(function (z) {
      const a = (detailFor(z.x.name) || {}).anchor;
      const mfPct = (a.mf_cr != null && a.total_cr) ? Math.round(a.mf_cr / a.total_cr * 100) : null;
      const verdict = mfPct != null && mfPct >= 40 ? '<b style="color:#22c55e">MF-heavy \u2014 conviction</b>' : mfPct != null ? 'Mixed \u2014 check the split' : 'Split not published';
      return '<tr><td><b>' + E(z.x.name.replace(/ Limited$/, '')) + '</b></td>'
        + '<td class="pt-mono">' + (a.total_cr != null ? '\u20B9' + a.total_cr + ' Cr' : '\u2014') + '</td>'
        + '<td class="pt-mono">' + (a.investors || '\u2014') + '</td>'
        + '<td class="pt-mono">' + (a.mf_cr != null ? '\u20B9' + a.mf_cr + ' Cr' + (mfPct != null ? ' (' + mfPct + '%)' : '') : '\u2014') + '</td>'
        + '<td class="pt-mono">' + (a.fii_cr != null ? '\u20B9' + a.fii_cr + ' Cr' : '\u2014') + '</td>'
        + '<td style="font-size:10px">' + verdict + '</td></tr>';
    }).join('');
    return '<div class="pt-hint">The anchor book is built one day before the IPO opens \u2014 it shows which institutions committed real money. The best signal: many Indian mutual-fund schemes plus marquee foreign funds (Tip 26, step 2).</div>'
      + '<div style="overflow-x:auto"><table class="pt-tbl"><tr><th>IPO</th><th>Anchor total</th><th>Investors</th><th>Mutual funds</th><th>FIIs</th><th>Read</th></tr>' + rows + '</table></div>';
  }

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
    const scored = rows.map(function (z) { z.sig = whySignal(z.x, detailFor(z.x.name) || {}); return z; })
      .sort(function (a, b) { return b.sig.score - a.sig.score; });
    const selName = whySel && scored.find(r => r.x.name === whySel) ? whySel : (scored[0] ? scored[0].x.name : '');
    const r = scored.find(z => z.x.name === selName) || scored[0];
    let detail = '';
    if (r) {
      const x = r.x, d = detailFor(x.name) || {}, s = r.sig;
      const sub = d.subs || null;
      const anc = d.anchor || null;
      const sector = d.sector || x.sector;
      const peers = (d.peers && d.peers.length ? d.peers : null) || x.comparable_stocks || [];
      const rhp = x.rhp_url || x.drhp_url || x.prospectus_url || '';
      const pe = fnum(x.pe), roe = fnum(x.roe), roce = fnum(x.roce), de = fnum(x.de);
      let fund;
      const fin = d.fin;
      if (fin && fin.periods && fin.income) {
        const cols = [];
        fin.periods.forEach(function (p, i) { if (/mar/i.test(p) && cols.length < 3) cols.push(i); });
        if (!cols.length) fin.periods.forEach(function (p, i) { if (cols.length < 3) cols.push(i); });
        const fmt = function (v) { return v == null ? '\u2014' : '\u20B9' + v + ' Cr'; };
        const frow = function (label, key) {
          return '<tr><td>' + label + '</td>' + cols.map(function (i) { return '<td class="pt-mono">' + fmt(fin[key] ? fin[key][i] : null) + '</td>'; }).join('') + '</tr>';
        };
        const gr = function (v) {
          return v == null ? '<span style="color:#94a3b8">\u2014</span>'
            : '<span style="color:' + (v >= 0 ? '#22c55e' : '#ef4444') + ';font-weight:700">' + (v >= 0 ? '\u2191 ' : '\u2193 ') + Math.abs(Math.round(v)) + '%</span>';
        };
        fund = '<div class="pt-hint">Real numbers from the company\u2019s restated consolidated financials in the offer document (\u20B9 crore).</div>'
          + '<table class="pt-tbl"><tr><th>Year</th>' + cols.map(function (i) { return '<th>' + E(String(fin.periods[i]).replace(/^\d+\s/, '').replace(/20(\d\d)/, '\'$1')) + '</th>'; }).join('') + '</tr>'
          + frow('Revenue', 'income') + frow('Profit (PAT)', 'pat') + frow('EBITDA', 'ebitda') + frow('Net worth', 'networth')
          + '<tr><td>YoY growth</td><td colspan="' + cols.length + '">' + gr(d.rev_growth) + ' revenue \u00B7 ' + gr(d.pat_growth) + ' profit</td></tr></table>';
        const k = d.kpi || {};
        const chips = [];
        if (k.roe) chips.push(['ROE', k.roe, kf(k.roe) >= 15]);
        if (k.roce) chips.push(['ROCE', k.roce, kf(k.roce) >= 15]);
        if (k.de) chips.push(['Debt / Equity', k.de, kf(k.de) <= 1]);
        if (k.pat_margin) chips.push(['PAT margin', k.pat_margin, null]);
        if (k.ebitda_margin) chips.push(['EBITDA margin', k.ebitda_margin, null]);
        if (d.promoter_pct != null) chips.push(['Promoter holding', d.promoter_pct + '%', d.promoter_pct >= 50]);
        if (pe != null && pe > 0 && pe < 100) chips.push(['P/E at issue', x.pe, pe <= 35]);
        fund += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">'
          + chips.map(function (c) {
              return '<span style="padding:5px 10px;border-radius:8px;font-size:11px;background:' + (c[2] == null ? 'rgba(148,163,184,.13);color:#cbd5e1' : (c[2] ? 'rgba(34,197,94,.13);color:#22c55e' : 'rgba(239,68,68,.13);color:#ef4444')) + '">' + c[0] + ' <b>' + E(String(c[1])) + '</b></span>';
            }).join('') + '</div>';
      } else {
        fund = '<table class="pt-tbl"><tr><th>Check</th><th>Value</th><th></th></tr>'
          + '<tr><td>Sector</td><td>' + E(sector || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
          + '<tr><td>P/E at issue price</td><td>' + E(x.pe || '\u2014') + '</td><td>' + chip(pe == null ? null : (pe > 0 && pe < 40)) + '</td></tr>'
          + '<tr><td>ROE</td><td>' + E(x.roe || '\u2014') + '</td><td>' + chip(roe == null ? null : roe >= 15) + '</td></tr>'
          + '<tr><td>ROCE</td><td>' + E(x.roce || '\u2014') + '</td><td>' + chip(roce == null ? null : roce >= 15) + '</td></tr>'
          + '<tr><td>Debt / Equity</td><td>' + E(x.de || '\u2014') + '</td><td>' + chip(de == null ? null : de <= 1) + '</td></tr>'
          + '<tr><td>Revenue (latest)</td><td>' + E(x.rev || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
          + '<tr><td>Profit (PAT, latest)</td><td>' + E(x.pat || '\u2014') + '</td><td>' + chip(null) + '</td></tr>'
          + '<tr><td>Promoter holding</td><td>' + E(x.prom || '\u2014') + '</td><td>' + chip(null) + '</td></tr></table>'
          + '<div class="pt-hint">Full financials appear here as soon as the offer document page is located (auto-retry every 30 min).</div>';
      }
      const radarHtml = '<div style="display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:8px 0 2px;background:var(--card2);border:1px solid var(--bd);border-radius:12px;padding:10px">'
        + '<div style="flex:0 0 190px;max-width:230px">' + radarSvg(s) + '</div>'
        + '<div style="flex:1;min-width:210px">'
        + '<div class="pt-big" style="font-size:20px">Evidence score <b style="color:' + (s.score >= 70 ? '#22c55e' : s.score >= 50 ? '#fbbf24' : '#ef4444') + '">' + s.score + '/100</b></div>'
        + '<div style="margin:5px 0">' + laneChips(s) + '<span class="pt-hint" style="margin-left:6px">B business \u00B7 V valuation \u00B7 D demand \u00B7 G GMP \u00B7 S structure</span></div>'
        + '<div class="pt-hint"><b>Why:</b> ' + E(s.why.length ? s.why.join(' \u00B7 ') : 'not enough evidence yet') + '</div>'
        + (s.conflict.length ? '<div class="pt-hint" style="color:#fbbf24"><b>Check:</b> ' + E(s.conflict.join(' \u00B7 ')) + '</div>' : '')
        + '<div class="pt-hint">Full maths: see the <b>How we score</b> tab above \u2014 exact thresholds, no manual overrides.</div>'
        + '</div></div>';
      let anchorHtml;
      if (anc && (anc.total_cr != null || anc.investors)) {
        const mfPct = (anc.mf_cr != null && anc.total_cr) ? Math.round(anc.mf_cr / anc.total_cr * 100) : null;
        anchorHtml = '<div class="pt-hint"><b>' + (anc.total_cr != null ? '\u20B9' + anc.total_cr + ' Cr' : '')
          + (anc.investors ? ' from ' + anc.investors + ' anchor investors' : '') + '</b>'
          + (anc.mf_cr != null ? ' \u00B7 Mutual funds \u2248 \u20B9' + anc.mf_cr + ' Cr' + (mfPct != null ? ' (' + mfPct + '%)' : '') : '')
          + (anc.fii_cr != null ? ' \u00B7 FIIs \u2248 \u20B9' + anc.fii_cr + ' Cr' : '') + '</div>'
          + '<div class="pt-hint">' + (mfPct != null && mfPct >= 40
             ? '<b style="color:#22c55e">Mutual-fund heavy anchor book \u2014 domestic institutions did their homework. Good sign.</b>'
             : 'Check the split: many Indian MF schemes plus marquee foreign funds = conviction (Tip 26, step 2).') + '</div>';
      } else {
        anchorHtml = '<div class="pt-hint">Anchor book details appear here once published and scraped (the day before the IPO opens). All open anchor books: <b>Anchor books</b> tab above.</div>';
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
        + '<div class="pt-hint">' + E(x.type || 'Mainboard') + ' \u00B7 1 lot \u2248 ' + money(r.cost)
        + ' \u00B7 GMP ' + E(x.gmp_pct || '\u2014') + ' \u00B7 closes ' + E(x.close || '\u2014') + '</div>'
        + radarHtml
        + '<h4 style="margin:12px 0 4px;font-size:13px">Fundamentals (from the RHP)</h4>' + fund
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
    const selector = scored.length
      ? '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 10px">'
        + '<span class="pt-hint" style="margin:0">Inspect IPO:</span>'
        + '<select id="pt-why-select" class="pt-in" style="width:250px">'
        + scored.map(function (z, i) { return '<option value="' + E(z.x.name) + '"' + (z.x.name === selName ? ' selected' : '') + '>'
          + E('#' + (i + 1) + ' \u00B7 ' + z.x.name) + '</option>'; }).join('')
        + '</select></div>' : '';
    const mb = scored.filter(z => !z.isSme).slice(0, 3);
    const sme = scored.filter(z => z.isSme).slice(0, 3);
    const rankTable = function (list) {
      if (!list.length) return '<div class="pt-hint">None open right now.</div>';
      return '<table class="pt-tbl"><tr><th>Rank</th><th>IPO</th><th>1 lot</th><th>GMP</th><th>Score</th><th>Lanes</th><th>Why</th></tr>'
        + list.map(function (z, i) {
            return '<tr><td><b>#' + (i + 1) + '</b></td><td>' + E(z.x.name.replace(/ Limited$/, '')) + '</td><td class="pt-mono">' + money(z.cost) + '</td>'
              + '<td class="pt-mono" style="color:' + (z.gp >= 25 ? '#22c55e' : z.gp != null && z.gp > 0 ? '#fbbf24' : '#94a3b8') + '">' + (z.gp != null && z.gp > 0 ? '+' + z.gp + '%' : '\u2014') + '</td>'
              + '<td class="pt-mono"><b style="color:' + (z.sig.score >= 70 ? '#22c55e' : z.sig.score >= 50 ? '#fbbf24' : '#ef4444') + '">' + z.sig.score + '</b></td>'
              + '<td>' + laneChips(z.sig) + '</td>'
              + '<td style="font-size:10px;color:var(--tx3)">' + E(z.sig.why.length ? z.sig.why.slice(0, 2).join(' \u00B7 ') : 'evidence building') + '</td></tr>';
          }).join('') + '</table>';
    };
    const top = scored.slice(0, 6);
    const buds = [100000, 200000, 300000].map(bud => {
      let left = bud;
      const picks = [];
      for (const z of top) {
        const c = z.isSme ? z.cost * 2 : z.cost;
        if (c <= left) { picks.push({ z: z, c: c }); left -= c; }
      }
      return { bud: bud, picks: picks, left: left };
    });
    const plan = '<table class="pt-tbl"><tr><th>Budget</th><th>Plan (1 lot each, top-ranked first)</th></tr>'
      + buds.map(b => '<tr><td class="pt-mono">' + money(b.bud) + '</td><td>' + (b.picks.length
        ? b.picks.map(p => E(p.z.x.name.replace(/ Limited$/, '')) + ' (' + money(p.c) + ')').join(' + ')
           + (b.left > 5000 ? ' + ' + money(b.left) + ' kept free' : '')
           : 'No top-ranked IPO fits this budget right now')
        + '</td></tr>').join('') + '</table>';
    const views = {
      rank: '<div class="pt-hint">Full transparency: how and why this site picks IPOs \u2014 with the underlying data and links.</div>'
        + selector + detail
        + '<h4 style="margin:18px 0 6px;font-size:14px">Best 3 \u2014 Mainboard</h4>'
        + '<div class="pt-hint">Ranked by evidence score (growth + ROE + valuation + subscription + GMP + debt), not just GMP.</div>'
        + rankTable(mb)
        + '<h4 style="margin:16px 0 6px;font-size:14px">Best 3 \u2014 SME</h4>'
        + '<div class="pt-hint">SME IPOs are judged separately: smaller companies, higher risk \u2014 compare within the category only (Tip 26, step 1).</div>'
        + rankTable(sme)
        + '<h4 style="margin:16px 0 6px;font-size:14px">How the \u20B91L / \u20B92L / \u20B93L budget plans work</h4>'
        + '<div class="pt-hint">Money is spread as 1 lot each across the top-ranked open IPOs \u2014 more family names, not more lots, raise your chances (Tip 27). SME entries use 2 lots (minimum \u20b92L for HNI odds).</div>'
        + plan,
      compare: compareTableHtml(scored),
      how: howScoreHtml(r),
      anchor: anchorTableHtml(scored)
    };
    const viewBar = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px;padding:8px;background:var(--card2);border:1px solid var(--bd);border-radius:12px">'
      + [['rank', '\uD83C\uDFC6 Best picks'], ['compare', '\u2696\uFE0F Compare all'], ['how', '\uD83E\uDDEE How we score'], ['anchor', '\u2693 Anchor books']].map(function (v) {
          return '<button type="button" data-whyview="' + v[0] + '" style="padding:7px 13px;border-radius:9px;border:1px solid ' + (whyView === v[0] ? 'rgba(59,130,246,.55);background:rgba(59,130,246,.15);color:#93c5fd;font-weight:800' : 'var(--bd);background:transparent;color:var(--tx3);font-weight:700') + ';font-size:11.5px;cursor:pointer">' + v[1] + '</button>';
        }).join('') + '</div>';
    const sourcesHtml = '<h4 style="margin:16px 0 6px;font-size:14px">Our data sources</h4>'
      + '<div class="pt-hint">\u2022 <b>GMP, price bands, dates, subscriptions:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/">Chittorgarh GMP page</a>, auto-scraped every 5 minutes.<br>'
      + '\u2022 <b>Financials, KPIs, anchor book, peers, sector, live subscription:</b> each IPO\u2019s own Chittorgarh page (linked above per IPO), refreshed every 30 minutes.<br>'
      + '\u2022 <b>Daily GMP history:</b> our own log since 19 Sep 2026 (data/history.json).<br>'
      + '\u2022 <b>Forecasts:</b> Google TimesFM 3.0, daily 07:15 IST \u2014 accuracy published in Track Record.<br>'
      + '\u2022 <b>Selection & exit rules:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://youtu.be/W4VmJ8UaUjE">Anant Ladha\u2019s research</a> (Rule of 15 / Rule of 5, category odds, one-PAN rule).<br>'
      + '\u2022 <b>Offer documents:</b> RHP / DRHP from SEBI and exchanges \u2014 buttons in Full stock detail above.<br>'
      + 'Research heuristics for education \u2014 not investment advice.</div>';
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + viewBar
      + '<div id="pt-why-body">' + (views[whyView] || views.rank) + '</div>'
      + sourcesHtml;
    const s = el.querySelector('#pt-why-select');
    if (s) s.onchange = () => { whySel = s.value; tabWhy(el); };
    el.querySelectorAll('[data-whyview]').forEach(function (b) {
      b.onclick = function () { whyView = b.getAttribute('data-whyview'); tabWhy(el); };
    });
  }
