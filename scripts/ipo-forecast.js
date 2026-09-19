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
