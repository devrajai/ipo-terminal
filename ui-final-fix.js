(function(){
  'use strict';
  var root=document.documentElement, body=document.body;
  function themeSync(){
    var light=body.classList.contains('light');
    root.classList.toggle('light',light);
    var b=document.getElementById('themeToggle');
    if(b){b.textContent=light?'🌙':'☀️';b.setAttribute('aria-label',light?'Switch to dark mode':'Switch to light mode');}
  }
  function setTheme(light){
    body.classList.toggle('light',!!light);
    root.classList.toggle('light',!!light);
    try{localStorage.setItem('ipo-terminal-theme',light?'light':'dark');}catch(e){}
    themeSync();
  }
  var saved=null;try{saved=localStorage.getItem('ipo-terminal-theme');}catch(e){}
  if(saved==='light')setTheme(true);else if(saved==='dark')setTheme(false);else themeSync();

  /* Window-level capture runs before the old document-level duplicate handler. */
  window.addEventListener('click',function(e){
    var theme=e.target.closest && e.target.closest('#themeToggle');
    if(theme){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      setTheme(!body.classList.contains('light'));return;
    }
    var btn=e.target.closest && e.target.closest('.hb');
    if(btn){
      e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
      var id=btn.getAttribute('data-panel');
      var panel=id?document.getElementById(id):null;
      if(!panel)return;
      var was=panel.classList.contains('show');
      document.querySelectorAll('.panel.show').forEach(function(p){p.classList.remove('show');});
      document.querySelectorAll('.hb.active').forEach(function(b){b.classList.remove('active');});
      if(!was){panel.classList.add('show');btn.classList.add('active');}
      return;
    }
  },true);

  /* Mobile navigation: hide while scrolling down, reveal while scrolling up. */
  var lastY=window.scrollY||0;
  window.addEventListener('scroll',function(){
    var nav=document.querySelector('.hbtns');if(!nav)return;
    var y=window.scrollY||0;
    if(y<=10){nav.classList.remove('nav-hidden');}
    else if(y>lastY+2){nav.classList.add('nav-hidden');}
    else if(y<lastY-2){nav.classList.remove('nav-hidden');}
    lastY=y;
  },{passive:true});

  window.addEventListener('pageshow',function(){themeSync();});
})();
