(()=>{if(window.__IPODET_V2)return;window.__IPODET_V2=1;
const $=s=>document.querySelector(s), E=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&'+'amp;','<':'&'+'lt;','>':'&'+'gt;','"':'&'+'quot;',"'":'&'+'#39;'}[c]));
const num=v=>{const m=String(v??'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null};
const pair=v=>{const a=String(v??'').replace(/₹|,/g,'').match(/\d+(?:\.\d+)?/g);return a&&a.length?{lo:+a[0],hi:+(a[1]||a[0])}:null};
const norm=v=>String(v??'').toLowerCase().replace(/limited|ltd|india|private|pvt|[\W_]/g,'');
const money=v=>Number.isFinite(v)?'₹'+Math.round(v).toLocaleString('en-IN'):'—';
const find=(a,n)=>{const q=norm(n);return(a||[]).find(x=>norm(x.name)===q)||(a||[]).find(x=>norm(x.name).includes(q)||q.includes(norm(x.name)))};
let data=[],mode='all',ref='',budget=0,listedData=[];

const videos=[
 ['Fundamental','NSE IPO — full analysis','https://youtu.be/rynGD1_t5ZY?si=DrRMFTmyhDk8o35q','User supplied'],
 ['Fundamental','SS Retail IPO review','https://youtu.be/jwGGoeI9o7g?si=QiaT-X2zdUXT7SP6','User supplied'],
 ['Fundamental','Jindal Supreme IPO review','https://youtu.be/LmuAHHttcEU?si=xRSiGGa6xhkUDKZi','User supplied'],
 ['Fundamental','Hero Motors IPO review','https://youtu.be/IM3MBqDevU0?si=Nr52pzxVyEi_Y4sY','User supplied'],
 ['Fundamental','Manika Plastech IPO review','https://youtu.be/Wsu2ucCD8t8?si=NHXLdQA8FlblMiSc','User supplied'],
 ['Fundamental','Veegaland Developers final verdict','https://youtu.be/7JFFisRByYM?si=AfrqVSNHLXKhu6f_','User supplied'],
 ['User video','IPO video — title not resolved','https://youtu.be/dniTzu91L08?si=kK4PQBK_cY4N6RV2','User supplied'],
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
 const demand=(sub!=null?Math.min(100,sub*2.2):50);
 const valuation=(pe!=null&&gr!=null)?Math.max(0,Math.min(100,50+(gr-pe*.45))):50;
 const riskParts=[de!=null?(de<=.7?10:de<=1.2?20:de<=2?35:50):20,pe!=null?(pe<=25?5:pe<=35?15:pe<=50?30:45):20,g!=null?(Math.abs(g)<=10?5:Math.abs(g)<=25?12:25):15];
 const risk=Math.max(0,Math.min(100,riskParts.reduce((a,b)=>a+b,0)));
 const confidence=Math.max(30,100-miss*8);
 const odds=(sub!=null&&sub>1)?1/sub:1;const ev=(g!=null)?odds*Math.max(-20,Math.min(60,g)):null;
 return{listing,short,long,demand,valuation,risk,confidence,odds,ev}
}
function addResearchKnowledge(){
 const tips=$('#section-tips .tips'), gloss=$('#section-glossary .glossary');
 if(tips&&!tips.dataset.tipsRewritten){
  const items=[
   ['Never let a signal replace risk control','GMP, subscription, valuation, fundamentals and technical patterns are inputs—not guarantees. Keep position sizing, stop-loss rules, diversification and a maximum acceptable loss separate from the signal score.','Risk-management principle; not a profit guarantee.'],
   ['Separate pre-listing and post-listing decisions','The reason to apply for an IPO and the reason to trade it after listing are different. After listing, evaluate price structure, volume, liquidity and risk again instead of carrying the application thesis forward automatically.','Derived from the post-listing trading framework.'],
   ['Read the RHP / DRHP before applying','Focus on objects of the issue, financial history, risk factors, promoter/shareholding changes, fresh issue versus OFS and the valuation section. Use the official filing rather than relying only on summaries.','Primary-source research rule.'],
   ['Judge the business, not the buzz','Check revenue and profit growth, margins, operating cash flow, debt, promoter holding, related-party transactions and use of IPO proceeds. A strong company can still be an expensive IPO.','Fundamental-analysis guidance; use official filings for verification.'],
   ['Read subscription quality, not just quantity','Keep QIB, NII and Retail subscription separate. Total subscription alone can hide very different demand quality; compare the category mix and timing of bids before interpreting demand.','Research rule; requires historical validation before stronger weighting.'],
   ['Use GMP as a thermometer, not a forecast','GMP can show short-term market sentiment, but it is unofficial and can change quickly. Compare GMP with subscription, valuation and official issue data instead of treating it as a guaranteed listing gain.','Source-supported concept; Terminal treatment = signal, not prediction.'],
   ['SME IPOs need extra caution','SME listings can have thinner liquidity, wider spreads and exchange-specific price limits. Check the lot size, minimum application amount, liquidity and issue rules before applying; never assume a large premium is guaranteed.','General market-risk guidance; verify the specific issue rules.'],
   ['Decide the exit before listing day','Write down the plan before listing: sell at open, use a fixed target, or hold because you studied the business. Decide the maximum application size in advance so a loss cannot change your financial plans.','Practical risk-management guidance; not a return prediction.'],
   ['Look for a base before a technical entry','Measure the consolidation range and its duration. A base is a defined price structure, not proof that price will rise.','Source concept; requires backtesting.'],
   ['Volume matters with price structure','Compare current volume with a recent average. Volume contraction during consolidation and expansion around a defined breakout can be screened quantitatively.','Source concept; requires backtesting.'],
   ['U-turn needs evidence','Weak initial performance followed by stabilization, a base and a recovery trigger can be tagged as a U-turn watch. Do not treat the label as an automatic buy signal.','Source concept; requires backtesting.'],
   ['Backtest before increasing weights','When a video rule becomes a numerical Decision score, test it on historical IPOs and record sample size, median return, drawdown and holding period before increasing its weight.','Research methodology; not yet validated in this Terminal.'],
   ['Red flags: debt, cash flow and governance','Watch for rising debt while ROCE falls, weak operating cash flow despite reported profits, related-party loans, auditor changes close to the IPO, promoter pledge and other governance concerns.','Screening checklist; verify against official filings.'],
   ['Red flags: OFS-heavy and expensive issues','An OFS-heavy issue can mean existing holders are selling rather than the company raising new capital. Compare the valuation with listed peers and the growth needed to justify it.','Issue-structure and valuation checklist; verify with RHP.'],
  ['Allotment is math, not money','In an oversubscribed mainboard retail category every applicant is treated at the minimum one lot \u2014 applying 13 lots instead of 1 does not raise your chance, it only blocks more money. With real funds the category order is Big HNI (near-certain base) > Retail (small lottery) > Small HNI (worst). SME issues need 2+ lots, so know exactly how much money gets blocked.','Video research 18 Sep \u2014 SEBI category math'],
  ['The 21-day window after listing','Real moves often start after the listing-day hype fades. Early boom: lists, goes quiet 3-4 days with shrinking volume, then breaks above the early high (stop-loss at the quiet day low). U-turn: a weak listing reverses within ~21 days when first results or contract news lands. Strong post-listing stocks hold their 10/20-day moving averages \u2014 trail winners there.','Video research 18 Sep \u2014 post-listing trading framework'],
  ['Know who actually makes the money','Promoters and early investors are the reliable winners in most IPOs; historically only 2-4 of 10 listings deliver a meaningful pop, the rest are flat or negative. Size every application so a zero allotment or flat listing costs nothing but time.','Video research 18 Sep \u2014 primary-market structure'],
  ['Treat GMP as a hypothesis to test, not a target','Operator money and paid influencer chatter can prop up a fake GMP until listing day, and a 12-13% premium can collapse to 5-6% overnight. Check whether fundamentals support the premium: growth, RoE / RoCE, P/E versus peers, D/E, fresh versus OFS, and use of proceeds. When fundamentals and GMP disagree, trust the fundamentals.','Video research 18 Sep \u2014 GMP reliability'],
  ['Run a quick A / B / C filter','A = growing revenue and profit, healthy RoE and RoCE, sane P/E versus peers, mostly fresh issue, clean use of proceeds. B = mixed \u2014 good growth but thin margins, or fair valuation but high leverage. C = expensive P/E with weak growth, D/E above ~2, heavy OFS, single-location concentration or collapsing GMP. Study only the A bucket first.','Video research 18 Sep \u2014 ranking framework'],
  ['Apply early, never in the last hours','Every IPO season a huge number of applications are rejected \u2014 UPI mandate not approved in time, bank or PAN problems, bids placed below the cut-off in a hot issue. If you are sure, apply on day 1-2; if still studying, day 3 before 1 PM; never the last evening.','Video research 18 Sep \u2014 application hygiene'],
  ['Follow the money trail in objects of the issue','Debt repayment is verifiable and cuts future interest cost. Capex is medium risk \u2014 check the plant address and capacity actually exist. General corporate purpose is untraceable. Be extra careful when most of the issue is GCP or promoter OFS.','Video research 18 Sep \u2014 use-of-proceeds hierarchy'],
  ['The IPO calendar itself is a signal','Issues cluster in bull markets because sellers want high prices. A sudden rush of OFS-heavy IPOs near market highs is distribution, not opportunity \u2014 the same caution applies to a week crowded with six simultaneous issues.','Video research 18 Sep \u2014 market-cycle awareness']
  ];
  const base=tips.querySelectorAll('.card').length;
 tips.innerHTML+=items.map((t,i)=>'<div class="card glass tip-item"><b>'+E((base+i+1)+' — '+t[0])+'</b><p>'+E(t[1])+'</p><small class="det-source">'+E(t[2])+'</small></div>').join('');
  tips.dataset.tipsRewritten='2';
 }
 if(gloss&&!gloss.dataset.videoDna){
  [['GMP Freshness','How recently a grey-market quote was observed. Older quotes should reduce confidence.'],
   ['GMP Conflict','A flag when credible GMP sources disagree materially; conflicting quotes should not be silently averaged.'],
   ['Demand Quality','Keep QIB, NII and Retail subscription separate instead of relying only on total subscription.'],
   ['Volume Ratio','Current volume divided by a recent average volume. Below 1 means lower-than-average activity; above 1 means higher activity.'],
   ['Volume Contraction','A measurable reduction in volume during consolidation. It is a screening condition, not proof of a breakout.'],
   ['Base Formation','A period where price trades within a relatively contained range after a move; define the range and duration explicitly.'],
   ['Inside Day','A daily candle whose high and low remain within the previous day range. Use only when reliable daily OHLC data exists.'],
   ['Breakout','Price moving above a defined resistance/range boundary; volume can be used as confirmation.'],
   ['U-turn Setup','Weak initial performance followed by stabilization/base formation and a recovery trigger.'],
   ['Data Confidence','A measure of input completeness, freshness and consistency; it is not a probability of profit.']]
   .forEach(t=>{const c=document.createElement('div');c.className='card glass';c.innerHTML='<b>'+E(t[0])+'</b><div class="detail">'+E(t[1])+'</div>';gloss.appendChild(c)});gloss.dataset.videoDna='1'
 }
}

function lifecycle(x){
 const parse=v=>{
  const s=String(v??'').trim();
  if(!s)return null;
  const a=s.split(/[\\/-]/).map(Number);
  if(a.length===3){
   if(a[0]>1900)return new Date(a[0],a[1]-1,a[2]);
   let y=a[2]; if(y<100)y+=2000;
   return new Date(y,a[1]-1,a[0]);
  }
  return null;
 };
 const now=new Date(),o=parse(x.open_date||x.open),cl=parse(x.close_date||x.close),li=parse(x.listing_date||x.listing);
 if(li&&!isNaN(li)&&now>=li)return 'listed';
 if(cl&&!isNaN(cl)){const close=new Date(cl);close.setHours(17,0,0,0);if(now>=close)return 'closed'}
 if(o&&!isNaN(o)){const open=new Date(o);open.setHours(10,0,0,0);if(now>=open)return 'open'}
 return 'upcoming'
}
function enriched(){
 return data.map(x=>({...x,status:lifecycle(x),s:score(x),l:lotInfo(x)})).filter(x=>/^(open|upcoming)$/i.test(x.status)&&x.l)
}
function rank(k){return enriched().sort((a,b)=>b.s[k]-a.s[k]||b.s.confidence-a.s.confidence)}
function listedFor(name){return (listedData||[]).find(x=>norm(x.name)===norm(name))||(listedData||[]).find(x=>norm(x.name).includes(norm(name))||norm(name).includes(norm(x.name)))}
function postSignal(x){
 const z=listedFor(x.name); if(!z)return null;
 const issue=num(z.issue_price||x.price||x.price_band),lp=num(z.listing_price||z.listed_price||z.listingPrice),cur=num(z.current_price||z.ltp);
 const high=num(z.day1_high||z.high||z.listing_high),low=num(z.day1_low||z.low||z.listing_low),close=num(z.day1_close||z.close||z.listing_close);
 const volumeRatio=num(z.volume_ratio||z.day1_volume_ratio);
 const listingPct=issue&&lp?(lp/issue-1)*100:null; const range=lp&&high&&low?((high-low)/lp)*100:null; const closeStrength=high!=null&&low!=null&&close!=null&&high!==low?((close-low)/(high-low))*100:null;
 let setup='No structured post-listing setup detected',score=40;
 if(listingPct!=null&&listingPct<0)score+=8;if(range!=null&&range<12)score+=8;if(closeStrength!=null&&closeStrength>65)score+=8;if(volumeRatio!=null&&volumeRatio<0.8)score+=10;if(volumeRatio!=null&&volumeRatio>1.5)score+=5;
 if(listingPct!=null&&listingPct<0&&range!=null&&range<12)setup='U-turn / base watch';
 else if(volumeRatio!=null&&volumeRatio<0.8&&range!=null&&range<8)setup='Base + volume contraction watch';
 else if(high!=null&&lp!=null&&high>lp*1.03)setup='Breakout / momentum watch';
 return{score:Math.max(0,Math.min(100,score)),setup,listingPct,range,closeStrength,volumeRatio,current:cur}
}
function postView(){
 const rows=(listedData||[]).map(z=>({...z,p:postSignal(z)})).filter(z=>z.p);
 if(!rows.length)return '<div class="det-empty">Post-listing signals appear automatically when listing price, OHLC and volume fields are available in listed.json.</div>';
 return '<div class="det-head"><b>Post-listing pattern detector</b><span>Research-derived screening labels. Base, volume and breakout rules require historical backtesting before larger score weights are used.</span></div><div class="det-grid">'+rows.slice(0,20).map((x,i)=>'<article class="det-card"><i>#'+(i+1)+'</i><b class="det-name">'+E(x.name)+'</b><div class="det-meta">Issue '+E(x.issue_price||'—')+' • Listing '+E(x.listing_price||x.listed_price||'—')+'</div><div class="det-score">'+x.p.score.toFixed(0)+'/100 <small>'+E(x.p.setup)+'</small></div><div class="det-mini"><span>Listing<b>'+E(x.p.listingPct==null?'—':x.p.listingPct.toFixed(1)+'%')+'</b></span><span>Range<b>'+E(x.p.range==null?'—':x.p.range.toFixed(1)+'%')+'</b></span><span>Volume<b>'+E(x.p.volumeRatio==null?'—':x.p.volumeRatio.toFixed(2)+'×')+'</b></span></div><div class="det-meta">Close strength '+E(x.p.closeStrength==null?'—':x.p.closeStrength.toFixed(0)+'%')+' • Current '+E(x.p.current==null?'—':money(x.p.current))+'</div></article>').join('')+'</div><div class="det-rules"><b>Research rules:</b> watch consolidation/base formation, contracting volume, defined breakouts and U-turn structures; keep stop-loss, position sizing and backtesting separate from the opportunity score.</div>';
}
function createPanel(){
 let s=$('#section-decision');
 if(!s){s=document.createElement('section');s.id='section-decision';s.className='section glass';s.innerHTML='<div class="section-title"><span>🧠 IPO Decision & Application Planner</span><button class="close" data-close="decision">✕ Close</button></div><div id="ipo-decision-content" class="content"></div>';$('main')?.appendChild(s)}
 const nav=$('#nav-tools .nav');
 if(nav&&!nav.querySelector('[data-section="decision"]')){const b=document.createElement('button');b.dataset.section='decision';b.textContent='🧠 Decision';nav.appendChild(b)}
}
function rankView(rows,key){
 const title=key==='listing'?'Listing-gain signal':key==='short'?'Short-term signal':key==='long'?'Long-term fundamental signal':key==='ev'?'Expected value per application (GMP% x allot odds)':'All comparison';
 return '<div class="det-head"><b>'+title+'</b><span>Model signal only. It uses available GMP, subscription and fundamental fields; missing fields lower confidence.</span></div><div class="det-grid">'+rows.map((x,i)=>{const sc=key==='all'?(x.s.listing+x.s.short+x.s.long)/3:x.s[key];return '<article class="det-card"><i>#'+(i+1)+'</i><b class="det-name">'+E(x.name)+'</b><div class="det-meta">'+E(x.board||x.type||'—')+' • '+E(x.price||x.price_band||'—')+' • 1 lot '+money(x.l.cost)+'</div><div class="det-score">'+sc.toFixed(0)+'/100 <small>confidence '+x.s.confidence+'%</small></div><div class="det-mini"><span>Listing<b>'+x.s.listing.toFixed(0)+'</b></span><span>Short<b>'+x.s.short.toFixed(0)+'</b></span><span>Long<b>'+x.s.long.toFixed(0)+'</b></span></div><div class="det-meta">GMP '+E(x.gmp_pct||'—')+' • Sub '+E(x.total||'—')+' • P/E '+E(x.pe||'—')+' • P/B '+E(x.pb||'—')+' • ROE '+E(x.roe||'—')+' • ROCE '+E(x.roce||'—')+' • D/E '+E(x.de||'—')+'</div><div class="det-meta">Allot odds '+(x.s.odds>=1?'near-certain':'~1 in '+Math.max(2,Math.round(1/x.s.odds)))+' • EV per application '+(x.s.ev==null?'—':(x.s.ev>=0?'+':'')+x.s.ev.toFixed(1)+'% of lot value')+'</div></article>'}).join('')+'</div>'
}
function applicationView(){
 const x=find(data,ref); if(!x||!lotInfo(x))return'<div class="det-empty">Select an IPO with valid price band and lot size.</div>';
 const l=lotInfo(x);
 const rows=Array.from({length:10},(_,i)=>{const n=i+1,a=l.cost*n,c=category(x,n);return '<tr><td><b>'+n+' lot'+(n>1?'s':'')+'</b></td><td>'+money(a)+'</td><td>'+E(c[0])+'</td><td>'+E(c[1])+'</td><td>'+E(payment(x,n))+'</td></tr>'}).join('');
 const multi=enriched().filter(z=>z.name!==x.name).sort((a,b)=>b.s.short-a.s.short).slice(0,12);
 const multiRows=multi.map(z=>{const max=isSme(z)?Math.floor(500000/z.l.cost):Math.floor(1000000/z.l.cost);const n=Math.max(1,Math.min(max,2));const c=category(z,n);return '<div class="det-alloc"><b>'+E(z.name)+'</b><span>'+n+' lot • '+money(n*z.l.cost)+' • '+E(c[0])+'</span></div>'}).join('');
 return '<div class="det-budget"><b>'+E(x.name)+'</b><span>1 lot = '+money(l.cost)+' ('+l.qty.toLocaleString('en-IN')+' shares at the upper price band). Use the upper band for a conservative application-money estimate.</span></div><div class="table-wrap"><table class="table det-apply-table"><thead><tr><th>Lots</th><th>Application</th><th>Category</th><th>Why</th><th>Payment route</th></tr></thead><tbody>'+rows+'</tbody></table></div><div class="det-rules"><b>Quick interpretation:</b> Mainboard 1–10 lots are allowed in lot multiples; category changes automatically when total application crosses ₹2L and ₹10L. SME issues opening on/after 1 Jul 2025 require at least 2 lots and application value above ₹2L for the Individual Investor category; exactly 2 lots is Individual Investor and more than 2 lots is NII-Individual. </div><div class="det-head"><b>Multi-IPO planning</b><span>Use this as a capital-allocation calculator, not an allotment-probability forecast.</span></div><div class="det-allocation">'+(multiRows||'<div class="det-empty">No other current IPO has enough data.</div>')+'</div>'
}
function planView(){
 const es=enriched();
 const byEV=(a,b)=>((b.s.ev==null?-1e9:b.s.ev)-(a.s.ev==null?-1e9:a.s.ev))||(b.s.short-a.s.short);
 const main=es.filter(x=>!isSme(x)).sort(byEV);
 const sme=es.filter(x=>isSme(x)).sort(byEV);
 const med=a=>{const c=a.map(x=>x.l.cost).sort((p,q)=>p-q);return c.length?c[Math.floor(c.length/2)]:15000};
 const mMed=med(main);
 const evTxt=v=>v==null?'\u2014':((v>=0?'+':'')+v.toFixed(1)+'%');
 const pick=(p,i,lots)=>'<u>Rank '+(i+1)+'</u> '+E(p.name)+' ('+lots+' lot'+(lots>1?'s':'')+' '+money(p.l.cost*lots)+', EV '+evTxt(p.s.ev)+', short score '+p.s.short.toFixed(0)+'/100)';
 const lvl=(title,sub,picks,lots)=>'<div class="det-alloc"><b>'+title+'</b><span>'+sub+(picks.length?' \u2014 '+picks.map((p,i)=>pick(p,i,lots)).join(' \u2022 '):' \u2014 no IPO data')+'</span></div>';
 let h='<div class="det-head"><b>Budget ladder \u2014 where to apply</b><span>Open and upcoming IPOs ranked by expected value per application (GMP% x allot odds), then short-term score. Rank 1 = best pick.</span></div>';
 h+='<div class="det-budget"><b>Mainboard \u2014 1 lot each (allotment lottery)</b><span>Median 1-lot cost '+money(mMed)+'. More lots of the SAME IPO do not raise retail odds \u2014 with extra money add the next-ranked IPO, or use another family demat.</span></div>';
 [1,2,3].forEach(n=>{h+=lvl('Level '+n+' ('+money(n*mMed)+')','1 lot each, top '+n,main.slice(0,n),1)});
 h+='<div class="det-budget"><b>SME \u2014 2 lots each (SME minimum)</b><span>SME Individual Investor category: 2+ lots and application value above Rs 2,00,000. Know exactly how much money gets blocked.</span></div>';
 [1,2,3].forEach(n=>{h+=lvl('SME Level '+n,'2 lots each, top '+n,sme.slice(0,n),2)});
 if(budget>0){
  h+='<div class="det-head"><b>Your budget '+money(budget)+'</b><span>Affordable picks, best EV first.</span></div>';
  h+=lvl('Mainboard \u2014 1 lot each','fits in budget',main.filter(x=>x.l.cost<=budget),1);
  h+=lvl('SME \u2014 2 lots each','fits in budget',sme.filter(x=>x.l.cost*2<=budget),2);
 }
 h+='<div class="det-rules"><b>How to use:</b> Level 1 money = 1 lot of Rank 1. Level 2 = 1 lot each of Rank 1 + Rank 2 (not 2 lots of one). Level 3 = 1 lot each of top 3. SME = 2 lots minimum per IPO. Type your budget above to personalise. Rankings refresh automatically with GMP and subscription data; these are research heuristics, not guarantees.</div>';
 return h
}
function render(){
 const el=$('#ipo-decision-content');if(!el)return;
 const opts=enriched();if(!ref&&opts[0])ref=opts[0].name;
 const tabs=[['all','All comparison'],['plan','Budget ladder'],['listing','Listing gain'],['short','Short term'],['long','Long term'],['post','Post-listing'],['ev','Apply EV'],['apply','Application planner']].map(a=>'<button class="det-tab '+(mode===a[0]?'active':'')+'" data-m="'+a[0]+'">'+a[1]+'</button>').join('');
 const body=mode==='apply'?applicationView():mode==='plan'?planView():mode==='post'?postView():rankView(mode==='all'?(rank('short').slice().sort((a,b)=>((b.s.listing+b.s.short+b.s.long)-(a.s.listing+a.s.short+a.s.long)))):rank(mode),mode);
 el.innerHTML='<div class="det-intro"><b>🧠 Decision engine</b><span>Compare Open + Upcoming IPOs using demand, GMP, valuation and fundamentals. Listed IPOs also get post-listing pattern screening when market fields are available. Signals are research heuristics, not guaranteed returns.</span></div><div class="det-tabs">'+tabs+'</div><div class="det-controls"><label>IPO for 1–10 lot calculator<select id="det-ref">'+opts.map(x=>'<option value="'+E(x.name)+'" '+(norm(x.name)===norm(ref)?'selected':'')+'>'+E(x.name)+' — '+E(x.board||x.type||'')+'</option>').join('')+'</select></label><label>Optional budget ₹<input id="det-budget" type="number" min="0" step="1000" value="'+(budget||'')+'" placeholder="e.g. 200000"></label><div class="det-presets">'+Array.from({length:10},(_,i)=>'<button type="button" data-x="'+(i+1)+'">'+(i+1)+'× lot</button>').join('')+'</div></div>'+body+'<div class="det-rules"><b>Official rule references:</b> Mainboard retail threshold ₹2L, NII bands above ₹2L/₹10L, and UPI up to ₹5L follow current SEBI/NSE public-issue rules. SME Individual Investor rules are 2+ lots and above ₹2L for issues opening from 1 Jul 2025. Always verify the specific issue RHP and bid instructions before applying.</div>';
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
  const urls=['data/ipos.json','data/ipo-data.json','data/gmp.json','data/subscriptions.json','data/listed.json'];
  const vals=await Promise.all(urls.map(u=>fetch(u+'?d='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():null).catch(()=>null)));
  const arr=v=>Array.isArray(v)?v:(v&&Array.isArray(v.data)?v.data:[]);
  const base=arr(vals[0]),rich=arr(vals[1]),gm=arr(vals[2]),su=arr(vals[3]); listedData=arr(vals[4]);
  data=base.concat(rich).reduce((out,x)=>{if(!x?.name)return out;const y=find(out,x.name);if(!y)out.push({...x});else Object.keys(x).forEach(k=>{if(y[k]==null||y[k]===''||y[k]==='—')y[k]=x[k]});return out},[]);
  data=data.map(x=>{const g=find(gm,x.name),q=find(su,x.name);return{...x,...(g||{}),...(q?{total:q.total,qib:q.qib,nii:q.nii,rii:q.rii}:{}),status:lifecycle(x)};});
  createPanel();addResearchKnowledge();render();
 }catch(e){console.error('IPO Decision engine',e)}
}
createPanel();addResearchKnowledge();load();setInterval(load,15*60*1000);
})();