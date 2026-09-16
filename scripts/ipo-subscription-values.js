/* IPO Terminal - QIB/HNI/Retail subscription + rupee value display */
(function(){
  'use strict';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  var EMPTY=['',null,'—','-','NA','N/A'];
  function num(v){
    if(v==null)return null;
    var s=String(v).replace(/,/g,'').replace(/₹/g,'').trim();
    var m=s.match(/-?[0-9]+(?:\.[0-9]+)?/);
    return m?parseFloat(m[0]):null;
  }
  function cr(v){
    if(v==null)return null;
    var s=String(v).replace(/,/g,'').toLowerCase();
    var n=num(s); if(n==null)return null;
    if(/lakh|lac/.test(s))return n/100;
    if(/million|mn/.test(s))return n/10;
    return n;
  }
  function valueFromReported(v){
    if(EMPTY.indexOf(v)>=0||EMPTY.indexOf(String(v))>=0)return null;
    return cr(v);
  }
  function sizeCr(i){return valueFromReported(i.size);}
  function approxValue(i,multiple,allocation){
    var size=sizeCr(i), sub=num(multiple);
    if(size==null||sub==null||sub<=0)return null;
    return size*sub*allocation;
  }
  function money(v,approx){
    if(v==null)return '—';
    var n=Math.round(v*10)/10;
    return (approx?'~':'')+'₹'+(n%1?n.toFixed(1):n.toFixed(0))+' Cr';
  }
  function metric(i,key,reportedKey,allocation){
    var reported=valueFromReported(i[reportedKey]);
    if(reported!=null)return money(reported,false);
    return money(approxValue(i,i[key],allocation),true);
  }
  function summary(i){
    var q=String(i.sub_qib||'—'), h=String(i.sub_hni||i.sub_nii||'—'), r=String(i.sub_retail||'—');
    return '<div style="font-size:9px;line-height:1.55;white-space:nowrap">'
      +'<b>QIB</b> '+esc(q)+' <span class="tx3">'+esc(metric(i,'sub_qib','sub_qib_value',.50))+'</span><br>'
      +'<b>HNI</b> '+esc(h)+' <span class="tx3">'+esc(metric(i,'sub_hni','sub_hni_value',.15))+'</span><br>'
      +'<b>Retail</b> '+esc(r)+' <span class="tx3">'+esc(metric(i,'sub_retail','sub_retail_value',.35))+'</span>'
      +'</div>';
  }
  function apply(){
    if(typeof window.renderTable!=='function'||window.__subscriptionValuesWrapped)return;
    var original=window.renderTable;
    window.__subscriptionValuesWrapped=true;
    window.renderTable=function(containerId,ipos,showSub,showScore){
      /* Subscription breakdown is shown only for Open/Live IPOs. */
      original(containerId,ipos,showSub,showScore);
      if(containerId!=='open-container')return;
      var c=document.getElementById(containerId),table=c&&c.querySelector('table');
      if(!table||!ipos||!ipos.length)return;
      var head=table.querySelector('thead tr');
      if(!head)return;
      var th=document.createElement('th'); th.innerHTML='Subscription<br><span class="tx3" style="font-size:8px">QIB / HNI / Retail · ₹ value</span>'; head.appendChild(th);
      var rows=table.querySelectorAll('tbody tr');
      rows.forEach(function(row,idx){
        var td=document.createElement('td');
        td.innerHTML=summary(ipos[idx]||{});
        row.appendChild(td);
      });
    };
    if(typeof window.renderAll==='function')window.renderAll();
  }
  function init(){setTimeout(apply,80);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
