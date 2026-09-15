/* IPO Terminal navigation stabilizer: one Lot Decision button acts as a shortcut to IPO Fundamentals + its lot planner. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-gloss','b-why','ipc-btn','ipf-btn','dna-btn','radar-btn','lot1-btn'];
var labels={'ipc-btn':'IPO Calendar','ipf-btn':'IPO Fundamentals','dna-btn':'IPO DNA','radar-btn':'IPO Radar','lot1-btn':'Lot Decision'};
var modules={ipf:['ipf-btn','scripts/ipo-fundamentals.js'],dna:['dna-btn','scripts/ipo-dna.js'],radar:['radar-btn','scripts/ipo-radar.js']};
function loadScript(src){var s=document.createElement('script');s.src=src+'?navclick='+Date.now();s.async=false;document.body.appendChild(s);}
function showActive(id){document.querySelectorAll('.lot-decision-btn,.hb').forEach(function(x){if(x.id&&/^(ipf-btn|dna-btn|radar-btn|lot1-btn)$/.test(x.id))x.classList.remove('active');});var b=document.getElementById(id);if(b)b.classList.add('active');}
function rebootFeature(key){var spec=modules[key],id=spec[0],pId=key==='ipf'?'ipo-fundamentals-panel':key==='dna'?'ipo-dna-panel':'ipo-radar-panel';var old=document.getElementById(id);if(old)old.remove();var p=document.getElementById(pId);if(p)p.remove();loadScript(spec[1]);setTimeout(function(){var b=document.getElementById(id);if(b){showActive(id);b.click();}},500);}
function featureClick(key){var id=modules[key][0],pId=key==='ipf'?'ipo-fundamentals-panel':key==='dna'?'ipo-dna-panel':'ipo-radar-panel',p=document.getElementById(pId);if(p){if(p.classList.contains('show')){p.classList.remove('show');var b=document.getElementById(id);if(b)b.classList.remove('active');}else{p.classList.add('show');showActive(id);}}else rebootFeature(key);}
function openPlanner(lots){
 var p=document.getElementById('ipo-fundamentals-panel');
 if(!p){rebootFeature('ipf');setTimeout(function(){openPlanner(lots);},750);return;}
 var b=document.getElementById('ipf-btn');
 /* Lot Decision is intentionally an alias: clicking it automatically opens IPO Fundamentals. */
 if(!p.classList.contains('show')){if(b)b.click();else p.classList.add('show');}
 setTimeout(function(){
   p=document.getElementById('ipo-fundamentals-panel');
   if(!p)return;
   p.classList.add('show');
   var t=document.querySelector('.lot-tabs .planner-tab[data-lots="'+lots+'"]');
   if(t)t.click();
   /* Keep IPO Fundamentals highlighted because Lot Decision has opened that panel. */
   showActive('ipf-btn');
   p.scrollIntoView({behavior:'smooth',block:'start'});
 },350);
}
function wire(){
 var nav=document.querySelector('.hbtns');if(!nav)return;
 var legacy=document.getElementById('b-brk');if(legacy)legacy.remove();
 var old=document.getElementById('b-research-lens');if(old)old.remove();
 ['lot2-btn','lot3-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.remove();});
 ['ipf','dna','radar'].forEach(function(k){var b=document.getElementById(modules[k][0]);if(b&&!b.dataset.navBound){b.dataset.navBound='1';b.textContent=labels[b.id];b.onclick=function(){featureClick(k);};}});
 var lb=document.getElementById('lot1-btn');if(lb&&!lb.dataset.navBound){lb.dataset.navBound='1';lb.textContent='Lot Decision';lb.onclick=function(){openPlanner(1);};}
 var all=Array.prototype.slice.call(nav.querySelectorAll('.hb')),map={};all.forEach(function(b){if(b.id)map[b.id]=b;});wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});nav.classList.add('ipo-nav-stable');
}
function loadMissing(){if(!document.getElementById('ipc-btn'))loadScript('scripts/ipo-calendar.js');}
function start(){loadMissing();wire();var tries=0,t=setInterval(function(){wire();if(++tries>=40)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});else setTimeout(start,700);
})();
