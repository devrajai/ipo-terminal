/* IPO Terminal UI enhancements - requested customer features */
(function(){
  'use strict';
  var VIDEO='https://youtu.be/W4VmJ8UaUjE?si=coCXusbuLIifWw0o';
  var HOLIDAY='Upcoming Holiday - Ganesh Chaturthi <span style="font-weight:600">14 September 2026</span>';

  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function escAttr(v){return esc(v);}

  function holiday(){
    var hdr=document.querySelector('.hdr'); if(!hdr||document.getElementById('ipo-holiday-line'))return;
    var d=document.createElement('div'); d.id='ipo-holiday-line';
    d.style.cssText='margin-top:8px;padding:8px 10px;border:1px solid var(--or);border-radius:8px;background:rgba(249,115,22,.10);color:var(--or);font-size:12px;font-weight:700';
    d.innerHTML=HOLIDAY; hdr.appendChild(d);
  }

  function addButton(id,label,panel){
    var box=document.querySelector('.hbtns'); if(!box||document.getElementById(id))return;
    var b=document.createElement('button'); b.className='hb'; b.id=id; b.textContent=label;
    b.onclick=function(){tg(panel,b)}; box.appendChild(b);
  }

  function addSelector(){
    addButton('b-select','How to Select Better IPO','p-select');
    if(document.getElementById('p-select'))return;
    var p=document.createElement('div'); p.className='panel'; p.id='p-select';
    p.innerHTML='<div class="panel-title">How to Select Better IPO <button class="close-x" onclick="cl(\'p-select\',\'b-select\')">Close</button></div>'+
      '<div class="news-list">'+
      '<div class="news-item" style="border-left-color:var(--gn)"><b style="color:var(--gn);font-size:13px">IPO Selection Checklist</b><ul style="margin:6px 0 0 16px;font-size:11px;line-height:1.8">'+
      '<li><b>Valuation:</b> compare P/E and other valuation measures with listed peers.</li>'+
      '<li><b>Growth:</b> check multi-year revenue and profit growth, not one exceptional year.</li>'+
      '<li><b>Profitability:</b> review ROE, ROCE, margins and operating cash flow.</li>'+
      '<li><b>Debt:</b> check debt/equity and why the company is using IPO proceeds.</li>'+
      '<li><b>Fresh issue vs OFS:</b> fresh money goes to the company; OFS is a shareholder sale.</li>'+
      '<li><b>Promoters:</b> review post-issue holding, selling and related-party transactions.</li>'+
      '<li><b>Issue size:</b> understand use of proceeds and dilution.</li>'+
      '<li><b>Risk:</b> read the DRHP/RHP risk factors before applying.</li>'+
      '<li><b>Subscription:</b> useful as a demand signal, not proof of value.</li>'+
      '<li><b>GMP:</b> unofficial grey-market indicator only; never use it alone.</li>'+
      '</ul></div>'+
      '<div class="news-item" style="border-left-color:var(--bl)"><b style="color:var(--bl);font-size:13px">Overall IPO Score</b><div style="font-size:11px;margin-top:5px">Use the terminal score together with valuation, fundamentals, issue structure, subscription and risk. A high score is a research aid, not a guarantee of returns.</div>'+
      '<div style="margin-top:8px"><iframe src="https://www.youtube.com/embed/W4VmJ8UaUjE" title="How to Select Better IPO" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" allowfullscreen></iframe></div>'+
      '<div style="margin-top:7px"><a href="'+VIDEO+'" target="_blank" rel="noopener" class="dl-btn">Open YouTube Video →</a></div></div></div>';
    document.body.appendChild(p);
  }

  function removeDateInputs(){
    document.querySelectorAll('#p-upc input[type=date],#p-upc input[type=datetime-local],#p-upc input[type=text]').forEach(function(x){
      var parent=x.parentElement; x.remove(); if(parent&&parent.children.length===0)parent.remove();
    });
  }

  function filterControls(){
    var title=document.querySelector('#p-upc .panel-title'); if(!title)return;
    var old=document.getElementById('upc-filters');
    if(old)old.remove();
    var wrap=document.createElement('div'); wrap.id='upc-filters';
    wrap.style.cssText='display:flex;gap:5px;flex-wrap:wrap;margin-left:auto;margin-right:8px;align-items:center';
    [['all','All'],['week','This Week'],['month','This Month']].forEach(function(x){
      var b=document.createElement('button'); b.className='hb'; b.style.padding='4px 8px'; b.textContent=x[1]; b.dataset.mode=x[0];
      b.onclick=function(){setFilter(x[0]);}; wrap.appendChild(b);
    });
    title.insertBefore(wrap,title.querySelector('.close-x'));
    removeDateInputs();
    setFilter(sessionStorage.getItem('ipoUpcomingFilter')||localStorage.getItem('ipoUpcomingFilter')||'month');
  }

  function setFilter(mode){
    sessionStorage.setItem('ipoUpcomingFilter',mode); localStorage.setItem('ipoUpcomingFilter',mode);
    document.querySelectorAll('#upc-filters .hb').forEach(function(b){b.classList.toggle('active',b.dataset.mode===mode);});
    var c=document.getElementById('upc-container');
    if(!c||typeof ALL_IPOS==='undefined'||typeof renderTable!=='function'||typeof categorize!=='function')return;
    var list=ALL_IPOS.filter(function(i){return categorize(i)==='upcoming';});
    if(mode!=='all'){
      var now=new Date(); now.setHours(0,0,0,0); var end=new Date(now);
      end.setDate(end.getDate()+(mode==='week'?7:31));
      list=list.filter(function(i){var d=typeof parseDate==='function'?parseDate(i.open):null;return d&&d>=now&&d<end;});
    }
    renderTable('upc-container',list,false,true);
    // Add a clear board switch directly above the table.
    var existing=document.getElementById('upc-board-filters'); if(existing)existing.remove();
    var board=document.createElement('div'); board.id='upc-board-filters'; board.style.cssText='display:flex;gap:5px;flex-wrap:wrap;padding:0 8px 8px';
    [['all','All Boards'],['Mainboard','Mainboard'],['SME','SME']].forEach(function(x){
      var b=document.createElement('button'); b.className='hb'; b.style.padding='4px 9px'; b.textContent=x[1];
      b.onclick=function(){
        var filtered=list.filter(function(i){return x[0]==='all'||String(i.type||'').toLowerCase()===x[0].toLowerCase();});
        renderTable('upc-container',filtered,false,true); board.querySelectorAll('.hb').forEach(function(z){z.classList.remove('active');}); b.classList.add('active');
      }; board.appendChild(b); if(x[0]==='all')b.classList.add('active');
    });
    c.parentElement.insertBefore(board,c);
  }

  function dividend(){
    var p=document.getElementById('p-div'); if(!p)return;
    var body=p.querySelector('.news-list')||p.querySelector('[id]')||p;
    if(document.getElementById('dividend-definitions'))return;
    var box=document.createElement('div'); box.id='dividend-definitions'; box.style.cssText='padding:8px';
    box.innerHTML='<div class="news-item" style="border-left-color:var(--bl)"><b>Ex-Date</b><div style="font-size:11px;color:var(--tx3);margin-top:4px">The date from which a buyer generally will not receive the declared dividend.</div></div><div class="news-item" style="border-left-color:var(--pp)"><b>Record Date</b><div style="font-size:11px;color:var(--tx3);margin-top:4px">The date the company uses to determine which shareholders are eligible for the dividend.</div></div>';
    p.insertBefore(box,p.children[1]||null);
  }

  function brokers(){
    var p=document.getElementById('p-brk'); if(!p)return;
    var table=p.querySelector('.ipo-table'); if(!table)return;
    var tbody=table.querySelector('tbody'); if(!tbody)return;
    var names=['Zerodha','Groww','Upstox','Angel One','5paisa','Dhan','ICICI Direct','HDFC Securities','Kotak Securities','Motilal Oswal','Axis Direct','Paytm Money','Sharekhan','IIFL Securities','Fyers'];
    names.forEach(function(n){
      var found=Array.from(tbody.querySelectorAll('tr')).some(function(r){return r.textContent.toLowerCase().indexOf(n.toLowerCase())>=0;});
      if(found)return;
      var tr=document.createElement('tr'); tr.innerHTML='<td><b>'+esc(n)+'</b></td><td>IPO application</td><td>UPI / ASBA where offered</td><td class="gn">Check current issue availability</td>'; tbody.appendChild(tr);
    });
    if(!p.querySelector('.broker-note')){var f=document.createElement('div');f.className='broker-note';f.style.cssText='padding:10px;font-size:10px;color:var(--tx3)';f.innerHTML='<b style="color:var(--yl)">Note:</b> This is a practical list of major Indian platforms. IPO availability and application method can vary by issue, account type and bank; confirm before applying.';p.appendChild(f);}
  }

  function init(){
    holiday(); addSelector(); filterControls(); dividend(); brokers();
    setTimeout(function(){filterControls();dividend();brokers();},1000);
    setTimeout(function(){filterControls();dividend();brokers();},3000);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
