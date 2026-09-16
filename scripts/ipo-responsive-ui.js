/* IPO Terminal responsive shell — layout only. Feature clicks are owned by ipo-nav.js. */
(function(){
'use strict';
function addStyle(){
  if(document.getElementById('ipo-responsive-shell')) return;
  var s=document.createElement('style');
  s.id='ipo-responsive-shell';
  s.textContent=`
/* ===== LIQUID GLASS ===== */
body{
  background:radial-gradient(900px 520px at 8% 0%,rgba(59,130,246,.20),transparent 58%),radial-gradient(760px 520px at 94% 12%,rgba(168,85,247,.18),transparent 58%),radial-gradient(800px 520px at 52% 105%,rgba(34,197,94,.11),transparent 62%),linear-gradient(145deg,var(--bg),#0c1322 55%,var(--bg))!important;
  background-attachment:fixed!important;
}
body:before,body:after{content:"";position:fixed;pointer-events:none;z-index:-1;border-radius:50%;filter:blur(70px);opacity:.24}
body:before{width:240px;height:240px;left:-90px;top:35%;background:rgba(59,130,246,.55)}
body:after{width:260px;height:260px;right:-100px;bottom:8%;background:rgba(168,85,247,.45)}
.hdr,.panel,.kpi-card,.news-item,.hbtns{
  position:relative!important;
  background:linear-gradient(135deg,rgba(255,255,255,.115),rgba(255,255,255,.038) 52%,rgba(255,255,255,.065))!important;
  border:1px solid rgba(255,255,255,.17)!important;
  box-shadow:0 18px 50px rgba(0,0,0,.22),inset 0 1px 0 rgba(255,255,255,.17),inset 0 -1px 0 rgba(255,255,255,.035)!important;
  backdrop-filter:blur(28px) saturate(155%)!important;
  -webkit-backdrop-filter:blur(28px) saturate(155%)!important;
}
.hdr:before,.panel:before,.kpi-card:before,.hbtns:before{content:"";position:absolute;inset:0;pointer-events:none;z-index:0;background:linear-gradient(115deg,rgba(255,255,255,.15),transparent 24%,transparent 70%,rgba(255,255,255,.045));opacity:.9}
.hdr>div,.panel-title,.panel>div:not(.panel-title),.kpi-card>*,.hbtns>.hb{position:relative;z-index:1}
.hbtns .hb,.theme-btn{background:linear-gradient(135deg,rgba(255,255,255,.13),rgba(255,255,255,.035))!important;border:1px solid rgba(255,255,255,.19)!important;box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 7px 22px rgba(0,0,0,.14)!important;backdrop-filter:blur(20px) saturate(165%)!important;-webkit-backdrop-filter:blur(20px) saturate(165%)!important;transition:transform .22s ease,box-shadow .22s ease,border-color .22s ease,background .22s ease!important}
.hbtns .hb:hover{transform:translateY(-2px)!important;border-color:rgba(255,255,255,.34)!important}
.hbtns .hb:active{transform:scale(.985)!important}
.hbtns .hb.active{background:linear-gradient(135deg,rgba(59,130,246,.76),rgba(168,85,247,.70))!important;border-color:rgba(255,255,255,.42)!important;box-shadow:0 10px 32px rgba(59,130,246,.30),inset 0 1px 0 rgba(255,255,255,.34)!important}
.panel-title,.ipo-table th{background:linear-gradient(180deg,rgba(255,255,255,.075),rgba(255,255,255,.025))!important;backdrop-filter:blur(22px) saturate(150%)!important;-webkit-backdrop-filter:blur(22px) saturate(150%)!important}
.ipo-table tr:hover{background:rgba(255,255,255,.05)!important}
.ipo-table td{border-bottom-color:rgba(255,255,255,.08)!important}
.kpi-card{transition:transform .22s ease,box-shadow .22s ease!important}
.kpi-card:hover{transform:translateY(-2px)!important}
body.light{background:radial-gradient(900px 520px at 8% 0%,rgba(59,130,246,.14),transparent 58%),radial-gradient(760px 520px at 94% 12%,rgba(168,85,247,.11),transparent 58%),radial-gradient(800px 520px at 52% 105%,rgba(34,197,94,.08),transparent 62%),var(--bg)!important}
body.light .hdr,body.light .panel,body.light .kpi-card,body.light .news-item,body.light .hbtns{background:linear-gradient(135deg,rgba(255,255,255,.70),rgba(255,255,255,.40) 52%,rgba(255,255,255,.58))!important;border-color:rgba(255,255,255,.78)!important;box-shadow:0 18px 50px rgba(71,85,105,.13),inset 0 1px 0 rgba(255,255,255,.95)!important}

/* ===== LAPTOP / DESKTOP ===== */
@media(min-width:901px){
  body{padding:10px 20px 56px 274px!important;min-width:0!important;min-height:100vh!important}
  .hdr{width:100%!important;margin-bottom:10px!important}
  .hbtns{
    position:fixed!important;
    left:10px!important;
    top:92px!important;
    width:246px!important;
    max-height:calc(100vh - 104px)!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    overscroll-behavior:contain!important;
    -webkit-overflow-scrolling:touch!important;
    display:flex!important;
    flex-direction:column!important;
    flex-wrap:nowrap!important;
    gap:7px!important;
    padding:10px!important;
    margin:0!important;
    border-radius:16px!important;
    z-index:9999!important;
    align-items:stretch!important;
  }
  .hbtns:before{pointer-events:none!important}
  .hbtns .hb{
    flex:0 0 auto!important;
    width:100%!important;
    min-height:40px!important;
    text-align:left!important;
    padding:9px 12px!important;
    margin:0!important;
    white-space:normal!important;
    cursor:pointer!important;
  }
  .hbtns .hb:hover{transform:translateX(2px)!important}
  .kpi-row,.panel{width:100%!important;max-width:none!important}
  .panel{scroll-margin-top:10px!important}
  .panel-title{position:sticky!important;top:0!important;z-index:20!important}
  .ipo-table{min-width:720px}
}

/* ===== MOBILE / TABLET ===== */
@media(max-width:900px){
  body{padding:8px 8px 54px!important}
  .hbtns{
    position:static!important;
    width:100%!important;
    max-height:none!important;
    overflow-x:auto!important;
    overflow-y:hidden!important;
    display:flex!important;
    flex-wrap:nowrap!important;
    gap:6px!important;
    margin-top:10px!important;
    padding:7px!important;
    border-radius:16px!important;
    -webkit-overflow-scrolling:touch!important;
    scrollbar-width:none!important;
  }
  .hbtns::-webkit-scrollbar{display:none!important}
  .hbtns .hb{flex:0 0 auto!important;width:auto!important;min-width:112px!important;min-height:42px!important;text-align:center!important;white-space:nowrap!important;padding:8px 10px!important;margin:0!important;font-size:11px!important}
  .kpi-card{min-width:0!important}
}
@media(max-width:700px){.hbtns .hb{min-width:105px!important;font-size:10px!important;min-height:40px!important}}

#ipc-btn,#ipf-btn,#dna-btn,#radar-btn,#sme-btn{font-weight:800!important}
#ipf-btn{border-color:rgba(34,197,94,.55)!important}
#dna-btn{border-color:rgba(59,130,246,.55)!important}
#radar-btn,#sme-btn{border-color:rgba(168,85,247,.55)!important}
`;
  document.head.appendChild(s);
}
function start(){addStyle();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(start,700);});
else setTimeout(start,700);
})();
