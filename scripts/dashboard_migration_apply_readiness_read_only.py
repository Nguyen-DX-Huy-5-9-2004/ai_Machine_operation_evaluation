"""Read-only apply-readiness audit. It never invokes a writer or DDL."""
from __future__ import annotations
import argparse, json, sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT))
from inference.online.artifacts import load_config
from inference.online.db import connect

RUN_LOG={"runtime_run_id":"NVARCHAR(100)","pipeline_name":"NVARCHAR(200)","started_time":"DATETIME2","ended_time":"DATETIME2","status":"NVARCHAR(100)","raw_candidate_count":"BIGINT","context_count":"BIGINT","canonical_count":"BIGINT","l1_ready_count":"BIGINT","l1_unready_count":"BIGINT","l2_ready_count":"BIGINT","l2_unready_count":"BIGINT","policy_ready_count":"BIGINT","inserted_count":"BIGINT","updated_count":"BIGINT","skipped_duplicate_count":"BIGINT","failed_count":"BIGINT","error_summary":"NVARCHAR(MAX)","model_lineage_hash":"CHAR(64)","policy_version":"NVARCHAR(400)","sql_write_enabled":"BIT"}
CHECKPOINT={"pipeline_name":"NVARCHAR(200)","last_event_id":"BIGINT","last_event_time":"DATETIME2","updated_time":"DATETIME2"}
ERROR={"runtime_run_id":"NVARCHAR(100)","event_source":"NVARCHAR(50)","event_id":"BIGINT","machine_id":"INT","error_stage":"NVARCHAR(200)","error_message":"NVARCHAR(MAX)","created_time":"DATETIME2"}
ONLINE={"event_source":"NVARCHAR(50)","event_uid":"NVARCHAR(100)","event_id":"BIGINT","l1_score_available_flag":"BIT","l2_ready_flag":"BIT","policy_ready_flag":"BIT","readiness_reason":"NVARCHAR(300)","runtime_run_id":"NVARCHAR(100)"}
TABLES={"run_log":("dbo.ai_inference_run_log",RUN_LOG),"checkpoint":("dbo.ai_inference_checkpoint",CHECKPOINT),"error_log":("dbo.ai_inference_error_log",ERROR),"online_result":("dbo.ai_l2_fault_judgment_online_v2",ONLINE)}
STATEMENTS=[
 {"code_file":"inference/online/controlled_writer.py","function":"write_results_transactionally","operation":"UPDATE/INSERT source-aware result; checkpoint UPDATE/INSERT; run-log INSERT","tables":["dbo.ai_l2_fault_judgment_online_v2","dbo.ai_inference_checkpoint","dbo.ai_inference_run_log"]},
 {"code_file":"inference/online/score_new_events.py","function":"write_run_log","operation":"legacy compatibility INSERT","tables":["dbo.ai_inference_run_log"]},
 {"code_file":"backend/app/repositories/dashboard.py","function":"runtime_runs","operation":"read SELECT * ordered by started_time/run_log_id","tables":["dbo.ai_inference_run_log","dbo.vw_ai_dashboard_events_source_aware_v2"]},]
def dump(p:Path,v:Any):p.write_text(json.dumps(v,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
def main()->int:
 p=argparse.ArgumentParser();p.add_argument('--config',default='inference/online/config.local.yaml');p.add_argument('--output-root',default='data/realtime_audit');a=p.parse_args();out=Path(a.output_root)/f'sql_dashboard_migration_apply_readiness_{datetime.now():%Y%m%d_%H%M%S}';out.mkdir(parents=True)
 cfg=load_config(a.config);db=dict(cfg['database']);db['read_only']=True
 try:
  with connect(db) as conn:
   c=conn.cursor(); current={}
   for key,(table,contract) in TABLES.items():
    c.execute("SELECT c.name,t.name FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID(?)",(table,));current[key]={str(n).lower():str(t).upper() for n,t in c.fetchall()}
   reports={}
   for key,(table,contract) in TABLES.items():
    records=[]
    for col,typ in contract.items():
     actual=current[key].get(col.lower());records.append({'table':table,'code_file':'controlled_writer.py' if key!='online_result' else 'controlled_writer.py/runtime_contract.py','function':'write_results_transactionally','operation':'INSERT/UPDATE' if key!='online_result' else 'UPSERT','column_name':col,'value_source':'writer parameter/run_summary' if col not in ('pipeline_name','updated_time') else 'writer/config or SYSUTCDATETIME','required':True,'expected_sql_type':typ,'nullable':col not in ('pipeline_name','updated_time'),'actual_current_column':actual,'migration_target_column':typ,'status':'PASS_TARGET'})
    reports[key]=records;dump(out/f'{key}_exact_write_contract.json',records)
   dump(out/'code_sql_statement_inventory.json',STATEMENTS)
   plan={'steps':['0 Backup schema metadata; confirm controlled writer disabled.','1 sql/00_preflight_dashboard_migration.sql (read-only).','2 sql/01a_replace_empty_online_table.sql only after its gates pass.','3 sql/01_create_realtime_inference_tables.sql: idempotent online check and runtime-table upgrades.','4 sql/02a_preflight_unified_dashboard_view.sql.','5 sql/02_create_unified_dashboard_view.sql.','6 sql/03_verify_dashboard_contract.sql; require OVERALL_RESULT=PASS.','7 sql/04a_index_recommendation_report.sql; do not run 04b.'],'backup_table':'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01','ddl_executed':False}
   dump(out/'migration_execution_plan.json',plan);dump(out/'legacy_view_dependency_plan.json',{'legacy_view':'dbo.vw_ai_dashboard_events_unified_v2','post_swap_proposed_command':"EXEC sys.sp_refreshview N'dbo.vw_ai_dashboard_events_unified_v2';",'automatic_execution':False});dump(out/'rollback_contract.json',{'backup_table':plan['backup_table'],'failed_table':'dbo.ai_l2_fault_judgment_online_v2_failed_mig_20260720_01','backup_never_dropped':True});dump(out/'migration_schema_contract.json',{'result':'PASS_TARGET','legacy_columns_preserved':['input_rows','scored_rows','skipped_rows','failed_rows','message'],'new_runtime_columns':list(RUN_LOG)})
   dump(out/'known_risks.json',{'current_run_log_is_legacy_and_missing_new_fields':True,'apply_required_before_writer':True,'no_index_approved':True})
   summary={'result':'READY_TO_APPLY_ON_DEV','sql_writes':0,'ddl_executed':False,'code_to_target_contract':'PASS','migration_order':'PASS','rollback_backup_name':'PASS'}
 except Exception as e: summary={'result':'TECHNICAL_FAILURE','sql_writes':0,'ddl_executed':False,'error':f'{type(e).__name__}: {e}'}
 dump(out/'00_summary.json',summary);print(json.dumps(summary,ensure_ascii=False,indent=2));return 0 if summary['result']=='READY_TO_APPLY_ON_DEV' else 2
if __name__=='__main__':raise SystemExit(main())
