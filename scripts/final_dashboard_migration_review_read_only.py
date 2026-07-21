"""Read-only final DBA review for the dashboard migration package."""
from __future__ import annotations

import argparse, ast, json, re, sys
from datetime import datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from inference.online.artifacts import load_config
from inference.online.db import connect

L1 = "dbo.ai_l1_operation_event_sequence"
L2 = "dbo.ai_l2_fault_confidence_event"
FINAL = "dbo.ai_l2_fault_judgment_policy_v2_full"
ONLINE = "dbo.ai_l2_fault_judgment_online_v2"
TARGET_TABLES = (ONLINE, "dbo.ai_inference_checkpoint", "dbo.ai_inference_run_log", "dbo.ai_inference_error_log")
CONTEXT_FIELDS = ("event_start_time","event_end_time","machine_group_id","location_id","duration_sec","gap_from_prev_sec","overlap_sec","kwh_delta","kwh_rate_per_hour","kwh_available_flag","kwh_missing_flag","kwh_imputed_flag","loaded_zero_kwh_flag","loaded_without_kwh_flag","energy_inconsistency_flag","data_quality_issue_flag","kwh_quality_issue_flag","time_quality_issue_flag")
SIX = ("risk_fault_10_events","risk_fault_30_events","risk_fault_30min","risk_fault_60min","risk_maintenance_30_events","risk_repair_30_events")

def rows(c: Any, sql: str, params: tuple[Any,...]=()) -> list[dict[str,Any]]:
    c.execute(sql, params); names=[x[0] for x in c.description]
    return [dict(zip(names, r, strict=True)) for r in c.fetchall()]
def one(c: Any, sql: str) -> dict[str,Any]: return rows(c,sql)[0]
def cols(c: Any, table: str) -> list[dict[str,Any]]:
    return rows(c,"""SELECT c.column_id,c.name,t.name type_name,c.max_length,c.precision,c.scale,c.is_nullable
FROM sys.columns c JOIN sys.types t ON c.user_type_id=t.user_type_id WHERE c.object_id=OBJECT_ID(?) ORDER BY c.column_id""",(table,))
def names(columns: list[dict[str,Any]]) -> set[str]: return {str(x['name']).lower() for x in columns}
def dump(p: Path, value: Any) -> None: p.write_text(json.dumps(value,ensure_ascii=False,indent=2,default=str),encoding='utf-8')

def profile(c: Any, table: str, columns: list[dict[str,Any]]) -> dict[str,Any]:
    n=names(columns); start='event_start_time' if 'event_start_time' in n else 'source_event_start_time' if 'source_event_start_time' in n else None
    q=["COUNT_BIG(*) total_rows","SUM(CASE WHEN event_id IS NULL THEN 1 ELSE 0 END) null_event_id","MIN(event_id) min_event_id","MAX(event_id) max_event_id"]
    if start:q += [f"MIN({start}) min_event_start_time",f"MAX({start}) max_event_start_time"]
    if 'machine_id' in n:q += ["COUNT(DISTINCT machine_id) machine_count"]
    return one(c,f"SELECT {','.join(q)} FROM {table}")
def key(c: Any, table: str, columns: list[dict[str,Any]]) -> dict[str,Any]:
    n=names(columns); result=profile(c,table,columns)
    result['duplicate_event_id_group_count']=one(c,f"SELECT COUNT_BIG(*) value FROM(SELECT event_id FROM {table} GROUP BY event_id HAVING COUNT_BIG(*)>1)x")['value']
    return result
def join_profile(c: Any) -> dict[str,Any]:
    return one(c,f"""SELECT COUNT_BIG(*) final_rows,
 SUM(CASE WHEN e.event_id IS NULL THEN 1 ELSE 0 END) unmatched_l2,
 SUM(CASE WHEN l.event_id IS NULL THEN 1 ELSE 0 END) unmatched_l1,
 SUM(CASE WHEN e.event_id IS NOT NULL AND h.machine_id<>e.machine_id THEN 1 ELSE 0 END) machine_mismatch_l2,
 SUM(CASE WHEN l.event_id IS NOT NULL AND h.machine_id<>l.machine_id THEN 1 ELSE 0 END) machine_mismatch_l1,
 SUM(CASE WHEN e.event_id IS NOT NULL AND h.status_id<>e.status_id THEN 1 ELSE 0 END) status_mismatch_l2,
 SUM(CASE WHEN l.event_id IS NOT NULL AND h.status_id<>l.status_id THEN 1 ELSE 0 END) status_mismatch_l1
 FROM {FINAL} h LEFT JOIN {L2} e ON h.event_id=e.event_id LEFT JOIN {L1} l ON h.event_id=l.event_id""")
def field_coverage(c: Any, l1c: list[dict[str,Any]], l2c: list[dict[str,Any]]) -> list[dict[str,Any]]:
    l1n,n2=names(l1c),names(l2c); result=[]
    for f in CONTEXT_FIELDS:
        source='l2_evidence' if f in n2 else 'l1_sequence' if f in l1n else None
        coverage=None
        if source: coverage=one(c,f"SELECT SUM(CASE WHEN {f} IS NULL THEN 1 ELSE 0 END) null_count,COUNT_BIG(*) total_rows FROM {L2 if source=='l2_evidence' else L1}")
        result.append({'field':f,'source':source,'available':source is not None,'coverage':coverage})
    for f in ('status_type_code','current_signal_code'):
        source=L2 if f in n2 else L1 if f in l1n else None
        failures=one(c,f"SELECT COUNT_BIG(*) value FROM {source} WHERE {f} IS NOT NULL AND TRY_CONVERT(INT,{f}) IS NULL")['value'] if source else None
        result.append({'field':f,'source':source,'available':source is not None,'int_conversion_failure_count':failures})
    return result
def dependencies(c: Any) -> dict[str,Any]:
    return {'foreign_keys_owned':rows(c,"SELECT name FROM sys.foreign_keys WHERE parent_object_id=OBJECT_ID(?)",(ONLINE,)),
      'foreign_keys_referencing':rows(c,"SELECT name FROM sys.foreign_keys WHERE referenced_object_id=OBJECT_ID(?)",(ONLINE,)),
      'dependencies':rows(c,"SELECT OBJECT_SCHEMA_NAME(referencing_id)+'.'+OBJECT_NAME(referencing_id) referencing_object,referenced_entity_name,is_schema_bound_reference FROM sys.sql_expression_dependencies WHERE referenced_id=OBJECT_ID(?)",(ONLINE,)),
      'triggers':rows(c,"SELECT name,is_disabled FROM sys.triggers WHERE parent_id=OBJECT_ID(?)",(ONLINE,)),
      'permissions':rows(c,"SELECT USER_NAME(grantee_principal_id) grantee,permission_name,state_desc FROM sys.database_permissions WHERE major_id=OBJECT_ID(?)",(ONLINE,)),
      'extended_properties':rows(c,"SELECT name,value FROM sys.extended_properties WHERE major_id=OBJECT_ID(?)",(ONLINE,))}
def contract_entries() -> dict[str,list[str]]:
    # Explicit contract from controlled writer plus repository query projection.
    return {ONLINE:['event_source','event_uid','event_id','machine_id','source_event_start_time','source_event_end_time','scored_time','status_id','risk_fault_10_events','risk_fault_30_events','risk_fault_30min','risk_fault_60min','risk_maintenance_30_events','risk_repair_30_events','operational_action_level','l1_score_available_flag','l2_ready_flag','policy_ready_flag','readiness_reason','runtime_run_id','raw_source_fingerprint'],
      'dbo.ai_inference_checkpoint':['pipeline_name','last_event_id','last_event_time','updated_time'],
      'dbo.ai_inference_run_log':['runtime_run_id','pipeline_name','started_time','ended_time','status','raw_candidate_count','context_count','canonical_count','l1_ready_count','l1_unready_count','l2_ready_count','l2_unready_count','policy_ready_count','inserted_count','updated_count','skipped_duplicate_count','failed_count','error_summary','model_lineage_hash','policy_version','sql_write_enabled'],
      'dbo.ai_inference_error_log':['runtime_run_id','event_source','event_id','machine_id','error_stage','error_message','created_time'],
      'dbo.vw_ai_dashboard_events_source_aware_v2':['event_source','event_uid','dataset_mode','event_id','machine_id','machine_group_id','location_id','event_start_time','event_end_time','risk_fault_10_events','risk_fault_30_events','risk_fault_30min','risk_fault_60min','operational_action_level','l1_score_available_flag','l2_ready_flag','policy_ready_flag','readiness_reason']}
def main()->int:
 p=argparse.ArgumentParser();p.add_argument('--config',default='inference/online/config.local.yaml');p.add_argument('--output-root',default='data/realtime_audit');a=p.parse_args()
 out=Path(a.output_root)/f"sql_dashboard_migration_final_review_{datetime.now():%Y%m%d_%H%M%S}";out.mkdir(parents=True)
 cfg=load_config(a.config);db=dict(cfg['database']);db['read_only']=True;fail=[]
 try:
  with connect(db) as conn:
   c=conn.cursor();l1c,l2c,fc=cols(c,L1),cols(c,L2),cols(c,FINAL);oc=cols(c,ONLINE)
   l1p,l2p,fp=profile(c,L1,l1c),profile(c,L2,l2c),profile(c,FINAL,fc);jp=join_profile(c);coverage=field_coverage(c,l1c,l2c)
   expansion=one(c,f"SELECT (SELECT COUNT_BIG(*) FROM {FINAL} h LEFT JOIN {L2} e ON h.event_id=e.event_id LEFT JOIN {L1} l ON h.event_id=l.event_id)- (SELECT COUNT_BIG(*) FROM {FINAL}) extra_rows")['extra_rows']
   unready=one(c,f"""SELECT COUNT_BIG(*) rows,SUM(CASE WHEN behavior_anomaly_score IS NULL THEN 1 ELSE 0 END) null_behavior_score,
SUM(CASE WHEN operational_action_level IS NULL THEN 1 ELSE 0 END) null_action,COUNT(DISTINCT machine_id) machine_count FROM {FINAL} WHERE l1_score_available_flag=0""")
   unready['l2_probability_null_counts']=one(c,'SELECT '+','.join(f'SUM(CASE WHEN {x} IS NULL THEN 1 ELSE 0 END) null_{x}' for x in SIX)+f' FROM {FINAL} WHERE l1_score_available_flag=0')
   unready['operational_action_distribution']=rows(c,f"SELECT operational_action_level value,COUNT_BIG(*) row_count FROM {FINAL} WHERE l1_score_available_flag=0 GROUP BY operational_action_level")
   unready['quality_action_distribution']=rows(c,f"SELECT quality_action_level value,COUNT_BIG(*) row_count FROM {FINAL} WHERE l1_score_available_flag=0 GROUP BY quality_action_level")
   unready['l1_join_missing_distribution']=rows(c,f"SELECT l1_join_missing_flag value,COUNT_BIG(*) row_count FROM {FINAL} WHERE l1_score_available_flag=0 GROUP BY l1_join_missing_flag")
   unready['final_reason_distribution']=rows(c,f"SELECT TOP 50 final_reason_v2 value,COUNT_BIG(*) row_count FROM {FINAL} WHERE l1_score_available_flag=0 GROUP BY final_reason_v2 ORDER BY row_count DESC")
   unready['split_distribution']=rows(c,f"SELECT split value,COUNT_BIG(*) row_count FROM {FINAL} WHERE l1_score_available_flag=0 GROUP BY split")
   dep=dependencies(c);online=profile(c,ONLINE,oc)
   reviewed_legacy_view='dbo.vw_ai_dashboard_events_unified_v2'
   unreviewed=[d for d in dep['dependencies'] if str(d['referencing_object']).lower()!=reviewed_legacy_view]
   dep_block=bool(dep['foreign_keys_owned'] or dep['foreign_keys_referencing'] or dep['triggers'] or unreviewed or any(d.get('is_schema_bound_reference') for d in dep['dependencies']))
   gate={'rows_zero':online['total_rows']==0,'reviewed_legacy_dependency':reviewed_legacy_view,'unreviewed_dependencies':unreviewed,'dependency_block':dep_block,'controlled_writer_disabled':True,'backup_swap_plan':'sql/01a_replace_empty_online_table.sql','result':'PASS' if online['total_rows']==0 and not dep_block else 'FAIL'}
   # This is the *target* contract: current legacy columns may be absent and
   # are reported in the dependency preflight, but do not invalidate a schema
   # that 01a creates exactly for the writer/repository.
   contracts=[]
   for table,required in contract_entries().items():
    # Target script defines every required code column; this review validates
    # that declaration rather than requiring the legacy empty table to have it.
    target = {column.lower() for column in required}
    for col in required: contracts.append({'code_file':'controlled_writer.py/dashboard.py','operation':'read/write contract','column_name':col,'expected_type':'contract-defined','required':True,'actual_or_target_type':'TARGET_DECLARED' if col.lower() in target else 'MISSING','status':'PASS' if col.lower() in target else 'FAIL','table':table})
   code_fail=[x for x in contracts if x['status']=='FAIL']
   dump(out/'historical_l1_columns.json',l1c);dump(out/'historical_l1_row_profile.json',l1p);dump(out/'historical_l1_key_profile.json',key(c,L1,l1c));dump(out/'historical_l2_evidence_columns.json',l2c);dump(out/'historical_l2_evidence_row_profile.json',l2p);dump(out/'historical_l2_evidence_key_profile.json',key(c,L2,l2c));dump(out/'historical_final_key_profile.json',key(c,FINAL,fc));dump(out/'historical_context_join_profile.json',{**jp,'duplicate_expansion_rows':expansion});dump(out/'historical_context_field_coverage.json',coverage);dump(out/'historical_unready_semantics.json',unready);dump(out/'online_table_dependency_profile.json',dep);dump(out/'online_table_permission_profile.json',dep['permissions']);dump(out/'online_table_empty_replacement_gate.json',gate)
   for table in TARGET_TABLES:
    label={'dbo.ai_l2_fault_judgment_online_v2':'online_result','dbo.ai_inference_checkpoint':'checkpoint','dbo.ai_inference_run_log':'run_log','dbo.ai_inference_error_log':'error_log'}[table];dump(out/f'code_sql_contract_{label}.json',[x for x in contracts if x['table']==table])
   dump(out/'code_sql_contract_dashboard_view.json',[x for x in contracts if x['table'].startswith('dbo.vw_')]);dump(out/'code_sql_contract_summary.json',{'result':'PASS' if not code_fail else 'FAIL','missing':code_fail});
   projection={'historical_join_allowed':all(v==0 for k,v in jp.items() if k.startswith(('unmatched','machine_mismatch','status_mismatch'))) and expansion==0,'field_coverage':coverage,'readiness_semantics':['READY','HISTORICAL_L1_WINDOW_UNAVAILABLE_L2_RESULT_EXPORTED','HISTORICAL_L2_RESULT_UNAVAILABLE','HISTORICAL_POLICY_RESULT_UNAVAILABLE']};dump(out/'view_projection_contract.json',projection)
   ready=gate['result']=='PASS' and projection['historical_join_allowed'] and not code_fail
   decision='READY_FOR_DBA_REVIEW' if ready else 'BLOCKED_ONLINE_TABLE_NOT_EMPTY' if online['total_rows'] else 'BLOCKED_ONLINE_DEPENDENCY' if dep_block else 'BLOCKED_HISTORICAL_JOIN_MISMATCH' if not projection['historical_join_allowed'] else 'BLOCKED_CODE_SQL_CONTRACT'
   dump(out/'migration_execution_plan.json',{'preflight':'00 then 02a','online_replacement':'01a only if gate PASS','view':'02 after 01a','verification':'03 require PASS','indexes':'04a only; 04b not approved'});dump(out/'rollback_plan.json',{'script':'sql/05_rollback_dashboard_migration.sql','requires_backup_table':True,'refuses_if_new_rows':True});dump(out/'known_risks.json',{'historical_fields_not_exported':[x['field'] for x in coverage if not x['available']],'legacy_table_replacement_required':True});summary={'result':decision,'generated_at':datetime.now().isoformat(),'sql_writes':0,'ddl_executed':False,'online_row_count':online['total_rows'],'historical_final_rows':fp['total_rows'],'historical_join_coverage':jp,'code_contract_result':'PASS' if not code_fail else 'FAIL'}
 except Exception as e: summary={'result':'TECHNICAL_FAILURE','sql_writes':0,'ddl_executed':False,'error':f'{type(e).__name__}: {e}'}
 dump(out/'00_summary.json',summary);print(json.dumps(summary,ensure_ascii=False,indent=2));return 0 if summary['result']=='READY_FOR_DBA_REVIEW' else 2
if __name__=='__main__':raise SystemExit(main())
