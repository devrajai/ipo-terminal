/* IPO Terminal final UX layer. Keeps data engines intact and only improves presentation. */
(function(){
'use strict';
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
function good(v){return v!==undefined&&v!==null&&v!==''&&v!=='—'&&v!=='-'&&v!=='TBA';}
function norm(v){return String(v||'').toLowerCase().replace(/\b(limited|ltd|india|ind|ipo|mainboard|sme|nse|bse)\b/g,' ').replace(/[^a-z0-9]+/g,'');}
function date(v){
 if(!v)return null;var s=String(v).trim(),m;
 m=s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
 if(m){var y=+m[3];if(y<100)y+=2000;var d=new Date(y,+m[2]-1,+m[1]);return isNaN(d.getTime())?null:d;}
 var d2=new Date(s);return isNaN(d2.getTime())?null:d2;
}
function removeSection(id,buttonText){var p=document.getElementById(id);if(p)p.remove();document.querySelectorAll('.hbtns .hb').forEach(function(b){if(String(b.textContent||'').toLowerCase().indexOf(buttonText.toLowerCase())>=0||b.getAttribute('data-panel')===id)b.remove();});}
function removeCompareAndDocs(){removeSection('p-comp','compare');removeSection('p-doc','docs');}
function listedItems(){
 var all=Array.isArray(window.ALL_IPOS)?window.ALL_IPOS:[];
 var now=new Date();
 return all.filter(function(i){
   if(!i||!i.name)return false;
   var st=String(i.status||'').toLowerCase();
   var ld=date(i.listing||i.listing_date||i.listed_on);
   return st==='listed'||st.indexOf('listed')>=0||(ld&&ld<=now);
 }).sort(function(a,b){
   var da=date(a.listing||a.listing_date||a.listed_on),db=date(b.listing||b.listing_date||b.listed_on);
   return (db?db.getTime():0)-(da?da.getTime():0);
 }).slice(0,5);
}
function renderLastFiveListed(){
 var c=document.getElementById('list-container');if(!c)return;
 var list=listedItems();
 if(!list.length){c.innerHTML='<div class="news-item">No listed IPO records are available yet. The automatic data engine will populate this section.</div>';return;}
 var h='';
 list.forEach(function(i){
   var price=i.price||i.issue_price||'—',lp=i.listing_price||i.listed_price||i.listingPrice||i.list_price||'—';
   var pct=i.listing_gain_pct||i.gain_pct||i.listing_gain||i.gain||'—';
   var pnum=parseFloat(String(pct).replace(/[^0-9.\-]/g,''));
   var cls=isNaN(pnum)?'zero':pnum>0?'gain':pnum<0?'loss':'zero';
   var ld=i.listing||i.listing_date||i.listed_on||'—';
   h+='<div class="gl-card '+cls+'"><div class="ipo-name">'+esc(i.name)+'</div><div class="ipo-meta"><span>Listed: '+esc(ld)+'</span><span>Issue: '+esc(price)+'</span><span>Listing: '+esc(lp)+'</span></div><div class="gl-pct">'+esc(pct)+'</div></div>';
 });
 c.innerHTML='<div class="news-item"><b>Latest 5 listed IPOs</b><div class="tx3" style="font-size:10px">Automatically sorted by latest listing date. Refreshed with the terminal data.</div></div>'+h;
}
function fixAllotment(){
 var w=document.querySelector('#p-allot .allot-wrap');if(!w)return;
 w.innerHTML='<a class="big-link" href="https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids" target="_blank" rel="noopener">Check IPO Allotment / Bid on NSE →</a><a class="big-link" href="https://bseindia.com/investors/appli_check.aspx" target="_blank" rel="noopener">Check IPO Allotment on BSE →</a><div class="small-note">Official exchange pages. For final allotment, the registrar for the individual IPO may also provide the status. PAN/application details are entered on the official site and are not stored here.</div>';
}
function addGlossary(){
 var g=document.querySelector('.gloss-grid');if(!g||g.dataset.extraAdded==='1')return;
 var terms=[
 ['ASBA','Application Supported by Blocked Amount — funds remain blocked in your bank account until the IPO process is completed.'],
 ['UPI Mandate','The payment authorization used for many retail IPO applications. Approve it within the required time.'],
 ['QIB','Qualified Institutional Buyers, such as eligible mutual funds, insurers and other institutions.'],
 ['NII / HNI','Non-Institutional Investors, generally investors applying above the retail category limit.'],
 ['OFS','Offer for Sale — existing shareholders sell shares; the company does not receive those proceeds.'],
 ['Fresh Issue','New shares issued by the company, with the proceeds going to the company subject to the offer terms.'],
 ['Anchor Investor','Eligible institutional investor receiving an allocation before the public issue opens, subject to applicable rules.'],
 ['Cut-off Price','For eligible retail bids, choosing cut-off means accepting the final issue price within the disclosed price band.'],
 ['Lot Size','The minimum number of shares in one IPO application lot.'],
 ['Price Band','The disclosed lower and upper price limits within which investors can bid.'],
 ['Basis of Allotment','The final method/document determining how shares are distributed among valid applicants.'],
 ['Registrar / RTA','The registrar and transfer agent handling application, allotment and related investor records for the issue.'],
 ['Listing Price','The first traded market price when the IPO shares begin trading on the exchange.'],
 ['Subscription','Demand received in each investor category compared with shares offered in that category.'],
 ['GMP','Grey Market Premium — unofficial market indication and not an exchange-set or guaranteed price.'],
 ['DRHP','Draft Red Herring Prospectus — draft offer document filed before the final public issue document.'],
 ['RHP','Red Herring Prospectus — the offer document used for the public issue before final pricing/allotment details.'],
 ['UDRHP','Updated Draft Red Herring Prospectus — an updated version of the draft offer document.'],
 ['P/E','Price-to-Earnings ratio, commonly used as one valuation measure.'],
 ['ROE','Return on Equity — a profitability measure relative to shareholders’ equity.'],
 ['ROCE','Return on Capital Employed — a measure of operating return relative to capital employed.'],
 ['D/E','Debt-to-Equity ratio, a common measure of financial leverage.'],
 ['OFS vs Fresh','A mixed issue can contain both shares sold by existing holders and newly issued shares; read the offer document for the exact split.'],
 ['Allotment Date','The date on which the basis of allotment is finalized and shares are allocated according to the issue process.'],
 ['Refund Date','The date on which blocked funds for unsuccessful or excess applications are released according to the issue schedule.'],
 ['Demat Credit','Electronic credit of allotted shares into the investor’s demat account after the allotment process.']
 ];
 terms.forEach(function(t){var card=document.createElement('div');card.className='gloss-card';card.innerHTML='<div class="gloss-term">'+esc(t[0])+'</div><div class="gloss-def">'+esc(t[1])+'</div>';g.appendChild(card);});
 g.dataset.extraAdded='1';
}
function removeLegacyComparisonFunctions(){
 var b=document.getElementById('b-brk'),p=document.getElementById('p-brk');if(b)b.remove();if(p)p.remove();
}
function init(){
 removeCompareAndDocs();removeLegacyComparisonFunctions();fixAllotment();addGlossary();renderLastFiveListed();
 setInterval(function(){removeCompareAndDocs();fixAllotment();addGlossary();renderLastFiveListed();},15*60*1000);
 setTimeout(function(){renderLastFiveListed();fixAllotment();addGlossary();},1200);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,900);});else setTimeout(init,900);
})();
