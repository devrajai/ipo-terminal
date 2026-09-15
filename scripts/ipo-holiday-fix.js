/* IPO Terminal holiday banner fix. Uses IST and never leaves a past holiday labelled as upcoming. */
(function(){
'use strict';

var HOLIDAYS_2026=[
  ['2026-01-15','Municipal Corporation Election in Maharashtra'],
  ['2026-01-26','Republic Day'],
  ['2026-02-19','Chhatrapati Shivaji Maharaj Jayanti'],
  ['2026-03-03','Holi'],
  ['2026-03-19','Gudhi Padwa'],
  ['2026-03-26','Ram Navami'],
  ['2026-03-31','Mahavir Jayanti'],
  ['2026-04-01','Annual Bank Closing'],
  ['2026-04-03','Good Friday'],
  ['2026-04-14','Dr. Babasaheb Ambedkar Jayanti'],
  ['2026-05-01','Maharashtra Day / Buddha Pournima'],
  ['2026-05-28','Bakri Id'],
  ['2026-06-26','Muharram'],
  ['2026-08-26','Id-E-Milad'],
  ['2026-09-14','Ganesh Chaturthi'],
  ['2026-10-02','Mahatma Gandhi Jayanti'],
  ['2026-10-20','Dussehra'],
  ['2026-11-10','Diwali-Balipratipada'],
  ['2026-11-24','Guru Nanak Jayanti'],
  ['2026-12-25','Christmas']
];

function istToday(){
  var p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  var o={};p.forEach(function(x){if(x.type!=='literal')o[x.type]=x.value;});
  return o.year+'-'+o.month+'-'+o.day;
}
function pretty(iso){
  var d=new Date(iso+'T00:00:00+05:30');
  return d.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Kolkata'});
}
function nextHoliday(today){
  for(var i=0;i<HOLIDAYS_2026.length;i++)if(HOLIDAYS_2026[i][0]>today)return HOLIDAYS_2026[i];
  return null;
}
function currentHoliday(today){
  for(var i=0;i<HOLIDAYS_2026.length;i++)if(HOLIDAYS_2026[i][0]===today)return HOLIDAYS_2026[i];
  return null;
}
function findBanner(){
  var nodes=document.querySelectorAll('div,section,article,aside,p');
  var best=null,bestLen=Infinity;
  for(var i=0;i<nodes.length;i++){
    var t=(nodes[i].innerText||'').replace(/\s+/g,' ').trim();
    if(!/Upcoming Holiday/i.test(t))continue;
    if(t.length<bestLen){best=nodes[i];bestLen=t.length;}
  }
  return best;
}
function paint(){
  var today=istToday(),banner=findBanner();
  if(!banner)return;
  var t=(banner.innerText||'').replace(/\s+/g,' ').trim();
  var match=t.match(/(\d{1,2})\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(20\d{2})/i);
  var month={january:'01',february:'02',march:'03',april:'04',may:'05',june:'06',july:'07',august:'08',september:'09',october:'10',november:'11',december:'12'};
  var shown=match?match[3]+'-'+month[match[2].toLowerCase()]+'-'+String(match[1]).padStart(2,'0'):null;
  var next=nextHoliday(today), current=currentHoliday(today);

  /* Current holiday: say TODAY, never UPCOMING. */
  if(current){
    banner.innerHTML='<div style="color:var(--or);font-weight:800">Market Holiday Today – '+current[1]+' '+pretty(current[0])+'</div>';
    return;
  }

  /* Past holiday: replace it with the next real holiday instead of leaving stale text. */
  if(shown && shown<today){
    if(next){
      banner.innerHTML='<div style="color:var(--or);font-weight:800">Upcoming Holiday – '+next[1]+' '+pretty(next[0])+'</div>';
    }else{
      banner.remove();
    }
  }
}
function init(){
  paint();
  /* Existing market-status code can rebuild the banner. Keep it corrected. */
  var obs=new MutationObserver(function(){paint();});
  obs.observe(document.body,{childList:true,subtree:true,characterData:true});
  setInterval(paint,60000);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',function(){setTimeout(init,300);});else setTimeout(init,300);
})();
