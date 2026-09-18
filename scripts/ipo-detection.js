(()=>{if(window.__IPODET_V2)return;window.__IPODET_V2=1;
const $=s=>document.querySelector(s), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const pair=v=>{const a=String(v??'').replace(/₹|,/g,'').match(/\d+(?:\.\d+)?/g);return a&&a.length?{lo:+a[0],hi:+(a[1]||a[0])}:null};
const norm=v=>String(v??'').toLowerCase().replace(/limited|ltd|india|private|pvt|[\W_]/g,'');
const money=v=>Number.isFinite(v)?'₹'+Math.round(v).toLocaleString('en-IN'):'—';
const find=(a,n)=>{const q=norm(n);return(a||[]).find(x=>norm(x.name)===q)||(a||[]).find(x=>norm(x.name).includes(q)||q.includes(norm(x.name)))};
let data=[],mode='all',ref='',budget=0;

const videos=[
 ['Fundamental','NSE IPO — full analysis','https://youtu.be/rynGD1_t5ZY?si=DrRMFTmyhDk8o35q','User supplied'],
 ['Fundamental','SS Retail IPO review','https://youtu.be/jwGGoeI9o7g?si=QiaT-X2zdUXT7SP6','User supplied'],
 ['Fundamental','Jindal Supreme IPO review','https://youtu.be/LmuAHHttcEU?si=xRSiGGa6xhkUDKZi','User supplied'],
 ['Fundamental','Hero Motors IPO review','https://youtu.be/IM3MBqDevU0?si=Nr52pzxVyEi_Y4sY','User supplied'],
 ['Fundamental','Manika Plastech IPO review','https://youtu.be/Wsu2ucCD8t8?si=NHXLdQA8FlblMiSc','User supplied'],
 ['Fundamental','Veegaland Developers final verdict','https://youtu.be/7JFFisRByYM?si=AfrqVSNHLXKhu6f_','User supplied'],
 ['User video','IPO video — title not resolved','https://youtu.be/dniTzu91L08?si=hK4PQBK_cY4N6RV2','User supplied'],
 ['Comparison','Hero Motors vs Jindal Supreme vs SS Retail','https://youtu.be/GH12ezWhHek?si=OpXp_33efW_kqwqs','User supplied'],
 ['Comparison','Veegaland vs Manika Plastech','https://youtu.be/DxURoTDQdlc?si=PZd3DFdc67Qt2DEb9','User supplied'],
 ['Comparison','6 IPO comparison — Rentomojo/LCC/Karamtara/Steamhouse/Manipal/Asset Reconstruction','https://youtu.be/x2HwQYTz73w?si=xYJHF5R-XwgGUL-w','User supplied'],
 ['Comparison','4 IPO comparison — Pranav/Prasol/Glass Wall/Kanohar','https://youtu.be/vY49s5co8O0?si=xwbXeOrzVpZXbro0','User supplied'],
 ['Comparison','Lumino vs ESDS vs Priority Jewels','https://youtu.be/8EWvGpiW3uw?si=uUYKmKBMMn6-ul1v','User supplied'],
 ['Comparison','Hero Motors vs Jindal Supreme vs SS Retail — IPO Alert','https://www.youtube.com/watch?v=u_Mu3KeCDKY','Additional current video found on YouTube'],
 ['Fundamental','NSE IPO Review 2026 — full IPO analysis','https://www.youtube.com/watch?v=dvjE6KqVQjo','Additional current video found on YouTube']
];

function lotInfo(x){const p=pair(x.price||x.price_band),q=num(x.lot||x.lot_size);return p&&q?{price:p.hi,lo:p.lo,qty:q,cost:p.hi*q}:null}
function isSme(x){return /sme|emerge|bse sme|nse sme/i.test(String(x.board||x.type||''))}
function category(x,lots){const l=lotInfo(x);if(!l)return['Missing lot/price',''];const amount=l.cost*lots;if(isSme(x)){if(lots<2||amount<=200000)return['Not eligible as SME Individual Investor','SME requires 2+ lots and application value above ₹2L'];return lots===2?['SME Individual Investor','Exactly 2 lots']:['SME NII — Individual','More than 2 lots']}return amount<=200000?['Mainboard Retail','Application ≤ ₹2L']:amount<=1000000?['Mainboard sNII','>₹2L to ₹10L']:['Mainboard bNII','>₹10L']}
function payment(x,lots){const l=lotInfo(x);if(!l)return'Price/lot missing';const amount=l.cost*lots;if(isSme(x))return amount<=500000?'UPI if supported; verify issue instructions':'ASBA / eligible non-UPI route; verify issue instructions';return amount<=500000?'UPI route available for individual investors (subject to issue rules)':'ASBA / eligible non-UPI route'}
function score(x){
 const g=num(x.gmp_pct),sub=num(x.total),pe=num(x.pe),pb=num(x.pb),roe=num(x.roe),roce=num(x.roce),de=num(x.de),gr=num(x.growth),p=pair(x.price||x.price_band),est=num(x.est_list);
 const estPct=p&&est?(est/p.lo-1)*100:null;
 const listing=Math.max(0,Math.min(100,(g!=null?Math.max(-20,g)*1.8:0)+(sub!=null?Math.min(40,sub)*1.15:0)+(estPct!=null?Math.max(-20,Math.min(60,estPct))*.35:0)+35));
 const short=Math.max(0,Math.min(100,(g!=null?Math.max(-20,g)*1.0:0)+(sub!=null?Math.min(35,sub)*.9:0)+(roe!=null?Math.min(Math.max(roe,0),35)*.55:12)+(roce!=null?Math.min(Math.max(roce,0),40)*.35:10)+(de!=null?Math.max(0,25-de*8):10)));
 const peS=pe==null?50:pe<=15?100:pe<=25?82:pe<=35?65:pe<=50?42:20;
 const pbS=pb==null?50:pb<=2?90:pb<=4?70:pb<=7?50:25;
 const debtS=de==null?50:de<=.3?100:de<=.7?82:de<=1.2?62:de<=2?38:15;
 const long=Math.max(0,Math.min(100,(gr!=null?Math.min(Math.max(gr,0),50)*1.15:40)+(roe!=null?Math.min(Math.max(roe,0),35)*.75:22)+(roce!=null?Math.min(Math.max(roce,0),40)*.55:22)+peS*.32+pbS*.18+debtS*.28));
 const keys=['gmp_pct','total','pe','pb','roe','roce','de','growth'];const miss=keys.filter(k=>num(x[k])==null).length;
 return{listing,short,long,confidence:Math.max(30,100-miss*8)}
}
function enriched(){
 return data.filter(x=>/^(open|upcoming)$/i.test(String(x.status||''))).map(x=>({...x,s:score(x),l:lotInfo(x)})).filter(x=>x.l)
}
function rank(k){return enriched().sort((a,b)=>b.s[k]-a.s[k]||b.s.confidence-a.s.confidence)}
function createPanel(){
 let s=$('#section-decision');
 if(!s){s=document.createElement('section');s.id='section-decision';s.className='section glass';s.innerHTML='<div class="section-title"><span>🧠 IPO Decision & Application Planner</span><button class="close" data-close="decision">✕ Close</button></div><div id="ipo-decision-content" class="content"></div>';$('main')?.appendChild(s)}
 const nav=$('#nav-tools .nav');
 if(nav&&!nav.querySelector('[data-section="decision"]')){const b=document.createElement('button');b.dataset.section='decision';b.textContent='🧠 Decision';nav.appendChild(b)}
}
function rankView(rows,key){
 const title=key==='listing'?'Listing-gain signal':key==='short'?'Short-term signal':key==='long'?'Long-term fundamental signal':'All comparison';
 return '<div class="det-head"><b>'+title+'</b><span>Model signal only. It uses available GMP, subscription and fundamental fields; missing fields lower confidence.</span></div><div class="det-grid">'+rows.map((x,i)=>{const sc=key==='all'?(x.s.listing+x.s.short+x.s.long)/3:x.s[key];return '<article class="det-card"><i>#'+(i+1)+'</i><b class="det-name">'+E(x.name)+'</b><div class="det-meta">'+E(x.board||x.type||'—')+' • '+E(x.price||x.price_band||'—')+' • 1 lot '+money(x.l.cost)+'</div><div class="det-score">'+sc.toFixed(0)+'/100 <small>confidence '+x.s.confidence+'%</small></div><div class="det-mini"><span>Listing<b>'+x.s.listing.toFixed(0)+'</b></span><span>Short<b>'+x.s.short.toFixed(0)+'</b></span><span>Long<b>'+x.s.long.toFixed(0)+'</b></span></div><div class="det-meta">GMP '+E(x.gmp_pct||'—')+' • Sub '+E(x.total||'—')+' • P/E '+E(x.pe||'—')+' • P/B '+E(x.pb||'—')+' • ROE '+E(x.roe||'—')+' • ROCE '+E(x.roce||'—')+' • D/E '+E(x.de||'—')+'</div></article>'}).join('')+'</div>'
}
function applicationView(){
 const x=find(data,ref); if(!x||!lotInfo(x))return'<div class="det-empty">Select an IPO with valid price band and lot size.</div>';
 const l=lotInfo(x);
 const rows=Array.from({length:10},(_,i)=>{const n=i+1,a=l.cost*n,c=category(x,n);return '<tr><td><b>'+n+' lot'+(n>1?'s':'')+'</b></td><td>'+money(a)+'</td><td>'+E(c[0])+'</td><td>'+E(c[1])+'</td><td>'+E(payment(x,n))+'</td></tr>'}).join('');
 const multi=enriched().filter(z=>z.name!==x.name).sort((a,b)=>b.s.short-a.s.short).slice(0,12);
 const multiRows=multi.map(z=>{const max=isSme(z)?Math.floor(500000/z.l.cost):Math.floor(1000000/z.l.cost);const n=Math.max(1,Math.min(max,2));const c=category(z,n);return '<div class="det-alloc"><b>'+E(z.name)+'</b><span>'+n+' lot • '+money(n*z.l.cost)+' • '+E(c[0])+'</span></div>'}).join('');
 return '<div class="det-budget"><b>'+E(x.name)+'</b><span>1 lot = '+money(l.cost)+' ('+l.qty.toLocaleString('en-IN')+' shares at the upper price band). Use the upper band for a conservative application-money estimate.</span></div><div class="table-wrap"><table class="table det-apply-table"><thead><tr><th>Lots</th><th>Application</th><th>Category</th><th>Why</th><th>Payment route</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="det-rules"><b>Quick interpretation:</b> Mainboard 1–10 lots are allowed in lot multiples; category changes automatically when total application crosses ₹2L and ₹10L. SME issues opening on/after 1 Jul 2025 require at least 2 lots and application value above ₹2L for the Individual Investor category; exactly 2 lots is Individual Investor and more than 2 lots is NII-Individual. </div><div class="det-head"><b>Multi-IPO planning</b><span>Use this as a capital-allocation calculator, not an allotment-probability forecast.</span></div><div class="det-allocation">'+(multiRows||'<div class="det-empty">No other current IPO has enough data.</div>')+'</div>'
}
function render(){
 const el=$('#ipo-decision-content');if(!el)return;
 const opts=enriched();if(!ref&&opts[0])ref=opts[0].name;
 const tabs=[['all','All comparison'],['listing','Listing gain'],['short','Short term'],['long','Long term'],['apply','Application planner']].map(a=>'<button class="det-tab '+(mode===a[0]?'active':'')+'" data-m="'+a[0]+'">'+a[1]+'</button>').join('');
 const body=mode==='apply'?applicationView():rankView(mode==='all'?(rank('short').slice().sort((a,b)=>((b.s.listing+b.s.short+b.s.long)-(a.s.listing+a.s.short+a.s.long)))):rank(mode),mode);
 el.innerHTML='<div class="det-intro"><b>🧠 Decision engine</b><span>Compare Open + Upcoming IPOs for listing-gain, short-term and long-term signals. “Best” is not guaranteed; the panel shows the strongest model signal from the fields currently available.</span></div><div class="det-tabs">'+tabs+'</div><div class="det-controls"><label>IPO for 1–10 lot calculator<select id="det-ref">'+opts.map(x=>'<option value="'+E(x.name)+'" '+(norm(x.name)===norm(ref)?'selected':'')+'>'+E(x.name)+' — '+E(x.board||x.type||'')+'</option>').join('')+'</select></label><label>Optional budget ₹<input id="det-budget" type="number" min="0" step="1000" value="'+(budget||'')+'" placeholder="e.g. 200000"></label><div class="det-presets">'+Array.from({length:10},(_,i)=>'<button type="button" data-x="'+(i+1)+'">'+(i+1)+'× lot</button>').join('')+'</div></div>'+body+'<div class="det-rules"><b>Official rule references:</b> Mainboard retail threshold ₹2L, NII bands above ₹2L/₹10L, and UPI up to ₹5L follow current SEBI/NSE public-issue rules. SME Individual Investor rules are 2+ lots and above ₹2L for issues opening from 1 Jul 2025. Always verify the specific issue RHP and bid instructions before applying.</div>';
 bind()
}
function bind(){
 document.querySelectorAll('[data-m]').forEach(b=>b.onclick=()=>{mode=b.dataset.m;render()});
 $('#det-ref')?.addEventListener('change',e=>{ref=e.target.value;render()});
 $('#det-budget')?.addEventListener('input',e=>{budget=Number(e.target.value||0)});
 document.querySelectorAll('[data-x]').forEach(b=>b.onclick=()=>{const x=find(data,ref),l=x&&lotInfo(x);if(l){budget=l.cost*Number(b.dataset.x);const inp=$('#det-budget');if(inp)inp.value=budget;render()}})
}
const style=document.createElement('style');style.textContent='.det-intro{padding:13px;border-radius:16px;background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.22);margin-bottom:10px}.det-intro span,.det-head span,.det-meta,.det-note{display:block;color:var(--muted);font-size:11px;margin-top:4px}.det-tabs{display:flex;gap:7px;overflow:auto;padding:2px 0 9px}.det-tab,.det-presets button{border:1px solid var(--line);background:var(--glass);color:var(--muted);border-radius:999px;padding:8px 11px;font-weight:850;white-space:nowrap;cursor:pointer}.det-tab.active{background:var(--glass2);color:var(--text)}.det-controls{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:10px}.det-controls label{font-size:10px;color:var(--muted);font-weight:800}.det-controls select,.det-controls input{width:100%;margin-top:5px;padding:10px;border-radius:12px;border:1px solid var(--line);background:rgba(255,255,255,.045);color:var(--text)}.det-presets{grid-column:1/-1;display:flex;gap:6px;overflow:auto}.det-head{padding:10px 0}.det-grid,.det-video-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px}.det-card,.det-video{padding:13px;border-radius:16px;background:rgba(255,255,255,.045);border:1px solid var(--line);text-decoration:none;color:var(--text);position:relative}.det-card i{position:absolute;right:10px;top:9px;font-size:10px;color:var(--muted)}.det-name{display:block;padding-right:20px;font-size:14px}.det-score{font-size:23px;font-weight:950;margin-top:10px}.det-score small{font-size:10px;color:var(--muted);font-weight:600}.det-mini{display:grid;grid-template-columns:repeat(3,1fr);gap:5px;margin:9px 0}.det-mini span{font-size:9px;color:var(--muted);padding:6px;border:1px solid var(--line);border-radius:9px}.det-mini b{display:block;color:var(--text);font-size:11px}.det-budget{padding:12px;border-radius:14px;border:1px solid var(--line);background:rgba(34,197,94,.06);margin-bottom:10px}.det-budget span{display:block;color:var(--muted);font-size:11px;margin-top:3px}.det-allocation{display:grid;gap:7px}.det-alloc{display:flex;justify-content:space-between;gap:8px;padding:10px;border-radius:12px;background:rgba(255,255,255,.045);border:1px solid var(--line)}.det-video b,.det-video small{display:block}.det-video span{font-size:9px;color:var(--link);font-weight:900}.det-video b{margin-top:4px;font-size:13px}.det-video small{color:var(--muted);font-size:10px;line-height:1.5;margin:5px 0}.det-note{padding:10px;border-radius:12px;border:1px solid rgba(251,191,36,.3);background:rgba(251,191,36,.06)}.det-rules{margin-top:14px;padding:11px;border-radius:13px;border:1px solid var(--line);color:var(--muted);font-size:10px;line-height:1.6}.det-rules b{color:var(--text)}.det-empty{text-align:center;padding:25px;color:var(--muted)}@media(max-width:720px){.det-controls{grid-template-columns:1fr}.det-grid,.det-video-grid{grid-template-columns:1fr}.det-apply-table{min-width:720px}}';document.head.appendChild(style);

async function load(){
 try{
  const urls=['data/ipos.json','data/ipo-data.json','data/gmp.json','data/subscriptions.json'];
  const vals=await Promise.all(urls.map(u=>fetch(u+'?d='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)));
  const arr=v=>Array.isArray(v)?v:(v&&Array.isArray(v.data)?v.data:[]);
  const base=arr(vals[0]),rich=arr(vals[1]),gm=arr(vals[2]),su=arr(vals[3]);
  data=base.concat(rich).reduce((out,x)=>{if(!x?.name)return out;const y=find(out,x.name);if(!y)out.push({...x});else Object.keys(x).forEach(k=>{if(y[k]==null||y[k]===''||y[k]==='—')y[k]=x[k]});return out},[]);
  data=data.map(x=>{const g=find(gm,x.name),q=find(su,x.name);return{...x,...g?g:{},...q?{total:q.total,qib:q.qib,nii:q.nii,rii:q.rii}: {}}});
  createPanel();render();
 }catch(e){console.error('IPO Decision engine',e)}
}
createPanel();load();setInterval(load,15*60*1000);
})();