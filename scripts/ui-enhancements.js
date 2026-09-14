/* IPO Terminal UI enhancements + core rendering fixes */
(function(){
  'use strict';
  var VIDEO='https://youtu.be/W4VmJ8UaUjE?si=coCXusbuLIifWw0o';
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(x){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x];});}
  function gmpTime(v){var d=new Date(v);return isNaN(d.getTime())?'':d.toLocaleString('en-IN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:true,timeZone:'Asia/Kolkata'})+' IST';}
  function gmpCell(i){
    var g=String(i.gmp==null?'—':i.gmp), pct=String(i.gmp_pct==null?'—':i.gmp_pct);
    var cls=pct.indexOf('+')>=0?'gn':(pct.indexOf('-')>=0?'rd':'tx3');
    var meta=i.gmp_updated_at?'<br><span class="tx3" style="font-size:8px">LIVE · '+esc(i.gmp_source||'GMP source')+(gmpTime(i.gmp_updated_at)?' · '+esc(gmpTime(i.gmp_updated_at)):'')+'</span>':'<br><span class="tx3" style="font-size:8px">No live quote</span>';
    return '<td class="'+cls+'"><b>'+esc(g)+'</b>'+meta+'</td><td class="'+cls+'">'+esc(pct)+'</td>';
  }
  function overrideRenderTable(){
    if(typeof window.renderTable!=='function')return;
    window.renderTable=function(containerId,ipos,showSub,showScore){
      var c=document.getElementById(containerId);if(!c)return;
      if(!ipos||!ipos.length){c.innerHTML='<div style="padding:12px;text-align:center;color:var(--tx3)">No IPOs in this category</div>';return;}
      var h='<div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>IPO</th><th>Type</th><th>Price</th><th>Lot</th><th>Size</th><th>Open</th><th>Close</th>';
      if(showSub)h+='<th>Sub</th>';
      h+='<th>GMP</th><th>GMP%</th><th>Est List</th>'+(showScore?'<th>Score</th><th>Verdict</th>':'')+'</tr></thead><tbody>';
      ipos.forEach(function(i){
        var pct=String(i.gmp_pct||''),arrow=pct.indexOf('+')>=0?'▲':(pct.indexOf('-')>=0?'▼':'—');
        var sc=typeof autoScore==='function'?autoScore(i):{score:0,verdict:'—'};
        var scC=sc.score>=75?'gn':(sc.score>=65?'yl':'rd');
        var vc=(sc.verdict==='APPLY'||String(sc.verdict).indexOf('STRONG')>=0)?'gn':(sc.verdict==='SELECTIVE'?'yl':'rd');
        var tc=i.type==='Mainboard'?'mb':(String(i.type||'').indexOf('SME')>=0?'sme':'fut');
        h+='<tr><td><b>'+esc(i.name)+'</b><br><span class="tx3" style="font-size:9px">'+esc(i.sector||'—')+'</span></td><td><span class="badge '+tc+'">'+esc(i.type||'—')+'</span></td><td>'+esc(i.price||'—')+'</td><td>'+esc(i.lot||'—')+'</td><td>'+esc(i.size||'—')+'</td><td>'+esc(i.open||'—')+'</td><td>'+esc(i.close||'—')+'</td>';
        if(showSub)h+='<td><b>'+esc(i.sub||'—')+'</b></td>';
        var gc=gmpCell(i);gc=gc.replace('<b>'+esc(i.gmp==null?'—':i.gmp)+'</b>','<b>'+arrow+' '+esc(i.gmp==null?'—':i.gmp)+'</b>');h+=gc;
        h+='<td class="gn">'+esc(i.est_list||'—')+'</td>';
        if(showScore)h+='<td class="'+scC+'" style="font-weight:700">'+sc.score+'/100</td><td class="'+vc+'" style="font-weight:700">'+esc(sc.verdict)+'</td>';
        h+='</tr>';
      });
      h+='</tbody></table></div>';c.innerHTML=h;
    };
  }
  function renderComparison(){
    var c=document.getElementById('comp-container');if(!c||typeof ALL_IPOS==='undefined')return;
    var ipos=ALL_IPOS.filter(function(i){return i&&i.name;});
    if(!ipos.length){c.innerHTML='<div style="padding:12px;text-align:center;color:var(--tx3)">Comparison data is temporarily unavailable. It will populate automatically when source data is available.</div>';return;}
    var h='<div style="padding:8px;font-size:11px;color:var(--tx3)">Automatic side-by-side comparison. Missing fundamentals are shown as —. GMP is unofficial and shown with source/time when available.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>IPO</th><th>Type</th><th>Price</th><th>Size</th><th>Fresh</th><th>OFS</th><th>P/E</th><th>ROE</th><th>ROCE</th><th>Rev</th><th>PAT</th><th>EBITDA</th><th>D/E</th><th>Growth</th><th>Prom</th><th>GMP</th><th>GMP%</th><th>Score</th><th>Verdict</th></tr></thead><tbody>';
    ipos.slice(0,100).forEach(function(i){
      var sc=typeof autoScore==='function'?autoScore(i):{score:0,verdict:'—'};
      var scC=sc.score>=75?'gn':(sc.score>=65?'yl':'rd'),vc=(sc.verdict==='APPLY'||String(sc.verdict).indexOf('STRONG')>=0)?'gn':(sc.verdict==='SELECTIVE'?'yl':'rd');
      var roe=parseFloat(String(i.roe||'').replace(/[^0-9.]/g,''))||0,rc=roe>=15?'gn':(roe>=10?'yl':'rd');
      var de=parseFloat(i.de)||0,dc=de<=.2?'gn':(de<=.5?'yl':'rd');
      var tc=i.type==='Mainboard'?'mb':(String(i.type||'').indexOf('SME')>=0?'sme':'fut');
      h+='<tr><td><b>'+esc(i.name)+'</b></td><td><span class="badge '+tc+'">'+esc(i.type||'—')+'</span></td><td>'+esc(i.price||'—')+'</td><td>'+esc(i.size||'—')+'</td><td>'+esc(i.fresh||'—')+'</td><td>'+esc(i.ofs||'—')+'</td><td>'+esc(i.pe||'—')+'</td><td class="'+rc+'">'+esc(i.roe||'—')+'</td><td class="'+rc+'">'+esc(i.roce||'—')+'</td><td>'+esc(i.rev||'—')+'</td><td>'+esc(i.pat||'—')+'</td><td>'+esc(i.ebitda||'—')+'</td><td class="'+dc+'">'+esc(i.de||'—')+'</td><td>'+esc(i.growth||'—')+'</td><td>'+esc(i.prom||'—')+'</td><td class="gn"><b>'+esc(i.gmp||'—')+'</b>'+(i.gmp_updated_at?'<br><span class="tx3" style="font-size:8px">'+esc(i.gmp_source||'GMP')+' · '+esc(gmpTime(i.gmp_updated_at))+'</span>':'')+'</td><td>'+esc(i.gmp_pct||'—')+'</td><td class="'+scC+'" style="font-weight:700">'+sc.score+'/100</td><td class="'+vc+'" style="font-weight:700">'+esc(sc.verdict)+'</td></tr>';
    });
    h+='</tbody></table></div>';c.innerHTML=h;
  }
  function renderDRHP(){
    var c=document.getElementById('pipe-container');if(!c)return;
    var docs=Array.isArray(window.RHP_LINKS)?RHP_LINKS.filter(function(d){return /DRHP/i.test(String(d.type||''));}):[];
    var map={};docs.forEach(function(d){map[String(d.name||'').toLowerCase()]=d;});
    var rows=[];
    if(Array.isArray(window.ALL_IPOS))ALL_IPOS.forEach(function(i){if(i&&i.name&&(i.status==='future'||(!i.open&&!i.close)))rows.push(i);});
    docs.forEach(function(d){if(!rows.some(function(i){return String(i.name||'').toLowerCase()===String(d.name||'').toLowerCase();}))rows.push({name:d.name,type:'Future Pipeline',sector:'—',size:'—',price:'—',open:'TBA',drhp:true});});
    if(!rows.length){c.innerHTML='<div style="padding:12px;text-align:center;color:var(--tx3)">No DRHP filings are available yet. The automatic filing collector will add them when source data is available.</div>';return;}
    var h='<div style="padding:8px;font-size:11px;color:var(--tx3)"><b>DRHP Filed</b> is based on filing records, not IPO opening dates. Companies stay here even when price/date details are TBA.</div><div style="overflow-x:auto"><table class="ipo-table"><thead><tr><th>Company</th><th>Filing</th><th>Sector</th><th>Est. Size</th><th>Price</th><th>Expected Open</th><th>Filing Link</th></tr></thead><tbody>';
    rows.forEach(function(i){var d=map[String(i.name||'').toLowerCase()];h+='<tr><td><b>'+esc(i.name)+'</b></td><td><span class="badge fut">'+esc(d?d.type:'DRHP / Filing')+'</span></td><td>'+esc(i.sector||'—')+'</td><td>'+esc(i.size||'—')+'</td><td>'+esc(i.price||'—')+'</td><td>'+esc(i.open||'TBA')+'</td><td>'+(d&&d.url?'<a class="dl-btn" href="'+esc(d.url)+'" target="_blank" rel="noopener">Open Filing →</a>':'<span class="tx3">Awaiting link</span>')+'</td></tr>';});
    h+='</tbody></table></div>';c.innerHTML=h;
  }
  function enhanceRenderAll(){
    if(typeof window.renderAll!=='function')return;
    var original=window.renderAll;
    window.renderAll=function(){original();renderDRHP();renderComparison();};
    window.renderAll();
  }
  function addGmpNotice(){
    var p=document.getElementById('p-open');if(!p||p.querySelector('.gmp-notice'))return;
    var n=document.createElement('div');n.className='gmp-notice';n.style.cssText='padding:7px 10px;font-size:10px;color:var(--tx3);border-bottom:1px solid var(--bd)';n.innerHTML='<b style="color:var(--gn)">LIVE GMP:</b> automatic multi-source grey-market quote when available · source and IST timestamp shown per IPO · unofficial, not exchange data.';p.insertBefore(n,p.children[1]||null);
  }
  function addHoliday(){var hdr=document.querySelector('.hdr');if(!hdr||document.getElementById('ipo-holiday-line'))return;var d=document.createElement('div');d.id='ipo-holiday-line';d.style.cssText='margin-top:8px;padding:8px 10px;border:1px solid var(--or);border-radius:8px;background:rgba(249,115,22,.10);color:var(--or);font-size:12px;font-weight:700';d.innerHTML='Upcoming Holiday - Ganesh Chaturthi <span style="font-weight:600">14 September 2026</span>';hdr.appendChild(d);}
  function addSelector(){if(document.getElementById('b-select'))return;var box=document.querySelector('.hbtns');if(!box)return;var b=document.createElement('button');b.className='hb';b.id='b-select';b.textContent='How to Select Better IPO';b.onclick=function(){var p=document.getElementById('p-select');if(p)p.classList.toggle('show');b.classList.toggle('active');};box.appendChild(b);if(!document.getElementById('p-select')){var p=document.createElement('div');p.className='panel';p.id='p-select';p.innerHTML='<div class="panel-title">How to Select Better IPO <button class="close-x" onclick="document.getElementById(\'p-select\').classList.remove(\'show\');document.getElementById(\'b-select\').classList.remove(\'active\')">Close</button></div><div class="news-list"><div class="news-item"><b>IPO Selection Checklist</b><ul style="margin:6px 0 0 16px;font-size:11px;line-height:1.8"><li>Compare valuation with listed peers.</li><li>Check multi-year growth and profitability.</li><li>Review debt, fresh issue vs OFS and promoter holding.</li><li>Read DRHP/RHP risk factors.</li><li>Use subscription and GMP only as supporting signals.</li></ul></div><div class="news-item"><iframe src="https://www.youtube.com/embed/W4VmJ8UaUjE" title="How to Select Better IPO" style="width:100%;aspect-ratio:16/9;border:0;border-radius:8px" allowfullscreen></iframe><div style="margin-top:7px"><a href="'+VIDEO+'" target="_blank" rel="noopener" class="dl-btn">Open YouTube Video →</a></div></div></div>';document.body.appendChild(p);}}
  function init(){overrideRenderTable();enhanceRenderAll();renderDRHP();renderComparison();addGmpNotice();addHoliday();addSelector();}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,50);});else setTimeout(init,50);
})();