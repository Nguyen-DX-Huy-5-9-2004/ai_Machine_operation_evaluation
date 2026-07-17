# L1 Candidate C Workflow

The only command entrypoint is `modeling/l1_tcn/scripts/run_candidate_c_colab.py`.

Two notebooks have deliberately separate responsibilities:

- `modeling/l1_tcn/notebooks/OBAD_L1_Candidate_C_Colab.ipynb`: historical package and artifact workflow.
- `modeling/l1_tcn/notebooks/OBAD_L1_Candidate_C_Evaluation_Colab.ipynb`: read-only A/B/C evaluation after the package and both Candidate C artifacts exist.

Stage A runs on the laptop and only exports the immutable SQL snapshot:

```powershell
.\.venv\Scripts\python.exe -m inference.online.score_new_events --config inference/online/config.local.yaml --export-l1-candidate-source-snapshot --snapshot-run-id l1_candidate_c_source_current --output-dir data/dataModel/l1_adaptation/source_snapshots/l1_candidate_c_source_current --partition-mode machine --resume
```

Stage B and Stage C run in Colab. They read the snapshot, never SQL Server:

```bash
python modeling/l1_tcn/scripts/run_candidate_c_colab.py validate-source --source-snapshot-dir /content/drive/MyDrive/OBAD/data/dataModel/l1_adaptation/source_snapshots/l1_candidate_c_source_current
python modeling/l1_tcn/scripts/run_candidate_c_colab.py prepare --source-mode snapshot --source-snapshot-dir /content/drive/MyDrive/OBAD/data/dataModel/l1_adaptation/source_snapshots/l1_candidate_c_source_current --adaptation-audit-dir /content/drive/MyDrive/OBAD/data/realtime_audit/l1_adaptation_eval_20260715_162915 --candidate-run-id l1_candidate_c_current --candidate-package-dir /content/drive/MyDrive/OBAD/data/dataModel/l1_adaptation/l1_candidate_c_current --resume
python modeling/l1_tcn/scripts/run_candidate_c_colab.py validate-package --candidate-package-dir /content/drive/MyDrive/OBAD/data/dataModel/l1_adaptation/l1_candidate_c_current
```

Training is blocked until package validation reports `L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING` or `FUTURE_LABEL_COVERAGE_INSUFFICIENT_BUT_PACKAGE_READY`. Outputs always stay under `modeling/l1_tcn/artifacts_candidates/`.

## Fair A/B/C Evaluation

After both Candidate C profiles have trained and passed artifact validation, run the
read-only held-out evaluation from the project root. It scores the same Candidate C
`VALID` and `TEST` windows for A (production artifacts/thresholds), B (production
artifacts with Candidate B thresholds), and C (Candidate C artifacts/thresholds).
Threshold selection is based on `VALID`; `TEST` is reported once and is not used for
selection. This command does not connect to SQL Server, run L2, write production
artifacts, or update a production checkpoint.

Operational sequence: complete the package/artifact notebook once, run the
evaluation notebook, review its decision gate, perform any separate shadow
evaluation, and handle controlled promotion in its own process. Evaluation never
promotes an artifact automatically.

```bash
python modeling/l1_tcn/scripts/run_candidate_c_colab.py evaluate \
  --candidate-package-dir /content/drive/MyDrive/OBAD/data/dataModel/l1_adaptation/l1_candidate_c_current \
  --candidate-artifact-dir /content/drive/MyDrive/OBAD/modeling/l1_tcn/artifacts_candidates/l1_candidate_c_current/current_only \
  --adaptation-audit-dir /content/drive/MyDrive/OBAD/data/realtime_audit/l1_adaptation_eval_20260715_162915
```
