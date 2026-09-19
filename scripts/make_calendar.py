#!/usr/bin/env python3
"""Generate data/ipo-calendar.ics - all known IPO dates as calendar events.

Reads data/ipo-data.json (open / close / listing dates, dd/mm/yy) and writes
a standard iCalendar file. Runs daily from GitHub Actions; commits if changed.
All-day events so phone calendars show them natively.
"""
import datetime as dt
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'data', 'ipo-data.json')
OUT = os.path.join(ROOT, 'data', 'ipo-calendar.ics')

now = dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')


def esc(s):
    return (str(s).replace('\\', '\\\\').replace(';', r'\;')
            .replace(',', r'\,').replace('\n', r'\n'))


def dmy(v):
    """'17/09/26' -> date (or None)."""
    try:
        p = [int(x) for x in str(v).strip().split('/')]
        if len(p) == 3:
            return dt.date(2000 + p[2] if p[2] < 100 else p[2], p[1], p[0])
    except (ValueError, IndexError):
        pass
    return None


def main():
    with open(SRC, encoding='utf-8') as f:
        ipos = json.load(f).get('ipos', [])

    today = dt.date.today()
    events = []
    for x in ipos:
        name = x.get('name')
        if not name:
            continue
        short = name.replace(' Limited', '')
        for field, label, desc in (
                ('open', 'opens', 'Apply day 1-2, 1 lot at cut-off, via UPI.'),
                ('close', 'closes', 'LAST day. Never wait for the evening - UPI mandates fail late.'),
                ('listing', 'lists', 'Listing day: Rule of 15 (mainboard) / Rule of 5 (SME).')):
            d = dmy(x.get(field))
            if not d or d < today - dt.timedelta(days=10):
                continue
            events.append((d, '%s IPO %s' % (short, label), desc))

    events.sort(key=lambda e: e[0])
    lines = ['BEGIN:VCALENDAR', 'VERSION:2.0',
             'PRODID:-//IPO Terminal//IPO Calendar//EN', 'CALSCALE:GREGORIAN']
    for i, (d, summary, desc) in enumerate(events, 1):
        lines += ['BEGIN:VEVENT',
                  'UID:ipo-%s-%d@ipo-terminal' % (d.strftime('%Y%m%d'), i),
                  'DTSTAMP:' + now,
                  'DTSTART;VALUE=DATE:' + d.strftime('%Y%m%d'),
                  'DTEND;VALUE=DATE:' + (d + dt.timedelta(days=1)).strftime('%Y%m%d'),
                  'SUMMARY:' + esc(summary),
                  'DESCRIPTION:' + esc(desc),
                  'END:VEVENT']
    lines.append('END:VCALENDAR')

    body = '\r\n'.join(lines) + '\r\n'
    if os.path.exists(OUT) and open(OUT, encoding='utf-8').read() == body:
        print('calendar unchanged (%d events)' % len(events))
        return
    with open(OUT, 'w', encoding='utf-8', newline='') as f:
        f.write(body)
    print('wrote ipo-calendar.ics with %d events' % len(events))


if __name__ == '__main__':
    main()
