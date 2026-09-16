/* IPO Terminal: recent IPO articles + robust DRHP/RHP panel. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function typeClass(t){return /DRHP/i.test(t)?'pp':(/RHP/i.test(t)?'bl':'or');}
function renderDocs(){
 var c=document.getElementById('doc-container');if(!c)return;
 var docs=Array.isArray(window.RHP_LINKS)?window.RHP_LINKS:[];
 if(!docs.length){c.innerHTML='<div class="news-item">No filing documents are available yet. Automatic SEBI filing collection will populate this section when accessible.</div>';return;}
 var h='<div style="padding:8px;font-size:11px;color:var(--tx3)">Official filing links collected from IPO Terminal sources. DRHP = draft, RHP = red herring, UDRHP = updated draft.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>IPO / Company</th><th>Type</th><th>Date</th><th>Document</th></tr></thead><tbody>';
 docs.forEach(function(d){var t=String(d.type||'Filing');h+='<tr><td><b>'+esc(d.name||'—')+'</b></td><td><span class="badge '+typeClass(t)+'">'+esc(t)+'</span></td><td>'+esc(d.date||'—')+'</td><td>'+(d.url?'<a class="dl-btn" href="'+esc(d.url)+'" target="_blank" rel="noopener">Open Filing →</a>':'<span class="tx3">No link</span>')+'</td></tr>';});
 h+='</tbody></table></div><div style="padding:8px;font-size:10px;color:var(--tx3)">Primary source: <a class="news-link" target="_blank" rel="noopener" href="https://www.sebi.gov.in/filings/public-issues.html">SEBI Public Issue Filings →</a></div>';c.innerHTML=h;
}
function renderDrhp(){
 var c=document.getElementById('pipe-container');if(!c)return;
 var docs=Array.isArray(window.RHP_LINKS)?window.RHP_LINKS.filter(function(d){return /DRHP|UDRHP/i.test(String(d.type||''));}):[];
 var seen={};docs.forEach(function(d){seen[String(d.name||'').toLowerCase()]=d;});
 var rows=docs.slice();
 if(Array.isArray(window.ALL_IPOS))ALL_IPOS.forEach(function(i){if(!i||!i.name)return;var k=String(i.name).toLowerCase();if(!seen[k]&&(i.status==='future'||(!i.open&&!i.close)))rows.push({name:i.name,type:'DRHP / Pipeline',date:'—',url:'',sector:i.sector,size:i.size,price:i.price});});
 if(!rows.length){c.innerHTML='<div class="news-item">No DRHP/UDRHP filings are currently available. The button is retained because the section is connected to automatic filing data.</div>';return;}
 var h='<div style="padding:8px;font-size:11px;color:var(--tx3)"><b>DRHP Filed</b> shows companies with draft filings. It does not require an IPO date or price band.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>Company</th><th>Filing</th><th>Filed</th><th>Est. Size</th><th>Price</th><th>Open</th><th>Document</th></tr></thead><tbody>';
 rows.forEach(function(d){var k=String(d.name||'').toLowerCase(),x=seen[k]||d;h+='<tr><td><b>'+esc(d.name||'—')+'</b></td><td><span class="badge pp">'+esc(d.type||'DRHP')+'</span></td><td>'+esc(d.date||'—')+'</td><td>'+esc(d.size||'—')+'</td><td>'+esc(d.price||'—')+'</td><td>'+esc(d.open||'TBA')+'</td><td>'+(x.url?'<a class="dl-btn" href="'+esc(x.url)+'" target="_blank" rel="noopener">Open →</a>':'<span class="tx3">Awaiting official link</span>')+'</td></tr>';});
 h+='</tbody></table></div>';c.innerHTML=h;
}
function parseDate(v){
 var d=new Date(v);return isNaN(d.getTime())?null:d;
}
function dayAge(v){
 var d=parseDate(v);if(!d)return 999;
 var now=new Date(),a=new Date(now.getFullYear(),now.getMonth(),now.getDate()),b=new Date(d.getFullYear(),d.getMonth(),d.getDate());
 return Math.floor((a-b)/86400000);
}
function ageLabel(age){return age===0?'Today':age===1?'Yesterday':age+' days ago';}
function ipoIsActive(i){
 if(!i)return false;
 var s=String(i.status||i.status_auto||'').toLowerCase();
 return /open|live|upcoming|future|closed/.test(s);
}
function wordsFor(name){
 return String(name||'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').split(/\s+/).filter(function(w){return w.length>=4&&!/limited|india|private|company|technolog|developers/.test(w);});
}
function articleMatchesIpo(n,i){
 var title=String(n.title||'').toLowerCase();
 var name=String(i.name||'').toLowerCase();
 if(name && title.indexOf(name)>=0)return true;
 var words=wordsFor(i.name);return words.length>0&&words.some(function(w){return title.indexOf(w)>=0;});
}
function normalizeNews(items){
 var ipos=Array.isArray(window.ALL_IPOS)?window.ALL_IPOS.filter(ipoIsActive):[];
 var out=[];
 (Array.isArray(items)?items:[]).forEach(function(n){
   var age=dayAge(n.published||n.date);
   if(age<0||age>5)return;
   var matches=ipos.filter(function(i){return articleMatchesIpo(n,i);});
   if(!matches.length)return;
   var x=Object.assign({},n,{age:age,ageLabel:ageLabel(age),matchedIpos:matches.map(function(i){return i.name;})});
   out.push(x);
 });
 var seen={};
 out.sort(function(a,b){return (a.age-b.age)||String(a.title).localeCompare(String(b.title));});
 return out.filter(function(n){var k=String(n.url||n.title);if(seen[k])return false;seen[k]=1;return true;});
}
function renderArticleList(news){
 var cats=[
  ['IPO News',function(n){return true;}],
  ['IPO Reviews',function(n){return /review|apply|avoid/.test(String(n.title||'').toLowerCase());}],
  ['GMP & Subscription',function(n){return /gmp|subscription|grey|premium/.test(String(n.title||'').toLowerCase());}],
  ['DRHP / RHP',function(n){return /drhp|rhp|filing|prospectus/.test(String(n.title||'').toLowerCase());}],
  ['IPO Calendar',function(n){return /calendar|opening|closing|listing|open|close/.test(String(n.title||'').toLowerCase());}]
 ];
 var h='<div class="panel-title">IPO Articles <button class="close-x" id="ipo-art-close">Close</button></div><div class="news-item" style="border-left-color:var(--bl)"><b>Fresh article window</b><div class="tx3" style="margin-top:3px">Only articles from today through the last 5 days are shown, and only when they relate to a Live, Upcoming or Closed IPO in the terminal.</div><div class="tx3" style="margin-top:2px">Background refresh: every 15 minutes.</div></div><div class="news-list">';
 cats.forEach(function(cat){
   var matches=news.filter(cat[1]).slice(0,5);
   h+='<div class="news-item"><b style="font-size:12px">'+esc(cat[0])+'</b><div class="tx3" style="margin:2px 0 5px">Recent IPO coverage only</div>';
   if(matches.length){matches.forEach(function(n){h+='<div style="padding:5px 0;border-top:1px solid var(--bd)"><span class="news-tag '+esc(n.tc||'bl')+'">'+esc(n.tag||'ARTICLE')+'</span> <a class="news-link" href="'+esc(n.url||'#')+'" target="_blank" rel="noopener">'+esc(n.title||'Read article')+' →</a><div class="news-source">'+esc(n.source||'Source')+' · '+esc(n.ageLabel||'Recent')+' · '+esc((n.matchedIpos||[]).join(', '))+'</div></div>';});}
   else h+='<div class="tx3">No matching article from the last 5 days.</div>';
   h+='</div>';
 });
 h+='<div class="news-item" style="border-left-color:var(--or)"><b>Automatic article feed</b><div style="font-size:10px;margin-top:4px">IPO Terminal refreshes its public news feed in the background. Older articles automatically disappear after 5 days.</div></div></div>';
 return h;
}
function loadLiveArticles(show){
 var p=document.getElementById('p-articles');if(!p)return;
 fetch('data/live-news.json?t='+Date.now(),{cache:'no-store'}).then(function(r){if(!r.ok)throw new Error('news fetch failed');return r.json();}).then(function(d){
   var news=normalizeNews(d&&d.items);p.innerHTML=renderArticleList(news);p.classList.add('show');
   var b=document.getElementById('b-articles');if(b)b.classList.add('active');
   var c=document.getElementById('ipo-art-close');if(c)c.onclick=function(){p.classList.remove('show');if(b)b.classList.remove('active');};
 }).catch(function(){p.innerHTML=renderArticleList([]);p.classList.add('show');});
}
function init(){
 var box=document.querySelector('.hbtns');if(!box)return;
 if(!document.getElementById('b-articles')){var b=document.createElement('button');b.className='hb';b.id='b-articles';b.textContent='IPO Articles';b.onclick=function(){loadLiveArticles(true);};box.appendChild(b);}
 if(!document.getElementById('p-articles')){var p=document.createElement('div');p.className='panel';p.id='p-articles';document.body.appendChild(p);}
 renderDocs();renderDrhp();
 var old=window.renderAll;if(typeof old==='function'&&!old.__articlePatch){function patched(){old();renderDocs();renderDrhp();}patched.__articlePatch=true;window.renderAll=patched;}
 setInterval(function(){if(document.getElementById('p-articles')&&document.getElementById('p-articles').classList.contains('show'))loadLiveArticles(false);},15*60*1000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,120);});else setTimeout(init,120);
})();
