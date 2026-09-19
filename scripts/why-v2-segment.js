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
          + (anc.mf_cr != null ? ' \u00B7 Mutual funds \u2248 \u20B9' + anc.mf_cr + ' Cr' + (mfPct != null ? ' (' + mfPct + '%)' : '')
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
      let sectorHtml;
      if (peers && peers.length) {
        sectorHtml = '<h4 style="margin:16px 0 6px;font-size:13px">Same-sector peers</h4>'
          + '<table class="pt-tbl"><tr><th>Company</th><th>P/E</th></tr>'
          + peers.map(p => '<tr><td>' + E(p.name) + '</td><td class="pt-mono">' + E(p.pe || '\u2014') + '</td></tr>').join('')
          + '<tr><td><b>' + E(x.name.replace(/ Limited$/, '')) + ' (this IPO)</b></td><td class="pt-mono"><b>' + E(x.pe || '\u2014') + '</b></td></tr></table>'
          + '<div class="pt-hint">A good IPO prices ~20% cheaper than similar listed peers (Tip 26, step 4).</div>';
      }
      detail = '<h4 style="margin:4px 0 6px;font-size:14px">Full stock detail \u2014 ' + E(x.name) + '</h4>'
        + '<div class="pt-hint">' + E(x.type || 'Mainboard') + ' \u00B7 1 lot \u2248 ' + money(r.cost)
        + ' \u00B7 GMP  ' + E(x.gmp_pct || '\u2014') + ' \u00B7 closes ' + E(x.close || '\u2014') + '</div>'
         + radarHtml
        + '<h4 style="margin:12px 0 4px;font-size:13px">Fundamentals (from the RHP)</h4>' + fund
        + '<h4 style="margin:16px 0 4px;font-size:13px">Anchor book (who invested the day before)</h4>' + anchorHtml
        + '<h4 style="margin:16px 0 4px;font-size:13px">Live subscription</h4>' + subHtml
        + sectorHtml
        + '<h4 style="margin:16px 0 4px;font-size:13px">Direct sources</h4>'
        + '<div class="pt-hint" style="display:flex;gap:8px;flex-wrap:wrap">'
        + (rhp ? '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="' + E(rhp) + '">\uD83D\uDCC4 RHP / offer document</a>' : '')
        + (d.url ? '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="nopener" href="' + E(d.url) + '">\uD83D\uDD17 Chittorgarh page</a>' : '')
        + '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="noopener" href="https://youtu.be/W4VmJ8UaUjE">\uD83D\uDCFA Selection rules (video)</a>'
        + '<a class="pt-btn" style="text-decoration:none;padding:7px 12px" target="_blank" rel="nopener" href="https://www.sebi.gov.in/sebiweb/home/HomeAction.do?doListing=yes&sid=3&smid=11&ssid=15">\uD83D\uDCE2 SEBI filings</a>'
        + '</div>';
    } else {
      detail = '<div class="pt-hint">No open IPOs with price bands right now \u2014 detail appears when the next IPO opens.</div>';
    }
    const selector = scored.length
      ? '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:2px 0 10px">'
        + '<span class="pt-hint" style="margin:0">Inspect IP3:</span>'
        + '<select id="pt-why-select" class="pt-in" style="width:250px">'
        + scored.map(function (z, i) { return '<option value="' + E(z.x.name) + '"' + (z.x.name === selName ? ' selected' : '') + '>'
            + E('#' + (i + 1) + ' \u00B7 ' + z.x.name) + '</option>'; }).join('')
        + '</select></div>' : '';
    const mb = scored.filter(z => ÖËπ•ÕMµî§πÕ±•çî†¿∞ÄÃ§Ï(ÄÄÄÅçΩπÕ–ÅÕµîÄÙÅÕçΩ…ïêπô•±—ï»°ËÄÙ¯ÅËπ•ÕMµî§πÕ±•çî†¿∞ÄÃ§Ï(ÄÄÄÅçΩπÕ–Å…Öπ≠QÖâ±îÄÙÅô’πç—•Ω∏Ä°±•Õ–§ÅÏ(ÄÄÄÄÄÅ•òÄ†Ö±•Õ–π±ïπù—†§Å…ï—’…∏ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘9ΩπîÅΩ¡ï∏Å…•ù°–ÅπΩ‹∏Ωë•ÿ¯úÏ(ÄÄÄÄÄÅ…ï—’…∏ÄúÒ—Öâ±îÅç±ÖÕÃÙâ¡–µ—â∞à¯Ò—»¯Ò—†˘IÖπ¨Ω—†¯Ò—†˘%A<Ω—†¯Ò—†¯ƒÅ±Ω–Ω—†¯Ò—†˘5@Ω—†¯Ò—†˘MçΩ…îΩ—†¯Ò—†˘]°‰Ω—†¯Ω—»¯ú(ÄÄÄÄÄÄÄÄ¨Å±•Õ–πµÖ¿°ô’πç—•Ω∏Ä°Ë∞Å§§ÅÏ(ÄÄÄÄÄÄÄÄÄÄÄÅ…ï—’…∏ÄúÒ—»¯Ò—ê¯Òà¯åúÄ¨Ä°§Ä¨Äƒ§Ä¨ÄúΩà¯Ω—ê¯Ò—ê¯úÄ¨Å°Ëπ‡ππÖµîπ…ï¡±Öçî†ºÅ1•µ•—ïêêº∞Äúú§§Ä¨ÄúΩ—ê¯Ò—êÅç±ÖÕÃÙâ¡–µµΩπºà¯úÄ¨ÅµΩπï‰°ËπçΩÕ–§Ä¨ÄúΩ—ê¯ú(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¨ÄúÒ—êÅç±ÖÕÃÙâ¡–µµΩπºàÅÕ—Â±îÙâçΩ±Ω»ËúÄ¨Ä°Ëπù¿Ä¯ÙÄ»‘Ä¸Äúå»…å‘’îúÄËÅËπù¿ÄÑÙÅπ’±∞ÄòòÅËπù¿Ä¯Ä¿Ä¸Äúçôââò»–úÄËÄúå‰—ÑÕà‡ú§Ä¨Äúà¯úÄ¨Ä°Ëπù¿ÄÑÙÅπ’±∞ÄòòÅËπù¿Ä¯Ä¿Ä¸Äú¨úÄ¨ÅËπù¿Ä¨ÄúîúÄËÄùq‘»¿ƒ–ú§Ä¨ÄúΩ—ê¯ú(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¨ÄúÒ—êÅç±ÖÕÃÙâ¡–µµΩπºà¯ÒàÅÕ—Â±îÙâçΩ±Ω»ËúÄ¨Ä°ËπÕ•úπÕçΩ…îÄ¯ÙÄ‹¿Ä¸Äúå»…å‘’îúÄËÅËπÕ•úπÕçΩ…îÄ¯ÙÄ‘¿Ä¸Äúçôââò»–úÄËÄúçïò––––ú§Ä¨Äúà¯úÄ¨ÅËπÕ•úπÕçΩ…îÄ¨ÄúΩà¯Ω—ê¯ú(ÄÄÄÄÄÄÄÄÄÄÄÄÄÄ¨ÄúÒ—êÅÕ—Â±îÙâôΩπ–µÕ•ÈîËƒ¡¡‡ÌçΩ±Ω»ÈŸÖ»†¥µ—‡Ã§à¯úÄ¨Å°ËπÕ•úπ›°‰π±ïπù—†Ä¸ÅËπÕ•úπ›°‰πÕ±•çî†¿∞Ä»§π©Ω•∏†úÅq‘¿¡‹Äú§ÄËÄùïŸ•ëïπçîÅâ’•±ë•πúú§Ä¨ÄúΩ—ê¯Ω—»¯úÏ(ÄÄÄÄÄÄÄÄÄÅÙ§π©Ω•∏†úú§Ä¨ÄúΩ—Öâ±î¯úÏ(ÄÄÄÅÙÏ(ÄÄÄÅçΩπÕ–Å—Ω¿ÄÙÅÕçΩ…ïêπÕ±•çî†¿∞Äÿ§Ï(ÄÄÄÅçΩπÕ–Åâ’ëÃÄÙÅlƒ¿¿¿¿¿∞Ä»¿¿¿¿¿∞ÄÃ¿¿¿¿¡tπµÖ¿°â’êÄÙ¯ÅÏ(ÄÄÄÄÄÅ±ï–Å±ïô–ÄÙÅâ’êÏ(ÄÄÄÄÄÅçΩπÕ–Å¡•ç≠ÃÄÙÅmtÏ(ÄÄÄÄÄÅôΩ»Ä°çΩπÕ–ÅËÅΩòÅ—Ω¿§ÅÏ(ÄÄÄÄÄÄÄÅçΩπÕ–ÅåÄÙÅËπ•ÕMµîÄ¸ÅËπçΩÕ–Ä®Ä»ÄËÅËπçΩÕ–Ï(ÄÄÄÄÄÄÄÅ•òÄ°åÄÙÅ±ïô–§ÅÏÅ¡•ç≠Ãπ¡’Õ†°ÏÅËËÅË∞ÅåËÅåÅÙ§ÏÅ±ïô–Ä¥ÙÅåÏÅÙ(ÄÄÄÄÄÅÙ(ÄÄÄÄÄÅ…ï—’…∏ÅÏÅâ’êËÅâ’ê∞Å¡•ç≠ÃËÅ¡•ç≠Ã∞Å±ïô–ËÅ±ïô–ÅÙÏ(ÄÄÄÅÙ§Ï(ÄÄÄÅçΩπÕ–Å¡±Ö∏ÄÙÄúÒ—Öâ±îÅç±ÖÕÃÙâ¡–µ—â∞à¯Ò—»¯Ò—†˘%òÅÂΩ‘Å°ÖŸîΩ—†¯Ò—†˘]°Ö–Å—°îÅ¡±ÖπÃÅÕ’ùùïÕ–Ω—†¯Ω—»¯ú(ÄÄÄÄÄÄ¨Åâ’ëÃπµÖ¿°àÄÙ¯ÄúÒ—»¯Ò—êÅç±ÖÕÃÙâ¡–µµΩπºà¯úÄ¨ÅµΩπï‰°àπâ’ê§Ä¨ÄúΩ—ê¯Ò—ê¯ú(ÄÄÄÄÄÄÄÄ¨Ä°àπ¡•ç≠Ãπ±ïπù—†(ÄÄÄÄÄÄÄÄÄÄÄ¸Åàπ¡•ç≠ÃπµÖ¿°¿ÄÙ¯ÄúƒÅ±Ω–ÄúÄ¨Å°¿πËπ‡ππÖµîπ…ï¡±Öçî†ºÅ1•µ•—ïêêº∞Äúú§§Ä¨ÄúÄ†úÄ¨ÅµΩπï‰°¿πå§Ä¨Äú§ú§π©Ω•∏†úÄ¨Äú§(ÄÄÄÄÄÄÄÄÄÄÄÄÄ¨Ä°àπ±ïô–Ä¯Ä‘¿¿¿Ä¸ÄúÄ¨ÄúÄ¨ÅµΩπï‰°àπ±ïô–§Ä¨ÄúÅ≠ï¡–Åô…ïîúÄËÄúú§(ÄÄÄÄÄÄÄÄÄÄÄËÄù9ºÅ—Ω¿µ…Öπ≠ïêÅ%A<Åô•—ÃÅ—°•ÃÅâ’ëùï–Å…•ù°–ÅπΩ‹ú§(ÄÄÄÄÄÄÄÄÄÄÄÄ¨ÄúΩ—ê¯Ω—»¯ú§π©Ω•∏†úú§Ä¨ÄúΩ—Öâ±î¯úÏ(ÄÄÄÅï∞π•ππï…!Q50ÄÙÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ—ÖâÃà¯úÄ¨Å—ÖâÃ†§Ä¨ÄúΩë•ÿ¯ú(ÄÄÄÄÄÄ¨ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘’±∞Å—…ÖπÕ¡Ö…ïπç‰ËÅ°Ω‹ÅÖπêÅ›°‰Å—°•ÃÅÕ•—îÅ¡•ç≠ÃÅ%A=ÃÅq‘»¿ƒ–Å›•—†Å—°îÅ’πëï…±Â•πúÅëÖ—ÑÅÖπêÅ±•π≠Ã∏Ωë•ÿ¯ú(ÄÄÄÄÄÄ¨ÅÕï±ïç—Ω»Ä¨Åëï—Ö•∞(ÄÄÄÄÄÄ¨ÄúÒ†–ÅÕ—Â±îÙâµÖ…ù•∏Ëƒ·¡‡Ä¿ÄŸ¡‡ÌôΩπ–µÕ•ÈîËƒ—¡‡à˘	ïÕ–ÄÃÅq‘»¿ƒ–Å5Ö•πâΩÖ…êΩ†–¯ú(ÄÄÄÄÄÄ¨ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘IÖπ≠ïêÅâ‰ÅïŸ•ëïπçîÅÕçΩ…îÄ°ù…Ω›—†Ä¨ÅI=Ä¨ÅŸÖ±’Ö—•Ω∏Ä¨ÅÕ’âÕç…•¡—•Ω∏Ä¨Å5@Ä¨Åëïâ–§∞ÅπΩ–Å©’Õ–Å5@∏Ωë•ÿ¯ú(ÄÄÄÄÄÄ¨Å…Öπ≠QÖâ±î°µà§(ÄÄÄÄÄÄ¨ÄúÒ†–ÅÕ—Â±îÙâµÖ…ù•∏ËƒŸ¡‡Ä¿ÄŸ¡‡ÌôΩπ–µÕ•ÈîËƒ—¡‡à˘	ïÕ–ÄÃÅq‘»¿ƒ–ÅM5Ω†–¯ú(ÄÄÄÄÄÄ¨ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘M5Å%A=ÃÅÖ…îÅ©’ëùïêÅÕï¡Ö…Ö—ï±‰ËÅÕµÖ±±ï»ÅçΩµ¡Öπ•ïÃ∞Å°•ù°ï»Å…•Õ¨Åq‘»¿ƒ–ÅçΩµ¡Ö…îÅ›•—°•∏Å—°îÅçÖ—ïùΩ…‰ÅΩπ±‰Ä°Q•¿Ä»ÿ∞ÅÕ—ï¿Äƒ§∏Ωë•ÿ¯ú(ÄÄÄÄÄÄ¨Å…Öπ≠QÖâ±î°Õµî§(ÄÄÄÄÄÄ¨ÄúÒ†–ÅÕ—Â±îÙâµÖ…ù•∏ËƒŸ¡‡Ä¿ÄŸ¡‡ÌôΩπ–µÕ•ÈîËƒ—¡‡à˘!Ω‹Å—°îÅq‘»¡‰≈0ÄºÅq‘»¡‰…0ÄºÅq‘»¡‰Õ0Åâ’ëùï–Å¡±ÖπÃÅ›Ω…¨Ω†–¯ú(ÄÄÄÄÄÄ¨ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘5Ωπï‰Å•ÃÅÕ¡…ïÖêÅÖÃÄƒÅ±Ω–ÅïÖç†ÅÖç…ΩÕÃÅ—°îÅ—Ω¿µ…Öπ≠ïêÅΩ¡ï∏Å%A=ÃÅq‘»¿ƒ–ÅµΩ…îÅôÖµ•±‰ÅπÖµïÃ∞ÅπΩ–ÅµΩ…îÅ±Ω—Ã∞Å…Ö•ÕîÅÂΩ’»Åç°ÖπçïÃÄ°Q•¿Ä»‹§∏ÅM5Åïπ—…•ïÃÅ’ÕîÄ»Å±Ω—ÃÄ°µ•π•µ’¥Åq‘»¡à‰…0ÅôΩ»Å!9$ÅΩëëÃ§∏Ωë•ÿ¯ú(ÄÄÄÄÄÄ¨Å¡±Ö∏(ÄÄÄÄÄÄ¨ÄúÒ†–ÅÕ—Â±îÙâµÖ…ù•∏ËƒŸ¡‡Ä¿ÄŸ¡‡ÌôΩπ–µÕ•ÈîËƒ—¡‡à˘=’»ÅëÖ—ÑÅÕΩ’…çïÃΩ†–¯ú(ÄÄÄÄÄÄ¨ÄúÒë•ÿÅç±ÖÕÃÙâ¡–µ°•π–à˘q‘»¿»»ÄÒà˘5@∞Å¡…•çîÅâÖπëÃ∞ÅëÖ—ïÃ∞ÅÕ’âÕç…•¡—•ΩπÃËΩà¯ÄÒÑÅÕ—Â±îÙâçΩ±Ω»Ëå‰Õå’ôêàÅ—Ö…ùï–Ùâ}â±Öπ¨àÅ…ï∞ÙâπΩΩ¡ïπï»àÅ°…ïòÙâ°——¡ÃËºΩ››‹πç°•——Ω…ùÖ…†πçΩ¥Ω…ï¡Ω…–Ω•¡ºµù…ï‰µµÖ…≠ï–µ¡…ïµ•’¥µùµ¿º»ƒºà˘°•——Ω…ùÖ…†Å5@Å¡ÖùîΩÑ¯∞ÅÖ’—ºµÕç…Ö¡ïêÅïŸï…‰Ä‘Åµ•π’—ïÃ∏Òâ»¯ú(ÄÄÄÄÄÄ¨Äùq‘»¿»»ÄÒà˘•πÖπç•Ö±Ã∞Å-A%Ã∞ÅÖπç°Ω»ÅâΩΩ¨∞Å¡ïï…Ã∞ÅÕïç—Ω»∞Å±•ŸîÅÕ’âÕç…•¡—•Ω∏ËΩà¯ÅïÖç†Å%A=q‘»¿ƒÂÃÅΩ›∏Å°•——Ω…ùÖ…†Å¡ÖùîÄ°±•π≠ïêÅÖâΩŸîÅ¡ï»Å%A<§∞Å…ïô…ïÕ°ïêÅïŸï…‰ÄÃ¿Åµ•π’—ïÃ∏Òâ»¯ú(ÄÄÄÄÄÄ¨Äùq‘»¿»»ÄÒà˘Ö•±‰Å5@Å°•Õ—Ω…‰ËΩà¯ÅΩ’»ÅΩ›∏Å±ΩúÅÕ•πçîÄƒ‰ÅMï¿Ä»¿»ÿÄ°ëÖ—ÑΩ°•Õ—Ω…‰π©ÕΩ∏§∏Òâ»¯ú(ÄÄÄÄÄÄ¨Äùq‘»¿»»ÄÒà˘Ω…ïçÖÕ—ÃËΩà¯ÅΩΩù±îÅQ•µïÕ4ÄÃ∏¿∞ÅëÖ•±‰Ä¿‹Ëƒ‘Å%MPÅq‘»¿ƒ–ÅÖçç’…Öç‰Å¡’â±•Õ°ïêÅ•∏ÅQ…Öç¨ÅIïçΩ…ê∏Òâ»¯ú(ÄÄÄÄÄÄ¨Äùq‘»¿»»ÄÒà˘Mï±ïç—•Ω∏ÄòÅï·•–Å…’±ïÃËΩà¯ÄÒÑÅÕ—Â±îÙâçΩ±Ω»Ëå‰Õå’ôêàÅ—Ö…ùï–Ùâ}â±Öπ¨àÅ…ï∞ÙâπΩΩ¡ïπï»àÅ°…ïòÙâ°——¡ÃËºΩÂΩ’—‘πâîΩ\—Yµ(·UÖU©à˘πÖπ–Å1Öë°Öq‘»¿ƒÂÃÅ…ïÕïÖ…ç†ΩÑ¯Ä°I’±îÅΩòÄƒ‘ÄºÅI’±îÅΩòÄ‘∞ÅçÖ—ïùΩ…‰ÅΩëëÃ∞ÅΩπîµA8Å…’±î§∏Òâ»¯ú(ÄÄÄÄÄÄ¨Äùq‘»¿»»ÄÒà˘=ôôï»ÅëΩç’µïπ—ÃËΩà¯ÅI!@ÄºÅI!@Åô…Ω¥ÅM	$ÅÖπêÅï·ç°ÖπùïÃÅq‘»¿ƒ–Åâ’——ΩπÃÅΩ∏ÅïŸï…‰Å%A<ÅçÖ…ê∏Òâ»¯ú(ÄÄÄÄÄÄ¨ÄùIïÕïÖ…ç†Å°ï’…•Õ—•çÃÅôΩ»Åïë’çÖ—•Ω∏Åq‘»¿ƒ–ÅπΩ–Å•πŸïÕ—µïπ–ÅÖëŸ•çî∏Ωë•ÿ¯úÏ(ÄÄÄÅçΩπÕ–ÅÃÄÙÅï∞π≈’ï…ÂMï±ïç—Ω»†úç¡–µ›°‰µÕï±ïç–ú§Ï(ÄÄÄÅ•òÄ°Ã§ÅÃπΩπç°ÖπùîÄÙÄ†§ÄÙ¯ÅÏÅ›°ÂMï∞ÄÙÅÃπŸÖ±’îÏÅ—Öâ]°‰°ï∞§ÏÅÙÏ(ÄÅÙ(