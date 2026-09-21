/* IPO Terminal - TimesFM forecast layer.
   Loads data/forecasts.json (written daily by the TimesFM 3.0 workflow) and
   injects a "GMP forecast" box into every open/upcoming IPO card it can match
   by name. Runs after the main render, re-checks periodically so it survives
   re-renders and the 15-minute data refresh. Missing forecast = no box. */
(() => {
  if (window.__IPOFC) return;
  window.__IPOFC = 1;

  const norm = v => String(v || '').toLowerCase()
    .replace(/limited|ltd|india|private|pvt|[\W_]/g, '');
  const fmt = v => Number.isFinite(v)
    ? (v < 0 ? '-\u20B9' + Math.round(Math.abs(v)).toLocaleString('en-IN')
             : '\u20B9' + Math.round(v).toLocaleString('en-IN'))
    : '\u2014';

  let F = null;

  const find = name => {
    if (!F || !F.ipos) return null;
    const q = norm(name);
    if (!q) return null;
    for (const k of Object.keys(F.ipos)) {
      if (norm(k) === q || norm(k).includes(q) || q.includes(norm(k))) {
        return F.ipos[k];
      }
    }
    return null;
  };

  const boxFor = f => {
    const p = (f.points || []).filter(x => x && Number.isFinite(x.mid));
    if (!p.length) return null;
    const last = p[p.length - 1];
    const el = document.createElement('div');
    el.className = 'box fc-box';
    const title = f.est_listing
      ? ' Forecast est. listing: ' + fmt(f.est_listing.low) + ' \u2013 ' + fmt(f.est_listing.high)
      : ' TimesFM zero-shot trend forecast';
    el.title = 'Next ' + (f.horizon_days || p.length) + ' days ('
      + (F && F.model ? F.model : 'model') + ').' + title
      + ' - trend signal, not a guarantee.';
    el.innerHTML = 'GMP forecast (' + (f.horizon_days || p.length) + 'd)<b>'
      + fmt(last.mid) + ' (' + fmt(last.low) + '\u2013' + fmt(last.high) + ')</b>';
    return el;
  };

  const inject = () => {
    if (!F) return;
    ['#open-list', '#upcoming-list'].forEach(sel => {
      document.querySelectorAll(sel + ' .card').forEach(card => {
        if (card.querySelector('.fc-box')) return;
        const nameEl = card.querySelector('.name');
        if (!nameEl) return;
        const f = find(nameEl.textContent);
        if (!f) return;
        const box = boxFor(f);
        const grid = card.querySelector('.grid');
        if (box && grid) grid.appendChild(box);
      });
    });
  };

  const load = async () => {
    try {
      const r = await fetch('data/forecasts.json?d=' + Date.now(), { cache: 'no-store' });
      if (r.ok) F = await r.json();
    } catch (e) { /* forecasts are optional */ }
    inject();
    setTimeout(inject, 3000);
    setTimeout(inject, 8000);
    setInterval(inject, 30000);
  };

  load();
})();

/* IPO Terminal - Open list board filter (21/09/26).
   Mainboard IPOs first, then SME; pill buttons filter All / Mainboard / SME.
   Wraps the site renderOpen(); counts stay correct. */
(() => {
  if (window.__IPOBF) return;
  window.__IPOBF = 1;

  const css = document.createElement('style');
  css.textContent = '.of-bar{display:flex;gap:8px;flex-wrap:wrap;margin:0 0 12px}'
    + '.of-bar button{border-radius:999px;border:1px solid var(--line);background:var(--glass);color:var(--muted);padding:7px 15px;font-size:12px;font-weight:850;cursor:pointer}'
    + '.of-bar button.on{color:#fff;background:var(--glass2);border-color:rgba(255,255,255,.32)}';
  document.head.appendChild(css);

  let filter = 'all';
  const isSme = x => /sme/i.test(String(x.board || x.type || x.exchange || ''));
  const orig = window.renderOpen;

  window.renderOpen = function () {
    if (orig) orig();
    const host = document.getElementById('open-list');
    if (!host || typeof groups !== 'function' || typeof ipoCard !== 'function') return;
    let open = [];
    try { open = (groups().open || []).slice(); } catch (e) { return; }
    if (!open.length) return; // keep the original empty message
    open.sort((a, b) => (isSme(a) ? 1 : 0) - (isSme(b) ? 1 : 0));
    const mb = open.filter(x => !isSme(x)), sm = open.filter(isSme);
    const shown = filter === 'all' ? open : (filter === 'sme' ? sm : mb);
    const bar = '<div class="of-bar">'
      + [['all', 'All (' + open.length + ')'], ['mb', 'Mainboard (' + mb.length + ')'], ['sme', 'SME (' + sm.length + ')']]
        .map(f => '<button data-of="' + f[0] + '" class="' + (filter === f[0] ? 'on' : '') + '">' + f[1] + '</button>').join('')
      + '</div>';
    const cards = shown.map(x => ipoCard(x, 'OPEN')).join('');
    host.innerHTML = bar + (cards || '<div class="empty">No ' + (filter === 'sme' ? 'SME' : 'Mainboard') + ' IPO is open right now.</div>');
  };

  document.addEventListener('click', e => {
    const b = e.target && e.target.closest ? e.target.closest('[data-of]') : null;
    if (!b) return;
    filter = b.getAttribute('data-of');
    window.renderOpen();
  });

  if (orig && document.getElementById('open-list')) window.renderOpen();
})();

/* IPO Terminal - tap-name detail sheet (21/09/26).
   Tap any IPO name -> full detail summary overlay with dates, GMP,
   subscription, fundamentals, offer doc and allotment links.
   Uses the page's own global helpers (state, status, date, esc, gmpRupees,
   gmpPctOf, bandLow, findSub) via bare identifiers. */
(() => {
  if (window.__IPODT) return;
  window.__IPODT = 1;

  const css = document.createElement('style');
  css.textContent = '.ipodt{position:fixed;inset:0;z-index:9999;background:rgba(4,8,16,.68);display:flex;align-items:flex-end;justify-content:center}'
    + '.ipodt-card{background:var(--glass2);border:1px solid var(--line);border-radius:22px 22px 0 0;width:100%;max-width:640px;max-height:88vh;overflow:auto;padding:18px 18px 30px;animation:ipodt-up .22s ease-out}'
    + '@keyframes ipodt-up{from{transform:translateY(40px);opacity:.4}to{transform:none;opacity:1}}'
    + '.ipodt-top{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}'
    + '.ipodt-name{font-size:19px;font-weight:900;line-height:1.3}'
    + '.ipodt-x{background:var(--glass);border:1px solid var(--line);color:var(--muted);border-radius:999px;width:36px;height:36px;font-size:17px;cursor:pointer;flex:none;line-height:1}'
    + '.ipodt-tags{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0 12px}'
    + '.ipodt-tag{font-size:11px;font-weight:800;padding:4px 10px;border-radius:999px;border:1px solid var(--line);color:var(--text)}'
    + '.ipodt-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}'
    + '.ipodt-box{background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:9px 12px}'
    + '.ipodt-box span{display:block;font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}'
    + '.ipodt-box b{font-size:14.5px}'
    + '.ipodt-box.wide{grid-column:span 2}'
    + '.ipodt-gmp{background:var(--glass);border:1px solid var(--line);border-radius:14px;padding:10px 12px;margin-bottom:8px;display:flex;justify-content:space-between;align-items:center;grid-column:span 2}'
    + '.ipodt-gmp span{font-size:10.5px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}'
    + '.ipodt-gmp b{font-size:16px}'
    + '.ipodt-h{font-size:11px;letter-spacing:.09em;text-transform:uppercase;color:var(--muted);margin:16px 0 8px;font-weight:900}'
    + '.ipodt-links{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}'
    + '.ipodt-links a{flex:1 1 45%;text-align:center;padding:10px 8px;border-radius:12px;border:1px solid var(--line);background:var(--glass);color:var(--text);font-weight:800;font-size:13px;text-decoration:none}'
    + '.ipodt-note{font-size:11px;color:var(--muted);margin-top:12px;line-height:1.5}';
  document.head.appendChild(css);

  const E = (typeof esc === 'function') ? esc
    : (v => String(v == null ? '' : v).replace(/[&<>"']/g, c => '&' === c ? '&a' + 'mp;' : '<' === c ? '&l' + 't;' : '>' === c ? '&g' + 't;' : '"' === c ? '&q' + 'uot;' : '&#3' + '9;'));
  const D = (typeof date === 'function') ? date : (v => String(v || '\u2014'));
  const normN = v => String(v || '').toLowerCase().replace(/limited|ltd|india|[^\w]/g, '');
  const has = v => { const s = String(v == null ? '' : v).trim(); return s && s !== '\u2014' && s !== '-'; };

  function findIpo(name) {
    let best = null;
    const q = normN(name);
    if (!q) return null;
    try {
      for (const x of state.ipos) if (normN(x.name) === q) return x;
      for (const x of state.ipos) if (normN(x.name).includes(q) || q.includes(normN(x.name))) { best = x; break; }
    } catch (e) { }
    return best;
  }
  function findListed(name) {
    try {
      const q = normN(name);
      for (const x of state.listed) if (normN(x.name) === q) return x;
    } catch (e) { }
    return null;
  }
  function findDoc(name) {
    try {
      const q = normN(name);
      for (const x of state.drhp) if (normN(x.name) === q) return x.sebi_link || x.source_url || '';
    } catch (e) { }
    return '';
  }

  function close() {
    const m = document.getElementById('ipodt-overlay');
    if (m) m.remove();
  }
  function openSheet(name) {
    close();
    const x = findIpo(name) || findListed(name) || { name: name };
    const st = (typeof status === 'function' && findIpo(name)) ? status(x) : String(x.status || 'LISTED').toUpperCase();
    const gmp = (typeof gmpRupees === 'function' && findIpo(name)) ? gmpRupees(x) : null;
    const pct = (typeof gmpPctOf === 'function' && findIpo(name)) ? gmpPctOf(x) : '\u2014';
    const lo = (typeof bandLow === 'function' && findIpo(name)) ? bandLow(x) : null;
    let sub = null;
    try { if (typeof findSub === 'function') sub = findSub(name); } catch (e) { }

    const box = (k, v) => has(v) ? '<div class="ipodt-box"><span>' + k + '</span><b>' + E(v) + '</b></div>' : '';
    const money = v => Number.isFinite(v) ? ('\u20B9' + Math.round(v).toLocaleString('en-IN')) : '\u2014';

    let g = '';
    if (gmp != null) {
      const est = (lo != null) ? money(lo + gmp) : '\u2014';
      g = '<div class="ipodt-gmp"><span>GMP (unofficial)</span><b>' + money(gmp) + ' (' + E(pct === null || pct === '\u2014' ? '\u2014' : pct + '%') + ') \u2192 est ' + est + '</b></div>';
    }
    const listed = findListed(name);
    let perf = '';
    if (listed) {
      const issue = Number(listed.issue_price) || 0, cur = Number(listed.current_price || listed.ltp || listed.listing_price) || 0;
      const p = Number(listed.gain_loss_percent) || (issue && cur ? (cur - issue) / issue * 100 : 0);
      perf = '<div class="ipodt-h">Listing performance</div><div class="ipodt-grid">'
        + box('Issue price', issue ? '\u20B9' + issue : '')
        + box('Current price', cur ? '\u20B9' + cur : '')
        + box('Listing gain', (p > 0 ? '+' : '') + p.toFixed(2) + '%')
        + box('Listed on', D(listed.listing_date))
        + '</div>';
    }

    const doc = findDoc(name);
    const ex = String(x.exchange || '');
    const allot = /bse/i.test(ex)
      ? 'https://www.bseindia.com/investors/appli_check.aspx'
      : 'https://www.nseindia.com/market-data/all-upcoming-issues-ipo';
    let links = '';
    if (doc) links += '<a href="' + E(doc) + '" target="_blank" rel="noopener">\uD83D\uDCC4 RHP / DRHP</a>';
    if (st === 'CLOSED' || st === 'LISTED' || st === 'OPEN') links += '<a href="' + allot + '" target="_blank" rel="noopener">\uD83C\uDFAB Check allotment</a>';
    if (has(x.source_url)) links += '<a href="' + E(x.source_url) + '" target="_blank" rel="noopener">\uD83D\uDD17 IPO page</a>';

    const el = document.createElement('div');
    el.className = 'ipodt';
    el.id = 'ipodt-overlay';
    el.innerHTML = '<div class="ipodt-card" role="dialog" aria-label="IPO details">'
      + '<div class="ipodt-top"><div class="ipodt-name">' + E(x.name || name) + '</div>'
      + '<button class="ipodt-x" aria-label="Close">\u2715</button></div>'
      + '<div class="ipodt-tags">'
      + '<span class="ipodt-tag">' + E(st) + '</span>'
      + (has(x.board) ? '<span class="ipodt-tag">' + E(x.board) + '</span>' : '')
      + (has(x.exchange) ? '<span class="ipodt-tag">' + E(x.exchange) + '</span>' : '')
      + '</div>'
      + '<div class="ipodt-grid">'
      + g
      + box('Price band', x.price_band)
      + box('Lot size', x.lot_size)
      + box('Issue size', x.issue_size)
      + box('Subscription', (sub && has(sub.total)) ? sub.total : x.sub)
      + box('Opens', D(x.open_date))
      + box('Closes', D(x.close_date))
      + box('Allotment', D(x.allotment_date))
      + box('Refund', D(x.refund_date))
      + box('Shares credit', D(x.share_credit_date))
      + box('Listing', D(x.listing_date))
      + '</div>'
      + (sub && (has(sub.qib) || has(sub.nii) || has(sub.rii))
        ? '<div class="ipodt-h">Subscription detail</div><div class="ipodt-grid">'
          + box('QIB', sub.qib) + box('NII', sub.nii) + box('Retail', sub.rii) + box('Applications', sub.applications)
          + '</div>' : '')
      + ((has(x.pe) || has(x.pb) || has(x.roe) || has(x.roce) || has(x.eps))
        ? '<div class="ipodt-h">Fundamentals</div><div class="ipodt-grid">'
          + box('P/E', x.pe) + box('P/B', x.pb) + box('ROE', x.roe) + box('ROCE', x.roce) + box('EPS', x.eps)
          + '</div>' : '')
      + perf
      + (links ? '<div class="ipodt-links">' + links + '</div>' : '')
      + '<div class="ipodt-note">GMP is an unofficial grey-market rate, not guaranteed. Data refreshes automatically; verify on the exchange site before investing.</div>'
      + '</div>';
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) close(); });
    el.querySelector('.ipodt-x').addEventListener('click', close);
  }

  document.addEventListener('click', e => {
    const t = e.target && e.target.closest ? e.target.closest('.card .name, .listed-card .listed-name b') : null;
    if (!t || !t.textContent.trim()) return;
    e.preventDefault();
    openSheet(t.textContent.trim());
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
})();
