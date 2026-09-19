#!/usr/bin/env python3
"""One-shot repair + upgrade for IPO Terminal (applied by workflow).

Idempotent: safe to re-run. Exits non-zero if any expected pattern is missing,
so a failed run is visible instead of silently doing nothing.

What it does:
  index.html
    - ipoCard becomes status-aware: UPCOMING = info only (price band, lot size,
      issue size, GMP, subscription; no buttons), OPEN = adds GMP, GMP% and an
      Est. listing estimate, CLOSED = open/close/band/lot/issue/listing only,
      no buttons
    - rhpButton / allotButton no longer point at removed nav sections
    - renderDocs gets a guard (documents-list section no longer exists)
    - removes the CSS rules that hid the 6th grid box and the stat counters
    - appends tips 17-25 from the Anant Ladha IPO video (Rule of 15 / Rule of 5)
  scripts/ipo-detection.js
    - research-knowledge cards APPEND to the tips list instead of replacing it
  scripts/broker_health.py
    - pricing_url is inserted before the closing brace instead of stripping the
      array-element comma (this is what mangled the BROKERS array and killed the
      page on 18-19 Sep 2026)
  scripts/ipo-analyst.js
    - fixes the broken ternary in n() and rebuilds e() cleanly
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FAILED = []


def line_starts_with(path, prefix, new, name):
    src = open(path, encoding='utf-8').read()
    lines = src.split('\n')
    for i, ln in enumerate(lines):
        if ln.startswith(prefix):
            if ln == new:
                print('skip (already applied):', name)
                return
            lines[i] = new
            open(path, 'w', encoding='utf-8').write('\n'.join(lines))
            print('patched:', name)
            return
    if new[:60] in src:
        print('skip (marker found):', name)
        return
    FAILED.append(name)


def swap(path, old, new, name):
    src = open(path, encoding='utf-8').read()
    if old in src:
        open(path, 'w', encoding='utf-8').write(src.replace(old, new, 1))
        print('patched:', name)
    elif new in src:
        print('skip (already applied):', name)
    else:
        FAILED.append(name)


def drop(path, chunk, name):
    src = open(path, encoding='utf-8').read()
    if chunk in src:
        open(path, 'w', encoding='utf-8').write(src.replace(chunk, '', 1))
        print('removed:', name)
    else:
        print('skip (not present):', name)


# ---------------------------------------------------------------- index.html
IDX = os.path.join(ROOT, 'index.html')

NEW_IPO_CARD = """function ipoCard(x,s){const g=findGmp(x.name),sub=findSub(x.name),up=s==='UPCOMING',closed=s==='CLOSED';const gv=gmpRupees(x),lo=bandLow(x);const pctRaw=gmpPctOf(x);const pctTxt=(pctRaw==null||pctRaw==='—')?'—':pctRaw+'%';const mny=v=>Number.isFinite(v)?('₹'+Math.round(v).toLocaleString('en-IN')):'—';const gmpTxt=(gv!=null?mny(gv):'—');const est=(gv!=null&&lo!=null)?mny(lo+gv):'—';let boxes;if(closed){boxes=`<div class="box">Open<b>${date(x.open_date)}</b></div><div class="box">Close<b>${date(x.close_date)}</b></div><div class="box">Price band<b>${esc(x.price_band||'—')}</b></div><div class="box">Lot size<b>${esc(x.lot_size||'—')}</b></div><div class="box">Issue size<b>${esc(x.issue_size||'—')}</b></div><div class="box">Listing<b>${date(x.listing_date)}</b></div>`}else if(up){boxes=`<div class="box">Open<b>${date(x.open_date)}</b></div><div class="box">Close<b>${date(x.close_date)}</b></div><div class="box">Price band<b>${esc(x.price_band||'—')}</b></div><div class="box">Lot size<b>${esc(x.lot_size||'—')}</b></div><div class="box">Issue size<b>${esc(x.issue_size||'—')}</b></div><div class="box">GMP<b>${gmpTxt} (${esc(pctTxt)})</b></div><div class="box">Subscription<b>${esc(sub?.total||x.sub||x.total||'—')}</b></div>`}else{boxes=`<div class="box">Open<b>${date(x.open_date)}</b></div><div class="box">Close<b>${date(x.close_date)}</b></div><div class="box">Price band<b>${esc(x.price_band||'—')}</b></div><div class="box">GMP<b>${gmpTxt}</b></div><div class="box">GMP %<b>${esc(pctTxt)}</b></div><div class="box">Est. listing<b>${est}</b></div><div class="box">Lot size<b>${esc(x.lot_size||'—')}</b></div><div class="box">Issue size<b>${esc(x.issue_size||'—')}</b></div><div class="box">Subscription<b>${esc(sub?.total||x.sub||x.total||'—')}</b></div>`}const actions=(!up&&!closed)?(gmpButton(x)+rhpButton(x)+allotButton(x)):'';return `<article class="card glass"><div class="name">${esc(x.name)}</div><div class="meta"><span class="badge ${s.toLowerCase()}">${s}</span><span>${esc(x.board||'—')}</span><span>${esc(x.exchange||'—')}</span></div><div class="grid">${boxes}</div>${actions?`<div class="actions">${actions}</div>`:''}</article>`}"""

NEW_RHP = """function rhpButton(x){const L=findLink(x.name);const d=state.drhp.find(y=>String(y.name||'').toLowerCase().includes(String(x.name||'').toLowerCase().split(' ')[0])&&String(y.name||'').toLowerCase().includes('rhp'));const url=L?.rhp_url||(d?(d.source_url||d.sebi_link):'');return url?`<a class="link" href="${esc(url)}" target="_blank" rel="noopener">📋 RHP / DRHP</a>`:''}"""

NEW_ALLOT = """function allotButton(x){const L=findLink(x.name);return L?.allotment_url?`<a class="link" href="${esc(L.allotment_url)}" target="_blank" rel="noopener">🎯 Allotment Link</a>`:`<a class="link ghost" href="#section-allotment" onclick="var s=document.getElementById('section-allotment');if(s){s.classList.add('opened')}return false">🎯 Allotment Link</a>`}"""

line_starts_with(IDX, 'function ipoCard(x,s){', NEW_IPO_CARD, 'ipoCard status-aware cards')
line_starts_with(IDX, 'function rhpButton(x){', NEW_RHP, 'rhpButton without dead fallback')
line_starts_with(IDX, 'function allotButton(x){', NEW_ALLOT, 'allotButton opens real section')

src = open(IDX, encoding='utf-8').read()
if "function renderDocs(){document.getElementById('documents-list').innerHTML" in src:
    i = src.find("function renderDocs(){document.getElementById('documents-list').innerHTML")
    j = src.find('\n', i)
    old_fn = src[i:j]
    new_fn = "function renderDocs(){const el=document.getElementById('documents-list');if(!el)return;el.innerHTML" + old_fn[len("function renderDocs(){document.getElementById('documents-list').innerHTML"):]
    src = src.replace(old_fn, new_fn, 1)
    open(IDX, 'w', encoding='utf-8').write(src)
    print('patched: renderDocs guard')
elif "function renderDocs(){const el=document.getElementById('documents-list')" in src:
    print('skip: renderDocs guard')
else:
    FAILED.append('renderDocs guard')

drop(IDX, '#section-open .grid .box:nth-child(6),#section-upcoming .grid .box:nth-child(6){display:none!important}\n', '6th-box CSS hack')
drop(IDX, '#section-open .actions .link:nth-child(2),#section-open .actions .link:last-child{display:none!important}\n', 'action-button CSS hack')
drop(IDX, '.stats{display:none!important}\n', 'hidden stats CSS')

TIPS_ADD = """
<div class="card glass"><b>17 — Sell on listing, don't marry the IPO (Anant Ladha)</b><p>Across 2000–2023, buy-and-hold of every mainboard IPO lost money in roughly 30–35% of years, while a disciplined listing-day exit failed in only about 1 year out of 22. Book the profit and churn the money into the next good issue. (Source: the IPO podcast at youtube.com/watch?v=W4VmJ8UaUjE)</p></div>
<div class="card glass"><b>18 — Rule of 15 on listing day (2026 update)</b><p>Average IPO (5–15% expected pop): sell in the pre-open session (9:45–10:00 AM) and don't overthink the price. Strong IPO (25%+): place the stop-loss at the LOW of the FIRST 5 MINUTES after listing (10:00–10:05) and trail it upward; exit by the CLOSE of DAY 2 — day 3 increasingly opens in lower circuit because everyone knows the old day-3 rule. GMP above 50% and feeling uneasy? Just book in pre-open.</p></div>
<div class="card glass"><b>19 — Rule of 5 for SME listings</b><p>A good SME IPO usually lists ~90% up and then rides 5% circuits. Days 1–2: don't sell into the circuit. Day 3: if it trades ABOVE the day's average traded price, hold — it mostly closes back at upper circuit. By day 5 book at least 50% and trail the rest with a ~10% stop; trading below the average traded price on day 3–4, exit fully. Defensive: with 2–3 lots, bank 1–2 lots on day 1 itself.</p></div>
<div class="card glass"><b>20 — One PAN, one application — no exceptions</b><p>Two applications from the same PAN (even from different brokers, or one retail + one HNI) get BOTH rejected — lakhs of applications were thrown out in recent big IPOs for exactly this. Route the money correctly too: father's application from father's bank/UPI, wife's from hers — a shared bank account across different applicants' names is a rejection risk.</p></div>
<div class="card glass"><b>21 — Oversubscribed? Only the minimum counts</b><p>Once a category is oversubscribed, only the base amount is considered: retail ≈ 1 lot (~₹15k), small HNI ≈ ₹2L, big HNI ≈ ₹10L. Bidding 5 lots in retail does nothing extra. The winning move is one minimum application per family member — spouse, parents, adult children, HUF, even your company — each with their own demat and bank.</p></div>
<div class="card glass"><b>22 — Category odds — the hidden math</b><p>Rough allotment odds: retail 10x oversubscribed → about 1 in 10 applicants wins a lot. Small HNI typically runs ~4x the retail number → about 1 in 40. Big HNI ≈ its subscription ÷ 5 (at 50x, about 1 in 10 — and a win is worth ~₹2L of stock). Best odds: big HNI, then retail. Small HNI is the worst bucket — avoid it.</p></div>
<div class="card glass"><b>23 — Where your ₹10 lakh actually goes</b><p>With ₹10L+: one big-HNI application (₹10L) captures the best odds, and any balance becomes 1-lot retail applications in other names. Surplus retail money is better spent on the NEXT good IPO's retail book than on small HNI. And if an issue isn't oversubscribed by the final day, it usually wasn't worth applying to at all.</p></div>
<div class="card glass"><b>24 — The 10-minute selection checklist</b><p>1) GMP above 25% — over the last 5 years barely 2–3 of 400–500 such IPOs listed at a loss. 2) Anchor book: paste it into any AI and ask "How is the anchor book? Split between Indian mutual funds and international funds?" — you want many domestic MF schemes plus marquee foreign names. 3) Search "promoter fraud / GST / income-tax cases pending". 4) P/E versus same-size listed peers — an IPO should price ~20% cheaper; distrust profit that appeared just before filing. 5) On the final day after ~1:30 PM, check QIB and big-HNI subscription. For SME add: the lead manager's last 10 IPOs' listing performance.</p></div>
<div class="card glass"><b>25 — SME quality check</b><p>A genuinely good SME company is one whose stated plan is to migrate to the mainboard within ~3 years — you can see it in the financials, industry and growth. If that trajectory isn't visible, treat the stock as a listing-day trade only, however pretty the profit looks.</p></div>
</div></section>"""
MARKER = '</div></section>\n<section id="section-glossary"'
src = open(IDX, encoding='utf-8').read()
if 'Rule of 15 on listing day' in src:
    print('skip: tips 17-25')
elif MARKER in src:
    src = src.replace(MARKER, TIPS_ADD + '\n<section id="section-glossary"', 1)
    open(IDX, 'w', encoding='utf-8').write(src)
    print('patched: tips 17-25')
else:
    FAILED.append('tips 17-25')

# --------------------------------------------------------- ipo-detection.js
DET = os.path.join(ROOT, 'scripts', 'ipo-detection.js')
OLD_TIPS = """ tips.innerHTML=items.map((t,i)=>'<div class="card glass tip-item"><b>'+E((i+1)+' — '+t[0])+'</b><p>'+E(t[1])+'</p><small class="det-source">'+E(t[2])+'</small></div>').join('');"""
NEW_TIPS = """ const base=tips.querySelectorAll('.card').length;
 tips.innerHTML+=items.map((t,i)=>'<div class="card glass tip-item"><b>'+E((base+i+1)+' — '+t[0])+'</b><p>'+E(t[1])+'</p><small class="det-source">'+E(t[2])+'</small></div>').join('');"""
swap(DET, OLD_TIPS, NEW_TIPS, 'detection tips append instead of replace')

# ----------------------------------------------------------- broker_health.py
BH = os.path.join(ROOT, 'scripts', 'broker_health.py')
OLD_BH = """        if "pricing_url:" not in obj:
            obj = obj[:-1] + ",pricing_url:'" + r.get("pricing_url", r["home"]) + "'}"
"""
NEW_BH = """        if "pricing_url:" not in obj:
            # Insert BEFORE the object's closing brace instead of stripping the
            # last character (which is the array-element comma, not '}').
            url = r.get("pricing_url") or r["home"]
            cut = obj.rfind("}")
            if cut >= 0:
                obj = obj[:cut] + ",pricing_url:'" + url + "'}" + obj[cut + 1:]
"""
swap(BH, OLD_BH, NEW_BH, 'broker_health pricing_url insertion')

# ------------------------------------------------------------- ipo-analyst.js
AN = os.path.join(ROOT, 'scripts', 'ipo-analyst.js')
NEW_E = 'function e(v){return String(v==null?"":v).replace(/[&<>"\']/g,function(x){return x==="&"?"&"+"amp;":x==="<"?"&"+"lt;":x==="<"?"&"+"gt;":x==="<"?"&"+"quot;":"&"+"#39;";});}'
NEW_N = "function n(v){var m=String(v==null?'':v).replace(/,/g,'').match(/-?\\d+(?:\\.\\d+)?/);return m?parseFloat(m[0]):null;}"
line_starts_with(AN, 'function e(v){', NEW_E, 'analyst e() escape')
line_starts_with(AN, 'function n(v){', NEW_N, 'analyst n() number parse')
swap(AN, "String(v==null?'')", "String(v==null?'':v)", 'analyst ternary')

# --------------------------------------------------------------------- done
if FAILED:
    print('FAILED patches:', FAILED)
    sys.exit(1)
print('all patches applied cleanly')
