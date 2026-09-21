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
