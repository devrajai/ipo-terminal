/* IPO Terminal: IPO Articles + robust DRHP/RHP panel. Public links only; no copied article text. */
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
function renderArticles(){
 var p=document.getElementById('p-articles');if(!p)return;
 var news=Array.isArray(window.NEWS_ITEMS)?window.NEWS_ITEMS.slice():[];
 var categories=[
  ['IPO News','Latest IPO news, filings, subscription and listing updates'],
  ['IPO Reviews','Apply/Avoid and company-specific research'],
  ['GMP & Subscription','Grey market and demand updates'],
  ['DRHP / RHP','IPO filing and prospectus coverage'],
  ['IPO Calendar','Upcoming opening, closing and listing schedules']
 ];
 var h='<div class="panel-title">IPO Articles <button class="close-x" id="ipo-art-close">Close</button></div><div class="news-list">';
 categories.forEach(function(cat){var matches=news.filter(function(n){var s=(String(n.title||'')+' '+String(n.tag||'')).toLowerCase();if(cat[0]==='IPO Reviews')return /review|apply|avoid/.test(s);if(cat[0]==='GMP & Subscription')return /gmp|subscription|grey/.test(s);if(cat[0]==='DRHP / RHP')return /drhp|rhp|filing/.test(s);if(cat[0]==='IPO Calendar')return /calendar|opening|closing|listing/.test(s);return true;}).slice(0,5);
  h+='<div class="news-item"><b style="font-size:12px">'+esc(cat[0])+'</b><div class="tx3" style="margin:2px 0 5px">'+esc(cat[1])+'</div>';
  if(matches.length){matches.forEach(function(n){h+='<div style="padding:5px 0;border-top:1px solid var(--bd)"><span class="news-tag '+esc(n.tc||'bl')+'">'+esc(n.tag||'ARTICLE')+'</span> <a class="news-link" href="'+esc(n.url||'#')+'" target="_blank" rel="noopener">'+esc(n.title||'Read article')+' →</a><div class="news-source">'+esc(n.source||'Source')+' · '+esc(n.date||'')+'</div></div>';});}else h+='<div class="tx3">No article available in this category yet.</div>';
  h+='</div>';});
 h+='<div class="news-item" style="border-left-color:var(--or)"><b>IPO Watch reference</b><div style="font-size:10px;margin-top:4px">We use public article links as references only. We do not copy IPO Watch article text or scrape it as a private data feed. Their public site covers IPO news, GMP, reviews, calendars and DRHP/RHP topics.</div><div style="margin-top:6px"><a class="dl-btn" href="https://ipowatch.in/ipo-news/" target="_blank" rel="noopener">Open IPO Watch Articles →</a></div></div>';
 h+='</div>';p.innerHTML=h;p.classList.add('show');document.getElementById('ipo-art-close').onclick=function(){p.classList.remove('show');var b=document.getElementById('b-articles');if(b)b.classList.remove('active');};
}
function init(){
 var box=document.querySelector('.hbtns');if(!box)return;
 if(!document.getElementById('b-articles')){var b=document.createElement('button');b.className='hb';b.id='b-articles';b.textContent='IPO Articles';b.onclick=function(){renderArticles();b.classList.toggle('active');};box.appendChild(b);}
 if(!document.getElementById('p-articles')){var p=document.createElement('div');p.className='panel';p.id='p-articles';document.body.appendChild(p);}
 renderDocs();renderDrhp();
 var old=window.renderAll;if(typeof old==='function'&&!old.__articlePatch){function patched(){old();renderDocs();renderDrhp();}patched.__articlePatch=true;window.renderAll=patched;}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,120);});else setTimeout(init,120);
})();
