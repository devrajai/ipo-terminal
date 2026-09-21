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

  /* ---------- Calculator ---------- */
  let calcMode = 'cost';
  const dmy = s => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; const y = +m[3] < 100 ? 2000 + +m[3] : +m[3]; return new Date(y, +m[2] - 1, +m[1]); };

  function calcIPOs() {
    const t = new Date(); t.setHours(0, 0, 0, 0);
    const list = IPO.filter(x => x && x.name && band(x.price));
    list.sort((a, b) => {
      const ca = dmy(a.close), cb = dmy(b.close);
      const oa = !!(ca && ca >= t), ob = !!(cb && cb >= t);
      if (oa !== ob) return oa ? -1 : 1;
      return 0;
    });
    return list;
  }

  function calcResult(rows, note) {
    return '<table class="pt-tbl">' + rows.map(r => '<tr><th style="width:46%">' + r[0] + '</th><td class="pt-mono" style="' + (r[2] || '') + '">' + r[1] + '</td></tr>').join('') + '</table>'
      + (note ? '<div class="pt-hint" style="margin-top:8px">' + note + '</div>' : '');
  }

  function tabCalc(el) {
    const list = calcIPOs();
    const modes = [['cost', '\uD83D\uDCB0 Apply Cost'], ['gmp', '\uD83D\uDCCA GMP Return'], ['pl', '\uD83D\uDCC9 Profit / Loss']];
    let html = '<div class="pt-tabs">' + tabs() + '</div>'
      + '<div class="pt-tabs" style="margin-bottom:10px">' + modes.map(m => '<button data-cm="' + m[0] + '" class="' + (calcMode === m[0] ? 'on' : '') + '">' + m[1] + '</button>').join('') + '</div>';
    const sel = '<select id="pt-c-ipo" class="pt-in" style="width:230px;max-width:100%">'
      + list.map((x, i) => '<option value="' + E(x.name) + '"' + (i === 0 ? ' selected' : '') + '>' + E(x.name) + '</option>').join('') + '</select>';
    if (calcMode === 'cost') {
      html += '<div class="pt-hint">How much money will one application block? Auto-filled from live price bands \u2014 UPI blocks at the <b>upper band</b>.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' + sel
        + '<label class="pt-hint" style="margin:0">Lots</label><input id="pt-c-lots" class="pt-in" type="number" min="1" value="1"></div>'
        + '<div id="pt-c-out"></div>';
    } else if (calcMode === 'gmp') {
      html += '<div class="pt-hint">Expected listing gain from the live grey market premium \u2014 <b>GMP is unofficial</b> and can change any time.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' + sel
        + '<label class="pt-hint" style="margin:0">Lots</label><input id="pt-c-lots" class="pt-in" type="number" min="1" value="1"></div>'
        + '<div id="pt-c-out"></div>';
    } else {
      html += '<div class="pt-hint">Actual profit or loss after listing \u2014 pick an IPO to auto-fill, or type your own numbers.</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">' + sel + '</div>'
        + '<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px">'
        + '<label class="pt-hint" style="margin:0">Issue \u20B9</label><input id="pt-c-ip" class="pt-in" type="number" min="1" placeholder="314">'
        + '<label class="pt-hint" style="margin:0">Listing \u20B9</label><input id="pt-c-lp" class="pt-in" type="number" min="0" placeholder="300">'
        + '<label class="pt-hint" style="margin:0">Lot size</label><input id="pt-c-ls" class="pt-in" type="number" min="1" value="1">'
        + '<label class="pt-hint" style="margin:0">Lots</label><input id="pt-c-lots" class="pt-in" type="number" min="1" value="1"></div>'
        + '<div id="pt-c-out"></div>';
    }
    el.innerHTML = html;
    el.querySelectorAll('[data-cm]').forEach(b => b.onclick = () => { calcMode = b.dataset.cm; tabCalc(el); });
    const run = () => {
      const selEl = el.querySelector('#pt-c-ipo');
      const name = selEl ? selEl.value : '';
      const x = name ? (IPO.find(z => z.name === name) || null) : null;
      const lots = Math.max(1, parseInt((el.querySelector('#pt-c-lots') || { value: '1' }).value || '1', 10));
      const out = el.querySelector('#pt-c-out');
      if (!out) return;
      if (calcMode === 'cost') {
        if (!x) { out.innerHTML = '<div class="pt-hint">No IPO with a price band in the data yet.</div>'; return; }
        const b = band(x.price), ls = num(x.lot) || 1;
        const lo = Math.round(b.lo * ls * lots), hi = Math.round(b.hi * ls * lots);
        out.innerHTML = calcResult([
          ['Price band', E(x.price)],
          ['Lot size', ls.toLocaleString('en-IN') + ' shares'],
          ['Shares (' + lots + ' lot' + (lots > 1 ? 's' : '') + ')', (ls * lots).toLocaleString('en-IN')],
          ['Blocked at lower band', money(lo)],
          ['Money to arrange \u2248', money(hi), 'color:#fbbf24;font-weight:700']
        ], 'UPI mandate blocks the <b>upper band</b> amount (' + money(hi) + '). Refund arrives in ~3\u20134 days if not allotted.');
      } else if (calcMode === 'gmp') {
        if (!x) { out.innerHTML = '<div class="pt-hint">No IPO with a price band in the data yet.</div>'; return; }
        const b = band(x.price), ls = num(x.lot) || 1;
        let g = num(x.gmp); if (g == null) g = 0;
        const estHi = b.hi + g;
        const perLot = Math.round((estHi - b.hi) * ls);
        const pct = b.hi ? (estHi - b.hi) / b.hi * 100 : 0;
        out.innerHTML = calcResult([
          ['Issue price (upper)', money(b.hi)],
          ['GMP today', (g >= 0 ? '+' : '') + money(g), g >= 0 ? 'color:#22c55e' : 'color:#ef4444'],
          ['Est. listing price', money(estHi), 'font-weight:700'],
          ['Gain / lot', (perLot >= 0 ? '+' : '') + money(perLot), perLot >= 0 ? 'color:#22c55e' : 'color:#ef4444'],
          ['Gain on ' + lots + ' lot' + (lots > 1 ? 's' : ''), (perLot * lots >= 0 ? '+' : '') + money(perLot * lots), perLot >= 0 ? 'color:#22c55e' : 'color:#ef4444'],
          ['Expected return', (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%', pct >= 0 ? 'color:#22c55e' : 'color:#ef4444']
        ], 'GMP is an unofficial grey-market estimate \u2014 not a guarantee. Data refreshes every 5 minutes.');
      } else {
        const ip = num(el.querySelector('#pt-c-ip').value), lp = num(el.querySelector('#pt-c-lp').value);
        const ls = Math.max(1, parseInt(el.querySelector('#pt-c-ls').value || '1', 10));
        if (ip == null || lp == null) { out.innerHTML = '<div class="pt-hint">Enter issue price and listing price.</div>'; return; }
        const inv = ip * ls * lots, val = lp * ls * lots, pl = val - inv, pct = inv ? pl / inv * 100 : 0;
        out.innerHTML = calcResult([
          ['Investment', money(inv)],
          ['Listing value', money(val)],
          ['Profit / Loss', (pl >= 0 ? '+' : '') + money(pl), pl >= 0 ? 'color:#22c55e;font-weight:700' : 'color:#ef4444;font-weight:700'],
          ['Return', (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%', pct >= 0 ? 'color:#22c55e;font-weight:700' : 'color:#ef4444;font-weight:700']
        ], 'Selling on listing day? Charges (brokerage + STT + taxes) typically eat ~0.3\u20130.5% \u2014 this shows the gross result.');
      }
    };
    const selEl = el.querySelector('#pt-c-ipo');
    if (selEl) selEl.onchange = () => {
      const x = IPO.find(z => z.name === selEl.value);
      if (x && calcMode === 'pl') {
        const b = band(x.price);
        const ipf = el.querySelector('#pt-c-ip'), lsf = el.querySelector('#pt-c-ls');
        if (b && ipf) ipf.value = b.hi;
        if (num(x.lot) && lsf) lsf.value = num(x.lot);
      }
      run();
    };
    el.querySelectorAll('#pt-c-lots, #pt-c-ip, #pt-c-lp, #pt-c-ls').forEach(i => i.oninput = run);
    run();
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

  function kf(v) {
    const m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return m ? Number(m[0]) : null;
  }

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
      + '<tr><td><b>GMP</b></td><td>Grey-market premium (unofficial sentiment)</td><td class="pt-mono">\u226520%\u219290 \u00B7 \u226510%\u219275 \u00B7 \u22655%\u219268 \u00B7 \u22650%\u219260 \u00B7 <0%\u219225</td><td>GMP feed (every 5 min)</td></tr>'
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

  const tabs = () => [['track', '\uD83C\uDFC6 Track Record'], ['apps', '\uD83D\uDCCB My Apps'], ['plan', '\uD83D\uDC68\u200D\uD83D\uDC69\u200D\uD83D\uDC67 Planner'], ['cal', '\uD83D\uDCC5 Calendar'], ['calc', '\uD83E\uDDE9 Calculator'], ['why', '\u2753 Why & Sources']]
    .map(t => '<button data-pt="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('');

  function render() {
    const el = document.getElementById('protools-content');
    if (!el) return;
    el.onclick = e => {
      const b = e.target && e.target.closest ? e.target.closest('[data-pt]') : null;
      if (b) { tab = b.dataset.pt; render(); }
    };
    if (tab === 'calc') tabCalc(el);
    else if (tab === 'track') tabTrack(el);
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
