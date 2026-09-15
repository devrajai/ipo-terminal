/* IPO Terminal IPO DNA v2: comparative IPO-quality engine.
   This is a deterministic research model, not ML training. It learns the weighting rules from
   ipo-knowledge.json's educational framework and applies them consistently to every IPO. */
(function(){
'use strict';
function e(v){return String(v==null?'':v).replace(/[&<>\"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[x];});}
function n(v){var m=String(v==null?'').replace(/,/g,'').match(/-?\d+(?:\.\d+)?/);return m?parseFloat(m[0]):null;}
function ok(v){return v!=null&&v!==''&&v!=='—'&&v!=='-';}
function validGmp(i){var gp=n(i.gmp_pct);var g=n(i.gmp);return gp!=null&&gp>=-50&&gp<=100&&g!=null&&g>=-100&&g<=1000;}
function metric(i){
 var g=n(i.growth),roe=n(i.roe),roce=n(i.roce),de=n(i.de),pe=n(i.pe),fresh=n(i.fresh),ofs=n(i.ofs),prom=n(i.prom),sub=n(i.sub),gp=validGmp(i)?n(i.gmp_pct):null;
 var score=0,max=0,why=[],risk=[],evidence=0;
 // Growth / business quality: core factor
 if(g!=null){max+=16;evidence++;score+=g>=25?16:g>=20?14:g>=12?10:g>=5?6:0;if(g>=12)why.push('growth');else if(g<5)risk.push('weak growth');}
 // Profitability / returns
 if(roe!=null||roce!=null){max+=16;evidence++;var r=(roe!=null&&roce!=null)?(roe+roce)/2:(roe!=null?roe:roce);score+=r>=20?16:r>=15?13:r>=10?9:r>=5?5:0;if(r>=15)why.push('strong returns');else if(r<10)risk.push('weak returns');}
 // Valuation: lower PE better, but don't reward blindly
 if(pe!=null&&pe>0&&pe<100){max+=16;evidence++;score+=pe<=15?16:pe<=20?14:pe<=25?11:pe<=35?7:pe<=50?3:0;if(pe<=20)why.push('reasonable valuation');else if(pe>35)risk.push('high P/E');}
 // Debt
 if(de!=null&&de>=0){max+=14;evidence++;score+=de<=.2?14:de<=.4?12:de<=.6?9:de<=1?5:0;if(de<=.4)why.push('low debt');else if(de>1)risk.push('high debt');}
 // Fresh issue / OFS structure
 if(fresh!=null||ofs!=null){max+=10;evidence++;var f=fresh!=null?fresh:(100-(ofs||0));score+=f>=70?10:f>=50?8:f>=30?5:2;if(f>=70)why.push('fresh capital');if(ofs!=null&&ofs>50)risk.push('high OFS');}
 // Promoter alignment
 if(prom!=null){max+=8;evidence++;score+=prom>=60?8:prom>=50?7:prom>=30?5:2;if(prom>=50)why.push('promoter alignment');}
 // Demand (subscription)
 if(sub!=null){max+=10;evidence++;score+=sub>=50?10:sub>=20?9:sub>=10?8:sub>=3?5:sub>=1?3:0;if(sub>=10)why.push('strong demand');else if(sub<1)risk.push('weak/early demand');}
 // GMP is secondary sentiment only, and invalid/outlier GMP is ignored
 if(gp!=null){max+=5;evidence++;score+=gp>=20?5:gp>=10?4:gp>=5?3:gp>=0?1:0;if(gp>=10)why.push('positive GMP sentiment');if(gp<0)risk.push('negative GMP sentiment');}
 var pct=max?Math.round(score/max*100):50;
 var coverage=['price','size','lot','open','close','sub','gmp','fresh','ofs','pe','roe','roce','rev','pat','ebitda','de','growth','prom'].filter(function(k){return ok(i[k]);}).length;
 var confidence=Math.min(100,35+coverage*3+evidence*2);
 if(!ok(i.pe))risk.push('valuation evidence missing');
 if(!ok(i.roe)&&!ok(i.roce))risk.push('return evidence missing');
 return {score:pct,confidence:confidence,why:why.slice(0,4),risk:risk.slice(0,3),coverage:coverage,evidence:evidence,gmpValid:gp!=null};
}
function label(s){return s>=80?'Strong DNA':s>=70?'Healthy DNA':s>=60?'Mixed DNA':s>=50?'Caution DNA':'Weak DNA';}
function render(){
 var p=document.getElementById('ipo-dna-panel');if(!p||!Array.isArray(window.ALL_IPOS))return;
 var list=window.ALL_IPOS.filter(function(i){return i&&i.name;}).map(function(i){return {i:i,s:metric(i)};}).sort(function(a,b){return b.s.score-a.s.score||b.s.confidence-a.s.confidence;});
 var h='<div class="panel-title">IPO DNA <button class="close-x" id="dna-close">Close</button></div>';
 h+='<div class="dna-intro"><b>IPO DNA = which IPO has the stronger overall structure.</b><div class="tx3">DNA now compares IPOs using the same evidence framework: growth, profitability, valuation, debt, issue structure, promoter alignment and demand. GMP is only a secondary sentiment input. Missing data lowers confidence rather than automatically making an IPO bad.</div><div class="tx3" style="margin-top:4px"><b>Important:</b> this is a rules-based research engine, not a machine-learning model. When your transcript is added, its selection principles become the higher-priority knowledge source for this engine.</div></div>';
 h+='<div class="dna-summary"><b>DNA ranking</b><span class="tx3"> '+list.length+' IPOs compared · strongest evidence first</span></div><div class="dna-grid">';
 list.forEach(function(x,idx){var i=x.i,s=x.s,cl=s.score>=75?'gn':s.score>=60?'yl':'rd';
  h+='<div class="dna-card '+cl+'-dna"><div class="dna-head"><div><span class="dna-rank">#'+(idx+1)+'</span> <b>'+e(i.name)+'</b><div class="tx3">'+e(i.type||'IPO')+' · '+e(i.sector||'Sector unavailable')+'</div></div><div class="dna-score"><b>'+s.score+'</b><span>/100</span></div></div>';
  h+='<div class="dna-label">'+label(s.score)+' · '+s.confidence+'% confidence</div>';
  h+='<div class="dna-tags"><span class="dna-tag"><small>STRENGTH</small><b>'+e(s.why.length?s.why.join(' · '):'No strong positive signal yet')+'</b></span><span class="dna-tag"><small>CHECK</small><b>'+e(s.risk.length?s.risk.join(' · '):'No major warning in available evidence')+'</b></span><span class="dna-tag"><small>EVIDENCE</small><b>'+s.coverage+' fields · '+s.evidence+' scored factors</b></span><span class="dna-tag"><small>GMP</small><b>'+e(s.gmpValid?'Used as secondary sentiment':'Ignored / unavailable')+'</b></span></div></div>';
 });
 h+='</div>';p.innerHTML=h;p.classList.add('show');var b=document.getElementById('dna-btn');if(b)b.classList.add('active');var c=document.getElementById('dna-close');if(c)c.onclick=function(){p.classList.remove('show');if(b)b.classList.remove('active');};
}
function init(){
 if(document.getElementById('dna-btn'))return;var box=document.querySelector('.hbtns');if(!box)return;
 var b=document.createElement('button');b.className='hb';b.id='dna-btn';b.textContent='IPO DNA';b.onclick=function(){var p=document.getElementById('ipo-dna-panel');if(p&&p.classList.contains('show')){p.classList.remove('show');b.classList.remove('active');}else render();};box.appendChild(b);
 var p=document.createElement('div');p.className='panel';p.id='ipo-dna-panel';document.body.appendChild(p);
 var st=document.createElement('style');st.textContent='.dna-intro{padding:10px;border-bottom:1px solid var(--bd);font-size:11px}.dna-summary{padding:9px 10px;border-bottom:1px solid var(--bd)}.dna-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:8px;padding:8px}.dna-card{background:var(--card2);border:1px solid var(--bd);border-radius:10px;padding:10px}.dna-card.gn-dna{border-left:4px solid var(--gn)}.dna-card.yl-dna{border-left:4px solid var(--yl)}.dna-card.rd-dna{border-left:4px solid var(--rd)}.dna-head{display:flex;justify-content:space-between;gap:8px}.dna-rank{color:var(--tx3);font-size:10px}.dna-score b{font-size:24px}.dna-score span{font-size:9px;color:var(--tx3)}.dna-label{font-size:10px;margin:5px 0;color:var(--tx2)}.dna-tags{display:grid;grid-template-columns:1fr 1fr;gap:5px}.dna-tag{padding:6px;border:1px solid var(--bd);border-radius:7px;background:var(--card)}.dna-tag small{display:block;color:var(--tx3);font-size:7px;text-transform:uppercase}.dna-tag b{display:block;font-size:9px;margin-top:2px;line-height:1.25}@media(max-width:700px){.dna-grid{grid-template-columns:1fr}}';document.head.appendChild(st);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,280);});else setTimeout(init,280);
})();
