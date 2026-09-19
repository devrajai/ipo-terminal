  function kf(v) {
    const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

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
        + '<div class="pt-hint">Five lanes, same maths as the IPO Radar: Business (growth + ROE) \u00B7 Valuation (P/E) \u00B7 Demand (subscription) \u00B7 GMP \u00B7 Structure (debt).</div>'
        + '<div class="pt-hint"><b>Why:</b> ' + E(s.why.length ? s.why.join(' \u00B7 ') : 'not enough evidence yet') + '</div>'
        + (s.conflict.length ? '<div class="pt-hint" style="color:#fbbf24"><b>Check:</b> ' + E(s.conflict.join(' \u00B7 ')) + '</div>' : '')
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
      return '<table class="pt-tbl"><tr><th>Rank</th><th>IPO</th><th>1 lot</th><th>GMP</th><th>Score</th><th>Why</th></tr>'
        + list.map(function (z, i) {
            return '<tr><td><b>#' + (i + 1) + '</b></td><td>' + E(z.x.name.replace(/ Limited$/, '')) + '</td><td class="pt-mono">' + money(z.cost) + '</td>'
              + '<td class="pt-mono" style="color:' + (z.gp >= 25 ? '#22c55e' : z.gp != null && z.gp > 0 ? '#fbbf24' : '#94a3b8') + '">' + (z.gp != null && z.gp > 0 ? '+' + z.gp + '%' : '\u2014') + '</td>'
              + '<td class="pt-mono"><b style="color:' + (z.sig.score >= 70 ? '#22c55e' : z.sig.score >= 50 ? '#fbbf24' : '#ef4444') + '">' + z.sig.score + '</b></td>'
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
      + '<h4 style="margin:18px 0 6px;font-size:14px">Best 3 \u2014 Mainboard</h4>'
      + '<div class="pt-hint">Ranked by evidence score (growth + ROE + valuation + subscription + GMP + debt), not just GMP.</div>'
      + rankTable(mb)
      + '<h4 style="margin:16px 0 6px;font-size:14px">Best 3 \u2014 SME</h4>'
      + '<div class="pt-hint">SME IPOs are judged separately: smaller companies, higher risk \u2014 compare within the category only (Tip 26, step 1).</div>'
      + rankTable(sme)
      + '<h4 style="margin:16px 0 6px;font-size:14px">How the \u20B91L / \u20B92L / \u20B93L budget plans work</h4>'
      + '<div class="pt-hint">Money is spread as 1 lot each across the top-ranked open IPOs \u2014 more family names, not more lots, raise your chances (Tip 27). SME entries use 2 lots (minimum \u20b92L for HNI odds).</div>'
      + plan
      + '<h4 style="margin:16px 0 6px;font-size:14px">Our data sources</h4>'
      + '<div class="pt-hint">\u2022 <b>GMP, price bands, dates, subscriptions:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://www.chittorgarh.com/report/ipo-grey-market-premium-gmp/21/">Chittorgarh GMP page</a>, auto-scraped every 5 minutes.<br>'
      + '\u2022 <b>Financials, KPIs, anchor book, peers, sector, live subscription:</b> each IPO\u2019s own Chittorgarh page (linked above per IPO), refreshed every 30 minutes.<br>'
      + '\u2022 <b>Daily GMP history:</b> our own log since 19 Sep 2026 (data/history.json).<br>'
      + '\u2022 <b>Forecasts:</b> Google TimesFM 3.0, daily 07:15 IST \u2014 accuracy published in Track Record.<br>'
      + '\u2022 <b>Selection & exit rules:</b> <a style="color:#93c5fd" target="_blank" rel="noopener" href="https://youtu.be/W4VmJ8UaUjE">Anant Ladha\u2019s research</a> (Rule of 15 / Rule of 5, category odds, one-PAN rule).<br>'
      + '\u2022 <b>Offer documents:</b> RHP / DRHP from SEBI and exchanges \u2014 buttons on every IPO card.<br>'
      + 'Research heuristics for education \u2014 not investment advice.</div>';
    const s = el.querySelector('#pt-why-select');
    if (s) s.onchange = () => { whySel = s.value; tabWhy(el); };
  }
