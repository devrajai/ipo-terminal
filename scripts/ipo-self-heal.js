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
function cleanRetiredControls(){
  ['b-why','ipf-btn','radar-btn','b-radar','decision-btn'].forEach(function(id){
    var x=document.getElementById(id);if(x)x.remove();
  });
  ['p-why','ipo-decision-panel','p-decision','ipo-radar-panel','p-radar'].forEach(function(id){
    var x=document.getElementById(id);if(x)x.remove();
  });
  document.querySelectorAll('.hbtns .hb').forEach(function(b){
    var t=String(b.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(t==='why apply'||t==='decision'||t==='ipo radar')b.remove();
  });
}
function cleanGmp(){
  ['gmp-btn','gmp-panel','ipo-gmp-panel','p-gmp'].forEach(function(id){var x=document.getElementById(id);if(x)x.remove();});
}
function cleanVideo(){
  /* Remove the fallback sentence wherever it is rendered, including mobile/lazy-loaded panels. */
  var re=/Video\s*summary\s*-\s*no\s*external\s*video\s*\/\s*link/ig;
  var nodes=[],w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT),n;
  while(n=w.nextNode())nodes.push(n);
  nodes.forEach(function(t){
    var v=String(t.nodeValue||'');
    if(!re.test(v))return;
    re.lastIndex=0;
    var p=t.parentElement;
    var cleaned=v.replace(re,'').replace(/[ \t]+\n/g,'\n').trim();
    if(p && p.children.length===0 && !cleaned) p.remove();
    else t.nodeValue=cleaned;
  });
  document.querySelectorAll('body *').forEach(function(el){
    if(el.children.length===0 && /Video\s*summary\s*-\s*no\s*external\s*video\s*\/\s*link/i.test(String(el.textContent||'')))el.remove();
  });
}
function wrapOpenOnly(){
  if(typeof window.renderComp==='function' && !window.renderComp.__liveOnly){
    var orig=window.renderComp;window.renderComp=function(id,ipos){return orig(id,(ipos||[]).filter(liveOrUpcoming));};window.renderComp.__liveOnly=true;
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
function run(){cleanRetiredControls();wrapOpenOnly();cleanGmp();cleanVideo();repairDeadControls();}
function start(){
  run();
  var count=0,t=setInterval(function(){run();if(++count>=60)clearInterval(t);},500);
  var mo=new MutationObserver(function(){run();});
  mo.observe(document.body,{childList:true,subtree:true});
  setTimeout(function(){mo.disconnect();clearInterval(t);},3600000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,400);});else setTimeout(start,400);
})();
