(function(){
'use strict';
function boot(){
  var body=document.body, root=document.documentElement;
  if(!body) return;

  /* Final theme: one delegated handler, no competing button handlers. */
  var theme=document.getElementById('themeToggle');
  if(theme){
    theme.style.setProperty('display','block','important');
    theme.style.setProperty('position','fixed','important');
    theme.style.setProperty('right','12px','important');
    theme.style.setProperty('top','12px','important');
    theme.style.setProperty('z-index','99999','important');
  }

  function syncTheme(){
    var light=body.classList.contains('light');
    root.classList.toggle('light',light);
    if(theme){
      theme.textContent=light?'☀️':'🌙';
      theme.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');
      theme.title=light?'Switch to dark mode':'Switch to light mode';
    }
  }
  function toggleTheme(){
    var light=!body.classList.contains('light');
    body.classList.toggle('light',light);
    root.classList.toggle('light',light);
    try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark');}catch(e){}
    syncTheme();
  }
  try{
    var saved=localStorage.getItem('ipo-terminal-theme');
    if(saved==='light') body.classList.add('light');
    if(saved==='dark') body.classList.remove('light');
  }catch(e){}
  syncTheme();

  /* Kill the old nav behavior by handling navigation at document capture level. */
  document.addEventListener('click',function(e){
    var t=e.target&&e.target.closest?e.target.closest('#themeToggle'):null;
    if(t){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      toggleTheme(); return;
    }
    var btn=e.target&&e.target.closest?e.target.closest('.hbtns .hb'):null;
    if(btn){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var id=btn.getAttribute('data-panel');
      var panel=id?document.getElementById(id):null;
      if(!panel) return;
      var was=panel.classList.contains('show');
      document.querySelectorAll('.panel.show').forEach(function(p){p.classList.remove('show');});
      document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});
      if(!was){
        panel.classList.add('show');
        btn.classList.add('active');
        body.classList.add('panel-open');
      }else{
        body.classList.remove('panel-open');
      }
      var nav=document.querySelector('.hbtns');
      if(nav) nav.classList.add('nav-collapsed');
      return;
    }
    var close=e.target&&e.target.closest?e.target.closest('.close-x'):null;
    if(close){
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      var p=close.closest('.panel');
      if(p) p.classList.remove('show');
      document.querySelectorAll('.hbtns .hb.active').forEach(function(b){b.classList.remove('active');});
      body.classList.remove('panel-open');
      var nav2=document.querySelector('.hbtns');
      if(nav2) nav2.classList.remove('nav-collapsed');
    }
  },true);

  var nav=document.querySelector('.hbtns');
  if(nav){
    nav.style.setProperty('transition','transform .22s ease, opacity .22s ease','important');
    nav.style.setProperty('z-index','900','important');
  }
  var lastY=window.scrollY||0;
  var raf=0;
  function scrollNav(){
    raf=0;
    if(!nav) return;
    var y=window.scrollY||document.documentElement.scrollTop||0;
    if(y<=8){
      nav.classList.remove('nav-hidden');
      if(!body.classList.contains('panel-open')) nav.classList.remove('nav-collapsed');
    }else if(y>lastY+3){
      nav.classList.add('nav-hidden');
    }else if(y<lastY-3){
      nav.classList.remove('nav-hidden');
      nav.classList.remove('nav-collapsed');
    }
    lastY=y;
  }
  window.addEventListener('scroll',function(){if(!raf) raf=requestAnimationFrame(scrollNav);},{passive:true});
  scrollNav();
  window.addEventListener('pageshow',syncTheme);
}
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();
})();
