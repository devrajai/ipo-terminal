#!/usr/bin/env python3
"""One-shot beginner upgrade for IPO Terminal (applied by workflow).

Idempotent. Exits non-zero if any insertion point is missing.

  index.html
    - adds the IPO Coach script tag (scripts/ipo-coach.js)
    - appends Tips 26-28: step-by-step playbooks (select a better IPO,
      maximise allotment chances, zero to your first application)
    - prepends beginner glossary entries (PAN, demat, UPI mandate, cut-off,
      lot, retail/NII/QIB, oversubscription, GMP, kostak, anchor book, ...)
"""
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IDX = os.path.join(ROOT, 'index.html')
FAILED = []

TIPS_ADD = """
<div class="card glass"><b>26 — Playbook: pick the better IPO in 10 minutes</b><p>Step 1: GMP above 25% — over the last 5 years barely 2–3 of 400–500 such IPOs listed at a loss. Step 2: paste the anchor book into any AI and ask "How is the anchor book? Split between Indian mutual funds and international funds?" — you want many domestic MF schemes plus marquee foreign names. Step 3: search "<promoter name> fraud / GST / income-tax cases pending". Step 4: compare P/E with same-size listed peers — an IPO should price ~20% cheaper, and distrust profit that appeared just before filing. Step 5: on the final day after ~1:30 PM check QIB and big-HNI subscription. For SME add step 6: the lead manager's last 10 IPOs' listing performance.</p></div>
<div class="card glass"><b>27 — Playbook: actually get an allotment</b><p>1) One PAN = one application — a second application from the same PAN (different broker, or retail + HNI) gets BOTH rejected. 2) Each family member applies from their own demat AND own bank/UPI — shared bank accounts get flagged. 3) In an oversubscribed category only the minimum counts, so bid one lot per name — never 3–5 lots from one PAN. 4) Build the name list: self, spouse, parents, adult children, HUF, even your company. 5) Category odds: retail ~1 in 10 at 10x, small HNI ~1 in 40 (avoid), big HNI ≈ subscription ÷ 5. 6) With ₹10L+: one big-HNI application (₹10L) and the rest as 1-lot retail names. 7) Apply day 1–2 at cut-off price — never the last evening, when UPI mandates fail most.</p></div>
<div class="card glass"><b>28 — Playbook: zero to your first application</b><p>1) Open a demat account with any broker (see the Brokers tab). 2) Set your UPI mandate limit (₹2–5L) in your UPI app — that is how application money gets blocked. 3) Pick an IPO from the Coach / Decision sections (green badge first). 4) Apply on day 1–2: select investor type "Individual/Retail", quantity = 1 lot, price = cut-off, pay via UPI. 5) Money stays in your bank — it is blocked only if you win. 6) Check allotment on CDSL / NSDL / your broker app the evening before listing. 7) Listing day: mainboard → Rule of 15 (Tip 18), SME → Rule of 5 (Tip 19). Book the profit and move to the next IPO — do not marry it.</p></div>
</div></section>"""

GLOSSARY_ADD = """<div class="card glass"><b>PAN</b><div class="detail">Permanent Account Number — your tax ID. One PAN can file only ONE application per IPO, no matter how many demat accounts or brokers you use. A second application gets both rejected.</div></div>
<div class="card glass"><b>Demat account</b><div class="detail">Where your shares live electronically. You need one with any broker (Zerodha, Groww, Angel…) before you can apply to an IPO. Family members can each have their own — and each own application raises the family's total chances.</div></div>
<div class="card glass"><b>UPI mandate (ASBA)</b><div class="detail">When you apply, the application amount is "blocked" in your bank via UPI — it still earns interest but you cannot spend it. It is debited only if you get an allotment, and released the day after. Set your UPI app's IPO mandate limit to ₹2–5L so large applications don't fail.</div></div>
<div class="card glass"><b>Cut-off price</b><div class="detail">The "bid at cut-off" option means "I agree to pay whatever final price is discovered". Always bid at cut-off — you never lose an allotment for bidding marginally low this way.</div></div>
<div class="card glass"><b>Lot / lot size</b><div class="detail">IPOs are sold in baskets, not single shares. Lot size × price band = cost of one lot. Retail can apply for minimum 1 lot; SME requires at least 2 lots. More lots in the same category do NOT improve your odds once oversubscribed.</div></div>
<div class="card glass"><b>Retail investor</b><div class="detail">Applications below ₹2 lakh. Everyone in retail is treated as one minimum lot in the lottery, which is why spreading 1-lot applications across family members beats one big application.</div></div>
<div class="card glass"><b>NII / HNI</b><div class="detail">Non-Institutional Investors — applications between ₹2L and ₹10L are "small HNI" (worst allotment odds, avoid), above ₹10L is "big HNI" (best odds: subscription ÷ 5, and a win is ~₹2L of stock).</div></div>
<div class="card glass"><b>QIB</b><div class="detail">Qualified Institutional Buyers — mutual funds, insurers, foreign funds. QIB filling on the last day (not day 1) means they are riding retail frenzy, not conviction. A strong QIB book is the best quality signal.</div></div>
<div class="card glass"><b>Oversubscription</b><div class="detail">When total bids exceed the shares on offer. Retail 10x → about 1 in 10 applicants wins one lot. Once a category is oversubscribed, only the minimum application counts for the draw.</div></div>
<div class="card glass"><b>Allotment</b><div class="detail">The lottery result — who actually gets shares. Check it on CDSL (myeasi), NSDL, the BSE/NSE website, or your broker app, usually the evening before listing.</div></div>
<div class="card glass"><b>Listing gain</b><div class="detail">The difference between the issue price and the first traded price on listing day. IPO investors mostly play for this: book it per Rule of 15 (mainboard) or Rule of 5 (SME) instead of holding forever.</div></div>
<div class="card glass"><b>GMP — Grey Market Premium</b><div class="detail">The unofficial price traders pay for an IPO allotment before listing. GMP of ₹148 on a ₹1,700 issue hints at a ₹1,848 listing. A thermometer of mood, not a guarantee — above 25% has historically been the strong zone.</div></div>
<div class="card glass"><b>Kostak rate</b><div class="detail">The grey-market price for one full retail application before allotment. Kostak ₹12,000 means someone will pay you ₹12,000 today for your (possible) allotment — an alternative way to lock listing-day profit.</div></div>
<div class="card glass"><b>Anchor book</b><div class="detail">The portion allocated to institutions one day before the IPO opens. Who is in it (many Indian MF schemes, big foreign funds) is the single fastest quality check before applying.</div></div>
<div class="card glass"><b>Lead manager</b><div class="detail">The merchant banker running the IPO. Their last 10 IPOs' listing performance tells you how well the issue is likely to be priced and managed — critical for SME IPOs.</div></div>
<div class="card glass"><b>Circuit / circuit filter</b><div class="detail">The daily price limit — 5% for SME stocks, 20% for mainboard. A good SME IPO often locks in upper circuits for days, which is the basis of the Rule of 5 exit.</div></div>
<div class="card glass"><b>Pre-open session</b><div class="detail">9:45–10:00 AM on listing day, when the opening price is discovered. Selling here (at the discovered open) is the recommended exit for average IPOs in the Rule of 15.</div></div>
<div class="card glass"><b>Stop-loss / trailing stop</b><div class="detail">A pre-decided exit price that caps your loss. A trailing stop rises as the price rises — e.g. the low of the first 5 minutes after listing, moved up as the stock climbs (Tip 18).</div></div>
"""


def patch(path, marker, insert, name, before=True):
    src = open(path, encoding='utf-8').read()
    if marker not in src:
        FAILED.append(name + ' (marker missing)')
        return
    probe = insert[:60]
    if probe and probe in src:
        print('skip (already applied):', name)
        return
    if before:
        src = src.replace(marker, insert + marker, 1)
    else:
        src = src.replace(marker, marker + insert, 1)
    open(path, 'w', encoding='utf-8').write(src)
    print('patched:', name)


def main():
    # 1) coach script tag
    src = open(IDX, encoding='utf-8').read()
    tag = '<script src="scripts/ipo-coach.js"></script>'
    if tag in src:
        print('skip: coach script tag')
    elif '</body>' in src:
        src = src.replace('</body>', tag + '\n</body>', 1)
        open(IDX, 'w', encoding='utf-8').write(src)
        print('patched: coach script tag')
    else:
        FAILED.append('coach script tag')

    # 2) tips 26-28 (inside the tips section: consume its closing tag and re-emit
    #    it after the new cards - same approach as tips 17-25 in apply-sarvam-fixes)
    src = open(IDX, encoding='utf-8').read()
    marker = '</div></section>\n<section id="section-glossary"'
    if 'Playbook: pick the better IPO in 10 minutes' in src:
        print('skip: tips 26-28 playbooks')
    elif marker in src:
        src = src.replace(marker, TIPS_ADD + '\n<section id="section-glossary"', 1)
        open(IDX, 'w', encoding='utf-8').write(src)
        print('patched: tips 26-28 playbooks')
    else:
        FAILED.append('tips 26-28 (marker missing)')

    # 3) glossary beginner entries (right after the glossary content div opens)
    patch(IDX, '<div class="content glossary">\n', GLOSSARY_ADD, 'beginner glossary entries', before=False)

    if FAILED:
        print('FAILED:', FAILED)
        sys.exit(1)
    print('beginner upgrade applied cleanly')


if __name__ == '__main__':
    main()
