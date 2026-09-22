/* IPO Terminal - Research report module (added 22 Sep).
   Standalone: adds a "Research report" section with a full per-IPO page:
   business, financials, peer comparison, timeline, risk flags, promoter,
   use of funds and application snapshot. Live fields come from the site
   data files; curated notes come from data/research.json. */
(() => {
  if (window.__IPORES) return;
  window.__IPORES = 1;

  const $ = s => document.querySelector(s);
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&'+'amp;','<':'&'+'lt;','>':'&'+'gt;','"':'&'+'quot;',"'":'&'+'#39;'}[c]));
  const num = v => { const m = String(v ?? '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  const pair = v => { const a = String(v ?? '').replace(/\u20b9|,/g, '').match(/\d+(?:\.\d+)?/g); return a && a.length ? {lo:+a[0], hi:+(a[1]||a[0])} : null; };
  const norm = v => String(v ?? '').toLowerCase().replace(/limited|ltd|india|private|pvt|[\W_]/g, '');
  const money = v => Number.isFinite(v) ? '\u20b9' + Math.round(v).toLocaleString('en-IN') : '\u2014';
  const find = (a, n) => { const q = norm(n); return (a||[]).find(x => norm(x.name) === q) || (a||[]).find(x => norm(x.name).includes(q) || q.includes(norm(x.name))); };
  const parseD = v => { const s = String(v||'').trim(); if (!s) return null; const a = s.split(/[\\/-]/).map(Number); if (a.length !== 3 || a.some(isNaN)) return null; if (a[0] > 1900) return new Date(a[0], a[1]-1, a[2]); let y = a[2]; if (y < 100) y += 2000; return new Date(y, a[1]-1, a[0]); };
  const fmtD = d => d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});

  let data = [], research = [], ref = '';

  const status = x => {
    const now = new Date(), o = parseD(x.open_date || x.open), c = parseD(x.close_date || x.close), l = parseD(x.listing_date || x.listing);
    if (l && now >= l) return 'listed';
    if (c) { const z = new Date(c); z.setHours(17,0,0,0); if (now >= z) return 'closed'; }
    if (o) { const z = new Date(o); z.setHours(10,0,0,0); if (now >= z) return 'open'; }
    return 'upcoming';
  };
  const lotInfo = x => { const p = pair(x.price || x.price_band), q = num(x.lot || x.lot_size); return p && q ? {qty:q, cost:p.hi*q} : null; };
  const isSme = x => /sme|emerge/i.test(String(x.board || x.type || ''));

  function report(x) {
    const r = find(research, x.name) || {};
    const l = lotInfo(x);
    const pe = num(x.pe), de = num(x.de), g = num(x.gmp_pct), sub = num(x.total);
    const flags = [];
    if (de != null) flags.push(de > 2 ? 'High debt (D/E ' + de + ')' : de > 1.2 ? 'Elevated debt (D/E ' + de + ')' : 'Debt moderate (D/E ' + de + ')');
    if (pe != null && pe > 45) flags.push('Expensive valuation (P/E ' + pe + ')');
    if (g != null && g <= 2) flags.push('Weak GMP signal (' + g + '%)');
    if (g == null) flags.push('No GMP data yet');
    if (isSme(x)) flags.push('SME: thin liquidity and circuit-limit risk');
    if (r.risk) flags.push(r.risk);
    if (!flags.length) flags.push('No red flags in the available data - still read the RHP risk chapter');
    const now = new Date(); now.setHours(0,0,0,0);
    const steps = [];
    const mk = (label, v) => { const p = parseD(v); steps.push('<span>' + label + '<b>' + (p ? (p < now ? '\u2713 ' : '') + fmtD(p) : E(String(v || '\u2014'))) + '</b></span>'); };
    mk('Opens', x.open_date || x.open); mk('Closes', x.close_date || x.close); mk('Allotment', x.allotment_date || x.allotment); mk('Listing', x.listing_date || x.listing);
    return '<div class="res-head"><b>Research report: ' + E(x.name) + '</b><span>Live fields update automatically. Curated notes come from the video research and the Fundamentals tab. Not investment advice.</span></div>'
      + '<div class="res-box"><b>Business - simple explanation</b><span>' + E(r.business || 'Read the RHP business chapter; summary not collected yet') + '</span></div>'
      + '<div class="res-head"><b>Financials and valuation</b><span>P/E ' + E(x.pe || '\u2014') + ' \u2022 P/B ' + E(x.pb || '\u2014') + ' \u2022 ROE ' + E(x.roe || '\u2014') + ' \u2022 ROCE ' + E(x.roce || '\u2014') + ' \u2022 D/E ' + E(x.de || '\u2014') + ' \u2022 Growth ' + E(x.growth || '\u2014') + ' \u2022 PAT margin ' + E(r.pat_margin || '\u2014') + '</span></div>'
      + '<div class="res-head"><b>Peer comparison</b><span>' + (r.peers ? E(r.peers) : 'Comparable companies: see the RHP comparable-companies section') + (pe != null ? ' \u2022 This IPO P/E ' + pe : '') + '</span></div>'
      + '<div class="res-head"><b>Timeline: RHP - subscription - allotment - listing</b><span>Steps with a check mark are already done.</span></div><div class="res-mini">' + steps.join('') + '</div>'
      + '<div class="res-head"><b>Risk analysis</b><span>' + flags.map(f => E(f)).join('<br>') + '</span></div>'
      + '<div class="res-head"><b>Promoter analysis</b><span>' + E(r.promoter || '\u2014') + '</span></div>'
      + '<div class="res-head"><b>Use of funds</b><span>' + E(r.use_of_funds || '\u2014') + '</span></div>'
      + '<div class="res-head"><b>Application snapshot</b><span>1 lot ' + money(l ? l.cost : NaN) + ' \u2022 allot odds ' + (sub != null && sub > 1 ? '~1 in ' + Math.max(2, Math.round(sub)) : 'near-certain while subscription stays under 1x') + ' \u2022 ' + E(x.board || x.type || '\u2014') + '</span></div>'
      + '<div class="res-rules"><b>Notes:</b> ' + (r.note ? E(r.note) + ' ' : '') + 'Source: ' + (r.source ? E(r.source) : 'live data only') + '. Verify every field against the RHP before applying.</div>';
  }

  function render() {
    const c = $('#ipo-research-content');
    if (!c) return;
    if (!data.length) { c.innerHTML = '<div class="res-empty">Loading research data...</div>'; return; }
    const list = data.filter(x => /^(open|upcoming|closed|listed)$/i.test(status(x)));
    if (!ref && list[0]) ref = list[0].name;
    const x = find(list, ref) || list[0];
    c.innerHTML = '<div class="res-controls"><label>Select IPO for the full research report<select id="res-ref">'
      + list.map(z => '<option value="' + E(z.name) + '"' + (norm(z.name) === norm(x && x.name || '') ? ' selected' : '') + '>' + E(z.name) + ' \u2014 ' + E(status(z)) + (isSme(z) ? ' (SME)' : '') + '</option>').join('')
      + '</select></label></div>' + (x ? report(x) : '<div class="res-empty">No IPO data available yet.</div>');
    const sel = $('#res-ref');
    if (sel) sel.addEventListener('change', e => { ref = e.target.value; render(); });
  }

  function ensure() {
    let s = $('#section-research');
    if (!s) {
      s = document.createElement('section');
      s.id = 'section-research';
      s.className = 'section glass';
      s.innerHTML = '<div class="section-title"><span>🔍 IPO Research Report</span><button class="close" data-close="research">\u2715 Close</button></div><div id="ipo-research-content" class="content"></div>';
      $('main')?.appendChild(s);
    }
    const nav = $('#nav-tools .nav');
    if (nav && !nav.querySelector('[data-section="research"]')) {
      const b = document.createElement('button');
      b.dataset.section = 'research';
      b.textContent = '🔍 Research';
      nav.appendChild(b);
    }
    render();
  }

  async function load() {
    try {
      const urls = ['data/ipos.json', 'data/ipo-data.json', 'data/gmp.json', 'data/research.json'];
      const vals = await Promise.all(urls.map(u => fetch(u + '?d=' + Date.now(), {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null)));
      const arr = v => Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : []);
      const base = arr(vals[0]), rich = arr(vals[1]), gm = arr(vals[2]);
      research = arr(vals[3]);
      data = base.concat(rich).reduce((out, x) => {
        if (!x?.name) return out;
        const y = find(out, x.name);
        if (!y) out.push({...x});
        else Object.keys(x).forEach(k => { if (y[k] == null || y[k] === '' || y[k] === '\u2014') y[k] = x[k]; });
        return out;
      }, []);
      data = data.map(x => { const g = find(gm, x.name); return {...x, ...(g || {})}; });
      ensure();
    } catch (e) { console.error('IPO Research module', e); }
  }

  const st = document.createElement('style');
  st.textContent = '.res-controls{margin-bottom:10px}.res-controls label{font-size:10px;color:var(--muted);font-weight:800}.res-controls select{width:100%;max-width:420px;margin-top:5px;padding:10px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text)}.res-head{padding:10px 0}.res-head span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.res-box{padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(34,197,94,.06);margin-bottom:10px}.res-box span{display:block;color:var(--muted);font-size:11px;margin-top:3px}.res-mini{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin:9px 0}.res-mini span{font-size:9px;color:var(--muted);padding:6px;border:1px solid var(--line);border-radius:9px}.res-mini b{display:block;color:var(--text);font-size:11px}.res-rules{margin-top:14px;padding:11px;border-radius:13px;border:1px solid var(--line);color:var(--muted);font-size:10px;line-height:1.6}.res-rules b{color:var(--text)}.res-empty{text-align:center;padding:25px;color:var(--muted)}@media(max-width:720px){.res-mini{grid-template-columns:repeat(2,1fr)}}';
  document.head.appendChild(st);

  ensure();
  load();
  setInterval(load, 15 * 60 * 1000);
})();
