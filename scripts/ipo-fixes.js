/* IPO Terminal reliability + UX fixes. Keeps everything automatic and mobile-first. */
(function(){
'use strict';
var SEED_URL='data/fundamentals-seed.json?ts='+Date.now();
function good(v){return v!==undefined&&v!==null&&v!==''&&v!=='—'&&v!=='-';}
function norm(v){return String(v||'').toLowerCase().replace(/\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b/g,' ').replace(/[^a-z0-9]+/g,'');}
function mergeSeed(seed){if(!Array.isArray(window.ALL_IPOS)||!Array.isArray(seed))return;var map={};seed.forEach(function(s){map[norm(s.name)]=s;});window.ALL_IPOS.forEach(function(i){var s=map[norm(i.name)];if(!s)return;['sector','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom','size','lot'].forEach(function(k){if(!good(i[k])&&good(s[k]))i[k]=s[k];});});if(typeof window.renderAll==='function')window.renderAll();}
function loadV2(){['scripts/ipo-research-lens-v2.js','scripts/ipo-fundamentals-v2.js','scripts/ipo-ux-fixes-v2.js'].forEach(function(src){if(document.querySelector('script[src^="'+src+'"]'))return;var s=document.createElement('script');s.src=src+'?ts='+Date.now();s.defer=true;document.body.appendChild(s);});}
function init(){loadV2();fetch(SEED_URL,{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(mergeSeed).catch(function(){});}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,700);});else setTimeout(init,700);
})();
