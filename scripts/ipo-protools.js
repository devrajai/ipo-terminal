/* IPO Terminal - Pro Tools: the features no other IPO site has.
   Track Record: every GMP signal we have logged, plus TimesFM forecast
   accuracy vs actual GMP (auto-built from the daily forecast log).
   My Apps: private application tracker with allotment + P&L (browser-only).
   Family Planner: how many names x budget -> best plan + combined odds.
   Calendar: one-click .ics download of all IPO dates. */
(() => {
  if (window.__IPOPT) return;
  window.__IPOPT = 1;

  const E = v => String(v == null ? '' : v).replace(/[&<>"]/g, function (c) {
    return c === '&' ? '&' + 'amp;' : c === '<' ? '&' + 'lt;' : c === '>' ? '&' + 'gt;' : '&' + 'quot;';
  });
  const num = v => {
    const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const norm = v => String(v || '').toLowerCase()
    .replace(/limited|ltd|india|private|pvt|[\W_]/g, '');
  const money = v => Number.isFinite(v)
    ? (v < 0 ? '-\u20B9' : '\u20B9') + Math.round(Math.abs(v)).toLocaleString('en-IN')
    : '\u2014';
  const band = v => {
    const a = String(v == null ? '' : v).replace(/[\u20B9,]/g, '').match(/\d+(?:\.\d+)?/g);
    return a && a.length ? { lo: +a[0], hi: +(a[1] || a[0]) } : null;
  };

  let H = null, LOG = null, IPO = [];
  let tab = 'track';
  const LS = 'ipoAppsV1';

  const readApps = () => { try { return JSON.parse(localStorage.getItem(LS) || '[]'); } catch (e) { return []; } };
  const writeApps = a => { try { localStorage.setItem(LS, JSON.stringify(a)); } catch (e) {} };

  function createPanel() {
    if (document.getElementById('section-protools')) return;
    const s = document.createElement('section');
    s.id = 'section-protools';
    s.className = 'section glass';
    s.innerHTML = '<div class="section-title"><span>\uD83D\uDE80 Pro Tools</span><button class="close" data-close="protools">\u2715 Close</button></div><div class="content" id="protools-content"></div>';
    (document.querySelector('main') || document.body).appendChild(s);
    let nav = document.querySelector('#nav-tools');
    if (nav && nav.tagName !== 'NAV') nav = nav.querySelector('nav') || nav;
    if (nav && !nav.querySelector('[data-section="protools"]')) {
      const b = document.createElement('button');
      b.dataset.section = 'protools';
      b.textContent = '\uD83D\uDE80 Pro Tools';
      nav.appendChild(b);
    }
    const st = document.createElement('style');
    st.textContent = '.pt-tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px}.pt-tabs button{border-radius:999px;border:1px solid rgba(148,163,184,.3);background:rgba(148,163,184,.08);color:var(--muted);padding:7px 14px;font-size:12px;font-weight:600;cursor:pointer}.pt-tabs button.on{background:rgba(59,130,246,.15);color:#93c5fd;border-color:rgba(59,130,246,.5)}.pt-tbl{width:100%;border-collapse:collapse;font-size:12px}.pt-tbl th,.pt-tbl td{padding:7px 8px;text-align:left;border-bottom:1px solid rgba(148,163,184,.15)}.pt-tbl th{color:var(--muted);font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.4px}.pt-hint{font-size:12px;color:var(--muted);line-height:1.6;margin:6px 0 10px}.pt-in{background:rgba(148,163,184,.1);border:1px solid rgba(148,163,184,.3);border-radius:10px;color:var(--text);padding:8px 10px;font-size:13px;width:110px}.pt-btn{border-radius:10px;border:1px solid rgba(59,130,246,.45);background:rgba(59,130,246,.12);color:#93c5fd;padding:8px 14px;font-size:12.5px;font-weight:700;cursor:pointer}.pt-btn.del{border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.1);color:#ef4444;padding:4px 9px}.pt-btn.win{border-color:rgba(34,197,94,.45);background:rgba(34,197,94,.12);color:#22c55e}.pt-chip{display:inline-block;border-radius:999px;padding:2px 9px;font-size:11px;font-weight:700}.pt-big{font-size:22px;font-weight:800}.pt-mono{font-variant-numeric:tabular-nums}';
    document.head.appendChild(st);
  }

  function miniSpark(pts) {
    if (!pts || pts.length < 2) return '\u2014';
    const W = 90, Hh = 24, P = 2;
    const lo = Math.min.apply(null, pts), hi = Math.max.apply(null, pts), rng = (hi - lo) || 1;
    let d = '';
    pts.forEach((v, i) => {
      d += (i ? 'L' : 'M') + (P + i * (W - 2 * P) / (pts.length - 1)) + ','
        + (Hh - P - (v - lo) / rng * (Hh - 2 * P));
    });
    const up = pts[pts.length - 1] >= pts[0];
    return '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '"><path d="' + d
      + '" fill="none" stroke="' + (up ? '#22c55e' : '#ef4444') + '" stroke-width="1.6"/></svg>';
  }

  /* ---------- Track Record ---------- */
  function tabTrack(el) {
    const rows = [];
    if (H && H.series) {
      Object.keys(H.series).forEach(k => {
        const s = H.series[k].filter(p => p && Number.isFinite(p.gmp)).map(p => p.gmp);
        if (s.length >= 1) rows.push({ n: k, s: s });
      });
    }
    rows.sort((a, b) => (b.s[b.s.length - 1] - b.s[0]) - (a.s[a.s.length - 1] - a.s[0]));
    let acc = '<h4 style="margin:4px 0 6px;font-size:14px">TimesFM forecast accuracy</h4>';
    const log = (LOG && LOG.log) || [];
    const checks = [];
    log.forEach(e => {
      const next = (H && H.series || {});
      Object.keys(e.ipos || {}).forEach(n => {
        const key = Object.keys(next).find(k => norm(k) === norm(n) || norm(k).includes(norm(n)) || norm(n).includes(norm(k)));
        if (!key) return;
        const after = H.series[key].filter(p => p.d > e.d);
        if (after.length) checks.push({ d: e.d, n: n, pred: e.ipos[n].mid, act: after[0].gmp });
      });
    });
    if (checks.length) {
      const mae = checks.reduce((t, c) => t + Math.abs(c.act - c.pred), 0) / checks.length;
      const hits = checks.filter(c => Math.abs(c.act - c.pred) <= Math.max(15, Math.abs(c.pred) * 0.15)).length;
      acc += '<div class="pt-hint">' + checks.length + ' logged forecast checks \u2022 mean error ' + money(mae)
        + ' \u2022 within \u00B115 of actual: <b style="color:#22c55e">' + Math.round(hits / checks.length * 100) + '%</b></div>'
        + '<table class="pt-tbl"><tr><th>Date</th><th>IPO</th><th>Predicted</th><th>Actual</th></tr>'
        + checks.slice(-8).reverse().map(c => '<tr><td>' + E(c.d) + '</td><td>' + E(c.n.replace(/ Limited$/, ''))
          + '</td><td class="pt-mono">' + money(c.pred) + '</td><td class="pt-mono">' + money(c.act) + '</td></tr>').join('')
        + '</table>';
    } else {
      acc += '<div class="pt-hint">Every day the 07:15 IST run saves its TimesFM forecast to a private log (data/forecast-log.json). Each saved forecast is automatically compared with the actual GMP the next day. Accuracy stats and a live scorecard appear here from ~22 September. No other IPO site publishes its own model accuracy.</div>';
    }
    let tbl = '';
    if (rows.length) {
      tbl = '<h4 style="margin:16px 0 6px;font-size:14px">GMP signal history (own data, since 19 Sep 2026)</h4>'
        + '<table class="pt-tbl"><tr><th>IPO</th><th>Trend</th><th>Start</th><th>Now</th><th>Change</th></tr>'
        + rows.map(r => {
          const d = r.s[r.s.length - 1] - r.s[0];
          const sig = r.s.length >= 2 ? (d >= 0 ? '<span class="pt-chip" style="background:rgba(34,197,94,.13);color:#22c55e">rising</span>' : '<span class="pt-chip" style="background:rgba(239,68,68,.13);color:#ef4444">cooling</span>') : '';
          return '<tr><td>' + E(r.n.replace(/ Limited$/, '')) + '</td><td>' + miniSpark(r.s) + '</td><td class="pt-mono">' + money(r.s[0])
            + '</td><td class="pt-mono">' + money(r.s[r.s.length - 1]) + '</td><td class="pt-mono" style="color:' + (d >= 0 ? '#22c55e' : '#ef4444') + '">'
            + (d >= 0 ? '+' : '') + money(d) + '</td></tr>';
        }).join('') + '</table>';
    } else {
      tbl = '<div class="pt-hint">GMP history is collected daily and appears here as it builds up.</div>';
    }
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-hint">Scorecard of this site\u2019s own signals \u2014 full transparency, updated automatically.</div>'
      + acc + tbl;
  }

  /* ---------- My Apps ---------- */
  function tabApps(el) {
    const apps = readApps();
    const open = IPO.filter(x => x && x.name);
    let add = '';
    if (open.length) {
      add = '<h4 style="margin:14px 0 6px;font-size:14px">Track a new application</h4><div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
        + '<select id="pt-app-ipo" class="pt-in" style="width:220px">'
        + open.map(x => '<option value="' + E(x.name) + '">' + E(x.name) + '</option>').join('')
        + '</select><input id="pt-app-lots" class="pt-in" type="number" min="1" value="1" title="lots">'
        + '<button class="pt-btn" id="pt-app-add">+ Add application</button></div>'
        + '<div class="pt-hint">Saved only in this browser \u2014 private, no account, no server.</div>';
    }
    const won = apps.filter(a => a.status === 'won');
    const lost = apps.filter(a => a.status === 'lost');
    const profit = won.reduce((t, a) => t + ((num(a.lp) || 0) - (num(a.basis) || 0)) * (num(a.qty) || 1), 0);
    let list = '';
    if (apps.length) {
      list = '<table class="pt-tbl"><tr><th>IPO</th><th>Lots</th><th>Blocked</th><th>Status</th><th>P&L</th><th></th></tr>'
        + apps.map((a, i) => {
          let st, pl = '\u2014';
          if (a.status === 'won') {
            st = '<span class="pt-chip" style="background:rgba(34,197,94,.13);color:#22c55e">allotted</span>';
            pl = a.lp ? '<b style="color:' + (((num(a.lp) - num(a.basis)) * num(a.qty)) >= 0 ? '#22c55e' : '#ef4444') + '">'
              + money((num(a.lp) - num(a.basis)) * num(a.qty)) + '</b>' : '<input class="pt-in pt-lp" data-i="' + i + '" placeholder="listing \u20B9" style="width:90px">';
          } else if (a.status === 'lost') {
            st = '<span class="pt-chip" style="background:rgba(148,163,184,.13);color:#94a3b8">not allotted</span>';
            pl = '\u20B90';
          } else {
            st = '<span class="pt-chip" style="background:rgba(59,130,246,.13);color:#93c5fd">applied</span>';
            pl = '<button class="pt-btn win pt-won" data-i="' + i + '">won</button> <button class="pt-btn pt-lost" data-i="' + i + '">lost</button>';
          }
          return '<tr><td>' + E(a.n) + '</td><td class="pt-mono">' + a.lots + '</td><td class="pt-mono">' + money(num(a.cost))
            + '</td><td>' + st + '</td><td class="pt-mono">' + pl
            + '</td><td><button class="pt-btn del pt-del" data-i="' + i + '">\u2715</button></td></tr>';
        }).join('') + '</table>';
    }
    const rate = (won.length + lost.length) ? Math.round(won.length / (won.length + lost.length) * 100) : null;
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div style="display:flex;gap:22px;flex-wrap:wrap;margin:2px 0 12px">'
      + '<div><div class="pt-hint">Tracked</div><div class="pt-big">' + apps.length + '</div></div>'
      + '<div><div class="pt-hint">Allotted</div><div class="pt-big" style="color:#22c55e">' + won.length + '</div></div>'
      + '<div><div class="pt-hint">Win rate</div><div class="pt-big">' + (rate == null ? '\u2014' : rate + '%') + '</div></div>'
      + '<div><div class="pt-hint">Total P&L</div><div class="pt-big" style="color:' + (profit >= 0 ? '#22c55e' : '#ef4444') + '">' + money(profit) + '</div></div>'
      + '</div>' + list + add;
    const addBtn = el.querySelector('#pt-app-add');
    if (addBtn) addBtn.onclick = () => {
      const name = el.querySelector('#pt-app-ipo').value;
      const lots = Math.max(1, parseInt(el.querySelector('#pt-app-lots').value || '1', 10));
      const x = IPO.find(z => z.name === name) || {};
      const b = band(x.price), lotQty = num(x.lot) || 1;
      const a = readApps();
      a.push({ n: name, lots: lots, cost: b ? Math.round(b.hi * lotQty * lots) : null,
               basis: b ? b.hi : null, qty: lotQty * lots, lp: null, status: 'applied' });
      writeApps(a);
      tabApps(el);
    };
    el.querySelectorAll('.pt-won').forEach(b => b.onclick = () => {
      const a = readApps(); a[+b.dataset.i].status = 'won'; writeApps(a); tabApps(el);
    });
    el.querySelectorAll('.pt-lost').forEach(b => b.onclick = () => {
      const a = readApps(); a[+b.dataset.i].status = 'lost'; writeApps(a); tabApps(el);
    });
    el.querySelectorAll('.pt-del').forEach(b => b.onclick = () => {
      const a = readApps(); a.splice(+b.dataset.i, 1); writeApps(a); tabApps(el);
    });
    el.querySelectorAll('.pt-lp').forEach(inp => {
      inp.onchange = () => {
        const a = readApps(); a[+inp.dataset.i].lp = num(inp.value); writeApps(a); tabApps(el);
      };
    });
  }

  /* ---------- Family Planner ---------- */
  function tabPlan(el) {
    const open = IPO.filter(x => x && x.name);
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-hint">From the allotment rules: in retail every 1-lot application is equal, so '
      + '<b>more names beats more lots</b>. Enter your family size and budget \u2014 the plan shows where each name should apply.</div>'
      + '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">'
      + '<label class="pt-hint" style="margin:0">Names in family</label><input id="pt-n" class="pt-in" type="number" min="1" max="15" value="4">'
      + '<label class="pt-hint" style="margin:0">Budget \u20B9</label><input id="pt-bud" class="pt-in" type="number" min="10000" step="5000" value="100000" style="width:130px">'
      + '</div><div id="pt-plan-out"></div>';
    const out = el.querySelector('#pt-plan-out');
    const calc = () => {
      const n = Math.min(15, Math.max(1, parseInt(el.querySelector('#pt-n').value || '1', 10)));
      const bud = Math.max(0, num(el.querySelector('#pt-bud').value) || 0);
      const rows = [];
      open.forEach(x => {
        const b = band(x.price), lotQty = num(x.lot) || 1, gp = num(x.gmp_pct);
        if (!b) return;
        const isSme = /sme/i.test(String(x.type || ''));
        const cost = Math.round(b.hi * lotQty) * (isSme ? 2 : 1);
        const famCost = cost * n;
        const sub = num(x.sub);
        const p = (sub && sub > 1) ? Math.min(0.5, 1 / sub) : 0.1;
        const odds = Math.round((1 - Math.pow(1 - p, n)) * 100);
        rows.push({ x: x, cost: cost, famCost: famCost, odds: odds, isSme: isSme, gp: gp || 0 });
      });
      rows.sort((a, b) => b.gp - a.gp);
      let html = '<table class="pt-tbl"><tr><th>IPO</th><th>1 lot</th><th>' + n + ' names</th><th>Fits budget</th><th>Combined odds*</th></tr>'
        + rows.map(r => '<tr><td>' + E(r.x.name) + (r.isSme ? ' <span class="pt-chip" style="background:rgba(251,191,36,.13);color:#fbbf24">SME 2 lots</span>' : '') + '</td>'
          + '<td class="pt-mono">' + money(r.cost) + '</td><td class="pt-mono">' + money(r.famCost) + '</td>'
          + '<td>' + (r.famCost <= bud ? '<span class="pt-chip" style="background:rgba(34,197,94,.13);color:#22c55e">yes</span>'
             : '<span class="pt-chip" style="background:rgba(239,68,68,.13);color:#ef4444">over</span>') + '</td>'
          + '<td class="pt-mono">\u2248' + r.odds + '%</td></tr>').join('') + '</table>'
        + '<div class="pt-hint">*Assumes retail odds \u22481 in 10 when unknown; actual odds depend on final subscription. '
        + 'One application per PAN, own bank/UPI per name \u2014 see Tip 27.</div>';
      if (bud >= 1000000) {
        html = '<div class="card glass" style="padding:12px;margin-bottom:10px;background:rgba(251,191,36,.07)">\uD83D\uDCB0 Budget \u2265 \u20B910L: consider ONE big-HNI application (\u2248' + money(bud) + ', odds \u2248 subscription \u00F7 5, a win is large) plus 1-lot retail applications for the remaining family names \u2014 avoid small-HNI (\u20B92\u201310L), the worst odds. Tip 27.</div>' + html;
      }
      out.innerHTML = html;
    };
    el.querySelector('#pt-n').oninput = calc;
    el.querySelector('#pt-bud').oninput = calc;
    calc();
  }

  /* ---------- Calendar ---------- */
  function tabCal(el) {
    el.innerHTML = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-hint">Every open, close and listing date as one calendar file \u2014 auto-updated daily at 08:00 IST.</div>'
      + '<a class="pt-btn" style="display:inline-block;text-decoration:none;padding:12px 18px" href="data/ipo-calendar.ics" download="ipo-calendar.ics">\uD83D\uDCC5 Download IPO calendar (.ics)</a>'
      + '<div class="pt-hint" style="margin-top:10px"><b>Phone:</b> the file opens in your calendar app and adds all events.<br>'
      + '<b>Google Calendar:</b> calendar.google.com \u2192 Settings \u2192 Import & Export \u2192 Import the downloaded file.<br>'
      + 'Never miss a close date again \u2014 reminders fire on your phone like a normal calendar event.</div>';
  }

  let DETAILS = null, detailsTried = false, whySel = null;

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

  const tabs = () => [['track', '\uD83C\uDFC6 Track Record'], ['apps', '\uD83D\uDCCB My Apps'], ['plan', '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 Planner'], ['cal', '\uD83D\uDCC5 Calendar'], ['why', '\u2753 Why & Sources']]
    .map(t => '<button data-pt="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('');

  function render() {
    const el = document.getElementById('protools-content');
    if (!el) return;
    el.onclick = e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-pt]') : null;
      if (b) { tab = b.dataset.pt; render(); }
    };
    if (tab === 'track') tabTrack(el);
    else if (tab === 'apps') tabApps(el);
    else if (tab === 'plan') tabPlan(el);
    else if (tab === 'why') tabWhy(el);
    else tabCal(el);
  }

  async function load() {
    try {
      const r = await Promise.all(['data/history.json', 'data/forecast-log.json', 'data/ipo-data.json', 'data/ipos.json'].map(u =>
        fetch(u + '?d=' + Date.now(), { cache: 'no-store' }).then(x => x.ok ? x.json() : null).catch(() => null)));
      H = r[0]; LOG = r[1];
      const rich = (r[2] && r[2].ipos) || [];
      const base = Array.isArray(r[3]) ? r[3] : ((r[3] && r[3].ipos) || []);
      const out = [];
      rich.forEach(x => { if (x && x.name) out.push(Object.assign({}, x)); });
      base.forEach(x => {
        if (!x || !x.name) return;
        const y = out.find(z => norm(z.name) === norm(x.name));
        if (!y) out.push(Object.assign({}, x));
        else Object.keys(x).forEach(k => { if (y[k] == null || y[k] === '') y[k] = x[k]; });
      });
      IPO = out;
    } catch (e) { /* keep defaults */ }
    createPanel();
    render();
  }

  load().catch(() => {});
  setInterval(() => { load().catch(() => {}); }, 15 * 60 * 1000);
})();
