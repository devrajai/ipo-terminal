/* Smart Tools v2:
   - ONE nav button "🧠 Smart Tools" = 🏠 Home (new) + 🧠 Decision + 🎓 Coach + 🚀 Pro Tools
   - ONE nav button "⚪ Results" = Closed + Listed
   - Nav ends up 3 buttons per group (3x3). Loaded last. */
(function () {
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { 38: '\u0026amp;', 60: '\u0026lt;', 62: '\u0026gt;', 34: '\u0026quot;', 39: '\u0026#39;' }[c.charCodeAt(0)]; }); };
  var num = function (v) { var m = String(v == null ? '' : v).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : null; };

  function secOf(n) { return document.getElementById('section-' + n); }

  /* ---------------- Home dashboard (NEW) ---------------- */
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

  function pd(v, end) {
    if (!v) return null;
    var s = String(v).trim();
    var m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) { var d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), end ? 23 : 0, end ? 59 : 0); return isNaN(d.getTime()) ? null : d; }
    m = s.match(/^(\d{1,2})[\/](\d{1,2})[\/](\d{2}|\d{4})/);
    if (m) { var y = Number(m[3]); if (y < 100) y += 2000; var d2 = new Date(y, Number(m[2]) - 1, Number(m[1]), end ? 23 : 0, end ? 59 : 0); return isNaN(d2.getTime()) ? null : d2; }
    return null;
  }

  function renderHome() {
    var el = document.getElementById('smart-home-content');
    if (!el) return;
    fetch('data/ipo-data.json?d=' + Date.now(), { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (d) {
        var ipos = (d && (d.ipos || d.data)) || [];
        var now = new Date();
        var open = [];
        ipos.forEach(function (x) {
          if (!x || !x.name) return;
          var o = pd(x.open || x.open_date), c = pd(x.close || x.close_date, true);
          var st = String(x.status || '').toLowerCase();
          if (st === 'open' || (c && c >= now && (!o || o <= now))) open.push(x);
        });
        var clamp = function (v, hi) { v = num(v); return v == null ? 0 : Math.max(0, Math.min(v, hi)); };
        var scored = open.map(function (x) {
          var g = num(x.gmp_pct); if (!(g != null && g >= -50 && g <= 150)) g = 0;
          var sub = clamp(x.total != null ? x.total : x.sub, 40);
          var gr = clamp(x.growth, 50);
          x._s = Math.round(0.45 * Math.max(0, Math.min(g, 60)) + 0.35 * sub + 0.2 * gr);
          x._g = g;
          return x;
        }).sort(function (a, b) { return b._s - a._s; });

        var gSum = 0, gN = 0;
        open.forEach(function (x) { var g = num(x.gmp_pct); if (g != null && g >= -50 && g <= 150) { gSum += g; gN++; } });
        var avgG = gN ? Math.round(gSum / gN) : null;
        var nextClose = null;
        open.forEach(function (x) {
          var c = pd(x.close || x.close_date, true);
          if (c && (!nextClose || c < nextClose.d)) nextClose = { d: c, x: x };
        });

        var tile = function (label, val, sub) {
          return '<div style="flex:1;min-width:130px;padding:13px 15px;border:1px solid var(--bd);border-radius:14px;background:var(--card2)">'
            + '<div style="font-size:10px;letter-spacing:.6px;text-transform:uppercase;color:var(--muted);font-weight:800">' + label + '</div>'
            + '<div style="font-size:22px;font-weight:800;margin-top:3px">' + val + '</div>'
            + (sub ? '<div style="font-size:10.5px;color:var(--muted);margin-top:2px">' + sub + '</div>' : '')
            + '</div>';
        };

        var picks = scored.slice(0, 3).map(function (x, i) {
          var col = i === 0 ? '#22c55e' : '#fbbf24';
          return '<div style="display:flex;align-items:center;gap:10px;padding:9px 12px;border:1px solid var(--bd);border-radius:12px;background:var(--card2);margin-top:7px">'
            + '<b style="font-size:13px;color:' + col + '">#' + (i + 1) + '</b>'
            + '<div style="flex:1;min-width:0"><b style="font-size:13.5px">' + esc(x.name) + '</b>'
            + '<div style="font-size:10px;color:var(--muted)">closes ' + esc(x.close || x.close_date || '\u2014') + ' \u00B7 sub ' + esc((x.total != null ? x.total : x.sub) || '\u2014') + '</div></div>'
            + '<div style="text-align:right"><b style="color:' + (x._g >= 10 ? '#22c55e' : x._g >= 0 ? '#fbbf24' : '#ef4444') + '">' + (x._g > 0 ? '+' : '') + x._g + '% GMP</b>'
            + '<div style="font-size:10px;color:var(--muted)">quick score ' + x._s + '/100</div></div></div>';
        }).join('');

        var jump = function (id, icon, label, desc) {
          return '<button type="button" data-goto="' + id + '" style="text-align:left;flex:1;min-width:150px;padding:12px 14px;border:1px solid rgba(59,130,246,.4);border-radius:13px;background:rgba(59,130,246,.08);cursor:pointer">'
            + '<div style="font-size:13px;font-weight:800;color:#93c5fd">' + icon + ' ' + label + '</div>'
            + '<div style="font-size:10.5px;color:var(--muted);margin-top:3px;line-height:1.5">' + desc + '</div></button>';
        };

        el.innerHTML = '<div class="pt-hint"><b>One place for every tool.</b> Today\u2019s snapshot \u2014 numbers refresh automatically with the site data.</div>'
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin:4px 0 12px">'
          + tile('Open IPOs', open.length, open.length ? (scored.filter(function (z) { return /sme/i.test(String(z.type || z.board || '')); }).length + ' SME') : 'none right now')
          + tile('Avg GMP', avgG == null ? '\u2014' : (avgG > 0 ? '+' : '') + avgG + '%', 'of open IPOs')
          + tile('Next closing', nextClose ? esc(String(nextClose.x.close || nextClose.x.close_date)) : '\u2014', nextClose ? esc(nextClose.x.name) : 'no open IPO')
          + '</div>'
          + (open.length ? '<div style="font-size:13px;font-weight:800;margin:10px 0 2px">\ud83c\udfc6 Quick picks (GMP + demand + growth)</div>'
            + '<div class="pt-hint">Fast triage \u2014 full maths and RHP evidence are in Pro Tools \u2192 Why & Sources.</div>' + picks : '<div class="pt-hint">No open IPOs right now \u2014 the Home dashboard fills in automatically when the next IPO opens.</div>')
          + '<div style="display:flex;gap:9px;flex-wrap:wrap;margin-top:14px">'
          + jump('decision', '\ud83e\udde0', 'Decision engine', 'Signals, budget ladder, application planner \u2014 where to apply.')
          + jump('coach', '\ud83c\udf93', 'IPO Coach', 'Simple GO / CAREFUL / AVOID verdicts for beginners.')
          + jump('protools', '\ud83d\ude80', 'Pro Tools', 'Track record, My Apps, calendar, Why & Sources rankings.')
          + '</div>';

        el.querySelectorAll('button[data-goto]').forEach(function (b) {
          b.onclick = function () { openGroup1(b.getAttribute('data-goto')); };
        });
      })
      .catch(function () { el.innerHTML = '<div class="pt-hint">Snapshot unavailable right now \u2014 the tools below still work.</div>'; });
  }

  /* ---------------- generic group ---------------- */
  function Group(cfg) {
    var self = this;
    this.name = cfg.name;
    this.subs = cfg.subs;
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
          if (b) b.remove();
        }
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
    nav: 'decision', label: '\ud83e\udde0 Smart Tools', def: 'home',
    subs: [
      { id: 'home', label: '\ud83c\udfe0 Home' },
      { id: 'decision', label: '\ud83e\udde0 Decision' },
      { id: 'coach', label: '\ud83c\udf93 Coach' },
      { id: 'protools', label: '\ud83d\ude80 Pro Tools' }
    ]
  });
  var group2 = new Group({
    nav: 'closed', label: '\u26aa Results', def: 'closed',
    subs: [
      { id: 'closed', label: '\u26aa Closed IPOs' },
      { id: 'listed', label: '\ud83d\udcca Listed IPOs' }
    ]
  });

  function openGroup1(id) { group1.open(id); }

  createHomeSection();

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-close]')) {
      setTimeout(function () { group1.syncNav(); group2.syncNav(); }, 0);
    }
  });

  var tries = 0;
  var t = setInterval(function () {
    var a = group1.build(), b = group2.build();
    if ((a && b) || ++tries > 120) clearInterval(t);
  }, 300);
})();
