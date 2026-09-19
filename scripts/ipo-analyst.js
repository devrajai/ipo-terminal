/* IPO Terminal Research Lens: one-lot decision engine.
   Deterministic research support. Transcript-specific rules will override the seed framework when ingested. */
(function(){
'use strict';
function e(v){return String(v==null?"":v).replace(/[&<>"']/g,function(x){return x==="&"?"&"+"amp;":x==="<"?"&"+"lt;":x==="<"?"&"+"gt;":x==="<"?"&"+"quot;":"&"+"#39;";});}
function n(v){var m=String(v==null?'':v).replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?parseFloat(m[0]):null;}
function ok(v){return v!=null&&v!==''&&v!=='—'&&v!=='-';}
function gmpValid(i){var gp=n(i.gmp_pct),g=n(i.gmp);return gp!=null&&gp>=-50&&gp<=100&&g!=null&&g>=-100&&g<=1000;}
function lotCost(i,count){var p=n(i.price),l=n(i.lot);return p!=null&&l!=null&&p>0&&l>0?p*l*count:null;}
function money(v){return v==null?'TBA':'₹'+Math.round(v).toLocaleString('en-IN');}
function decision(i){
 var score=0,max=0,why=[],risk=[],coverage=0;
 var g=n(i.growth),roe=n(i.roe),roce=n(i.roce),de=n(i.de),pe=n(i.pe),fresh=n(i.fresh),ofs=n(i.ofs),prom=n(i.prom),sub=n(i.sub),gp=gmpValid(i)?n(i.gmp_pct):null;
 if(g!=null){max+=20;coverage++;score+=g>=25?20:g>=20?17:g>=12?13:g>=5?8:2;if(g>=12)why.push('strong growth');else if(g<5)risk.push('weak growth');}
 if(roe!=null||roce!=null){max+=18;coverage++;var r=(roe!=null&&roce!=null)?(roe+roce)/2:(roe!=null?roe:roce);score+=r>=20?18:r>=15?15:r>=10?10:r>=5?5:1;if(r>=15)why.push('strong returns');else if(r<10)risk.push('weak returns');}
 if(pe!=null&&pe>0&&pe<100){max+=18;coverage++;score+=pe<=15?18:pe<=20?16:pe<=25?13:pe<=35?8:pe<=50?3:0;if(pe<=25)why.push('valuation supportive');else if(pe>35)risk.push('high P/E');}
 if(de!=null&&de>=0){max+=14;coverage++;score+=de<=.2?14:de<=.4?12:de<=.6?9:de<=1?5:0;if(de<=.4)why.push('low debt');else if(de>1)risk.push('high debt');}
 if(fresh!=null||ofs!=null){max+=10;coverage++;var f=fresh!=null?fresh:(100-(ofs||0));score+=f>=70?10:f>=50?8:f>=30?5:2;if(f>=70)why.push('meaningful fresh capital');if(ofs!=null&&ofs>50)risk.push('high OFS mix');}
 if(prom!=null){max+=7;coverage++;score+=prom>=60?7:prom>=50?6:prom>=30?4:2;if(prom>=50)why.push('promoter alignment');}
 if(sub!=null){max+=8;coverage++;score+=sub>=50?8:sub>=20?7:sub>=10?6:sub>=3?4:sub>=1?2:0;if(sub>=10)why.push('strong demand');else if(sub<1)risk.push('weak/early demand');}
 if(gp!=null){max+=5;coverage++;score+=gp>=20?5:gp>=10?4:gp>=5?3:gp>=0?1:0;if(gp>=10)why.push('positive GMP sentiment');if(gp<0)risk.push('negative GMP sentiment');}
 if(!ok(i.pe))risk.push('valuation evidence missing');
 if(!ok(i.roe)&&!ok(i.roce))risk.push('return evidence missing');
 if(!ok(i.sub))risk.push('subscription evidence missing');
 var pct=max?Math.round(score/max*100):50;
 var fields=['price','lot','open','close','size','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom','sub','gmp'].filter(function(k){return ok(i[k]);}).length;
 var confidence=Math.min(100,35+fields*3+coverage*2);
 return {score:Math.max(0,Math.min(100,pct)),confidence:confidence,why:why.slice(0,4),risk:risk.slice(0,3),coverage:fields,cost1:lotCost(i,1),cost2:lotCost(i,2),gmpValid:gp!=null};
}
function status(i){
 var o=String(i.open||''),c=String(i.close||''),today=new Date();
 function d(s){var m=s.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);if(!m)return null;var y=+m[3];if(y<100)y+=2000;return new Date(y,+m[2]-1,+m[1]);}
 var od=d(o),cd=d(c);if(od&&cd){if(today<od)return 'Upcoming';if(today<=cd)return 'Open';return 'Closed';}return 'Status TBA';
}
function render(){
 var p=document.getElementById('ipo-research-lens'),c=document.getElementById('research-lens-content');if(!p||!c||!Array.isArray(window.ALL_IPOS))return;
 var list=window.ALL_IPOS.filter(function(i){return i&&i.name;}).map(function(i){return {i:i,s:decision(i)};}).sort(function(a,b){return b.s.score-a.s.score||b.s.confidence-a.s.confidence;}).slice(0,12);
 var top=list[0];
 var h='<div class="panel-title">1-Lot Decision Lens <button class="close-x" id="research-lens-close">Close</button></div>';
 h+='<div style="padding:10px;border-bottom:1px solid var(--bd)"><b>If I can apply for only ONE IPO lot</b><div class="tx3" style="font-size:10px;margin-top:4px">The engine compares business quality, growth, profitability, valuation, debt, issue structure, promoter alignment, demand and GMP sentiment, then shows the strongest evidence case. It is decision support, not a personal investment recommendation.</div></div>';
 if(top){h+='<div style="margin:10px;padding:12px;border:1px solid var(--bd);border-radius:12px;background:var(--card2)"><div class="tx3" style="font-size:9px">CURRENT #1 EVIDENCE CANDIDATE</div><div style="display:flex;justify-content:space-between;gap:8px;margin-top:4px"><div><b style="font-size:17px">'+e(top.i.name)+'</b><div class="tx3" style="font-size:9px">'+e(top.i.type||'IPO')+' · '+e(top.i.sector||'Sector unavailable')+' · '+e(status(top.i))+'</div></div><div><b class="gn" style="font-size:25px">'+top.s.score+'</b><span class="tx3" style="font-size:8px">/100</span></div></div><div style="font-size:10px;margin-top:7px"><b>Why:</b> '+e(top.s.why.length?top.s.why.join(' · '):'No strong positive signal yet')+'</div><div class="tx3" style="font-size:10px;margin-top:4px"><b>Check:</b> '+e(top.s.risk.length?top.s.risk.join(' · '):'No major warning in available evidence')+'</div><div class="tx3" style="font-size:9px;margin-top:5px"><b>Application amount:</b> 1 lot '+money(top.s.cost1)+' · 2 lots '+money(top.s.cost2)+' · <b>confidence:</b> '+top.s.confidence+'%</div></div>'}
 h+='<div class="news-list">';list.forEach(function(x,idx){var a=x.s,cl=a.score>=75?'gn':a.score>=60?'yl':'rd';h+='<div class="news-item" style="border-left-color:var(--'+cl+')"><div style="display:flex;justify-content:space-between;gap:8px"><div><span class="tx3" style="font-size:9px">#'+(idx+1)+'</span> <b style="font-size:14px">'+e(x.i.name)+'</b><div class="tx3" style="font-size:9px">'+e(x.i.type||'IPO')+' · '+e(x.i.sector||'Sector unavailable')+' · '+e(status(x.i))+'</div></div><div><b class="'+cl+'" style="font-size:22px">'+a.score+'</b><span class="tx3" style="font-size:8px"> /100</span></div></div><div style="font-size:10px;margin-top:6px"><b>Positive evidence:</b> '+e(a.why.length?a.why.join(' · '):'No strong positive signal yet')+'</div><div class="tx3" style="font-size:10px;margin-top:4px"><b>Check next:</b> '+e(a.risk.length?a.risk.join(' · '):'No major warning in available fields')+'</div><div class="tx3" style="font-size:8px;margin-top:6px">Application: 1 lot '+money(a.cost1)+' · 2 lots '+money(a.cost2)+' · Evidence: '+a.coverage+' fields · GMP: '+e(x.i.gmp_source||'none')+'</div></div>';});h+='</div>';
 h+='<div class="tx3" style="padding:10px;border-top:1px solid var(--bd);font-size:9px"><b>Transcript mode:</b> ready. When your video transcript is added, its exact selection principles will become the higher-priority rules for this one-lot ranking.</div>';
 c.innerHTML=h;p.classList.add('show');var b=document.getElementById('b-research-lens');if(b)b.classList.add('active');document.getElementById('research-lens-close').onclick=function(){p.classList.remove('show');if(b)b.classList.remove('active');};
}
function init(){if(document.getElementById('b-research-lens'))return;var box=document.querySelector('.hbtns');if(!box)return;var b=document.createElement('button');b.className='hb';b.id='b-research-lens';b.textContent='1-Lot Decision';b.onclick=function(){var p=document.getElementById('ipo-research-lens');if(p&&p.classList.contains('show')){p.classList.remove('show');b.classList.remove('active');}else render();};box.appendChild(b);var p=document.createElement('div');p.className='panel';p.id='ipo-research-lens';var c=document.createElement('div');c.id='research-lens-content';p.appendChild(c);document.body.appendChild(p);}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,180);});else setTimeout(init,180);
})();