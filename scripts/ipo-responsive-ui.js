/* IPO Terminal responsive shell — layout only. Feature clicks are owned by ipo-nav.js. */
(function(){
'use strict';
function addStyle(){
 if(document.getElementById('ipo-responsive-shell'))return;
 var s=document.createElement('style');
 s.id='ipo-responsive-shell';
 s.textContent=''
+'@media(min-width:901px){'
+'body{padding:8px 18px 18px 266px!important;min-height:100vh!important}'
+'.hdr{position:relative!important;margin-bottom:8px!important}'
+'.hbtns{position:fixed!important;left:10px!important;top:82px!important;width:242px!important;max-height:calc(100vh - 96px)!important;overflow-y:auto!important;overflow-x:hidden!important;display:grid!important;grid-template-columns:1fr!important;gap:7px!important;padding:10px!important;margin:0!important;background:var(--card)!important;border:1px solid var(--bd)!important;border-radius:14px!important;box-shadow:0 12px 35px rgba(0,0,0,.30)!important;z-index:9999!important;align-content:start!important}'
+'.hbtns .hb{width:100%!important;min-height:40px!important;text-align:left!important;padding:9px 12px!important;white-space:normal!important;margin:0!important}'
+'.hbtns .hb:hover{transform:translateX(2px)}'
+'.kpi-row,.panel{width:100%!important;max-width:none!important}'
+'.panel{scroll-margin-top:8px!important}'
+'.panel-title{position:sticky!important;top:0!important;z-index:20!important}'
+'}'
+'@media(max-width:900px){'
+'body{padding:8px!important}'
+'.hbtns{position:static!important;width:auto!important;max-height:none!important;overflow:visible!important;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:6px!important;margin-top:10px!important}'
+'.hbtns .hb{width:100%!important;min-width:0!important;margin:0!important;text-align:center!important;white-space:normal!important;padding:8px 5px!important;min-height:42px!important;font-size:11px!important}'
+'}'
+'#ipc-btn,#ipf-btn,#dna-btn,#radar-btn{font-weight:800!important}'
+'#ipf-btn{border-color:rgba(34,197,94,.55)!important}'
+'#dna-btn{border-color:rgba(59,130,246,.55)!important}'
+'#radar-btn{border-color:rgba(168,85,247,.55)!important}'
+'@media(max-width:700px){.hbtns .hb{font-size:10px;min-height:40px}}';
 document.head.appendChild(s);
}
function start(){addStyle();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,1000);});else setTimeout(start,1000);
})();
