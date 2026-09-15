/* IPO Terminal navigation fix — Fundamentals owns the lot planner. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-gloss','b-why','ipc-btn','ipf-btn','dna-btn','radar-btn'];
var labels={'ipc-btn':'IPO Calendar','ipf-btn':'IPO Fundamentals','dna-btn':'IPO DNA','radar-btn':'IPO Radar'};
var modules={fundamentals:['ipf-btn','scripts/ipo-fundamentals.js'],dna:['dna-btn','scripts/ipo-dna.js'],radar:['radar-btn','scripts/ipo-radar.js']};
function loadScript(src){var s=document.createElement('script');s.src=src+'?navclick='+Date.now();s.async=false;document.body.appendChild(s);}
function clearActive(){['ipf-btn','dna-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('active');});}
function moveFeatures(nav){['ipc-btn','ipf-btn','dna-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b&&b.parentElement!==nav)nav.appendChild(b);});}
function toggle(panelId,buttonId){var p=document.getElementById(panelId),b=document.getElementById(buttonId);if(!p)return false;var open=p.classList.contains('show');document.querySelectorAll('.panel.show').forEach(function(x){x.classList.remove('show');});clearActive();if(!open){p.classList.add('show');if(b)b.classList.add('active');p.scrollIntoView({behavior:'smooth',block:'start'});}return true;}
function feature(key){var id=modules[key][0],panel=key==='fundamentals'?'ipo-fundamentals-panel':key==='dna'?'ipo-dna-panel':'ipo-radar-panel';var p=document.getElementById(panel);if(p){toggle(panel,id);return;}var b=document.getElementById(id);if(b)b.remove();loadScript(modules[key][1]);setTimeout(function(){toggle(panel,id);},900);}
function wire(){var nav=document.querySelector('.hbtns');if(!nav)return;var legacy=document.getElementById('b-brk');if(legacy)legacy.remove();var old=document.getElementById('b-research-lens');if(old)old.remove();['lot1-btn','lot2-btn','lot3-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.remove();});moveFeatures(nav);Object.keys(modules).forEach(function(k){var b=document.getElementById(modules[k][0]);if(b&&!b.dataset.navBound){b.dataset.navBound='1';b.textContent=labels[b.id];b.type='button';b.onclick=function(){feature(k);};}});var all=[].slice.call(nav.querySelectorAll('.hb')),map={};all.forEach(function(b){if(b.id)map[b.id]=b;});wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});nav.classList.add('ipo-nav-stable');}
function start(){wire();var tries=0,t=setInterval(function(){wire();if(++tries>=40)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});else setTimeout(start,700);
})();
