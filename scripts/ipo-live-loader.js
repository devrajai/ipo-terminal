/* IPO Terminal live data repair layer. Normalizes the existing JSON feeds and renders the current UI. */
(function(){
'use strict';
var BASE='data/';
function q(s){return document.querySelector(s)}
function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function arr(v,keys){
 if(Array.isArray(v)) return v;
 if(v&&typeof v==='object'){
  for(var i=0;i<keys.length;i++) if(Array.isArray(v[keys[i]])) return v[keys[i]];
 }
 return [];
}
async function get(file){var r=await fetch(BASE+file+'?live='+Date.now(),{cache:'no-store'});if(!r.ok)throw new Error(file+' HTTP '+r.status);var t=await r.text();if(!t.trim())throw new Error(file+' empty');return JSON.parse(t)}
function date(v){
 if(!v)return null;
 var s=String(v).trim(),m=s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
 if(m){var y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1])}
 var d=new Date(s);return isNaN(d.getTime())?null:d;
}
function fmt(v){var d=date(v);if(!d)return String(v||'—');return String(d.getDate()).padStart(2,'0')+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getFullYear()).slice(-2)}
function name(x){return x.name||x.company||x.companyName||x.ipoName||x.title||'IPO'}
function pick(x,keys,def){for(var i=0;i<keys.length;i++)if(x[keys[i]]!=null&&x[keys[i]]!=='')return x[keys[i]];return def||'—'}
function status(x){
 var s=String(x.status||x.stage||'').toLowerCase();
 if(s.includes('listed'))return 'listed';
 if(s.includes('closed'))return 'closed';
 if(s.includes('open')||s.includes('live'))return 'open';
 if(s.includes('upcoming')||s.includes('announced'))return 'upcoming';
 var o=date(pick(x,['open','openDate','open_date','issueOpenDate','startDate'],'')),c=date(pick(x,['close','closeDate','close_date','issueCloseDate','endDate'],'')),now=new Date();
 if(o&&now<o)return 'upcoming';
 if(c&&now>new Date(c.getFullYear(),c.getMonth(),c.getDate(),23,59,59))return x.listingDate?'listed':'closed';
 return o?'open':'upcoming';
}
function price(x){return pick(x,['priceBand','price','price_band','priceRange'],'—')}
function lot(x){return pick(x,['lotSize','lot','lot_size','minQty'],'—')}
function issue(x){return pick(x,['issueSize','issue_size','issue','issueAmount','issueSizeCr'],'—')}
function openDate(x){return pick(x,['open','openDate','open_date','issueOpenDate','startDate'],'—')}
function closeDate(x){return pick(x,['close','closeDate','close_date','issueCloseDate','endDate'],'—')}
function card(x,st){
 var board=pick(x,['board','type','series'],'');
 var sub=x.subscription||x.subscriptions||{};
 var total=pick(sub,['total','overall','subscription'],'');
 return '<article class="ipo-card"><div class="ipo-name">'+esc(name(x))+'</div><div class="ipo-meta"><span class="status '+st+'">'+esc(st.toUpperCase())+'</span><span>'+esc(board)+'</span><span>Open: '+fmt(openDate(x))+'</span><span>Close: '+fmt(closeDate(x))+'</span></div><div class="ipo-stats"><div>Price Band<b>'+esc(price(x))+'</b></div><div>Lot Size<b>'+esc(lot(x))+'</b></div><div>Issue Size<b>'+esc(issue(x))+'</b></div></div>'+(total?'<div class="small-note" style="text-align:left">Subscription: '+esc(total)+'x</div>':'')+'<a class="apply-btn" href="https://www.nseindia.com/market-data/all-upcoming-issues-ipo" target="_blank" rel="noopener">Official NSE IPO page →</a></article>';
}
function renderCompare(open,up){var a=open.concat(up);q('#comp-container').innerHTML=a.length?'<div class="table-wrap"><table class="ipo-table"><thead><tr><th>IPO</th><th>Status</th><th>Open</th><th>Close</th><th>Price</th><th>Lot</th><th>Issue</th></tr></thead><tbody>'+a.map(function(x){return '<tr><td>'+esc(name(x))+'</td><td>'+esc(status(x).toUpperCase())+'</td><td>'+fmt(openDate(x))+'</td><td>'+fmt(closeDate(x))+'</td><td>'+esc(price(x))+'</td><td>'+esc(lot(x))+'</td><td>'+esc(issue(x))+'</td></tr>'}).join('')+'</tbody></table></div>':'<div class="small-note">No IPO comparison data available.</div>'}
function renderListed(a){q('#list-container').innerHTML=a.length?a.slice(0,50).map(function(x){var g=pick(x,['gainPercent','gain','listingGainPercent','listingGain'],'0');var n=Number(String(g).replace(/[^0-9.-]/g,''))||0;var cls=n>0?'gain':n<0?'loss':'zero';return '<article class="gl-card '+cls+'"><div class="ipo-name">'+esc(name(x))+'</div><div class="ipo-meta">Listing: '+fmt(x.listingDate||x.list_date||x.listing_date)+'</div><div class="gl-pct">'+(n>0?'▲ ':n<0?'▼ ':'')+esc(n.toFixed(2))+'%</div></article>'}).join(''):'<div class="small-note">No listed IPO data available.</div>'}
function renderFilings(docs,ipos){
 var active=ipos.filter(function(x){var s=status(x);return s==='open'||s==='upcoming'}),seen={};
 var rows=docs.slice();
 active.forEach(function(x){var n=name(x).toLowerCase();if(!seen[n]){rows.push({name:name(x),company:name(x),type:'RHP / DRHP',date:pick(x,['filingDate','rhpDate','drhpDate'],''),url:x.rhpUrl||x.drhpUrl||x.prospectusUrl||x.filingUrl||''});seen[n]=1}});
 var html=rows.slice(0,100).map(function(x){return '<div class="doc-row"><b>'+esc(name(x))+'</b><div class="small-note" style="text-align:left">'+esc(pick(x,['type','filingType','documentType'],'RHP/DRHP'))+' '+fmt(pick(x,['date','filingDate','publishedDate'],''))+'</div>'+(x.url?'<a class="doc-link" href="'+esc(x.url)+'" target="_blank" rel="noopener">Open official document →</a>':'<div class="small-note" style="text-align:left">Awaiting official filing link</div>')+'</div>'}).join('');
 q('#pipe-container').innerHTML=html||'<div class="small-note">No current DRHP/RHP filings available.</div>';
 q('#doc-container').innerHTML=html||'<div class="small-note">No RHP/DRHP documents available.</div>';
}
function renderNews(news){var html=news.slice(0,30).map(function(x){return '<article class="news-item"><div class="news-date">'+fmt(x.date||x.published||x.published_at)+'</div><div class="news-title">'+esc(x.title||x.headline||'IPO update')+'</div><div class="news-source">'+esc(x.source||x.publisher||'')+'</div>'+(x.url?'<a class="news-link" href="'+esc(x.url)+'" target="_blank" rel="noopener">Read →</a>':'')+'</article>'}).join('');q('#news-container').innerHTML=html||'<div class="small-note">No recent IPO news.</div>'}
function liveClock(){var e=q('#liveClock');if(!e)return;function tick(){var now=new Date(),p=new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Kolkata',day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(now),o={};p.forEach(function(x){o[x.type]=x.value});e.textContent=o.day+'/'+o.month+'/'+o.year+' • '+o.hour+':'+o.minute+':'+o.second+' IST'}tick();setInterval(tick,1000)}
async function run(){
 try{
  var r=await Promise.all([get('ipo-data.json'),get('gmp.json'),get('subscriptions.json'),get('sme-ipos.json'),get('live-news.json'),get('live-filings.json')]);
  var ipos=arr(r[0],['ipos','data','items','records']),sme=arr(r[3],['ipos','data','items','records']);
  var map={};ipos.forEach(function(x){map[name(x).toLowerCase()]=x});sme.forEach(function(x){var k=name(x).toLowerCase();if(!map[k]){map[k]=x;ipos.push(x)}});
  var groups={open:[],upcoming:[],closed:[],listed:[]};ipos.forEach(function(x){var s=status(x);if(groups[s])groups[s].push(x)});
  q('#kpi-open').textContent=groups.open.length;q('#kpi-upc').textContent=groups.upcoming.length;q('#kpi-closed').textContent=groups.closed.length;
  q('#open-container').innerHTML=groups.open.length?groups.open.map(function(x){return card(x,'open')}).join(''):'<div class="small-note">No open IPOs.</div>';
  q('#upc-container').innerHTML=groups.upcoming.length?groups.upcoming.map(function(x){return card(x,'upcoming')}).join(''):'<div class="small-note">No upcoming IPOs.</div>';
  renderListed(groups.listed.concat(groups.closed.filter(function(x){return x.listingDate||x.list_date||x.listing_date})));renderCompare(groups.open,groups.upcoming);
  renderNews(arr(r[4],['items','news','data','records']));renderFilings(arr(r[5],['documents','items','filings','data','records']),ipos);
  window.ALL_IPOS=ipos;window.GMP_DATA=arr(r[1],['items','data','records']);window.SUBSCRIPTIONS=arr(r[2],['items','data','records']);window.SME_IPOS=sme;
  liveClock();
 }catch(e){console.error('IPO Terminal data loader:',e);['open-container','upc-container','pipe-container','list-container','comp-container','news-container','doc-container'].forEach(function(id){var x=document.getElementById(id);if(x)x.innerHTML='<div style="padding:18px;text-align:center;color:var(--rd);font-weight:700">⚠ Data is being updated. Please refresh in 5 minutes.</div>'})}
}
document.addEventListener('DOMContentLoaded',function(){liveClock();setTimeout(run,80)});
})();
