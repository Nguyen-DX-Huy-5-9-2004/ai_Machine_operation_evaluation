import pandas as pd
import pyodbc
from tqdm import tqdm
from pathlib import Path
print("Upload file")
CSV_PATH = Path(r"G:\My Drive\OBAD\data\dataModel\l2\policy_v2\l2_multilabel_20260711_043347\ai_l2_dashboard_event_core_v2.csv")

CONN_STR = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=10.29.134.73,45193;"
    "DATABASE=i26s02004_dat_dev;"
    "UID=i26s02004;"
    "PWD=pfKJBmFdnQWrVqnJs;"
    "TrustServerCertificate=yes;"
)

TABLE = "dbo.ai_l2_dashboard_event_core_v2"

chunksize = 50000

conn = pyodbc.connect(CONN_STR)
cursor = conn.cursor()
cursor.fast_executemany = True

cols = pd.read_csv(CSV_PATH, nrows=0).columns.tolist()

insert_sql = f"""
INSERT INTO {TABLE}
({",".join(f"[{c}]" for c in cols)})
VALUES ({",".join(["?"] * len(cols))})
"""

total = 0

for chunk in tqdm(pd.read_csv(CSV_PATH, chunksize=chunksize, low_memory=False)):
    chunk = chunk.where(pd.notnull(chunk), None)

    rows = list(chunk.itertuples(index=False, name=None))

    cursor.executemany(insert_sql, rows)

    conn.commit()

    total += len(chunk)

    print("inserted:", total)

cursor.close()
conn.close()

print("DONE:", total)