/* IPO Terminal Shell: compact command-center header and automatic data heartbeat. */
(function(){
'use strict';
function e(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function init(){
 var hdr=document.querySelector('.hdr');if(!hdr||document.getElementById('terminal-pulse-strip'))return;
 var title=hdr.querySelector('h1');if(title){title.textContent='IPO TERMINAL';title.setAttribute('title','Understand the IPO, not just the IPO');}
 var sub=document.createElement('div');sub.id='terminal-pulse-strip';sub.style.cssText='margin-top:9px;display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:6px';sub.innerHTML='<div class="pulse-card"><small>DATA ENGINE</small><b id="pulse-data">SYNCING</b></div><div class="pulse-card"><small>FIELD COVERAGE</small><b id="pulse-coverage">—</b></div><div class="pulse-card"><small>NEXT EVENTS</small><b id="pulse-events">—</b></div><div class="pulse-card"><small>SOURCE HEALTH</small><b id="pulse-health">—</b></div>';
 hdr.insertBefore(sub,hdr.querySelector('.hbtns'));
 var st=document.createElement('style');st.textContent='.pulse-card{padding:7px 8px;border:1px solid var(--bd);border-radius:8px;background:linear-gradient(135deg,var(--card2),var(--card));min-width:0}.pulse-card small{display:block;color:var(--tx3);font-size:7px;letter-spacing:.7px;font-weight:800}.pulse-card b{display:block;font-size:11px;margin-top:2px;color:var(--tx)}@media(max-width:700px){#terminal-pulse-strip{grid-template-columns:repeat(2,minmax(120px,1fr))!important}}';document.head.appendChild(st);
 fetch('data/terminal-state.json?ts='+Date.now(),{cache:'no-store'}).then(function(r){return r.ok?r.json():null;}).then(function(d){if(!d)return;var src=d.sources||{},vals=Object.keys(src).map(function(k){return src[k];});var good=vals.filter(function(v){return v&&v.ok===true;}).length, total=vals.length;document.getElementById('pulse-data').textContent='AUTO · '+(d.ipo_count||0)+' IPOs';document.getElementById('pulse-coverage').textContent=(d.field_coverage_pct==null?'—':d.field_coverage_pct+'%');document.getElementById('pulse-events').textContent=(d.events||[]).length+' upcoming';document.getElementById('pulse-health').textContent=(total?good+'/'+total:'—')+' sources OK';}).catch(function(){document.getElementById('pulse-data').textContent='FALLBACK';});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,300);});else setTimeout(init,300);
})();
