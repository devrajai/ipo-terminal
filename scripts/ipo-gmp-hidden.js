/* GMP is collected by the backend, but hidden from the public UI until a reliable source is available. */
(function(){
'use strict';
function hideGmp(){
  document.querySelectorAll('.gmp-notice').forEach(function(x){x.remove();});
  document.querySelectorAll('table').forEach(function(t){
    var head=t.querySelector('thead tr'); if(!head)return;
    var remove=[];
    Array.prototype.forEach.call(head.children,function(th,idx){
      var label=(th.textContent||'').trim().toLowerCase();
      if(label==='gmp'||label==='gmp%'||label==='est list')remove.push(idx);
    });
    if(!remove.length)return;
    Array.prototype.forEach.call(t.rows,function(row){
      remove.slice().reverse().forEach(function(idx){if(row.children[idx])row.children[idx].remove();});
    });
  });
  document.querySelectorAll('#comp-container .news-item li').forEach(function(li){
    if(/\bgmp\b|grey market/i.test(li.textContent||''))li.remove();
  });
  document.querySelectorAll('#p-select li').forEach(function(li){
    if(/\bgmp\b|grey market/i.test(li.textContent||''))li.remove();
  });
}
function init(){
  hideGmp();
  new MutationObserver(hideGmp).observe(document.body,{childList:true,subtree:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
