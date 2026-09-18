/**
 * ============================================================================
 *  INDIA IPO TRACKER - ALL-IN-ONE (single script)  [v3]
 * ============================================================================
 *  Daily auto-update of Open / Upcoming / Closed / Listed tabs + GMP,
 *  FUNDAMENTALS tab (fresh issue %, OFS %, PAT margin, P/E, D/E),
 *  LOT PLANNER tab (budget -> lots, money blocked, gain, odds),
 *  JSON API for the website + self-healing RHP/DRHP/allotment links.
 *
 *  INSTALL: Extensions > Apps Script > delete ALL old code > paste this file
 *  > Save > Run "updateAll" > Run "installAllTriggers" once. Done.
 *
 *  v3 (18 Sep): money figures now require "Rs <number> Cr" directly after
 *  the label (no more wrong numbers from table headers); % capped at 100;
 *  board from "Listing At" + lot value; methodology note kept last.
 * ============================================================================
 */


var CONFIG = {
  SHEET_OPEN: 'Open',
  SHEET_UPCOMING: 'Upcoming',
  SHEET_CLOSED: 'Closed',
  SHEET_LISTED: 'Listed',
  SHEET_GMP: 'GMP Log',
  SHEET_DASH: 'Dashboard',

  // Main sources (server-rendered HTML - verified 2026-09-17)
  SOURCES: [
    'https://www.chittorgarh.com/',                                // Homepage (mainboard + SME tables)
    'https://www.chittorgarh.com/ipo/ipo_dashboard.asp',          // Mainboard dashboard
    'https://www.chittorgarh.com/ipo/ipo_dashboard.asp?a=sme'     // SME dashboard
  ],
  // Performance-tracker pages: every LISTED IPO of the year (fills the Listed tab)
  LISTED_SOURCES: [
    'https://www.chittorgarh.com/ipo/ipo_perf_tracker.asp',
    'https://www.chittorgarh.com/ipo/ipo_perf_tracker.asp?exchange=sme'
  ],
  BASE_URL: 'https://www.chittorgarh.com',

  // Fetch per-IPO detail pages (price band, lot size, GMP, subscription)?
  FETCH_DETAILS: true,
  MAX_DETAIL_FETCHES: 30,

  // An IPO that closed more than this many days ago is assumed listed.
  LISTED_AFTER_DAYS: 14,

  USER_AGENT: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
              '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

// Column order MUST match row 1 of the Open / Upcoming / Closed / Listed tabs.
var COLS = ['name','sector','openDate','closeDate','listingDate','priceLow',
            'priceHigh','lotSize','lotValue','issueSize','rii','qib','nii',
            'overallSub','gmp','estGain','de','roe','revGrowth',
            'listingPrice','actualGain','source','updatedAt','detailUrl'];

var DIAG = []; // per-run diagnostics, written to Dashboard column D

function updateAll() {
  var started = new Date();
  var status = [];
  try {
    var ipos = collectIpos_();                       // scrape + classify
    status.push(ipos.length + ' IPOs found');
    syncSheets_(ipos);                               // upsert / move / archive
    backfillListed_();                              // move listed IPOs to Listed tab
    if (CONFIG.FETCH_DETAILS) fetchDetails_();       // enrich Open tab + GMP log
    status.push('sheets synced');
    ensureAnalysisTabs_();
    collectFundamentals();
    refreshLotPlanner_();
    status.push('fundamentals + planner refreshed');
  } catch (err) {
    status.push('ERROR: ' + err);
  }
  writeRunStatus_(started, status.join(' | '));
}

/** Convenience alias. */
function runNow() { updateAll(); }

/** Creates the daily trigger. Run this once. */
function installTrigger() {
  removeTriggers();
  ScriptApp.newTrigger('updateAll').timeBased()
           .everyDays(1).atHour(8).create();
}

/** Removes all triggers of this project. */
function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
}

/* ============================ SCRAPING ================================== */

/**
 * Fetches the dashboard pages, extracts IPO name + date range + detail link,
 * classifies each IPO by today's date.
 * Returns [{name, open, close, href, board, cat}]
 */
function collectIpos_() {
  var out = [];
  var today = startOfDay_(new Date());
  var seen = {};
  DIAG = [];

  CONFIG.SOURCES.forEach(function (url) {
    var board = /a=sme/i.test(url) ? 'SME' : 'Mainboard';
    var html;
    try {
      html = fetchHtml_(url);
    } catch (e) {
      DIAG.push(board + ' [' + url + '] FETCH FAILED: ' + (e && e.message ? e.message : e));
      return;
    }
    var rows = parseAllRows_(html);
    var found = 0;

    rows.forEach(function (r) {
      try {
        // Find the cell whose link points to an /ipo/ detail page
        var nameCell = null;
        for (var i = 0; i < r.length; i++) {
          if (r[i].href && r[i].href.indexOf('/ipo/') !== -1 &&
              r[i].href.indexOf('ipo_dashboard') === -1) { nameCell = r[i]; break; }
        }
        if (!nameCell) return;

        // Find a date-range text anywhere in the row ("16 - 18 Sep")
        var dateText = '';
        for (var j = 0; j < r.length; j++) {
          if (r[j].text && /\d{1,2}\s*[-\u2013]\s*\d{1,2}\s+[A-Za-z]{3,9}/.test(r[j].text)) {
            dateText = r[j].text; break;
          }
        }
        if (!dateText) return;

        var dates = parseDateRange_(dateText);
        if (!dates) return;

        var rawName = nameCell.text
            .replace(/(\d{1,2}\s*[-\u2013]\s*\d{1,2}\s+[A-Za-z]{3,9}).*$/, ' ')  // date glued to name
            .replace(/&\u0061mp/gi, '&')                 // decode entity
            .replace(/\s+/g, ' ')                    // normalize whitespace
            .replace(/\s*\(?(IPO|FPO)\)?\s*$/i, '')
            .replace(/[\s\u00a0]+(O|P|CT|LT)\s*$/i, '')  // trailing status letters
            .trim();
        if (!rawName || rawName.length < 3 || /^no records/i.test(rawName)) return;

        var key = rawName.toLowerCase();
        if (seen[key]) return;                      // dedupe across boards

        var href = nameCell.href;
        if (href && href.indexOf('http') !== 0) href = CONFIG.BASE_URL + href;

        seen[key] = true;
        out.push({
          name: rawName,
          open: dates.open,
          close: dates.close,
          href: href,
          board: board,
          cat: classify_(dates, today)
        });
        found++;
      } catch (rowErr) {
        // one bad row must never kill the whole run
        log_('Skipped a bad row: ' + rowErr);
      }
    });

    DIAG.push(board + ' [' + url + '] OK: ' + html.length + ' chars, ' +
               rows.length + ' rows scanned, ' + found + ' IPO rows matched');
  });

  if (!out.length) throw new Error('No IPO rows found. ' + DIAG.join(' | '));
  return out;
}

/** open  / close / listed classification from dates. */
function classify_(dates, today) {
  if (today < dates.open) return 'Upcoming';
  if (today <= dates.close) return 'Open';
  var daysSince = (today - dates.close) / 86400000;
  return daysSince <= CONFIG.LISTED_AFTER_DAYS ? 'Closed' : 'Listed';
}

/** GET with full browser headers, cookie bootstrap and retry. */
function fetchHtml_(url) {
  var headers = {
    'User-Agent': CONFIG.USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-IN,en;q=0.9',
    'Referer': 'https://www.google.com/',
    'Cache-Control': 'no-cache',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-User': '?1'
  };

  // Cookie bootstrap: visit the homepage first, carry its cookies forward
  try {
    var home = UrlFetchApp.fetch(CONFIG.BASE_URL + '/', {
      headers: { 'User-Agent': CONFIG.USER_AGENT,
                 'Accept': 'text/html,*/*;q=0.8',
                 'Accept-Language': 'en-IN,en;q=0.9' },
      followRedirects: true, muteHttpExceptions: true
    });
    var sc = home.getAllHeaders()['Set-Cookie'];
    if (sc) {
      var jar = [];
      (Array.isArray(sc) ? sc : [sc]).forEach(function (c) {
        jar.push(String(c).split(';')[0]);
      });
      headers['Cookie'] = jar.join('; ');
    }
  } catch (e) { /* proceed without cookies */ }

  var params = { headers: headers, followRedirects: true, muteHttpExceptions: true };
  var res;
  for (var i = 0; i < 2; i++) {
    res = UrlFetchApp.fetch(url, params);
    var body = res.getContentText();
    if (res.getResponseCode() === 200 && body && body.length > 500) return body;
    Utilities.sleep(2000);
  }
  throw new Error('HTTP ' + res.getResponseCode() + ', body ' + (body ? body.length : 0) + ' chars');
}

/* ------------------------- HTML parsing helpers ------------------------- */

/** Minimal regex-based <table> parser -> [{rows: [[{text, href}]]}] */
function parseHtmlTables_(html) {
  var tables = [];
  var tRe = /<table[^>]*>([\s\S]*?)<\/table>/gi, m;
  while ((m = tRe.exec(html)) !== null) {
    var rows = [];
    var rRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi, r;
    while ((r = rRe.exec(m[1])) !== null) {
      var cells = [];
      var cRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi, c;
      while ((c = cRe.exec(r[1])) !== null) {
        var h = c[2].match(/<a[^>]+href=["']([^"']+)["']/i);
        cells.push({
          text: cleanText_(c[2]),
          href: h ? h[1] : null
        });
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length) tables.push({ rows: rows });
  }
  return tables;
}

/** Scans ALL <tr> rows in the document, ignoring table nesting. */
function parseAllRows_(html) {
  var rows = [];
  var rRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi, r;
  while ((r = rRe.exec(html)) !== null) {
    var cells = [];
    var cRe = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi, c;
    while ((c = cRe.exec(r[1])) !== null) {
      var h = c[2].match(/<a[^>]+href=["']([^"']+)["']/i);
      cells.push({ text: cleanText_(c[2]), href: h ? h[1] : null });
    }
    if (cells.length) rows.push(cells);
  }
  return rows;
}

function cleanText_(s) {
  return s.replace(/<[^>]+>/g, ' ')
          .replace(/&\u006Ebsp;/gi, ' ')
          .replace(/&\u006C/gi, '<').replace(/&\u0067/gi, '>')
          .replace(/&#(\d+);/g, function (_, d) { return String.fromCharCode(d); })
          .replace(/&\u0061mp/gi, '&')
          .replace(/\s+/g, ' ').trim();
}

/** "16 - 18 Sep" / "01-03 Sep" -> {open: Date, close: Date} (year inferred). */
function parseDateRange_(txt) {
  if (!txt) return null;
  var m = txt.match(/(\d{1,2})\s*[-\u2013]\s*(\d{1,2})\s+([A-Za-z]{3,9})/);
  var now = new Date();
  if (m) {
    var month = monthIndex_(m[3]);
    if (month === -1) return null;
    var year = now.getFullYear();
    var close = new Date(year, month, parseInt(m[2], 10));
    // If that close date is far in the past it belongs to next year.
    if (close.getTime() < now.getTime() - 45 * 86400000) {
      year += 1;
      close = new Date(year, month, parseInt(m[2], 10));
    }
    var open = new Date(year, month, parseInt(m[1], 10));
    return { open: open, close: close };
  }
  // Single date fallback: "18 Sep 2026"
  m = txt.match(/(\d{1,2})\s+([A-Za-z]{3,9})\s*(\d{4})?/);
  if (m) {
    var mo = monthIndex_(m[2]);
    if (mo === -1) return null;
    var yr = m[3] ? parseInt(m[3], 10) : now.getFullYear();
    var d = new Date(yr, mo, parseInt(m[1], 10));
    return { open: d, close: d };
  }
  return null;
}

function monthIndex_(s) {
  var months = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  var i = months.indexOf(s.slice(0, 3).toLowerCase());
  return i;
}

function startOfDay_(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }

/* ============================ SHEET SYNC ================================ */

function syncSheets_(ipos) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = {
    Open: ss.getSheetByName(CONFIG.SHEET_OPEN),
    Upcoming: ss.getSheetByName(CONFIG.SHEET_UPCOMING),
    Closed: ss.getSheetByName(CONFIG.SHEET_CLOSED),
    Listed: ss.getSheetByName(CONFIG.SHEET_LISTED)
  };

  // Index existing rows by name -> {sheet, rowIndex, values}
  var index = {};
  Object.keys(sheets).forEach(function (cat) {
    var sh = sheets[cat];
    var last = sh.getLastRow();
    if (last < 2) return;
    var names = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      var n = String(names[i][0]).trim().toLowerCase();
      if (n) index[n] = { sheet: sh, cat: cat, rowIndex: i + 2 };
    }
  });

  var appendCount = {};
  Object.keys(sheets).forEach(function (c) { appendCount[c] = 0; });

  ipos.forEach(function (ipo) {
    var key = ipo.name.toLowerCase();
    var existing = index[key];

    // Fresh data known so far (dates + source + detail link)
    var data = {
      openDate: ipo.open, closeDate: ipo.close,
      source: 'Chittorgarh (' + ipo.board + ')',
      updatedAt: new Date(),
      detailUrl: ipo.href || ''
    };

    if (existing) {
      // Same category -> update dates/source in place.
      if (existing.cat === ipo.cat) {
        var sh = existing.sheet;
        var vals = sh.getRange(existing.rowIndex, 1, 1, COLS.length).getValues()[0];
        vals[COLS.indexOf('openDate')] = data.openDate;
        vals[COLS.indexOf('closeDate')] = data.closeDate;
        vals[COLS.indexOf('source')] = data.source;
        vals[COLS.indexOf('updatedAt')] = data.updatedAt;
        if (data.detailUrl && !vals[COLS.indexOf('detailUrl')]) {
          vals[COLS.indexOf('detailUrl')] = data.detailUrl;
        }
        sh.getRange(existing.rowIndex, 1, 1, COLS.length).setValues([vals]);
      } else {
        // Category changed (Open->Closed, Closed->Listed, Upcoming->Open...)
        moveRow_(existing.sheet, existing.rowIndex, sheets[ipo.cat], data, ipo.name);
      }
    } else {
      // Brand new IPO -> append to its category tab.
      var row = newRow_(ipo.name, data);
      var target = sheets[ipo.cat];
      target.appendRow(row);
      appendCount[ipo.cat] += 1;
    }
  });

  // If an "Open" IPO stopped appearing on the dashboard, close-date logic
  // inside next runs will retire it; nothing else needed here.
}

function moveRow_(fromSheet, rowIndex, toSheet, newData, name) {
  var vals = fromSheet.getRange(rowIndex, 1, 1, COLS.length).getValues()[0];
  vals[COLS.indexOf('openDate')] = newData.openDate;
  vals[COLS.indexOf('closeDate')] = newData.closeDate;
  vals[COLS.indexOf('source')] = newData.source;
  vals[COLS.indexOf('updatedAt')] = newData.updatedAt;
  toSheet.appendRow(vals);
  fromSheet.deleteRow(rowIndex);
  log_('Moved "' + name + '" -> ' + toSheet.getName());
}

function newRow_(name, data) {
  var row = [];
  for (var i = 0; i < COLS.length; i++) row.push('');
  row[COLS.indexOf('name')] = name;
  Object.keys(data).forEach(function (k) {
    var idx = COLS.indexOf(k);
    if (idx >= 0) row[idx] = data[k];
  });
  return row;
}

/* ===================== PER-IPO DETAIL ENRICHMENT ======================== */

/**
 * For every IPO currently in the Open tab, fetch its detail page and extract
 * price band, lot size, issue size, listing date, subscription and GMP.
 * Also appends a daily GMP snapshot to the GMP Log tab.
 */
function fetchDetails_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_OPEN);
  var gmpSheet = ss.getSheetByName(CONFIG.SHEET_GMP);
  var last = sh.getLastRow();
  if (last < 2) return;
  var n = last - 1;
  if (n > CONFIG.MAX_DETAIL_FETCHES) n = CONFIG.MAX_DETAIL_FETCHES;
  var values = sh.getRange(2, 1, n, COLS.length).getValues();
  var todayKey = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');

  for (var i = 0; i < n; i++) {
    var row = values[i];
    var name = String(row[0]);
    // Use the real detail URL captured from the dashboard link; fall back to a guess
    var url = String(row[COLS.indexOf('detailUrl')] || '').trim();
    if (!url) url = detailUrl_(name);
    if (!url) continue;

    try {
      var html = fetchHtml_(url);
      applyDetail_(row, html);

      // Daily GMP snapshot (skip if already logged today for this IPO)
      var gmp = row[COLS.indexOf('gmp')];
      if (gmp !== '' && !gmpLoggedToday_(gmpSheet, todayKey, name)) {
        gmpSheet.appendRow([new Date(), name, gmp,
                            row[COLS.indexOf('priceHigh')], '', '']);
      }
    } catch (e) { /* best effort - leave row unchanged */ }

    // small politeness delay
    Utilities.sleep(400);
  }
  sh.getRange(2, 1, n, COLS.length).setValues(values);
}

/** Chittorgarh detail pages live at /ipo/<slug>/; slug derived from name. */
function detailUrl_(name) {
  return CONFIG.BASE_URL + '/ipo/' + name.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-') + '-ipo/';
}

function applyDetail_(row, html) {
  var text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  var m;
  m = text.match(/price\s*band[^0-9]{0,40}([\d,]+)\s*(?:to|[-\u2013])\s*([\d,]+)/i);
  if (m) {
    row[COLS.indexOf('priceLow')] = num_(m[1]);
    row[COLS.indexOf('priceHigh')] = num_(m[2]);
    var lotM = text.match(/lot\s*size[^0-9]{0,40}([\d,]+)/i);
    if (lotM) {
      var lot = num_(lotM[1]);
      row[COLS.indexOf('lotSize')] = lot;
      if (lot) row[COLS.indexOf('lotValue')] = lot * num_(m[2]);
    }
  }
  m = text.match(/issue\s*size[^0-9]{0,60}([\d.,]+)\s*(?:crore|cr\b)/i);
  if (m) row[COLS.indexOf('issueSize')] = parseFloat(m[1].replace(/,/g, ''));

  m = text.match(/listing\s*date[^A-Za-z0-9]{0,30}(\d{1,2}\s+\w+\s*,?\s*\d{4}|\w+\s+\d{1,2},?\s*\d{4})/i);
  if (m) row[COLS.indexOf('listingDate')] = new Date(m[1]);

  m = text.match(/GMP[^0-9+\-]{0,50}([+\-]?\d[\d.]*)/i);
  if (m) row[COLS.indexOf('gmp')] = parseFloat(m[1]);

  m = text.match(/(?:Retail|RII)[^0-9]{0,20}([\d.]+)\s*x/i);
  if (m) row[COLS.indexOf('rii')] = parseFloat(m[1]);
  m = text.match(/QIB[^0-9]{0,20}([\d.]+)\s*x/i);
  if (m) row[COLS.indexOf('qib')] = parseFloat(m[1]);
  m = text.match(/(?:NII|Non\s*Institutional)[^0-9]{0,20}([\d.]+)\s*x/i);
  if (m) row[COLS.indexOf('nii')] = parseFloat(m[1]);
  m = text.match(/(?:total|overall)[^0-9]{0,20}subscription[^0-9]{0,20}([\d.]+)\s*x/i);
  if (m) row[COLS.indexOf('overallSub')] = parseFloat(m[1]);

  // Estimated listing gain from GMP (if both available)
  var gmp = row[COLS.indexOf('gmp')], high = row[COLS.indexOf('priceHigh')];
  if (gmp !== '' && high) {
    row[COLS.indexOf('estGain')] = Math.round((gmp / high) * 1000) / 10;
  }
  row[COLS.indexOf('updatedAt')] = new Date();
}

function gmpLoggedToday_(gmpSheet, todayKey, name) {
  var last = gmpSheet.getLastRow();
  if (last < 2) return false;
  var tz = Session.getScriptTimeZone();
  var dates = gmpSheet.getRange(Math.max(2, last - 100), 1, Math.min(99, last - 1), 2).getValues();
  for (var i = dates.length - 1; i >= 0; i--) {
    var d = dates[i][0] instanceof Date ? Utilities.formatDate(dates[i][0], tz, 'yyyy-MM-dd') : '';
    if (d === todayKey && String(dates[i][1]).toLowerCase() === String(name).toLowerCase()) return true;
  }
  return false;
}

function num_(s) { return parseFloat(String(s).replace(/,/g, '')); }

/* ===================== LISTED-BACKFILL =================================== */

/**
 * Backfills the Listed tab from the performance-tracker pages (all listed
 * IPOs of the year). IPOs found in other tabs are moved to Listed.
 */
function backfillListed_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheetDefs = [
    ['Open', CONFIG.SHEET_OPEN], ['Upcoming', CONFIG.SHEET_UPCOMING],
    ['Closed', CONFIG.SHEET_CLOSED], ['Listed', CONFIG.SHEET_LISTED]
  ];
  var sheets = {}, nameIndex = {};
  sheetDefs.forEach(function (d) {
    var sh = ss.getSheetByName(d[1]);
    sheets[d[0]] = sh;
    var last = sh.getLastRow();
    if (last < 2) return;
    var names = sh.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      var n = String(names[i][0]).trim().toLowerCase();
      if (n && !(n in nameIndex)) nameIndex[n] = d[0];
    }
  });

  var BLOCK = ['company','issuer','issuer company','company name','name','sr no','no.','sno'];

  CONFIG.LISTED_SOURCES.forEach(function (url) {
    var board = /exchange=sme/i.test(url) ? 'SME' : 'Mainboard';
    var html;
    try {
      html = fetchHtml_(url);
    } catch (e) {
      DIAG.push('Listed ' + board + ' [' + url + '] FETCH FAILED: ' + (e && e.message ? e.message : e));
      return;
    }
    var rows = parseAllRows_(html);
    var toMove = [], toAdd = [], samples = 0;

    rows.forEach(function (r) {
      // Diagnostics: capture a few sample rows so the structure is visible
      if (samples < 3 && r.length >= 4) {
        var txt = r.map(function (c) { return String(c.text).substring(0, 22); }).join(' | ');
        if (txt.replace(/[|\s]/g, '').length > 5) {
          DIAG.push('PT ' + board + ' sample: [' + txt + ']');
          samples++;
        }
      }

      try {
        if (r.length < 4) return;                       // full data rows have many columns

        // must contain a date (range "16 - 18 Sep" or single "01 Sep 2026")
        var hasDate = false;
        for (var d2 = 0; d2 < r.length; d2++) {
          var t2 = String(r[d2].text);
          if (/\d{1,2}\s*[-\u2013]\s*\d{1,2}\s+[A-Za-z]{3,9}/.test(t2) ||
              /\d{1,2}\s+[A-Za-z]{3,9},?\s+\d{4}/.test(t2)) { hasDate = true; break; }
        }
        if (!hasDate) return;

        // must contain at least 2 numeric cells (prices/gains) - not nav/sidebar rows
        var numCells = 0;
        for (var d3 = 0; d3 < r.length; d3++) {
          if (/^[\u20b9$]?\s*[\d,]+(\.\d+)?\s*%?$/.test(String(r[d3].text).trim())) numCells++;
        }
        if (numCells < 2) return;

        // Name cell: prefer /ipo/ link, then any non-nav link, then first letter cell
        var nameCell = null, fallbackCell = null;
        for (var i = 0; i < r.length; i++) {
          var h = r[i].href;
          if (h && String(h).indexOf('/ipo/') !== -1 && String(h).indexOf('ipo_perf') === -1) {
            nameCell = r[i]; break;
          }
          if (!fallbackCell && h && !isNavHref_(h)) fallbackCell = r[i];
        }
        if (!nameCell) nameCell = fallbackCell;
        if (!nameCell) {
          for (var i3 = 0; i3 < r.length; i3++) {
            if (/[A-Za-z]{3}/.test(r[i3].text) && !/^\d/.test(String(r[i3].text).trim())) {
              nameCell = r[i3]; break;
            }
          }
        }
        if (!nameCell) return;

        var rawName = nameCell.text
            .replace(/(\d{1,2}\s*[-\u2013]\s*\d{1,2}\s+[A-Za-z]{3,9}).*$/, ' ')
            .replace(/&\u0061mp/gi, '&')
            .replace(/\s+/g, ' ')
            .replace(/\s*\(?(IPO|FPO)\)?\s*$/i, '')
            .replace(/[\s\u00a0]+(O|P|CT|LT)\s*$/i, '')
            .trim();
        if (!rawName || rawName.length < 3) return;
        if (BLOCK.indexOf(rawName.toLowerCase()) !== -1) return;

        var key = rawName.toLowerCase();
        var where = nameIndex[key];
        if (where === 'Listed') return;                 // already archived

        var href = nameCell.href;
        if (href && href.indexOf('http') !== 0) href = CONFIG.BASE_URL + href;
        var entry = { name: rawName, key: key, href: href, fromCat: where || null,
                      listingDate: listDateFromRow_(r) };

        if (where) { toMove.push(entry); } else { toAdd.push(entry); }
        nameIndex[key] = 'Listed';                       // avoid duplicates within run
      } catch (e) { /* skip bad rows */ }
    });

    // Execute moves
    toMove.forEach(function (mv) {
      try {
        if (!mv.fromCat) return;
        var sh = sheets[mv.fromCat];
        var last = sh.getLastRow();
        if (last < 2) return;
        var names = sh.getRange(2, 1, last - 1, 1).getValues();
        for (var i = 0; i < names.length; i++) {
          if (String(names[i][0]).trim().toLowerCase() === mv.key) {
            var vals = sh.getRange(i + 2, 1, 1, COLS.length).getValues()[0];
            sh.deleteRow(i + 2);
            if (!vals[COLS.indexOf('listingDate')]) vals[COLS.indexOf('listingDate')] = mv.listingDate;
            vals[COLS.indexOf('source')] = 'Chittorgarh (' + board + ') - listed';
            vals[COLS.indexOf('updatedAt')] = new Date();
            if (!vals[COLS.indexOf('detailUrl')] && mv.href) vals[COLS.indexOf('detailUrl')] = mv.href;
            sheets.Listed.appendRow(vals);
            return;
          }
        }
      } catch (e) { /* skip */ }
    });

    // Execute adds
    toAdd.forEach(function (a) {
      try {
        sheets.Listed.appendRow(newRow_(a.name, {
          source: 'Chittorgarh (' + board + ') - listed',
          listingDate: a.listingDate,
          updatedAt: new Date(),
          detailUrl: a.href || ''
        }));
      } catch (e) { /* skip */ }
    });

    DIAG.push('Listed ' + board + ' [' + url + '] OK: ' + rows.length +
               ' rows scanned, ' + toMove.length + ' moved, ' + toAdd.length + ' added');
  });
}

function isNavHref_(h) {
  var l = String(h || '').toLowerCase();
  if (!l) return true;
  return l.charAt(0) === '#' || l.indexOf('javascript:') === 0 || l.indexOf('mailto:') === 0 ||
         l.indexOf('ipo_perf') !== -1 || l.indexOf('ipo_dashboard') !== -1 ||
         l.indexOf('/broker') !== -1 || l.indexOf('open-account') !== -1 ||
         l.indexOf('.css') !== -1 || l.indexOf('.js') !== -1 ||
         l.indexOf('facebook') !== -1 || l.indexOf('twitter') !== -1 || l.indexOf('whatsapp') !== -1;
}


/** Finds a single listing date like "01 Sep 2026" anywhere in a row. */
function listDateFromRow_(r) {
  for (var i = 0; i < r.length; i++) {
    var m = String(r[i].text).match(/(\d{1,2})\s+([A-Za-z]{3,9}),?\s+(\d{4})/);
    if (m) {
      var mo = monthIndex_(m[2]);
      if (mo !== -1) return new Date(parseInt(m[3], 10), mo, parseInt(m[1], 10));
    }
  }
  return '';
}

/* ============================== LOGGING ================================= */

function log_(msg) {
  try { Logger.log(msg); } catch (e) {}
}

function writeRunStatus_(started, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var dash = ss.getSheetByName(CONFIG.SHEET_DASH);
    dash.getRange('A24').setValue('Last automated run');
    dash.getRange('B24').setValue(
      Utilities.formatDate(started, Session.getScriptTimeZone(),
                          'dd/MM/yyyy HH:mm') + ' - ' + status);
    // Diagnostics area (Dashboard column D)
    dash.getRange('D23').setValue('DIAGNOSTICS');
    dash.getRange('D24:D40').clearContent();
    if (DIAG && DIAG.length) {
      var d = DIAG.map(function (s) { return [String(s).substring(0, 200)]; });
      dash.getRange(24, 4, Math.min(d.length, 17), 1).setValues(d);
    } else {
      dash.getRange('D24').setValue('no diagnostics');
    }
  } catch (e) {}
}

/* ===================== FUNDAMENTALS + LOT PLANNER ======================== */

var FUND = {
  SHEET: 'Fundamentals',
  PLANNER: 'Lot Planner',
  HEADERS: ['IPO Name', 'Board', 'Issue Size (Rs Cr)', 'Fresh Issue %',
            'OFS %', 'PAT Margin (%)', 'P/E (Pre-IPO)', 'D/E',
            'GMP (Rs)', 'GMP (%)', 'Retail Sub (x)', 'Overall Sub (x)',
            'Allotment Odds', 'Score (0-10)', 'Verdict for Applicants', 'Source'],
  MAX_IPOS: 40,
  SME_LOT_VALUE: 90000        // lot value at/above this is treated as SME
};

var METHOD_TEXT =
  'Methodology (Vibhor Varshney videos): rank each IPO on: 1) Issue size - ' +
  'not too small (no allotment) not too big (everyone gets, all sell on listing). ' +
  '2) Fresh issue % higher = better (money goes to company); 100% OFS = red flag. ' +
  '3) PAT margin higher = better. 4) P/E lower = better (compare within same sector). ' +
  '5) D/E lower = better. 6) Combine with allotment odds (oversubscription) - best ' +
  'fundamentals mean nothing if you never get shares. Then: 1-lot money -> pick best ' +
  'odds+gain combo; more lots -> repeat 1st pick via family demats. ' +
  'Educational data only - not investment advice.';

var RULES_TEXT =
  'SME IPO: minimum 2 lots / application above Rs 2 lakh, no cut-off price. ' +
  'Mainboard oversubscribed = computerised lottery: applying MORE lots does NOT ' +
  'improve odds - use family demat accounts to repeat instead. One application ' +
  'per PAN per IPO. Same-close-date IPOs block the same money.';

/** Creates the Fundamentals and Lot Planner tabs if they do not exist yet. */
function ensureAnalysisTabs_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  var fund = ss.getSheetByName(FUND.SHEET);
  if (!fund) {
    fund = ss.insertSheet(FUND.SHEET);
    fund.appendRow(FUND.HEADERS);
    fund.setFrozenRows(1);
    fund.getRange('A60').setValue(METHOD_TEXT);
  }

  var lp = ss.getSheetByName(FUND.PLANNER);
  if (!lp) {
    lp = ss.insertSheet(FUND.PLANNER);
    lp.getRange('A1').setValue('YOUR BUDGET (Rs)');
    lp.getRange('B1').setValue(100000);
    lp.getRange('A2').setValue('Your category (mainboard)');
    lp.getRange('B2').setFormula('=IF(B1<=200000,"Retail (RII) - lottery allotment, up to Rs 2 lakh per PAN",'
      + 'IF(B1<=1000000,"Small NII / HNI (Rs 2-10 lakh) - proportional allotment",'
      + '"Large NII / HNI (Rs 10 lakh+) - proportional allotment"))');
    lp.getRange('A3').setValue('Rules');
    lp.getRange('B3').setValue(RULES_TEXT);
    lp.getRange('A5:K5').setValues([['IPO Name', 'Board', 'Price Band (Rs)', 'Lot Size',
      'Lot Value (Rs)', 'Lots in Your Budget', 'Retail Max Lots (per PAN)',
      'Money Blocked (Rs)', 'Est. Gain if 1 Lot Allotted (Rs)', 'Allotment Odds', 'Notes']]);
    lp.setFrozenRows(5);
  }
}

/**
 * Visits every Open/Upcoming IPO's detail page, extracts fundamentals
 * (fresh issue %, OFS %, PAT margin, P/E, D/E, issue size, board) and merges
 * them into the Fundamentals tab. Merge rules:
 *   - a confidently parsed value always wins,
 *   - a failed parse NEVER overwrites an existing value (your manual / video
 *     numbers stay),
 *   - manual columns I..P (GMP formulas, Score, Verdict, Source) untouched.
 */
function collectFundamentals() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var fund = ss.getSheetByName(FUND.SHEET);
  if (!fund) return;

  // name -> row index in Fundamentals (skip formula / notes rows)
  var existing = {};
  var lastRow = fund.getLastRow();
  if (lastRow > 1) {
    var names = fund.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < names.length; i++) {
      var nm = String(names[i][0] || '').trim();
      if (nm && nm.charAt(0) !== '=' && nm.indexOf('Methodology') !== 0) existing[nm] = i + 2;
    }
  }

  // IPO list + detail URLs + lot value + source hint from Open and Upcoming
  var ipos = [];
  ['Open', 'Upcoming'].forEach(function (sheetName) {
    var sh = ss.getSheetByName(sheetName);
    if (!sh) return;
    var last = sh.getLastRow();
    if (last < 2) return;
    sh.getRange(2, 1, last - 1, COLS.length).getValues().forEach(function (r) {
      var name = String(r[0] || '').trim();
      var url = String(r[COLS.indexOf('detailUrl')] || '').trim();
      var src = String(r[COLS.indexOf('source')] || '');
      var lotValue = num_(r[COLS.indexOf('lotValue')]);
      if (name && url.indexOf('http') === 0) {
        for (var k = 0; k < ipos.length; k++) if (ipos[k].name === name) return;
        ipos.push({
          name: name, url: url,
          lotValue: isFinite(lotValue) ? lotValue : 0,
          srcSme: /SME/i.test(src) && !/Mainboard/i.test(src)
        });
      }
    });
  });

  var fetched = 0, filled = 0, guard = 0;

  ipos.forEach(function (ipo) {
    if (++guard > FUND.MAX_IPOS) return;
    try {
      var html = fetchHtml_(ipo.url);
      fetched++;
      var p = parseDetailPage(html);

      var r = existing[ipo.name];
      if (!r) {
        r = fund.getLastRow() + 1;
        var iszNew = parseFloat(p.issueSize) || 0;
        fund.appendRow([ipo.name, detectBoard_(p.board, ipo.lotValue, ipo.srcSme),
          p.issueSize, toPct_(p.freshCr, iszNew), toPct_(p.ofsCr, iszNew),
          p.pat, p.pe, p.de,
          fundFormula_('I', r, 15), fundFormula_('J', r, 6),
          fundFormula_('K', r, 11), fundFormula_('L', r, 14),
          fundFormula_('M', r, 0), '', '', 'Auto']);
        existing[ipo.name] = r;
        filled++;
      } else {
        var cur = fund.getRange(r, 2, 1, 7).getValues()[0];
        var DASH = '\u2014';
        // issue size: parsed wins, else keep existing
        var isz = (p.issueSize && p.issueSize !== DASH) ? p.issueSize : cur[1];
        var freshPct = toPct_(p.freshCr, isz);
        var ofsPct = toPct_(p.ofsCr, isz);
        var board = detectBoard_(p.board, ipo.lotValue, ipo.srcSme) || cur[0];
        var merged = [
          board,
          (p.issueSize && p.issueSize !== DASH) ? p.issueSize : cur[1],
          freshPct !== '' ? freshPct : cur[2],
          ofsPct !== '' ? ofsPct : cur[3],
          (p.pat && p.pat !== DASH) ? p.pat : cur[4],
          (p.pe && p.pe !== DASH) ? p.pe : cur[5],
          (p.de && p.de !== DASH) ? p.de : cur[6]
        ];
        fund.getRange(r, 2, 1, 7).setValues([merged]);
        filled++;
      }
    } catch (e) {
      log_('Fundamentals fetch failed for ' + ipo.name + ': ' + e);
    }
    Utilities.sleep(400);
  });

  moveMethodologyToEnd_(fund);
  var stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM/yyyy HH:mm');
  fund.getRange('A49').setValue('Last auto-collection: ' + stamp +
      ' (pages fetched: ' + fetched + ', rows updated: ' + filled + ')');
  log_('collectFundamentals done: fetched=' + fetched + ' updated=' + filled);
}

/**
 * Board decision. Signals in priority order:
 *   1. the page's "Listing At : BSE SME / NSE Emerge" style text
 *   2. an explicit "BSE SME" / "NSE Emerge" phrase anywhere on the page
 *   3. lot value >= ~Rs 90k (SME minimum application is Rs 1 lakh)
 *   4. lot value present and small -> Mainboard
 *   5. the source-column hint
 *   6. unknown -> '' (keeps whatever the sheet already has)
 */
function detectBoard_(pageBoard, lotValue, srcSme) {
  if (pageBoard === 'SME') return 'SME';
  if (pageBoard === 'Mainboard') return 'Mainboard';
  if (lotValue >= FUND.SME_LOT_VALUE) return 'SME';
  if (lotValue > 0 && lotValue < FUND.SME_LOT_VALUE) return 'Mainboard';
  if (srcSme) return 'SME';
  return '';
}

/** Builds a VLOOKUP formula for one Fundamentals data cell. */
function fundFormula_(column, row, openCol) {
  if (openCol === 15) return '=IFERROR(VLOOKUP(A' + row + ',Open!A:O,15,FALSE),"\u2014")';
  if (openCol === 6)  return '=IFERROR(ROUND(I' + row + '/VLOOKUP(A' + row + ',Open!A:F,6,FALSE)*100,1),"\u2014")';
  if (openCol === 11) return '=IFERROR(VLOOKUP(A' + row + ',Open!A:K,11,FALSE),"\u2014")';
  if (openCol === 14) return '=IFERROR(VLOOKUP(A' + row + ',Open!A:N,14,FALSE),"\u2014")';
  return '=IF(ISNUMBER(L' + row + '),"1 in "&L' + row + ',"\u2014")';
}

/**
 * Cr amount -> percent of issue size. Returns '' when the conversion is not
 * confident (missing data, or value implausibly larger than the issue).
 */
function toPct_(crVal, issueSize) {
  var cr = parseFloat(String(crVal || '').replace(/,/g, ''));
  var isz = parseFloat(String(issueSize || '').replace(/,/g, ''));
  if (!isFinite(cr) || !isFinite(isz) || isz <= 0) return '';
  if (cr < 0) return '';
  if (cr > isz * 1.05) return '';
  return Math.min(100, Math.round((cr / isz) * 100));
}

/** Extract fundamentals from a Chittorgarh IPO detail page (defensive). */
function parseDetailPage(html) {
  var out = { board: '', issueSize: '', freshCr: '', ofsCr: '', pat: '', pe: '', de: '' };
  var text = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                 .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                 .replace(/<[^>]+>/g, ' ')
                 .replace(/&[a-zA-Z#0-9]+;/g, ' ')
                 .replace(/\s+/g, ' ');

  function grab(label, pattern) {
    try {
      var seg = new RegExp(label, 'i').exec(text);
      if (seg) {
        var tail = text.substring(seg.index, seg.index + 220);
        var m = pattern.exec(tail);
        if (m) return m[1];
      }
    } catch (e) {}
    return '';
  }

  // Scans EVERY occurrence of the label until one is followed almost
  // immediately by "Rs <number> Cr". A table header like "Fresh Issue (Rs
  // Cr)" is rejected: only up to 25 digit-free chars may sit between the
  // label and the money figure, and the figure must be the first number.
  function grabMoney(label) {
    var re;
    try { re = new RegExp(label, 'gi'); } catch (e) { return ''; }
    var m;
    while ((m = re.exec(text)) !== null) {
      var tail = text.substring(m.index + m[0].length, m.index + m[0].length + 60);
      var hit = /^[^0-9]{0,25}?(?:Rs\.?|\u20B9)\s*([0-9][0-9,.]*)\s*(?:Cr|Crore)/i.exec(tail);
      if (hit) return hit[1];
    }
    return '';
  }

  // ---- Board: strongest signal first ("Listing At : BSE SME") ----
  var lm = text.match(/Listing\s*(?:At|On)\s*:?\s*([A-Za-z0-9 .&]+)/i);
  if (lm && /SME|Emerge/i.test(lm[1])) out.board = 'SME';
  else if (lm && /BSE|NSE/i.test(lm[1])) out.board = 'Mainboard';
  else if (/BSE\s+SME|NSE\s+Emerge/i.test(text)) out.board = 'SME';
  // else leave '' -> detectBoard_ uses lot value / source hint

  // ---- Money figures (Chittorgarh states these in Rs Cr) ----
  out.issueSize = grabMoney('Issue\\s*Size')
               || grabMoney('IPO\\s*Size')
               || grabMoney('Total\\s*Issue\\s*Size');
  out.freshCr = grabMoney('Fresh\\s*Issue');
  out.ofsCr = grabMoney('Offer\\s*for\\s*Sale');

  // ---- Ratios ----
  out.pat = grab('PAT\\s*Margin', /(-?[0-9]+(?:\.[0-9]+)?)\s*%?/i);
  out.pe = grab('P\\s*/\\s*E', /([0-9]+(?:\.[0-9]+)?)/);
  out.de = grab('(?:Debt\\s*(?:to)?\\s*Equity|D\\s*/\\s*E)', /(-?[0-9]+(?:\.[0-9]+)?)/);

  if (out.issueSize) out.issueSize = String(out.issueSize).replace(/,/g, '');
  else out.issueSize = '\u2014';
  ['pat', 'pe', 'de'].forEach(function (k) { if (!out[k]) out[k] = '\u2014'; });
  return out;
}

/** Keeps the methodology note as the last row of the Fundamentals tab. */
function moveMethodologyToEnd_(fund) {
  try {
    var last = fund.getLastRow();
    if (last < 2) return;
    var vals = fund.getRange(2, 1, last - 1, 1).getValues();
    for (var i = 0; i < vals.length; i++) {
      var s = String(vals[i][0] || '');
      if (s.indexOf('Methodology') === 0) {
        fund.getRange(i + 2, 1).clearContent();
        fund.getRange(fund.getLastRow() + 1, 1).setValue(s);
        return;
      }
    }
  } catch (e) { /* cosmetic - never fail the run */ }
}

/**
 * Rewrites the Lot Planner table so it always covers every row currently in
 * the Open tab. The budget cell B1 and rules in A1:B3 are never touched.
 */
function refreshLotPlanner_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var open = ss.getSheetByName(CONFIG.SHEET_OPEN);
  var lp = ss.getSheetByName(FUND.PLANNER);
  if (!open || !lp) return;
  var n = open.getLastRow() - 1;
  if (n < 1) return;
  if (n > 30) n = 30;

  lp.getRange(6, 1, 30, 11).clearContent();

  var rows = [];
  for (var i = 0; i < n; i++) {
    var or = i + 2, pr = i + 6;
    rows.push([
      '=IF(Open!A' + or + '="","",Open!A' + or + ')',
      '=IF(A' + pr + '="","",IFERROR(VLOOKUP(A' + pr + ',Fundamentals!A:B,2,FALSE),"\u2014"))',
      '=IF(Open!F' + or + '="","\u2014",Open!F' + or + '&" - "&Open!G' + or + ')',
      '=IF(Open!H' + or + '="","\u2014",Open!H' + or + ')',
      '=IF(Open!I' + or + '="","\u2014",Open!I' + or + ')',
      '=IF(ISNUMBER(E' + pr + '),FLOOR($B$1/E' + pr + ',1),"\u2014")',
      '=IF(ISNUMBER(E' + pr + '),FLOOR(200000/E' + pr + ',1),"\u2014")',
      '=IF(AND(ISNUMBER(F' + pr + '),ISNUMBER(E' + pr + ')),F' + pr + '*E' + pr + ',"\u2014")',
      '=IF(AND(ISNUMBER(Open!O' + or + '),ISNUMBER(Open!H' + or + ')),Open!O' + or + '*Open!H' + or + ',"\u2014")',
      '=IF(ISNUMBER(Open!N' + or + '),"1 in "&Open!N' + or + ',"\u2014")',
      '=IF(B' + pr + '="SME","SME: 2 lots min, above Rs 2 lakh, no cut-off",IF(A' + pr + '="","","Mainboard lottery: family demats to repeat"))'
    ]);
  }
  lp.getRange(6, 1, n, 11).setValues(rows);
}

/** Run ONCE: installs every trigger this project needs. */
function installAllTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('updateAll').timeBased()
      .everyDays(1).atHour(8).create();
  ScriptApp.newTrigger('checkLinks').timeBased()
      .everyMinutes(30).create();
  log_('installAllTriggers: daily updateAll (8 AM) + checkLinks (30 min) installed');
}

/* ==================== JSON API + LINK HEALTH ============================= */
/* ======================================================================== */

var API = {
  TABS: ['Open', 'Upcoming', 'Closed', 'Listed'],
  COL_ALLOTMENT: 'Allotment URL',
  COL_RHP: 'RHP URL',
  COL_DRHP: 'DRHP URL',
  COL_LINK_STATUS: 'Link Status',
  COL_LAST_CHECKED: 'Last Checked',
  HEALTH_TAB: 'Link Health',
  FETCH_TIMEOUT: 20,          // seconds per page fetch
  LINK_TRIGGER_MINUTES: 30    // how often checkLinks() runs
};

/* ---------------------------------------------------------------------------
 * 1. JSON API  (the website's "Google Sheet feed")
 * ------------------------------------------------------------------------- */

function doGet(e) {
  var params = (e && e.parameter) ? e.parameter : {};
  var only = params.tab || null;
  var payload = {
    ok: true,
    updated: new Date().toISOString(),
    stats: {
      open: countRows_('Open'),
      upcoming: countRows_('Upcoming'),
      closed: countRows_('Closed'),
      listed: countRows_('Listed')
    }
  };

  for (var i = 0; i < API.TABS.length; i++) {
    var tab = API.TABS[i];
    if (only && tab.toLowerCase() !== String(only).toLowerCase()) continue;
    payload[tab.toLowerCase()] = readTab_(tab);
  }

  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Reads one tab into an array of objects keyed by camelCase names. */
function readTab_(tabName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  var headers = values[0].map(String);
  var idx = {};                                    // header -> column index
  for (var c = 0; c < headers.length; c++) idx[headers[c]] = c;

  var rows = [];
  for (var r = 1; r < values.length; r++) {
    var name = values[r][0];
    if (!name || !String(name).trim()) continue;   // skip blank rows
    rows.push({
      name: String(name),
      sector: cell_(values[r], idx['Sector']),
      openDate: cell_(values[r], idx['Open Date']),
      closeDate: cell_(values[r], idx['Close Date']),
      listingDate: cell_(values[r], idx['Listing Date']),
      priceLow: apiNum_(cell_(values[r], idx['Price Band Low (Rs)'])),
      priceHigh: apiNum_(cell_(values[r], idx['Price Band High (Rs)'])),
      lotSize: apiNum_(cell_(values[r], idx['Lot Size (Shares)'])),
      lotValue: apiNum_(cell_(values[r], idx['Lot Value (Rs)'])),
      issueSizeCr: apiNum_(cell_(values[r], idx['Issue Size (Rs Cr)'])),
      rii: apiNum_(cell_(values[r], idx['RII Sub (x)'])),
      qib: apiNum_(cell_(values[r], idx['QIB Sub (x)'])),
      nii: apiNum_(cell_(values[r], idx['NII Sub (x)'])),
      overallSub: apiNum_(cell_(values[r], idx['Overall Sub (x)'])),
      gmp: apiNum_(cell_(values[r], idx['GMP (Rs)'])),
      // GMP % is always computed fresh - it can never go stale in storage.
      gmpPct: gmpPct_(cell_(values[r], idx['GMP (Rs)']),
                      cell_(values[r], idx['Price Band Low (Rs)'])),
      de: cell_(values[r], idx['Debt to Equity']),
      roe: cell_(values[r], idx['ROE (%)']),
      revGrowth: cell_(values[r], idx['Revenue Growth (%)']),
      listingPrice: apiNum_(cell_(values[r], idx['Listing Price (Rs)'])),
      actualGain: cell_(values[r], idx['Actual Listing Gain (%)']),
      detailUrl: cell_(values[r], idx['Detail URL']),
      allotmentUrl: cell_(values[r], idx[API.COL_ALLOTMENT]),
      rhpUrl: cell_(values[r], idx[API.COL_RHP]),
      drhpUrl: cell_(values[r], idx[API.COL_DRHP]),
      linkStatus: cell_(values[r], idx[API.COL_LINK_STATUS]),
      lastChecked: cell_(values[r], idx[API.COL_LAST_CHECKED])
    });
  }
  return rows;
}

function gmpPct_(gmpVal, priceLowVal) {
  var g = parseFloat(gmpVal), p = parseFloat(priceLowVal);
  if (!isFinite(g) || !isFinite(p) || p <= 0) return null;
  return Math.round((g / p) * 1000) / 10;          // one decimal
}

function cell_(row, colIdx) {
  if (colIdx === undefined || colIdx < 0) return '';
  var v = row[colIdx];
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), 'dd/MM/yyyy');
  }
  return String(v).trim();
}

function apiNum_(v) {
  var n = parseFloat(v);
  return isFinite(n) ? n : null;
}

function countRows_(tabName) {
  var sh = SpreadsheetApp.getActive().getSheetByName(tabName);
  if (!sh || sh.getLastRow() < 2) return 0;
  var names = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  var n = 0;
  for (var i = 0; i < names.length; i++) {
    if (String(names[i][0] || '').trim()) n++;
  }
  return n;
}

/* ---------------------------------------------------------------------------
 * 2. Link resolver - direct RHP/DRHP + allotment links
 *    Priority: issuer/registrar-hosted PDF first, NSE/BSE gateway only as
 *    fallback (the gateway links are what we try to bypass).
 * ------------------------------------------------------------------------- */

function resolveIpoLinks() {
  ensureColumns_(['Open', 'Upcoming']);
  var ss = SpreadsheetApp.getActive();
  var resolved = 0;

  ['Open', 'Upcoming'].forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) return;
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(String);
    var col = function (h) { return headers.indexOf(h); };
    var cDetail = col('Detail URL'), cAllot = col(API.COL_ALLOTMENT),
        cRhp = col(API.COL_RHP), cDrhp = col(API.COL_DRHP),
        cStatus = col(API.COL_LINK_STATUS), cChecked = col(API.COL_LAST_CHECKED);
    if (cDetail < 0) return;

    for (var r = 1; r < values.length; r++) {
      var name = String(values[r][0] || '').trim();
      var detailUrl = String(values[r][cDetail] || '').trim();
      if (!name || !detailUrl) continue;

      var links = scrapeLinks_(detailUrl);
      if (links.rhp || links.drhp || links.allotment) resolved++;

      if (links.allotment) values[r][cAllot] = links.allotment;
      if (links.rhp) values[r][cRhp] = links.rhp;
      if (links.drhp) values[r][cDrhp] = links.drhp;
      values[r][cStatus] = links.any ? 'resolved ' + Utilities.formatDate(
        new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm') : 'no links found';
      values[r][cChecked] = new Date();
    }
    sh.getRange(1, 1, values.length, values[0].length).setValues(values);
  });

  logHealth_('resolver run: ' + resolved + ' IPO(s) with resolvable links');
  return resolved;
}

/**
 * Fetches an IPO detail page and looks for:
 *  - RHP / DRHP: direct .pdf links (issuer or registrar hosted preferred,
 *    exchange gateways like nseindia.com/bseindia.com de-prioritised).
 *  - Allotment: registrar / allotment-status links.
 * Best-effort: returns whatever it finds, never throws.
 */
function scrapeLinks_(detailUrl) {
  var out = { rhp: '', drhp: '', allotment: '', any: false };
  try {
    var resp = UrlFetchApp.fetch(detailUrl, {
      muteHttpExceptions: true,
      followRedirects: true,
      validateHttpsCertificates: false,
      timeout: API.FETCH_TIMEOUT * 1000
    });
    var code = resp.getResponseCode();
    if (code !== 200) { out.any = false; return out; }
    var html = resp.getContentText();

    var hrefs = html.match(/href\s*=\s*["']([^"']+)["']/ig) || [];
    var pdfs = [], others = [];
    hrefs.forEach(function (m) {
      var url = m.replace(/^href\s*=\s*["']/i, '').replace(/["']$/, '');
      var low = url.toLowerCase();
      if (low.indexOf('javascript:') === 0 || low.indexOf('#') === 0) return;
      if (low.slice(-4) === '.pdf') pdfs.push(url); else others.push(url);
    });

    var abs = function (u) {
      if (/^https?:\/\//i.test(u)) return u;
      if (u.indexOf('//') === 0) return 'https:' + u;
      if (u.charAt(0) === '/') {
        var m = detailUrl.match(/^(https?:\/\/[^\/]+)/i);
        return m ? m[1] + u : u;
      }
      return detailUrl.replace(/[^\/]*$/, '') + u;
    };

    // RHP/DRHP: prefer direct PDFs whose filename says rhp / red herring /
    // prospectus. De-prioritise exchange gateways.
    var isExchange = function (u) {
      return /nseindia\.com|bseindia\.com/i.test(u);
    };
    pdfs.forEach(function (u) {
      var full = abs(u), low = full.toLowerCase();
      if (/rhp|red[ _-]?herring/.test(low) && !out.rhp) {
        out.rhp = isExchange(full) ? out.rhp || full : full;
      }
    });
    pdfs.forEach(function (u) {
      var full = abs(u), low = full.toLowerCase();
      if (/drhp|draft[ _-]?red[ _-]?herring/.test(low) && !out.drhp) {
        out.drhp = isExchange(full) ? out.drhp || full : full;
      }
    });
    // Generic prospectus pdf if no explicit rhp tag was found.
    if (!out.rhp) {
      pdfs.forEach(function (u) {
        var full = abs(u), low = full.toLowerCase();
        if (/prospectus/.test(low) && !isExchange(full) && !out.rhp) out.rhp = full;
      });
    }

    // Allotment: registrar status-page links. Common registrars in India:
    others.concat(pdfs).forEach(function (u) {
      var full = abs(u), low = full.toLowerCase();
      if (!out.allotment && /allotment|bigshare|linkintime|kfintech|skyline|mas|unistart|registrar/.test(low)) {
        out.allotment = full;
      }
    });

    out.any = !!(out.rhp || out.drhp || out.allotment);
  } catch (err) {
    // network hiccups are fine - the next run retries
  }
  return out;
}

/* ---------------------------------------------------------------------------
 * 3. Self-healing link monitor
 *    IMPORTANT: a 404 on an allotment link usually means the registrar has
 *    not published yet - that is "pending", not "dead". The resolver always
 *    re-derives the link from the detail page, never guesses.
 * ------------------------------------------------------------------------- */

function checkLinks() {
  ensureColumns_(['Open', 'Upcoming']);
  var ss = SpreadsheetApp.getActive();
  var toFetch = [];      // {url}
  var targets = [];      // {sheet, row, colIdx, kind, url, ipo}

  ['Open', 'Upcoming'].forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) return;
    var values = sh.getDataRange().getValues();
    var headers = values[0].map(String);
    [[API.COL_ALLOTMENT, 'allotment'], [API.COL_RHP, 'rhp'], [API.COL_DRHP, 'drhp']]
      .forEach(function (pair) {
        var c = headers.indexOf(pair[0]);
        if (c < 0) return;
        for (var r = 1; r < values.length; r++) {
          var url = String(values[r][c] || '').trim();
          if (/^https?:\/\//i.test(url)) {
            targets.push({ sheet: sh, row: r + 1, colIdx: c + 1, kind: pair[1], url: url, ipo: values[r][0] });
            toFetch.push({ url: url });
          }
        }
      });
  });

  if (!toFetch.length) { logHealth_('checkLinks: nothing to check'); return; }

  var responses = UrlFetchApp.fetchAll(toFetch.map(function (t) {
    return { url: t.url, muteHttpExceptions: true, followRedirects: true,
             validateHttpsCertificates: false, timeout: API.FETCH_TIMEOUT * 1000 };
  }));

  var dead = 0, ok = 0;
  for (var i = 0; i < responses.length; i++) {
    var code = responses[i].getResponseCode();
    var t = targets[i];
    if (code === 200 || code === 301 || code === 302) {
      ok++;
    } else if (code === 404 || code === 410) {
      dead++;
      healLink_(t);   // re-derive from the IPO's detail page
    }
    setStatus_(t, code);
  }
  logHealth_('checkLinks: ' + ok + ' ok, ' + dead + ' dead and re-resolved, of ' + responses.length + ' checked');
}

/** Re-derives one dead link by re-scraping the IPO's detail page. */
function healLink_(target) {
  try {
    var detail = getDetailUrl_(target.sheet, target.row);
    if (!detail) return;
    var links = scrapeLinks_(detail);
    var fresh = target.kind === 'rhp' ? links.rhp
              : target.kind === 'drhp' ? links.drhp : links.allotment;
    if (fresh && fresh !== target.url) {
      target.sheet.getRange(target.row, target.colIdx).setValue(fresh);
      logHealth_('healed ' + target.kind + ' link for ' + target.ipo + ' -> ' + fresh);
    } else {
      logHealth_('could not re-resolve ' + target.kind + ' for ' + target.ipo + ' (may not be published yet - will retry)');
    }
  } catch (err) {
    logHealth_('healLink_ error for ' + target.ipo + ': ' + err);
  }
}

function getDetailUrl_(sheet, row1based) {
  var values = sheet.getRange(row1based, 1, 1, sheet.getLastColumn()).getValues()[0];
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var c = headers.indexOf('Detail URL');
  if (c < 0) return '';
  return String(values[c] || '').trim();
}

function setStatus_(target, code) {
  try {
    var headers = target.sheet.getRange(1, 1, 1, target.sheet.getLastColumn()).getValues()[0].map(String);
    var cStatus = headers.indexOf(API.COL_LINK_STATUS) + 1;
    var cChecked = headers.indexOf(API.COL_LAST_CHECKED) + 1;
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'dd/MM HH:mm');
    if (cStatus > 0) target.sheet.getRange(target.row, cStatus)
      .setValue(target.kind + ' ' + code + ' @ ' + now);
    if (cChecked > 0) target.sheet.getRange(target.row, cChecked).setValue(new Date());
  } catch (err) { /* non-fatal */ }
}

/* ---------------------------------------------------------------------------
 * 4. Setup helpers
 * ------------------------------------------------------------------------- */

/** Appends the extra columns this file needs, if they are not there yet. */
function ensureColumns_(tabNames) {
  var ss = SpreadsheetApp.getActive();
  tabNames.forEach(function (tabName) {
    var sh = ss.getSheetByName(tabName);
    if (!sh) return;
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(function (h) {
      return String(h || '').trim();
    });
    [API.COL_ALLOTMENT, API.COL_RHP, API.COL_DRHP, API.COL_LINK_STATUS, API.COL_LAST_CHECKED]
      .forEach(function (h) {
        if (headers.indexOf(h) < 0) {
          sh.insertColumnsAfter(sh.getLastColumn(), 1);
          var col = sh.getLastColumn();
          sh.getRange(1, col).setValue(h).setFontWeight('bold');
          headers.push(h);
        }
      });
  });
}

/** Run once: every-30-min trigger for the self-healing monitor. */
function installLinkTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'checkLinks') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('checkLinks').timeBased()
    .everyMinutes(API.LINK_TRIGGER_MINUTES).create();
  logHealth_('link-health trigger installed (every ' + API.LINK_TRIGGER_MINUTES + ' min)');
}

/** Appends a timestamped line to the Link Health tab (created on demand). */
function logHealth_(msg) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(API.HEALTH_TAB);
  if (!sh) {
    sh = ss.insertSheet(API.HEALTH_TAB);
    sh.getRange(1, 1, 1, 2).setValues([['Time', 'Event']]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  sh.appendRow([new Date(), msg]);
}
