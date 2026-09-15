/* IPO Terminal responsive shell + resilient feature-button loader. */
(function(){
'use strict';
function addStyle(){
 if(document.getElementById('ipo-responsive-shell'))return;
 var s=document.createElement('style');s.id='ipo-responsive-shell';s.textContent=''
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
+'#ipo-feature-error{display:none;margin:8px 0;padding:9px;border:1px solid var(--rd);border-radius:9px;background:rgba(239,68,68,.08);color:var(--rd);font-size:10px;font-weight:700}'
+'@media(max-width:700px){.hbtns .hb{font-size:10px;min-height:40px}}';
 document.head.appendChild(s);
}
function active(id,on){var b=document.getElementById(id);if(b)b.classList.toggle('active',!!on);}
function closePanels(){document.querySelectorAll('.panel.show').forEach(function(p){p.classList.remove('show');});['ipf-btn','dna-btn','radar-btn'].forEach(function(id){active(id,false);});}
function load(src,done){
 var existing=document.querySelector('script[data-ipo-feature="'+src+'"]');
 if(existing){if(done)setTimeout(done,100);return;}
 var s=document.createElement('script');s.src=src+'?ui='+Date.now();s.async=false;s.dataset.ipoFeature=src;s.onload=function(){if(done)setTimeout(done,120);};s.onerror=function(){showError('Could not load '+src);};document.body.appendChild(s);
}
function showError(msg){var x=document.getElementById('ipo-feature-error');if(!x){x=document.createElement('div');x.id='ipo-feature-error';var host=document.querySelector('.hdr');if(host)host.appendChild(x);}x.textContent='IPO Terminal feature error: '+msg;x.style.display='block';}
function openPanel(panelId,buttonId){
 var p=document.getElementById(panelId);if(!p)return false;
 closePanels();p.classList.add('show');active(buttonId,true);p.scrollIntoView({behavior:'smooth',block:'start'});return true;
}
function ensureFeature(buttonId,panelId,src){
 var p=document.getElementById(panelId);
 if(p)return openPanel(panelId,buttonId);
 var old=document.getElementById(buttonId);if(old)old.remove();
 load(src,function(){
  var tries=0,t=setInterval(function(){
   var panel=document.getElementById(panelId),btn=document.getElementById(buttonId);
   if(panel){clearInterval(t);openPanel(panelId,buttonId);return;}
   if(++tries>30){clearInterval(t);showError('Panel '+panelId+' did not initialize.');}
  },100);
 });
 return false;
}
function bind(){
 var defs=[
  ['ipf-btn','ipo-fundamentals-panel','scripts/ipo-fundamentals.js','IPO Fundamentals'],
  ['dna-btn','ipo-dna-panel','scripts/ipo-dna.js','IPO DNA'],
  ['radar-btn','ipo-radar-panel','scripts/ipo-radar.js','IPO Radar']
 ];
 defs.forEach(function(d){var b=document.getElementById(d[0]);if(!b)return;b.type='button';b.textContent=d[3];b.onclick=function(){var p=document.getElementById(d[1]);if(p&&p.classList.contains('show')){closePanels();return;}ensureFeature(d[0],d[1],d[2]);};});
 var cal=document.getElementById('ipc-btn');if(cal){cal.type='button';}
}
function start(){addStyle();bind();var tries=0,t=setInterval(function(){addStyle();bind();if(++tries>30)clearInterval(t);},400);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,1000);});else setTimeout(start,1000);
})();
