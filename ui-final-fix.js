(function(){
  'use strict';
  var root=document.documentElement, body=document.body;
  var css=document.createElement('style');
  css.id='ipo-terminal-liquid-glass-final';
  css.textContent=`
    :root{--lg-bg:#07090b;--lg-panel:rgba(30,34,40,.52);--lg-panel2:rgba(55,61,70,.38);--lg-border:rgba(255,255,255,.22);--lg-text:#f7f9fc;--lg-sub:#c7cdd6}
    html,body{background:var(--lg-bg)!important;color:var(--lg-text)!important}
    body{background:radial-gradient(700px 420px at 15% 8%,rgba(110,130,170,.18),transparent 62%),radial-gradient(620px 420px at 88% 18%,rgba(75,100,220,.16),transparent 62%),linear-gradient(180deg,#080b0d,#050607 72%)!important}
    body.light{--lg-bg:#eef2f7;--lg-panel:rgba(255,255,255,.55);--lg-panel2:rgba(255,255,255,.40);--lg-border:rgba(60,70,85,.20);--lg-text:#182131;--lg-sub:#566274;background:radial-gradient(700px 420px at 15% 8%,rgba(140,160,190,.24),transparent 62%),radial-gradient(620px 420px at 88% 18%,rgba(100,125,230,.16),transparent 62%),linear-gradient(180deg,#f7f9fc,#e9edf3 72%)!important}
    .hdr,.kpi-row,.hbtns,.panel,.panel-title,.ipo-card,.ipo-stats div,.gl-card,.broker-card,.broker-grid div,.gloss-card,.tip-tab,.allot-wrap,.news-item,.doc-row,.ipo-table th,.theme-btn,.back-top{-webkit-backdrop-filter:blur(28px) saturate(170%);backdrop-filter:blur(28px) saturate(170%);border-color:var(--lg-border)!important}
    .hdr,.hbtns{background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.035))!important;box-shadow:inset 0 1px rgba(255,255,255,.20),0 12px 40px rgba(0,0,0,.18)!important}
    body.light .hdr,body.light .hbtns{background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(205,214,226,.40))!important;box-shadow:inset 0 1px rgba(255,255,255,.95),0 12px 36px rgba(65,75,95,.13)!important}
    .panel,.ipo-card,.gl-card,.broker-card,.gloss-card,.allot-wrap,.news-item,.doc-row{background:linear-gradient(135deg,var(--lg-panel),rgba(255,255,255,.055))!important;box-shadow:inset 0 1px rgba(255,255,255,.17),0 14px 38px rgba(0,0,0,.18)!important}
    body.light .panel,body.light .ipo-card,body.light .gl-card,body.light .broker-card,body.light .gloss-card,body.light .allot-wrap,body.light .news-item,body.light .doc-row{background:linear-gradient(135deg,var(--lg-panel),var(--lg-panel2))!important;box-shadow:inset 0 1px rgba(255,255,255,.96),0 14px 34px rgba(70,80,100,.12)!important}
    .panel-title,.ipo-stats div,.broker-grid div,.ipo-table th,.tip-tab{background:linear-gradient(135deg,rgba(255,255,255,.14),rgba(255,255,255,.04))!important}
    body.light .panel-title,body.light .ipo-stats div,body.light .broker-grid div,body.light .ipo-table th,body.light .tip-tab{background:linear-gradient(135deg,rgba(255,255,255,.72),rgba(215,222,232,.34))!important}
    .hb{background:linear-gradient(135deg,rgba(255,255,255,.12),rgba(255,255,255,.035))!important;border:1.5px solid var(--lg-border)!important;box-shadow:inset 0 1px rgba(255,255,255,.22),0 8px 24px rgba(0,0,0,.16)!important;color:var(--lg-text)!important;transition:transform .18s ease,opacity .18s ease,background .18s ease,box-shadow .18s ease!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}
    body.light .hb{background:linear-gradient(135deg,rgba(255,255,255,.78),rgba(210,218,229,.32))!important;color:#243044!important;box-shadow:inset 0 1px rgba(255,255,255,.95),0 8px 24px rgba(70,80,100,.10)!important}
    .hb.active{background:linear-gradient(135deg,rgba(255,255,255,.25),rgba(255,255,255,.09))!important;box-shadow:inset 0 1px rgba(255,255,255,.32),0 10px 30px rgba(0,0,0,.20)!important}
    body.light .hb.active{background:linear-gradient(135deg,rgba(255,255,255,.92),rgba(210,220,232,.52))!important}
    .theme-btn{position:fixed!important;right:12px!important;top:12px!important;z-index:10000!important;width:40px!important;height:40px!important;border-radius:50%!important;background:linear-gradient(135deg,rgba(255,255,255,.20),rgba(255,255,255,.06))!important;color:var(--lg-text)!important;border:1px solid var(--lg-border)!important;box-shadow:inset 0 1px rgba(255,255,255,.28),0 8px 28px rgba(0,0,0,.28)!important;cursor:pointer!important;pointer-events:auto!important;touch-action:manipulation!important}
    body.light .theme-btn{background:linear-gradient(135deg,rgba(255,255,255,.88),rgba(210,218,230,.42))!important;color:#172033!important;box-shadow:inset 0 1px rgba(255,255,255,1),0 8px 26px rgba(70,80,100,.16)!important}
    .hbtns{position:sticky!important;top:0!important;z-index:900!important;transition:transform .24s ease,opacity .24s ease!important;overflow-x:auto!important;overflow-y:hidden!important;max-height:190px!important}
    .hbtns.nav-hidden{transform:translateY(-115%)!important;opacity:0!important;pointer-events:none!important}
    .hbtns.nav-collapsed:not(.nav-hidden){transform:translateY(calc(-100% + 16px))!important;opacity:.97!important}
    .hbtns.nav-collapsed:after{content:'⌄';position:absolute;left:50%;bottom:0;transform:translateX(-50%);width:44px;height:16px;text-align:center;line-height:13px;border-radius:10px 10px 0 0;background:rgba(255,255,255,.12);color:var(--lg-text);pointer-events:none}
    .panel{scroll-margin-top:18px!important}.panel.show{animation:lg-panel-in .20s ease both!important}
    @keyframes lg-panel-in{from{opacity:0;transform:translateY(-6px) scale(.995)}to{opacity:1;transform:none}}
    .apply-btn,.big-link{border:1px solid rgba(255,255,255,.18)!important;box-shadow:inset 0 1px rgba(255,255,255,.28),0 10px 26px rgba(40,90,220,.24)!important}
    *{scrollbar-color:rgba(255,255,255,.20) transparent}body.light *{scrollbar-color:rgba(50,60,75,.20) transparent}
  `;
  document.head.appendChild(css);

  function themeSync(){var light=body.classList.contains('light');root.classList.toggle('light',light);var b=document.getElementById('themeToggle');if(b){b.textContent=light?'☀️':'🌙';b.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');b.title=light?'Switch to dark mode':'Switch to light mode';}}
  function setTheme(light){body.classList.toggle('light',!!light);root.classList.toggle('light',!!light);try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark');}catch(e){}themeSync();}
  var saved=null;try{saved=localStorage.getItem('ipo-terminal-theme');}catch(e){}if(saved==='light')body.classList.add('light');else if(saved==='dark')body.classList.remove('light');themeSync();

  function closeAllExcept(panel){document.querySelectorAll('.panel.show').forEach(function(p){if(p!==panel)p.classList.remove('show');});document.querySelectorAll('.hb.active').forEach(function(b){if(!panel||b.getAttribute('data-panel')!==panel.id)b.classList.remove('active');});}
  function togglePanel(btn){var id=btn.getAttribute('data-panel'),panel=id&&document.getElementById(id);if(!panel)return;var was=panel.classList.contains('show');closeAllExcept(panel);if(was){panel.classList.remove('show');btn.classList.remove('active');body.classList.remove('panel-open');}else{panel.classList.add('show');btn.classList.add('active');body.classList.add('panel-open');}var nav=document.querySelector('.hbtns');if(nav)nav.classList.add('nav-collapsed');}

  var theme=document.getElementById('themeToggle');
  if(theme){theme.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();setTheme(!body.classList.contains('light'));},{capture:true});theme.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();},{capture:true});}
  document.querySelectorAll('.hb').forEach(function(btn){btn.addEventListener('pointerdown',function(e){if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();togglePanel(btn);},{capture:true});btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();},{capture:true});});

  document.addEventListener('pointerdown',function(e){var x=e.target.closest&&e.target.closest('.close-x');if(!x)return;e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();var p=x.closest('.panel');if(p)p.classList.remove('show');document.querySelectorAll('.hb.active').forEach(function(b){b.classList.remove('active');});body.classList.remove('panel-open');var nav=document.querySelector('.hbtns');if(nav)nav.classList.remove('nav-collapsed');},{capture:true});

  var lastY=window.scrollY||0,ticking=false;
  window.addEventListener('scroll',function(){if(ticking)return;ticking=true;requestAnimationFrame(function(){var nav=document.querySelector('.hbtns');if(nav){var y=window.scrollY||0;if(y<=8){nav.classList.remove('nav-hidden');if(!body.classList.contains('panel-open'))nav.classList.remove('nav-collapsed');}else if(y>lastY+4){nav.classList.add('nav-hidden');}else if(y<lastY-4){nav.classList.remove('nav-hidden');nav.classList.remove('nav-collapsed');}}lastY=window.scrollY||0;ticking=false;});},{passive:true});
  window.addEventListener('pageshow',themeSync);
})();
