from __future__ import annotations
import argparse
from pathlib import Path
import pandas as pd, yaml
from .db import connect, read_sql, execute, bulk_insert_dataframe
from .sql_queries import q_get_checkpoint,q_update_checkpoint,q_load_candidate_events,q_load_context_events_for_machines,q_load_active_location
from .feature_builder_realtime import build_l1_l2_event_features
from .l1_scorer_adapter import L1ScorerAdapter
from .l2_scorer import L2ProductionScorer
from .policy_engine import apply_policy_v2

def load_yaml(p):
    with Path(p).open('r',encoding='utf-8') as f: return yaml.safe_load(f)
def ints(vals): return ','.join(str(int(v)) for v in sorted(set(vals))) or '-999999'
def closed_only(df): return df[df['is_open_event']==0].copy() if not df.empty else df

def output_columns(df):
    cols=['event_id','machine_id','event_start_time','event_end_time','status_id','status_type_code','current_signal_code','risk_fault_10_events','risk_fault_30_events','risk_fault_30min','risk_fault_60min','risk_maintenance_30_events','risk_repair_30_events','operational_action_level','operational_judgment','operational_fault_confidence_score','operational_maintenance_confidence_score','operational_repair_confidence_score','operational_overall_risk_score','quality_action_level','quality_judgment','quality_risk_score','data_quality_issue_flag','energy_inconsistency_flag','kwh_quality_issue_flag','time_quality_issue_flag','is_behavior_anomaly','is_sensitive_warning','behavior_anomaly_score','behavior_sensitive_score','behavior_combined_score','l1_score_available_flag','l1_join_missing_flag','final_reason_v2','l2_run_id','policy_version','inference_version']
    return df.reindex(columns=cols).rename(columns={'event_start_time':'source_event_start_time','event_end_time':'source_event_end_time'})

def main():
    ap=argparse.ArgumentParser(); ap.add_argument('--config',default='config/realtime.yaml'); ap.add_argument('--dry-run',action='store_true'); ap.add_argument('--stage-only',action='store_true'); ap.add_argument('--max-events',type=int,default=None)
    args=ap.parse_args(); cfg=load_yaml(args.config); conn_env=cfg['database']['conn_str_env']; tables=cfg['tables']; cols=cfg['source_columns']; inf=cfg['inference']; max_events=args.max_events or int(inf['max_events_per_run']); pipeline=inf['pipeline_name']
    with connect(conn_env) as conn:
        cp=read_sql(conn,q_get_checkpoint(tables['checkpoint']),(pipeline,)); last=None
        if not cp.empty and pd.notna(cp.iloc[0]['last_event_id']): last=int(cp.iloc[0]['last_event_id'])
        print('checkpoint last_event_id:',last)
        raw_new=read_sql(conn,q_load_candidate_events(tables['raw_iot'],cols,max_events),(last,last))
        if raw_new.empty: print('No new events.'); return 0
        mids=raw_new['machine_id'].dropna().astype(int).unique().tolist(); mid_sql=ints(mids)
        raw_ctx=read_sql(conn,q_load_context_events_for_machines(tables['raw_iot'],cols,mid_sql,int(inf['lookback_events_per_machine'])))
        try: loc_map=read_sql(conn,q_load_active_location(tables['machine_location_history'],tables['location'],mid_sql))
        except Exception as e: print('WARN location:',e); loc_map=pd.DataFrame()
    raw_all=pd.concat([raw_ctx,raw_new],ignore_index=True).drop_duplicates('event_id').sort_values(['machine_id','event_start_time','event_id']).reset_index(drop=True)
    feat=build_l1_l2_event_features(raw_all,loc_map,int(inf['kwh_impute_gap_limit_seconds']),int(inf['big_gap_seconds']),int(inf['long_duration_seconds']))
    new_ids=set(raw_new['event_id'].astype(int)); feat_new=feat[feat['event_id'].astype(int).isin(new_ids)].copy(); feat_closed=closed_only(feat_new)
    print('raw_new:',len(raw_new),'features_new:',len(feat_new),'features_closed:',len(feat_closed))
    if feat_closed.empty: print('No closed events to score yet.'); return 0
    if args.stage_only: print(feat_closed.head()); return 0
    scored_l1=L1ScorerAdapter(enabled=False).score(feat_closed)
    obad=Path(cfg['artifacts']['obad_root']); l2=L2ProductionScorer(obad,cfg['artifacts']['l2_artifact_dir'],cfg['artifacts']['l2_production_selection'],cfg['artifacts']['l2_feature_policy'])
    scored_l2=l2.predict(scored_l1); final=apply_policy_v2(scored_l2,l2.thresholds,1e-6,cfg['project']['policy_version'])
    final['l2_run_id']=cfg['project']['l2_run_id']; final['inference_version']=cfg['project']['inference_version']; out=output_columns(final)
    if args.dry_run or cfg.get('runtime',{}).get('dry_run',True): print('DRY RUN rows:',len(out)); print(out.head()); return 0
    with connect(conn_env) as conn:
        written=bulk_insert_dataframe(conn,tables['online_l2_result'],out,1000); print('written:',written)
        max_id=int(raw_new['event_id'].max()); max_time=pd.to_datetime(raw_new['event_start_time']).max().to_pydatetime(); execute(conn,q_update_checkpoint(tables['checkpoint']),(pipeline,max_id,max_time))
    return 0
if __name__=='__main__': raise SystemExit(main())
