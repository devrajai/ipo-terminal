/* IPO Terminal navigation stabilizer: keeps all feature buttons visible and removes legacy Brokers. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-gloss','b-why','ipc-btn','ipf-btn','dna-btn','radar-btn','b-research-lens'];
var labels={
 'ipc-btn':'IPO Calendar','ipf-btn':'IPO Fundamentals','dna-btn':'IPO DNA','radar-btn':'IPO Radar','b-research-lens':'1-Lot Decision'
};
function run(){
 var nav=document.querySelector('.hbtns');if(!nav)return;
 var legacy=document.getElementById('b-brk');if(legacy)legacy.remove();
 var all=Array.prototype.slice.call(nav.querySelectorAll('.hb'));
 var map={};all.forEach(function(b){if(b.id)map[b.id]=b;});
 /* If a feature script has already created its button, keep it. */
 Object.keys(labels).forEach(function(id){if(map[id])map[id].textContent=labels[id];});
 wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});
 nav.classList.add('ipo-nav-stable');
}
function start(){run();var tries=0,t=setInterval(function(){run();if(++tries>=20)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,900);});else setTimeout(start,900);
})();