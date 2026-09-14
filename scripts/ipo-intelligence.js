/* IPO Terminal: one compact intelligence panel for subscription, lot size, listing and source health. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function good(v){return v!==undefined&&v!==null&&v!==''&&v!=='—'&&v!=='-';}
function row(i){
  var total=good(i.sub)?i.sub:'—', q=good(i.sub_qib)?i.sub_qib:'—', n=good(i.sub_nii)?i.sub_nii:'—', r=good(i.sub_retail)?i.sub_retail:'—';
  var gm=good(i.gmp)?i.gmp:'—', est=good(i.est_list)?i.est_list:'—';
  return '<tr><td><b>'+esc(i.name)+'</b><br><span class="tx3" style="font-size:8px">'+esc(i.status||'')+'</span></td><td>'+esc(i.type||'—')+'</td><td>'+esc(i.price||'—')+'</td><td>'+esc(i.lot||'—')+'</td><td>'+esc(i.min_investment||'—')+'</td><td>'+esc(q)+'</td><td>'+esc(n)+'</td><td>'+esc(r)+'</td><td><b>'+esc(total)+'</b></td><td class="gn"><b>'+esc(gm)+'</b>'+(i.gmp_source?'<br><span class="tx3" style="font-size:8px">'+esc(i.gmp_source)+'</span>':'')+'</td><td class="gn">'+esc(est)+'</td><td>'+esc(i.listing||'—')+'</td></tr>';
}
function sourceHealth(){
  var s=window.__IPO_DATA__&&window.__IPO_DATA__.sources?window.__IPO_DATA__.sources:{};
  var parts=[];
  Object.keys(s).forEach(function(k){var v=s[k]||{};var ok=v.ok===true?'OK':(v.ok===false?'CHECK':'—');var cls=v.ok===true?'gn':(v.ok===false?'rd':'tx3');var rec=v.records!=null?' · '+v.records+' records':'';parts.push('<span class="'+cls+'" style="font-size:9px"><b>'+esc(k)+'</b>: '+ok+esc(rec)+'</span>');});
  return parts.join(' &nbsp; | &nbsp; ');
}
function render(){
  var p=document.getElementById('ipo-intelligence-panel');if(!p||typeof ALL_IPOS==='undefined')return;
  var list=ALL_IPOS.filter(function(i){return i&&i.name;}).sort(function(a,b){return String(a.type||'').localeCompare(String(b.type||''))||String(a.name).localeCompare(String(b.name));});
  var h='<div class="panel-title">IPO Intelligence <button class="close-x" id="ipi-close">Close</button></div><div style="padding:8px 10px;font-size:10px;color:var(--tx3)"><b style="color:var(--bl)">What is new:</b> category-wise subscription, lot size, minimum investment, listing date, live GMP, estimated listing and automatic source-health checks. Values are shown only when a source provides them.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>IPO</th><th>Type</th><th>Price</th><th>Lot</th><th>Min Invest.</th><th>QIB</th><th>NII</th><th>Retail</th><th>Total Sub.</th><th>GMP</th><th>Est. List</th><th>Listing</th></tr></thead><tbody>';
  list.forEach(function(i){h+=row(i);});
  h+='</tbody></table></div><div style="padding:8px 10px;border-top:1px solid var(--bd);font-size:9px;color:var(--tx3)"><b>Source health:</b> '+sourceHealth()+'<br><span>Official exchange/regulatory data is preferred. Aggregator data is a fallback and is not copied as article content. GMP is unofficial.</span></div>';
  p.innerHTML=h;p.classList.add('show');document.getElementById('ipi-btn').classList.add('active');
  document.getElementById('ipi-close').onclick=function(){p.classList.remove('show');document.getElementById('ipi-btn').classList.remove('active');};
}
function refreshSourceHealth(){
  if(window.__IPO_DATA__)return;
  fetch('data/ipo-data.json?ts='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(d){window.__IPO_DATA__=d;if(document.getElementById('ipo-intelligence-panel').classList.contains('show'))render();}}).catch(function(){});
}
function init(){
  if(document.getElementById('ipi-btn'))return;
  var box=document.querySelector('.hbtns');if(!box)return;
  var b=document.createElement('button');b.className='hb';b.id='ipi-btn';b.textContent='IPO Intelligence';b.onclick=function(){refreshSourceHealth();render();};box.appendChild(b);
  var p=document.createElement('div');p.className='panel';p.id='ipo-intelligence-panel';document.body.appendChild(p);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,150);});else setTimeout(init,150);
})();
