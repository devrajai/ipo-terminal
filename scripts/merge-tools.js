/* Smart Tools v4: All-in-One research desk.
   One tab = market pulse + quick picks + scored cards (expandable dossier:
   lanes, anchors, peer compare, analyst checklist) + compare-all + anchor
   books + listed track record + how-we-score. Pro Tools stays for interactive
   tools. No auto-open on load; remembers last tab. */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { 38: '&'+'amp;', 60: '&'+'lt;', 62: '&'+'gt;', 34: '&'+'quot;', 39: '&#39;' }[c.charCodeAt(0)]; }); };
  var num = function (v) { var m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };
  function secOf(n) { return document.getElementById('section-' + n); }

  function pd(v, end) {
    if (!v) return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), end ? 23 : 0, end ? 59 : 0); return isNaN(d.getTime()) ? null : d; }
    m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2}|\d{4})/);
    if (m) { var y = Number(m[3]); if (y < 100) y += 2000; var d2 = new Date(y, Number(m[2]) - 1, Number(m[1]), end ? 23 : 0, end ? 59 : 0); return isNaN(d2.getTime()) ? null : d2; }
    return null;
  }

  var DET = null, HIST = null, LISTED = null, tried = false;
  function norm(s) { return String(s || '').toLowerCase().replace(/limited|ltd|\.|\s+/g, ''); }
  function detailFor(name) {
    if (!DET) return null;
    var q = norm(name);
    for (var k in DET) { var kk = norm(k); if (kk === q || kk.indexOf(q) >= 0 || q.indexOf(kk) >= 0) return DET[k]; }
    return null;
  }
  function histFor(name) {
    if (!HIST || !HIST.series) return null;
    var q = norm(name);
    for (var k in HIST.series) { if (norm(k) === q || norm(k).indexOf(q) >= 0 || q.indexOf(norm(k)) >= 0) return HIST.series[k]; }
    return null;
  }
  function ensureExtra() {
    if (tried) return;
    tried = true;
    fetch('data/ipo-details.json?d=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.ipos) DET = d.ipos; }).catch(function () {});
    fetch('data/history.json?d=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (d && d.series) HIST = d; }).catch(function () {});
    fetch('data/listed.json?d=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { if (Array.isArray(d)) LISTED = d; }).catch(function () {});
  }

  /* 5-lane signal, same maths as Pro Tools Why and Sources */
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
    return { score: score, lanes: lanes, why: why, gmp: gp, sub: sub, roe: roe, pe: pe, g: g };
  }

  function verdictOf(sig, upcoming) {
    if (upcoming) return ['WAIT', '#94a3b8', 'opens soon - watch the anchor book on day -1'];
    if (sig.gmp != null && sig.gmp < 0) return ['AVOID', '#ef4444', 'GMP is negative'];
    if (sig.score >= 68 && (sig.gmp == null || sig.gmp >= 5)) return ['GO', '#22c55e', 'strong evidence across lanes'];
    if (sig.score >= 45) return ['CAREFUL', '#fbbf24', 'mixed evidence - read the RHP points first'];
    return ['AVOID', '#ef4444', 'weak evidence - high risk'];
  }

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

  function scoreBar(score) {
    var col = score >= 68 ? '#22c55e' : score >= 45 ? '#fbbf24' : '#ef4444';
    return '<div style="flex:1;min-width:90px">'
      + '<div style="height:8px;border-radius:6px;background:rgba(148,163,184,.15);overflow:hidden">'
      + '<div style="height:100%;width:' + Math.max(3, score) + '%;border-radius:6px;background:linear-gradient(90deg,' + col + 'cc,' + col + ')"></div></div>'
      + '<div style="font-size:10px;color:var(--muted);margin-top:3px">fundamental level <b style="color:' + col + '">' + score + '/100</b></div></div>';
  }

  function classify(list) {
    var now = new Date();
    return list.filter(function (x) { return x && x.name; }).map(function (x) {
      var o = pd(x.open || x.open_date), c = pd(x.close || x.close_date, true);
      var st = String(x.status || '').toLowerCase();
      x._up = !(st === 'open' || (c && c >= now && (!o || o <= now)));
      x._sme = /sme/i.test(String(x.type || x.board || ''));
      return x;
    });
  }

  /* ---------------- All-in-One ---------------- */
  function createAioSection() {
    if (secOf('allinone')) return;
    var s = document.createElement('section');
    s.id = 'section-allinone';
    s.className = 'section glass';
    s.innerHTML = '<div class="section-title"><span>\u{1F9E0} Smart Tools \u2014 All-in-One research desk</span><button class="close" data-close="allinone">\u2715 Close</button></div>'
      + '<div id="smart-aio-content" class="content"><div class="pt-hint">Loading the full desk\u2026</div></div>';
    var anchor = secOf('decision');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(s, anchor);
    else (document.querySelector('main') || document.body).appendChild(s);
  }

  var LANE_DEF = [
    ['b', 'B \u2014 Business', 'growth + ROE together'],
    ['v', 'V \u2014 Valuation', 'P/E vs market'],
    ['d', 'D \u2014 Demand', 'subscription multiples'],
    ['g', 'G \u2014 Grey market', 'GMP % (unofficial street price)'],
    ['s', 'S \u2014 Structure', 'debt on the balance sheet']
  ];

  function laneRow(k, label, mean, v) {
    var col = v >= 70 ? '#22c55e' : v >= 50 ? '#fbbf24' : '#ef4444';
    return '<div style="display:flex;align-items:center;gap:8px;margin-top:6px">'
      + '<div style="width:118px;font-size:10.5px;font-weight:700">' + label + '<div style="font-weight:400;color:var(--muted);font-size:9px">' + mean + '</div></div>'
      + '<div style="flex:1;height:7px;border-radius:5px;background:rgba(148,163,184,.15);overflow:hidden"><div style="height:100%;width:' + Math.max(3, v) + '%;background:' + col + '"></div></div>'
      + '<b style="width:30px;text-align:right;font-size:11px;color:' + col + '">' + v + '</b></div>';
  }

  function chip(ok, warn, text) {
    var c = ok ? 'rgba(34,197,94,.13);color:#22c55e' : warn ? 'rgba(251,191,36,.13);color:#fbbf24' : 'rgba(148,163,184,.13);color:#cbd5e1';
    return '<span style="font-size:10px;padding:3px 8px;border-radius:7px;background:' + c + '">' + (ok ? '\u2713 ' : warn ? '\u26A0 ' : '\u2013 ') + esc(text) + '</span>';
  }

  function renderAio() {
    var el = document.getElementById('smart-aio-content');
    if (!el) return;
    ensureExtra();
    fetch('data/ipo-data.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var ipos = (d && (d.ipos || d.data)) || [];
        var all = classify(ipos).map(function (x) { x._sig = signal(x, detailFor(x.name) || {}); return x; })
          .sort(function (a, b) { return b._sig.score - a._sig.score; });
        var open = all.filter(function (x) { return !x._up; });

        /* peer averages per board */
        function avgOf(list, pick) {
          var s = 0, n = 0;
          list.forEach(function (x) { var v = pick(x); if (v != null) { s += v; n++; } });
          return n ? Math.round(s / n * 10) / 10 : null;
        }
        var mb = all.filter(function (z) { return !z._sme; });
        var sme = all.filter(function (z) { return z._sme; });
        var avgs = {};
        [['mb', mb], ['sme', sme]].forEach(function (p) {
          avgs[p[0]] = {
            g: avgOf(p[1], function (z) { return z._sig.g; }),
            pe: avgOf(p[1], function (z) { return z._sig.pe; }),
            gmp: avgOf(p[1], function (z) { return z._sig.gmp; }),
            sub: avgOf(p[1], function (z) { return z._sig.sub; })
          };
        });

        /* pulse tiles */
        var gSum = 0, gN = 0;
        open.forEach(function (x) { var g = num(x.gmp_pct); if (g != null && g >= -50 && g <= 150) { gSum += g; gN++; } });
        var avgG = gN ? Math.round(gSum / gN) : null;
        var nextClose = null;
        open.forEach(function (x) { var c = pd(x.close || x.close_date, true); if (c && (!nextClose || c < nextClose.d)) nextClose = { d: c, x: x }; });
        var tile = function (label, val, sub) {
          return '<div style="flex:1;min-width:125px;padding:12px 14px;border:1px solid var(--bd);border-radius:13px;background:var(--card2)">'
            + '<div style="font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);font-weight:800">' + label + '</div>'
            + '<div style="font-size:21px;font-weight:800;margin-top:2px">' + val + '</div>'
            + (sub ? '<div style="font-size:10px;color:var(--muted);margin-top:1px">' + sub + '</div>' : '') + '</div>';
        };

        /* quick picks */
        var clamp = function (v, hi) { v = num(v); return v == null ? 0 : Math.max(0, Math.min(v, hi)); };
        var scored = open.map(function (x) {
          var g = num(x.gmp_pct); if (!(g != null && g >= -50 && g <= 150)) g = 0;
          x._q = Math.round(0.45 * Math.max(0, Math.min(g, 60)) + 0.35 * clamp(x.total != null ? x.total : x.sub, 40) + 0.2 * clamp(x.growth, 50));
          x._g = g;
          return x;
        }).sort(function (a, b) { return b._q - a._q; });
        var pickList = function (list) {
          if (!list.length) return '<div class="pt-hint" style="margin-top:4px">None open right now.</div>';
          return list.slice(0, 3).map(function (x, i) {
            return '<div style="display:flex;align-items:center;gap:9px;padding:7px 11px;border:1px solid var(--bd);border-radius:11px;background:var(--card2);margin-top:6px;cursor:pointer" data-card="' + esc(x.name) + '">'
              + '<b style="font-size:12.5px;color:' + (i === 0 ? '#22c55e' : '#fbbf24') + '">#' + (i + 1) + '</b>'
              + '<div style="flex:1;min-width:0"><b style="font-size:12.5px">' + esc(x.name.replace(/ Limited$/, '')) + (x._sme ? ' <span style="font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(168,85,247,.15);color:#c084fc;font-weight:800">SME</span>' : ' <span style="font-size:9px;padding:1px 6px;border-radius:5px;background:rgba(59,130,246,.15);color:#93c5fd;font-weight:800">MB</span>') + '</b>'
              + '<div style="font-size:10px;color:var(--muted)">closes ' + esc(x.close || x.close_date || '\u2014') + '</div></div>'
              + '<div style="text-align:right"><b style="color:' + (x._g >= 10 ? '#22c55e' : x._g >= 0 ? '#fbbf24' : '#ef4444') + ';font-size:12px">' + (x._g > 0 ? '+' : '') + x._g + '% GMP</b>'
              + '<div style="font-size:10px;color:var(--muted)">quick ' + x._q + '/100</div></div></div>';
          }).join('');
        };

        /* full dossier card */
        function cardHtml(x) {
          var sig = x._sig, v = verdictOf(sig, x._up);
          var band = String(x.price || '').match(/(\d[\d,]*)\s*[-\u2013]\s*(\d[\d,]*)/);
          var hi = band ? Number(band[2].replace(/,/g, '')) : null;
          var cost = (hi && num(x.lot)) ? '\u20B9' + (hi * num(x.lot)).toLocaleString('en-IN') : '\u2014';
          var det = detailFor(x.name) || {};
          var anc = det.anchor || null;
          var kpi = det.kpi || {};
          var hs = histFor(x.name);
          var trend = null, peak = null, cur = null;
          if (hs && hs.length >= 2) {
            var gs = hs.filter(function (p) { return p && Number.isFinite(p.gmp); }).map(function (p) { return p.gmp; });
            if (gs.length >= 2) trend = gs[gs.length - 1] - gs[0];
          }
          if (hs) {
            var gsp = hs.filter(function (p) { return p && Number.isFinite(p.gmp); }).map(function (p) { return p.gmp; });
            if (gsp.length) { cur = gsp[gsp.length - 1]; peak = Math.max.apply(null, gsp); }
          }
          var rsub = num(x.retail) != null ? num(x.retail) : (det.subs ? num(det.subs.rii) : null);
          var A = avgs[x._sme ? 'sme' : 'mb'];

          /* analyst checklist */
          var prom = num(x.prom);
          var fresh = num(x.fresh), ofs = num(x.ofs);
          var pm = num(kpi.pat_margin);
          var ck = '';
          ck += chip(prom != null && prom >= 20, prom != null && prom < 20, prom != null ? 'promoter stake ' + esc(x.prom) : 'promoter stake not in data');
          ck += chip(fresh == null || fresh > 0, fresh != null && fresh === 0 && ofs > 0, (fresh != null && fresh === 0 && ofs > 0) ? '100% OFS - no fresh money to company' : 'fresh issue ' + (fresh != null ? '\u20B9' + fresh + ' cr' : '\u2014'));
          ck += chip(anc != null && num(anc.investors) >= 10, false, anc && (anc.total_cr != null || anc.investors) ? 'anchor book: \u20B9' + num(anc.total_cr) + ' cr, ' + num(anc.investors) + ' investors' : 'anchor book not published yet');
          ck += chip(pm != null && pm >= 15, pm != null && pm < 15, pm != null ? 'PAT margin ' + esc(kpi.pat_margin) : 'PAT margin not in data');
          ck += chip(trend != null && trend >= 0, trend != null && trend < 0, trend != null ? ('GMP trend ' + (trend >= 0 ? 'rising' : 'cooling') + ' (' + (trend >= 0 ? '+' : '') + trend + ')') : 'GMP trend: first data point');
          if (peak != null && cur != null && peak > cur + 2) ck += chip(false, true, 'GMP topped out: cooled from peak ' + peak + ' to ' + cur + ' - like BSE and HDB before listing');

          /* peer compare */
          var cmp = function (label, mine, avg, inv) {
            if (mine == null || avg == null) return '';
            var better = inv ? mine <= avg : mine >= avg;
            return '<div style="display:flex;justify-content:space-between;font-size:10.5px;padding:3px 0;border-bottom:1px dashed rgba(148,163,184,.15)"><span>' + label + '</span><span><b style="color:' + (better ? '#22c55e' : '#fbbf24') + '">' + mine + '</b> <span style="color:var(--muted)">vs ' + avg + ' avg</span></span></div>';
          };
          var peer = cmp('Growth %', sig.g, A.g) + cmp('P/E', sig.pe, A.pe, true) + cmp('GMP %', sig.gmp, A.gmp) + cmp('Subscription (x)', sig.sub, A.sub);
          if (!peer) peer = '<div style="font-size:10.5px;color:var(--muted);padding:3px 0">Not enough peer data yet.</div>';

          var lanes = LANE_DEF.map(function (l) { return laneRow(l[0], l[1], l[2], sig.lanes[l[0]]); }).join('');

          return '<article style="padding:13px 14px;border:1px solid var(--bd);border-radius:15px;background:var(--card2);margin-bottom:10px" data-name="' + esc(x.name) + '">'
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
            + (rsub != null ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(59,130,246,.10);color:#93c5fd">Allotment ' + (rsub < 1 ? 'near-certain (retail under 1x)' : 'chance ~1 in ' + Math.max(1, Math.ceil(rsub))) + '</span>' : '')
            + (x.pe && x.pe !== '\u2014' ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(148,163,184,.13);color:#cbd5e1">P/E ' + esc(x.pe) + '</span>' : '')
            + (x.roe && x.roe !== '\u2014' ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(148,163,184,.13);color:#cbd5e1">ROE ' + esc(x.roe) + '</span>' : '')
            + (sig.why.length ? '<span style="font-size:10.5px;padding:4px 9px;border-radius:8px;background:rgba(59,130,246,.10);color:#93c5fd">' + esc(sig.why.slice(0, 3).join(' \u00B7 ')) + '</span>' : '')
            + '</div>'
            + '<button type="button" data-x="' + esc(x.name) + '" style="margin-top:10px;width:100%;padding:8px;border:1px dashed rgba(148,163,184,.35);border-radius:10px;background:transparent;color:#93c5fd;font-size:11.5px;font-weight:700;cursor:pointer">\u25BE Full dossier \u2014 lanes, anchors, peers, checklist</button>'
            + '<div class="mt-det" style="display:none;margin-top:10px;border-top:1px solid var(--bd);padding-top:10px">'
            + '<div style="font-size:11px;font-weight:800;margin-bottom:2px">\u{1F9EE} How we scored this IPO (0-100 each lane)</div>'
            + lanes
            + '<div style="font-size:11px;font-weight:800;margin:12px 0 4px">\u2696\uFE0F vs ' + (x._sme ? 'SME' : 'Mainboard') + ' average</div>' + peer
            + '<div style="font-size:11px;font-weight:800;margin:12px 0 4px">\u2705 Analyst checklist (RHP points)</div>'
            + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + ck + '</div>'
            + (x.source_url ? '<div style="font-size:10px;color:var(--muted);margin-top:10px">Source: <a href="' + esc(x.source_url) + '" target="_blank" rel="noopener" style="color:#93c5fd">' + esc(String(x.source_url).slice(0, 60)) + '</a></div>' : '')
            + '</div>'
            + '<div style="font-size:9.5px;color:var(--muted);margin-top:7px">' + v[2] + ' \u00B7 missing data counts neutral (50), never invented \u00B7 full maths in the How-we-score block below.</div>'
            + '</article>';
        }

        var sec = function (title, list) {
          if (!list.length) return '';
          return '<div style="font-size:13px;font-weight:800;margin:14px 0 6px">' + title + ' (' + list.length + ')</div>' + list.map(cardHtml).join('');
        };

        /* compare-all table */
        var cmpRows = all.map(function (x) {
          var v = verdictOf(x._sig, x._up);
          return '<tr><td style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(x.name.replace(/ Limited$/, '')) + '</td>'
            + '<td style="font-size:9px;color:' + (x._sme ? '#c084fc' : '#93c5fd') + '">' + (x._sme ? 'SME' : 'MB') + '</td>'
            + '<td><b style="color:' + v[1] + '">' + v[0] + '</b></td>'
            + '<td class="pt-mono">' + x._sig.score + '</td>'
            + '<td class="pt-mono" style="color:' + (x._sig.gmp >= 10 ? '#22c55e' : x._sig.gmp >= 0 ? '#fbbf24' : '#ef4444') + '">' + (x._sig.gmp == null ? '\u2014' : (x._sig.gmp > 0 ? '+' : '') + x._sig.gmp + '%') + '</td>'
            + '<td class="pt-mono">' + (x._sig.sub == null ? '\u2014' : x._sig.sub + 'x') + '</td>'
            + '<td class="pt-mono">' + (x.pe || '\u2014') + '</td>'
            + '<td class="pt-mono">' + (x.roe || '\u2014') + '</td>'
            + '<td class="pt-mono">' + (x.growth || '\u2014') + '</td>'
            + '<td class="pt-mono">' + esc(x.close || x.close_date || '\u2014') + '</td></tr>';
        }).join('');

        /* anchor table */
        var ancRows = '';
        all.forEach(function (x) {
          var a = (detailFor(x.name) || {}).anchor;
          if (a && (a.total_cr != null || a.investors)) {
            ancRows += '<tr><td>' + esc(x.name.replace(/ Limited$/, '')) + '</td><td class="pt-mono">\u20B9' + num(a.total_cr) + ' cr</td><td class="pt-mono">' + num(a.investors) + '</td>'
              + '<td style="font-size:10px;color:' + (num(a.investors) >= 10 ? '#22c55e' : '#fbbf24') + '">' + (num(a.investors) >= 10 ? 'wide institutional interest' : 'few anchors - read carefully') + '</td></tr>';
          }
        });

        /* track record from listed.json */
        var trHtml = '<div class="pt-hint">Real listing outcomes of recently listed IPOs \u2014 the scoreboard every site hides.</div>';
        if (LISTED && LISTED.length) {
          var gs = LISTED.map(function (l) { return num(l.gain_loss_percent); }).filter(function (v) { return v != null; });
          var avg = gs.length ? Math.round(gs.reduce(function (a, b) { return a + b; }, 0) / gs.length * 10) / 10 : null;
          var pos = gs.filter(function (v) { return v > 0; }).length;
          var sorted = LISTED.slice().sort(function (a, b) { return String(b.listing_date || '').localeCompare(String(a.listing_date || '')); });
          var best = sorted.slice().sort(function (a, b) { return num(b.gain_loss_percent) - num(a.gain_loss_percent); })[0];
          var worst = sorted.slice().sort(function (a, b) { return num(a.gain_loss_percent) - num(b.gain_loss_percent); })[0];
          var t2 = function (label, val, sub) {
            return '<div style="flex:1;min-width:120px;padding:11px 13px;border:1px solid var(--bd);border-radius:12px;background:var(--card2)">'
              + '<div style="font-size:9.5px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted);font-weight:800">' + label + '</div>'
              + '<div style="font-size:19px;font-weight:800;margin-top:2px;color:' + sub + '">' + val + '</div></div>';
          };
          trHtml = '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 8px">'
            + t2('Avg listing gain', (avg > 0 ? '+' : '') + avg + '%', avg >= 0 ? '#22c55e' : '#ef4444')
            + t2('Positive listings', pos + ' / ' + gs.length, pos * 2 >= gs.length ? '#22c55e' : '#fbbf24')
            + t2('Best', esc(String(best.name).replace(/ Limited$/, '')) + ' +' + num(best.gain_loss_percent) + '%', '#22c55e')
            + t2('Worst', esc(String(worst.name).replace(/ Limited$/, '')) + ' ' + num(worst.gain_loss_percent) + '%', '#ef4444')
            + '</div><div style="overflow-x:auto"><table class="pt-tbl"><tr><th>IPO</th><th>Listed</th><th>Issue</th><th>Listing</th><th>Now</th><th>Gain</th></tr>'
            + sorted.slice(0, 8).map(function (l) {
              var gp = num(l.gain_loss_percent);
              return '<tr><td>' + esc(String(l.name).replace(/ Limited$/, '')) + '</td><td class="pt-mono">' + esc(String(l.listing_date || '').slice(0, 10)) + '</td><td class="pt-mono">' + num(l.issue_price) + '</td><td class="pt-mono">' + num(l.listing_price) + '</td><td class="pt-mono">' + num(l.current_price) + '</td><td class="pt-mono" style="color:' + (gp >= 0 ? '#22c55e' : '#ef4444') + ';font-weight:800">' + (gp > 0 ? '+' : '') + gp + '%</td></tr>';
            }).join('') + '</table></div>';
        }

        var H2 = '<div class="pt-hint"><b>One desk, every signal.</b> Cards merge Decision scores + Coach verdicts + Why-and-Sources maths. Tap a card\u2019s dossier button for lanes, peers, anchors and the RHP checklist. Everything auto-updates with site data.</div>';

        el.innerHTML = H2
          + '<div style="display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 12px">'
          + tile('Open', open.length, all.filter(function (z) { return z._up; }).length + ' upcoming')
          + tile('Avg GMP', avgG == null ? '\u2014' : (avgG > 0 ? '+' : '') + avgG + '%', 'of open IPOs')
          + tile('Next closing', nextClose ? esc(String(nextClose.x.close || nextClose.x.close_date)) : '\u2014', nextClose ? esc(nextClose.x.name.replace(/ Limited$/, '')) : 'no open IPO')
          + '</div>'
          + (open.length ? '<div style="font-size:13px;font-weight:800;margin:10px 0 2px">\u{1F3C6} Quick picks \u2014 Mainboard</div>' + pickList(scored.filter(function (z) { return !z._sme; }))
            + '<div style="font-size:13px;font-weight:800;margin:12px 0 2px">\u{1F3C6} Quick picks \u2014 SME</div>' + pickList(scored.filter(function (z) { return z._sme; })) : '<div class="pt-hint">No open IPOs right now \u2014 the desk fills in automatically when the next IPO opens.</div>')
          + '<div class="pt-hint" style="margin-top:4px">No FOMO: if the risk-reward is not favorable, skip \u2014 the next IPO always comes. Expect single-digit listing gains on fully-priced big IPOs, not bumper pops.</div>'
          + sec('\u{1F537} Mainboard \u2014 scored cards', mb.filter(function (z) { return !z._up; }))
          + sec('\u{1F7E9} SME \u2014 scored cards', sme.filter(function (z) { return !z._up; }))
          + sec('\u23F3 Upcoming (watch list)', all.filter(function (z) { return z._up; }))
          + '<div style="font-size:13px;font-weight:800;margin:16px 0 6px">\u2696\uFE0F Compare all</div>'
          + '<div style="overflow-x:auto"><table class="pt-tbl"><tr><th>IPO</th><th>Board</th><th>Verdict</th><th>Score</th><th>GMP</th><th>Sub</th><th>P/E</th><th>ROE</th><th>Growth</th><th>Closes</th></tr>' + cmpRows + '</table></div>'
          + '<div style="font-size:13px;font-weight:800;margin:16px 0 6px">\u2693 Anchor books</div>'
          + (ancRows ? '<div class="pt-hint">Anchor books are built one day before an IPO opens \u2014 real institutional money committed.</div><div style="overflow-x:auto"><table class="pt-tbl"><tr><th>IPO</th><th>Anchor total</th><th>Investors</th><th>Read</th></tr>' + ancRows + '</table></div>' : '<div class="pt-hint">No anchor books published for current IPOs yet \u2014 they appear here automatically the day before an IPO opens.</div>')
          + '<div style="font-size:13px;font-weight:800;margin:16px 0 6px">\u{1F3C6} Track record \u2014 listed scoreboard</div>' + trHtml
          + '<div style="font-size:13px;font-weight:800;margin:16px 0 6px">\u{1F9EE} How we score (exact maths)</div>'
          + '<div class="pt-hint"><b>B Business:</b> growth 20%+ = 90, 12%+ = 78, 5%+ = 62, else 38; then blended with ROE (capped 45). <b>V Valuation:</b> P/E up to 20 = 82, up to 35 = 62, up to 50 = 38, above = 22. <b>D Demand:</b> subscription 50x+ = 95, 20x+ = 82, 10x+ = 70, 3x+ = 58, under 1x = 25. <b>G Grey market:</b> GMP 20%+ = 90, 10%+ = 75, 5%+ = 68, 0%+ = 60, negative = 25. <b>S Structure:</b> debt/equity up to 0.3 = 85, up to 0.6 = 70, up to 1.0 = 55, above = 30. Missing data = 50 (neutral) \u2014 never invented. Score = average of the 5 lanes; verdict: 68+ GO, 45+ CAREFUL, below AVOID; negative GMP always AVOID.</div>'
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">'
          + '<button type="button" data-goto="protools" style="flex:1;min-width:150px;text-align:left;padding:12px 14px;border:1px solid rgba(59,130,246,.4);border-radius:13px;background:rgba(59,130,246,.08);cursor:pointer"><div style="font-size:13px;font-weight:800;color:#93c5fd">\u{1F680} Pro Tools</div><div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.5">Interactive tools: My Apps tracker, Planner, Calendar, Why and Sources deep-dive.</div></button>'
          + '</div>'
          + '<div class="pt-hint" style="margin-top:10px">Education and research only \u2014 not investment advice. Data: Chittorgarh offer-document pages, GMP feed, own history log \u2014 auto-refreshed.</div>';

        /* dossier toggle + quick-pick jump */
        el.querySelectorAll('button[data-x]').forEach(function (b) {
          b.onclick = function () {
            var det = b.parentNode.querySelector('.mt-det');
            var open = det && det.style.display !== 'none';
            if (det) det.style.display = open ? 'none' : 'block';
            b.innerHTML = open ? '\u25BE Full dossier \u2014 lanes, anchors, peers, checklist' : '\u25B4 Close dossier';
          };
        });
        el.querySelectorAll('[data-card]').forEach(function (c) {
          c.onclick = function () {
            var t = el.querySelector('article[data-name="' + c.getAttribute('data-card').replace(/"/g, '\\"') + '"] button[data-x]');
            if (t && t.parentNode.querySelector('.mt-det').style.display === 'none') t.click();
            try { if (t) t.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (er) {}
          };
        });
        el.querySelectorAll('button[data-goto]').forEach(function (b) {
          b.onclick = function () { openGroup1(b.getAttribute('data-goto'));
 };
        });
      })
      .catch(function () { el.innerHTML = '<div class="pt-hint">Desk data unavailable right now \u2014 retrying automatically.</div>'; });
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
      try { localStorage.setItem('mt-group-' + cfg.nav, id); } catch (e) {}
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
      if (id === 'allinone') renderAio();
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
      var saved = null;
      try { saved = localStorage.getItem('mt-group-' + cfg.nav); } catch (e) {}
      if (saved && self.subs.some(function (s) { return s.id === saved; })) self.current = saved;
      self.updateBar();
      self.syncNav();
      return true;
    };
  }

  var group1 = new Group({
    nav: 'decision', label: '\u{1F9E0} Smart Tools', def: 'allinone', hide: ['coach'],
    subs: [
      { id: 'allinone', label: '\u{1F4CA} All-in-One' },
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

  createAioSection();

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-close]')) {
      setTimeout(function () { group1.syncNav(); group2.syncNav(); }, 0);
    }
  });

  setInterval(function () {
    if (secOf('allinone') && secOf('allinone').classList.contains('opened')) renderAio();
  }, 15 * 60 * 1000);

  var tries = 0;
  var t = setInterval(function () {
    var a = group1.build(), b = group2.build();
    if ((a && b) || ++tries > 120) clearInterval(t);
  }, 300);
})();
