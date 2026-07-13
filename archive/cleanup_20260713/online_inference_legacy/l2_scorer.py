from __future__ import annotations
import json
from pathlib import Path
from typing import Dict, List
import joblib, numpy as np, pandas as pd

TARGET_SHORT={
 'future_fault_within_10_events':'fault_10_events','future_fault_within_30_events':'fault_30_events','future_fault_within_30min':'fault_30min','future_fault_within_60min':'fault_60min','future_maintenance_within_30_events':'maintenance_30_events','future_repair_within_30_events':'repair_30_events'}

class L2ProductionScorer:
    def __init__(self, obad_root, artifact_dir, production_selection, feature_policy=None):
        self.obad_root=Path(obad_root); self.artifact_dir=self._resolve(artifact_dir); self.selection=json.loads(self._resolve(production_selection).read_text(encoding='utf-8'))
        self.feature_policy={}
        if feature_policy and self._resolve(feature_policy).exists(): self.feature_policy=json.loads(self._resolve(feature_policy).read_text(encoding='utf-8'))
        self.models={}; self.features={}; self.thresholds={}; self._load()
    def _resolve(self,p):
        p=Path(p); return p if p.is_absolute() else self.obad_root/p
    def _selected_items(self):
        if 'targets' in self.selection and isinstance(self.selection['targets'],dict): return self.selection['targets']
        return {k:v for k,v in self.selection.items() if k.startswith('future_')}
    def _features_from_policy(self,profile):
        obj=self.feature_policy
        if 'profiles' in obj:
            p=obj['profiles'].get(profile)
            if isinstance(p,list): return p
            if isinstance(p,dict):
                for key in ['features','feature_columns','input_features']:
                    if key in p: return list(p[key])
        if profile in obj:
            p=obj[profile]
            if isinstance(p,list): return p
            if isinstance(p,dict):
                for key in ['features','feature_columns','input_features']:
                    if key in p: return list(p[key])
        return []
    def _load(self):
        for target,info in self._selected_items().items():
            profile=info.get('profile') or info.get('selected_profile')
            model_path=self.artifact_dir/profile/target/'model.joblib'; meta_path=self.artifact_dir/profile/target/'metadata.json'
            if not model_path.exists(): raise FileNotFoundError(model_path)
            model=joblib.load(model_path); features=[]
            if meta_path.exists():
                meta=json.loads(meta_path.read_text(encoding='utf-8'))
                for key in ['feature_columns','features','input_features','selected_features']:
                    if key in meta and isinstance(meta[key],list): features=list(meta[key]); break
            if not features: features=self._features_from_policy(profile)
            if not features: raise RuntimeError(f'Cannot determine features for {target}/{profile}')
            thr=info.get('threshold') or info.get('valid_threshold') or info.get('best_threshold') or info.get('selected_threshold') or 0.5
            self.models[target]=model; self.features[target]=features; self.thresholds[target]=float(thr)
    def predict(self,df):
        out=df.copy()
        for target,model in self.models.items():
            short=TARGET_SHORT[target]; features=self.features[target]
            X=out.reindex(columns=features).copy()
            for c in features: X[c]=pd.to_numeric(X[c],errors='coerce').fillna(0.0)
            proba=model.predict_proba(X.to_numpy(dtype=np.float32,copy=False))[:,1]
            out[f'risk_{short}']=proba; out[f'threshold_{short}']=self.thresholds[target]; out[f'pred_{short}']=(proba>=self.thresholds[target]).astype('int8')
        return out
