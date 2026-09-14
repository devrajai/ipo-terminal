/* IPO Terminal: public prospectus fundamentals + comparable listed stocks. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function good(v){return v!==undefined&&v!==null&&v!==''&&v!=='—'&&v!=='-';}
function metric(v){return good(v)?esc(v):'<span class="tx3">—</span>';}
function render(data){
  var box=document.getElementById('ipo-fundamentals-panel'); if(!box)return;
  var list=(data.ipos||[]).filter(function(i){return i&&i.name;});
  var h='<div class="panel-title">IPO Fundamentals + Public Prospectus Evidence <button class="close-x" id="ipf-close">Close</button></div>';
  h+='<div class="ipf-note">Numbers are taken from public prospectus-derived research where available. No missing number is guessed. P/E, ROE/RONW, ROCE, EBITDA margin and D/E are shown with the latest available prospectus period.</div>';
  h+='<div class="ipf-scroll"><table class="ipo-table"><thead><tr><th>IPO</th><th>Revenue</th><th>PAT</th><th>PAT Margin</th><th>P/E</th><th>ROE/RONW</th><th>ROCE</th><th>EBITDA</th><th>D/E</th><th>Growth</th><th>GMP</th><th>GMP%</th></tr></thead><tbody>';
  list.forEach(function(i){h+='<tr><td><b>'+esc(i.name)+'</b><br><span class="tx3">'+esc(i.fundamentals_source||'source not yet matched')+'</span></td><td>'+metric(i.rev)+'</td><td>'+metric(i.pat)+'</td><td>'+metric(i.pat_margin)+'</td><td>'+metric(i.pe)+'</td><td>'+metric(i.ronw||i.roe)+'</td><td>'+metric(i.roce)+'</td><td>'+metric(i.ebitda)+'</td><td>'+metric(i.de)+'</td><td>'+metric(i.growth)+'</td><td>'+metric(i.gmp)+'</td><td>'+metric(i.gmp_pct)+'</td></tr>';});
  h+='</tbody></table></div>';
  h+='<div class="ipf-docs"><b>Public RHP / DRHP / Prospectus</b><div class="ipf-grid">';
  list.forEach(function(i){
    if(!(i.rhp_url||i.drhp_url||i.prospectus_url||i.fundamentals_source_url))return;
    h+='<div class="ipf-card"><b>'+esc(i.name)+'</b><div class="ipf-links">';
    if(i.rhp_url)h+='<a class="dl-btn" target="_blank" rel="noopener" href="'+esc(i.rhp_url)+'">RHP</a>';
    if(i.drhp_url)h+='<a class="dl-btn" target="_blank" rel="noopener" href="'+esc(i.drhp_url)+'">DRHP</a>';
    if(i.prospectus_url)h+='<a class="dl-btn" target="_blank" rel="noopener" href="'+esc(i.prospectus_url)+'">Prospectus</a>';
    if(i.fundamentals_source_url)h+='<a class="news-link" target="_blank" rel="noopener" href="'+esc(i.fundamentals_source_url)+'">Source page</a>';
    h+='</div></div>';
  });
  h+='</div></div>';
  h+='<div class="ipf-docs"><b>Comparable listed stocks</b><div class="ipf-scroll"><table class="ipo-table"><thead><tr><th>IPO</th><th>Comparable</th><th>P/E</th><th>ROE/RONW</th><th>ROCE</th><th>EBITDA</th><th>D/E</th></tr></thead><tbody>';
  list.forEach(function(i){(i.comparable_stocks||[]).forEach(function(p){h+='<tr><td>'+esc(i.name)+'</td><td><b>'+esc(p.name)+'</b></td><td>'+metric(p.pe)+'</td><td>'+metric(p.roe||p.ronw)+'</td><td>'+metric(p.roce)+'</td><td>'+metric(p.ebitda)+'</td><td>'+metric(p.de)+'</td></tr>';});});
  h+='</tbody></table></div></div>';
  box.innerHTML=h; box.classList.add('show'); var b=document.getElementById('ipf-btn');if(b)b.classList.add('active');
  document.getElementById('ipf-close').onclick=function(){box.classList.remove('show');if(b)b.classList.remove('active');};
}
function init(){
  if(document.getElementById('ipf-btn'))return;
  var nav=document.querySelector('.hbtns');if(!nav)return;
  var b=document.createElement('button');b.className='hb';b.id='ipf-btn';b.textContent='IPO Fundamentals';
  b.onclick=function(){fetch('data/ipo-data.json?ts='+Date.now(),{cache:'no-store'}).then(function(r){return r.json();}).then(render).catch(function(){})};nav.appendChild(b);
  var p=document.createElement('div');p.className='panel';p.id='ipo-fundamentals-panel';document.body.appendChild(p);
  var s=document.createElement('style');s.textContent='.ipf-note{padding:8px 10px;font-size:10px;color:var(--tx3);border-bottom:1px solid var(--bd)}.ipf-scroll{overflow-x:auto}.ipf-docs{padding:10px;border-top:1px solid var(--bd)}.ipf-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:8px}.ipf-card{background:var(--card2);border:1px solid var(--bd);border-radius:8px;padding:9px}.ipf-links{display:flex;gap:5px;flex-wrap:wrap;margin-top:6px}.ipf-links .dl-btn{font-size:9px}@media(max-width:700px){.ipf-grid{grid-template-columns:1fr}.ipf-note{font-size:9px}.ipo-table{font-size:10px}.ipo-table th,.ipo-table td{padding:5px 4px}}';document.head.appendChild(s);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,250);});else setTimeout(init,250);
})();
