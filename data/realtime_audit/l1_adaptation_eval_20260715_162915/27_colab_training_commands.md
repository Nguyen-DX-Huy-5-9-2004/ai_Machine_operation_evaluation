# Candidate C Colab Training Commands

Khong chay full train tren CPU local. Sau khi upload repo/data len Colab GPU:

```bash
cd /content/OBAD
python modeling/l1_tcn/src/train.py --config modeling/l1_tcn/configs/base.yaml --profile lenient
python modeling/l1_tcn/src/train.py --config modeling/l1_tcn/configs/base.yaml --profile strict
```

Expected candidate artifact root:

`G:\My Drive\OBAD\modeling\l1_tcn\artifacts_candidates\l1_adaptation_20260715_162915`

Sau khi tai artifacts ve, danh gia bang:

```powershell
.\.venv\Scripts\python.exe -m inference.online.score_new_events `
  --config inference/online/config.local.yaml `
  --evaluate-l1-retrain-candidate `
  --adaptation-audit-dir "G:\My Drive\OBAD\data\realtime_audit\l1_adaptation_eval_20260715_162915" `
  --candidate-artifact-dir "G:\My Drive\OBAD\modeling\l1_tcn\artifacts_candidates\l1_adaptation_20260715_162915"
```
