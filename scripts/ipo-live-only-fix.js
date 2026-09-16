/* IPO Terminal live/upcoming cleanup + stale-link cleanup + desktop layout repair. */
(function(){
'use strict';
function date(v){
  if(!v || v==='—') return null;
  var s=String(v).trim(), m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if(m){var y=+m[3]; if(y<100)y+=2000; return new Date(y,+m[2]-1,+m[1],23,59,59);}
  var d=new Date(s); return isNaN(d)?null:d;
}
function liveOrUpcoming(i){
  if(!i || !i.name) return false;
  var st=String(i.status||'').toLowerCase();
  if(st==='closed'||st==='listed') return false;
  var close=date(i.close), now=new Date();
  if(close && now>close) return false;
  return true;
}
function liveData(){return Array.isArray(window.ALL_IPOS)?window.ALL_IPOS.filter(liveOrUpcoming):[];}
function removeVideoLine(root){
  if(!root)return;
  var walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT), nodes=[],n;
  while(n=walker.nextNode())nodes.push(n);
  nodes.forEach(function(t){
    var v=(t.nodeValue||'');
    if(/Video summary\s*-\s*no external video\/link/i.test(v)){
      var p=t.parentElement;
      if(p && p.childNodes.length===1)p.remove(); else t.nodeValue=v.replace(/Video summary\s*-\s*no external video\/link/ig,'');
    }
  });
}
function refreshComparisonAndWhy(){
  var live=liveData();
  if(typeof window.renderComp==='function'){
    var comp=live.filter(function(i){return i.roe && i.roe!=='—';});
    try{window.renderComp('comp-container',comp);}catch(e){}
  }
  if(typeof window.renderWhyApply==='function'){
    var original=window.ALL_IPOS;
    try{window.ALL_IPOS=live;window.renderWhyApply('why-container');}catch(e){}finally{window.ALL_IPOS=original;}
  }
  removeVideoLine(document.getElementById('why-container'));
  removeVideoLine(document.getElementById('ipo-decision-panel'));
}
function patchRadar(){
  var b=document.getElementById('radar-btn');
  if(!b || b.dataset.liveOnlyFix)return;
  b.dataset.liveOnlyFix='1';
  b.addEventListener('click',function(){
    var original=window.ALL_IPOS;
    window.ALL_IPOS=liveData();
    setTimeout(function(){window.ALL_IPOS=original;},0);
  },true);
}
function removeGmpUi(){
  ['gmp-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.remove();});
  ['gmp-panel','ipo-gmp-panel','p-gmp'].forEach(function(id){var p=document.getElementById(id);if(p)p.remove();});
}
function repairDesktopLayout(){
  if(document.getElementById('ipo-desktop-layout-repair')) return;
  var s=document.createElement('style');
  s.id='ipo-desktop-layout-repair';
  s.textContent=''
    +'@media (min-width:901px){'
    +'body{padding-left:222px!important;padding-right:10px!important}'
    +'.hbtns{position:fixed!important;left:10px!important;top:10px!important;width:198px!important;max-height:calc(100vh - 20px)!important;overflow-y:auto!important;overflow-x:hidden!important;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:7px!important;margin:0!important;padding:12px!important;border:1px solid var(--bd)!important;border-radius:14px!important;background:rgba(19,26,42,.90)!important;box-shadow:0 18px 45px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)!important;backdrop-filter:blur(18px) saturate(145%)!important;-webkit-backdrop-filter:blur(18px) saturate(145%)!important;z-index:12000!important;scrollbar-width:thin}'
    +'.hbtns:before{content:"IPO TERMINAL";display:block;padding:3px 4px 8px;font-size:15px;font-weight:900;letter-spacing:.4px;background:linear-gradient(90deg,var(--gn),var(--bl),var(--pp));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}'
    +'.hbtns .hb{width:100%!important;min-height:34px!important;text-align:left!important;border-radius:9px!important;padding:8px 10px!important;font-size:11px!important}'
    +'.hbtns .hb.active{box-shadow:0 6px 18px rgba(59,130,246,.22)!important}'
    +'.ipo-upgrade-search{margin-left:0!important}'
    +'}'
    +'@media (max-width:900px){'
    +'body{padding-left:8px!important}'
    +'.hbtns{position:static!important;width:auto!important;max-height:none!important;overflow-y:hidden!important;overflow-x:auto!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;gap:6px!important;margin-top:10px!important;padding:0 0 3px!important;border:0!important;background:transparent!important;box-shadow:none!important;backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'
    +'.hbtns:before{display:none!important}'
    +'.hbtns .hb{width:auto!important;min-height:0!important;flex:0 0 auto!important;text-align:center!important}'
    +'}';
  document.head.appendChild(s);
}
function init(){
  removeGmpUi();
  patchRadar();
  refreshComparisonAndWhy();
  removeVideoLine(document.body);
  repairDesktopLayout();
  var mo=new MutationObserver(function(){
    removeGmpUi();
    patchRadar();
    removeVideoLine(document.body);
  });
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect();},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,500);});
else setTimeout(init,500);
})();