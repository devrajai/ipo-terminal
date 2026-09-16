/* IPO Terminal: single RHP/DRHP panel for live + upcoming IPOs. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function active(i){return /^(open|live|upcoming)$/i.test(String(i&&i.status||'').trim());}
function loadJSON(path){return fetch(path+'?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw Error(path);return r.json();});}
function typeClass(t){return /DRHP/i.test(t)?'pp':(/RHP/i.test(t)?'bl':'or');}
function norm(s){return String(s||'').toLowerCase().replace(/[^a-z0-9]+/g,'').replace(/limited|ltd/g,'');}
function match(a,b){var x=norm(a),y=norm(b);return !!x&&!!y&&(x===y||x.indexOf(y)>=0||y.indexOf(x)>=0);}
function renderFilingPanel(payload,ipos){
 var c=document.getElementById('doc-container');if(!c)return;
 var docs=Array.isArray(payload)?payload:[];ipos=(Array.isArray(ipos)?ipos:[]).filter(active);
 var rows=[];var used={};
 ipos.forEach(function(i){var d=null;for(var j=0;j<docs.length;j++){if(match(i.name,docs[j].name)){d=docs[j];break;}}
  rows.push({name:i.name,status:i.status,type:d&&d.type||'IPO Filing',date:d&&d.date||'—',url:d&&d.url||'',verified:d&&d.verified===true,open:i.open,close:i.close});
  used[norm(i.name)]=1;
 });
 if(!rows.length){c.innerHTML='<div class="news-item">No live or upcoming IPO filings are available right now. The automatic collector will add them when official filings are published.</div>';return;}
 rows.sort(function(a,b){return String(a.name).localeCompare(String(b.name));});
 var h='<div style="padding:8px;font-size:11px;color:var(--tx3)"><b>Live & Upcoming IPO RHP / DRHP</b><br>Closed, listed and old IPO filings are automatically removed. New IPOs and official filing links are checked automatically in the background.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>IPO / Company</th><th>Status</th><th>Filing</th><th>Date</th><th>Open</th><th>Close</th><th>Link</th></tr></thead><tbody>';
 rows.forEach(function(d){var v=d.verified?' · ✓ verified':'';h+='<tr><td><b>'+esc(d.name)+'</b></td><td>'+esc(d.status)+'</td><td><span class="badge '+typeClass(d.type)+'">'+esc(d.type)+'</span></td><td>'+esc(d.date)+'</td><td>'+esc(d.open||'—')+'</td><td>'+esc(d.close||'—')+'</td><td>'+(d.url?'<a class="dl-btn" href="'+esc(d.url)+'" target="_blank" rel="noopener">Open Filing →</a><span class="tx3" style="display:block;font-size:9px">'+v+'</span>':'<span class="tx3">Awaiting official filing link</span>')+'</td></tr>';});
 h+='</tbody></table></div><div style="padding:8px;font-size:10px;color:var(--tx3)">Automatic refresh: every 15 minutes · Official SEBI filing index: <a class="news-link" target="_blank" rel="noopener" href="https://www.sebi.gov.in/filings/public-issues.html">SEBI Public Issue Filings →</a></div>';
 c.innerHTML=h;
}
function renderLegacy(){var p=document.getElementById('pipe-container');if(p)p.innerHTML='<div class="news-item"><b>DRHP / RHP moved here</b><div class="tx3">Only live and upcoming IPO filings are shown. Old filings disappear automatically.</div></div>';}
function renderDocs(){Promise.all([loadJSON('data/live-filings.json').catch(function(){return {documents:[]};}),loadJSON('data/ipo-data.json').catch(function(){return {ipos:[]};})]).then(function(x){renderFilingPanel(x[0].documents,x[1].ipos);renderLegacy();}).catch(function(){renderFilingPanel([],[]);renderLegacy();});}
function parseDate(v){var d=new Date(v);return isNaN(d.getTime())?null:d;}
function dayAge(v){var d=parseDate(v);if(!d)return 999;var n=new Date(),a=new Date(n.getFullYear(),n.getMonth(),n.getDate()),b=new Date(d.getFullYear(),d.getMonth(),d.getDate());return Math.floor((a-b)/86400000);}
function wordsFor(name){return String(name||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(function(w){return w.length>=4&&!/limited|india|private|company|technolog|developers/.test(w);});}
function loadArticles(){var p=document.getElementById('p-articles');if(!p)return;loadJSON('data/live-news.json').then(function(d){var ipos=Array.isArray(window.ALL_IPOS)?window.ALL_IPOS.filter(active):[];var news=(Array.isArray(d.items)?d.items:[]).filter(function(n){var age=dayAge(n.published||n.date);if(age<0||age>5)return false;var t=String(n.title||'').toLowerCase();return ipos.some(function(i){return t.indexOf(String(i.name||'').toLowerCase())>=0||wordsFor(i.name).some(function(w){return t.indexOf(w)>=0;});});});var h='<div class="panel-title">IPO Articles <button class="close-x" id="ipo-art-close">Close</button></div><div class="news-item"><b>Recent IPO coverage</b><div class="tx3">Today through the last 5 days · Live / Upcoming IPOs only · background refresh every 15 minutes.</div></div><div class="news-list">';news.slice(0,30).forEach(function(n){h+='<div class="news-item"><a class="news-link" href="'+esc(n.url||'#')+'" target="_blank" rel="noopener">'+esc(n.title||'Read article')+' →</a><div class="news-source">'+esc(n.source||'Source')+' · '+esc(n.published||'Recent')+'</div></div>';});if(!news.length)h+='<div class="tx3">No matching recent articles.</div>';h+='</div>';p.innerHTML=h;p.classList.add('show');var c=document.getElementById('ipo-art-close');if(c)c.onclick=function(){p.classList.remove('show');};}).catch(function(){p.innerHTML='<div class="panel-title">IPO Articles</div><div class="news-item">News feed temporarily unavailable.</div>';p.classList.add('show');});}
function init(){var box=document.querySelector('.hbtns');if(!box)return;renderDocs();if(!document.getElementById('b-articles')){var b=document.createElement('button');b.className='hb';b.id='b-articles';b.textContent='IPO Articles';b.onclick=loadArticles;box.appendChild(b);}if(!document.getElementById('p-articles')){var p=document.createElement('div');p.className='panel';p.id='p-articles';document.body.appendChild(p);}var bpipe=document.getElementById('b-pipe');if(bpipe)bpipe.style.display='none';setInterval(renderDocs,15*60*1000);setInterval(function(){var p=document.getElementById('p-articles');if(p&&p.classList.contains('show'))loadArticles();},15*60*1000);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,120);});else setTimeout(init,120);
})();
