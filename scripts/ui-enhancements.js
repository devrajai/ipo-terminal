/* IPO Terminal UI enhancements */
(function(){
  'use strict';
  var VIDEO='https://youtu.be/W4VmJ8UaUjE?si=coCXusbuLIifWw0o';
  function add(el,html){if(el)el.insertAdjacentHTML('beforeend',html);}
  function holiday(){
    var hdr=document.querySelector('.hdr'); if(!hdr||document.getElementById('ipo-holiday-line'))return;
    var d=document.createElement('div'); d.id='ipo-holiday-line';
    d.style.cssText='margin-top:8px;padding:8px 10px;border:1px solid var(--or);border-radius:8px;background:rgba(249,115,22,.10);color:var(--or);font-size:12px;font-weight:700';
    d.innerHTML='Upcoming Holiday - Ganesh Chaturthi <span style="font-weight:600">14 September 2026</span>';
    hdr.appendChild(d);
  }
  function addButton(id,label,panel){
    if(document.getElementById(id))return;
    var box=document.querySelector('.hbtns'); if(!box)return;
    var b=document.createElement('button'); b.className='hb'; b.id=id; b.textContent=label;
    b.onclick=function(){tg(panel,b)}; box.appendChild(b);
  }
  function addDividend(){
    addButton('b-div','Dividend Stocks','p-div');
    if(document.getElementById('p-div'))return;
    var p=document.createElement('div'); p.className='panel'; p.id='p-div';
    p.innerHTML='<div class="panel-title">Dividend Stocks <button class="close-x" onclick="cl(\'p-div\',\'b-div\')">Close</button></div><div class="news-list"><div class="news-item" style="border-left-color:var(--bl)"><b style="color:var(--bl)">Ex-Date</b><div style="font-size:11px;margin-top:4px">The date from which a buyer generally will not receive the declared dividend.</div></div><div class="news-item" style="border-left-color:var(--gn)"><b style="color:var(--gn)">Record Date</b><div style="font-size:11px;margin-top:4px">The date the company uses to determine which shareholders are eligible for the dividend.</div></div><div id="dividend-data"><div class="news-item" style="border-left-color:var(--yl)"><b style="color:var(--yl)">Live dividend data</b><div style="font-size:11px;margin-top:4px">Dividend records will appear here when the automatic dividend feed is available.</div></div></div></div>';
    document.body.appendChild(p);
  }
  function addSelector(){
    addButton('b-select','How to Select Better IPO','p-select');
    if(document.getElementById('p-select'))return;
    var p=document.createElement('div'); p.className='panel'; p.id='p-select';
    p.innerHTML='<div class="panel-title">How to Select Better IPO <button class="close-x" onclick="cl(\'p-select\',\'b-select\')">Close</button></div><div class="news-list"><div class="news-item" style="border-left-color:var(--gn)"><b style="color:var(--gn);font-size:13px">IPO Selection Checklist</b><ul style="margin:6px 0 0 16px;font-size:11px;line-height:1.8"><li>Valuation: compare P/E with listed peers and growth.</li><li>Financial growth: check revenue and profit trends.</li><li>Profitability: review ROE, ROCE, EBITDA margins and cash flow.</li><li>Debt: prefer manageable debt/equity unless leverage is justified.</li><li>Issue structure: distinguish fresh issue from OFS.</li><li>Promoter holding: review post-issue ownership and selling.</li><li>Issue size and use of proceeds: check where the money goes.</li><li>Risks: read DRHP/RHP risk factors and related-party disclosures.</li><li>Subscription: use as a demand signal, not proof of value.</li><li>GMP: unofficial grey-market indicator only; never use it alone.</li></ul></div><div class="news-item" style="border-left-color:var(--bl)"><b style="color:var(--bl);font-size:13px">Overall IPO Score</b><div style="font-size:11px;margin-top:5px">Use the terminal score together with valuation, fundamentals, issue structure and risk. A high subscription or GMP does not automatically make an IPO a good investment.</div><div style="margin-top:8px"><a href="'+VIDEO+'" target="_blank" rel="noopener" class="dl-btn">Watch YouTube Analysis →</a></div><div style="font-size:10px;color:var(--tx3);margin-top:8px">Video focus: practical IPO selection, fundamentals, valuation and risk checks. Treat the video as educational content and verify current IPO data separately.</div></div></div>';
    document.body.appendChild(p);
  }
  function filters(){
    var box=document.querySelector('#p-upc .panel-title'); if(!box||document.getElementById('upc-filters'))return;
    var wrap=document.createElement('div'); wrap.id='upc-filters'; wrap.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;margin-right:8px';
    ['all','week','month'].forEach(function(mode){var b=document.createElement('button');b.className='hb';b.style.padding='4px 8px';b.textContent=mode==='all'?'All':mode==='week'?'This Week':'This Month';b.dataset.mode=mode;b.onclick=function(){setFilter(mode)};wrap.appendChild(b);});
    box.insertBefore(wrap,box.querySelector('.close-x'));
    var saved=localStorage.getItem('ipoUpcomingFilter')||'all'; setFilter(saved);
    document.querySelectorAll('#p-upc input[type=date],#p-upc input[type=datetime-local]').forEach(function(x){x.remove();});
  }
  function setFilter(mode){
    localStorage.setItem('ipoUpcomingFilter',mode);
    document.querySelectorAll('#upc-filters .hb').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
    var c=document.getElementById('upc-container'); if(!c||typeof ALL_IPOS==='undefined'||typeof renderTable!=='function')return;
    var list=ALL_IPOS.filter(function(i){return categorize(i)==='upcoming';});
    if(mode!=='all'){
      var now=new Date(); now.setHours(0,0,0,0); var end=new Date(now); end.setDate(end.getDate()+(mode==='week'?7:31));
      list=list.filter(function(i){var d=parseDate(i.open);return d&&d>=now&&d<end;});
    }
    renderTable('upc-container',list,false,true);
  }
  function brokers(){
    var p=document.getElementById('p-brk'); if(!p)return;
    var note=p.querySelector('.ipo-table'); if(!note)return;
    var tbody=note.querySelector('tbody'); if(!tbody)return;
    var names=['Zerodha (Kite)','Groww','Upstox','Angel One','5paisa','Dhan','ICICI Direct','HDFC Securities','Kotak Securities','Motilal Oswal','Axis Direct','Paytm Money','Sharekhan','IIFL Securities','Fyers'];
    var existing=Array.from(tbody.querySelectorAll('tr')).map(function(r){return r.textContent;});
    names.forEach(function(n){if(existing.some(function(x){return x.indexOf(n)>=0;}))return;var tr=document.createElement('tr');tr.innerHTML='<td><b>'+n+'</b></td><td>Check current tariff</td><td>Check current tariff</td><td class="gn">IPO application available*</td><td>Varies by platform/issue</td><td>—</td><td>—</td><td style="font-size:10px">Apply through broker IPO flow or eligible ASBA bank</td><td style="font-size:10px">Availability can vary by investor type and issue</td>';tbody.appendChild(tr);});
    var f=document.createElement('div');f.style.cssText='padding:10px;font-size:10px;color:var(--tx3)';f.innerHTML='<b style="color:var(--yl)">*Important:</b> This is a practical list of major Indian platforms, not a claim that every SEBI-registered broker supports every IPO. Confirm the IPO/SME/UPI/ASBA option inside the broker before applying.';p.appendChild(f);
  }
  function init(){
    holiday(); addDividend(); addSelector(); filters(); brokers();
    setTimeout(function(){filters();brokers();},800);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
