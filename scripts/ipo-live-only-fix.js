/* IPO Terminal live/upcoming cleanup + stale-link cleanup. */
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
function apply(){
  removeGmpUi();
  patchRadar();
  refreshComparisonAndWhy();
  removeVideoLine(document.body);
}
function init(){
  apply();
  var mo=new MutationObserver(function(){apply();});
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect();},30000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,400);});
else setTimeout(init,400);
})();
