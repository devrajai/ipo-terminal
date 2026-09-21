#!/usr/bin/env node
// Fetches IPO data from the Notion "IPO Tracker" database and writes data/notion-data.json
// Used by GitHub Actions daily (.github/workflows/notion-fetch.yml). Requires env: NOTION_TOKEN, NOTION_DATABASE_ID
// Merged into ipo-terminal from the ipo-website repo (2026-09-21).
import { writeFileSync } from "node:fs";

const TOKEN = process.env.NOTION_TOKEN;
const DB = process.env.NOTION_DATABASE_ID;
if (!TOKEN || !DB) {
  console.error("Missing NOTION_TOKEN or NOTION_DATABASE_ID environment variables.");
  process.exit(1);
}

async function query(cursor) {
  const res = await fetch(`https://api.notion.com/v1/databases/${DB}/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ start_cursor: cursor, page_size: 100 }),
  });
  if (!res.ok) throw new Error(`Notion API ${res.status}: ${await res.text()}`);
  return res.json();
}

const rt = (p) => (p && p.rich_text ? p.rich_text.map((t) => t.plain_text).join("") : "");

const ipos = [];
let cursor = undefined;
do {
  const data = await query(cursor);
  for (const page of data.results) {
    const pr = page.properties;
    ipos.push({
      company: (pr.Company?.title || []).map((t) => t.plain_text).join(""),
      board: pr.Board?.select?.name || "",
      status: pr.Status?.select?.name || "",
      issueDates: rt(pr["Issue Dates"]),
      subscription: rt(pr["Live Subscription"]),
      priceBand: rt(pr["Price Band"]),
      lotSize: pr["Lot Size"]?.number ?? null,
      issueSizeCr: pr["Issue Size (Cr)"]?.number ?? null,
      faceValue: rt(pr["Face Value"]),
      listingAt: rt(pr["Listing At"]),
      listingDate: pr["Listing Date"]?.date?.start || "",
      issuePrice: pr["Issue Price"]?.number ?? null,
      currentPrice: pr["Current Price"]?.number ?? null,
      listingGainPct: pr["Listing Gain %"]?.number ?? null,
      gmp: rt(pr.GMP),
      sourceUrl: pr["Source URL"]?.url || "",
      offerDoc: pr["Offer Document"]?.url || "",
      lastUpdated: pr["Last Updated"]?.date?.start || "",
    });
  }
  cursor = data.has_more ? data.next_cursor : undefined;
} while (cursor);

const order = { Upcoming: 0, Open: 1, Closing: 2, Closed: 3, Allotment: 4, Listed: 5 };
ipos.sort((a, b) => (order[a.status] ?? 9) - (order[b.status] ?? 9) || a.company.localeCompare(b.company));

writeFileSync(
  "data/notion-data.json",
  JSON.stringify({ updated: new Date().toISOString(), source: "Notion IPO Tracker", ipos }, null, 2)
);
console.log(`Wrote ${ipos.length} IPOs to data/notion-data.json`);
