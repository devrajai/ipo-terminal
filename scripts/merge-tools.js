/* Merge Decision + Coach + Pro Tools into ONE nav button (Smart Tools)
   with a 3-way sub-tab bar inside. Loaded last. */
(function () {
  var SUBS = [
    ['decision', '🧠 Decision'],
    ['coach', '🎓 Coach'],
    ['protools', '🚀 Pro Tools']
  ];
  var current = 'decision';
  var bar = null;

  function secOf(n) { return document.getElementById('section-' + n); }

  function anyOpen() {
    return SUBS.some(function (s) { var x = secOf(s[0]); return x && x.classList.contains('opened'); });
  }

  function syncNav() {
    var b = document.querySelector('button[data-section="decision"]');
    if (b) b.classList.toggle('active', anyOpen());
  }

  function updateBar() {
    if (!bar) return;
    bar.querySelectorAll('button[data-smart]').forEach(function (b) {
      b.classList.toggle('on', b.dataset.smart === current);
    });
  }

  function openSub(n) {
    current = n;
    SUBS.forEach(function (s) {
      var x = secOf(s[0]);
      if (x) x.classList.toggle('opened', s[0] === n);
    });
    var x = secOf(n);
    if (x && bar) {
      var title = x.querySelector('.section-title');
      if (title && title.parentNode) {
        (title.nextElementSibling === bar) || title.parentNode.insertBefore(bar, title.nextSibling);
      }
      try { x.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } catch (e) {}
    }
    syncNav();
    updateBar();
  }

  function closeAll() {
    SUBS.forEach(function (s) { var x = secOf(s[0]); if (x) x.classList.remove('opened'); });
    syncNav();
  }

  function build() {
    if (bar) return true;
    var all = SUBS.every(function (s) { return !!secOf(s[0]); });
    if (!all) return false;

    ['coach', 'protools'].forEach(function (n) {
      var b = document.querySelector('button[data-section="' + n + '"]');
      if (b) b.remove();
    });
    var mainBtn = document.querySelector('button[data-section="decision"]');
    if (mainBtn) {
      mainBtn.textContent = '🧠 Smart Tools';
      mainBtn.addEventListener('click', function (e) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (anyOpen()) closeAll(); else openSub(current);
      }, true);
    }

    bar = document.createElement('div');
    bar.className = 'pt-tabs smart-bar';
    bar.style.margin = '0 0 12px';
    bar.innerHTML = SUBS.map(function (s) {
      return '<button type="button" data-smart="' + s[0] + '">' + s[1] + '</button>';
    }).join('');
    bar.addEventListener('click', function (e) {
      var b = e.target && e.target.closest ? e.target.closest('button[data-smart]') : null;
      if (b) openSub(b.dataset.smart);
    });

    openSub('decision');
    return true;
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('[data-close]')) setTimeout(syncNav, 0);
  });

  var tries = 0;
  var t = setInterval(function () {
    if (build() || ++tries > 120) clearInterval(t);
  }, 300);
})();
