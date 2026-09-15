/* IPO Terminal visual redesign: consistent two-column responsive button grid. */
(function(){
'use strict';
var ICONS={
 'b-open':'↗','b-upc':'🚀','b-pipe':'▤','b-list':'☷','b-comp':'⚖','b-allot':'◉','b-news':'▤','b-doc':'↗','b-tips':'💡','b-gloss':'▤','b-why':'?','ipc-btn':'◫','dna-btn':'🧬','radar-btn':'◎','lot1-btn':'🎯'
};
function apply(){
 var styleId='ipo-terminal-redesign-style';
 if(!document.getElementById(styleId)){
  var s=document.createElement('style');s.id=styleId;
  s.textContent=`
  :root{--ui-bg:#07111d;--ui-card:#0b1a2c;--ui-card2:#0e2137;--ui-line:#078de0;--ui-cyan:#16d8ff;--ui-text:#e8f3ff;--ui-muted:#9db4ce}
  body{background:radial-gradient(circle at 50% -10%,#102b47 0,#07111d 38%,#050b12 100%)!important;padding:14px!important;color:var(--ui-text)!important}
  .hdr{background:linear-gradient(145deg,rgba(7,20,34,.98),rgba(5,13,24,.98))!important;border:1px solid #214d76!important;border-radius:18px!important;padding:18px 20px!important;box-shadow:0 12px 34px rgba(0,0,0,.3),inset 0 1px rgba(255,255,255,.03)!important}
  .hdr h1{font-size:30px!important;letter-spacing:.3px!important}
  .tm{font-size:14px!important;margin-top:6px!important;color:#b5c9df!important}
  .hbtns{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;margin-top:16px!important}
  .hbtns .hb{width:100%!important;min-width:0!important;min-height:58px!important;padding:10px 42px 10px 18px!important;border-radius:18px!important;border:1px solid #155d91!important;background:linear-gradient(145deg,#0c2137,#091728)!important;color:#cfe2f7!important;font-size:15px!important;font-weight:700!important;position:relative!important;white-space:normal!important;text-align:left!important;box-shadow:inset 0 1px rgba(255,255,255,.035),0 5px 16px rgba(0,0,0,.18)!important}
  .hbtns .hb:hover{border-color:var(--ui-cyan)!important;color:#fff!important;transform:translateY(-1px)!important}
  .hbtns .hb.active{background:linear-gradient(135deg,#075e9a,#50319a)!important;border-color:#2acfff!important;color:#fff!important;box-shadow:0 0 20px rgba(22,216,255,.18)!important}
  .hbtns .hb::after{content:'›';position:absolute;right:16px;top:50%;transform:translateY(-52%);font-size:28px;font-weight:400;color:#7fc8ff;line-height:1}
  .hbtns .hb .ui-icon{display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;margin-right:12px;border-radius:11px;background:rgba(0,191,255,.1);border:1px solid rgba(0,191,255,.22);color:#19cfff;font-size:19px;vertical-align:middle;box-shadow:0 0 14px rgba(0,191,255,.08)}
  .kpi-row{gap:10px!important;margin-bottom:10px!important}
  .kpi-card{background:linear-gradient(145deg,#0b1a2c,#08131f)!important;border:1px solid #214d76!important;border-radius:16px!important;padding:14px!important;min-height:84px!important;box-shadow:0 7px 18px rgba(0,0,0,.2)!important}
  .kpi-label{font-size:11px!important;color:#9db4ce!important}
  .kpi-value{font-size:23px!important}
  .panel{border-radius:16px!important;border-color:#214d76!important;background:#091522!important}
  .panel-title{padding:13px 16px!important;background:#0d2033!important}
  @media(max-width:700px){
    body{padding:8px!important}
    .hdr{padding:14px!important;border-radius:16px!important}
    .hdr h1{font-size:23px!important}
    .tm{font-size:11px!important}
    .hbtns{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px!important;margin-top:12px!important}
    .hbtns .hb{min-height:54px!important;padding:8px 28px 8px 9px!important;border-radius:15px!important;font-size:12px!important;text-align:center!important}
    .hbtns .hb::after{right:8px!important;font-size:22px!important}
    .hbtns .hb .ui-icon{width:27px!important;height:27px!important;margin-right:5px!important;font-size:14px!important;border-radius:8px!important}
    .kpi-row{gap:6px!important}
    .kpi-card{padding:9px 5px!important;min-height:72px!important}
    .kpi-label{font-size:9px!important}
    .kpi-value{font-size:19px!important}
  }
  `;
  document.head.appendChild(s);
 }
 var nav=document.querySelector('.hbtns');
 if(!nav)return;
 nav.querySelectorAll('.hb').forEach(function(b){
   if(!b.querySelector('.ui-icon')){
     var ic=document.createElement('span');ic.className='ui-icon';ic.textContent=ICONS[b.id]||'•';
     b.insertBefore(ic,b.firstChild);
   }
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(apply,500);});else setTimeout(apply,500);
setInterval(apply,1200);
})();
