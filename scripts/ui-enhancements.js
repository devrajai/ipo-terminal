/* IPO Terminal UI enhancements */
(function(){
  'use strict';
  var VIDEO='https://youtu.be/W4VmJ8UaUjE?si=coCXusbuLIifWw0o';
  function holiday(){
    var hdr=document.querySelector('.hdr'); if(!hdr||document.getElementById('ipo-holiday-line'))return;
    var d=document.createElement('div'); d.id='ipo-holiday-line';
    d.style.cssText='margin-top:8px;padding:8px 10px;border:1px solid var(--or);border-radius:8px;background:rgba(249,115,22,.10);color:var(--or);font-size:12px;font-weight:700';
    d.innerHTML='Upcoming Holiday - Ganesh Chaturthi <span style="font-weight:600">14 September 2026</span>';
    hdr.appendChild(d);
  }
  function addButton(id,label,panel){if(document.getElementById(id))return;var box=document.querySelector('.hbtns');if(!box)return;var b=document.createElement('button');b.className='hb';b.id=id;b.textContent=label;b.onclick=function(){tg(panel,b)};box.appendChild(b);}
  function addSelector(){
    addButton('b-select','How to Select Better IPO','p-select'); if(document.getElementById('p-select'))return;
    var p=document.createElement('div');p.className='panel';p.id='p-select';
    p.innerHTML='<div class="panel-title">How to Select Better IPO <button class="close-x" onclick="cl(\'p-select\',\'b-select\')">Close</button></div><div class="news-list"><div class="news-item" style="border-left-color:var(--gn)"><b style="color:var(--gn);font-size:13px">IPO Selection Checklist</b><ul style="margin:6px 0 0 16px;font-size:11px;line-height:1.8"><li>Valuation: compare P/E with listed peers and growth.</li><li>Financial growth: check revenue and profit trends.</li><li>Profitability: review ROE, ROCE, EBITDA margins and cash flow.</li><li>Debt: prefer manageable debt/equity unless leverage is justified.</li><li>Issue structure: distinguish fresh issue from OFS.</li><li>Promoter holding: review post-issue ownership and selling.</li><li>Issue size and use of proceeds: check where the money goes.</li><li>Risks: read DRHP/RHP risk factors and related-party disclosures.</li><li>Subscription: use as a demand signal, not proof of value.</li><li>GMP: unofficial grey-market indicator only; never use it alone.</li></ul></div><div class="news-item" style="border-left-color:var(--bl)"><b style="color:var(--bl);font-size:13px">Overall IPO Score</b><div style="font-size:11px;margin-top:5px">Use the terminal score together with valuation, fundamentals, issue structure and risk.</div><div style="margin-top:8px"><a href="'+VIDEO+'" target="_blank" rel="noopener" class="dl-btn">Watch YouTube Analysis →</a></div></div></div>';
    document.body.appendChild(p);
  }
  function filters(){
    var box=document.querySelector('#p-upc .panel-title');if(!box||document.getElementById('upc-filters'))return;
    var wrap=document.createElement('div');wrap.id='upc-filters';wrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;margin-right:8px';
    ['all','week','month'].forEach(function(mode){var b=document.createElement('button');b.className='hb';b.style.padding='4px 8px';b.textContent=mode==='all'?'All':mode==='week'?'This Week':'This Month';b.dataset.mode=mode;b.onclick=function(){setFilter(mode)};wrap.appendChild(b);});
    box.insertBefore(wrap,box.querySelector('.close-x'));setFilter(localStorage.getItem('ipoUpcomingFilter')||'all');
    document.querySelectorAll('#p-upc input[type=date],#p-upc input[type=datetime-local]').forEach(function(x){x.remove();});
  }
  function setFilter(mode){
    localStorage.setItem('ipoUpcomingFilter',mode);document.querySelectorAll('#upc-filters .hb').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
    var c=document.getElementById('upc-container');if(!c||typeof ALL_IPOS==='undefined'||typeof renderTable!=='function'||typeof categorize!=='function')return;
    var list=ALL_IPOS.filter(function(i){return categorize(i)==='upcoming';});
    if(mode!=='all'){var now=new Date();now.setHours(0,0,0,0);var end=new Date(now);end.setDate(end.getDate()+(mode==='week'?7:31));list=list.filter(function(i){var d=typeof parseDate==='function'?parseDate(i.open):null;return d&&d>=now&&d<end;});}
    renderTable('upc-container',list,false,true);
  }
  function dataObj(){return window.IPO_DATA||window.IPO_DATA_CACHE||null;}
  function renderPipeline(){
    var c=document.getElementById('pipe-container');if(!c)return;var data=dataObj();var docs=data&&Array.isArray(data.documents)?data.documents:[];
    var rows=docs.filter(function(d){return /DRHP/i.test(String(d.type||''));});
    if(!rows.length&&typeof ALL_IPOS!=='undefined')rows=ALL_IPOS.filter(function(i){return /future/i.test(String(i.status||''));}).map(function(i){return{name:i.name,type:'DRHP / Pipeline',date:i.open||'—',url:i.source_url||'#',source:i.source||'NSE'};});
    if(!rows.length){c.innerHTML='<div class="news-list"><div class="news-item"><b>No DRHP records available right now.</b><div style="font-size:10px;color:var(--tx3);margin-top:4px">The automatic DRHP feed is currently unavailable; the section will populate when source data is available.</div></div></div>';return;}
    c.innerHTML='<div style="overflow:auto"><table class="ipo-table"><thead><tr><th>Company</th><th>Type</th><th>Date</th><th>Source</th><th>Document</th></tr></thead><tbody>'+rows.map(function(d){return '<tr><td><b>'+esc(d.name||'—')+'</b></td><td><span class="badge fut">'+esc(d.type||'DRHP')+'</span></td><td>'+esc(d.date||'—')+'</td><td>'+esc(d.source||'SEBI')+'</td><td><a class="dl-btn" target="_blank" rel="noopener" href="'+escAttr(d.url||'#')+'">Open</a></td></tr>';}).join('')+'</tbody></table></div>';
  }
  function renderComparison(){
    var c=document.getElementById('comp-container');if(!c||typeof ALL_IPOS==='undefined')return;
    var list=ALL_IPOS.slice();if(!list.length){c.innerHTML='<div class="news-list"><div class="news-item">No IPO fundamental records available yet.</div></div>';return;}
    var cols=[['Company','name'],['Type','type'],['Price','price'],['Issue Size','size'],['Open','open'],['Close','close'],['P/E','pe'],['ROE','roe'],['ROCE','roce'],['Revenue','rev'],['PAT','pat'],['Debt/Equity','de'],['Promoter','prom']];
    c.innerHTML='<div style="overflow:auto"><table class="ipo-table"><thead><tr>'+cols.map(function(x){return '<th>'+x[0]+'</th>';}).join('')+'</tr></thead><tbody>'+list.map(function(i){return '<tr>'+cols.map(function(x){return '<td>'+esc(i[x[1]]==null||i[x[1]]===''?'—':i[x[1]])+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div><div style="padding:8px 10px;font-size:10px;color:var(--tx3)">Latest values available in the automatic IPO feed. “—” means that source has not supplied that field yet.</div>';
  }
  function esc(v){return String(v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}function escAttr(v){return esc(v);}
  function brokers(){var p=document.getElementById('p-brk');if(!p)return;var table=p.querySelector('.ipo-table');if(!table)return;var tbody=table.querySelector('tbody');if(!tbody)return;var names=['Zerodha (Kite)','Groww','Upstox','Angel One','5paisa','Dhan','ICICI Direct','HDFC Securities','Kotak Securities','Motilal Oswal','Axis Direct','Paytm Money','Sharekhan','IIFL Securities','Fyers'];var existing=Array.from(tbody.querySelectorAll('tr')).map(function(r){return r.textContent;});names.forEach(function(n){if(existing.some(function(x){return x.indexOf(n)>=0;}))return;var tr=document.createElement('tr');tr.innerHTML='<td><b>'+n+'</b></td><td>Check current tariff</td><td>Check current tariff</td><td class="gn">IPO application available*</td><td>Varies by platform/issue</td><td>—</td><td>—</td><td style="font-size:10px">Broker IPO flow or eligible ASBA bank</td><td style="font-size:10px">Confirm availability before applying</td>';tbody.appendChild(tr);});if(!p.querySelector('.broker-note')){var f=document.createElement('div');f.className='broker-note';f.style.cssText='padding:10px;font-size:10px;color:var(--tx3)';f.innerHTML='<b style="color:var(--yl)">*Important:</b> Major Indian platforms are shown; availability can vary by issue and investor type.';p.appendChild(f);}}
  function init(){holiday();addSelector();filters();brokers();renderPipeline();renderComparison();setTimeout(function(){filters();brokers();renderPipeline();renderComparison();},1000);setTimeout(function(){filters();brokers();renderPipeline();renderComparison();},3000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
