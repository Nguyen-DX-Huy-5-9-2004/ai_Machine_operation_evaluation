# Cleanup 2026-07-13

Archive này giữ lại các file legacy/runtime/patch đã được đưa ra khỏi source-of-truth theo `documentProject/weldcom_ai_file_role_cleanup_spec.md`.

Không có model artifact production nào bị xóa.

## Nội dung đã archive

### `online_inference_legacy/`

Bản phác thảo realtime cũ. Source-of-truth mới là:

```text
inference/online/
```

### `l2_patch_legacy/`

Các patch script và backup tạm thời của Batch07/Batch08:

```text
patch_batch07_lightgbm_predict.py
patch_batch07_lightgbm_predict_v2.py
score_l2_production.py.bak_before_batch07_fix_v2
rebuild_l2_operational_policy.py.bak_before_disable_sensitive_monitor
```

Lý do archive:

- Logic patch không nên nằm cạnh source chính.
- `score_l2_production.py` và `rebuild_l2_operational_policy.py` là file source-of-truth cần giữ sạch.

### `runtime_config_legacy/`

```text
score_l2_local.yaml
```

Đây là config runtime Colab/local, không phải source-of-truth. Notebook có thể tự sinh lại file này khi cần chạy local output.

### `batch_notes/`

Các README batch chưa track ở root được chuyển vào đây để giảm rối thư mục gốc.

### `docs_legacy/`

Tài liệu realtime cũ còn trỏ tới `online_inference/`. Tài liệu mới là:

```text
docs/REALTIME_DB_PIPELINE_IMPLEMENTATION_DETAIL.md
```

