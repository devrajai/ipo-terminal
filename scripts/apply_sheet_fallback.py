"""Apply optional Google Sheet data overrides as a fallback for fields missing from free/public sources.

The sheet is NOT the primary source. Rows in DATA_OVERRIDES are only used when a
free/public collector has no usable value (blank, -, —, None). This lets the
site continue working when a source blocks or does not publish a field.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from datetime import datetime, timezone

import gspread
from google.oauth2.service_account import Credentials

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.file",
]
MISSING = {None, "", "-", "—", "N/A", "NA", "null", "None"}


def norm(v):
    return " ".join(str(v or "").strip().lower().replace("&", "and").split())


def get_book():
    sheet_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
    service_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not sheet_id or not service_json:
        return None
    info = json.loads(service_json)
    creds = Credentials.from_service_account_info(info, scopes=SCOPES)
    return gspread.authorize(creds).open_by_key(sheet_id)


def read_overrides(book):
    try:
        ws = book.worksheet("DATA_OVERRIDES")
    except gspread.WorksheetNotFound:
        return []
    rows = ws.get_all_records()
    out = []
    for row in rows:
        enabled = str(row.get("enabled", "TRUE")).strip().lower()
        if enabled in ("false", "0", "no", "off"):
            continue
        dataset = norm(row.get("dataset"))
        name = norm(row.get("name") or row.get("ipo_name") or row.get("company"))
        field = str(row.get("field") or "").strip()
        value = row.get("value")
        if dataset and name and field and value not in MISSING:
            out.append({"dataset": dataset, "name": name, "field": field, "value": value,
                        "source": row.get("source") or "Google Sheet DATA_OVERRIDES",
                        "updated_at": row.get("updated_at") or datetime.now(timezone.utc).isoformat()})
    return out


def apply_to_list(rows, overrides, name_keys=("name", "company", "ipo_name")):
    applied = 0
    by_name = {}
    for row in rows:
        if not isinstance(row, dict):
            continue
        n = next((row.get(k) for k in name_keys if row.get(k)), "")
        by_name[norm(n)] = row
    aliases = {
        "price_band": "price", "price": "price",
        "lot_size": "lot", "lot": "lot",
        "issue_size": "size", "size": "size",
        "gmp": "gmp", "gmp_pct": "gmp_pct",
        "subscription": "sub", "sub": "sub",
        "open_date": "open", "close_date": "close", "listing_date": "listing",
        "allotment_date": "allotment", "refund_date": "refund", "share_credit_date": "shares",
    }
    for ov in overrides:
        row = by_name.get(ov["name"])
        if not row:
            continue
        requested_field = ov["field"]
        field = aliases.get(requested_field, requested_field)
        if row.get(field) not in MISSING:
            continue
        row[field] = ov["value"]
        row.setdefault("_sheet_fallback", {})[field] = {
            "source": ov["source"], "updated_at": ov["updated_at"],
            "requested_field": requested_field
        }
        applied += 1
    return applied


def load_json(path, default):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return default


def save(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    try:
        book = get_book()
    except Exception as exc:
        print("SHEET FALLBACK: connection failed; keeping public-source data:", exc)
        return
    if not book:
        print("SHEET FALLBACK: Google Sheet secrets not configured; skipped.")
        return

    try:
        overrides = read_overrides(book)
    except Exception as exc:
        print("SHEET FALLBACK: could not read DATA_OVERRIDES; keeping public-source data:", exc)
        return

    if not overrides:
        print("SHEET FALLBACK: no enabled override rows.")
        return

    targets = {
        "ipos": DATA / "ipo-data.json",
        "listed": DATA / "listed.json",
        "gmp": DATA / "gmp.json",
        "subscriptions": DATA / "subscriptions.json",
        "news": DATA / "news.json",
        "documents": DATA / "drhp.json",
    }
    total = 0
    for dataset, path in targets.items():
        payload = load_json(path, [])
        if dataset == "ipos" and isinstance(payload, dict):
            rows = payload.get("ipos", [])
            n = apply_to_list(rows, [x for x in overrides if x["dataset"] in ("ipo", "ipos")])
            total += n
            save(path, payload)
        elif isinstance(payload, list):
            n = apply_to_list(payload, [x for x in overrides if x["dataset"] == dataset])
            total += n
            save(path, payload)

    # Keep a small machine-readable audit for the site's health panel/logs.
    health = {
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "status": "OK",
        "override_rows": len(overrides),
        "fields_applied": total,
        "source": "Google Sheet DATA_OVERRIDES fallback",
    }
    save(DATA / "sheet-fallback-health.json", health)
    print(f"SHEET FALLBACK: {len(overrides)} override rows read, {total} missing fields filled.")


if __name__ == "__main__":
    main()
