/* Smart Tools v3:
   - nav: Home | Research (unified Decision+Coach+Why cards) | Pro Tools
   - Results: Closed + Listed
   - Research cards: score bar /100, 5-lane line chart, GO/CAREFUL/AVOID verdict,
     Mainboard & SME split, open + upcoming, auto-refresh. Loaded last. */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { 38: '&'+'amp;', 60: '&'+'lt;', 62: '&'+'gt;', 34: '&'+'quot;', 39: '&#39;' }[c.charCodeAt(0)]; }); };
  var num = function (v) { var m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };

  function secOf(n) { return document.getElementById('section-' + n); }

  /* ---------------- shared helpers ---------------- */
  function pd(v, end) {
    if (!v) return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), end ? 23 : 0, end ? 59 : 0); return isNaN(d.getTime()) ? null : d; }
    m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2}|\d{4})/);
    if (m) { var y = Number(m[3]); if (y < 100) y += 2000; var d2 = new Date(y, Number(m[2]) - 1, Number(m[1]), end ? 23 : 0, end ? 59 : 0); return isNaN(d2.getTime()) ? null : d2; }
    return null;
  }

  var DET = null, detTried = false;
  function detailFor(name) {
    if (!DET) return null;
    var q = String(name || '').toLowerCase().replace(/limited|ltd|\.|\s+/g, '');
    for (var k in DET) {
      var kk = k.toLowerCase().replace(/limited|ltd|\.|\s+/g, '');
      if (kk === q || kk.indexOf(q) >= 0 || q.indexOf(kk) >= 0) return DET[k];
    }
    return null;
  }
  function ensureDetails() {
    if (detTried) return;
    detTried = true;
    fetch('data/ipo-details.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) { if (d && d.ipos) DET = d.ipos; })
      .catch(function () {});
  }

  /* 5-lane signal, same maths as Pro Tools Why & Sources */
  function signal(x, d) {
    d = d || {};
    var kpi = d.kpi || {};
    var roe = num(kpi.roe) != null ? num(kpi.roe) : num(x.roe);
    var roce = num(kpi.roce) != null ? num(kpi.roce) : num(x.roce);
    var de = num(kpi.de) != null ? num(kpi.de) : num(x.de);
    var g = num(x.growth) != null ? num(x.growth) : d.rev_growth;
    var pe = num(x.pe);
    var sub = num(x.total != null ? x.total : x.sub);
    if (sub == null && d.subs && d.subs.total != null) sub = d.subs.total;
    var gp = num(x.gmp_pct);
    if (!(gp != null && gp >= -50 && gp <= 150)) gp = null;
    var lanes = { b: 50, v: 50, d: 50, g: 50, s: 50 };
    if (g != null) lanes.b = g >= 20 ? 90 : g >= 12 ? 78 : g >= 5 ? 62 : 38;
    if (roe != null || roce != null) { var rr = Math.max(roe || 0, roce || 0); lanes.b = Math.round((lanes.b + Math.min(rr, 45) * 1.6) / 2); }
    if (pe != null && pe > 0 && pe < 100) lanes.v = pe <= 20 ? 82 : pe <= 35 ? 62 : pe <= 50 ? 38 : 22;
    if (sub != null) lanes.d = sub >= 50 ? 95 : sub >= 20 ? 82 : sub >= 10 ? 70 : sub >= 3 ? 58 : sub < 1 ? 25 : 45;
    if (gp != null) lanes.g = gp >= 20 ? 90 : gp >= 10 ? 75 : gp >= 5 ? 68 : gp >= 0 ? 60 : 25;
    if (de != null) lanes.s = de <= .3 ? 85 : de <= .6 ? 70 : de <= 1 ? 55 : 30;
    var score = Math.round((lanes.b + lanes.v + lanes.d + lanes.g + lanes.s) / 5);
    var why = [];
    if (g != null && g >= 12) why.push('fast growth');
    if ((roe != null && roe >= 15) || (roce != null && roce >= 15)) why.push('strong ROE');
    if (pe != null && pe > 35 && pe < 100) why.push('rich P/E');
    if (sub != null && sub >= 10) why.push('strong demand');
    if (gp != null && gp >= 10) why.push('positive GMP');
    if (de != null && de > 1) why.push('high debt');
    return { score: score, lanes: lanes, why: why, gmp: gp, sub: sub };
  }

  function verdictOf(sig, upcoming) {
    if (upcoming) return ['WAIT', '#94a3b8', 'opens soon \u2014 watch the anchor book on day -1'];
    if (sig.gmp != null && sig.gmp < 0) return ['AVOID', '#ef4444', 'GMP is negative'];
    if (sig.score >= 68 && (sig.gmp == null || sig.gmp >= 5)) return ['GO', '#22c55e', 'strong evidence across lanes'];
    if (sig.score >= 45) return ['CAREFUL', '#fbbf24', 'mixed evidence \u2014 read the RHP points first'];
    return ['AVOID', '#ef4444', 'weak evidence \u2014 high risk'];
  }

  /* mini line chart: 5 lanes, 0-100 */
  function laneChart(sig) {
    var L = [sig.lanes.b, sig.lanes.v, sig.lanes.d, sig.lanes.g, sig.lanes.s];
    var W = 132, H = 44, P = 6;
    var xs = function (i) { return P + i * (W - 2 * P) / 4; };
    var ys = function (v) { return H - P - (v / 100) * (H - 2 * P); };
    var pts = L.map(function (v, i) { return xs(i).toFixed(1) + ',' + ys(v).toFixed(1); }).join(' ');
    var col = sig.score >= 68 ? '#22c55e' : sig.score >= 45 ? '#fbbf24' : '#ef4444';
    var dots = L.map(function (v, i) { return '<circle cx="' + xs(i).toFixed(1) + '" cy="' + ys(v).toFixed(1) + '" r="2.4" fill="' + (v >= 70 ? '#22c55e' : v >= 50 ? '#fbbf24' : '#ef4444') + '"/>'; }).join('');
    var labels = ['B', 'V', 'D', 'G', 'S'].map(function (t, i) { return '<text x="' + xs(i).toFixed(1) + '" y="' + (H - 0.5) + '" text-anchor="middle" font-size="7" fill="#94a3b8">' + t + '</text>'; }).join('');
    var grid = [50, 100].map(function (v) { return '<line x1="' + P + '" y1="' + ys(v) + '" x2="' + (W - P) + '" y2="' + ys(v) + '" stroke="rgba(148,163,184,.18)" stroke-width="1"/>'; }).join('');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" style="width:132px;max-width:40vw;display:block" aria-label="lane chart">'
      + grid + '<polyline points="' + pts + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-linejoin="round"/>' + dots + labels + '</svg>';
  }

  /* score bar /100 */
  function scoreBar(score) {
    var col = score >= 68 ? '#22c55e' : score >= 45 ? '#fbbf24' : '#ef4444';
    return '<div style="flex:1;min-width:90px">'
      + '<div style="height:8px;border-radius:6px;background:rgba(148,163,184,.15);overflow:hidden">'
      + '<div style="height:100%;width:' + Math.max(3, score) + '%;border-radius:6px;background:linear-gradient(90deg,' + col + 'cc,' + col + ')"></div></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:3px">fundamental level <b style="color:' + col + '">' + score + '/100</b></div></div>';
  }

  /* ---------------- Home dashboard ---------------- */
  function createHomeSection() {
    if (secOf('home')) return;
    var s = document.createElement('section');
    s.id = 'section-home';
    s.className = 'section glass';
    s.innerHTML = '<div class="section-title"><span>🏠 Smart Tools — Home</span><button class="close" data-close="home">✕ Close</button></div>'
      + '<div id="smart-home-content" class="content"><div class="pt-hint">Loading today\u2019s snapshot\u2026</div></div>';
    var anchor = secOf('decision');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(s, anchor);
    else (document.querySelector('main') || document.body).appendChild(s);
  }

  function classify(list) {
    var now = new Date();
    return list.filter(function (x) { return x && x.name; }).map(function (x) {
      var o = pd(x.open || x.open_date), c = pd(x.close || x.close_date, true);
      var st = String(x.status || '').toLowerCase();
      x._up = !(st === 'open' || (c && c >= now && (!o || o <= now)));
      x._sme = /sme/i.test(String(x.type || x.board || ''));
      return x;
    }).filter(function (x) { return !x._up || String(x.status || '').match(/upcoming/i) || true; });
  }

  function renderHome() {
    var el = document.getElementById('smart-home-content');
    if (!el) return;
    fetch('data/ipo-data.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var ipos = (d && (d.ipos || d.data)) || [];
        var now = new Date();
        var all = classify(ipos);
        var open = all.filter(function (x) { return !x._up; });
        var clamp = function (v, hi) { v = num(v); return v == null ? 0 : Math.max(0, Math.min(v, hi)); };
        var scored = open.map(function (x) {
          var g = num(x.gmp_pct); if (!(g != null && g >= -50 && g <= 150)) g = 0;
          x._q = Math.round(0.45 * Math.max(0, Math.min(g, 60)) + 0.35 * clamp(x.total != null ? x.total : x.sub, 40) + 0.2 * clamp(x.growth, 50));
          x._g = g;
          return x;
        }).sort(function (a, b) { return b._q - a._q; });

        var gSum = 0, gN = 0;
        open.forEach(function (x) { var g = num(x.gmp_pct); if (g != null && g >= -50 && g <= 150) { gSum += g; gN++; } });
        var avgG = gN ? Math.round(gSum / gN) : null;
        var nextClose = null;
        open.forEach(function (x) { var c = pd(x.close || x.close_date, true); if (c && (!nextClose || c < nextClose.d)) nextClose = { d: c, x: x }; });

        var tile = function (label, val, sub) {
          return '<div style="flex:1;min-width:130px;padding:13px 15px;border:1px solid var(--bd);border-radius:14px;background:var(--card2)">'
            + '<div style="font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);font-weight:800">' + label + '</div>'
            + '<div style="font-size:22px;font-weight:800;margin-top:3px">' + val + '</div>'
            + (sub ? '<div style="font-size:10.5px;color:var(--muted);margin-top:2px">' + sub + '</div>' : '') + '</div>';
        };
        var tag = function (x) { return x._sme ? '<span style="font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(168,85,247,.15);color:#c084fc;font-weight:800;vertical-align:2px">SME</span>' : '<span style="font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(59,130,246,.15);color:#93c5fd;font-weight:800;vertical-align:2px">MB</span>'; };
        var pickList = function (list) {
          if (!list.length) return '<div class="pt-hint" style="margin-top:5px">None open right now.</div>';
          return list.slice(0, 3).map(function (x, i) {
            return '<div style="display:flex;align-items:center;gap:9px;padding:8px 11px;border:1px solid var(--bd);border-radius:12px;background:var(--card2);margin-top:6px">'
              + '<b style="font-size:12.5px;color:' + (i === 0 ? '#22c55e' : '#fbbf24') + '">#' + (i + 1) + '</b>'
              + '<div style="flex:1;min-width:0"><b style="font-size:13px">' + esc(x.name.replace(/ Limited$/, '')) + ' ' + tag(x) + '</b>'
              + '<div style="font-size:10px;color:var(--muted)">closes ' + esc(x.close || x.close_date || '\u2014') + '</div></div>'
              + '<div style="text-align:right"><b style="color:' + (x._g >= 10 ? '#22c55e' : x._g >= 0 ? '#fbbf24' : '#ef4444') + ';font-size:12px">' + (x._g > 0 ? '+' : '') + x._g + '% GMP</b>'
              + '<div style="font-size:10px;color:var(--muted)">quick ' + x._q + '/100</div></div></div>';
          }).join('');
        };
        var jump = function (id, icon, label, desc) {
          return '<button type="button" data-goto="' + id + '" style="text-align:left;flex:1;min-width:150px;padding:12px 14px;border:1px solid rgba(59,130,246,.4);border-radius:13px;background:rgba(59,130,246,.08);cursor:pointer">'
            + '<div style="font-size:13px;font-weight:800;color:#93c5fd">' + icon + ' ' + label + '</div>'
            + '<div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.5">' + desc + '</div></button>';
        };

        el.innerHTML = '<div class="pt-hint"><b>One place for every tool.</b> Today\u2019s snapshot \u2014 refreshes automatically with site data.</div>'
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:4px 0 12px">'
          + tile('Open IPOs', open.length, (all.filter(function (z) { return z._up; }).length) + ' upcoming')
          + tile('Avg GMP', avgG == null ? '\u2014' : (avgG > 0 ? '+' : '') + avgG + '%', 'of open IPOs')
          + tile('Next closing', nextClose ? esc(String(nextClose.x.close || nextClose.x.close_date)) : '\u2014', nextClose ? esc(nextClose.x.name) : 'no open IPO')
          + '</div>'
          + (open.length ? '<div style="font-size:13px;font-weight:800;margin:10px 0 2px">\u{1F3C6} Quick picks \u2014 Mainboard</div>' + pickList(scored.filter(function (z) { return !z._sme; }))
            + '<div style="font-size:13px;font-weight:800;margin:12px 0 2px">\u{1F3C6} Quick picks \u2014 SME</div>' + pickList(scored.filter(function (z) { return z._sme; }))
            + '<div class="pt-hint" style="margin-top:6px">Fast triage \u2014 full maths, RHP evidence and sources in Pro Tools \u2192 Why & Sources.</div>' : '<div class="pt-hint">No open IPOs right now \u2014 the dashboard fills in automatically when the next IPO opens.</div>')
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">'
          + jump('research', '\u{1F4CA}', 'Research cards', 'Every open + upcoming IPO \u2014 score /100, lanes, GO / CAREFUL / AVOID verdict.')
          + jump('protools', '\u{1F680}', 'Pro Tools', 'Track record, My Apps, calendar, Why & Sources rankings.')
          + '</div>';

        el.querySelectorAll('button[data-goto]').forEach(function (b) {
          b.onclick = function () { openGroup1(b.getAttribute('data-goto'));
 };
        });
      })
      .catch(function () { el.innerHTML = '<div class="pt-hint">Snapshot unavailable right now \u2014 the tools below still work.</div>'; });
  }

  /* ---------------- Research (unified cards) ---------------- */
  function createResearchSection() {
    if (secOf('research')) return;
    var s = document.createElement('section');
    s.id = 'section-research';
    s.className = 'section glass';
    s.innerHTML = '<div class="section-title"><span>📊 Research — every open & upcoming IPO</span><button class="close" data-close="research">✕ Close</button></div>'
      + '<div id="smart-research-content" class="content"><div class="pt-hint">Loading\u2026</div></div>';
    var anchor = secOf('home') || secOf('decision');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(s, anchor.nextSibling);
    else (document.querySelector('main') || document.body).appendChild(s);
  }

  function renderResearch() {
    var el = document.getElementById('smart-research-content');
    if (!el) return;
    ensureDetails();
    fetch('data/ipo-data.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var ipos = (d && (d.ipos || d.data)) || [];
        var all = classify(ipos);
        var cards = all.map(function (x) { x._sig = signal(x, detailFor(x.name) || {}); return x; })
          .sort(function (a, b) { return b._sig.score - a._sig.score; });

        function cardHtml(x) {
          var sig = x._sig, v = verdictOf(sig, x._up);
          var lot = num(x.lot), price = num(String(x.price || '').replace(/[^\d-]/g, ' ').split(' ')[0] || x.price);
          var band = String(x.price || '').match(/(\d[\d,]*)\s*[-\u2013]\s*(\d[\d,]*)/);
          var hi = band ? Number(band[2].replace(/,/g, '')) : null;
          var cost = (hi && lot) ? '\u20B9' + (hi * lot).toLocaleString('en-IN') : '\u2014';
          return '<article style="padding:13px 14px;border:1px solid var(--bd);border-radius:15px;background:var(--card2);margin-bottom:10px">'
            + '<div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;flex-wrap:wrap">'
            + '<div style="min-width:0"><b style="font-size:14.5px">' + esc(x.name.replace(/ Limited$/, '')) + '</b> '
            + (x._sme ? '<span style="font-size:9.5px;padding:2px 7px;border-radius:6px;background:rgba(168,85,247,.15);color:#c084fc;font-weight:800">SME</span>' : '<span style="font-size:9.5px;padding:2px 7px;border-radius:6px;background:rgba(59,130,246,.15);color:#93c5fd;font-weight:800">MAINBOARD</span>')
            + '<div style="font-size:10.5px;color:var(--muted);margin-top:2px">' + (x._up ? 'opens ' + esc(x.open || x.open_date || 'soon') : 'closes ' + esc(x.close || x.close_date || '\u2014')) + ' \u00B7 1 lot \u2248 ' + cost + (x.sector && x.sector !== '\u2014' ? ' \u00B7 ' + esc(String(x.sector).slice(0, 24)) : '') + '</div></div>'
            + '<span style="flex-shrink:0;border-radius:999px;padding:5px 12px;font-size:11px;font-weight:900;letter-spacing:.4px;border:1px solid ' + v[1] + '99;background:' + v[1] + '1f;color:' + v[1] + '">' + v[0] + '</span></div>'
            + '<div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px">'
            + laneChart(sig) + scoreBar(sig.score) + '</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:9px">'
            + '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:' + (sig.gmp == null ? 'rgba(148,163,184,.13);color:#cbd5e1' : sig.gmp >= 10 ? 'rgba(34,197,94,.13);color:#22c55e' : sig.gmp >= 0 ? 'rgba(251,191,36,.13);color:#fbbf24' : 'rgba(239,68,68,.13);color:#ef4444') + '">GMP ' + (sig.gmp == null ? '\u2014' : (sig.gmp > 0 ? '+' : '') + sig.gmp + '%') + '</span>'
            + '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(148,163,184,.13);color:#cbd5e1">Sub ' + (sig.sub == null ? '\u2014' : sig.sub + 'x') + '</span>'
            + (x.pe && x.pe !== '\u2014' ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(148,163,184,.13);color:#cbd5e1">P/E ' + esc(x.pe) + '</span>' : '')
            + (x.roe && x.roe !== '\u2014' ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(148,163,184,.13);color:#cbd5e1">ROE ' + esc(x.roe) + '</span>' : '')
            + (sig.why.length ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(59,130,246,.10);color:#93c5fd">' + esc(sig.why.slice(0, 3).join(' \u00B7 ')) + '</span>' : '')
            + '</div>'
            + '<div style="font-size:9.5px;color:var(--muted);margin-top:7px">' + v[2] + ' \u00B7 lanes: B business \u00B7 V valuation \u00B7 D demand \u00B7 G grey market \u00B7 S structure (debt) \u2014 full maths & sources in Pro Tools \u2192 Why & Sources.</div>'
            + '</article>';
        }

        var mb = cards.filter(function (x) { return !x._sme; });
        var sme = cards.filter(function (x) { return x._sme; });
        var head = '<div class="pt-hint"><b>Mainboard and SME are ranked separately.</b> Each card merges the Decision engine scores, the Coach verdict and the Why & Sources lane maths \u2014 auto-updated with site data. Missing data counts neutral (50), never invented.</div>';
        var sec = function (title, list) {
          if (!list.length) return '';
          return '<div style="font-size:13px;font-weight:800;margin:14px 0 6px">' + title + ' (' + list.length + ')</div>' + list.map(cardHtml).join('');
        };
        el.innerHTML = head
          + sec('\u{1F537} Mainboard', mb)
          + sec('\u{1F7E9} SME', sme)
          + '<div class="pt-hint">Education and research only \u2014 not investment advice. Data: Chittorgarh offer-document pages + GMP feed, refreshed automatically.</div>';
      })
      .catch(function () { el.innerHTML = '<div class="pt-hint">Research data unavailable right now \u2014 retrying automatically.</div>'; });
  }

  /* ---------------- generic group ---------------- */
  function Group(cfg) {
    var self = this;
    this.name = cfg.name;
    this.subs = cfg.subs;
    this.hide = cfg.hide || [];
    this.current = cfg.def;
    this.bar = null;

    this.anyOpen = function () {
      return self.subs.some(function (s) { var x = secOf(s.id); return x && x.classList.contains('opened'); });
    };
    this.syncNav = function () {
      var b = document.querySelector('button[data-section="' + cfg.nav + '"]');
      if (b) b.classList.toggle('active', self.anyOpen());
    };
    this.updateBar = function () {
      if (!self.bar) return;
      self.bar.querySelectorAll('button[data-sub]').forEach(function (b) {
        b.classList.toggle('on', b.getAttribute('data-sub') === self.current);
      });
    };
    this.open = function (id) {
      self.current = id;
      self.subs.forEach(function (s) {
        var x = secOf(s.id);
        if (x) x.classList.toggle('opened', s.id === id);
      });
      var x = secOf(id);
      if (x && self.bar) {
        var title = x.querySelector('.section-title');
        if (title && title.parentNode && title.parentNode !== self.bar.parentNode) {
          title.parentNode.insertBefore(self.bar, title.nextSibling);
        }
        try { x.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
      }
      if (id === 'home') renderHome();
      if (id === 'research') renderResearch();
      self.syncNav();
      self.updateBar();
    };
    this.closeAll = function () {
      self.subs.forEach(function (s) { var x = secOf(s.id); if (x) x.classList.remove('opened'); });
      self.syncNav();
    };
    this.build = function () {
      if (self.bar) return true;
      if (!self.subs.every(function (s) { return !!secOf(s.id); })) return false;
      self.subs.forEach(function (s) {
        if (s.id !== cfg.nav) {
          var b = document.querySelector('button[data-section="' + s.id + '"]');
          if (b) { b.style.display = 'none'; b.setAttribute('aria-hidden', 'true'); }
        }
      });
      self.hide.forEach(function (n) {
        var b = document.querySelector('button[data-section="' + n + '"]');
        if (b) { b.style.display = 'none'; b.setAttribute('aria-hidden', 'true'); }
      });
      var mainBtn = document.querySelector('button[data-section="' + cfg.nav + '"]');
      if (mainBtn) {
        mainBtn.textContent = cfg.label;
        mainBtn.addEventListener('click', function (e) {
          e.stopImmediatePropagation();
          e.preventDefault();
          if (self.anyOpen()) self.closeAll(); else self.open(self.current);
        }, true);
      }
      self.bar = document.createElement('div');
      self.bar.className = 'pt-tabs smart-bar';
      self.bar.style.margin = '0 0 12px';
      self.bar.innerHTML = self.subs.map(function (s) {
        return '<button type="button" data-sub="' + s.id + '">' + s.label + '</button>';
      }).join('');
      self.bar.addEventListener('click', function (e) {
        var b = e.target && e.target.closest ? e.target.closest('button[data-sub]') : null;
        if (b) self.open(b.getAttribute('data-sub'));
      });
      self.open(self.current);
      return true;
    };
  }

  var group1 = new Group({
    nav: 'decision', label: '\u{1F9E0} Smart Tools', def: 'home', hide: ['coach'],
    subs: [
      { id: 'home', label: '\u{1F3E0} Home' },
      { id: 'research', label: '\u{1F4CA} Research' },
      { id: 'protools', label: '\u{1F680} Pro Tools' }
    ]
  });
  var group2 = new Group({
    nav: 'closed', label: '\u26AA Results', def: 'closed',
    subs: [
      { id: 'closed', label: '\u26AA Closed IPOs' },
      { id: 'listed', label: '\u{1F4CA} Listed IPOs' }
    ]
  });

  function openGroup1(id) { group1.open(id); }

  createHomeSection();
  createResearchSection();

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-close]')) {
      setTimeout(function () { group1.syncNav(); group2.syncNav(); }, 0);
    }
  });

  /* auto-refresh every 15 min */
  setInterval(function () {
    if (secOf('home') && secOf('home').classList.contains('opened')) renderHome();
    if (secOf('research') && secOf('research').classList.contains('opened')) renderResearch();
  }, 15 * 60 * 1000);

  var tries = 0;
  var t = setInterval(function () {
    var a = group1.build(), b = group2.build();
    if ((a && b) || ++tries > 120) clearInterval(t);
  }, 300);
})();
