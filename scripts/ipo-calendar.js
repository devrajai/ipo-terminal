/* IPO Terminal - IPO calendar module (added 22 Sep).
   Standalone: adds a "Calendar" section listing every important IPO date
   (opens, closes, allotment, listing) from the last 14 days to the next
   90 days, grouped by date. Today is highlighted; past dates carry a
   check mark. Pure static data - no external service needed. */
(() => {
  if (window.__IPOCAL) return;
  window.__IPOCAL = 1;

  const $ = s => document.querySelector(s);
  const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&'+'amp;','<':'&'+'lt;','>':'&'+'gt;','"':'&'+'quot;',"'":'&'+'#39;'}[c]));
  const parseD = v => { const s = String(v||'').trim(); if (!s) return null; const a = s.split(/[\\/-]/).map(Number); if (a.length !== 3 || a.some(isNaN)) return null; if (a[0] > 1900) return new Date(a[0], a[1]-1, a[2]); let y = a[2]; if (y < 100) y += 2000; return new Date(y, a[1]-1, a[0]); };
  const fmtD = d => d.toLocaleDateString('en-IN', {day:'2-digit', month:'short', year:'numeric'});

  let data = [];

  function calendarView() {
    const now = new Date(); now.setHours(0,0,0,0);
    const lo = new Date(now); lo.setDate(lo.getDate() - 14);
    const hi = new Date(now); hi.setDate(hi.getDate() + 90);
    const map = {};
    data.forEach(x => {
      [['open_date','open','Opens'],['close_date','close','Closes'],['allotment_date','allotment','Allotment'],['listing_date','listing','Listing']].forEach(p => {
        const d = parseD(x[p[0]] || x[p[1]]);
        if (d && d >= lo && d <= hi) {
          const k = String(d.getFullYear()) + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
          (map[k] = map[k] || []).push({d, n:x.name, t:p[2]});
        }
      });
    });
    const keys = Object.keys(map).sort();
    if (!keys.length) return '<div class="cal-empty">No IPO dates found in the data yet.</div>';
    let h = '<div class="cal-head"><b>IPO calendar</b><span>Important IPO dates - last 14 days and next 90 days: RHP, subscription, allotment and listing. Green row = today. Updates automatically.</span></div>';
    keys.forEach(k => {
      const d = map[k][0].d;
      const today = d.getTime() === now.getTime();
      const past = d.getTime() < now.getTime();
      h += '<div class="' + (today ? 'cal-today' : 'cal-row') + '"><b>' + (today ? 'TODAY \u2014 ' : '') + (past ? '\u2713 ' : '') + fmtD(d) + '</b><span>' + map[k].map(e => '\u2022 ' + E(e.n) + ' \u2014 ' + e.t).join('<br>') + '</span></div>';
    });
    return h;
  }

  function ensure() {
    let s = $('#section-calendar');
    if (!s) {
      s = document.createElement('section');
      s.id = 'section-calendar';
      s.className = 'section glass';
      s.innerHTML = '<div class="section-title"><span>📅 IPO Calendar</span><button class="close" data-close="calendar">\u2715 Close</button></div><div id="ipo-calendar-content" class="content"></div>';
      $('main')?.appendChild(s);
    }
    const nav = $('#nav-tools .nav');
    if (nav && !nav.querySelector('[data-section="calendar"]')) {
      const b = document.createElement('button');
      b.dataset.section = 'calendar';
      b.textContent = '📅 Calendar';
      nav.appendChild(b);
    }
    const c = $('#ipo-calendar-content');
    if (c) c.innerHTML = calendarView();
  }

  async function load() {
    try {
      const urls = ['data/ipos.json', 'data/ipo-data.json'];
      const vals = await Promise.all(urls.map(u => fetch(u + '?d=' + Date.now(), {cache:'no-store'}).then(r => r.ok ? r.json() : null).catch(() => null)));
      const arr = v => Array.isArray(v) ? v : (v && Array.isArray(v.data) ? v.data : []);
      data = arr(vals[0]).concat(arr(vals[1]));
      ensure();
    } catch (e) { console.error('IPO Calendar module', e); }
  }

  const st = document.createElement('style');
  st.textContent = '.cal-head{padding:10px 0}.cal-head span{display:block;color:var(--muted);font-size:11px;margin-top:4px}.cal-row{display:flex;justify-content:space-between;gap:8px;padding:10px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid var(--line);margin-bottom:7px}.cal-row span{color:var(--muted);font-size:11px;text-align:right}.cal-today{display:flex;justify-content:space-between;gap:8px;padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(34,197,94,.08);margin-bottom:8px}.cal-today span{color:var(--muted);font-size:11px;text-align:right}.cal-empty{text-align:center;padding:25px;color:var(--muted)}';
  document.head.appendChild(st);

  ensure();
  load();
  setInterval(load, 15 * 60 * 1000);
})();
