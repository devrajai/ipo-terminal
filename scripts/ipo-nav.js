/* IPO Terminal navigation fix — four analysis controls are independently wired. */
(function(){
'use strict';
var wanted=['b-open','b-upc','b-pipe','b-list','b-comp','b-allot','b-news','b-doc','b-tips','b-gloss','b-why','ipc-btn','ipf-btn','dna-btn','radar-btn'];
var labels={'ipc-btn':'IPO Calendar','ipf-btn':'IPO Fundamentals','dna-btn':'IPO DNA','radar-btn':'IPO Radar'};
var modules={
 calendar:['ipc-btn','scripts/ipo-calendar.js','ipo-calendar-panel'],
 fundamentals:['ipf-btn','scripts/ipo-fundamentals.js','ipo-fundamentals-panel'],
 dna:['dna-btn','scripts/ipo-dna.js','ipo-dna-panel'],
 radar:['radar-btn','scripts/ipo-radar.js','ipo-radar-panel']
};
function loadScript(src){var s=document.createElement('script');s.src=src+'?navclick='+Date.now();s.async=false;document.body.appendChild(s);}
function clearActive(){['ipc-btn','ipf-btn','dna-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b)b.classList.remove('active');});}
function moveFeatures(nav){['ipc-btn','ipf-btn','dna-btn','radar-btn'].forEach(function(id){var b=document.getElementById(id);if(b&&b.parentElement!==nav)nav.appendChild(b);});}
function toggle(panelId,buttonId){
 var p=document.getElementById(panelId),b=document.getElementById(buttonId);
 if(!p)return false;
 var open=p.classList.contains('show');
 document.querySelectorAll('.panel.show').forEach(function(x){x.classList.remove('show');});
 clearActive();
 if(!open){p.classList.add('show');if(b)b.classList.add('active');p.scrollIntoView({behavior:'smooth',block:'start'});}
 return true;
}
function feature(key){
 var m=modules[key],id=m[0],src=m[1],panel=m[2],p=document.getElementById(panel);
 if(p){toggle(panel,id);return;}
 /* The feature modules intentionally skip their first initialization when the
    navigation already owns the button. Remove that button, reload the module,
    let it create its panel, then reopen it. */
 var b=document.getElementById(id);if(b)b.remove();
 loadScript(src);
 var tries=0,t=setInterval(function(){
   var panelEl=document.getElementById(panel),btn=document.getElementById(id);
   if(panelEl){clearInterval(t);toggle(panel,id);return;}
   if(++tries>=30){clearInterval(t);}
 },100);
}
function wire(){
 var nav=document.querySelector('.hbtns');if(!nav)return;
 var legacy=document.getElementById('b-brk');if(legacy)legacy.remove();
 var old=document.getElementById('b-research-lens');if(old)old.remove();
 moveFeatures(nav);
 Object.keys(modules).forEach(function(k){
   var id=modules[k][0],b=document.getElementById(id);
   if(b&&!b.dataset.navBound){
     b.dataset.navBound='1';b.textContent=labels[id];b.type='button';
     b.onclick=function(){feature(k);};
   }
 });
 var all=[].slice.call(nav.querySelectorAll('.hb')),map={};
 all.forEach(function(b){if(b.id)map[b.id]=b;});
 wanted.forEach(function(id){var b=map[id];if(b)nav.appendChild(b);});
 nav.classList.add('ipo-nav-stable');
}
function start(){wire();var tries=0,t=setInterval(function(){wire();if(++tries>=40)clearInterval(t);},500);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});else setTimeout(start,700);
})();
