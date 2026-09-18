"""Sync IPO Terminal JSON snapshots into Google Sheets."""
from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import gspread
from google.oauth2.service_account import Credentials

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data"
SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive.file",
]
FILES = {
    "LIVE_IPO": "ipo-data.json",
    "SUBSCRIPTION": "subscriptions.json",
    "GMP": "gmp.json",
    "FUNDAMENTALS": "fundamentals.json",
    "DOCUMENTS": "drhp.json",
    "NEWS": "news.json",
}


def load_json(filename):
    path = DATA / filename
    if not path.exists():
        return []
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise RuntimeError(f"Invalid JSON in {path}: {exc}") from exc
    return value


def serialise(value):
    if value is None:
        return ""
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, separators=(",", ":"))
    return str(value)


def to_rows(value):
    if isinstance(value, dict):
        for key in ("data", "items", "records", "ipos", "news"):
            if isinstance(value.get(key), list):
                value = value[key]
                break
        else:
            value = [value]
    if not isinstance(value, list) or not value:
        return [["status", "no records"]]

    keys = []
    for item in value:
        if isinstance(item, dict):
            for key in item:
                if key not in keys:
                    keys.append(key)
    if not keys:
        return [["value"]] + [[serialise(x)] for x in value]

    rows = [keys]
    for item in value:
        item = item if isinstance(item, dict) else {"value": item}
        rows.append([serialise(item.get(k)) for k in keys])
    return rows


def get_book():
    sheet_id = os.environ.get("GOOGLE_SHEET_ID", "").strip()
    service_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not sheet_id or not service_json:
        raise RuntimeError("GOOGLE_SHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON are required")
    try:
        info = json.loads(service_json)
    except json.JSONDecodeError as exc:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON") from exc
    credentials = Credentials.from_service_account_info(info, scopes=SCOPES)
    client = gspread.authorize(credentials)
    return client.open_by_key(sheet_id)


def replace_tab(book, title, rows):
    try:
        ws = book.worksheet(title)
    except gspread.WorksheetNotFound:
        ws = book.add_worksheet(title=title, rows=max(100, len(rows) + 20), cols=max(20, len(rows[0]) + 5))
    ws.clear()
    ws.resize(rows=max(100, len(rows) + 20), cols=max(20, len(rows[0]) + 5))
    ws.update("A1", rows, value_input_option="RAW")
    ws.freeze(rows=1)


def append_history(book, results):
    try:
        ws = book.worksheet("HISTORY")
    except gspread.WorksheetNotFound:
        ws = book.add_worksheet(title="HISTORY", rows=2000, cols=6)
        ws.append_row(["timestamp_utc", "sheet", "rows", "status"], value_input_option="RAW")
        ws.freeze(rows=1)
    stamp = datetime.now(timezone.utc).isoformat()
    ws.append_rows([[stamp, name, count, status] for name, count, status in results], value_input_option="RAW")


def main():
    book = get_book()
    results = []
    for tab, filename in FILES.items():
        rows = to_rows(load_json(filename))
        replace_tab(book, tab, rows)
        results.append((tab, max(0, len(rows) - 1), "OK"))

    replace_tab(book, "DATA_HEALTH", [
        ["check", "value"],
        ["sync_time_utc", datetime.now(timezone.utc).isoformat()],
        ["source_files", len(FILES)],
        ["status", "OK"],
    ])
    # Persistent manual fallback tab. Never clear this tab during the normal sync.
    try:
        ws = book.worksheet("DATA_OVERRIDES")
    except gspread.WorksheetNotFound:
        ws = book.add_worksheet(title="DATA_OVERRIDES", rows=1000, cols=8)
        ws.update("A1", [[
            "dataset", "name", "field", "value", "source", "updated_at", "enabled", "notes"
        ]], value_input_option="RAW")
        ws.freeze(rows=1)
        ws.format("A1:H1", {"textFormat": {"bold": True}})
    append_history(book, results)
    print(f"Google Sheets sync complete: {book.title}")


if __name__ == "__main__":
    main()
