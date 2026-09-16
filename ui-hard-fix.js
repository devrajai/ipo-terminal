(function(){
'use strict';
function boot(){
  var body=document.body, root=document.documentElement;
  if(!body)return;

  if(!document.getElementById('ipo-navigation-contract')){
    var st=document.createElement('style');st.id='ipo-navigation-contract';
    st.textContent=`
      html,body{min-width:0;overflow-x:hidden}
      .hbtns{box-sizing:border-box!important;width:100%!important;max-width:100%!important;position:relative!important;top:auto!important;z-index:900!important;display:flex!important;align-items:center!important;gap:8px!important;transition:max-height .22s ease,opacity .22s ease,padding .22s ease,transform .22s ease!important;background:color-mix(in srgb,var(--bg) 62%,transparent)!important;backdrop-filter:blur(28px) saturate(170%)!important;-webkit-backdrop-filter:blur(28px) saturate(170%)!important}
      .hbtns .hb{box-sizing:border-box!important}
      .hbtns.nav-hidden{opacity:0!important;pointer-events:none!important;max-height:0!important;min-height:0!important;height:0!important;padding-top:0!important;padding-bottom:0!important;overflow:hidden!important;transform:translateY(-8px)!important}
      .hbtns.nav-collapsed{max-height:16px!important;min-height:16px!important;height:16px!important;padding:0 12px!important;overflow:hidden!important;opacity:.82!important}
      .hbtns.nav-collapsed .hb{opacity:0!important;pointer-events:none!important;transform:translateY(-30px)!important}
      .hbtns.nav-collapsed:after{content:'⌄';position:absolute;left:50%;top:0;transform:translateX(-50%);width:44px;height:13px;text-align:center;line-height:11px;border:1px solid var(--bd);border-top:0;border-radius:0 0 10px 10px;background:color-mix(in srgb,var(--bg) 58%,transparent);color:var(--tx3);font-size:10px}
      .panel{position:relative!important;z-index:1;background:color-mix(in srgb,var(--card) 88%,transparent)!important;backdrop-filter:blur(28px) saturate(165%)!important;-webkit-backdrop-filter:blur(28px) saturate(165%)!important}
      .panel.show{animation:ipoPanelIn .18s ease both}
      @keyframes ipoPanelIn{from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
      .theme-btn,#themeToggle{position:fixed!important;right:12px!important;top:12px!important;z-index:100000!important;touch-action:manipulation!important}
      @media(max-width:699px){
        .hbtns{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;gap:8px!important;overflow:visible!important;overflow-x:visible!important;overflow-y:visible!important}
        .hbtns .hb{width:100%!important;min-width:0!important;flex:none!important}
        .hbtns.nav-collapsed{display:block!important;height:16px!important;min-height:16px!important;max-height:16px!important;overflow:hidden!important}
        .hbtns.nav-collapsed .hb{display:none!important}
      }
      @media(min-width:700px){
        .hbtns{display:flex!important;flex-wrap:nowrap!important;align-items:center!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}
        .hbtns::-webkit-scrollbar{display:none!important}
        .hbtns .hb{width:auto!important;min-width:max-content!important;flex:0 0 auto!important}
      }
      body.light{background:radial-gradient(circle at 12% 0%,rgba(120,140,190,.13),transparent 35%),radial-gradient(circle at 88% 10%,rgba(110,100,210,.10),transparent 32%),#eef1f5!important}
      body.light .hbtns{background:rgba(246,248,251,.62)!important;border-color:rgba(45,55,70,.14)!important}
      body.light .panel{background:linear-gradient(135deg,rgba(255,255,255,.82),rgba(220,226,235,.42))!important;color:#172033!important;border-color:rgba(45,55,70,.14)!important}
    `;
    document.head.appendChild(st);
  }

  function replace(selector){document.querySelectorAll(selector).forEach(function(el){var c=el.cloneNode(true);el.parentNode.replaceChild(c,el);});}
  replace('#themeToggle');replace('.hbtns .hb');replace('.panel .close-x');

  var theme=document.getElementById('themeToggle');
  function syncTheme(){var light=body.classList.contains('light');root.classList.toggle('light',light);if(theme){theme.textContent=light?'☀️':'🌙';theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');}}
  function toggleTheme(){var light=!body.classList.contains('light');body.classList.toggle('light',light);root.classList.toggle('light',light);try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark');}catch(e){}syncTheme();}
  try{if(localStorage.getItem('ipo-terminal-theme')==='light')body.classList.add('light');}catch(e){}
  syncTheme();

  var nav=document.querySelector('.hbtns');
  function activePanel(){return body.classList.contains('panel-open');}
  function collapseNav(v){if(!nav)return;nav.classList.toggle('nav-collapsed',!!v);nav.classList.remove('nav-hidden');}
  function closeOthers(except){document.querySelectorAll('.panel.show').forEach(function(p){if(p!==except)p.classList.remove('show');});document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});}
  function togglePanel(btn){
    var id=btn.getAttribute('data-panel'),panel=id&&document.getElementById(id);if(!panel)return;
    var was=panel.classList.contains('show');
    closeOthers(was?null:panel);
    if(!was){panel.classList.add('show');btn.classList.add('active');body.classList.add('panel-open');collapseNav(true);panel.scrollIntoView({behavior:'smooth',block:'start'});}
    else{panel.classList.remove('show');body.classList.remove('panel-open');collapseNav(false);}
  }
  if(theme)theme.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggleTheme();});
  document.querySelectorAll('.hbtns .hb').forEach(function(btn){btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();togglePanel(btn);});});
  document.querySelectorAll('.panel .close-x').forEach(function(btn){btn.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();var p=btn.closest('.panel');if(p)p.classList.remove('show');document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});body.classList.remove('panel-open');collapseNav(false);});});

  if(nav)nav.addEventListener('click',function(e){if(nav.classList.contains('nav-collapsed')&&!e.target.closest('.hb')){collapseNav(false);}});
  window.addEventListener('pageshow',syncTheme);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
