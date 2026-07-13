from __future__ import annotations
import os
from contextlib import contextmanager
from typing import Optional
import pandas as pd
import pyodbc

def get_conn(conn_str_env='WELDCOM_SQL_CONN_STR'):
    conn_str=os.getenv(conn_str_env)
    if not conn_str:
        raise RuntimeError(f'Missing env var {conn_str_env}')
    return pyodbc.connect(conn_str)

@contextmanager
def connect(conn_str_env='WELDCOM_SQL_CONN_STR'):
    conn=get_conn(conn_str_env)
    try: yield conn
    finally: conn.close()

def read_sql(conn, sql, params:Optional[tuple]=None):
    return pd.read_sql(sql, conn, params=params or ())

def execute(conn, sql, params:Optional[tuple]=None, commit=True):
    cur=conn.cursor(); cur.execute(sql, params or ())
    if commit: conn.commit()

def bulk_insert_dataframe(conn, table, df, chunksize=1000):
    if df.empty: return 0
    cols=df.columns.tolist()
    sql=f"INSERT INTO {table} ({','.join(f'[{c}]' for c in cols)}) VALUES ({','.join(['?']*len(cols))})"
    cur=conn.cursor(); cur.fast_executemany=True
    total=0
    rows=[tuple(None if pd.isna(v) else v for v in row) for row in df.itertuples(index=False, name=None)]
    for i in range(0,len(rows),chunksize):
        cur.executemany(sql, rows[i:i+chunksize]); conn.commit(); total += len(rows[i:i+chunksize])
    return total
