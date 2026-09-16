/* IPO Terminal self-healing guard: live/upcoming filtering, stale UI cleanup, dead-control protection. */
(function(){
'use strict';
function d(v){
  if(!v || v==='—') return null;
  var s=String(v).trim(), m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if(m){var y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1],23,59,59);}
  var x=new Date(s); return isNaN(x)?null:x;
}
function liveOrUpcoming(i){
  if(!i || !i.name) return false;
  var st=String(i.status||'').toLowerCase().trim();
  if(st==='closed'||st==='listed'||st==='delisted') return false;
  var close=d(i.close), now=new Date();
  if(close && now>close) return false;
  return true;
}
function liveData(){return Array.isArray(window.ALL_IPOS)?window.ALL_IPOS.filter(liveOrUpcoming):[];}
window.IPO_TERMINAL_LIVE_ONLY=liveData;
function cleanDecision(){
  var p=document.getElementById('ipo-decision-panel'); if(!p)return;
  p.querySelectorAll('.dec-row').forEach(function(row){
    var name=row.querySelector('b'); if(!name)return;
    var found=(window.ALL_IPOS||[]).find(function(i){return String(i.name||'').trim()===name.textContent.trim();});
    if(found && !liveOrUpcoming(found))row.remove();
  });
  var alt=p.querySelector('.dec-alt');
  if(alt)alt.querySelectorAll(':scope > div').forEach(function(row){
    var name=row.firstElementChild; if(!name)return;
    var found=(window.ALL_IPOS||[]).find(function(i){return String(i.name||'').trim()===name.textContent.trim();});
    if(found && !liveOrUpcoming(found))row.remove();
  });
}
function cleanRadar(){
  var p=document.getElementById('ipo-radar-panel'); if(!p)return;
  p.querySelectorAll('.radar-card').forEach(function(card){
    var b=card.querySelector('.radar-head b'); if(!b)return;
    var found=(window.ALL_IPOS||[]).find(function(i){return String(i.name||'').trim()===b.textContent.trim();});
    if(found && !liveOrUpcoming(found))card.remove();
  });
}
function cleanGmp(){
  ['gmp-btn','gmp-panel','ipo-gmp-panel','p-gmp'].forEach(function(id){var x=document.getElementById(id);if(x)x.remove();});
}
function cleanVideo(){
  var w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),a=[],n;
  while(n=w.nextNode())a.push(n);
  a.forEach(function(t){if(/Video summary\s*-\s*no external video\/link/i.test(t.nodeValue||'')){var p=t.parentElement;if(p&&p.childNodes.length===1)p.remove();else t.nodeValue=t.nodeValue.replace(/Video summary\s*-\s*no external video\/link/ig,'');}});
}
function wrapOpenOnly(){
  if(typeof window.renderComp==='function' && !window.renderComp.__liveOnly){
    var orig=window.renderComp;window.renderComp=function(id,ipos){return orig(id,(ipos||[]).filter(liveOrUpcoming));};window.renderComp.__liveOnly=true;
  }
  if(typeof window.renderWhyApply==='function' && !window.renderWhyApply.__liveOnly){
    var origWhy=window.renderWhyApply;window.renderWhyApply=function(id){var old=window.ALL_IPOS;try{window.ALL_IPOS=liveData();return origWhy(id);}finally{window.ALL_IPOS=old;}};window.renderWhyApply.__liveOnly=true;
  }
}
function repairDeadControls(){
  document.querySelectorAll('.hbtns .hb').forEach(function(b){
    if(b.id==='gmp-btn')return;
    var oc=b.getAttribute('onclick')||'';
    var m=oc.match(/tg\(['\"]([^'\"]+)['\"]/);
    if(m&&!document.getElementById(m[1])){b.setAttribute('aria-disabled','true');b.style.display='none';}
  });
}
function run(){wrapOpenOnly();cleanGmp();cleanVideo();cleanDecision();cleanRadar();repairDeadControls();}
function start(){
  run();
  var count=0,t=setInterval(function(){run();if(++count>=60)clearInterval(t);},500);
  var mo=new MutationObserver(function(){run();});
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect();clearInterval(t);},3600000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,400);});else setTimeout(start,400);
})();
