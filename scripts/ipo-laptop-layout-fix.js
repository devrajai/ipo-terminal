/* IPO Terminal: desktop command rail layout fix. Keeps the legacy page and mobile layout intact. */
(function(){
  'use strict';
  function apply(){
    if(document.getElementById('ipo-laptop-layout-style')) return;
    var s=document.createElement('style');
    s.id='ipo-laptop-layout-style';
    s.textContent=''
      +'.ipo-desktop-spacer{display:none}'
      +'@media (min-width:901px){'
      +'body{padding-left:222px!important;padding-right:10px!important}'
      +'.hdr{min-height:112px}'
      +'.hbtns{position:fixed!important;left:10px!important;top:10px!important;width:198px!important;max-height:calc(100vh - 20px)!important;overflow-y:auto!important;overflow-x:hidden!important;display:flex!important;flex-direction:column!important;flex-wrap:nowrap!important;gap:7px!important;margin:0!important;padding:12px!important;border:1px solid var(--bd)!important;border-radius:14px!important;background:rgba(19,26,42,.88)!important;box-shadow:0 18px 45px rgba(0,0,0,.35),inset 0 1px 0 rgba(255,255,255,.08)!important;backdrop-filter:blur(18px) saturate(145%)!important;-webkit-backdrop-filter:blur(18px) saturate(145%)!important;z-index:12000!important;scrollbar-width:thin}'
      +'.hbtns:before{content:"IPO TERMINAL";display:block;padding:3px 4px 8px;font-size:15px;font-weight:900;letter-spacing:.4px;background:linear-gradient(90deg,var(--gn),var(--bl),var(--pp));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}'
      +'.hbtns .hb{width:100%!important;min-height:34px!important;text-align:left!important;border-radius:9px!important;padding:8px 10px!important;font-size:11px!important}'
      +'.hbtns .hb.active{box-shadow:0 6px 18px rgba(59,130,246,.22)!important}'
      +'.ipo-upgrade-search{margin-left:0!important}'
      +'.upgrade-footer{left:0!important}'
      +'.theme-btn{margin-left:6px}'
      +'}'
      +'@media (max-width:900px){'
      +'body{padding-left:8px!important}'
      +'.hbtns{position:static!important;width:auto!important;max-height:none!important;overflow:visible!important;display:flex!important;flex-direction:row!important;flex-wrap:nowrap!important;overflow-x:auto!important;padding-bottom:3px!important}'
      +'.hbtns:before{display:none!important}'
      +'.hbtns .hb{width:auto!important;flex:0 0 auto!important;text-align:center!important}'
      +'}';
    document.head.appendChild(s);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',apply); else apply();
})();
