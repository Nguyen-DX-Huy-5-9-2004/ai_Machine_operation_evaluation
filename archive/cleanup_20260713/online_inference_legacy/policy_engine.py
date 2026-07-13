from __future__ import annotations
from typing import Dict
import numpy as np, pandas as pd
TARGET_SHORT={'future_fault_within_10_events':'fault_10_events','future_fault_within_30_events':'fault_30_events','future_fault_within_30min':'fault_30min','future_fault_within_60min':'fault_60min','future_maintenance_within_30_events':'maintenance_30_events','future_repair_within_30_events':'repair_30_events'}

def b(out,c): return pd.to_numeric(out.get(c,0),errors='coerce').fillna(0).astype(bool)
def f(out,c): return pd.to_numeric(out.get(c,0.0),errors='coerce').fillna(0.0)

def apply_policy_v2(df:pd.DataFrame, thresholds:Dict[str,float], threshold_epsilon=1e-6, policy_version='policy_v2_operational_quality_split_sensitive_audit_only'):
    out=df.copy()
    for target,short in TARGET_SHORT.items():
        risk=f'risk_{short}'; thr=float(thresholds.get(target, thresholds.get(short, 1.0)))
        out[f'policy_threshold_{short}']=max(thr-threshold_epsilon,0.0)
        out[f'policy_pred_{short}']=(f(out,risk)>=out[f'policy_threshold_{short}']).astype('int8')
    known_fault=b(out,'known_fault_status'); known_repair=b(out,'known_repair_status'); known_maint=b(out,'known_maintenance_status'); off_fault=b(out,'off_with_fault_status'); l1=b(out,'is_behavior_anomaly')
    p10=b(out,'policy_pred_fault_10_events'); p30e=b(out,'policy_pred_fault_30_events'); p30m=b(out,'policy_pred_fault_30min'); p60m=b(out,'policy_pred_fault_60min'); pm=b(out,'policy_pred_maintenance_30_events'); pr=b(out,'policy_pred_repair_30_events')
    r10=f(out,'risk_fault_10_events'); r30e=f(out,'risk_fault_30_events'); r30m=f(out,'risk_fault_30min'); r60m=f(out,'risk_fault_60min'); rm=f(out,'risk_maintenance_30_events'); rr=f(out,'risk_repair_30_events')
    critical=known_fault|off_fault|p10; high=(~critical)&(p30m|p30e|pr); medium=(~critical)&(~high)&(p60m|pm|known_maint|l1)
    out['operational_action_level']=np.select([critical,high,medium],['CRITICAL','HIGH','MEDIUM'],default='LOW')
    out['operational_judgment']=np.select([known_fault|off_fault,p10,p30m|p30e,pr|known_repair,p60m,pm|known_maint,l1],['KNOWN_FAULT_CONFIRMED','PRE_FAULT_CRITICAL_NEAR_TERM','PRE_FAULT_HIGH_CONFIDENCE','REPAIR_RELATED','PRE_FAULT_MEDIUM_CONFIDENCE','MAINTENANCE_RELATED','UNKNOWN_BEHAVIOR_ANOMALY'],default='NORMAL_LIKE')
    data_q=b(out,'data_quality_issue_flag'); energy=b(out,'energy_inconsistency_flag'); kwh_q=b(out,'kwh_quality_issue_flag'); time_q=b(out,'time_quality_issue_flag')
    out['quality_judgment']=np.select([data_q&energy,data_q,energy,kwh_q,time_q],['DATA_AND_ENERGY_QUALITY_ISSUE','DATA_QUALITY_ISSUE','ENERGY_INCONSISTENCY','KWH_QUALITY_ISSUE','TIME_QUALITY_ISSUE'],default='QUALITY_OK')
    out['quality_action_level']=np.select([data_q&energy,data_q,energy,kwh_q|time_q],['CHECK_DATA_AND_ENERGY','CHECK_DATA','CHECK_ENERGY','CHECK_DATA_DETAIL'],default='QUALITY_OK')
    qr=np.zeros(len(out)); qr=np.maximum(qr,data_q.to_numpy().astype(float)*0.6); qr=np.maximum(qr,energy.to_numpy().astype(float)*0.5); qr=np.maximum(qr,kwh_q.to_numpy().astype(float)*0.4); qr=np.maximum(qr,time_q.to_numpy().astype(float)*0.4)
    out['quality_risk_score']=qr
    out['model_fault_risk_score']=np.maximum.reduce([r10,r30e,r30m,r60m]); out['model_maintenance_risk_score']=rm; out['model_repair_risk_score']=rr
    out['operational_fault_confidence_score']=np.maximum.reduce([out['model_fault_risk_score'].to_numpy(),(known_fault|off_fault).to_numpy().astype(float),known_repair.to_numpy().astype(float)*0.85,l1.to_numpy().astype(float)*0.2])
    out['operational_maintenance_confidence_score']=np.maximum(rm.to_numpy(),known_maint.to_numpy().astype(float)*0.7)
    out['operational_repair_confidence_score']=np.maximum(rr.to_numpy(),known_repair.to_numpy().astype(float)*0.85)
    out['operational_overall_risk_score']=np.maximum.reduce([out['operational_fault_confidence_score'].to_numpy(),out['operational_maintenance_confidence_score'].to_numpy(),out['operational_repair_confidence_score'].to_numpy()])
    out['action_level_v2']=out['operational_action_level']; out['fault_judgment_v2']=out['operational_judgment']
    out['final_reason_v2']='op='+out['operational_judgment'].astype(str)+'|op_action='+out['operational_action_level'].astype(str)+'|quality='+out['quality_judgment'].astype(str)+'|quality_action='+out['quality_action_level'].astype(str)
    out['policy_version']=policy_version
    return out
