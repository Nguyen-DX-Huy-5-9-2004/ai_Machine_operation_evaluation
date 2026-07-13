from __future__ import annotations
import pandas as pd

class L1ScorerAdapter:
    """Batch10 khóa data realtime trước. L1 PyTorch sẽ tích hợp sau khi so khớp feature online với historical L1."""
    def __init__(self, enabled: bool=False):
        self.enabled=enabled
        if enabled:
            raise NotImplementedError('L1 PyTorch realtime scorer chưa bật trong Batch10 scaffold.')
    def score(self, features: pd.DataFrame)->pd.DataFrame:
        out=features.copy()
        for c in ['score_lenient','score_strict','score_lenient_norm','score_strict_norm','behavior_anomaly_score','behavior_sensitive_score','behavior_combined_score','l1_behavior_anomaly_score_log','l1_behavior_sensitive_score_log','l1_behavior_combined_score_log']:
            out[c]=0.0
        out['is_behavior_anomaly']=0; out['is_sensitive_warning']=0; out['l1_score_available_flag']=0; out['l1_join_missing_flag']=1
        return out
