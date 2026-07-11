# -*- coding: utf-8 -*-
"""python prepare_datamodel_splits.py --server "YOUR_SERVER" --database "i26s02004_dat_dev" --trusted --out "C:\\Users\\huynd1\\Downloads\\OBAD\\data"

- Split theo thời gian/chuỗi trong từng machine_id bằng NTILE(100): train=70%, valid=15%, test=15%.
- Không random split để tránh rò rỉ chuỗi thời gian.
- L1 train từ normal_strict và normal_lenient.
- L2 export từ vw_ai_l2_train_final; sau khi có L1 score thì nên tạo thêm view final_with_l1_score và export lại.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys
import pandas as pd


def build_conn_str(args) -> str:
    if args.trusted:
        return (
            "DRIVER={ODBC Driver 17 for SQL Server};"
            f"SERVER={args.server};"
            f"DATABASE={args.database};"
            "Trusted_Connection=yes;"
            "TrustServerCertificate=yes;"
        )
    return (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        f"SERVER={args.server};"
        f"DATABASE={args.database};"
        f"UID={args.user};"
        f"PWD={args.password};"
        "TrustServerCertificate=yes;"
    )


def ensure_dirs(base: Path) -> dict:
    dirs = {
        "l1_strict": base / "dataModel" / "l1" / "normal_strict",
        "l1_lenient": base / "dataModel" / "l1" / "normal_lenient",
        "l1_scored": base / "dataModel" / "l1" / "scored",
        "l2": base / "dataModel" / "l2",
        "l2_scored": base / "dataModel" / "l2" / "scored",
        "derived": base / "dataDerived",
        "report": base / "dataReport",
    }
    for p in dirs.values():
        p.mkdir(parents=True, exist_ok=True)
    return dirs


def remove_old_split_files(folder: Path) -> None:
    for name in ["train.csv", "valid.csv", "test.csv"]:
        f = folder / name
        if f.exists():
            f.unlink()


def append_by_split(chunk: pd.DataFrame, folder: Path, header_state: dict) -> None:
    if "split_name" not in chunk.columns:
        raise ValueError("Query result must contain split_name column")

    for split_name, part in chunk.groupby("split_name", sort=False):
        split_name = str(split_name).lower().strip()
        if split_name not in ["train", "valid", "test"]:
            continue

        out_file = folder / f"{split_name}.csv"
        write_header = not header_state.get(str(out_file), False)
        part = part.drop(columns=["split_name"])
        part.to_csv(
            out_file,
            mode="a",
            header=write_header,
            index=False,
            encoding="utf-8-sig",
        )
        header_state[str(out_file)] = True


def export_split_query(conn, query: str, folder: Path, chunksize: int) -> None:
    remove_old_split_files(folder)
    header_state = {}
    total = 0

    for chunk in pd.read_sql_query(query, conn, chunksize=chunksize):
        total += len(chunk)
        append_by_split(chunk, folder, header_state)
        print(f"  exported {total:,} rows -> {folder}")

    print(f"Done: {folder} ({total:,} rows)")


def export_one_query(conn, query: str, out_file: Path, chunksize: int) -> None:
    if out_file.exists():
        out_file.unlink()

    total = 0
    first = True
    for chunk in pd.read_sql_query(query, conn, chunksize=chunksize):
        total += len(chunk)
        chunk.to_csv(out_file, mode="a", header=first, index=False, encoding="utf-8-sig")
        first = False
        print(f"  exported {total:,} rows -> {out_file.name}")

    print(f"Done: {out_file} ({total:,} rows)")


def split_query_for_view(view_name: str) -> str:
    return f"""
WITH ordered AS (
    SELECT
        *,
        NTILE(100) OVER (
            PARTITION BY machine_id
            ORDER BY sequence_segment_id, event_order_in_segment
        ) AS split_bucket
    FROM {view_name}
)
SELECT
    *,
    CASE
        WHEN split_bucket <= 70 THEN 'train'
        WHEN split_bucket <= 85 THEN 'valid'
        ELSE 'test'
    END AS split_name
FROM ordered
ORDER BY machine_id, sequence_segment_id, event_order_in_segment;
"""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--server", required=True, help="SQL Server name/IP")
    parser.add_argument("--database", default="i26s02004_dat_dev", help="Database name")
    parser.add_argument("--trusted", action="store_true", help="Use Windows authentication")
    parser.add_argument("--user", default=None, help="SQL username")
    parser.add_argument("--password", default=None, help="SQL password")
    parser.add_argument("--out", required=True, help="Base data folder, e.g. C:\\Users\\...\\OBAD\\data")
    parser.add_argument("--chunksize", type=int, default=100_000)
    parser.add_argument("--skip-l2", action="store_true")
    args = parser.parse_args()

    try:
        import pyodbc
    except ImportError:
        print("Missing pyodbc. Install it with: pip install pyodbc", file=sys.stderr)
        return 2

    if not args.trusted and (not args.user or not args.password):
        print("Provide --trusted or both --user and --password", file=sys.stderr)
        return 2

    base = Path(args.out)
    dirs = ensure_dirs(base)

    conn_str = build_conn_str(args)
    print("Connecting SQL Server...")
    conn = pyodbc.connect(conn_str)

    print("\n[1/4] Export L1 normal_strict split...")
    export_split_query(
        conn,
        split_query_for_view("dbo.vw_ai_l1_train_normal_strict"),
        dirs["l1_strict"],
        args.chunksize,
    )

    print("\n[2/4] Export L1 normal_lenient split...")
    export_split_query(
        conn,
        split_query_for_view("dbo.vw_ai_l1_train_normal_lenient"),
        dirs["l1_lenient"],
        args.chunksize,
    )

    print("\n[3/4] Export L2 final split...")
    if not args.skip_l2:
        export_split_query(
            conn,
            split_query_for_view("dbo.vw_ai_l2_train_final"),
            dirs["l2"],
            args.chunksize,
        )
    else:
        print("Skipped L2 export.")

    print("\n[4/4] Export derived future fault labels...")
    export_one_query(
        conn,
        """
        SELECT *
        FROM dbo.ai_l2_future_fault_label
        ORDER BY machine_id, sequence_segment_id, event_order_in_segment;
        """,
        dirs["derived"] / "ai_l2_future_fault_label.csv",
        args.chunksize,
    )

    conn.close()
    print("\nAll done.")
    print(f"Output base folder: {base}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
