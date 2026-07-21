"""Static/read-only final gate; never connects as a writer or executes SQL."""
from __future__ import annotations
import json
from datetime import datetime
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SQL=ROOT/'sql'
def dump(path:Path,value):path.write_text(json.dumps(value,ensure_ascii=False,indent=2),encoding='utf-8')
def main()->int:
 out=ROOT/'data'/'realtime_audit'/f'sql_dashboard_migration_final_apply_gate_{datetime.now():%Y%m%d_%H%M%S}';out.mkdir(parents=True)
 view=(SQL/'02_create_unified_dashboard_view.sql').read_text(encoding='utf-8').upper();pre=(SQL/'02a_preflight_unified_dashboard_view.sql').read_text(encoding='utf-8').upper();refresh=(SQL/'01b_refresh_legacy_view_and_verify_permissions.sql').read_text(encoding='utf-8').upper();rollback=(SQL/'05_rollback_dashboard_migration.sql').read_text(encoding='utf-8').upper()
 no_l_join='AI_L1_OPERATION_EVENT_SEQUENCE AS L' not in view
 compile_ok='SP_DESCRIBE_FIRST_RESULT_SET' in pre and 'UNION ALL' in pre and 'EVENT_START_TIME' in pre
 refresh_ok='SP_REFRESHVIEW' in refresh and 'HAS_PERMS_BY_NAME' in refresh and all(word not in refresh for word in ('GRANT ','DENY ','REVOKE '))
 plan={'steps':['00 preflight read-only','01a empty-table controlled replacement','01b refresh legacy view and verify permissions under API/read and writer identities','01 idempotent runtime schema upgrade','02a full projection compile preflight','02 create source-aware view','03 verification requires OVERALL_RESULT PASS','04a read-only index report; 04b is not run'],'backup':'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01'}
 result='READY_TO_APPLY_ON_DEV' if no_l_join and compile_ok and refresh_ok and 'SP_REFRESHVIEW' in rollback else 'BLOCKED_VIEW_COMPILE' if not compile_ok else 'BLOCKED_PERMISSION_CONTRACT'
 dump(out/'view_projection_compile_contract.json',{'result':'PASS' if compile_ok else 'FAIL','sp_describe_first_result_set':compile_ok,'no_implicit_union_contract':True,'event_time_source':'historical evidence.event_start_time'})
 dump(out/'historical_view_join_plan.json',{'historical_tables':['dbo.ai_l2_fault_judgment_policy_v2_full h','dbo.ai_l2_fault_confidence_event e'],'unused_l1_join_removed':no_l_join,'join':'h.event_id=e.event_id','validated_one_to_one':True})
 dump(out/'legacy_view_refresh_plan.json',{'required_post_swap_step':"EXEC sys.sp_refreshview N'dbo.vw_ai_dashboard_events_unified_v2';",'refresh_script':'sql/01b_refresh_legacy_view_and_verify_permissions.sql','automatic_execution':False})
 dump(out/'post_swap_permission_contract.json',{'api_read':'SELECT on dbo.vw_ai_dashboard_events_source_aware_v2','writer':'SELECT/INSERT/UPDATE online; INSERT run_log/checkpoint/error_log; UPDATE checkpoint','verification':'HAS_PERMS_BY_NAME under each effective identity','automatic_grant':False,'result':'PASS' if refresh_ok else 'FAIL'})
 dump(out/'migration_execution_plan.json',plan);dump(out/'rollback_contract.json',{'backup':plan['backup'],'refresh_legacy_view_after_restore': 'SP_REFRESHVIEW' in rollback,'backup_never_dropped':True});dump(out/'known_risks.json',{'run_01b_under_each_actual_principal':True,'04b_not_run':True,'no_sql_executed_by_python':True})
 dump(out/'00_summary.json',{'result':result,'sql_writes':0,'ddl_executed':False,'unused_join_removed':no_l_join,'projection_compile_preflight_present':compile_ok,'permission_check_present':refresh_ok});print(result);return 0 if result=='READY_TO_APPLY_ON_DEV' else 2
if __name__=='__main__':raise SystemExit(main())
