from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Iterable

try:
    import pyodbc
except ImportError as exc:
    raise SystemExit(
        "pyodbc is required. Run: .\\.venv\\Scripts\\python.exe -m pip install pyodbc"
    ) from exc


NULL_TOKENS = {"", "nan", "none", "null", "nat", "<na>"}


def detect_encoding(path: Path) -> str:
    with path.open("rb") as fh:
        head = fh.read(4)
    if head.startswith(b"\xff\xfe") or head.startswith(b"\xfe\xff"):
        return "utf-16"
    if head.startswith(b"\xef\xbb\xbf"):
        return "utf-8-sig"
    for enc in ("utf-8-sig", "utf-8", "utf-16", "cp1258"):
        try:
            with path.open("r", encoding=enc, newline="") as fh:
                fh.readline()
            return enc
        except UnicodeError:
            continue
    raise UnicodeError(f"Cannot detect CSV encoding: {path}")


def sha256_file(path: Path, block_size: int = 8 * 1024 * 1024) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as fh:
        while True:
            block = fh.read(block_size)
            if not block:
                break
            digest.update(block)
    return digest.hexdigest()


def quote_identifier(name: str) -> str:
    return "[" + name.replace("]", "]]") + "]"


def split_table_name(name: str) -> tuple[str, str]:
    if "." not in name:
        return "dbo", name
    schema, table = name.split(".", 1)
    return schema, table


def connection_string(args: argparse.Namespace) -> str:
    driver = args.driver or os.getenv("OBAD_SQL_DRIVER", "ODBC Driver 18 for SQL Server")
    server = args.server or os.getenv("OBAD_SQL_SERVER", "localhost")
    database = args.database or os.getenv("OBAD_SQL_DATABASE", "OBAD_AI_LOCAL")
    trusted = (os.getenv("OBAD_SQL_TRUSTED", "yes").strip().lower() in {"1", "true", "yes", "y"})
    parts = [
        f"DRIVER={{{driver}}}",
        f"SERVER={server}",
        f"DATABASE={database}",
        "TrustServerCertificate=yes",
        "Encrypt=no",
    ]
    if trusted:
        parts.append("Trusted_Connection=yes")
    else:
        user = os.getenv("OBAD_SQL_USER")
        password = os.getenv("OBAD_SQL_PASSWORD")
        if not user or password is None:
            raise SystemExit("Set OBAD_SQL_USER and OBAD_SQL_PASSWORD when OBAD_SQL_TRUSTED=no")
        parts.extend([f"UID={user}", f"PWD={password}"])
    return ";".join(parts)


def get_table_columns(cursor: Any, table_name: str) -> list[dict[str, Any]]:
    schema, table = split_table_name(table_name)
    rows = cursor.execute(
        """
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA=? AND TABLE_NAME=?
        ORDER BY ORDINAL_POSITION
        """,
        schema,
        table,
    ).fetchall()
    if not rows:
        raise RuntimeError(f"Target table does not exist: {table_name}")
    return [
        {
            "name": str(r[0]),
            "type": str(r[1]).lower(),
            "nullable": str(r[2]).upper() == "YES",
            "ordinal": int(r[3]),
        }
        for r in rows
    ]


def table_row_count(cursor: Any, table_name: str) -> int:
    row = cursor.execute(f"SELECT COUNT_BIG(*) FROM {table_name}").fetchone()
    return int(row[0])


def infer_sql_type(column: str) -> str:
    c = column.lower()
    if c in {"event_id", "sequence_segment_id", "event_order_in_segment"}:
        return "BIGINT NULL"
    if c in {"machine_id", "status_id", "machine_group_id", "location_id", "hour_of_day",
             "day_of_week", "data_quality_issue_count", "fault_evidence_count",
             "maintenance_evidence_count"}:
        return "INT NULL"
    if c.endswith("_time") or c in {"event_start_time", "event_end_time", "created_time"}:
        return "DATETIME2(7) NULL"
    if c.startswith(("is_", "has_", "known_", "off_", "pred_", "policy_pred_")) or c.endswith("_flag"):
        return "BIT NULL"
    if c.startswith("profile_"):
        return "NVARCHAR(100) NULL"
    if any(token in c for token in (
        "score", "risk", "threshold", "duration", "gap", "overlap", "kwh", "rate",
        "error", "confidence", "ratio", "log"
    )):
        return "FLOAT NULL"
    if any(token in c for token in ("reason", "judgment", "explanation")):
        return "NVARCHAR(2000) NULL"
    return "NVARCHAR(1000) NULL"


def add_missing_columns(
    cursor: Any,
    table_name: str,
    missing: list[str],
    database: str,
    confirmation: str | None,
) -> None:
    required = f"I_UNDERSTAND_THIS_IS_LOCAL_{database.upper()}"
    if confirmation != required:
        raise RuntimeError(
            "CSV has columns absent from the target table. To add them on a local DB, pass "
            f"--local-confirmation {required}"
        )
    if "_LOCAL" not in database.upper():
        raise RuntimeError("Automatic ALTER TABLE is allowed only when database name contains _LOCAL")
    for col in missing:
        sql_type = infer_sql_type(col)
        cursor.execute(
            f"ALTER TABLE {table_name} ADD {quote_identifier(col)} {sql_type}"
        )
        print(f"  added missing local column: {col} {sql_type}", flush=True)


def convert_value(value: str | None, data_type: str) -> Any:
    if value is None:
        return None
    text = value.strip()
    if text.lower() in NULL_TOKENS:
        return None
    try:
        if data_type in {"bigint", "int", "smallint", "tinyint"}:
            return int(float(text))
        if data_type in {"float", "real", "decimal", "numeric", "money", "smallmoney"}:
            number = float(text)
            return None if not math.isfinite(number) else number
        if data_type == "bit":
            lowered = text.lower()
            if lowered in {"1", "true", "yes", "y"}:
                return 1
            if lowered in {"0", "false", "no", "n"}:
                return 0
            return int(float(text))
        if data_type in {"datetime", "datetime2", "smalldatetime", "date", "time"}:
            # SQL Server can reliably parse the ISO-like formats generated by pandas.
            return text
        return text
    except Exception as exc:
        raise ValueError(f"Cannot convert {text!r} to {data_type}") from exc


def iter_csv_rows(
    path: Path,
    encoding: str,
    fieldnames: list[str],
    type_map: dict[str, str],
) -> Iterable[tuple[Any, ...]]:
    with path.open("r", encoding=encoding, newline="") as fh:
        reader = csv.DictReader(fh)
        actual = reader.fieldnames or []
        if actual != fieldnames:
            raise RuntimeError(
                f"Header changed between inspection and import for {path}: "
                f"{actual[:10]} != {fieldnames[:10]}"
            )
        for row_number, row in enumerate(reader, start=2):
            extra = row.get(None)
            if extra:
                raise RuntimeError(f"Malformed CSV row {row_number}: too many fields")
            try:
                yield tuple(convert_value(row[name], type_map[name]) for name in fieldnames)
            except Exception as exc:
                raise RuntimeError(f"{path.name}: row {row_number}: {exc}") from exc


def batched(iterator: Iterable[tuple[Any, ...]], size: int) -> Iterable[list[tuple[Any, ...]]]:
    batch: list[tuple[Any, ...]] = []
    for row in iterator:
        batch.append(row)
        if len(batch) >= size:
            yield batch
            batch = []
    if batch:
        yield batch


def inspect_header(path: Path, encoding: str) -> list[str]:
    with path.open("r", encoding=encoding, newline="") as fh:
        reader = csv.reader(fh)
        header = next(reader)
    header = [h.strip().lstrip("\ufeff") for h in header]
    if not header or any(not h for h in header):
        raise RuntimeError(f"Invalid/empty header: {path}")
    duplicates = sorted({h for h in header if header.count(h) > 1})
    if duplicates:
        raise RuntimeError(f"Duplicate header columns in {path}: {duplicates}")
    return header


def import_table(
    conn: Any,
    root: Path,
    entry: dict[str, Any],
    args: argparse.Namespace,
    audit: dict[str, Any],
) -> None:
    table_name = entry["table"]
    csv_path = root / entry["path"]
    required = bool(entry.get("required", True))

    print("=" * 88)
    print(f"TABLE: {table_name}")
    print(f"CSV  : {csv_path}")

    if not csv_path.exists():
        if required:
            raise FileNotFoundError(csv_path)
        print("OPTIONAL FILE MISSING -> SKIPPED")
        audit["tables"].append({
            "table": table_name,
            "path": str(csv_path),
            "status": "SKIPPED_OPTIONAL_MISSING",
        })
        return

    encoding = detect_encoding(csv_path)
    header = inspect_header(csv_path, encoding)
    print(f"encoding={encoding}; columns={len(header)}; size={csv_path.stat().st_size:,}")

    cursor = conn.cursor()
    columns = get_table_columns(cursor, table_name)
    table_map = {c["name"]: c for c in columns}
    missing = [c for c in header if c not in table_map]

    if missing:
        if not args.add_missing_columns:
            raise RuntimeError(f"{table_name} is missing CSV columns: {missing}")
        add_missing_columns(
            cursor,
            table_name,
            missing,
            args.database or os.getenv("OBAD_SQL_DATABASE", "OBAD_AI_LOCAL"),
            args.local_confirmation,
        )
        conn.commit()
        columns = get_table_columns(cursor, table_name)
        table_map = {c["name"]: c for c in columns}

    existing = table_row_count(cursor, table_name)
    expected = entry.get("expectedRows")
    if existing:
        if args.skip_existing_matching and expected is not None and existing == int(expected):
            print(f"table already has expected row count {existing:,} -> SKIPPED")
            audit["tables"].append({
                "table": table_name,
                "path": str(csv_path),
                "status": "SKIPPED_EXISTING_MATCHING",
                "rows": existing,
            })
            return
        raise RuntimeError(
            f"{table_name} is not empty ({existing:,} rows). "
            "The importer will not append or truncate automatically."
        )

    type_map = {name: table_map[name]["type"] for name in header}
    placeholders = ",".join("?" for _ in header)
    column_sql = ",".join(quote_identifier(name) for name in header)
    insert_sql = f"INSERT INTO {table_name} ({column_sql}) VALUES ({placeholders})"

    digest = sha256_file(csv_path)
    print(f"sha256={digest}")

    import_cursor = conn.cursor()
    import_cursor.fast_executemany = True
    start = time.perf_counter()
    inserted = 0
    try:
        rows = iter_csv_rows(csv_path, encoding, header, type_map)
        for batch in batched(rows, args.batch_size):
            import_cursor.executemany(insert_sql, batch)
            conn.commit()
            inserted += len(batch)
            if inserted % args.progress_every < len(batch):
                elapsed = time.perf_counter() - start
                rate = inserted / elapsed if elapsed else 0.0
                print(f"  inserted={inserted:,}; rate={rate:,.1f} rows/s", flush=True)
    except Exception:
        conn.rollback()
        raise

    elapsed = time.perf_counter() - start
    final_count = table_row_count(conn.cursor(), table_name)
    status = "PASS" if final_count == inserted else "ROW_COUNT_MISMATCH"
    print(f"DONE inserted={inserted:,}; table_count={final_count:,}; seconds={elapsed:,.1f}")

    if expected is not None and final_count != int(expected):
        print(
            f"WARNING expectedRows={int(expected):,} but imported={final_count:,}. "
            "Do not create final indexes/view until reconciled.",
            flush=True,
        )

    audit["tables"].append({
        "table": table_name,
        "path": str(csv_path),
        "status": status,
        "encoding": encoding,
        "columnCount": len(header),
        "rowsInserted": inserted,
        "tableRowCount": final_count,
        "expectedRows": expected,
        "sha256": digest,
        "seconds": elapsed,
    })


def main() -> int:
    parser = argparse.ArgumentParser(description="Safe local import for Weldcom AI historical CSV files.")
    parser.add_argument("--root", default=r"E:\OBAD")
    parser.add_argument("--manifest", required=True)
    parser.add_argument("--server")
    parser.add_argument("--database", default=os.getenv("OBAD_SQL_DATABASE", "OBAD_AI_LOCAL"))
    parser.add_argument("--driver")
    parser.add_argument("--batch-size", type=int, default=1000)
    parser.add_argument("--progress-every", type=int, default=50000)
    parser.add_argument("--inspect-only", action="store_true")
    parser.add_argument("--skip-existing-matching", action="store_true")
    parser.add_argument("--add-missing-columns", action="store_true")
    parser.add_argument("--local-confirmation")
    parser.add_argument("--audit-dir")
    args = parser.parse_args()

    root = Path(args.root).resolve()
    manifest_path = Path(args.manifest)
    if not manifest_path.is_absolute():
        manifest_path = root / manifest_path
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))

    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    audit_dir = Path(args.audit_dir) if args.audit_dir else root / "data" / "realtime_audit" / f"local_historical_import_{stamp}"
    audit_dir.mkdir(parents=True, exist_ok=True)

    audit: dict[str, Any] = {
        "startedAt": datetime.now().isoformat(),
        "root": str(root),
        "manifest": str(manifest_path),
        "database": args.database,
        "inspectOnly": args.inspect_only,
        "tables": [],
    }

    if args.inspect_only:
        for entry in manifest["tables"]:
            path = root / entry["path"]
            if not path.exists():
                status = "MISSING_REQUIRED" if entry.get("required", True) else "MISSING_OPTIONAL"
                audit["tables"].append({"table": entry["table"], "path": str(path), "status": status})
                print(f"{status}: {path}")
                continue
            enc = detect_encoding(path)
            header = inspect_header(path, enc)
            digest = sha256_file(path)
            audit["tables"].append({
                "table": entry["table"],
                "path": str(path),
                "status": "INSPECTED",
                "encoding": enc,
                "columnCount": len(header),
                "columns": header,
                "sizeBytes": path.stat().st_size,
                "sha256": digest,
            })
            print(f"INSPECTED {path}: encoding={enc}, columns={len(header)}, sha256={digest}")
    else:
        conn = pyodbc.connect(connection_string(args), autocommit=False)
        try:
            for entry in manifest["tables"]:
                import_table(conn, root, entry, args, audit)
        finally:
            conn.close()

    audit["completedAt"] = datetime.now().isoformat()
    audit_path = audit_dir / "00_import_summary.json"
    audit_path.write_text(json.dumps(audit, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    print("=" * 88)
    print(f"AUDIT: {audit_path}")
    print("IMPORT COMPLETE")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
