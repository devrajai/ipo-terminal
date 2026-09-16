(function(){
'use strict';
function boot(){
  var body=document.body, root=document.documentElement;
  if(!body) return;

  /* Final UI override: one stable glass system for desktop + mobile. */
  if(!document.getElementById('ipo-stable-ui-style')){
    var st=document.createElement('style'); st.id='ipo-stable-ui-style';
    st.textContent=`
      html,body{background:var(--bg)!important;color:var(--tx)!important}
      body{min-width:0;overflow-x:hidden}
      .hdr{background:color-mix(in srgb,var(--bg) 58%,transparent)!important;backdrop-filter:blur(28px) saturate(170%)!important;-webkit-backdrop-filter:blur(28px) saturate(170%)!important}
      .hbtns{position:sticky!important;top:0!important;z-index:900!important;display:flex!important;align-items:center!important;gap:8px!important;transition:transform .24s ease,opacity .24s ease,max-height .24s ease,padding .24s ease!important;will-change:transform!important;background:color-mix(in srgb,var(--bg) 62%,transparent)!important;backdrop-filter:blur(28px) saturate(170%)!important;-webkit-backdrop-filter:blur(28px) saturate(170%)!important}
      .hbtns.nav-hidden{transform:translateY(-115%)!important;opacity:0!important;pointer-events:none!important}
      .hbtns.nav-collapsed:not(.nav-hidden){max-height:14px!important;min-height:14px!important;height:14px!important;padding:0 12px!important;overflow:hidden!important;opacity:.78!important;pointer-events:auto!important}
      .hbtns.nav-collapsed:not(.nav-hidden) .hb{transform:translateY(-40px)!important;pointer-events:none!important;opacity:0!important}
      .hbtns.nav-collapsed:not(.nav-hidden)::after{content:'⌄';position:absolute;left:50%;top:0;transform:translateX(-50%);width:44px;height:12px;text-align:center;line-height:10px;border:1px solid var(--bd);border-top:0;border-radius:0 0 10px 10px;background:color-mix(in srgb,var(--bg) 55%,transparent);color:var(--tx3);font-size:10px;pointer-events:none}
      .panel{position:relative;z-index:1;background:color-mix(in srgb,var(--card) 88%,transparent)!important;backdrop-filter:blur(28px) saturate(165%)!important;-webkit-backdrop-filter:blur(28px) saturate(165%)!important}
      .panel.show{animation:ipoPanelIn .18s ease both}
      @keyframes ipoPanelIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      .theme-btn{position:fixed!important;right:12px!important;top:12px!important;z-index:100000!important;pointer-events:auto!important;touch-action:manipulation!important}
      body.light{background:radial-gradient(circle at 12% 0%,rgba(120,140,190,.13),transparent 35%),radial-gradient(circle at 88% 10%,rgba(110,100,210,.10),transparent 32%),#eef1f5!important}
      body.light .hdr,body.light .hbtns{background:rgba(246,248,251,.62)!important;border-color:rgba(45,55,70,.14)!important}
      body.light .panel,body.light .ipo-card,body.light .panel-title,body.light .ipo-stats div,body.light .gloss-card,body.light .broker-card,body.light .news-item,body.light .doc-row,body.light .allot-wrap,body.light .tip-tab{background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(220,226,235,.42))!important;color:#172033!important;border-color:rgba(45,55,70,.14)!important;box-shadow:inset 0 1px rgba(255,255,255,.95),0 10px 28px rgba(70,80,100,.10)!important}
      body.light .panel-title,body.light .ipo-name,body.light b,body.light .gloss-term,body.light .broker-card h3,body.light .news-title{color:#172033!important}
      body.light .hb{color:#536071!important;border-color:rgba(45,55,70,.16)!important;background:rgba(255,255,255,.34)!important}
      body.light .hb.active{background:rgba(255,255,255,.82)!important;color:#172033!important}
      body.light .theme-btn{background:rgba(255,255,255,.78)!important;color:#172033!important;border-color:rgba(45,55,70,.16)!important}
      @media(min-width:700px){.hbtns{overflow-x:auto!important;scrollbar-width:none!important}.hbtns::-webkit-scrollbar{display:none}.panel{margin-left:0!important;margin-right:0!important}.hbtns.nav-collapsed:not(.nav-hidden){max-height:16px!important;height:16px!important;min-height:16px!important}}
      @media(max-width:699px){.hbtns{max-width:100vw!important}.hbtns.nav-collapsed:not(.nav-hidden){max-height:14px!important;height:14px!important}.panel{margin-top:8px!important}}
    `;
    document.head.appendChild(st);
  }

  var theme=document.getElementById('themeToggle');
  if(theme){
    theme.style.setProperty('position','fixed','important');
    theme.style.setProperty('right','12px','important');
    theme.style.setProperty('top','12px','important');
    theme.style.setProperty('z-index','100000','important');
    theme.style.setProperty('touch-action','manipulation','important');
  }

  function syncTheme(){
    var light=body.classList.contains('light');
    root.classList.toggle('light',light);
    if(theme){
      theme.textContent=light?'☀️':'🌙';
      theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');
      theme.title=light?'Switch to dark mode':'Switch to light mode';
    }
  }
  function toggleTheme(){
    var light=!body.classList.contains('light');
    body.classList.toggle('light',light); root.classList.toggle('light',light);
    try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark');}catch(e){}
    syncTheme();
  }
  try{
    var saved=localStorage.getItem('ipo-terminal-theme');
    if(saved==='light') body.classList.add('light');
    else if(saved==='dark') body.classList.remove('light');
  }catch(e){}
  syncTheme();

  /* Replace old buttons so legacy event listeners cannot fire twice. */
  function replace(selector){
    document.querySelectorAll(selector).forEach(function(el){
      var clone=el.cloneNode(true); el.parentNode.replaceChild(clone,el);
    });
  }
  replace('#themeToggle');
  replace('.hbtns .hb');
  replace('.panel .close-x');
  theme=document.getElementById('themeToggle');
  if(theme){
    theme.style.setProperty('position','fixed','important');
    theme.style.setProperty('right','12px','important');
    theme.style.setProperty('top','12px','important');
    theme.style.setProperty('z-index','100000','important');
  }
  syncTheme();

  function closeAll(except){
    document.querySelectorAll('.panel.show').forEach(function(p){if(p!==except)p.classList.remove('show');});
    document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});
  }
  function setNavCollapsed(value){
    var n=document.querySelector('.hbtns');
    if(!n)return;
    if(value)n.classList.add('nav-collapsed');
    else n.classList.remove('nav-collapsed');
  }
  function togglePanel(btn){
    var id=btn.getAttribute('data-panel'), panel=id&&document.getElementById(id);
    if(!panel) return;
    var was=panel.classList.contains('show');
    closeAll(was?null:panel);
    if(!was){
      panel.classList.add('show'); btn.classList.add('active'); body.classList.add('panel-open');
      setNavCollapsed(true);
    }else{
      body.classList.remove('panel-open');
      setNavCollapsed(false);
    }
  }

  if(theme) theme.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggleTheme();});
  document.querySelectorAll('.hbtns .hb').forEach(function(btn){
    btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();togglePanel(btn);});
  });
  document.querySelectorAll('.panel .close-x').forEach(function(btn){
    btn.addEventListener('click',function(e){
      e.preventDefault();e.stopPropagation();
      var p=btn.closest('.panel'); if(p)p.classList.remove('show');
      document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});
      body.classList.remove('panel-open');
      setNavCollapsed(false);
    });
  });

  var nav=document.querySelector('.hbtns');
  var lastY=window.scrollY||0, raf=0;
  function scrollNav(){
    raf=0;if(!nav)return;
    var y=window.scrollY||document.documentElement.scrollTop||0;
    var panelOpen=body.classList.contains('panel-open');
    if(y<=8){
      nav.classList.remove('nav-hidden');
      if(panelOpen) nav.classList.add('nav-collapsed');
      else nav.classList.remove('nav-collapsed');
    }else if(y>lastY+3){
      nav.classList.add('nav-hidden');
    }else if(y<lastY-3){
      nav.classList.remove('nav-hidden');
      /* Never expand over an open panel. Reveal only the small glass strip. */
      if(panelOpen) nav.classList.add('nav-collapsed');
      else nav.classList.remove('nav-collapsed');
    }
    lastY=y;
  }
  window.addEventListener('scroll',function(){if(!raf)raf=requestAnimationFrame(scrollNav);},{passive:true});
  window.addEventListener('pageshow',syncTheme);
  scrollNav();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
