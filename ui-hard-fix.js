(function(){
'use strict';
function boot(){
  var body=document.body,root=document.documentElement;
  if(!body)return;
  if(document.getElementById('ipo-navigation-contract'))return;

  var st=document.createElement('style');st.id='ipo-navigation-contract';
  st.textContent=`
    html,body{min-width:0;overflow-x:hidden}
    .hbtns{box-sizing:border-box!important;width:100%!important;max-width:100%!important;position:relative!important;top:auto!important;z-index:20!important;display:flex!important;align-items:center!important;gap:8px!important;transition:opacity .18s ease,transform .18s ease!important}
    .hbtns .hb{box-sizing:border-box!important}
    .hbtns.nav-collapsed{display:block!important;height:16px!important;min-height:16px!important;max-height:16px!important;padding:0 12px!important;overflow:hidden!important;opacity:.82!important}
    .hbtns.nav-collapsed .hb{display:none!important}
    .hbtns.nav-collapsed:after{content:'⌄';position:absolute;left:50%;top:0;transform:translateX(-50%);width:44px;height:13px;text-align:center;line-height:11px;border:1px solid var(--bd);border-top:0;border-radius:0 0 10px 10px;background:color-mix(in srgb,var(--bg) 58%,transparent);color:var(--tx3);font-size:10px}
    .hbtns.nav-hidden{opacity:0!important;transform:translateY(-8px)!important;pointer-events:none!important}
    .panel{position:relative!important;z-index:1!important;background:color-mix(in srgb,var(--card) 88%,transparent)!important;backdrop-filter:blur(28px) saturate(165%)!important;-webkit-backdrop-filter:blur(28px) saturate(165%)!important}
    .panel.show{display:block!important;animation:ipoPanelIn .18s ease both}
    @keyframes ipoPanelIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    .theme-btn,#themeToggle{position:fixed!important;right:12px!important;top:12px!important;z-index:100000!important;touch-action:manipulation!important}
    .updated{display:none!important}
    @media(max-width:699px){
      .hbtns{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;overflow:visible!important;padding:9px 12px!important}
      .hbtns .hb{width:100%!important;min-width:0!important;flex:none!important}
      .hbtns.nav-collapsed{display:block!important}
    }
    @media(min-width:700px){
      .hbtns{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}
      .hbtns::-webkit-scrollbar{display:none!important}
      .hbtns .hb{width:auto!important;min-width:max-content!important;flex:0 0 auto!important}
    }
    body.light{background:radial-gradient(circle at 12% 0%,rgba(120,140,190,.13),transparent 35%),radial-gradient(circle at 88% 10%,rgba(110,100,210,.10),transparent 32%),#eef1f5!important}
    body.light .hbtns{background:rgba(246,248,251,.62)!important;border-color:rgba(45,55,70,.14)!important}
    body.light .panel{background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(220,226,235,.42))!important;color:#172033!important;border-color:rgba(45,55,70,.14)!important}
  `;
  document.head.appendChild(st);

  var nav=document.querySelector('.hbtns');
  var theme=document.getElementById('themeToggle');
  function syncTheme(){
    var light=body.classList.contains('light');
    root.classList.toggle('light',light);
    if(theme){theme.textContent=light?'☀️':'🌙';theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');}
  }
  function toggleTheme(){
    var light=!body.classList.contains('light');
    body.classList.toggle('light',light);root.classList.toggle('light',light);
    try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark')}catch(e){}
    syncTheme();
  }
  try{if(localStorage.getItem('ipo-terminal-theme')==='light')body.classList.add('light')}catch(e){}
  syncTheme();

  function panels(){return Array.prototype.slice.call(document.querySelectorAll('.panel'))}
  function closeAll(except){panels().forEach(function(p){if(p!==except)p.classList.remove('show')});document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active')})}
  function setNavCollapsed(v){if(!nav)return;nav.classList.toggle('nav-collapsed',!!v);nav.classList.remove('nav-hidden')}
  function togglePanel(btn){
    var id=btn.getAttribute('data-panel');
    var panel=id?document.getElementById(id):null;
    if(!panel)return;
    var open=panel.classList.contains('show');
    if(open){panel.classList.remove('show');btn.classList.remove('active');body.classList.remove('panel-open');setNavCollapsed(false);return}
    closeAll(panel);
    panel.classList.add('show');btn.classList.add('active');body.classList.add('panel-open');setNavCollapsed(true);
    // Keep the tap location stable; do not jump the page/disclaimer over the opened window.
    window.requestAnimationFrame(function(){
      var r=panel.getBoundingClientRect();
      if(r.top<0||r.top>window.innerHeight){window.scrollTo({top:Math.max(0,window.scrollY+r.top-12),behavior:'smooth'})}
    });
  }

  // Capture clicks so older page handlers cannot cancel the mobile tap or open a second panel.
  document.addEventListener('click',function(e){
    var t=e.target;
    if(theme && (t===theme||theme.contains(t))){e.preventDefault();e.stopImmediatePropagation();toggleTheme();return}
    var btn=t&&t.closest?t.closest('.hbtns .hb'):null;
    if(btn){e.preventDefault();e.stopImmediatePropagation();togglePanel(btn);return}
    var close=t&&t.closest?t.closest('.panel .close-x'):null;
    if(close){
      e.preventDefault();e.stopImmediatePropagation();
      var p=close.closest('.panel');if(p)p.classList.remove('show');
      document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active')});
      body.classList.remove('panel-open');setNavCollapsed(false);return;
    }
  },true);

  var lastY=window.scrollY||0;
  window.addEventListener('scroll',function(){
    if(!nav)return;
    var y=window.scrollY||document.documentElement.scrollTop||0;
    if(body.classList.contains('panel-open')){nav.classList.add('nav-collapsed');nav.classList.remove('nav-hidden')}
    else if(y>lastY+4)nav.classList.add('nav-hidden');
    else if(y<lastY-4||y<=8)nav.classList.remove('nav-hidden');
    lastY=y;
  },{passive:true});
  window.addEventListener('pageshow',syncTheme);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
