/* IPO Terminal - GMP history sparklines + forecast band + weekly movers.
   Draws a small SVG on every open/upcoming card: solid line = actual daily
   GMP (history.json), dashed line + shaded band = TimesFM 3-day forecast.
   Nobody else shows a GMP *trend + forecast* on the card itself. */
(() => {
  if (window.__IPOSPARK) return;
  window.__IPOSPARK = 1;

  const norm = v => String(v || '').toLowerCase()
    .replace(/limited|ltd|india|private|pvt|[\W_]/g, '');
  const fmt = v => (v < 0 ? '-\u20B9' : '\u20B9') + Math.round(Math.abs(v));

  let H = null, F = null;

  const series = name => {
    if (!H || !H.series) return null;
    const q = norm(name);
    if (!q) return null;
    for (const k of Object.keys(H.series)) {
      if (norm(k) === q || norm(k).includes(q) || q.includes(norm(k))) {
        return H.series[k].filter(p => p && Number.isFinite(p.gmp));
      }
    }
    return null;
  };
  const fc = name => {
    if (!F || !F.ipos) return null;
    const q = norm(name);
    for (const k of Object.keys(F.ipos)) {
      if (norm(k) === q || norm(k).includes(q) || q.includes(norm(k))) return F.ipos[k];
    }
    return null;
  };

  function sparkSVG(pts, f) {
    const fp = (f && f.points || []).filter(p => p && Number.isFinite(p.mid));
    if (pts.length < 2) return null;
    const up = pts[pts.length - 1].gmp >= pts[0].gmp;
    const col = up ? '#22c55e' : '#ef4444';
    const W = 132, Hh = 34, P = 3;
    const vals = pts.map(p => p.gmp).concat(fp.map(p => p.mid));
    if (fp.length) vals.push(fp[fp.length - 1].high, fp[fp.length - 1].low);
    const lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    const rng = (hi - lo) || 1;
    const N = pts.length + fp.length;
    const X = i => P + i * (W - 2 * P) / Math.max(1, N - 1);
    const Y = v => Hh - P - (v - lo) / rng * (Hh - 2 * P);
    let s = '<svg viewBox="0 0 ' + W + ' ' + Hh + '" width="' + W + '" height="' + Hh + '" style="display:block">';
    if (fp.length) {
      const b = [];
      for (let i = 0; i < fp.length; i++) b.push(X(pts.length + i) + ',' + Y(fp[i].high));
      for (let i = fp.length - 1; i >= 0; i--) b.push(X(pts.length + i) + ',' + Y(fp[i].low));
      s += '<polygon points="' + b.join(' ') + '" fill="rgba(59,130,246,.14)"/>';
      let d = 'M' + X(pts.length - 1) + ',' + Y(pts[pts.length - 1].gmp);
      fp.forEach((p, i) => { d += ' L' + X(pts.length + i) + ',' + Y(p.mid); });
      s += '<path d="' + d + '" fill="none" stroke="#3b82f6" stroke-width="1.4" stroke-dasharray="3 2.5"/>';
    }
    let pl = '';
    pts.forEach((p, i) => { pl += (i ? 'L' : 'M') + X(i) + ',' + Y(p.gmp); });
    s += '<path d="' + pl + '" fill="none" stroke="' + col + '" stroke-width="1.7"/>';
    pts.forEach((p, i) => { s += '<circle cx="' + X(i) + '" cy="' + Y(p.gmp) + '" r="1.6" fill="' + col + '"/>'; });
    s += '</svg>';
    return s;
  }

  function inject() {
    ['#open-list', '#upcoming-list'].forEach(sel => {
      document.querySelectorAll(sel + ' .card').forEach(card => {
        if (card.querySelector('.spark-box')) return;
        const nameEl = card.querySelector('.name');
        if (!nameEl) return;
        const p = series(nameEl.textContent);
        if (!p || p.length < 2) return;
        const svg = sparkSVG(p, fc(nameEl.textContent));
        if (!svg) return;
        const box = document.createElement('div');
        box.className = 'box spark-box';
        const f = fc(nameEl.textContent);
        const d = p[p.length - 1].gmp - p[0].gmp;
        box.title = 'Daily GMP so far: ' + fmt(p[0].gmp) + ' \u2192 ' + fmt(p[p.length - 1].gmp)
          + (f && f.points && f.points.length ? '. Dashed = TimesFM 3-day forecast.' : '');
        box.innerHTML = 'GMP trend (' + p.length + 'd)<b style="color:' + (d >= 0 ? '#22c55e' : '#ef4444') + '">'
          + (d >= 0 ? '+' : '') + fmt(d) + '</b>' + svg;
        const grid = card.querySelector('.grid');
        if (grid) grid.appendChild(box);
      });
    });
    movers();
  }

  function movers() {
    if (!H || !H.series || document.getElementById('gmp-movers')) return;
    const rows = [];
    Object.keys(H.series).forEach(k => {
      const s = H.series[k].filter(p => p && Number.isFinite(p.gmp));
      if (s.length >= 2) rows.push({ n: k, d: s[s.length - 1].gmp - s[0].gmp, last: s[s.length - 1] });
    });
    const top = rows.filter(r => r.d > 0).sort((a, b) => b.d - a.d).slice(0, 3);
    if (!top.length) return;
    const c = document.querySelector('#section-gmp .content');
    if (!c) return;
    const el = document.createElement('div');
    el.id = 'gmp-movers';
    el.className = 'card glass';
    el.style.marginBottom = '10px';
    el.innerHTML = '\uD83D\uDD25 GMP movers since tracking began: '
      + top.map(t => '<b>' + t.n.replace(/ Limited$/, '') + '</b> '
        + '<span style="color:#22c55e">+' + fmt(t.d) + '</span> (now ' + fmt(t.last.gmp) + ')').join(' \u2022 ');
    c.insertBefore(el, c.firstChild);
  }

  async function load() {
    const r = await Promise.all(['data/history.json', 'data/forecasts.json'].map(u =>
      fetch(u + '?d=' + Date.now(), { cache: 'no-store' })
        .then(x => x.ok ? x.json() : null).catch(() => null)));
    H = r[0]; F = r[1];
    inject();
  }

  load().catch(() => {});
  setInterval(inject, 5000);                              // DOM-only re-inject, no network
  setInterval(() => { load().catch(() => {}); }, 900000); // refetch data every 15 min
})();
/* Research + Calendar modules loader (added 22 Sep). */
(() => {
  ['scripts/ipo-research.js', 'scripts/ipo-calendar.js'].forEach(s => {
    const t = document.createElement('script');
    t.src = s;
    document.head.appendChild(t);
  });
})();
