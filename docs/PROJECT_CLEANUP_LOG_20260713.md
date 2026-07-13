# Project cleanup log - 2026-07-13

Tài liệu này ghi lại các bước tinh gọn đã làm theo `documentProject/weldcom_ai_file_role_cleanup_spec.md`.

## Nguyên tắc đã áp dụng

- Không xóa artifact/model/report/final output quan trọng.
- Không xóa file khi chưa rà reference.
- File patch/runtime/legacy rõ ràng được chuyển vào `archive/cleanup_20260713/`.
- Source-of-truth mới cho realtime inference là `inference/online/`.

## Đã archive

### Realtime legacy

```text
online_inference/
```

Chuyển thành:

```text
archive/cleanup_20260713/online_inference_legacy/
```

Lý do: đã có pipeline mới trong `inference/online/`; giữ cả hai ở root dễ gây nhầm.

### L2 patch / backup legacy

```text
modeling/l2_fault_classifier/src/patch_batch07_lightgbm_predict.py
modeling/l2_fault_classifier/src/patch_batch07_lightgbm_predict_v2.py
modeling/l2_fault_classifier/src/score_l2_production.py.bak_before_batch07_fix_v2
modeling/l2_fault_classifier/src/rebuild_l2_operational_policy.py.bak_before_disable_sensitive_monitor
```

Chuyển vào:

```text
archive/cleanup_20260713/l2_patch_legacy/
```

Lý do: đây là file fix/backup tạm; source chính cần giữ là:

```text
modeling/l2_fault_classifier/src/score_l2_production.py
modeling/l2_fault_classifier/src/rebuild_l2_operational_policy.py
```

### Runtime config local

```text
modeling/l2_fault_classifier/configs/score_l2_local.yaml
```

Chuyển vào:

```text
archive/cleanup_20260713/runtime_config_legacy/
```

Lý do: đây là config local/Colab runtime. Notebook có thể sinh lại khi cần. Source-of-truth cho L2 score vẫn là:

```text
modeling/l2_fault_classifier/configs/score_l2.yaml
```

### Batch notes chưa track ở root

```text
README_BATCH_05.md
README_BATCH_05_1.md
README_BATCH_06.md
README_BATCH_07.md
README_BATCH_07_FIX.md
README_BATCH_08.md
README_BATCH10_REALTIME_DATA_PIPELINE.md
```

Chuyển vào:

```text
archive/cleanup_20260713/batch_notes/
```

Lý do: giảm rối thư mục root. Các README batch 01-04 đang được git track nên chưa di chuyển trong lượt này.

### Realtime doc cũ

```text
docs/DATA_REALTIME_PROCESSING_SPEC.md
```

Chuyển vào:

```text
archive/cleanup_20260713/docs_legacy/
```

Lý do: tài liệu này còn trỏ tới `online_inference/`. Tài liệu mới là:

```text
docs/REALTIME_DB_PIPELINE_IMPLEMENTATION_DETAIL.md
```

## Đã kiểm tra và giữ lại

### `modeling/l2_fault_classifier/configs/base.yaml`

Kết quả rà reference:

```text
oBAD.ipynb dùng file này cho join_l1_score_to_l2.py:
!python join_l1_score_to_l2.py --config ../configs/base.yaml
```

Vì vậy file này được giữ lại, không archive.

## Source-of-truth sau cleanup

Realtime:

```text
inference/online/
```

L2 source chính:

```text
modeling/l2_fault_classifier/src/join_l1_score_to_l2.py
modeling/l2_fault_classifier/src/prepare_l2_features.py
modeling/l2_fault_classifier/src/train_l2_multilabel.py
modeling/l2_fault_classifier/src/score_l2_production.py
modeling/l2_fault_classifier/src/rebuild_l2_operational_policy.py
```

L2 configs chính:

```text
modeling/l2_fault_classifier/configs/base.yaml
modeling/l2_fault_classifier/configs/feature_policy.yaml
modeling/l2_fault_classifier/configs/train_l2.yaml
modeling/l2_fault_classifier/configs/score_l2.yaml
modeling/l2_fault_classifier/configs/policy_l2.yaml
```

## Việc chưa làm trong lượt này

- Chưa di chuyển README batch 01-04 vì chúng đang được git track.
- Chưa archive `rebuild_l1_final_decision.py` vì cleanup spec yêu cầu chỉ archive sau khi tích hợp logic vào `score_full_l1.py`.
- Chưa bật L1 PyTorch realtime.
- Chưa xóa hẳn archive; archive giữ lại để có đường lui.

