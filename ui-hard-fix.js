/* FINAL UI CONTRACT V5 — loaded before the data engine by the Pages workflow. */
(function(){
'use strict';
(function installDataCache(){
  if(window.__IPO_DATA_CACHE_V5__) return;
  window.__IPO_DATA_CACHE_V5__=true;
  var nativeFetch=window.fetch;if(typeof nativeFetch!=='function')return;
  var TTL=7*24*60*60*1000,PREFIX='ipo-terminal:data-cache:v5:';
  function key(url){try{var u=new URL(url,location.href);if(u.origin!==location.origin||!/^\/data\//.test(u.pathname))return null;return PREFIX+u.pathname}catch(e){return null}}
  function read(k){try{var x=JSON.parse(localStorage.getItem(k)||'null');return x&&x.t&&typeof x.body==='string'&&(Date.now()-x.t)<=TTL?x:null}catch(e){return null}}
  function write(k,body){try{localStorage.setItem(k,JSON.stringify({t:Date.now(),body:body}))}catch(e){}}
  window.fetch=function(input,init){
    var url=typeof input==='string'?input:(input&&input.url)||'',k=key(url);if(!k)return nativeFetch.call(this,input,init);
    var cached=read(k),opts=Object.assign({},init||{}),ctl=typeof AbortController==='function'?new AbortController():null,timer=ctl?setTimeout(function(){try{ctl.abort()}catch(e){}},10000):null;
    if(ctl&&!opts.signal)opts.signal=ctl.signal;
    return nativeFetch.call(this,input,opts).then(function(r){if(timer)clearTimeout(timer);if(!r.ok)throw new Error('HTTP '+r.status);return r.clone().text().then(function(body){if(body)write(k,body);return new Response(body,{status:r.status,statusText:r.statusText,headers:r.headers})})}).catch(function(err){if(timer)clearTimeout(timer);if(cached)return new Response(cached.body,{status:200,headers:{'Content-Type':'application/json','X-IPO-Cache':'7-day-fallback'}});throw err})
  };
})();
function boot(){
  var body=document.body,root=document.documentElement;if(!body||document.getElementById('ipo-navigation-contract-v5'))return;
  var style=document.createElement('style');style.id='ipo-navigation-contract-v5';style.textContent=`
html,body{min-width:0!important;overflow-x:hidden!important}.hbtns{position:relative!important;top:auto!important;z-index:20!important;box-sizing:border-box!important;width:100%!important;max-width:100%!important;transition:none!important}.hbtns .hb{box-sizing:border-box!important;touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important}.panel{position:relative!important;z-index:1!important;display:none!important;margin-top:10px!important}.panel.show{display:block!important;animation:ipoPanelInV5 .16s ease both}@keyframes ipoPanelInV5{from{opacity:.7}to{opacity:1}}.theme-btn,#themeToggle{position:fixed!important;right:12px!important;top:12px!important;z-index:100000!important;touch-action:manipulation!important}.updated{display:none!important}.ipo-refresh-notice,.refresh-notice{display:none!important}
@media(max-width:699px){.hbtns{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;grid-auto-rows:auto!important;gap:10px!important;overflow:visible!important;padding:10px 12px!important}.hbtns .hb{width:100%!important;min-width:0!important;flex:none!important}.hbtns.nav-collapsed{display:block!important;height:16px!important;min-height:16px!important;max-height:16px!important;padding:0 12px!important;overflow:hidden!important}.hbtns.nav-collapsed .hb{display:none!important}.hbtns.nav-collapsed:after{content:'⌄';position:absolute;left:50%;top:0;transform:translateX(-50%);width:44px;height:13px;line-height:11px;text-align:center;border:1px solid var(--bd);border-top:0;border-radius:0 0 10px 10px;background:color-mix(in srgb,var(--bg) 58%,transparent);color:var(--tx3);font-size:10px}.hbtns.nav-hidden{opacity:0!important;pointer-events:none!important;height:0!important;min-height:0!important;max-height:0!important;padding-top:0!important;padding-bottom:0!important;overflow:hidden!important}}
@media(min-width:700px){.hbtns{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;white-space:nowrap!important;scrollbar-width:none!important;-webkit-overflow-scrolling:touch!important}.hbtns::-webkit-scrollbar{display:none!important}.hbtns .hb{width:auto!important;min-width:max-content!important;flex:0 0 auto!important}}
.panel,.panel-title,.ipo-card,.gl-card,.news-item,.doc-row,.allot-wrap,.gloss-card,.broker-card,.tip-tab{backdrop-filter:blur(24px) saturate(155%)!important;-webkit-backdrop-filter:blur(24px) saturate(155%)!important}`;document.head.appendChild(style);
  var nav=document.querySelector('.hbtns'),theme=document.getElementById('themeToggle');
  function clean(b){return String(b.textContent||'').replace(/[🟢🕐📋📊⚖🎯📰📄💡📖🏦]/g,'').replace(/\s+/g,' ').trim().toLowerCase()}
  function normalize(){
    if(!nav)return;
    Array.prototype.slice.call(nav.querySelectorAll('.hb')).forEach(function(b){var t=clean(b);if(t==='drhp'||t==='rhp'||t==='rhp / drhp'){if(String(b.textContent||'').replace(/\s+/g,' ').trim()!=='📋 RHP / DRHP')b.textContent='📋 RHP / DRHP';b.setAttribute('data-panel','p-pipe')}else if(t==='docs'||t==='documents'){b.remove()}});
    var doc=document.getElementById('p-doc');if(doc)doc.remove();
    var pipe=document.getElementById('p-pipe');if(pipe){var title=pipe.querySelector('.panel-title');if(title){var t=String(title.textContent||'').toLowerCase();if(t.indexOf('rhp')<0&&t.indexOf('drhp')<0){title.childNodes.forEach(function(n){if(n.nodeType===3)n.nodeValue='RHP / DRHP Documents'})}}}
  }
  normalize();
  function syncTheme(){var light=body.classList.contains('light');root.classList.toggle('light',light);if(theme){theme.textContent=light?'☀️':'🌙';theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode')}}
  function toggleTheme(){var light=!body.classList.contains('light');body.classList.toggle('light',light);root.classList.toggle('light',light);try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark')}catch(e){}syncTheme()}
  try{if(localStorage.getItem('ipo-terminal-theme')==='light')body.classList.add('light')}catch(e){}syncTheme();
  function panels(){return Array.prototype.slice.call(document.querySelectorAll('.panel'))}
  function closeAll(except){panels().forEach(function(p){if(p!==except)p.classList.remove('show')});if(nav)nav.querySelectorAll('.hb.active').forEach(function(b){b.classList.remove('active')})}
  function togglePanel(btn){var id=btn.getAttribute('data-panel'),p=id?document.getElementById(id):null;if(!p)return;var open=p.classList.contains('show');if(open){p.classList.remove('show');btn.classList.remove('active');body.classList.remove('panel-open');if(nav)nav.classList.remove('nav-collapsed');return}closeAll(p);p.classList.add('show');btn.classList.add('active');body.classList.add('panel-open');if(nav)nav.classList.add('nav-collapsed')}
  document.addEventListener('click',function(e){var t=e.target;if(theme&&(t===theme||theme.contains(t))){e.preventDefault();e.stopImmediatePropagation();toggleTheme();return}var b=t&&t.closest?t.closest('.hbtns .hb'):null;if(b){e.preventDefault();e.stopImmediatePropagation();togglePanel(b);return}var c=t&&t.closest?t.closest('.panel .close-x'):null;if(c){e.preventDefault();e.stopImmediatePropagation();var p=c.closest('.panel');if(p)p.classList.remove('show');if(nav)nav.querySelectorAll('.hb.active').forEach(function(x){x.classList.remove('active')});body.classList.remove('panel-open');if(nav)nav.classList.remove('nav-collapsed');return}},true);
  var lastY=window.scrollY||0;window.addEventListener('scroll',function(){if(!nav)return;var y=window.scrollY||document.documentElement.scrollTop||0;if(body.classList.contains('panel-open'))nav.classList.add('nav-collapsed');else if(y>lastY+4)nav.classList.add('nav-hidden');else if(y<lastY-4||y<=8)nav.classList.remove('nav-hidden');lastY=y},{passive:true});
  var mo=new MutationObserver(function(){normalize()});mo.observe(nav||body,{childList:true,subtree:true});window.addEventListener('pageshow',syncTheme)
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
