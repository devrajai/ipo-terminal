/* IPO Coach - the zero-knowledge Decision layer.
   Mixes every signal on the site into ONE plain-language card per IPO:
   price band + lot size + GMP + P/E + TimesFM 3.0 forecast + the video rules
   (25% GMP bar, category odds, Rule of 15 / Rule of 5). Green badge = apply,
   amber = maybe, grey = wait, red = avoid. Written for someone who has never
   applied to an IPO before. */
(() => {
  if (window.__IPOCOACH) return;
  window.__IPOCOACH = 1;

  const E = v => String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
    return c === '&' ? '&' + 'amp;' : c === '<' ? '&' + 'lt;' : c === '>' ? '&' + 'gt;'
      : c === '"' ? '&' + 'quot;' : '&' + '#39;';
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

  let IPO = [], FC = null;

  const findF = name => {
    if (!FC || !FC.ipos) return null;
    const q = norm(name);
    for (const k of Object.keys(FC.ipos)) {
      if (norm(k) === q || norm(k).includes(q) || q.includes(norm(k))) return FC.ipos[k];
    }
    return null;
  };

  function verdict(x) {
    const gp = num(x.gmp_pct), g = num(x.gmp);
    const b = band(x.price), lot = num(x.lot) || 1;
    const cost = b ? Math.round(b.hi * lot) : null;
    const isSme = /sme/i.test(String(x.type || x.board || ''));
    const lotsTxt = cost == null
      ? (isSme ? '2 lots - SME minimum (check lot size on the Open tab)'
               : '1 lot (check lot size on the Open tab)')
      : (isSme ? '2 lots (' + money(cost * 2) + ') - SME minimum'
               : '1 lot (' + money(cost) + ')');
    const f = findF(x.name);
    const fLast = f && f.points && f.points.length ? f.points[f.points.length - 1] : null;
    let score = 0;
    const good = [], bad = [];
    if (gp != null && gp > 0) {
      if (gp >= 25) { score += 3; good.push('GMP +' + gp + '% - above the 25% bar that historically filtered out almost every listing loss'); }
      else if (gp >= 10) { score += 2; good.push('GMP +' + gp + '% - healthy grey-market demand'); }
      else { score += 1; good.push('GMP +' + gp + '% - mild premium'); }
    } else if (gp != null) {
      score -= 3; bad.push('GMP ' + gp + '% - zero or negative premium, weak demand');
    } else {
      bad.push('No GMP quote yet - wait for data before applying');
    }
    if (fLast) {
      const cur = (g != null ? g : 0);
      if (fLast.mid > cur + 0.5) { score += 1; good.push('TimesFM forecast: premium trending UP to ' + money(fLast.mid)); }
      else if (fLast.mid < cur - 0.5) { score -= 1; bad.push('TimesFM forecast: premium softening to ' + money(fLast.mid)); }
      else { good.push('TimesFM forecast: premium holding flat near ' + money(fLast.mid)); }
    }
    const pe = num(x.pe);
    if (pe != null) {
      if (pe > 60) { score -= 1; bad.push('P/E ' + pe + ' - very rich vs listed peers, most of the pop may already be priced in'); }
      else if (pe > 0 && pe < 30) { score += 1; good.push('P/E ' + pe + ' - not expensive for the sector'); }
    }
    if (isSme && (gp == null || gp < 15)) {
      bad.push('SME board: thin liquidity and 5% circuits - keep the amount small');
    }
    const badge = score >= 4 ? ['APPLY', 'go'] : score >= 2 ? ['MAYBE', 'mid'] : score >= 1 ? ['WAIT', 'zero'] : ['AVOID', 'stop'];
    const sub = num(x.sub);
    const chances = (sub != null && sub > 1)
      ? 'about 1 in ' + Math.max(2, Math.round(sub)) + ' (retail ' + sub + 'x subscribed)'
      : 'roughly 1 in 10 if popular - the retail draw is a lottery, every 1-lot applicant is equal';
    const listing = (g != null && b) ? b.lo + g : null;
    const gain = (listing != null && b) ? Math.round(g / b.lo * 1000) / 10 : null;
    const move = 'Apply ' + lotsTxt + ' - retail, day 1-2, UPI, at CUT-OFF price.';
    return { badge: badge, good: good, bad: bad, move: move, chances: chances,
             listing: listing, gain: gain, cost: cost, isSme: isSme };
  }

  function createPanel() {
    let s = document.getElementById('section-coach');
    if (!s) {
      s = document.createElement('section');
      s.id = 'section-coach';
      s.className = 'section glass';
      s.innerHTML = '<div class="section-title"><span>\uD83C\uDF93 IPO Coach - Decisions for Beginners</span><button class="close" data-close="coach">\u2715 Close</button></div><div id="coach-content" class="content"></div>';
      document.querySelector('main')?.appendChild(s);
    }
    let nav = document.querySelector('#nav-tools');
    if (nav && nav.tagName !== 'NAV') nav = nav.querySelector('nav') || nav;
    if (nav && !nav.querySelector('[data-section="coach"]')) {
      const b = document.createElement('button');
      b.dataset.section = 'coach';
      b.textContent = '\uD83C\uDF93 Coach';
      nav.appendChild(b);
    }
    const st = document.createElement('style');
    st.textContent = '.coach-intro{padding:14px;border-radius:16px;background:rgba(34,197,94,.07);border:1px solid rgba(34,197,94,.25);margin-bottom:12px}.coach-intro b{font-size:15px}.coach-intro ol{margin:8px 0 0 18px;padding:0;display:grid;gap:4px}.coach-intro li{font-size:12.5px;line-height:1.55;color:var(--muted)}.coach-card{padding:16px}.coach-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px}.coach-head b{font-size:17px}.coach-badge{flex-shrink:0;border-radius:999px;padding:6px 12px;font-size:12px;font-weight:900;letter-spacing:.4px}.coach-badge.go{background:rgba(34,197,94,.16);color:#22c55e;border:1px solid rgba(34,197,94,.45)}.coach-badge.mid{background:rgba(251,191,36,.14);color:#fbbf24;border:1px solid rgba(251,191,36,.4)}.coach-badge.zero{background:rgba(148,163,184,.14);color:#cbd5e1;border:1px solid rgba(148,163,184,.4)}.coach-badge.stop{background:rgba(239,68,68,.14);color:#ef4444;border:1px solid rgba(239,68,68,.45)}.coach-meta{margin-top:4px;font-size:12px;color:var(--muted)}.coach-why{margin:10px 0 0;padding:0 0 0 4px;list-style:none;display:grid;gap:5px}.coach-why li{font-size:12.5px;line-height:1.5;padding-left:20px;position:relative;color:var(--text)}.coach-why li::before{position:absolute;left:0}.coach-why li.ok::before{content:"\u2713";color:#22c55e;font-weight:900}.coach-why li.no::before{content:"\u2717";color:#ef4444;font-weight:900}.coach-move{margin-top:12px;padding:11px 13px;border-radius:13px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.25);font-size:13px;line-height:1.55}.coach-move b{display:block;margin-bottom:2px}.coach-row{margin-top:10px;display:grid;gap:6px;font-size:12px;color:var(--muted);line-height:1.55}.coach-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}@media(max-width:720px){.coach-grid{grid-template-columns:1fr}}';
    document.head.appendChild(st);
  }

  function card(x) {
    const v = verdict(x);
    const why = v.good.map(t => '<li class="ok">' + E(t) + '</li>').join('')
              + v.bad.map(t => '<li class="no">' + E(t) + '</li>').join('');
    const listing = v.listing != null
      ? 'If allotted: est listing \u2248 ' + money(v.listing)
        + (v.gain != null ? ' (' + (v.gain > 0 ? '+' : '') + v.gain + '% over the low band)' : '')
        + ' - sell per ' + (v.isSme ? 'Rule of 5 (SME, Tip 19)' : 'Rule of 15 (mainboard, Tip 18)') + '.'
      : 'If allotted: follow ' + (v.isSme ? 'Rule of 5' : 'Rule of 15') + ' on listing day (Tips 18-19).';
    return '<article class="card glass coach-card"><div class="coach-head"><b>' + E(x.name) + '</b>'
      + '<span class="coach-badge ' + v.badge[1] + '">' + v.badge[0] + '</span></div>'
      + '<div class="coach-meta">' + E(x.type || 'Mainboard') + ' \u2022 '
      + (v.cost ? '1 lot \u2248 ' + money(v.cost) + ' \u2022 ' : '')
      + (x.close ? 'closes ' + E(x.close) : '') + '</div>'
      + (why ? '<ul class="coach-why">' + why + '</ul>' : '')
      + '<div class="coach-move"><b>Your move</b>' + E(v.move) + '</div>'
      + '<div class="coach-row"><span>\uD83C\uDFAF Chances: ' + E(v.chances) + '</span><span>\uD83D\uDCC8 ' + E(listing) + '</span></div>'
      + '</article>';
  }

  function render() {
    const el = document.getElementById('coach-content');
    if (!el) return;
    const now = new Date();
    const live = IPO.filter(x => x && x.name);
    if (!live.length) {
      el.innerHTML = '<div class="empty">No IPO data available yet.</div>';
      return;
    }
    const scored = live.map(x => ({ x: x, v: verdict(x) }))
      .sort((a, b) => score(b.v) - score(a.v));
    el.innerHTML =
      '<div class="coach-intro"><b>\uD83C\uDF93 Your first IPO in 7 steps</b><ol>'
      + '<li>Open a demat account with any broker (see the Brokers tab).</li>'
      + '<li>Set your UPI mandate limit (\u20B92-5L) in your UPI app - this is how application money gets blocked.</li>'
      + '<li>Pick an IPO from the cards below - green APPLY badge first.</li>'
      + '<li>Apply on day 1-2, never the last evening (UPI mandates fail late).</li>'
      + '<li>Apply the minimum lot at CUT-OFF price - more lots do NOT raise your chances.</li>'
      + '<li>Money stays in your bank; it is blocked only if you win the allotment.</li>'
      + '<li>Check allotment on CDSL / NSDL / your broker the evening before listing, then follow Rule of 15 (mainboard) or Rule of 5 (SME) - Tips 18-19.</li>'
      + '</ol></div>'
      + '<div class="coach-grid">' + scored.map(s => card(s.x)).join('') + '</div>'
      + '<div class="coach-row" style="margin-top:12px">Signals mix GMP, P/E, subscription and the daily TimesFM 3.0 forecast. Research heuristics for education - not guaranteed returns. One PAN, one application always.</div>';
  }

  function score(v) {
    return v.good.length * 2 - v.bad.length * 2 + (v.badge[0] === 'APPLY' ? 3 : v.badge[0] === 'MAYBE' ? 1 : 0);
  }

  async function load() {
    try {
      const urls = ['data/ipo-data.json', 'data/ipos.json', 'data/forecasts.json'];
      const vals = await Promise.all(urls.map(u =>
        fetch(u + '?d=' + Date.now(), { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null).catch(() => null)));
      const rich = (vals[0] && vals[0].ipos) || [];
      const base = Array.isArray(vals[1]) ? vals[1] : ((vals[1] && vals[1].ipos) || []);
      FC = vals[2];
      const out = [];
      for (const x of rich) if (x && x.name) out.push({ ...x });
      for (const x of base) {
        if (!x || !x.name) continue;
        const y = out.find(z => norm(z.name) === norm(x.name));
        if (!y) out.push({ ...x });
        else Object.keys(x).forEach(k => { if (y[k] == null || y[k] === '') y[k] = x[k]; });
      }
      IPO = out;
      createPanel();
      render();
    } catch (e) {
      console.warn('coach load error', e);
    }
  }

  load();
  setInterval(load, 15 * 60 * 1000);
})();
