/* IPO TERMINAL — SINGLE NAVIGATION CORE
   Owns navigation, theme, mobile/desktop behavior and UI health cleanup.
   Data/rendering engines remain untouched. */
(function(){
'use strict';
function ready(fn){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',fn,{once:true});else fn();}
ready(function(){
  var nav=document.querySelector('.hbtns');
  if(!nav)return;
  var normalizing=false;

  function removeBadRefreshMessages(root){
    root=root||document.body;
    var nodes=root.querySelectorAll ? root.querySelectorAll('*') : [];
    for(var i=0;i<nodes.length;i++){
      var el=nodes[i], txt=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(/Data updating\.\.\.\s*Refresh in 5 min\.?/i.test(txt) && el.children.length===0){el.remove();}
    }
  }

  function fixAllotment(){
    var p=document.getElementById('p-allot');
    if(!p)return;
    var w=p.querySelector('.allot-wrap');
    if(!w){
      w=document.createElement('div');
      w.className='allot-wrap';
      p.appendChild(w);
    }
    w.innerHTML=''+
      '<a class="big-link" href="https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids" target="_blank" rel="noopener noreferrer">Check IPO Bid / Allotment on NSE →</a>'+
      '<a class="big-link" href="https://www.bseindia.com/investors/appli_check.aspx" target="_blank" rel="noopener noreferrer">Check IPO Allotment on BSE →</a>'+
      '<a class="big-link" href="https://ipostatus.kfintech.com/" target="_blank" rel="noopener noreferrer">KFintech IPO Allotment Status →</a>'+
      '<a class="big-link" href="https://linkintime.co.in/initial_offer/" target="_blank" rel="noopener noreferrer">MUFG Intime / Link Intime Status →</a>'+
      '<a class="big-link" href="https://ipo.bigshareonline.com/IPO_Status.html" target="_blank" rel="noopener noreferrer">Bigshare IPO Allotment Status →</a>'+
      '<div class="small-note">Use the exchange or the registrar handling your IPO. PAN/application details are entered only on the official provider site and are not stored here.</div>';
  }

  function rebuild(){
    if(normalizing)return;
    normalizing=true;
    var buttons=[].slice.call(nav.querySelectorAll('.hb')),seen={};
    buttons.forEach(function(old){
      var text=(old.textContent||'').replace(/[🟢🕐📋📊⚖🎯📰📄💡📖🏦]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
      if(text==='docs'||text==='documents'){
        old.remove();
        var dp=document.getElementById('p-doc');if(dp)dp.remove();
        return;
      }
      if(text==='drhp'||text==='rhp'||text==='rhp / drhp'){
        old.textContent='📋 RHP / DRHP';
        old.setAttribute('data-panel','p-pipe');
      }
      var id=old.getAttribute('data-panel');
      if(!id||seen[id]){if(id)old.remove();return;}
      seen[id]=true;
      var b=old.cloneNode(true);
      b.__navCoreBound=true;
      old.replaceWith(b);
      b.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();toggle(b);});
      b.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();toggle(b);}});
    });
    var docs=document.getElementById('p-doc');if(docs)docs.remove();
    normalizing=false;
  }

  function allPanels(){return [].slice.call(document.querySelectorAll('.panel'));}
  function setNavCollapsed(v){nav.classList.toggle('nav-collapsed',!!v);nav.classList.remove('nav-hidden');}
  function toggle(btn){
    var id=btn.getAttribute('data-panel'),panel=id&&document.getElementById(id);if(!panel)return;
    var already=panel.classList.contains('show');
    allPanels().forEach(function(p){p.classList.remove('show');});
    nav.querySelectorAll('.hb.active').forEach(function(b){b.classList.remove('active');});
    if(already){document.body.classList.remove('panel-open');setNavCollapsed(false);}
    else{panel.classList.add('show');btn.classList.add('active');document.body.classList.add('panel-open');setNavCollapsed(true);}
  }

  document.addEventListener('click',function(e){
    var x=e.target.closest&&e.target.closest('.panel .close-x');if(!x)return;
    e.preventDefault();e.stopPropagation();
    var p=x.closest('.panel');if(p)p.classList.remove('show');
    nav.querySelectorAll('.hb.active').forEach(function(b){b.classList.remove('active');});
    document.body.classList.remove('panel-open');setNavCollapsed(false);
  },true);

  var theme=document.getElementById('themeToggle');
  function syncTheme(){
    var light=document.body.classList.contains('light');
    document.documentElement.classList.toggle('light',light);
    if(theme){theme.textContent=light?'☀️':'🌙';theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');}
  }
  if(theme){
    try{if(localStorage.getItem('ipo-terminal-theme')==='light')document.body.classList.add('light');}catch(e){}
    syncTheme();
    theme.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();document.body.classList.toggle('light');try{localStorage.setItem('ipo-terminal-theme',document.body.classList.contains('light')?'light':'dark');}catch(x){}syncTheme();},true);
  }

  var css=document.createElement('style');css.id='ipo-nav-core-css';css.textContent=`
    html,body{overflow-x:hidden!important}
    .hbtns{position:sticky!important;top:0!important;z-index:9000!important;width:100%!important;box-sizing:border-box!important;transition:transform .20s ease,opacity .20s ease!important}
    .hbtns .hb{touch-action:manipulation!important;-webkit-tap-highlight-color:transparent!important;cursor:pointer!important}
    .hbtns.nav-hidden{transform:translateY(-120%)!important;opacity:0!important;pointer-events:none!important}
    .hbtns.nav-collapsed{height:18px!important;min-height:18px!important;padding:0 12px!important;overflow:hidden!important;transform:none!important;opacity:.98!important}
    .hbtns.nav-collapsed .hb{display:none!important}
    .hbtns.nav-collapsed:after{content:'⌄';position:absolute;left:50%;top:0;transform:translateX(-50%);height:16px;width:46px;line-height:14px;text-align:center;border:1px solid var(--bd);border-top:0;border-radius:0 0 10px 10px;background:color-mix(in srgb,var(--bg) 65%,transparent);color:var(--tx3);pointer-events:none}
    .panel{position:relative!important;z-index:1!important;scroll-margin-top:8px!important}
    @media(max-width:699px){
      .hbtns{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important;overflow:visible!important;padding:10px 12px!important}
      .hbtns .hb{width:100%!important;min-width:0!important;flex:none!important}
      .hbtns.nav-hidden{height:0!important;min-height:0!important;padding-top:0!important;padding-bottom:0!important}
      .allot-wrap{display:grid!important;grid-template-columns:1fr!important;gap:0!important}
    }
    @media(min-width:700px){
      .hbtns{display:flex!important;flex-wrap:nowrap!important;overflow-x:auto!important;overflow-y:hidden!important;scrollbar-width:none!important}
      .hbtns::-webkit-scrollbar{display:none!important}
      .hbtns .hb{width:auto!important;min-width:max-content!important;flex:0 0 auto!important}
    }
  `;document.head.appendChild(css);

  rebuild();
  fixAllotment();
  removeBadRefreshMessages(document.body);

  var mo=new MutationObserver(function(){
    if(normalizing)return;
    var current=[].slice.call(nav.querySelectorAll('.hb'));
    var needs=current.some(function(b){return !b.__navCoreBound;});
    if(needs)rebuild();
    fixAllotment();
    removeBadRefreshMessages(document.body);
  });
  mo.observe(document.body,{childList:true,subtree:true});

  var lastY=window.scrollY||0;
  window.addEventListener('scroll',function(){
    var y=window.scrollY||document.documentElement.scrollTop||0;
    if(document.body.classList.contains('panel-open')){nav.classList.remove('nav-hidden');nav.classList.add('nav-collapsed');}
    else if(y>lastY+5)nav.classList.add('nav-hidden');
    else if(y<lastY-5||y<=8)nav.classList.remove('nav-hidden');
    lastY=y;
  },{passive:true});
});
})();
