/* IPO Terminal navigation — single owner for Calendar, Decision and Radar. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-brk','b-gloss','b-why','ipc-btn','ipf-btn','radar-btn'];
var labels={'ipc-btn':'IPO Calendar','ipf-btn':'Decision','radar-btn':'IPO Radar'};
var modules={
 calendar:['ipc-btn','scripts/ipo-calendar.js','ipo-calendar-panel'],
 decision:['ipf-btn','scripts/ipo-decision.js','ipo-decision-panel'],
 radar:['radar-btn','scripts/ipo-radar.js','ipo-radar-panel']
};
function loadScript(src,done){var s=document.createElement('script');s.src=src+'?navclick='+Date.now();s.async=false;s.onload=function(){if(done)done();};s.onerror=function(){if(done)done(new Error('Could not load '+src));};document.body.appendChild(s);}
function clearActive(){['ipc-btn','ipf-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('active');});}
function closePanels(except){document.querySelectorAll('.panel.show').forEach(function(p){if(!except||p.id!==except)p.classList.remove('show');});}
function showError(msg){var x=document.getElementById('ipo-feature-error');if(!x){x=document.createElement('div');x.id='ipo-feature-error';x.style.cssText='margin:8px 0;padding:9px;border:1px solid var(--rd);border-radius:9px;background:rgba(239,68,68,.08);color:var(--rd);font-size:10px;font-weight:700';var host=document.querySelector('.hdr');if(host)host.appendChild(x);}x.textContent='IPO Terminal feature error: '+msg;x.style.display='block';}
function openPanel(panelId,buttonId){var p=document.getElementById(panelId),b=document.getElementById(buttonId);if(!p)return false;closePanels(panelId);clearActive();p.classList.add('show');if(b)b.classList.add('active');setTimeout(function(){try{p.scrollIntoView({behavior:'smooth',block:'start'});}catch(e){p.scrollIntoView();}},30);return true;}
function finishNewFeature(buttonId,panelId){var p=document.getElementById(panelId),b=document.getElementById(buttonId);if(!p||!b)return false;try{if(typeof b.onclick==='function')b.onclick();}catch(e){showError(e.message||String(e));return false;}b.type='button';b.textContent=labels[buttonId];b.dataset.navBound='1';return openPanel(panelId,buttonId);}
function feature(key){var m=modules[key],id=m[0],src=m[1],panel=m[2],p=document.getElementById(panel);if(p){var b=document.getElementById(id);if(p.classList.contains('show')){p.classList.remove('show');if(b)b.classList.remove('active');return;}openPanel(panel,id);return;}var old=document.getElementById(id);if(old)old.remove();var tries=0,finished=false;loadScript(src,function(err){if(err)showError(err.message);});var t=setInterval(function(){var panelEl=document.getElementById(panel),btn=document.getElementById(id);if(panelEl&&btn){clearInterval(t);finished=finishNewFeature(id,panel);return;}if(++tries>=40){clearInterval(t);if(!finished)showError('Panel '+panel+' did not initialize.');}},100);}
function moveFeatures(nav){['ipc-btn','ipf-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b&&b.parentElement!==nav)nav.appendChild(b);});}
function order(nav){var all=[].slice.call(nav.querySelectorAll('.hb')),map={};all.forEach(function(b){if(b.id)map[b.id]=b;});wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});}
function featureKeyFor(id){var keys=Object.keys(modules);for(var i=0;i<keys.length;i++)if(modules[keys[i]][0]===id)return keys[i];return null;}
function wire(){var nav=document.querySelector('.hbtns');if(!nav)return;['b-research-lens','lot1-btn','b-intelligence'].forEach(function(id){var x=document.getElementById(id);if(x)x.remove();});moveFeatures(nav);order(nav);['ipc-btn','ipf-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b){b.type='button';b.textContent=labels[id];b.dataset.navBound='1';}});if(!nav.dataset.featureDelegate){nav.dataset.featureDelegate='1';nav.addEventListener('click',function(ev){var b=ev.target.closest('.hb');if(!b)return;var key=featureKeyFor(b.id);if(!key)return;ev.preventDefault();ev.stopPropagation();feature(key);},true);}nav.classList.add('ipo-nav-stable');}
function start(){wire();var tries=0,t=setInterval(function(){wire();if(++tries>=40)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});else setTimeout(start,700);
})();
