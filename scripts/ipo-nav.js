/* IPO Terminal navigation stabilizer: keeps all feature buttons visible, removes legacy Brokers, and keeps lot decision buttons together. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-gloss','b-why','ipc-btn','ipf-btn','dna-btn','radar-btn','lot1-btn','lot2-btn','lot3-btn'];
var labels={'ipc-btn':'IPO Calendar','ipf-btn':'IPO Fundamentals','dna-btn':'IPO DNA','radar-btn':'IPO Radar','lot1-btn':'1-Lot Decision','lot2-btn':'2-Lot Decision','lot3-btn':'3-Lot Decision'};
var modules=[['ipc-btn','scripts/ipo-calendar.js'],['ipf-btn','scripts/ipo-fundamentals.js'],['dna-btn','scripts/ipo-dna.js'],['radar-btn','scripts/ipo-radar.js']];
function loadMissing(){modules.forEach(function(x){if(!document.getElementById(x[0])){var s=document.createElement('script');s.src=x[1]+'?navfix=1';s.async=false;document.body.appendChild(s);}});}
function run(){
 var nav=document.querySelector('.hbtns');if(!nav)return;
 var legacy=document.getElementById('b-brk');if(legacy)legacy.remove();
 var old=document.getElementById('b-research-lens');if(old)old.remove();
 loadMissing();
 var all=Array.prototype.slice.call(nav.querySelectorAll('.hb')),map={};all.forEach(function(b){if(b.id)map[b.id]=b;});
 Object.keys(labels).forEach(function(id){if(map[id])map[id].textContent=labels[id];});
 wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});
 nav.classList.add('ipo-nav-stable');
}
function start(){run();var tries=0,t=setInterval(function(){run();if(++tries>=30)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});else setTimeout(start,700);
})();