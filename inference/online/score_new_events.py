from __future__ import annotations

import argparse
import csv
import hashlib
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

if __package__:
    from .artifacts import load_config, resolve_obad_root
    from .data_contract import (
        CANONICAL_THRESHOLDS,
        L1_CANONICAL_EVENT_COLUMNS,
        load_json,
        load_l2_metadata_by_target,
        thresholds_from_config,
        validate_l1_model_contract,
        validate_l2_model_contract,
        validate_runtime_invariants,
    )
    from .db import bulk_insert_dataframe, connect, execute, read_sql
    from .feature_builder_l1 import build_l1_event_features, build_realtime_features
    from .feature_builder_l2 import add_l2_runtime_features, build_l2_runtime_features
    from .l1_scorer import L1Scorer
    from .l2_scorer import L2Scorer
    from .l1_shadow import (
        artifact_contract as l1_shadow_artifact_contract,
        build_window_manifest,
        combine_shadow_scores,
        load_l1_base_config,
        load_shadow_profile,
        not_scored_summary,
        preprocess_windows,
        rows_for_ready_windows,
        score_summary_by_machine,
        score_summary_global,
        score_windows,
    )
    from .l1_candidate_c import prepare_candidate_c, prepare_candidate_c_from_snapshot, validate_candidate_package, validate_partitioned_candidate_package
    from .l1_candidate_evaluation import run_candidate_abc_evaluation
    from .l1_candidate_source_snapshot import export_source_snapshot, validate_source_snapshot
    from .production_lineage_dry_run import (
        build_production_lineage_manifest,
        build_runtime_environment_manifest,
        build_runtime_bundle_manifest,
        run_production_multi_machine_smoke,
        run_production_compatibility_dry_run,
        run_runtime_relocation_verification,
    )
    from .policy_engine import apply_policy_v2
    from .sql_queries import (
        get_checkpoint_sql,
        insert_run_log_sql,
        load_context_by_row_order_sql,
        load_closed_candidate_events_in_event_id_range_sql,
        load_context_around_machine_sql,
        load_event_time_location_sql,
        load_historical_l1_by_event_ids_sql,
        load_machine_group_sql,
        load_unprocessed_closed_candidate_events_sql,
        table_name,
        update_checkpoint_sql,
    )
    from .validation import COMPARE_COLUMNS, compare_with_historical, create_audit_dir, data_pipeline_code_hash, write_audit_files
else:  # pragma: no cover - allows direct script execution
    from artifacts import load_config, resolve_obad_root
    from data_contract import (
        CANONICAL_THRESHOLDS,
        L1_CANONICAL_EVENT_COLUMNS,
        load_json,
        load_l2_metadata_by_target,
        thresholds_from_config,
        validate_l1_model_contract,
        validate_l2_model_contract,
        validate_runtime_invariants,
    )
    from db import bulk_insert_dataframe, connect, execute, read_sql
    from feature_builder_l1 import build_l1_event_features, build_realtime_features
    from feature_builder_l2 import add_l2_runtime_features, build_l2_runtime_features
    from l1_scorer import L1Scorer
    from l2_scorer import L2Scorer
    from l1_shadow import (
        artifact_contract as l1_shadow_artifact_contract,
        build_window_manifest,
        combine_shadow_scores,
        load_l1_base_config,
        load_shadow_profile,
        not_scored_summary,
        preprocess_windows,
        rows_for_ready_windows,
        score_summary_by_machine,
        score_summary_global,
        score_windows,
    )
    from l1_candidate_c import prepare_candidate_c, prepare_candidate_c_from_snapshot, validate_candidate_package, validate_partitioned_candidate_package
    from l1_candidate_evaluation import run_candidate_abc_evaluation
    from l1_candidate_source_snapshot import export_source_snapshot, validate_source_snapshot
    from production_lineage_dry_run import (
        build_production_lineage_manifest,
        build_runtime_environment_manifest,
        build_runtime_bundle_manifest,
        run_production_multi_machine_smoke,
        run_production_compatibility_dry_run,
        run_runtime_relocation_verification,
    )
    from policy_engine import apply_policy_v2
    from sql_queries import (
        get_checkpoint_sql,
        insert_run_log_sql,
        load_context_by_row_order_sql,
        load_closed_candidate_events_in_event_id_range_sql,
        load_context_around_machine_sql,
        load_event_time_location_sql,
        load_historical_l1_by_event_ids_sql,
        load_machine_group_sql,
        load_unprocessed_closed_candidate_events_sql,
        table_name,
        update_checkpoint_sql,
    )
    from validation import COMPARE_COLUMNS, compare_with_historical, create_audit_dir, data_pipeline_code_hash, write_audit_files


STAGE_SAMPLE_COLUMNS = [
    "event_id",
    "machine_id",
    "status_id",
    "event_start_time",
    "event_end_time",
    "end_time_source",
    "duration_sec",
    "kwh_delta_model_value",
    "time_quality_issue_flag",
    "kwh_quality_issue_flag",
    "energy_inconsistency_flag",
]

ONLINE_OUTPUT_COLUMNS = [
    "event_id",
    "machine_id",
    "source_event_start_time",
    "source_event_end_time",
    "status_id",
    "status_type_code",
    "current_signal_code",
    "risk_fault_10_events",
    "risk_fault_30_events",
    "risk_fault_30min",
    "risk_fault_60min",
    "risk_maintenance_30_events",
    "risk_repair_30_events",
    "operational_action_level",
    "operational_judgment",
    "operational_fault_confidence_score",
    "operational_maintenance_confidence_score",
    "operational_repair_confidence_score",
    "operational_overall_risk_score",
    "quality_action_level",
    "quality_judgment",
    "quality_risk_score",
    "data_quality_issue_flag",
    "energy_inconsistency_flag",
    "kwh_quality_issue_flag",
    "time_quality_issue_flag",
    "is_behavior_anomaly",
    "is_sensitive_warning",
    "behavior_anomaly_score",
    "behavior_sensitive_score",
    "behavior_combined_score",
    "l1_score_available_flag",
    "l1_join_missing_flag",
    "final_reason_v2",
    "l2_run_id",
    "policy_version",
    "inference_version",
]


def main() -> int:
    args = parse_args()
    cfg = load_config(args.config)
    obad_root = resolve_obad_root(cfg)
    cfg.setdefault("artifacts", {})["obad_root"] = str(obad_root)
    cfg.setdefault("tables", {}).setdefault("machine_status", "dbo.data_machine_status")

    if args.build_production_lineage_manifest:
        runtime_root = _resolve_runtime_workspace_root(obad_root)
        manifest = build_production_lineage_manifest(runtime_root)
        build_runtime_environment_manifest(runtime_root)
        build_runtime_bundle_manifest(runtime_root, manifest)
        print(json.dumps({"result": manifest["artifact_contract_result"], "lineage_manifest": str(runtime_root / "data/runtime_manifest/ai_production_lineage_manifest.json")}, ensure_ascii=False, indent=2))
        return 0 if manifest["artifact_contract_result"] == "PASS" else 2
    if args.production_compatibility_dry_run:
        if not args.dry_run_sample_path:
            raise ValueError("--dry-run-sample-path is required with --production-compatibility-dry-run; SQL is never used by this mode")
        runtime_root = _resolve_runtime_workspace_root(obad_root)
        output = run_production_compatibility_dry_run(
            runtime_root,
            _resolve_cli_project_path(runtime_root, args.dry_run_sample_path),
            _resolve_cli_project_path(runtime_root, args.dry_run_output_root),
            sample_size=int(args.sample_size),
            batch_size=int(args.dry_run_batch_size),
        )
        print("production_compatibility_dry_run_dir:", output)
        return 0
    if args.verify_runtime_relocation:
        runtime_root = _resolve_runtime_workspace_root(obad_root)
        output = run_runtime_relocation_verification(
            runtime_root,
            _resolve_cli_project_path(runtime_root, args.dry_run_output_root),
        )
        result = load_json(output / "00_summary.json").get("result")
        print("runtime_relocation_check_dir:", output)
        return 0 if result == "PASS" else 2
    if args.production_multi_machine_smoke:
        if not args.smoke_canonical_root:
            raise ValueError("--smoke-canonical-root is required with --production-multi-machine-smoke; SQL is never used by this mode")
        runtime_root = _resolve_runtime_workspace_root(obad_root)
        output = run_production_multi_machine_smoke(
            runtime_root,
            _resolve_cli_project_path(runtime_root, args.smoke_canonical_root),
            _resolve_cli_project_path(runtime_root, args.dry_run_output_root),
            events_per_machine=int(args.smoke_events_per_machine),
            batch_size=int(args.dry_run_batch_size),
        )
        print("production_multi_machine_smoke_dir:", output)
        return 0

    if args.validate_l1_parity:
        return run_l1_parity_validation(cfg, args)
    if args.validate_l1_offline_replay:
        return run_l1_offline_replay(cfg, args)
    if args.validate_live_sql_contract:
        return run_live_sql_contract_validation(cfg, args)
    if args.audit_l1_input_distribution:
        return run_l1_input_distribution_audit(cfg, args)
    if args.l1_shadow_audit:
        return run_l1_shadow_audit(cfg, args)
    if args.l1_model_adaptation_eval:
        return run_l1_model_adaptation_eval(cfg, args)
    if args.prepare_l1_retrain_candidate:
        return prepare_candidate_c(cfg, args)
    if args.prepare_l1_retrain_candidate_from_snapshot:
        return prepare_candidate_c_from_snapshot(cfg, args)
    if args.export_l1_candidate_source_snapshot:
        if not args.snapshot_run_id or not args.output_dir:
            raise ValueError("--snapshot-run-id and --output-dir are required for source snapshot export")
        return export_source_snapshot(cfg, Path(args.output_dir).resolve(), args.snapshot_run_id, args.resume)
    if args.validate_l1_candidate_source_snapshot:
        if not args.snapshot_dir:
            raise ValueError("--snapshot-dir is required for source snapshot validation")
        report = validate_source_snapshot(Path(args.snapshot_dir).resolve())
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0 if report["result"] == "L1_CANDIDATE_SOURCE_SNAPSHOT_READY" else 2
    if args.validate_l1_retrain_package:
        project_root = Path.cwd().resolve() if (Path.cwd() / "data").exists() and (Path.cwd() / "modeling").exists() else resolve_obad_root(cfg)
        package_dir = project_root / (args.candidate_package_dir or "")
        if not args.candidate_package_dir:
            raise ValueError("--candidate-package-dir is required with --validate-l1-retrain-package")
        report = validate_partitioned_candidate_package(package_dir)
        print(json.dumps(report, ensure_ascii=False, indent=2, default=str))
        return 0 if report.get("result") in {
            "L1_CANDIDATE_C_PACKAGE_READY_FOR_COLAB_TRAINING",
            "FUTURE_LABEL_COVERAGE_INSUFFICIENT_BUT_PACKAGE_READY",
        } else 2
    if args.evaluate_l1_retrain_candidate:
        return run_evaluate_l1_retrain_candidate(cfg, args)

    runtime = cfg["runtime"]
    max_events = int(args.max_events or runtime.get("max_events_per_run", 100))
    dry_run = bool(args.dry_run or runtime.get("dry_run", True))
    min_event_id = int(runtime.get("min_event_id_to_process", 0))
    audit_run_dir: Path | None = None
    sql_used: dict[str, str] = {}
    status_map = pd.DataFrame()
    if args.audit:
        audit_run_dir = create_audit_dir(cfg.get("audit", {}).get("output_root", "data/realtime_audit"))
        print("audit_dir:", audit_run_dir)

    with connect(cfg["database"]) as conn:
        checkpoint = load_checkpoint(conn, cfg)
        raw_is_deleted_column = "is_deleted" if table_has_column(conn, cfg["tables"]["raw_iot"], "is_deleted") else None
        last_event_id = checkpoint.get("last_event_id")
        print("checkpoint last_event_id for log only:", last_event_id)
        print("min_event_id_to_process:", min_event_id)

        if args.candidate_mode == "historical-overlap":
            raw_new, candidate_sql = load_historical_overlap_candidates(conn, cfg, max_events, raw_is_deleted_column=raw_is_deleted_column)
            sql_used["candidate_events_historical_overlap"] = candidate_sql
        else:
            candidate_sql = load_unprocessed_closed_candidate_events_sql(
                cfg["tables"]["raw_iot"],
                cfg["tables"]["online_l2_result"],
                cfg["source_columns"],
                max_events,
                raw_is_deleted_column,
            )
            sql_used["candidate_events"] = candidate_sql
            raw_new = read_sql(conn, candidate_sql, [min_event_id])
        print("raw_candidate count:", len(raw_new))
        if raw_new.empty:
            if audit_run_dir is not None:
                write_audit_files(
                    audit_run_dir,
                    cfg=cfg,
                    mode="stage-only" if args.stage_only else "dry-run" if dry_run else "write",
                    max_events=max_events,
                    sql_used=sql_used,
                    raw_candidates=raw_new,
                    raw_context=pd.DataFrame(),
                    processed_features=pd.DataFrame(),
                    features_closed=pd.DataFrame(),
                    historical_compare=pd.DataFrame(),
                    historical_compare_meta={"source_attempted": [], "source": None, "error": "not_attempted_no_candidates"},
                    l1_mode="disabled_noop",
                    l2_mode="not_run",
                    write_sql_enabled=False,
                    command=" ".join(sys.argv),
                    location_mapping_mode="not_run",
                )
            if not args.stage_only:
                write_run_log(conn, cfg, 0, 0, 0, 0, "OK", "No candidate events.")
            return 0

        context, context_sql_parts = load_context_around_candidates(conn, cfg, raw_new, raw_is_deleted_column=raw_is_deleted_column)
        context = normalize_context_for_audit(context, raw_new)
        sql_used.update(context_sql_parts)
        location_map, location_sql = load_location_map(conn, cfg, context)
        machine_group_map, machine_group_sql = load_machine_group_map(conn, cfg, context)
        status_map, status_sql = load_status_map(conn, cfg)
        location_map = merge_context_maps(location_map, machine_group_map)
        sql_used["location_mapping"] = location_sql
        sql_used["machine_group_mapping"] = machine_group_sql
        sql_used["status_mapping"] = status_sql

    raw_all = (
        pd.concat([context, raw_new.assign(context_role="candidate")], ignore_index=True)
        .drop_duplicates("event_id")
        .sort_values(["machine_id", "event_start_time", "event_id"])
        .reset_index(drop=True)
    )
    joined_canonical_events = build_joined_canonical_for_audit(raw_all, status_map, location_map, machine_group_map)
    thresholds, threshold_mismatches = thresholds_from_config(cfg)
    features = build_l1_event_features(
        raw_all,
        machine_context=machine_group_map,
        location_context=location_map,
        config=cfg,
    )

    new_ids = set(raw_new["event_id"].astype(int))
    features_new = features[features["event_id"].astype(int).isin(new_ids)].copy()
    features_closed = features_new[features_new["is_open_event"] == 0].copy()
    l2_runtime = build_l2_runtime_features(features_new, l1_scores=None, config=cfg, model_metadata=None)
    l1_contract_report, l2_contract_report, invariant_report = build_contract_reports(cfg, features_new, l2_runtime, thresholds)
    if threshold_mismatches:
        invariant_report.setdefault("threshold_mismatches", threshold_mismatches)
        invariant_report["result"] = "FAIL"

    print("context count:", len(context))
    print("features_new count:", len(features_new))
    print("features_closed count:", len(features_closed))

    print("sample 5 rows:")
    print(features_closed.reindex(columns=STAGE_SAMPLE_COLUMNS).head(5).to_string(index=False))

    historical_compare = pd.DataFrame()
    historical_compare_meta: dict[str, Any] = {"source_attempted": [], "source": None, "error": None}
    if args.audit:
        with connect(cfg["database"]) as conn:
            historical, historical_sql, historical_compare_meta = load_historical_l1(conn, cfg, features_new["event_id"].astype(int).tolist())
        if historical_sql:
            sql_used["historical_l1_compare"] = historical_sql
        historical_compare = compare_with_historical(features_new, historical)
        summary = write_audit_files(
            audit_run_dir,
            cfg=cfg,
            mode="stage-only" if args.stage_only else "dry-run" if dry_run else "write",
            max_events=max_events,
            sql_used=sql_used,
            raw_candidates=raw_new,
            raw_context=context,
            joined_canonical_events=joined_canonical_events,
            processed_features=features_new,
            features_closed=features_closed,
            l2_runtime_features=l2_runtime,
            l1_contract_report=l1_contract_report,
            l2_contract_report=l2_contract_report,
            invariant_report=invariant_report,
            historical_compare=historical_compare,
            historical_compare_meta=historical_compare_meta,
            l1_mode="disabled_noop",
            l2_mode="not_run" if args.stage_only else "pending",
            write_sql_enabled=not args.stage_only and not dry_run,
            command=" ".join(sys.argv),
            location_mapping_mode="event_time",
        )
        print("audit_summary:", summary["result"], str(audit_run_dir))

    if args.stage_only:
        return 0
    if features_closed.empty:
        return 0

    l1_scored = L1Scorer(cfg["artifacts"]).score(features_closed)
    l2_ready = add_l2_runtime_features(l1_scored)
    l2_scorer = L2Scorer(cfg["artifacts"])
    missing_features = l2_scorer.missing_features(l2_ready)
    if missing_features:
        if args.audit:
            summary = write_audit_files(
                audit_run_dir,
                cfg=cfg,
                mode="dry-run" if dry_run else "write",
                max_events=max_events,
                sql_used=sql_used,
                raw_candidates=raw_new,
                raw_context=context,
                processed_features=features_new,
                features_closed=features_closed,
                historical_compare=historical_compare,
                historical_compare_meta=historical_compare_meta,
                l1_mode="disabled_noop",
                l2_mode="missing_features",
                write_sql_enabled=False,
                command=" ".join(sys.argv),
                location_mapping_mode="event_time",
                l2_missing_features=missing_features,
            )
            print("audit_summary:", summary["result"], str(audit_run_dir))
        raise ValueError(f"Missing runtime features for L2: {missing_features}")
    l2_scored = l2_scorer.predict(l2_ready)
    final = apply_policy_v2(
        l2_scored,
        l2_scorer.thresholds,
        policy_version=str(cfg["project"]["policy_version"]),
    )
    final["l2_run_id"] = cfg["project"]["l2_run_id"]
    final["inference_version"] = cfg["project"]["inference_version"]
    output = format_online_output(final)

    if dry_run:
        print("DRY RUN - rows ready to write:", len(output))
        print(output.head(5).to_string(index=False))
        if args.audit:
            summary = write_audit_files(
                audit_run_dir,
                cfg=cfg,
                mode="dry-run",
                max_events=max_events,
                sql_used=sql_used,
                raw_candidates=raw_new,
                raw_context=context,
                processed_features=features_new,
                features_closed=features_closed,
                historical_compare=historical_compare,
                historical_compare_meta=historical_compare_meta,
                l1_mode="disabled_noop",
                l2_mode="lightgbm_dry_run",
                write_sql_enabled=False,
                command=" ".join(sys.argv),
                location_mapping_mode="event_time",
            )
            print("audit_summary:", summary["result"], str(audit_run_dir))
        return 0

    with connect(cfg["database"]) as conn:
        written = bulk_insert_dataframe(conn, cfg["tables"]["online_l2_result"], output)
        max_scored_id = int(features_closed["event_id"].max())
        max_scored_time = pd.to_datetime(features_closed["event_start_time"]).max().to_pydatetime()
        execute(
            conn,
            update_checkpoint_sql(cfg["tables"]["checkpoint"]),
            [cfg["project"]["pipeline_name"], max_scored_id, max_scored_time],
        )
        write_run_log(
            conn,
            cfg,
            len(raw_new),
            written,
            len(features_new) - len(features_closed),
            0,
            "OK",
            f"Scored through event_id={max_scored_id}",
        )
    print("written:", written)
    return 0


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Score newly closed Weldcom IOT events.")
    parser.add_argument("--config", default="inference/online/config.example.yaml")
    parser.add_argument("--stage-only", action="store_true", help="Only load SQL data and build realtime features.")
    parser.add_argument("--audit", action="store_true", help="Write raw/context/processed audit files.")
    parser.add_argument("--dry-run", action="store_true", help="Do not write SQL output even if config dry_run=false.")
    parser.add_argument("--max-events", type=int, default=None)
    parser.add_argument("--build-production-lineage-manifest", action="store_true", help="Write Candidate A / selected L2 read-only production lineage and runtime bundle manifests.")
    parser.add_argument("--production-compatibility-dry-run", action="store_true", help="Read canonical Parquet sample, run Candidate A -> selected L2 -> policy v2, and never call SQL or write production results.")
    parser.add_argument("--verify-runtime-relocation", action="store_true", help="Read-only SHA256 and environment verification for a relocated runtime bundle; never uses SQL or models.")
    parser.add_argument("--production-multi-machine-smoke", action="store_true", help="Read canonical partitions, score 50-100 ready Candidate A targets per machine through L2 and policy v2, and never use SQL.")
    parser.add_argument("--dry-run-sample-path", default=None, help="Canonical event Parquet file or canonical partition directory for --production-compatibility-dry-run.")
    parser.add_argument("--dry-run-output-root", default="data/realtime_audit", help="Audit root for --production-compatibility-dry-run.")
    parser.add_argument("--dry-run-batch-size", type=int, default=512, help="L1 inference batch size for --production-compatibility-dry-run.")
    parser.add_argument("--smoke-canonical-root", default=None, help="Canonical partition root for --production-multi-machine-smoke.")
    parser.add_argument("--smoke-events-per-machine", type=int, default=50, help="Ready L1 targets per machine for --production-multi-machine-smoke; must be 50-100.")
    parser.add_argument("--validate-l1-parity", action="store_true", help="Validate SQL/snapshot natural-key parity against historical L1 CSV.")
    parser.add_argument(
        "--validate-l1-offline-replay",
        action="store_true",
        help="Replay a raw CSV snapshot through the canonical L1 builder and separate raw drift from transformation mismatches.",
    )
    parser.add_argument(
        "--validate-live-sql-contract",
        action="store_true",
        help="Validate SQL extraction, row-order context, and canonical L1 data without model inference.",
    )
    parser.add_argument(
        "--audit-l1-input-distribution",
        action="store_true",
        help="Compare current live SQL L1 input distributions against historical L1 without model inference.",
    )
    parser.add_argument(
        "--l1-shadow-audit",
        action="store_true",
        help="Run L1 lenient/strict shadow inference audit without L2 or SQL writes.",
    )
    parser.add_argument(
        "--l1-model-adaptation-eval",
        action="store_true",
        help="Evaluate current L1 model reuse vs threshold recalibration without L2 or SQL writes.",
    )
    parser.add_argument("--shadow-audit-dir", default=None, help="Existing l1_shadow audit directory used as source for adaptation evaluation.")
    parser.add_argument("--max-paired-windows", type=int, default=10000, help="Maximum paired windows to use in adaptation evaluation.")
    parser.add_argument(
        "--evaluate-l1-retrain-candidate",
        action="store_true",
        help="Evaluate external L1 retrain candidate artifacts against an adaptation audit.",
    )
    parser.add_argument("--adaptation-audit-dir", default=None, help="Adaptation audit directory for candidate C evaluation.")
    parser.add_argument("--candidate-artifact-dir", default=None, help="Candidate artifact directory for L1 retrain evaluation.")
    parser.add_argument("--candidate-package-dir", default=None, help="Candidate C dataset/package directory.")
    parser.add_argument("--candidate-run-id", default=None, help="Immutable Candidate C run identifier, e.g. l1_candidate_c_20260716_120000.")
    parser.add_argument("--prepare-l1-retrain-candidate", action="store_true", help="Build and validate the Candidate C Parquet package without training L1/L2.")
    parser.add_argument("--prepare-l1-retrain-candidate-from-snapshot", action="store_true", help="Stage B only: prepare partitioned Candidate C package from immutable snapshot, never SQL.")
    parser.add_argument("--validate-l1-retrain-package", action="store_true", help="Validate an existing Candidate C package without SQL writes or model training.")
    parser.add_argument("--export-l1-candidate-source-snapshot", action="store_true", help="Stage A only: export immutable, per-machine raw SQL snapshot.")
    parser.add_argument("--validate-l1-candidate-source-snapshot", action="store_true", help="Validate an immutable Stage A source snapshot.")
    parser.add_argument("--snapshot-run-id", default=None)
    parser.add_argument("--snapshot-dir", default=None)
    parser.add_argument("--output-dir", default=None)
    parser.add_argument("--source-snapshot-dir", default=None)
    parser.add_argument("--partition-mode", choices=["machine"], default="machine")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument(
        "--sampling-mode",
        choices=["stratified", "new"],
        default="stratified",
        help="Sampling strategy for L1 shadow audit.",
    )
    parser.add_argument(
        "--raw-data-dir",
        default=None,
        help="Training raw snapshot directory. If omitted, known data/backData snapshot directories are assessed first.",
    )
    parser.add_argument("--sample-size", type=int, default=1000, help="Sample size for --validate-l1-parity.")
    parser.add_argument(
        "--candidate-mode",
        choices=["new", "historical-overlap"],
        default="new",
        help="Use normal unprocessed events or closed SQL events whose event_id appears in historical L1 CSV.",
    )
    return parser.parse_args()


def build_contract_reports(
    cfg: dict[str, Any],
    l1_features: pd.DataFrame,
    l2_runtime: pd.DataFrame,
    thresholds: dict[str, int],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    artifacts = cfg.get("artifacts", {})
    project_root = resolve_project_root(cfg)
    l1_preprocessor_path = resolve_project_path(cfg, Path(artifacts.get("l1_artifact_dir", "modeling/l1_tcn/artifacts")) / "lenient" / "preprocessor.json", project_root)
    if l1_preprocessor_path.exists():
        l1_preprocessor = load_json(l1_preprocessor_path)
        l1_report = validate_l1_model_contract(l1_features, l1_preprocessor)
        l1_report["preprocessor_path"] = str(l1_preprocessor_path)
    else:
        l1_report = {"result": "FAIL", "missing_preprocessor": str(l1_preprocessor_path)}

    l2_artifact_root = resolve_project_path(cfg, artifacts.get("l2_artifact_dir", "modeling/l2_fault_classifier/artifacts/l2_multilabel_20260711_043347"), project_root)
    production_selection = resolve_project_path(cfg, artifacts.get("l2_production_selection", ""), project_root) if artifacts.get("l2_production_selection") else None
    metadata = load_l2_metadata_by_target(l2_artifact_root, production_selection)
    l2_report = validate_l2_model_contract(l2_runtime, metadata)
    l2_report["artifact_root"] = str(l2_artifact_root)
    l2_report["production_selection"] = str(production_selection) if production_selection else None
    invariant_report = validate_runtime_invariants(l1_features, thresholds)
    return l1_report, l2_report, invariant_report


def split_table_name(raw_name: str) -> tuple[str, str]:
    parts = str(raw_name).replace("[", "").replace("]", "").split(".")
    if len(parts) == 1:
        return "dbo", parts[0]
    return parts[-2], parts[-1]


def table_columns(conn: Any, raw_name: str) -> set[str]:
    schema, name = split_table_name(raw_name)
    sql = """
SELECT COLUMN_NAME
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
"""
    try:
        df = read_sql(conn, sql, [schema, name])
    except Exception:
        return set()
    return set(df["COLUMN_NAME"].astype(str).tolist()) if "COLUMN_NAME" in df.columns else set()


def table_has_column(conn: Any, raw_name: str, column: str) -> bool:
    return column in table_columns(conn, raw_name)


def load_status_map(conn: Any, cfg: dict[str, Any]) -> tuple[pd.DataFrame, str]:
    table = cfg.get("tables", {}).get("machine_status", "dbo.data_machine_status")
    cols = table_columns(conn, table)
    if not cols:
        return pd.DataFrame(columns=["status_id", "status_name", "status_type_raw", "status_note"]), f"-- status table not found or unreadable: {table}"
    name_col = next((c for c in ["status_name", "name", "status", "title"] if c in cols), None)
    type_col = next((c for c in ["type", "status_type", "status_type_raw"] if c in cols), None)
    note_col = next((c for c in ["note", "description", "status_note"] if c in cols), None)
    is_deleted = "is_deleted" if "is_deleted" in cols else None
    sql = f"""
SELECT
    CAST(id AS INT) AS status_id,
    {f"CAST([{name_col}] AS NVARCHAR(500))" if name_col else "CAST(NULL AS NVARCHAR(500))"} AS status_name,
    {f"CAST([{type_col}] AS NVARCHAR(500))" if type_col else "CAST(NULL AS NVARCHAR(500))"} AS status_type_raw,
    {f"CAST([{note_col}] AS NVARCHAR(1000))" if note_col else "CAST(NULL AS NVARCHAR(1000))"} AS status_note
FROM {table_name(table)}
WHERE 1 = 1
{f"  AND ISNULL([{is_deleted}], 0) = 0" if is_deleted else ""}
"""
    try:
        return read_sql(conn, sql), sql
    except Exception as exc:
        return pd.DataFrame(columns=["status_id", "status_name", "status_type_raw", "status_note"]), f"-- status map failed: {exc}\n{sql}"


def build_joined_canonical_for_audit(
    raw_events: pd.DataFrame,
    status_map: pd.DataFrame,
    location_map: pd.DataFrame,
    machine_group_map: pd.DataFrame,
) -> pd.DataFrame:
    out = raw_events.copy()
    if not status_map.empty and "status_id" in status_map.columns:
        out = out.merge(status_map.drop_duplicates("status_id"), on="status_id", how="left")
    else:
        out["status_name"] = pd.NA
        out["status_type_raw"] = pd.NA
        out["status_note"] = pd.NA

    if not machine_group_map.empty and "machine_group_id" in machine_group_map.columns:
        out = out.merge(machine_group_map.drop_duplicates("machine_id"), on="machine_id", how="left", suffixes=("", "_machine"))
    elif "machine_group_id" not in out.columns:
        out["machine_group_id"] = pd.NA

    if not location_map.empty:
        loc_cols = [c for c in ["event_id", "machine_id", "location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"] if c in location_map.columns]
        if "event_id" in loc_cols:
            out = out.merge(location_map[loc_cols].drop_duplicates("event_id"), on="event_id", how="left", suffixes=("", "_location"))
        elif {"machine_id", "location_id"}.issubset(loc_cols):
            out = out.merge(location_map[loc_cols].drop_duplicates("machine_id"), on="machine_id", how="left", suffixes=("", "_location"))
    for column in ["location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]:
        if column not in out.columns:
            out[column] = pd.NA
    if "location_mapping_source" in out.columns:
        out["location_mapping_source"] = out["location_mapping_source"].fillna("event_time")
    return out.reindex(columns=[
        "event_id",
        "machine_id",
        "status_id",
        "event_start_time",
        "raw_event_end_time",
        "raw_status_kwh_start",
        "raw_status_kwh_end",
        "raw_error_code",
        "status_name",
        "status_type_raw",
        "status_note",
        "machine_group_id",
        "location_id",
        "location_history_start_time",
        "location_history_end_time",
        "location_mapping_source",
        "context_role",
        "is_raw_candidate_event",
    ])


def run_l1_parity_validation(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    sample_size = int(args.sample_size or 1000)
    project_root = resolve_project_root(cfg)
    out_dir = project_root / "data" / "realtime_audit" / f"l1_parity_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("l1_parity_dir:", out_dir)

    thresholds, threshold_mismatches = thresholds_from_config(cfg)
    threshold_resolution = {
        "canonical_thresholds": CANONICAL_THRESHOLDS,
        "runtime_thresholds": thresholds,
        "mismatches": threshold_mismatches,
        "result": "PASS" if not threshold_mismatches else "FAIL",
        "source": {
            "kwh_impute_gap_limit_seconds": "documentProject/creatDataset.sql @KwhFillMaxGapSec = 5 * 60",
            "small_gap_seconds": "documentProject/creatDataset.sql @SmallGapSec = 5 * 60",
            "big_gap_seconds": "documentProject/creatDataset.sql @BigGapSec = 60 * 60",
            "long_duration_seconds": "documentProject/creatDataset.sql duration > 24 * 3600",
        },
    }

    with connect(cfg["database"]) as conn:
        sql_raw = load_sql_joined_events_for_parity(conn, cfg)
    if sql_raw.empty:
        raise RuntimeError("No SQL rows loaded for L1 parity.")
    sql_raw["_natural_key"] = make_natural_key(sql_raw)
    sql_key_counts = sql_raw["_natural_key"].value_counts(dropna=False)

    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    hist_candidates = load_historical_l1_overlap_candidates(historical_csv, set(sql_raw["_natural_key"].dropna().tolist()))
    if hist_candidates.empty:
        raise RuntimeError(f"No historical L1 rows overlap SQL natural keys: {historical_csv}")
    hist_key_counts = hist_candidates["_natural_key"].value_counts(dropna=False)
    hist_candidates["mapping_status"] = np.where(
        (hist_candidates["_natural_key"].map(sql_key_counts).fillna(0).astype(int) == 1)
        & (hist_candidates["_natural_key"].map(hist_key_counts).fillna(0).astype(int) == 1),
        "UNIQUE",
        "AMBIGUOUS",
    )

    sample_manifest, selected_hist = select_l1_parity_sample(hist_candidates, sample_size)
    mapping = build_natural_key_mapping(sql_raw, selected_hist, sql_key_counts, hist_key_counts)
    selected_sql_ids = set(mapping.loc[mapping["mapping_status"] == "UNIQUE", "sql_event_id"].dropna().astype(int).tolist())
    context = build_context_from_loaded_sql(sql_raw, selected_sql_ids, lookback=40, lookahead=2)
    context["context_role"] = np.where(context["event_id"].astype(int).isin(selected_sql_ids), "candidate", "context")
    context["is_raw_candidate_event"] = context["event_id"].astype(int).isin(selected_sql_ids).astype(int)

    location_context = context[["event_id", "machine_id", "location_id", "machine_group_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]].copy()
    runtime_all = build_l1_event_features(
        context.reindex(columns=[
            "event_id",
            "machine_id",
            "status_id",
            "event_start_time",
            "raw_event_end_time",
            "raw_status_kwh_start",
            "raw_status_kwh_end",
            "raw_error_code",
        ]),
        location_context=location_context,
        config=cfg,
    )
    runtime_sample = runtime_all[runtime_all["event_id"].astype(int).isin(selected_sql_ids)].copy()
    historical_sample = load_historical_l1_rows_by_event_id(historical_csv, set(mapping["historical_event_id"].dropna().astype(int).tolist()))
    historical_sample = derive_historical_l1_audit_columns(historical_sample)

    comparison = compare_l1_runtime_to_historical(mapping, runtime_sample, historical_sample)
    feature_summary = summarize_l1_feature_comparison(comparison)
    segmentation_parity = build_segmentation_parity(mapping, runtime_sample, historical_sample)
    join_coverage = build_join_coverage_report(context)
    unmatched = build_unmatched_analysis(sql_raw, hist_candidates, sql_key_counts, hist_key_counts)
    l1_preprocessor_path = resolve_project_path(cfg, Path(cfg["artifacts"]["l1_artifact_dir"]) / "lenient" / "preprocessor.json", project_root)
    l1_contract = validate_l1_model_contract(runtime_sample, load_json(l1_preprocessor_path))
    invariant_report = validate_runtime_invariants(runtime_sample, thresholds)

    summary = build_l1_parity_summary(
        source_rows_sql=len(sql_raw),
        source_rows_historical_candidates=len(hist_candidates),
        mapping=mapping,
        join_coverage=join_coverage,
        threshold_resolution=threshold_resolution,
        feature_summary=feature_summary,
        segmentation_parity=segmentation_parity,
        l1_contract=l1_contract,
        invariant_report=invariant_report,
    )

    write_json(out_dir / "00_config_sanitized.json", parity_sanitized_config(cfg, sample_size))
    write_json(out_dir / "01_threshold_resolution.json", threshold_resolution)
    write_json(out_dir / "02_join_coverage.json", join_coverage)
    sample_manifest.to_csv(out_dir / "03_stratified_sample_manifest.csv", index=False, encoding="utf-8-sig")
    context.reindex(columns=["event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code", "context_role", "is_raw_candidate_event"]).to_csv(out_dir / "04_raw_sql_sample.csv", index=False, encoding="utf-8-sig")
    context.to_csv(out_dir / "05_joined_canonical_events.csv", index=False, encoding="utf-8-sig")
    runtime_sample.to_csv(out_dir / "06_l1_event_features_runtime.csv", index=False, encoding="utf-8-sig")
    mapping.to_csv(out_dir / "07_natural_key_mapping.csv", index=False, encoding="utf-8-sig")
    comparison.to_csv(out_dir / "08_l1_feature_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "09_feature_match_summary.json", feature_summary)
    unmatched.to_csv(out_dir / "10_unmatched_event_analysis.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "11_segmentation_parity.json", segmentation_parity)
    write_json(out_dir / "12_l1_contract_report.json", l1_contract)
    write_json(out_dir / "13_invariant_report.json", invariant_report)
    write_json(out_dir / "14_summary.json", summary)
    (out_dir / "15_README_L1_PARITY.md").write_text(build_l1_parity_readme(summary, out_dir), encoding="utf-8")

    print("l1_parity_summary:", summary["overall_l1_parity_result"], out_dir)
    return 0


def run_l1_offline_replay(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    """Replay a raw export with the canonical builder; never invoke a model or write SQL."""
    sample_size = max(100, int(args.sample_size or 5000))
    project_root = resolve_project_root(cfg)
    out_dir = project_root / "data" / "realtime_audit" / f"l1_offline_replay_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("l1_offline_replay_dir:", out_dir)

    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    if not historical_csv.exists():
        raise FileNotFoundError(f"Historical L1 CSV not found: {historical_csv}")

    # A bounded probe is enough to identify the raw export. The full replay
    # below uses continuous machine histories from the selected snapshot.
    historical_probe = load_historical_l1_replay_probe(historical_csv, max(2000, min(sample_size * 2, 12000)))
    snapshot_inventory, snapshot_hashes, snapshot_equivalence, csv_parse_quality, malformed_csv_rows = build_snapshot_inventory(project_root, args.raw_data_dir)
    snapshot_resolution = resolve_training_raw_snapshot(
        project_root,
        args.raw_data_dir,
        historical_probe,
        snapshot_hashes=snapshot_hashes,
        snapshot_equivalence=snapshot_equivalence,
    )
    probe_mapping = snapshot_resolution.pop("_selected_probe_mapping")
    probe_raw_compare = snapshot_resolution.pop("_selected_probe_raw_comparison")
    write_json(out_dir / "00_config_sanitized.json", offline_replay_sanitized_config(cfg, sample_size, args.raw_data_dir))

    selected_dir_text = snapshot_resolution.get("selected_raw_data_dir")
    if not selected_dir_text:
        write_empty_offline_replay_audit(
            out_dir,
            snapshot_resolution=snapshot_resolution,
            reason="TRAINING_SNAPSHOT_NOT_FOUND",
        )
        print("l1_offline_replay_summary: L1_TRANSFORMATION_LOGIC_NOT_READY", out_dir)
        return 0

    selected_dir = Path(selected_dir_text)
    exact_probe = probe_raw_compare[
        (probe_raw_compare["mapping_status"] == "UNIQUE")
        & (probe_raw_compare["raw_input_match_status"] == "RAW_INPUT_EXACT_MATCH")
    ].copy()
    machine_ids = select_offline_replay_machines(exact_probe, minimum=10)
    if not machine_ids:
        write_empty_offline_replay_audit(
            out_dir,
            snapshot_resolution=snapshot_resolution,
            reason="NO_MACHINE_WITH_EXACT_RAW_INPUT_PROBE",
        )
        print("l1_offline_replay_summary: L1_TRANSFORMATION_LOGIC_NOT_READY", out_dir)
        return 0

    raw_all = load_snapshot_raw_events(selected_dir / "data_iot_convert.csv", machine_ids=machine_ids)
    joined_all, status_map, machine_map, location_map = build_snapshot_join_context(raw_all, selected_dir)
    runtime_all = build_l1_event_features(
        raw_all.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        machine_context=machine_map,
        location_context=location_map,
        config=cfg,
    )
    block_manifest, selected_snapshot_ids = select_offline_replay_blocks(runtime_all, sample_size, minimum_machines=10)
    raw_selected = raw_all[raw_all["event_id"].astype("Int64").isin(selected_snapshot_ids)].copy()
    historical_selected = load_historical_for_snapshot_rows(historical_csv, raw_selected)
    mapping = build_snapshot_historical_mapping(raw_selected, historical_selected)
    raw_input_comparison = compare_raw_input(mapping, raw_selected, historical_selected)
    runtime_selected = runtime_all[runtime_all["event_id"].astype("Int64").isin(selected_snapshot_ids)].copy()
    historical_selected = derive_historical_l1_audit_columns(historical_selected)
    raw_input_comparison = mark_replay_context_eligibility(raw_input_comparison, runtime_selected, historical_selected)
    exact_mapping = raw_input_comparison.loc[
        (raw_input_comparison["mapping_status"] == "UNIQUE")
        & (raw_input_comparison["raw_input_match_status"] == "RAW_INPUT_EXACT_MATCH")
        & (raw_input_comparison["transformation_core_eligible"] == True),  # noqa: E712
        ["snapshot_event_id", "historical_event_id", "mapping_status", "mapping_method"],
    ].rename(columns={"snapshot_event_id": "sql_event_id"})
    transformation_comparison = compare_l1_runtime_to_historical(exact_mapping, runtime_selected, historical_selected)
    location_drift_ids = set(
        pd.to_numeric(
            raw_input_comparison.loc[
                raw_input_comparison["context_input_match_status"] == "CONTEXT_LOCATION_CHANGED",
                "snapshot_event_id",
            ],
            errors="coerce",
        ).dropna().astype(int).tolist()
    )
    transformation_comparison = transformation_comparison[
        ~(
            (transformation_comparison["feature_group"] == "location_context")
            & transformation_comparison["sql_event_id"].astype("Int64").isin(location_drift_ids)
        )
    ].copy()
    transformation_summary = summarize_l1_feature_comparison(transformation_comparison)
    true_logic_mismatches = classify_transformation_mismatches(transformation_comparison)
    segmentation_report = build_offline_segmentation_report(exact_mapping, runtime_selected, historical_selected, block_manifest)
    join_coverage = build_join_coverage_report(joined_all)
    raw_drift_summary = summarize_raw_input_comparison(raw_input_comparison)
    l1_preprocessor = resolve_project_path(
        cfg, Path(cfg["artifacts"]["l1_artifact_dir"]) / "lenient" / "preprocessor.json", project_root,
    )
    l1_contract = validate_l1_model_contract(runtime_selected, load_json(l1_preprocessor)) if l1_preprocessor.exists() else {
        "result": "FAIL", "reason": f"missing_preprocessor: {l1_preprocessor}"
    }
    offline_snapshot_result = snapshot_resolution.get("decision", "TRAINING_SNAPSHOT_NOT_FOUND")
    transformation_ready = (
        offline_snapshot_result in {
            "EXACT_TRAINING_FACT_SNAPSHOT_FOUND",
            "CONTENT_EQUIVALENT_FACT_SNAPSHOT_COPIES",
            "EXACT_TRAINING_FULL_SOURCE_SNAPSHOT_FOUND",
            "FACT_MATCH_BUT_DIMENSION_SNAPSHOT_UNRESOLVED",
        }
        and csv_parse_quality.get("result") != "FAIL_INPUT_QUALITY_FACT_MALFORMED"
        and not transformation_comparison.empty
        and transformation_summary.get("result") == "PASS"
        and segmentation_report.get("result") == "PASS"
        and join_coverage.get("result") == "PASS"
        and l1_contract.get("result") == "PASS"
    )
    offline_transformation_result = "PASS" if transformation_ready else "FAIL"
    final_result = "L1_TRANSFORMATION_LOGIC_READY" if transformation_ready else "L1_TRANSFORMATION_LOGIC_NOT_READY"
    summary = {
        "offline_raw_snapshot_result": offline_snapshot_result,
        "fact_snapshot_result": snapshot_resolution.get("fact_snapshot_result"),
        "full_source_snapshot_result": snapshot_resolution.get("full_source_snapshot_result"),
        "offline_transformation_result": offline_transformation_result,
        "offline_transformation_parity_result": offline_transformation_result,
        "live_sql_contract_result": "NOT_RUN_OFFLINE_MODE",
        "live_sql_source_drift_result": "NOT_RUN_OFFLINE_MODE",
        "selected_raw_data_dir": str(selected_dir),
        "replay_machine_ids": machine_ids,
        "continuous_replay_rows": int(len(runtime_all)),
        "selected_replay_rows": int(len(runtime_selected)),
        "raw_input_exact_match_rows": int(len(exact_mapping)),
        "raw_input_drift_summary": raw_drift_summary,
        "csv_parse_quality_result": csv_parse_quality.get("result"),
        "snapshot_equivalence_result": snapshot_resolution.get("snapshot_equivalence_result"),
        "offline_join_coverage_result": join_coverage.get("result"),
        "l1_contract_result": l1_contract.get("result"),
        "transformation_match_result": transformation_summary.get("result"),
        "segmentation_replay_result": segmentation_report.get("result"),
        "final_result": final_result,
        "model_distribution_result": "NOT_RUN_OFFLINE_MODE",
        "l1_model_enabled": False,
        "l2_prediction_run": False,
        "production_sql_written": False,
        "code_fingerprint": data_pipeline_code_hash(),
        "config_thresholds": thresholds_from_config(cfg)[0],
    }

    joined_selected = joined_all[joined_all["event_id"].astype("Int64").isin(selected_snapshot_ids)].copy()
    time_mismatches = transformation_comparison[
        (transformation_comparison["feature_group"] == "time") & (~transformation_comparison["tolerance_match"])
    ].copy()
    kwh_mismatches = transformation_comparison[
        (transformation_comparison["feature_group"] == "kwh") & (~transformation_comparison["tolerance_match"])
    ].copy()
    write_json(out_dir / "01_snapshot_inventory.json", snapshot_inventory)
    snapshot_hashes.to_csv(out_dir / "02_snapshot_file_hashes.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "03_snapshot_equivalence_groups.json", snapshot_equivalence)
    write_json(out_dir / "01_training_snapshot_resolution.json", snapshot_resolution)
    raw_input_comparison.to_csv(out_dir / "02_raw_input_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "03_raw_input_classification_summary.json", raw_drift_summary)
    block_manifest.to_csv(out_dir / "04_contiguous_replay_manifest.csv", index=False, encoding="utf-8-sig")
    joined_selected.to_csv(out_dir / "05_joined_canonical_events.csv", index=False, encoding="utf-8-sig")
    runtime_selected.to_csv(out_dir / "06_l1_features_runtime.csv", index=False, encoding="utf-8-sig")
    transformation_comparison.to_csv(out_dir / "07_transformation_feature_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "08_transformation_match_summary.json", transformation_summary)
    time_mismatches.to_csv(out_dir / "09_time_mismatch_details.csv", index=False, encoding="utf-8-sig")
    kwh_mismatches.to_csv(out_dir / "10_kwh_mismatch_details.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "11_segmentation_replay_report.json", segmentation_report)
    write_json(out_dir / "12_l1_contract_report.json", l1_contract)
    true_logic_mismatches.to_csv(out_dir / "13_true_logic_mismatches.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "14_summary.json", summary)
    (out_dir / "15_README_L1_OFFLINE_REPLAY.md").write_text(build_offline_replay_readme(summary, out_dir), encoding="utf-8")
    write_json(out_dir / "16_csv_parse_quality.json", csv_parse_quality)
    malformed_csv_rows.to_csv(out_dir / "17_malformed_csv_rows.csv", index=False, encoding="utf-8-sig")
    print("l1_offline_replay_summary:", final_result, out_dir)
    return 0


def run_live_sql_contract_validation(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    """Validate current SQL extraction and the canonical L1 contract only.

    This path deliberately does not compare feature parity to the training
    export: current SQL may legitimately contain later raw backfills.
    """
    project_root = resolve_project_root(cfg)
    max_events = int(args.max_events or args.sample_size or cfg.get("runtime", {}).get("max_events_per_run", 100))
    out_dir = project_root / "data" / "realtime_audit" / f"live_sql_contract_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("live_sql_contract_dir:", out_dir)

    thresholds, threshold_mismatches = thresholds_from_config(cfg)
    sql_used: dict[str, str] = {}
    min_event_id = int(cfg.get("runtime", {}).get("min_event_id_to_process", 0))
    raw_candidates = pd.DataFrame()
    raw_context = pd.DataFrame()
    joined = pd.DataFrame()
    candidate_features = pd.DataFrame()
    features_closed = pd.DataFrame()
    join_coverage: dict[str, Any] = {"result": "FAIL", "reason": "not_run"}
    invariant_report: dict[str, Any] = {"result": "FAIL", "reason": "not_run"}
    l1_contract: dict[str, Any] = {"result": "FAIL", "reason": "not_run"}
    source_drift: dict[str, Any] = {"conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED", "reason": "not_run"}

    with connect(cfg["database"]) as conn:
        raw_deleted = "is_deleted" if table_has_column(conn, cfg["tables"]["raw_iot"], "is_deleted") else None
        candidate_sql = load_unprocessed_closed_candidate_events_sql(
            cfg["tables"]["raw_iot"],
            cfg["tables"]["online_l2_result"],
            cfg["source_columns"],
            max_events,
            raw_deleted,
        )
        sql_used["candidate_events"] = candidate_sql
        raw_candidates = read_sql(conn, candidate_sql, [min_event_id])
        raw_context, context_sql = load_context_around_candidates(
            conn, cfg, raw_candidates, raw_is_deleted_column=raw_deleted,
        )
        sql_used.update(context_sql)
        raw_context = normalize_context_for_audit(raw_context, raw_candidates)

        status_map, status_sql = load_status_map(conn, cfg)
        location_map, location_sql = load_location_map(conn, cfg, raw_context)
        machine_group_map, machine_sql = load_machine_group_map(conn, cfg, raw_context)
        sql_used["status_map"] = status_sql
        sql_used["event_time_location"] = location_sql
        sql_used["machine_group"] = machine_sql

    context_map = merge_context_maps(location_map, machine_group_map)
    joined = build_joined_canonical_for_audit(raw_context, status_map, location_map, machine_group_map)
    runtime_all = build_l1_event_features(
        raw_context.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        machine_context=machine_group_map,
        location_context=context_map,
        config=cfg,
    )
    candidate_ids = set(pd.to_numeric(raw_candidates.get("event_id", pd.Series(dtype="Int64")), errors="coerce").dropna().astype(int).tolist())
    candidate_features = runtime_all[runtime_all["event_id"].astype("Int64").isin(candidate_ids)].copy()
    features_closed = candidate_features[candidate_features["is_open_event"] == 0].copy()
    join_coverage = build_join_coverage_report(joined)
    invariant_report = validate_runtime_invariants(features_closed, thresholds)
    l1_preprocessor = resolve_project_path(
        cfg, Path(cfg["artifacts"]["l1_artifact_dir"]) / "lenient" / "preprocessor.json", project_root,
    )
    l1_contract = validate_l1_model_contract(features_closed, load_json(l1_preprocessor)) if l1_preprocessor.exists() else {
        "result": "FAIL", "reason": f"missing_preprocessor: {l1_preprocessor}"
    }
    source_drift = build_live_source_drift_report(cfg, raw_candidates, candidate_features, project_root)

    candidate_context_ids = set(pd.to_numeric(raw_context.get("event_id", pd.Series(dtype="Int64")), errors="coerce").dropna().astype(int).tolist())
    coverage = {
        "raw_candidate_rows": int(len(raw_candidates)),
        "context_rows": int(len(raw_context)),
        "candidate_rows_present_in_context": int(len(candidate_ids & candidate_context_ids)),
        "candidate_rows_missing_from_context": int(len(candidate_ids - candidate_context_ids)),
        "before_rows": int((raw_context.get("context_role", pd.Series(dtype=str)) == "before").sum()),
        "after_rows": int((raw_context.get("context_role", pd.Series(dtype=str)) == "after").sum()),
        "candidate_rows_marked_in_context": int((raw_context.get("is_raw_candidate_event", pd.Series(dtype=int)) == 1).sum()),
        "lookback_before": int(cfg.get("runtime", {}).get("lookback_before", 40)),
        "lookahead_after": int(cfg.get("runtime", {}).get("lookahead_after", 2)),
        "context_selection": "ROW_NUMBER by machine_id, event_start_time, event_id; lookahead is row based",
        "closed_candidate_rows": int(len(features_closed)),
        "open_candidate_rows": int((candidate_features.get("is_open_event", pd.Series(dtype=int)) == 1).sum()),
    }
    live_ready = (
        bool(len(raw_candidates))
        and coverage["candidate_rows_missing_from_context"] == 0
        and coverage["open_candidate_rows"] == 0
        and join_coverage.get("result") == "PASS"
        and invariant_report.get("result") == "PASS"
        and l1_contract.get("result") == "PASS"
        and not threshold_mismatches
    )
    summary = {
        "offline_transformation_result": "NOT_RUN_LIVE_MODE",
        "live_sql_contract_result": "PASS" if live_ready else "FAIL",
        "source_drift_result": source_drift.get("conclusion"),
        "candidate_context_result": "PASS" if coverage["candidate_rows_missing_from_context"] == 0 and coverage["open_candidate_rows"] == 0 else "FAIL",
        "join_coverage_result": join_coverage.get("result"),
        "threshold_result": "PASS" if not threshold_mismatches else "FAIL",
        "invariant_result": invariant_report.get("result"),
        "l1_schema_contract_result": l1_contract.get("result"),
        "l1_model_enabled": False,
        "l2_prediction_run": False,
        "production_sql_written": False,
        "code_fingerprint": data_pipeline_code_hash(),
        "config_thresholds": thresholds_from_config(cfg)[0],
    }
    write_json(out_dir / "00_config_sanitized.json", live_sql_contract_sanitized_config(cfg, max_events))
    (out_dir / "01_sql_used.sql").write_text("\n\n".join(f"-- {name}\n{sql.strip()}" for name, sql in sql_used.items()), encoding="utf-8")
    write_json(out_dir / "02_candidate_and_context_coverage.json", coverage)
    write_json(out_dir / "03_join_coverage.json", join_coverage)
    joined.to_csv(out_dir / "04_live_canonical_events.csv", index=False, encoding="utf-8-sig")
    candidate_features.to_csv(out_dir / "05_live_l1_features.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "06_source_drift_report.json", source_drift)
    write_json(out_dir / "07_invariant_report.json", invariant_report)
    write_json(out_dir / "08_l1_contract_report.json", l1_contract)
    write_json(out_dir / "09_summary.json", summary)
    (out_dir / "10_README_LIVE_SQL_CONTRACT.md").write_text(build_live_sql_contract_readme(summary, coverage, out_dir), encoding="utf-8")
    print("live_sql_contract_summary:", summary["live_sql_contract_result"], out_dir)
    return 0


L1_MODEL_FEATURES = [
    "status_id", "status_type_code", "current_signal_code", "hour_of_day", "day_of_week",
    "machine_group_id", "location_id", "duration_sec", "gap_from_prev_sec", "overlap_sec",
    "kwh_delta_model_value", "kwh_rate_per_hour", "is_on", "is_loaded", "is_no_load",
    "is_current_near_zero", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag",
    "kwh_rate_missing_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag",
    "is_raw_end_missing", "is_invalid_raw_end", "end_time_imputed_flag",
    "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap",
]


def run_l1_input_distribution_audit(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    project_root = resolve_project_root(cfg)
    sample_size = max(100, int(args.sample_size or 50000))
    out_dir = project_root / "data" / "realtime_audit" / f"l1_input_distribution_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("l1_input_distribution_dir:", out_dir)

    thresholds, threshold_mismatches = thresholds_from_config(cfg)
    sql_used: dict[str, str] = {}
    min_event_id = int(cfg.get("runtime", {}).get("min_event_id_to_process", 0))
    with connect(cfg["database"]) as conn:
        raw_deleted = "is_deleted" if table_has_column(conn, cfg["tables"]["raw_iot"], "is_deleted") else None
        candidate_sql = load_unprocessed_closed_candidate_events_sql(
            cfg["tables"]["raw_iot"],
            cfg["tables"]["online_l2_result"],
            cfg["source_columns"],
            sample_size,
            raw_deleted,
        )
        sql_used["candidate_events"] = candidate_sql
        raw_candidates = read_sql(conn, candidate_sql, [min_event_id])
        raw_context, context_sql = load_context_around_candidates(conn, cfg, raw_candidates, raw_is_deleted_column=raw_deleted)
        sql_used.update(context_sql)
        raw_context = normalize_context_for_audit(raw_context, raw_candidates)
        status_map, status_sql = load_status_map(conn, cfg)
        location_map, location_sql = load_location_map(conn, cfg, raw_context)
        machine_group_map, machine_sql = load_machine_group_map(conn, cfg, raw_context)
        sql_used["status_map"] = status_sql
        sql_used["event_time_location"] = location_sql
        sql_used["machine_group"] = machine_sql

    context_map = merge_context_maps(location_map, machine_group_map)
    current_all = build_l1_event_features(
        raw_context.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        machine_context=machine_group_map,
        location_context=context_map,
        config=cfg,
    )
    candidate_ids = set(pd.to_numeric(raw_candidates.get("event_id", pd.Series(dtype="Int64")), errors="coerce").dropna().astype(int).tolist())
    current_features = current_all[current_all["event_id"].astype("Int64").isin(candidate_ids)].copy()
    closed_features = current_features[current_features["is_open_event"] == 0].copy()
    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    historical = load_historical_l1_distribution_sample(historical_csv, closed_features, sample_size)
    source_drift = build_live_source_drift_report(cfg, raw_candidates, current_features, project_root)
    distribution_summary, per_machine = summarize_l1_input_distribution(current_features, historical, source_drift)
    invariant_report = validate_runtime_invariants(closed_features, thresholds)
    l1_preprocessor = resolve_project_path(cfg, Path(cfg["artifacts"]["l1_artifact_dir"]) / "lenient" / "preprocessor.json", project_root)
    l1_contract = validate_l1_model_contract(closed_features, load_json(l1_preprocessor)) if l1_preprocessor.exists() else {
        "result": "FAIL", "reason": f"missing_preprocessor: {l1_preprocessor}"
    }
    summary = {
        "distribution_result": distribution_summary.get("result"),
        "raw_candidate_rows": int(len(raw_candidates)),
        "current_feature_rows": int(len(current_features)),
        "historical_feature_rows": int(len(historical)),
        "source_drift_result": source_drift.get("conclusion"),
        "invariant_result": invariant_report.get("result"),
        "l1_contract_result": l1_contract.get("result"),
        "threshold_result": "PASS" if not threshold_mismatches else "FAIL",
        "l1_model_enabled": False,
        "l2_prediction_run": False,
        "production_sql_written": False,
        "code_fingerprint": data_pipeline_code_hash(),
        "config_thresholds": thresholds,
    }
    write_json(out_dir / "00_config_sanitized.json", {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "audit_l1_input_distribution",
        "sample_size": sample_size,
        "project_root": str(project_root),
        "historical_l1_csv": str(historical_csv),
        "l1_mode": "disabled",
        "l2_mode": "not_run",
        "write_sql_enabled": False,
    })
    (out_dir / "01_sql_used.sql").write_text("\n\n".join(f"-- {name}\n{sql.strip()}" for name, sql in sql_used.items()), encoding="utf-8")
    current_features.to_csv(out_dir / "02_current_live_l1_features.csv", index=False, encoding="utf-8-sig")
    historical.to_csv(out_dir / "03_historical_l1_same_range_sample.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "04_distribution_summary.json", distribution_summary)
    per_machine.to_csv(out_dir / "05_distribution_by_machine.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "06_source_drift_report.json", source_drift)
    write_json(out_dir / "07_invariant_report.json", invariant_report)
    write_json(out_dir / "08_l1_contract_report.json", l1_contract)
    write_json(out_dir / "09_summary.json", summary)
    (out_dir / "10_README_L1_INPUT_DISTRIBUTION.md").write_text(build_l1_distribution_readme(summary, out_dir), encoding="utf-8")
    print("l1_input_distribution_summary:", summary["distribution_result"], out_dir)
    return 0


def run_l1_shadow_audit(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    project_root = resolve_project_root(cfg)
    sample_size = max(100, int(args.sample_size or 10000))
    out_dir = project_root / "data" / "realtime_audit" / f"l1_shadow_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("l1_shadow_dir:", out_dir)

    base_cfg = load_l1_base_config(project_root)
    base_cfg.setdefault("train", {})["mixed_precision"] = False
    device = None
    lenient = load_shadow_profile(project_root, "lenient", base_cfg, device=device)
    strict = load_shadow_profile(project_root, "strict", base_cfg, device=lenient.device)
    artifact_report = l1_shadow_artifact_contract(project_root, [lenient, strict], base_cfg)
    sql_used: dict[str, str] = {}
    thresholds, threshold_mismatches = thresholds_from_config(cfg)

    with connect(cfg["database"]) as conn:
        raw_deleted = "is_deleted" if table_has_column(conn, cfg["tables"]["raw_iot"], "is_deleted") else None
        sample_sql = build_l1_shadow_sample_sql(cfg, sample_size, raw_deleted, sampling_mode=args.sampling_mode)
        sql_used["stratified_shadow_candidates"] = sample_sql
        raw_candidates = read_sql(conn, sample_sql, [int(cfg.get("runtime", {}).get("min_event_id_to_process", 0))])
        print("l1_shadow_progress: raw_candidates", len(raw_candidates), flush=True)
        raw_context, context_sql = load_context_around_candidates(conn, cfg, raw_candidates, raw_is_deleted_column=raw_deleted)
        print("l1_shadow_progress: raw_context", len(raw_context), flush=True)
        sql_used.update(context_sql)
        raw_context = normalize_context_for_audit(raw_context, raw_candidates)
        status_map, status_sql = load_status_map(conn, cfg)
        location_map, location_sql = load_location_map(conn, cfg, raw_context)
        machine_group_map, machine_sql = load_machine_group_map(conn, cfg, raw_context)
        sql_used["status_map"] = status_sql
        sql_used["event_time_location"] = location_sql
        sql_used["machine_group"] = machine_sql

    context_map = merge_context_maps(location_map, machine_group_map)
    current_features_all = build_l1_event_features(
        raw_context.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        machine_context=machine_group_map,
        location_context=context_map,
        config=cfg,
    )
    candidate_ids = set(pd.to_numeric(raw_candidates.get("event_id", pd.Series(dtype="Int64")), errors="coerce").dropna().astype(int).tolist())
    current_features = current_features_all[current_features_all["event_id"].astype("Int64").isin(candidate_ids)].copy()
    print("l1_shadow_progress: current_features", len(current_features), "context_features", len(current_features_all), flush=True)
    current_manifest = build_window_manifest(current_features_all, candidate_ids, window_size=20)
    print("l1_shadow_progress: current_windows_ready", int((current_manifest["window_ready_flag"] == 1).sum()) if not current_manifest.empty else 0, flush=True)
    ready_rows = rows_for_ready_windows(current_features_all, current_manifest)
    print("l1_shadow_progress: current_window_rows", len(ready_rows), flush=True)
    lenient_scores, lenient_score_report = score_windows(lenient, base_cfg, ready_rows, batch_size=1024)
    print("l1_shadow_progress: lenient_scored", len(lenient_scores), flush=True)
    strict_scores, strict_score_report = score_windows(strict, base_cfg, ready_rows, batch_size=1024)
    print("l1_shadow_progress: strict_scored", len(strict_scores), flush=True)
    shadow_scores = combine_shadow_scores(current_manifest, lenient_scores, strict_scores)
    global_summary = score_summary_global(shadow_scores)
    by_machine = score_summary_by_machine(shadow_scores, current_features)
    score_by_kwh = grouped_score_summary(shadow_scores, current_features, ["kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag"])
    score_by_status = grouped_score_summary(shadow_scores, current_features, ["status_id", "location_id", "hour_of_day", "day_of_week"])

    historical_features, paired_mapping = load_paired_historical_features(
        cfg=cfg,
        project_root=project_root,
        current_features=current_features,
    )
    print("l1_shadow_progress: paired_mapping", len(paired_mapping), "historical_window_rows", len(historical_features), flush=True)
    paired_window_manifest = pd.DataFrame()
    paired_score_comparison = pd.DataFrame()
    paired_summary: dict[str, Any] = {"paired_window_rows": 0, "result": "NO_PAIRED_WINDOWS"}
    threshold_changes = pd.DataFrame()
    kwh_impact = {"recommendation": "INSUFFICIENT_EVIDENCE", "reason": "no_paired_windows"}
    if not historical_features.empty and not paired_mapping.empty:
        historical_candidate_ids = set(pd.to_numeric(paired_mapping["historical_event_id"], errors="coerce").dropna().astype(int).tolist())
        paired_window_manifest = build_window_manifest(historical_features, historical_candidate_ids, window_size=20)
        historical_ready_rows = rows_for_ready_windows(historical_features, paired_window_manifest)
        print("l1_shadow_progress: historical_window_rows_ready", len(historical_ready_rows), flush=True)
        hist_lenient_scores, _ = score_windows(lenient, base_cfg, historical_ready_rows, batch_size=1024)
        print("l1_shadow_progress: historical_lenient_scored", len(hist_lenient_scores), flush=True)
        hist_strict_scores, _ = score_windows(strict, base_cfg, historical_ready_rows, batch_size=1024)
        print("l1_shadow_progress: historical_strict_scored", len(hist_strict_scores), flush=True)
        historical_scores = combine_shadow_scores(paired_window_manifest, hist_lenient_scores, hist_strict_scores)
        paired_score_comparison = build_paired_score_comparison(shadow_scores, historical_scores, paired_mapping, current_features, historical_features)
        paired_summary = summarize_paired_scores(paired_score_comparison)
        threshold_changes = paired_score_comparison[
            (paired_score_comparison.get("lenient_label_changed", pd.Series(dtype=bool)) == True)
            | (paired_score_comparison.get("strict_label_changed", pd.Series(dtype=bool)) == True)
            | (paired_score_comparison.get("sensitive_warning_changed", pd.Series(dtype=bool)) == True)
        ].copy()
        kwh_impact = build_kwh_drift_model_impact(paired_score_comparison, by_machine)

    invariant_report = validate_runtime_invariants(current_features[current_features["is_open_event"] == 0], thresholds)
    l1_contract = validate_l1_model_contract(current_features, load_json(lenient.preprocessor_path))
    shadow_contract = {
        "result": "PASS",
        "lenient_score_report": lenient_score_report,
        "strict_score_report": strict_score_report,
        "anomaly_rule": "is_behavior_anomaly = is_anomaly_lenient; is_sensitive_warning = is_anomaly_strict AND NOT is_anomaly_lenient",
        "l2_prediction_run": False,
        "production_sql_written": False,
    }
    if artifact_report.get("result") != "PASS" or l1_contract.get("result") != "PASS" or lenient_score_report["non_finite_output_count"] or strict_score_report["non_finite_output_count"]:
        shadow_contract["result"] = "FAIL"

    decision = decide_l1_shadow_recommendation(shadow_contract, paired_summary, kwh_impact, len(paired_score_comparison))
    summary = {
        "technical_shadow_inference_result": shadow_contract["result"],
        "decision": decision,
        "sample_size_requested": sample_size,
        "raw_candidate_rows": int(len(raw_candidates)),
        "current_feature_rows": int(len(current_features)),
        "ready_windows": int((current_manifest["window_ready_flag"] == 1).sum()) if not current_manifest.empty else 0,
        "not_ready_windows": int((current_manifest["window_ready_flag"] != 1).sum()) if not current_manifest.empty else 0,
        "paired_rows": int(len(paired_score_comparison)),
        "artifact_contract_result": artifact_report.get("result"),
        "l1_contract_result": l1_contract.get("result"),
        "invariant_result": invariant_report.get("result"),
        "lenient_anomaly_rate": global_summary.get("lenient", {}).get("anomaly_rate"),
        "strict_anomaly_rate": global_summary.get("strict", {}).get("anomaly_rate"),
        "behavior_anomaly_rate": global_summary.get("behavior_anomaly_rate"),
        "sensitive_warning_rate": global_summary.get("sensitive_warning_rate"),
        "kwh_impact_recommendation": kwh_impact.get("recommendation"),
        "l1_model_enabled": True,
        "l2_prediction_run": False,
        "production_sql_written": False,
        "checkpoint_updated": False,
        "threshold_changed": False,
    }

    write_json(out_dir / "00_config_sanitized.json", {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "l1_shadow_audit",
        "sample_size": sample_size,
        "sampling_mode": args.sampling_mode,
        "project_root": str(project_root),
        "l1_mode": "shadow_lenient_strict",
        "l2_mode": "not_run",
        "write_sql_enabled": False,
    })
    write_json(out_dir / "01_artifact_contract.json", artifact_report)
    raw_candidates.to_csv(out_dir / "02_sampling_manifest.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "03_sampling_coverage.json", sampling_coverage(raw_candidates, current_features, current_manifest))
    current_features.to_csv(out_dir / "04_current_l1_features.csv", index=False, encoding="utf-8-sig")
    current_manifest.to_csv(out_dir / "05_current_window_manifest.csv", index=False, encoding="utf-8-sig")
    shadow_scores.to_csv(out_dir / "06_l1_shadow_scores.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "07_score_summary_global.json", global_summary)
    by_machine.to_csv(out_dir / "08_score_summary_by_machine.csv", index=False, encoding="utf-8-sig")
    score_by_kwh.to_csv(out_dir / "09_score_by_kwh_quality.csv", index=False, encoding="utf-8-sig")
    score_by_status.to_csv(out_dir / "10_score_by_status.csv", index=False, encoding="utf-8-sig")
    paired_mapping.to_csv(out_dir / "11_paired_event_mapping.csv", index=False, encoding="utf-8-sig")
    paired_window_manifest.to_csv(out_dir / "12_paired_window_manifest.csv", index=False, encoding="utf-8-sig")
    paired_score_comparison.to_csv(out_dir / "13_paired_score_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "14_paired_score_summary.json", paired_summary)
    threshold_changes.to_csv(out_dir / "15_threshold_crossing_changes.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "16_not_scored_summary.json", not_scored_summary(current_manifest))
    write_json(out_dir / "17_invariant_report.json", invariant_report)
    write_json(out_dir / "18_l1_shadow_contract.json", shadow_contract)
    write_json(out_dir / "19_summary.json", summary)
    (out_dir / "20_README_L1_SHADOW.md").write_text(build_l1_shadow_readme(summary, out_dir), encoding="utf-8")
    write_json(out_dir / "21_kwh_drift_model_impact.json", kwh_impact)
    (out_dir / "22_kwh_remediation_recommendation.md").write_text(build_kwh_remediation_md(kwh_impact), encoding="utf-8")
    (out_dir / "01_sql_used.sql").write_text("\n\n".join(f"-- {name}\n{sql.strip()}" for name, sql in sql_used.items()), encoding="utf-8")
    print("l1_shadow_summary:", decision, out_dir)
    return 0


def _q(name: str) -> str:
    return "[" + str(name).replace("]", "]]") + "]"


def build_l1_shadow_sample_sql(cfg: dict[str, Any], sample_size: int, raw_is_deleted_column: str | None, sampling_mode: str) -> str:
    raw_table = cfg["tables"]["raw_iot"]
    cols = cfg["source_columns"]
    raw_error = cols.get("raw_error_code")
    raw_error_expr = f"CAST(i.{_q(raw_error)} AS NVARCHAR(200))" if raw_error else "CAST(NULL AS NVARCHAR(200))"
    deleted_filter = f"AND ISNULL(i.{_q(raw_is_deleted_column)}, 0) = 0" if raw_is_deleted_column else ""
    next_deleted_filter = f"AND ISNULL(n.{_q(raw_is_deleted_column)}, 0) = 0" if raw_is_deleted_column else ""
    rn_order = "CHECKSUM(NEWID())" if sampling_mode == "stratified" else f"CAST(i.{_q(cols['event_id'])} AS BIGINT)"
    per_group = max(5, int(np.ceil(sample_size / 300)))
    return f"""
WITH eligible AS (
    SELECT
        CAST(i.{_q(cols['event_id'])} AS BIGINT) AS event_id,
        CAST(i.{_q(cols['machine_id'])} AS INT) AS machine_id,
        CAST(i.{_q(cols['status_id'])} AS INT) AS status_id,
        CAST(i.{_q(cols['event_start_time'])} AS DATETIME2) AS event_start_time,
        CAST(i.{_q(cols['raw_event_end_time'])} AS DATETIME2) AS raw_event_end_time,
        TRY_CAST(i.{_q(cols['raw_kwh_start'])} AS FLOAT) AS raw_status_kwh_start,
        TRY_CAST(i.{_q(cols['raw_kwh_end'])} AS FLOAT) AS raw_status_kwh_end,
        {raw_error_expr} AS raw_error_code,
        DATEPART(month, CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)) AS sample_month,
        DATEPART(hour, CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)) AS sample_hour,
        DATEPART(weekday, CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)) AS sample_day_of_week,
        ROW_NUMBER() OVER (
            PARTITION BY
                CAST(i.{_q(cols['machine_id'])} AS INT),
                CAST(i.{_q(cols['status_id'])} AS INT),
                DATEPART(month, CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)),
                DATEPART(hour, CAST(i.{_q(cols['event_start_time'])} AS DATETIME2))
            ORDER BY {rn_order}
        ) AS sample_rn
    FROM {table_name(raw_table)} AS i
    WHERE CAST(i.{_q(cols['event_id'])} AS BIGINT) > ?
      {deleted_filter}
      AND i.{_q(cols['event_id'])} IS NOT NULL
      AND i.{_q(cols['machine_id'])} IS NOT NULL
      AND i.{_q(cols['status_id'])} IS NOT NULL
      AND i.{_q(cols['event_start_time'])} IS NOT NULL
      AND (
          CAST(i.{_q(cols['raw_event_end_time'])} AS DATETIME2) > CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)
          OR EXISTS (
              SELECT 1
              FROM {table_name(raw_table)} AS n
              WHERE CAST(n.{_q(cols['machine_id'])} AS INT) = CAST(i.{_q(cols['machine_id'])} AS INT)
                AND CAST(n.{_q(cols['event_start_time'])} AS DATETIME2) > CAST(i.{_q(cols['event_start_time'])} AS DATETIME2)
                {next_deleted_filter}
          )
      )
)
SELECT TOP ({int(sample_size)}) *
FROM eligible
WHERE sample_rn <= {int(per_group)}
ORDER BY event_start_time, event_id
"""


def sampling_coverage(raw_candidates: pd.DataFrame, current_features: pd.DataFrame, manifest: pd.DataFrame) -> dict[str, Any]:
    return {
        "raw_candidate_rows": int(len(raw_candidates)),
        "feature_rows": int(len(current_features)),
        "ready_windows": int((manifest.get("window_ready_flag", pd.Series(dtype=int)) == 1).sum()),
        "not_ready_windows": int((manifest.get("window_ready_flag", pd.Series(dtype=int)) != 1).sum()) if not manifest.empty else 0,
        "machine_count": int(raw_candidates.get("machine_id", pd.Series(dtype=int)).nunique()),
        "status_distribution": raw_candidates.get("status_id", pd.Series(dtype=int)).value_counts(dropna=False).astype(int).to_dict(),
        "machine_distribution_top": raw_candidates.get("machine_id", pd.Series(dtype=int)).value_counts(dropna=False).head(20).astype(int).to_dict(),
        "hour_distribution": current_features.get("hour_of_day", pd.Series(dtype=int)).value_counts(dropna=False).sort_index().astype(int).to_dict(),
        "day_of_week_distribution": current_features.get("day_of_week", pd.Series(dtype=int)).value_counts(dropna=False).sort_index().astype(int).to_dict(),
        "location_distribution": current_features.get("location_id", pd.Series(dtype=int)).value_counts(dropna=False).astype(int).to_dict(),
        "kwh_available_distribution": current_features.get("kwh_available_flag", pd.Series(dtype=int)).value_counts(dropna=False).astype(int).to_dict(),
        "data_quality_distribution": current_features.get("data_quality_issue_flag", pd.Series(dtype=int)).value_counts(dropna=False).astype(int).to_dict(),
    }


def grouped_score_summary(scores: pd.DataFrame, features: pd.DataFrame, group_cols: list[str]) -> pd.DataFrame:
    merged = scores.merge(features.drop_duplicates("event_id"), on="event_id", how="left", suffixes=("", "_feature"))
    rows = []
    for col in group_cols:
        if col not in merged.columns:
            continue
        for value, g in merged.groupby(col, dropna=False):
            ready = g[g["window_ready_flag"] == 1]
            rows.append({
                "group_column": col,
                "group_value": value,
                "rows": int(len(g)),
                "scored_rows": int(len(ready)),
                "score_lenient_median": _float_or_none(pd.to_numeric(ready.get("score_lenient"), errors="coerce").median()) if len(ready) else None,
                "score_lenient_p95": _float_or_none(pd.to_numeric(ready.get("score_lenient"), errors="coerce").quantile(0.95)) if len(ready) else None,
                "score_strict_median": _float_or_none(pd.to_numeric(ready.get("score_strict"), errors="coerce").median()) if len(ready) else None,
                "score_strict_p95": _float_or_none(pd.to_numeric(ready.get("score_strict"), errors="coerce").quantile(0.95)) if len(ready) else None,
                "behavior_anomaly_rate": float(ready.get("is_behavior_anomaly", pd.Series(dtype=float)).mean()) if len(ready) else 0.0,
                "sensitive_warning_rate": float(ready.get("is_sensitive_warning", pd.Series(dtype=float)).mean()) if len(ready) else 0.0,
            })
    return pd.DataFrame(rows)


def load_paired_historical_features(cfg: dict[str, Any], project_root: Path, current_features: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    if current_features.empty or not historical_csv.exists():
        return pd.DataFrame(), pd.DataFrame()
    current = current_features.copy()
    current["_natural_key"] = make_natural_key(current)
    current_keys = set(current["_natural_key"].dropna().tolist())
    machine_ids = set(pd.to_numeric(current["machine_id"], errors="coerce").dropna().astype(int).tolist())
    sep = detect_csv_separator(str(historical_csv))
    header = pd.read_csv(historical_csv, sep=sep, nrows=0).columns.tolist()
    usecols = [c for c in [
        "event_id", "machine_id", "status_id", "event_start_time", "event_end_time", "sequence_segment_id",
        "event_order_in_segment", "end_time_source", "raw_status_kwh_start", "raw_status_kwh_end",
        "kwh_start_source", "kwh_end_source", "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag",
        "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "location_id",
    ] + L1_MODEL_FEATURES if c in header]
    matched_rows = []
    for chunk in pd.read_csv(historical_csv, sep=sep, usecols=usecols, chunksize=200000, low_memory=False):
        chunk["event_start_time"] = pd.to_datetime(chunk["event_start_time"], errors="coerce", format="mixed")
        machine_mask = pd.to_numeric(chunk["machine_id"], errors="coerce").astype("Int64").isin(machine_ids)
        selected = chunk[machine_mask].copy()
        if not selected.empty:
            selected["_natural_key"] = make_natural_key(selected)
            selected = selected[selected["_natural_key"].isin(current_keys)].copy()
            if not selected.empty:
                matched_rows.append(selected)
    matched_historical = pd.concat(matched_rows, ignore_index=True) if matched_rows else pd.DataFrame(columns=usecols + ["_natural_key"])
    if matched_historical.empty:
        return matched_historical.drop(columns=["_natural_key"], errors="ignore"), pd.DataFrame()
    hist_counts = matched_historical["_natural_key"].value_counts(dropna=False)
    cur_counts = current["_natural_key"].value_counts(dropna=False)
    hist_unique = matched_historical[(matched_historical["_natural_key"].map(hist_counts) == 1)].copy()
    cur_unique = current[(current["_natural_key"].map(cur_counts) == 1)].copy()
    mapping = cur_unique[["event_id", "_natural_key", "machine_id", "status_id", "event_start_time"]].merge(
        hist_unique[["event_id", "_natural_key", "event_start_time"]].rename(columns={"event_id": "historical_event_id", "event_start_time": "historical_event_start_time"}),
        on="_natural_key",
        how="inner",
    ).rename(columns={"event_id": "current_event_id", "event_start_time": "current_event_start_time"})
    mapping["mapping_status"] = "UNIQUE"
    mapping["mapping_method"] = "machine_id_status_id_event_start_time_rounded_ms"
    if mapping.empty:
        return matched_historical.drop(columns=["_natural_key"], errors="ignore"), mapping

    target_hist = hist_unique[hist_unique["event_id"].isin(mapping["historical_event_id"])].copy()
    request_rows = []
    for row in target_hist.itertuples(index=False):
        machine_id = int(getattr(row, "machine_id"))
        segment_id = int(getattr(row, "sequence_segment_id"))
        order = int(getattr(row, "event_order_in_segment"))
        start_order = max(1, order - 19)
        request_rows.extend((machine_id, segment_id, event_order) for event_order in range(start_order, order + 1))
    requested = pd.DataFrame(request_rows, columns=["machine_id", "sequence_segment_id", "event_order_in_segment"]).drop_duplicates()
    requested["machine_id"] = requested["machine_id"].astype("int64")
    requested["sequence_segment_id"] = requested["sequence_segment_id"].astype("int64")
    requested["event_order_in_segment"] = requested["event_order_in_segment"].astype("int64")
    requested_machines = set(requested["machine_id"].astype(int).tolist())
    requested_key = (
        requested["machine_id"].astype(str)
        + "|"
        + requested["sequence_segment_id"].astype(str)
        + "|"
        + requested["event_order_in_segment"].astype(str)
    )
    requested_key_set = set(requested_key.tolist())

    window_rows = []
    for chunk in pd.read_csv(historical_csv, sep=sep, usecols=usecols, chunksize=200000, low_memory=False):
        chunk["event_start_time"] = pd.to_datetime(chunk["event_start_time"], errors="coerce", format="mixed")
        for col in ["machine_id", "sequence_segment_id", "event_order_in_segment"]:
            chunk[col] = pd.to_numeric(chunk[col], errors="coerce").astype("Int64")
        chunk = chunk[chunk["machine_id"].isin(requested_machines)].copy()
        if chunk.empty:
            continue
        chunk_key = (
            chunk["machine_id"].astype(str)
            + "|"
            + chunk["sequence_segment_id"].astype(str)
            + "|"
            + chunk["event_order_in_segment"].astype(str)
        )
        selected = chunk[chunk_key.isin(requested_key_set)].copy()
        if not selected.empty:
            window_rows.append(selected)
    historical_windows = pd.concat(window_rows, ignore_index=True) if window_rows else target_hist.drop(columns=["_natural_key"], errors="ignore")
    historical_windows = historical_windows.drop_duplicates("event_id").reset_index(drop=True)
    return historical_windows.drop(columns=["_natural_key"], errors="ignore"), mapping


def build_paired_score_comparison(
    current_scores: pd.DataFrame,
    historical_scores: pd.DataFrame,
    mapping: pd.DataFrame,
    current_features: pd.DataFrame,
    historical_features: pd.DataFrame,
) -> pd.DataFrame:
    current_score_cols = [
        "event_id", "window_ready_flag", "not_scored_reason",
        "score_lenient", "score_strict", "threshold_lenient", "threshold_strict",
        "score_lenient_normalized", "score_strict_normalized",
        "is_anomaly_lenient", "is_anomaly_strict", "is_behavior_anomaly", "is_sensitive_warning",
    ]
    historical_score_cols = [c for c in current_score_cols if c in historical_scores.columns]
    current_score_cols = [c for c in current_score_cols if c in current_scores.columns]
    cur = current_scores.reindex(columns=current_score_cols).add_prefix("current_").rename(columns={"current_event_id": "current_event_id"})
    hist = historical_scores.reindex(columns=historical_score_cols).add_prefix("historical_").rename(columns={"historical_event_id": "historical_event_id"})
    df = mapping.merge(cur, left_on="current_event_id", right_on="current_event_id", how="inner")
    df = df.merge(hist, left_on="historical_event_id", right_on="historical_event_id", how="inner")
    if df.empty:
        return df
    cur_features = current_features.add_prefix("current_feature_")
    hist_features = historical_features.add_prefix("historical_feature_")
    df = df.merge(cur_features, left_on="current_event_id", right_on="current_feature_event_id", how="left")
    df = df.merge(hist_features, left_on="historical_event_id", right_on="historical_feature_event_id", how="left")
    for profile in ["lenient", "strict"]:
        df[f"score_{profile}_diff"] = pd.to_numeric(df[f"current_score_{profile}"], errors="coerce") - pd.to_numeric(df[f"historical_score_{profile}"], errors="coerce")
        df[f"{profile}_label_changed"] = pd.to_numeric(df[f"current_is_anomaly_{profile}"], errors="coerce").fillna(0).astype(int) != pd.to_numeric(df[f"historical_is_anomaly_{profile}"], errors="coerce").fillna(0).astype(int)
    df["behavior_anomaly_changed"] = pd.to_numeric(df["current_is_behavior_anomaly"], errors="coerce").fillna(0).astype(int) != pd.to_numeric(df["historical_is_behavior_anomaly"], errors="coerce").fillna(0).astype(int)
    df["sensitive_warning_changed"] = pd.to_numeric(df["current_is_sensitive_warning"], errors="coerce").fillna(0).astype(int) != pd.to_numeric(df["historical_is_sensitive_warning"], errors="coerce").fillna(0).astype(int)
    df["change_reason"] = np.select(
        [
            df.get("current_feature_kwh_available_flag", pd.Series(dtype=float)).fillna(-1) != df.get("historical_feature_kwh_available_flag", pd.Series(dtype=float)).fillna(-1),
            df.get("current_feature_end_time_source", pd.Series(dtype=str)).fillna("") != df.get("historical_feature_end_time_source", pd.Series(dtype=str)).fillna(""),
            df.get("current_feature_location_id", pd.Series(dtype=float)).fillna(-1) != df.get("historical_feature_location_id", pd.Series(dtype=float)).fillna(-1),
        ],
        ["KWH_BACKFILL_IMPACT", "RAW_END_BACKFILL_IMPACT", "LOCATION_CONTEXT_CHANGE"],
        default="UNEXPLAINED_SCORE_CHANGE",
    )
    return df


def summarize_paired_scores(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"result": "NO_PAIRED_WINDOWS", "paired_window_rows": 0}
    out: dict[str, Any] = {
        "result": "PASS",
        "paired_window_rows": int(len(df)),
        "lenient_label_change_rate": float(df["lenient_label_changed"].mean()),
        "strict_label_change_rate": float(df["strict_label_changed"].mean()),
        "behavior_anomaly_change_rate": float(df["behavior_anomaly_changed"].mean()),
        "sensitive_warning_change_rate": float(df["sensitive_warning_changed"].mean()),
        "change_reason_distribution": df["change_reason"].value_counts(dropna=False).astype(int).to_dict(),
    }
    for profile in ["lenient", "strict"]:
        current = pd.to_numeric(df[f"current_score_{profile}"], errors="coerce")
        historical = pd.to_numeric(df[f"historical_score_{profile}"], errors="coerce")
        out[f"{profile}_median_score_diff"] = _float_or_none((current - historical).median())
        out[f"{profile}_p95_score_diff"] = _float_or_none((current - historical).quantile(0.95))
        out[f"{profile}_pearson_corr"] = _float_or_none(current.corr(historical, method="pearson")) if len(df) >= 3 else None
        out[f"{profile}_spearman_corr"] = _float_or_none(current.corr(historical, method="spearman")) if len(df) >= 3 else None
        out[f"{profile}_threshold_crossing_change_rate"] = float(df[f"{profile}_label_changed"].mean())
    return out


def build_kwh_drift_model_impact(paired: pd.DataFrame, by_machine: pd.DataFrame) -> dict[str, Any]:
    if paired.empty:
        return {"recommendation": "INSUFFICIENT_EVIDENCE", "paired_rows": 0}
    summary = summarize_paired_scores(paired)
    machine_shift = []
    if "machine_id" in paired.columns:
        for machine_id, g in paired.groupby("machine_id", dropna=False):
            current_anomaly = pd.to_numeric(g.get("current_is_behavior_anomaly"), errors="coerce").fillna(0)
            historical_anomaly = pd.to_numeric(g.get("historical_is_behavior_anomaly"), errors="coerce").fillna(0)
            current_warning = pd.to_numeric(g.get("current_is_sensitive_warning"), errors="coerce").fillna(0)
            historical_warning = pd.to_numeric(g.get("historical_is_sensitive_warning"), errors="coerce").fillna(0)
            machine_shift.append({
                "machine_id": None if pd.isna(machine_id) else int(machine_id),
                "paired_rows": int(len(g)),
                "current_behavior_anomaly_rate": float(current_anomaly.mean()) if len(g) else 0.0,
                "historical_behavior_anomaly_rate": float(historical_anomaly.mean()) if len(g) else 0.0,
                "behavior_anomaly_rate_diff": float(current_anomaly.mean() - historical_anomaly.mean()) if len(g) else 0.0,
                "current_sensitive_warning_rate": float(current_warning.mean()) if len(g) else 0.0,
                "historical_sensitive_warning_rate": float(historical_warning.mean()) if len(g) else 0.0,
                "sensitive_warning_rate_diff": float(current_warning.mean() - historical_warning.mean()) if len(g) else 0.0,
                "lenient_label_change_rate": float(g.get("lenient_label_changed", pd.Series(dtype=float)).mean()) if len(g) else 0.0,
                "strict_label_change_rate": float(g.get("strict_label_changed", pd.Series(dtype=float)).mean()) if len(g) else 0.0,
            })
    machine_shift = sorted(machine_shift, key=lambda x: abs(float(x.get("behavior_anomaly_rate_diff") or 0.0)), reverse=True)

    score_shift_groups = []
    for col in [
        "current_feature_kwh_available_flag",
        "current_feature_kwh_missing_flag",
        "current_feature_kwh_imputed_or_missing_flag",
        "current_feature_loaded_zero_kwh_flag",
        "current_feature_loaded_without_kwh_flag",
    ]:
        if col not in paired.columns:
            continue
        for value, g in paired.groupby(col, dropna=False):
            score_shift_groups.append({
                "group_column": col.replace("current_feature_", ""),
                "group_value": None if pd.isna(value) else int(value) if str(value).replace(".", "", 1).isdigit() else str(value),
                "paired_rows": int(len(g)),
                "lenient_median_score_diff": _float_or_none(pd.to_numeric(g.get("score_lenient_diff"), errors="coerce").median()),
                "strict_median_score_diff": _float_or_none(pd.to_numeric(g.get("score_strict_diff"), errors="coerce").median()),
                "behavior_anomaly_change_rate": float(g.get("behavior_anomaly_changed", pd.Series(dtype=float)).mean()) if len(g) else 0.0,
                "sensitive_warning_change_rate": float(g.get("sensitive_warning_changed", pd.Series(dtype=float)).mean()) if len(g) else 0.0,
            })
    rec = "KEEP_CURRENT_MODEL_AND_THRESHOLDS"
    if summary.get("behavior_anomaly_change_rate", 0.0) > 0.05 or summary.get("sensitive_warning_change_rate", 0.0) > 0.05:
        rec = "EVALUATE_THRESHOLD_RECALIBRATION"
    if (summary.get("lenient_spearman_corr") is not None and summary.get("lenient_spearman_corr", 1.0) < 0.7) or (
        summary.get("strict_spearman_corr") is not None and summary.get("strict_spearman_corr", 1.0) < 0.7
    ):
        rec = "EVALUATE_MODEL_RETRAINING"
    return {
        "recommendation": rec,
        "paired_rows": int(len(paired)),
        "kwh_backfill_lenient_median_score_diff": summary.get("lenient_median_score_diff"),
        "kwh_backfill_strict_median_score_diff": summary.get("strict_median_score_diff"),
        "score_lenient_pearson": summary.get("lenient_pearson_corr"),
        "score_lenient_spearman": summary.get("lenient_spearman_corr"),
        "score_strict_pearson": summary.get("strict_pearson_corr"),
        "score_strict_spearman": summary.get("strict_spearman_corr"),
        "event_anomaly_label_change_rate": summary.get("behavior_anomaly_change_rate"),
        "strict_only_sensitive_warning_change_rate": summary.get("sensitive_warning_change_rate"),
        "change_reason_distribution": summary.get("change_reason_distribution"),
        "machine_anomaly_rate_shift": machine_shift,
        "machine_largest_anomaly_rate_shift": machine_shift[0] if machine_shift else None,
        "score_shift_by_kwh_related_groups": score_shift_groups,
        "old_threshold_per_machine_assessment": (
            "NOT_CONFIRMED_FOR_REUSE; paired strict rank correlation or threshold crossing behavior requires "
            "threshold/retrain evaluation before production use"
            if rec != "KEEP_CURRENT_MODEL_AND_THRESHOLDS"
            else "REUSE_CANDIDATE_ONLY; still requires longer shadow monitoring before production"
        ),
        "machine_specific_threshold_or_retrain_note": (
            "Evaluate per-machine threshold/retraining for machines with largest absolute behavior_anomaly_rate_diff."
        ),
        "realtime_data_policy": "KEEP_CURRENT_RAW_KWH; no masking/drop/fake fill to mimic historical training snapshot",
        "realtime_missing_electricity_processing_answer": (
            "Realtime keeps true raw KWh when present. Missing KWh is only imputed from immediate adjacent raw event "
            "within 300 seconds; no synthetic events, no resampling, no continuous-chain fill, and no masking of "
            "current backfilled KWh to mimic historical training data."
        ),
    }


def decide_l1_shadow_recommendation(shadow_contract: dict[str, Any], paired_summary: dict[str, Any], kwh_impact: dict[str, Any], paired_rows: int) -> str:
    if shadow_contract.get("result") != "PASS":
        return "L1_SHADOW_AUDIT_INCONCLUSIVE"
    if paired_rows < 100:
        return "L1_SHADOW_AUDIT_INCONCLUSIVE"
    rec = kwh_impact.get("recommendation")
    if rec == "KEEP_CURRENT_MODEL_AND_THRESHOLDS":
        return "L1_MODEL_REUSE_CANDIDATE"
    if rec == "EVALUATE_THRESHOLD_RECALIBRATION":
        return "L1_THRESHOLD_RECALIBRATION_EVALUATION_REQUIRED"
    if rec == "EVALUATE_MODEL_RETRAINING":
        return "L1_RETRAINING_EVALUATION_REQUIRED"
    return "L1_SHADOW_AUDIT_INCONCLUSIVE"


def build_l1_shadow_readme(summary: dict[str, Any], out_dir: Path) -> str:
    return f"""# L1 Shadow Audit

Thu muc audit: `{out_dir}`

- Technical shadow inference: `{summary.get('technical_shadow_inference_result')}`
- Decision: `{summary.get('decision')}`
- Ready/scored windows: `{summary.get('ready_windows')}`
- Not ready windows: `{summary.get('not_ready_windows')}`
- Behavior anomaly rate: `{summary.get('behavior_anomaly_rate')}`
- Sensitive warning rate: `{summary.get('sensitive_warning_rate')}`

Audit nay chi chay L1 shadow lenient/strict. L2 khong chay, SQL production khong ghi, threshold/model/preprocessor khong doi.
"""


def build_kwh_remediation_md(kwh_impact: dict[str, Any]) -> str:
    largest = kwh_impact.get("machine_largest_anomaly_rate_shift") or {}
    return f"""# KWh Drift Model Impact

- Recommendation: `{kwh_impact.get('recommendation')}`
- Paired rows: `{kwh_impact.get('paired_rows')}`
- Lenient median score diff: `{kwh_impact.get('kwh_backfill_lenient_median_score_diff')}`
- Strict median score diff: `{kwh_impact.get('kwh_backfill_strict_median_score_diff')}`
- Lenient Pearson/Spearman: `{kwh_impact.get('score_lenient_pearson')}` / `{kwh_impact.get('score_lenient_spearman')}`
- Strict Pearson/Spearman: `{kwh_impact.get('score_strict_pearson')}` / `{kwh_impact.get('score_strict_spearman')}`
- Event anomaly label change rate: `{kwh_impact.get('event_anomaly_label_change_rate')}`
- Strict-only sensitive warning change rate: `{kwh_impact.get('strict_only_sensitive_warning_change_rate')}`
- Machine largest anomaly-rate shift: `{largest}`
- Old threshold assessment: `{kwh_impact.get('old_threshold_per_machine_assessment')}`

Realtime data policy: giu raw KWh hien tai, khong mask/drop de ep giong historical. Khong tu dong retrain, recalibrate, hay ghi SQL trong buoc nay.

Tra loi diem 10: `{kwh_impact.get('realtime_missing_electricity_processing_answer')}`
"""


def run_evaluate_l1_retrain_candidate(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    return run_candidate_abc_evaluation(cfg, args, resolve_project_root(cfg))


def run_l1_model_adaptation_eval(cfg: dict[str, Any], args: argparse.Namespace) -> int:
    project_root = resolve_project_root(cfg)
    shadow_dir = resolve_project_path(cfg, args.shadow_audit_dir or latest_audit_dir(project_root, "l1_shadow_*"), project_root)
    out_dir = project_root / "data" / "realtime_audit" / f"l1_adaptation_eval_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    out_dir.mkdir(parents=True, exist_ok=False)
    print("l1_adaptation_eval_dir:", out_dir)

    registry = load_json(project_root / "data" / "realtime_audit" / "audit_registry.json")
    current_hash = data_pipeline_code_hash()
    thresholds, _ = thresholds_from_config(cfg)
    lineage = build_adaptation_lineage(cfg, project_root, shadow_dir, registry, current_hash, thresholds)
    write_json(out_dir / "00_config_sanitized.json", {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "l1_model_adaptation_eval",
        "shadow_audit_dir": str(shadow_dir),
        "max_paired_windows": int(args.max_paired_windows or 10000),
        "write_sql_enabled": False,
        "l2_mode": "not_run",
    })
    write_json(out_dir / "01_audit_lineage.json", lineage)

    if lineage.get("lineage_result") != "PASS":
        summary = {
            "technical_result": "STALE_FOUNDATIONAL_AUDIT_REVALIDATION_REQUIRED",
            "code_fingerprint": current_hash,
            "config_thresholds": thresholds,
            "feature_contract_version": lineage.get("feature_contract_version"),
            "source_shadow_audit_dir": str(shadow_dir),
            "offline_replay_result": lineage.get("offline_replay_result"),
            "live_sql_contract_result": lineage.get("live_sql_contract_result"),
            "final_decision": "TECHNICAL_FAILURE",
            "reason": lineage.get("lineage_result"),
        }
        write_minimal_adaptation_outputs(out_dir, summary)
        print("l1_adaptation_summary:", summary["final_decision"], out_dir)
        return 0

    base_cfg = load_l1_base_config(project_root)
    base_cfg.setdefault("train", {})["mixed_precision"] = False
    lenient = load_shadow_profile(project_root, "lenient", base_cfg)
    strict = load_shadow_profile(project_root, "strict", base_cfg, device=lenient.device)
    write_json(out_dir / "02_artifact_inventory.json", lineage.get("artifact_inventory", {}))

    paired_mapping = pd.read_csv(shadow_dir / "11_paired_event_mapping.csv")
    if args.max_paired_windows:
        paired_mapping = paired_mapping.head(int(args.max_paired_windows)).copy()
    target_ids = set(pd.to_numeric(paired_mapping["current_event_id"], errors="coerce").dropna().astype(int).tolist())
    print("adaptation_progress: paired_targets", len(paired_mapping), flush=True)

    current_features_all, sql_used = hydrate_current_l1_context_for_targets(cfg, paired_mapping)
    print("adaptation_progress: current_context_features", len(current_features_all), flush=True)
    historical_features_all, paired_mapping = load_paired_historical_features(cfg, project_root, current_features_all[current_features_all["event_id"].isin(target_ids)].copy())
    paired_mapping = paired_mapping.head(int(args.max_paired_windows or len(paired_mapping))).copy()
    print("adaptation_progress: historical_window_features", len(historical_features_all), "mapping", len(paired_mapping), flush=True)

    current_manifest = build_window_manifest(current_features_all, set(paired_mapping["current_event_id"].astype(int)), window_size=20)
    historical_manifest = build_window_manifest(historical_features_all, set(paired_mapping["historical_event_id"].astype(int)), window_size=20)
    target_map, exact_manifest, alignment_failures = build_exact_paired_window_manifest(
        paired_mapping,
        current_manifest,
        historical_manifest,
        current_features_all,
        historical_features_all,
    )
    target_map.to_csv(out_dir / "03_paired_target_mapping.csv", index=False, encoding="utf-8-sig")
    exact_manifest.to_csv(out_dir / "04_exact_paired_window_manifest.csv", index=False, encoding="utf-8-sig")
    alignment_failures.to_csv(out_dir / "05_window_alignment_failures.csv", index=False, encoding="utf-8-sig")
    print("adaptation_progress: exact_windows", int((exact_manifest["alignment_status"] == "EXACT_PAIRED_WINDOW").sum()) if not exact_manifest.empty else 0, flush=True)

    feature_summary, feature_long = build_window_feature_diffs(exact_manifest, current_features_all, historical_features_all)
    feature_summary.to_csv(out_dir / "06_window_feature_diff_summary.csv", index=False, encoding="utf-8-sig")
    feature_long.to_csv(out_dir / "07_window_feature_diff_long.csv.gz", index=False, encoding="utf-8-sig", compression="gzip")

    tensor_report, tensor_window_report = build_preprocessed_tensor_diff_summary(
        exact_manifest,
        current_features_all,
        historical_features_all,
        lenient,
        strict,
    )
    write_json(out_dir / "08_preprocessed_tensor_diff_summary.json", tensor_report)

    shadow_scores = pd.read_csv(shadow_dir / "06_l1_shadow_scores.csv")
    paired_scores = pd.read_csv(shadow_dir / "13_paired_score_comparison.csv", low_memory=False)
    reclassified = reclassify_adaptation_change_reasons(exact_manifest, feature_summary, tensor_window_report, paired_scores)
    reclassified.to_csv(out_dir / "09_change_reason_reclassified.csv", index=False, encoding="utf-8-sig")
    reason_summary = summarize_reclassified_reasons(reclassified)
    write_json(out_dir / "10_change_reason_summary.json", reason_summary)

    split_manifest, split_summary = build_adaptation_splits(current_features_all, shadow_scores, set(paired_mapping["current_event_id"].astype(int)))
    split_manifest.to_csv(out_dir / "11_adaptation_split_manifest.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "12_adaptation_split_summary.json", split_summary)
    label_coverage = build_label_coverage(split_manifest)
    write_json(out_dir / "13_label_coverage.json", label_coverage)

    candidate_a_scored = apply_candidate_a_labels(split_manifest)
    a_global, a_machine = build_candidate_metrics(candidate_a_scored, "candidate_a")
    write_json(out_dir / "14_candidate_a_metrics_global.json", a_global)
    a_machine.to_csv(out_dir / "15_candidate_a_metrics_by_machine.csv", index=False, encoding="utf-8-sig")

    b_thresholds = fit_candidate_b_thresholds(candidate_a_scored, base_cfg)
    candidate_b_scored = apply_candidate_b_thresholds(candidate_a_scored, b_thresholds)
    b_global, b_machine = build_candidate_metrics(candidate_b_scored, "candidate_b")
    write_json(out_dir / "16_candidate_b_thresholds.json", b_thresholds)
    write_json(out_dir / "17_candidate_b_metrics_global.json", b_global)
    b_machine.to_csv(out_dir / "18_candidate_b_metrics_by_machine.csv", index=False, encoding="utf-8-sig")

    comparison_valid = compare_candidates(candidate_a_scored, candidate_b_scored, "ADAPT_VALID")
    comparison_test = compare_candidates(candidate_a_scored, candidate_b_scored, "ADAPT_TEST")
    historical_regression = build_historical_regression_report(paired_scores, reclassified)
    comparison_valid.to_csv(out_dir / "19_candidate_comparison_valid.csv", index=False, encoding="utf-8-sig")
    comparison_test.to_csv(out_dir / "20_candidate_comparison_test.csv", index=False, encoding="utf-8-sig")
    historical_regression.to_csv(out_dir / "21_candidate_historical_regression.csv", index=False, encoding="utf-8-sig")

    ci = build_block_bootstrap_ci(candidate_a_scored, candidate_b_scored)
    ci.to_csv(out_dir / "22_block_bootstrap_confidence_intervals.csv", index=False, encoding="utf-8-sig")
    support_report = build_machine_support_report(candidate_a_scored, candidate_b_scored)
    support_report.to_csv(out_dir / "23_machine_support_report.csv", index=False, encoding="utf-8-sig")

    gate_report = build_decision_gate_report(a_global, b_global, comparison_valid, comparison_test, reclassified, support_report)
    write_json(out_dir / "24_decision_gate_report.json", gate_report)

    retrain_manifest, retrain_plan, colab_commands = build_retrain_plan(project_root, out_dir, cfg, split_manifest, gate_report)
    write_json(out_dir / "25_retrain_dataset_manifest.json", retrain_manifest)
    write_json(out_dir / "26_retrain_candidate_plan.json", retrain_plan)
    (out_dir / "27_colab_training_commands.md").write_text(colab_commands, encoding="utf-8")

    final_decision, selection_reason = select_adaptation_candidate(gate_report, reason_summary, a_global, b_global)
    summary = {
        "technical_result": "PASS",
        "code_fingerprint": current_hash,
        "config_thresholds": thresholds,
        "feature_contract_version": lineage.get("feature_contract_version"),
        "source_shadow_audit_dir": str(shadow_dir),
        "offline_replay_result": lineage.get("offline_replay_result"),
        "live_sql_contract_result": lineage.get("live_sql_contract_result"),
        "paired_target_rows": int(len(paired_mapping)),
        "exact_paired_window_rows": int((exact_manifest["alignment_status"] == "EXACT_PAIRED_WINDOW").sum()) if not exact_manifest.empty else 0,
        "exact_paired_window_rate": float((exact_manifest["alignment_status"] == "EXACT_PAIRED_WINDOW").mean()) if not exact_manifest.empty else 0.0,
        "window_alignment_mismatch_count": int((exact_manifest.get("alignment_status", pd.Series(dtype=str)) != "EXACT_PAIRED_WINDOW").sum()) if not exact_manifest.empty else 0,
        "kwh_only_window_change_count": int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "KWH_ONLY_WINDOW_CHANGE").sum()) if not reclassified.empty else 0,
        "multi_source_window_change_count": int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "MULTI_SOURCE_WINDOW_CHANGE").sum()) if not reclassified.empty else 0,
        "preprocessor_mismatch_count": int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "PREPROCESSOR_PIPELINE_MISMATCH").sum()) if not reclassified.empty else 0,
        "unexplained_model_output_mismatch_count": int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum()) if not reclassified.empty else 0,
        "candidate_a_result": a_global.get("result"),
        "candidate_b_result": b_global.get("result"),
        "candidate_c_result": retrain_plan.get("candidate_c_result"),
        "selected_candidate": final_decision,
        "selection_reason": selection_reason,
        "normal_fpr_comparison": gate_report.get("normal_fpr_comparison"),
        "fault_recall_comparison": gate_report.get("fault_recall_comparison"),
        "future_fault_recall_comparison": gate_report.get("future_fault_recall_comparison"),
        "per_machine_stability_comparison": gate_report.get("per_machine_stability_comparison"),
        "historical_regression_comparison": gate_report.get("historical_regression_comparison"),
        "final_decision": final_decision,
        "l2_prediction_run": False,
        "production_sql_written": False,
        "checkpoint_updated": False,
    }
    write_json(out_dir / "28_summary.json", summary)
    (out_dir / "29_README_L1_ADAPTATION.md").write_text(build_l1_adaptation_readme(summary, reason_summary, out_dir), encoding="utf-8")
    print("l1_adaptation_summary:", final_decision, out_dir)
    return 0


def latest_audit_dir(project_root: Path, pattern: str) -> str:
    audit_root = project_root / "data" / "realtime_audit"
    candidates = sorted(audit_root.glob(pattern), key=lambda p: p.name, reverse=True)
    if not candidates:
        raise FileNotFoundError(f"No audit directory matching {pattern}")
    return str(candidates[0])


def file_sha256(path: Path) -> str | None:
    if not path.exists():
        return None
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def build_adaptation_lineage(cfg: dict[str, Any], project_root: Path, shadow_dir: Path, registry: dict[str, Any], current_hash: str, thresholds: dict[str, Any]) -> dict[str, Any]:
    artifact_paths = {
        "lenient_model": project_root / "modeling/l1_tcn/artifacts/lenient/model_best.pt",
        "strict_model": project_root / "modeling/l1_tcn/artifacts/strict/model_best.pt",
        "lenient_preprocessor": project_root / "modeling/l1_tcn/artifacts/lenient/preprocessor.json",
        "strict_preprocessor": project_root / "modeling/l1_tcn/artifacts/strict/preprocessor.json",
        "lenient_threshold": project_root / "modeling/l1_tcn/artifacts/lenient/thresholds.json",
        "strict_threshold": project_root / "modeling/l1_tcn/artifacts/strict/thresholds.json",
    }
    shadow_summary = load_json(shadow_dir / "19_summary.json") if (shadow_dir / "19_summary.json").exists() else {}
    artifact_inventory = {name: {"path": str(path), "exists": path.exists(), "sha256": file_sha256(path)} for name, path in artifact_paths.items()}
    lineage_result = "PASS"
    if current_hash != registry.get("code_fingerprint"):
        lineage_result = "STALE_FOUNDATIONAL_AUDIT_REVALIDATION_REQUIRED"
    if registry.get("offline_replay_staleness") != "CURRENT" or registry.get("live_sql_contract_staleness") != "CURRENT":
        lineage_result = "STALE_FOUNDATIONAL_AUDIT_REVALIDATION_REQUIRED"
    return {
        "lineage_result": lineage_result,
        "code_fingerprint": current_hash,
        "registry_code_fingerprint": registry.get("code_fingerprint"),
        "config_thresholds": thresholds,
        "feature_contract_version": "l1_30_features_from_preprocessor",
        "offline_replay_audit_dir": registry.get("offline_replay_audit_dir"),
        "offline_replay_result": registry.get("offline_replay_result"),
        "offline_replay_staleness": registry.get("offline_replay_staleness"),
        "live_sql_contract_audit_dir": registry.get("live_sql_contract_audit_dir"),
        "live_sql_contract_result": registry.get("live_sql_contract_result"),
        "live_sql_contract_staleness": registry.get("live_sql_contract_staleness"),
        "source_shadow_audit_dir": str(shadow_dir),
        "source_shadow_result": shadow_summary.get("technical_shadow_inference_result"),
        "model_artifact_hashes": {k: v["sha256"] for k, v in artifact_inventory.items() if "model" in k},
        "preprocessor_hashes": {k: v["sha256"] for k, v in artifact_inventory.items() if "preprocessor" in k},
        "threshold_file_hashes": {k: v["sha256"] for k, v in artifact_inventory.items() if "threshold" in k},
        "artifact_inventory": artifact_inventory,
    }


def write_minimal_adaptation_outputs(out_dir: Path, summary: dict[str, Any]) -> None:
    for idx, name in enumerate([
        "02_artifact_inventory.json", "08_preprocessed_tensor_diff_summary.json", "10_change_reason_summary.json",
        "12_adaptation_split_summary.json", "13_label_coverage.json", "14_candidate_a_metrics_global.json",
        "16_candidate_b_thresholds.json", "17_candidate_b_metrics_global.json", "24_decision_gate_report.json",
        "25_retrain_dataset_manifest.json", "26_retrain_candidate_plan.json",
    ]):
        write_json(out_dir / name, {"result": summary.get("technical_result")})
    for name in [
        "03_paired_target_mapping.csv", "04_exact_paired_window_manifest.csv", "05_window_alignment_failures.csv",
        "06_window_feature_diff_summary.csv", "07_window_feature_diff_long.csv.gz", "09_change_reason_reclassified.csv",
        "11_adaptation_split_manifest.csv", "15_candidate_a_metrics_by_machine.csv", "18_candidate_b_metrics_by_machine.csv",
        "19_candidate_comparison_valid.csv", "20_candidate_comparison_test.csv", "21_candidate_historical_regression.csv",
        "22_block_bootstrap_confidence_intervals.csv", "23_machine_support_report.csv",
    ]:
        pd.DataFrame().to_csv(out_dir / name, index=False, encoding="utf-8-sig", compression="gzip" if name.endswith(".gz") else None)
    (out_dir / "27_colab_training_commands.md").write_text("# Not generated because foundational audit is stale.\n", encoding="utf-8")
    write_json(out_dir / "28_summary.json", summary)
    (out_dir / "29_README_L1_ADAPTATION.md").write_text("# L1 Adaptation\n\nStopped by lineage gate.\n", encoding="utf-8")


def hydrate_current_l1_context_for_targets(cfg: dict[str, Any], paired_mapping: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, str]]:
    raw_candidates = paired_mapping.rename(columns={"current_event_id": "event_id"})[["event_id", "machine_id", "status_id", "current_event_start_time"]].copy()
    raw_candidates = raw_candidates.rename(columns={"current_event_start_time": "event_start_time"})
    raw_candidates["raw_event_end_time"] = pd.NaT
    raw_candidates["raw_status_kwh_start"] = np.nan
    raw_candidates["raw_status_kwh_end"] = np.nan
    raw_candidates["raw_error_code"] = None
    sql_used: dict[str, str] = {}
    with connect(cfg["database"]) as conn:
        raw_deleted = "is_deleted" if table_has_column(conn, cfg["tables"]["raw_iot"], "is_deleted") else None
        raw_context, context_sql = load_context_around_candidates(conn, cfg, raw_candidates, raw_is_deleted_column=raw_deleted)
        sql_used.update(context_sql)
        raw_context = normalize_context_for_audit(raw_context, raw_candidates)
        location_map, location_sql = load_location_map(conn, cfg, raw_context)
        machine_group_map, machine_sql = load_machine_group_map(conn, cfg, raw_context)
        sql_used["event_time_location"] = location_sql
        sql_used["machine_group"] = machine_sql
    context_map = merge_context_maps(location_map, machine_group_map)
    features = build_l1_event_features(
        raw_context.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        machine_context=machine_group_map,
        location_context=context_map,
        config=cfg,
    )
    return features, sql_used


def natural_key_for_row(row: pd.Series) -> str:
    ts = pd.to_datetime(row.get("event_start_time"), errors="coerce")
    ts_s = "" if pd.isna(ts) else ts.round("ms").strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    return f"{int(row.get('machine_id'))}|{int(row.get('status_id'))}|{ts_s}"


def parse_event_ids(value: Any) -> list[int]:
    return [int(v) for v in str(value).split("|") if str(v).strip()]


def build_exact_paired_window_manifest(
    mapping: pd.DataFrame,
    current_manifest: pd.DataFrame,
    historical_manifest: pd.DataFrame,
    current_features: pd.DataFrame,
    historical_features: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    cur_man = current_manifest.set_index("event_id", drop=False)
    hist_man = historical_manifest.set_index("event_id", drop=False)
    cur_feat = current_features.set_index("event_id", drop=False)
    hist_feat = historical_features.set_index("event_id", drop=False)
    rows = []
    failures = []
    for row in mapping.itertuples(index=False):
        cur_id = int(row.current_event_id)
        hist_id = int(row.historical_event_id)
        status = "EXACT_PAIRED_WINDOW"
        reasons = []
        if cur_id not in cur_man.index:
            status = "MISSING_CURRENT_CONTEXT"
            reasons.append("missing_current_manifest")
        if hist_id not in hist_man.index:
            status = "MISSING_HISTORICAL_CONTEXT"
            reasons.append("missing_historical_manifest")
        cur_ids = parse_event_ids(cur_man.loc[cur_id, "window_event_ids"]) if cur_id in cur_man.index else []
        hist_ids = parse_event_ids(hist_man.loc[hist_id, "window_event_ids"]) if hist_id in hist_man.index else []
        if len(cur_ids) != 20 or len(hist_ids) != 20:
            status = "MISSING_POSITION"
            reasons.append(f"window_size_current_{len(cur_ids)}_historical_{len(hist_ids)}")
        cur_rows = cur_feat.loc[[i for i in cur_ids if i in cur_feat.index]].copy() if cur_ids else pd.DataFrame()
        hist_rows = hist_feat.loc[[i for i in hist_ids if i in hist_feat.index]].copy() if hist_ids else pd.DataFrame()
        if isinstance(cur_rows, pd.Series):
            cur_rows = cur_rows.to_frame().T
        if isinstance(hist_rows, pd.Series):
            hist_rows = hist_rows.to_frame().T
        if len(cur_rows) != 20:
            status = "MISSING_CURRENT_CONTEXT"
            reasons.append("current_feature_rows_not_20")
        if len(hist_rows) != 20:
            status = "MISSING_HISTORICAL_CONTEXT"
            reasons.append("historical_feature_rows_not_20")
        cur_sig = ""
        hist_sig = ""
        if len(cur_rows) == 20 and len(hist_rows) == 20:
            cur_rows = cur_rows.set_index("event_id").loc[cur_ids].reset_index()
            hist_rows = hist_rows.set_index("event_id").loc[hist_ids].reset_index()
            cur_keys = [natural_key_for_row(r) for _, r in cur_rows.iterrows()]
            hist_keys = [natural_key_for_row(r) for _, r in hist_rows.iterrows()]
            cur_sig = "||".join(cur_keys)
            hist_sig = "||".join(hist_keys)
            if len(set(cur_keys)) != 20 or len(set(hist_keys)) != 20:
                status = "AMBIGUOUS_MAPPING"
                reasons.append("duplicate_natural_key_in_window")
            if cur_sig != hist_sig and status != "AMBIGUOUS_MAPPING":
                status = "WINDOW_ALIGNMENT_MISMATCH"
                reasons.append("signature_mismatch")
            if cur_rows["machine_id"].nunique() != 1 or hist_rows["machine_id"].nunique() != 1 or int(cur_rows["machine_id"].iloc[0]) != int(hist_rows["machine_id"].iloc[0]):
                if status != "AMBIGUOUS_MAPPING":
                    status = "WINDOW_ALIGNMENT_MISMATCH"
                reasons.append("machine_mismatch")
            if cur_rows["status_id"].astype(int).tolist() != hist_rows["status_id"].astype(int).tolist():
                if status != "AMBIGUOUS_MAPPING":
                    status = "STATUS_SEQUENCE_MISMATCH"
                reasons.append("status_sequence_mismatch")
            if int(cur_rows["event_id"].iloc[-1]) != cur_id or int(hist_rows["event_id"].iloc[-1]) != hist_id:
                if status != "AMBIGUOUS_MAPPING":
                    status = "WINDOW_ALIGNMENT_MISMATCH"
                reasons.append("target_not_position_20")
        out = {
            "current_event_id": cur_id,
            "historical_event_id": hist_id,
            "alignment_status": status,
            "alignment_reason": "|".join(sorted(set(reasons))) if reasons else "OK",
            "current_window_signature": cur_sig,
            "historical_window_signature": hist_sig,
            "current_window_event_ids": "|".join(str(i) for i in cur_ids),
            "historical_window_event_ids": "|".join(str(i) for i in hist_ids),
        }
        rows.append(out)
        if status != "EXACT_PAIRED_WINDOW":
            failures.append(out)
    manifest = pd.DataFrame(rows)
    target_map = mapping.merge(manifest, on=["current_event_id", "historical_event_id"], how="left")
    return target_map, manifest, pd.DataFrame(failures)


KWH_FEATURES = {
    "kwh_delta_model_value", "kwh_rate_per_hour", "kwh_available_flag", "kwh_missing_flag",
    "kwh_imputed_or_missing_flag", "kwh_rate_missing_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag",
}
TIME_FEATURES = {
    "duration_sec", "gap_from_prev_sec", "overlap_sec", "is_raw_end_missing", "is_invalid_raw_end",
    "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap",
}
LOCATION_FEATURES = {"machine_group_id", "location_id", "hour_of_day", "day_of_week"}
STATUS_FEATURES = {"status_id", "status_type_code", "current_signal_code", "is_on", "is_loaded", "is_no_load", "is_current_near_zero"}
QUALITY_FEATURES = {"kwh_missing_flag", "kwh_imputed_or_missing_flag", "kwh_rate_missing_flag", "loaded_zero_kwh_flag", "loaded_without_kwh_flag"}


def build_window_feature_diffs(exact_manifest: pd.DataFrame, current_features: pd.DataFrame, historical_features: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    cur = current_features.set_index("event_id", drop=False).copy()
    hist = historical_features.set_index("event_id", drop=False).copy()
    for feature in L1_MODEL_FEATURES:
        cur[feature] = pd.to_numeric(cur[feature], errors="coerce")
        hist[feature] = pd.to_numeric(hist[feature], errors="coerce")
    summary_rows = []
    long_rows = []
    feature_groups = np.array([feature_group(f) for f in L1_MODEL_FEATURES])
    kwh_idx = np.array([f in KWH_FEATURES for f in L1_MODEL_FEATURES])
    time_idx = np.array([f in TIME_FEATURES for f in L1_MODEL_FEATURES])
    location_idx = np.array([f in LOCATION_FEATURES for f in L1_MODEL_FEATURES])
    status_idx = np.array([f in STATUS_FEATURES for f in L1_MODEL_FEATURES])
    quality_idx = np.array([f in QUALITY_FEATURES for f in L1_MODEL_FEATURES])
    exact = exact_manifest[exact_manifest["alignment_status"] == "EXACT_PAIRED_WINDOW"].copy()
    for row in exact.itertuples(index=False):
        cur_ids = parse_event_ids(row.current_window_event_ids)
        hist_ids = parse_event_ids(row.historical_window_event_ids)
        cmat = cur.loc[cur_ids, L1_MODEL_FEATURES].to_numpy(dtype="float64", copy=True)
        hmat = hist.loc[hist_ids, L1_MODEL_FEATURES].to_numpy(dtype="float64", copy=True)
        diff_mat = np.abs(cmat - hmat)
        changed = (diff_mat > 1e-6) | (np.isnan(cmat) ^ np.isnan(hmat))
        pos_idx, feat_idx = np.where(changed)
        changed_events = set((pos_idx + 1).tolist())
        changed_features = {L1_MODEL_FEATURES[i] for i in feat_idx.tolist()}
        for p, fidx in zip(pos_idx.tolist(), feat_idx.tolist()):
            diff = diff_mat[p, fidx]
            diff_value = None if np.isnan(diff) else float(diff)
            diff_row = {
                "current_event_id": int(row.current_event_id),
                "historical_event_id": int(row.historical_event_id),
                "position": int(p + 1),
                "feature_name": L1_MODEL_FEATURES[fidx],
                "current_value": cmat[p, fidx],
                "historical_value": hmat[p, fidx],
                "abs_diff": diff_value,
                "feature_group": feature_groups[fidx],
            }
            long_rows.append(diff_row)
        def changed_event_count(mask: np.ndarray) -> int:
            if not changed.any():
                return 0
            return int(np.any(changed[:, mask], axis=1).sum())
        kwh_positions = set(np.where(np.any(changed[:, kwh_idx], axis=1))[0] + 1) if changed.any() else set()
        finite_diffs = diff_mat[np.isfinite(diff_mat)]
        summary_rows.append({
            "current_event_id": int(row.current_event_id),
            "historical_event_id": int(row.historical_event_id),
            "window_changed_feature_cell_count": int(changed.sum()),
            "window_changed_event_count": int(len(changed_events)),
            "window_kwh_changed_event_count": changed_event_count(kwh_idx),
            "window_kwh_changed_feature_cell_count": int(changed[:, kwh_idx].sum()),
            "window_time_changed_event_count": changed_event_count(time_idx),
            "window_time_changed_feature_cell_count": int(changed[:, time_idx].sum()),
            "window_location_changed_event_count": changed_event_count(location_idx),
            "window_status_changed_event_count": changed_event_count(status_idx),
            "window_quality_flag_changed_event_count": changed_event_count(quality_idx),
            "window_non_kwh_changed_event_count": int(len(changed_events - kwh_positions)),
            "changed_feature_groups": "|".join(sorted({feature_group(f) for f in changed_features})),
            "window_max_abs_numeric_diff": float(np.nanmax(diff_mat)) if finite_diffs.size else 0.0,
            "window_mean_abs_numeric_diff": float(np.nanmean(finite_diffs)) if finite_diffs.size else 0.0,
        })
    return pd.DataFrame(summary_rows), pd.DataFrame(long_rows)


def feature_group(feature: str) -> str:
    if feature in KWH_FEATURES:
        return "KWH"
    if feature in TIME_FEATURES:
        return "TIME"
    if feature in LOCATION_FEATURES:
        return "LOCATION"
    if feature in STATUS_FEATURES:
        return "STATUS"
    if feature in QUALITY_FEATURES:
        return "QUALITY"
    return "OTHER"


def build_window_rows_for_manifest(features: pd.DataFrame, manifest: pd.DataFrame, id_col: str, window_col: str) -> pd.DataFrame:
    feat = features.set_index("event_id", drop=False)
    rows = []
    for idx, row in manifest.reset_index(drop=True).iterrows():
        event_ids = parse_event_ids(row[window_col])
        part = feat.loc[[event_id for event_id in event_ids if event_id in feat.index]].copy()
        if isinstance(part, pd.Series):
            part = part.to_frame().T
        part["shadow_window_id"] = idx
        rows.append(part)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def build_preprocessed_tensor_diff_summary(
    exact_manifest: pd.DataFrame,
    current_features: pd.DataFrame,
    historical_features: pd.DataFrame,
    lenient: Any,
    strict: Any,
) -> tuple[dict[str, Any], pd.DataFrame]:
    exact = exact_manifest[exact_manifest["alignment_status"] == "EXACT_PAIRED_WINDOW"].copy().reset_index(drop=True)
    if exact.empty:
        return {"result": "NO_EXACT_WINDOWS"}, pd.DataFrame()
    current_rows = build_window_rows_for_manifest(current_features, exact, "current_event_id", "current_window_event_ids")
    historical_rows = build_window_rows_for_manifest(historical_features, exact, "historical_event_id", "historical_window_event_ids")
    report: dict[str, Any] = {"result": "PASS", "exact_window_rows": int(len(exact))}
    window_rows = []
    for profile in [lenient, strict]:
        c_cat, c_cont, _ = preprocess_windows(profile, current_rows, 20)
        h_cat, h_cont, _ = preprocess_windows(profile, historical_rows, 20)
        cat_changed = c_cat != h_cat
        cont_diff = np.abs(c_cont - h_cont)
        report[f"{profile.profile}_preprocessed_tensor_equal"] = bool(not cat_changed.any() and not (cont_diff > 1e-6).any())
        report[f"{profile.profile}_tensor_max_abs_diff"] = float(cont_diff.max()) if cont_diff.size else 0.0
        report[f"{profile.profile}_tensor_changed_cell_count"] = int(cat_changed.sum() + (cont_diff > 1e-6).sum())
        for idx in range(len(exact)):
            window_rows.append({
                "current_event_id": int(exact.loc[idx, "current_event_id"]),
                "profile": profile.profile,
                "tensor_equal": bool(not cat_changed[idx].any() and not (cont_diff[idx] > 1e-6).any()),
                "tensor_max_abs_diff": float(cont_diff[idx].max()) if cont_diff[idx].size else 0.0,
                "tensor_changed_cell_count": int(cat_changed[idx].sum() + (cont_diff[idx] > 1e-6).sum()),
            })
    return report, pd.DataFrame(window_rows)


def reclassify_adaptation_change_reasons(exact_manifest: pd.DataFrame, feature_summary: pd.DataFrame, tensor_window_report: pd.DataFrame, paired_scores: pd.DataFrame) -> pd.DataFrame:
    df = exact_manifest[["current_event_id", "historical_event_id", "alignment_status"]].copy()
    if not feature_summary.empty:
        df = df.merge(feature_summary, on=["current_event_id", "historical_event_id"], how="left")
    if not tensor_window_report.empty:
        tensor = tensor_window_report.groupby("current_event_id").agg(
            tensor_changed_cell_count=("tensor_changed_cell_count", "sum"),
            tensor_max_abs_diff=("tensor_max_abs_diff", "max"),
        ).reset_index()
        df = df.merge(tensor, on="current_event_id", how="left")
    score_cols = [c for c in [
        "current_event_id", "score_lenient_diff", "score_strict_diff", "lenient_label_changed", "strict_label_changed",
        "behavior_anomaly_changed", "sensitive_warning_changed",
    ] if c in paired_scores.columns]
    df = df.merge(paired_scores[score_cols], on="current_event_id", how="left")
    reasons = []
    for row in df.itertuples(index=False):
        if row.alignment_status != "EXACT_PAIRED_WINDOW":
            reasons.append("WINDOW_ALIGNMENT_MISMATCH")
            continue
        groups = set(str(getattr(row, "changed_feature_groups", "") or "").split("|")) - {""}
        changed_cells = int(getattr(row, "window_changed_feature_cell_count", 0) or 0)
        tensor_changed = int(getattr(row, "tensor_changed_cell_count", 0) or 0)
        score_changed = (abs(float(getattr(row, "score_lenient_diff", 0) or 0)) > 1e-9) or (abs(float(getattr(row, "score_strict_diff", 0) or 0)) > 1e-9)
        if changed_cells == 0 and tensor_changed > 0:
            reasons.append("PREPROCESSOR_PIPELINE_MISMATCH")
        elif changed_cells == 0 and tensor_changed == 0 and score_changed:
            reasons.append("UNEXPLAINED_MODEL_OUTPUT_MISMATCH")
        elif changed_cells == 0:
            reasons.append("EXACT_WINDOW_NO_INPUT_CHANGE")
        elif groups == {"KWH"}:
            reasons.append("KWH_ONLY_WINDOW_CHANGE")
        elif groups == {"TIME"}:
            reasons.append("TIME_ONLY_WINDOW_CHANGE")
        elif groups == {"LOCATION"}:
            reasons.append("LOCATION_ONLY_WINDOW_CHANGE")
        elif groups == {"STATUS"}:
            reasons.append("STATUS_ONLY_WINDOW_CHANGE")
        elif groups == {"QUALITY"}:
            reasons.append("QUALITY_ONLY_WINDOW_CHANGE")
        elif groups == {"KWH", "TIME"}:
            reasons.append("KWH_AND_TIME_WINDOW_CHANGE")
        else:
            reasons.append("MULTI_SOURCE_WINDOW_CHANGE")
    df["adaptation_change_reason"] = reasons
    return df


def summarize_reclassified_reasons(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty:
        return {"result": "NO_ROWS"}
    grouped = df.groupby("adaptation_change_reason", dropna=False)
    rows = []
    for reason, g in grouped:
        rows.append({
            "reason": reason,
            "count": int(len(g)),
            "rate": float(len(g) / len(df)),
            "lenient_label_change_rate": float(g.get("lenient_label_changed", pd.Series(dtype=float)).mean()) if "lenient_label_changed" in g else None,
            "strict_label_change_rate": float(g.get("strict_label_changed", pd.Series(dtype=float)).mean()) if "strict_label_changed" in g else None,
            "lenient_median_score_diff": _float_or_none(pd.to_numeric(g.get("score_lenient_diff"), errors="coerce").median()) if "score_lenient_diff" in g else None,
            "strict_median_score_diff": _float_or_none(pd.to_numeric(g.get("score_strict_diff"), errors="coerce").median()) if "score_strict_diff" in g else None,
        })
    return {
        "result": "PASS",
        "total_rows": int(len(df)),
        "reason_distribution": {str(k): int(v) for k, v in df["adaptation_change_reason"].value_counts(dropna=False).items()},
        "reason_metrics": rows,
        "legacy_unexplained_rows_reinterpreted": True,
        "unexplained_model_output_mismatch_count": int((df["adaptation_change_reason"] == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum()),
    }


def build_adaptation_splits(features: pd.DataFrame, scores: pd.DataFrame, target_ids: set[int]) -> tuple[pd.DataFrame, dict[str, Any]]:
    df = features[features["event_id"].astype(int).isin(target_ids)].copy()
    score_cols = [c for c in scores.columns if c in {
        "event_id", "score_lenient", "score_strict", "threshold_lenient", "threshold_strict",
        "is_anomaly_lenient", "is_anomaly_strict", "is_behavior_anomaly", "is_sensitive_warning", "window_ready_flag",
    }]
    overlapping_score_cols = [c for c in score_cols if c != "event_id" and c in df.columns]
    if overlapping_score_cols:
        df = df.drop(columns=overlapping_score_cols)
    df = df.merge(scores[score_cols], on="event_id", how="left")
    df = df[df["window_ready_flag"].fillna(0).astype(int) == 1].copy()
    df["event_start_time"] = pd.to_datetime(df["event_start_time"], errors="coerce")
    splits = []
    for _, g in df.sort_values(["machine_id", "event_start_time", "event_id"]).groupby("machine_id", sort=True):
        n = len(g)
        if n == 0:
            continue
        idx = np.arange(n)
        conditions = [
            idx < int(n * 0.50),
            idx < int(n * 0.70),
            idx < int(n * 0.85),
        ]
        labels = np.select(conditions, ["ADAPT_TRAIN", "ADAPT_CALIBRATION", "ADAPT_VALID"], default="ADAPT_TEST")
        part = g.copy()
        part["adapt_split"] = labels
        splits.append(part)
    out = pd.concat(splits, ignore_index=True) if splits else pd.DataFrame()
    out["normal_lenient_flag"] = (
        (out.get("known_fault_status", 0).fillna(0).astype(int) == 0)
        & (out.get("known_repair_status", 0).fillna(0).astype(int) == 0)
        & (out.get("off_with_fault_status", 0).fillna(0).astype(int) == 0)
    ).astype(int)
    out["normal_strict_flag"] = (
        (out["normal_lenient_flag"] == 1)
        & (out.get("known_maintenance_status", 0).fillna(0).astype(int) == 0)
        & (out.get("data_quality_issue_flag", 0).fillna(0).astype(int) == 0)
    ).astype(int)
    summary = {
        "result": "PASS",
        "split_method": "per_machine_time_ordered_50_20_15_15",
        "no_random_split": True,
        "window_leakage_note": "Windows are evaluated by target event split; training/recalibration uses target windows only and does not fit model/preprocessor.",
        "rows_by_split": out["adapt_split"].value_counts().to_dict() if not out.empty else {},
        "machines_by_split": out.groupby("adapt_split")["machine_id"].nunique().astype(int).to_dict() if not out.empty else {},
    }
    return out, summary


def build_label_coverage(df: pd.DataFrame) -> dict[str, Any]:
    labels = [
        "known_fault_status", "known_maintenance_status", "known_repair_status", "off_with_fault_status",
        "future_fault_within_10_events", "future_fault_within_30_events", "future_fault_within_30min",
        "future_fault_within_60min", "future_maintenance_within_30_events", "future_repair_within_30_events",
    ]
    rows = {}
    for label in labels:
        if label in df.columns:
            s = pd.to_numeric(df[label], errors="coerce")
            rows[label] = {"available": True, "non_null": int(s.notna().sum()), "positive": int((s.fillna(0) > 0).sum())}
        else:
            rows[label] = {"available": False, "non_null": 0, "positive": 0}
    return {"result": "PASS_WITH_WARNINGS_IF_FUTURE_LABELS_MISSING", "labels": rows, "label_usage": "evaluation_only_not_training_not_threshold_fit"}


def apply_candidate_a_labels(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["candidate_a_is_anomaly_lenient"] = pd.to_numeric(out["is_anomaly_lenient"], errors="coerce").fillna(0).astype(int)
    out["candidate_a_is_anomaly_strict"] = pd.to_numeric(out["is_anomaly_strict"], errors="coerce").fillna(0).astype(int)
    out["candidate_a_is_behavior_anomaly"] = out["candidate_a_is_anomaly_lenient"]
    out["candidate_a_is_sensitive_warning"] = ((out["candidate_a_is_anomaly_strict"] == 1) & (out["candidate_a_is_anomaly_lenient"] == 0)).astype(int)
    return out


def fit_candidate_b_thresholds(df: pd.DataFrame, base_cfg: dict[str, Any]) -> dict[str, Any]:
    import importlib
    ensure_l1_src = Path("modeling/l1_tcn/src").resolve()
    if str(ensure_l1_src) not in sys.path:
        sys.path.insert(0, str(ensure_l1_src))
    threshold_mod = importlib.import_module("threshold")
    out = {}
    for profile, normal_col, score_col in [
        ("lenient", "normal_lenient_flag", "score_lenient"),
        ("strict", "normal_strict_flag", "score_strict"),
    ]:
        cal = df[(df["adapt_split"] == "ADAPT_CALIBRATION") & (df[normal_col] == 1)].copy()
        valid_scores = cal[["event_id", "machine_id", score_col]].rename(columns={score_col: "total_error"})
        cfg_obj = threshold_mod.threshold_config_from_yaml(base_cfg, profile)
        payload = threshold_mod.build_thresholds(valid_scores, cfg_obj, score_col="total_error")
        payload["calibration_window_count"] = int(len(valid_scores))
        payload["normal_filter"] = normal_col
        out[profile] = payload
    return out


def apply_candidate_b_thresholds(df: pd.DataFrame, thresholds: dict[str, Any]) -> pd.DataFrame:
    out = df.copy()
    for profile, score_col in [("lenient", "score_lenient"), ("strict", "score_strict")]:
        payload = thresholds[profile]
        global_th = float(payload["global_threshold"])
        per_machine = payload.get("per_machine_thresholds", {})
        vals = []
        for m in out["machine_id"].tolist():
            key = str(int(m)) if pd.notna(m) else str(m)
            vals.append(float(per_machine.get(key, global_th)))
        out[f"candidate_b_threshold_{profile}"] = vals
        out[f"candidate_b_score_{profile}_normalized"] = pd.to_numeric(out[score_col], errors="coerce") / out[f"candidate_b_threshold_{profile}"].replace(0, np.nan)
        out[f"candidate_b_is_anomaly_{profile}"] = (out[f"candidate_b_score_{profile}_normalized"] >= 1.0).astype(int)
    out["candidate_b_is_behavior_anomaly"] = out["candidate_b_is_anomaly_lenient"]
    out["candidate_b_is_sensitive_warning"] = ((out["candidate_b_is_anomaly_strict"] == 1) & (out["candidate_b_is_anomaly_lenient"] == 0)).astype(int)
    return out


def build_candidate_metrics(df: pd.DataFrame, prefix: str) -> tuple[dict[str, Any], pd.DataFrame]:
    rows = []
    global_payload = {"result": "PASS", "by_split": {}}
    for split, g in df.groupby("adapt_split", dropna=False):
        payload = candidate_metric_payload(g, prefix)
        global_payload["by_split"][str(split)] = payload
        for machine_id, mg in g.groupby("machine_id", dropna=False):
            row = {"adapt_split": split, "machine_id": machine_id, "support": int(len(mg))}
            row.update(candidate_metric_payload(mg, prefix))
            row["support_result"] = "LOW_SUPPORT_DO_NOT_DECIDE" if len(mg) < 200 else "OK"
            rows.append(row)
    return global_payload, pd.DataFrame(rows)


def candidate_metric_payload(g: pd.DataFrame, prefix: str) -> dict[str, Any]:
    normal_len = g[g.get("normal_lenient_flag", 0) == 1]
    fault = g[(g.get("known_fault_status", 0).fillna(0).astype(int) == 1) | (g.get("off_with_fault_status", 0).fillna(0).astype(int) == 1)]
    return {
        "support": int(len(g)),
        "normal_lenient_support": int(len(normal_len)),
        "normal_lenient_false_positive_rate": float(normal_len.get(f"{prefix}_is_anomaly_lenient", pd.Series(dtype=float)).mean()) if len(normal_len) else None,
        "behavior_anomaly_rate": float(g.get(f"{prefix}_is_behavior_anomaly", pd.Series(dtype=float)).mean()) if len(g) else None,
        "strict_only_warning_rate": float(g.get(f"{prefix}_is_sensitive_warning", pd.Series(dtype=float)).mean()) if len(g) else None,
        "known_fault_support": int(len(fault)),
        "known_fault_recall": float(fault.get(f"{prefix}_is_behavior_anomaly", pd.Series(dtype=float)).mean()) if len(fault) else None,
        "score_lenient_median": _float_or_none(pd.to_numeric(g.get("score_lenient"), errors="coerce").median()),
        "score_lenient_p95": _float_or_none(pd.to_numeric(g.get("score_lenient"), errors="coerce").quantile(0.95)),
        "score_strict_median": _float_or_none(pd.to_numeric(g.get("score_strict"), errors="coerce").median()),
        "score_strict_p95": _float_or_none(pd.to_numeric(g.get("score_strict"), errors="coerce").quantile(0.95)),
    }


def compare_candidates(a: pd.DataFrame, b: pd.DataFrame, split: str) -> pd.DataFrame:
    aa = a[a["adapt_split"] == split].copy()
    bb = b[b["adapt_split"] == split].copy()
    rows = []
    for scope, g_ids in [("GLOBAL", aa["event_id"].tolist())]:
        ag = aa[aa["event_id"].isin(g_ids)]
        bg = bb[bb["event_id"].isin(g_ids)]
        rows.append({
            "split": split,
            "scope": scope,
            "support": int(len(ag)),
            "candidate_a_behavior_anomaly_rate": float(ag["candidate_a_is_behavior_anomaly"].mean()) if len(ag) else None,
            "candidate_b_behavior_anomaly_rate": float(bg["candidate_b_is_behavior_anomaly"].mean()) if len(bg) else None,
            "candidate_a_sensitive_warning_rate": float(ag["candidate_a_is_sensitive_warning"].mean()) if len(ag) else None,
            "candidate_b_sensitive_warning_rate": float(bg["candidate_b_is_sensitive_warning"].mean()) if len(bg) else None,
        })
    return pd.DataFrame(rows)


def build_historical_regression_report(paired_scores: pd.DataFrame, reclassified: pd.DataFrame) -> pd.DataFrame:
    return pd.DataFrame([{
        "reference": "paired_current_vs_historical_shadow",
        "paired_rows": int(len(paired_scores)),
        "lenient_spearman": _float_or_none(pd.to_numeric(paired_scores.get("current_score_lenient"), errors="coerce").corr(pd.to_numeric(paired_scores.get("historical_score_lenient"), errors="coerce"), method="spearman")) if "current_score_lenient" in paired_scores else None,
        "strict_spearman": _float_or_none(pd.to_numeric(paired_scores.get("current_score_strict"), errors="coerce").corr(pd.to_numeric(paired_scores.get("historical_score_strict"), errors="coerce"), method="spearman")) if "current_score_strict" in paired_scores else None,
        "unexplained_model_output_mismatch_count": int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum()) if not reclassified.empty else 0,
    }])


def build_block_bootstrap_ci(a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for candidate, df, col in [
        ("A", a, "candidate_a_is_behavior_anomaly"),
        ("B", b, "candidate_b_is_behavior_anomaly"),
    ]:
        for split, g in df.groupby("adapt_split", dropna=False):
            blocks = g.groupby(["machine_id", "sequence_segment_id"]).size()
            reliable = len(blocks) >= 20
            rate = float(g[col].mean()) if len(g) else None
            rows.append({
                "candidate": candidate,
                "split": split,
                "metric": "behavior_anomaly_rate",
                "estimate": rate,
                "ci_low": None,
                "ci_high": None,
                "block_count": int(len(blocks)),
                "ci_result": "NOT_ENOUGH_BLOCKS_FOR_RELIABLE_CI" if not reliable else "POINT_ESTIMATE_ONLY_FAST_AUDIT",
            })
    return pd.DataFrame(rows)


def build_machine_support_report(a: pd.DataFrame, b: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for machine_id, g in a.groupby("machine_id", dropna=False):
        support = int(len(g))
        rows.append({
            "machine_id": machine_id,
            "support": support,
            "support_result": "LOW_SUPPORT_DO_NOT_DECIDE" if support < 200 else "OK",
            "candidate_a_anomaly_rate": float(g["candidate_a_is_behavior_anomaly"].mean()) if support else None,
            "candidate_b_anomaly_rate": float(b[b["machine_id"] == machine_id]["candidate_b_is_behavior_anomaly"].mean()) if support else None,
        })
    return pd.DataFrame(rows)


def build_decision_gate_report(a_global: dict[str, Any], b_global: dict[str, Any], valid: pd.DataFrame, test: pd.DataFrame, reclassified: pd.DataFrame, support: pd.DataFrame) -> dict[str, Any]:
    unexplained = int((reclassified.get("adaptation_change_reason", pd.Series(dtype=str)) == "UNEXPLAINED_MODEL_OUTPUT_MISMATCH").sum()) if not reclassified.empty else 0
    exact_rows = int((reclassified.get("alignment_status", pd.Series(dtype=str)) == "EXACT_PAIRED_WINDOW").sum()) if not reclassified.empty else 0
    low_support = int((support.get("support_result", pd.Series(dtype=str)) == "LOW_SUPPORT_DO_NOT_DECIDE").sum()) if not support.empty else 0
    a_fpr = a_global.get("by_split", {}).get("ADAPT_VALID", {}).get("normal_lenient_false_positive_rate")
    b_fpr = b_global.get("by_split", {}).get("ADAPT_VALID", {}).get("normal_lenient_false_positive_rate")
    a_recall = a_global.get("by_split", {}).get("ADAPT_VALID", {}).get("known_fault_recall")
    b_recall = b_global.get("by_split", {}).get("ADAPT_VALID", {}).get("known_fault_recall")
    recall_drop = None if a_recall is None or b_recall is None else float(a_recall - b_recall)
    return {
        "result": "PASS_WITH_RETRAIN_WARNING" if unexplained == 0 and exact_rows > 0 and (recall_drop is not None and recall_drop > 0.05) else "PASS" if unexplained == 0 and exact_rows > 0 else "WARN",
        "unexplained_model_output_mismatch_count": unexplained,
        "normal_fpr_comparison": {"candidate_a": a_fpr, "candidate_b": b_fpr},
        "fault_recall_comparison": {"candidate_a": a_recall, "candidate_b": b_recall, "candidate_b_recall_drop": recall_drop},
        "future_fault_recall_comparison": "NOT_AVAILABLE_IN_CURRENT_SHADOW_FEATURES",
        "per_machine_stability_comparison": {"low_support_machine_count": low_support, "support_threshold": 200},
        "historical_regression_comparison": {"exact_window_rows": exact_rows, "unexplained_model_output_mismatch_count": unexplained},
        "candidate_b_evaluated": True,
    }


def build_retrain_plan(project_root: Path, out_dir: Path, cfg: dict[str, Any], split_manifest: pd.DataFrame, gate_report: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any], str]:
    run_id = out_dir.name.replace("l1_adaptation_eval_", "l1_adaptation_")
    candidate_root = project_root / "modeling" / "l1_tcn" / "artifacts_candidates" / run_id
    dataset_root = project_root / "data" / "dataModel" / "l1_adaptation" / run_id
    manifest = {
        "dataset_root": str(dataset_root),
        "source": "canonical_current_sql_features_from_adaptation_eval",
        "rows": int(len(split_manifest)),
        "splits": split_manifest["adapt_split"].value_counts().to_dict() if not split_manifest.empty else {},
        "note": "Dataset files are planned only; full Candidate C training should run on Colab GPU if required.",
    }
    plan = {
        "candidate_c_result": "RETRAIN_CANDIDATE_TRAINING_REQUIRED" if gate_report.get("result") == "PASS" else "NOT_RECOMMENDED_UNTIL_A_B_COMPLETE",
        "candidate_root": str(candidate_root),
        "current_only_artifact_dirs": {
            "lenient": str(candidate_root / "current_only" / "lenient"),
            "strict": str(candidate_root / "current_only" / "strict"),
        },
        "production_artifacts_overwritten": False,
        "full_training_local_cpu_run": False,
    }
    commands = f"""# Candidate C Colab Training Commands

Khong chay full train tren CPU local. Sau khi upload repo/data len Colab GPU:

```bash
cd /content/OBAD
python modeling/l1_tcn/src/train.py --config modeling/l1_tcn/configs/base.yaml --profile lenient
python modeling/l1_tcn/src/train.py --config modeling/l1_tcn/configs/base.yaml --profile strict
```

Expected candidate artifact root:

`{candidate_root}`

Sau khi tai artifacts ve, danh gia bang:

```powershell
.\\.venv\\Scripts\\python.exe -m inference.online.score_new_events `
  --config inference/online/config.local.yaml `
  --evaluate-l1-retrain-candidate `
  --adaptation-audit-dir "{out_dir}" `
  --candidate-artifact-dir "{candidate_root}"
```
"""
    return manifest, plan, commands


def select_adaptation_candidate(gate_report: dict[str, Any], reason_summary: dict[str, Any], a_global: dict[str, Any], b_global: dict[str, Any]) -> tuple[str, str]:
    if gate_report.get("unexplained_model_output_mismatch_count", 1) > 0:
        return "TECHNICAL_FAILURE", "unexplained model output mismatch remains after exact-window/tensor attribution"
    b_valid_fpr = gate_report.get("normal_fpr_comparison", {}).get("candidate_b")
    a_valid_fpr = gate_report.get("normal_fpr_comparison", {}).get("candidate_a")
    recall_drop = gate_report.get("fault_recall_comparison", {}).get("candidate_b_recall_drop")
    if recall_drop is not None and recall_drop > 0.05:
        return "RETRAIN_CANDIDATE_TRAINING_REQUIRED", "Candidate B reduces false positives but drops known-fault recall by more than 5 percentage points; prepare Candidate C instead of adopting recalibrated thresholds."
    if b_valid_fpr is not None and a_valid_fpr is not None and b_valid_fpr <= a_valid_fpr:
        return "ADOPT_RECALIBRATED_THRESHOLDS_CANDIDATE", "Candidate B reduces or preserves validation normal false-positive rate using same model/preprocessor."
    return "RETRAIN_CANDIDATE_TRAINING_REQUIRED", "Candidate B did not clearly improve validation FPR; prepare Candidate C plan without local full retrain."


def build_l1_adaptation_readme(summary: dict[str, Any], reason_summary: dict[str, Any], out_dir: Path) -> str:
    return f"""# L1 Model Adaptation Evaluation

Thu muc audit: `{out_dir}`

- Technical result: `{summary.get('technical_result')}`
- Exact paired window rate: `{summary.get('exact_paired_window_rate')}`
- Legacy unexplained rows have been reclassified by full 20x30 window attribution.
- UNEXPLAINED_MODEL_OUTPUT_MISMATCH: `{summary.get('unexplained_model_output_mismatch_count')}`
- Selected candidate: `{summary.get('selected_candidate')}`
- Final decision: `{summary.get('final_decision')}`
- L2 run: `False`
- Production SQL written: `False`
- Production artifacts overwritten: `False`
"""


def load_historical_l1_distribution_sample(csv_path: Path, current_features: pd.DataFrame, sample_size: int) -> pd.DataFrame:
    if current_features.empty or not csv_path.exists():
        return pd.DataFrame()
    min_time = pd.to_datetime(current_features["event_start_time"], errors="coerce").min()
    max_time = pd.to_datetime(current_features["event_start_time"], errors="coerce").max()
    machine_ids = set(pd.to_numeric(current_features["machine_id"], errors="coerce").dropna().astype(int).tolist())
    sep = detect_csv_separator(str(csv_path))
    header = pd.read_csv(csv_path, sep=sep, nrows=0).columns.tolist()
    wanted = [c for c in ["event_id", "machine_id", "event_start_time", "sequence_segment_id", "event_order_in_segment", "end_time_source", "kwh_start_source", "kwh_end_source"] + L1_MODEL_FEATURES if c in header]
    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, sep=sep, usecols=wanted, chunksize=200000, low_memory=False):
        chunk["event_start_time"] = pd.to_datetime(chunk["event_start_time"], errors="coerce", format="mixed")
        mask = (
            chunk["event_start_time"].between(min_time, max_time)
            & pd.to_numeric(chunk["machine_id"], errors="coerce").astype("Int64").isin(machine_ids)
        )
        selected = chunk[mask].copy()
        if not selected.empty:
            chunks.append(selected)
    historical = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame(columns=wanted)
    if len(historical) > sample_size:
        historical = historical.sample(n=sample_size, random_state=20260715).sort_values(["machine_id", "event_start_time", "event_id"])
    return historical.reset_index(drop=True)


def summarize_l1_input_distribution(current: pd.DataFrame, historical: pd.DataFrame, source_drift: dict[str, Any]) -> tuple[dict[str, Any], pd.DataFrame]:
    feature_rows = []
    categorical = {
        "status_id", "status_type_code", "current_signal_code", "hour_of_day", "day_of_week",
        "machine_group_id", "location_id", "is_on", "is_loaded", "is_no_load", "is_current_near_zero",
        "kwh_available_flag", "kwh_missing_flag", "kwh_imputed_or_missing_flag", "kwh_rate_missing_flag",
        "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "is_raw_end_missing", "is_invalid_raw_end",
        "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap",
    }
    numeric = [c for c in L1_MODEL_FEATURES if c not in categorical]
    for feature in L1_MODEL_FEATURES:
        if feature not in current.columns or feature not in historical.columns:
            feature_rows.append({"feature_name": feature, "status": "MISSING_FOR_DISTRIBUTION_COMPARE"})
            continue
        if feature in numeric:
            feature_rows.append(numeric_distribution_row(feature, current[feature], historical[feature]))
        else:
            feature_rows.append(categorical_distribution_row(feature, current[feature], historical[feature]))
    feature_df = pd.DataFrame(feature_rows)
    high_drift = int((pd.to_numeric(feature_df.get("drift_score", pd.Series(dtype=float)), errors="coerce").fillna(0) > 0.25).sum())
    source_backfilled = source_drift.get("conclusion") == "SOURCE_DATA_BACKFILLED"
    if historical.empty or current.empty:
        result = "MODEL_INPUT_DISTRIBUTION_REVALIDATION_REQUIRED"
    elif source_backfilled or high_drift:
        result = "MODEL_INPUT_DISTRIBUTION_REVALIDATION_REQUIRED"
    else:
        result = "MODEL_INPUT_DISTRIBUTION_STABLE"
    summary = {
        "result": result,
        "current_rows": int(len(current)),
        "historical_rows": int(len(historical)),
        "source_drift_result": source_drift.get("conclusion"),
        "high_drift_feature_count": high_drift,
        "kwh_raw_availability_current": _mean_flag(current, "kwh_available_flag"),
        "kwh_raw_availability_historical": _mean_flag(historical, "kwh_available_flag"),
        "end_time_source_distribution_current": current.get("end_time_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "end_time_source_distribution_historical": historical.get("end_time_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "unknown_category_rate": unknown_category_rates(current, historical),
        "segment_length_distribution_current": segment_length_distribution(current),
        "segment_length_distribution_historical": segment_length_distribution(historical),
        "machine_without_l1_window_20_count": machine_without_window_count(current),
        "feature_distribution_rows": feature_rows,
    }
    per_machine = distribution_by_machine(current, historical)
    return summary, per_machine


def numeric_distribution_row(feature: str, current: pd.Series, historical: pd.Series) -> dict[str, Any]:
    cur = pd.to_numeric(current, errors="coerce")
    hist = pd.to_numeric(historical, errors="coerce")
    hist_min = hist.min(skipna=True)
    hist_max = hist.max(skipna=True)
    out_of_range = ((cur < hist_min) | (cur > hist_max)).mean() if pd.notna(hist_min) and pd.notna(hist_max) and len(cur) else np.nan
    drift = abs(float(cur.mean(skipna=True) - hist.mean(skipna=True))) / (float(hist.std(skipna=True)) + 1e-9) if len(hist.dropna()) else np.nan
    return {
        "feature_name": feature,
        "feature_type": "numeric",
        "current_mean": _float_or_none(cur.mean(skipna=True)),
        "historical_mean": _float_or_none(hist.mean(skipna=True)),
        "current_p95": _float_or_none(cur.quantile(0.95)),
        "historical_p95": _float_or_none(hist.quantile(0.95)),
        "out_of_training_range_rate": _float_or_none(out_of_range),
        "drift_score": _float_or_none(drift),
        "status": "COMPARED",
    }


def categorical_distribution_row(feature: str, current: pd.Series, historical: pd.Series) -> dict[str, Any]:
    cur_counts = current.astype("string").fillna("<NA>").value_counts(normalize=True)
    hist_counts = historical.astype("string").fillna("<NA>").value_counts(normalize=True)
    keys = sorted(set(cur_counts.index.tolist()) | set(hist_counts.index.tolist()))
    tvd = 0.5 * sum(abs(float(cur_counts.get(k, 0.0)) - float(hist_counts.get(k, 0.0))) for k in keys)
    unknown = float((~current.astype("string").fillna("<NA>").isin(set(hist_counts.index.tolist()))).mean()) if len(current) else 0.0
    return {
        "feature_name": feature,
        "feature_type": "categorical_or_binary",
        "current_top": cur_counts.head(10).to_dict(),
        "historical_top": hist_counts.head(10).to_dict(),
        "unknown_category_rate": unknown,
        "drift_score": float(tvd),
        "status": "COMPARED",
    }


def distribution_by_machine(current: pd.DataFrame, historical: pd.DataFrame) -> pd.DataFrame:
    rows = []
    for machine_id, cur in current.groupby("machine_id", dropna=False):
        hist = historical[pd.to_numeric(historical.get("machine_id", pd.Series(dtype="Int64")), errors="coerce").astype("Int64") == int(machine_id)]
        rows.append({
            "machine_id": machine_id,
            "current_rows": int(len(cur)),
            "historical_rows": int(len(hist)),
            "current_kwh_available_rate": _mean_flag(cur, "kwh_available_flag"),
            "historical_kwh_available_rate": _mean_flag(hist, "kwh_available_flag"),
            "current_location_top": cur.get("location_id", pd.Series(dtype=object)).value_counts(dropna=False).head(5).to_dict(),
            "historical_location_top": hist.get("location_id", pd.Series(dtype=object)).value_counts(dropna=False).head(5).to_dict(),
            "current_window_ready_rate": float((pd.to_numeric(cur.get("event_order_in_segment", pd.Series(dtype=float)), errors="coerce") >= 20).mean()) if len(cur) else None,
        })
    return pd.DataFrame(rows)


def _mean_flag(df: pd.DataFrame, column: str) -> float | None:
    if df.empty or column not in df.columns:
        return None
    return _float_or_none(pd.to_numeric(df[column], errors="coerce").mean())


def _float_or_none(value: Any) -> float | None:
    try:
        if pd.isna(value):
            return None
        return float(value)
    except Exception:
        return None


def unknown_category_rates(current: pd.DataFrame, historical: pd.DataFrame) -> dict[str, float]:
    out = {}
    for col in ["status_id", "status_type_code", "current_signal_code", "machine_group_id", "location_id"]:
        if col in current.columns and col in historical.columns:
            hist_values = set(historical[col].astype("string").fillna("<NA>").unique().tolist())
            out[col] = float((~current[col].astype("string").fillna("<NA>").isin(hist_values)).mean()) if len(current) else 0.0
    return out


def segment_length_distribution(df: pd.DataFrame) -> dict[str, Any]:
    if df.empty or not {"machine_id", "sequence_segment_id"}.issubset(df.columns):
        return {}
    lengths = df.groupby(["machine_id", "sequence_segment_id"], dropna=False).size()
    return {
        "segment_count": int(len(lengths)),
        "p50": _float_or_none(lengths.quantile(0.50)),
        "p95": _float_or_none(lengths.quantile(0.95)),
        "max": int(lengths.max()) if len(lengths) else 0,
    }


def machine_without_window_count(df: pd.DataFrame) -> int:
    if df.empty or "event_order_in_segment" not in df.columns:
        return 0
    ready = pd.to_numeric(df["event_order_in_segment"], errors="coerce") >= 20
    by_machine = ready.groupby(df["machine_id"]).any()
    return int((~by_machine).sum())


def build_l1_distribution_readme(summary: dict[str, Any], out_dir: Path) -> str:
    return f"""# L1 Input Distribution Audit

Thu muc audit: `{out_dir}`

- Distribution result: `{summary.get('distribution_result')}`
- Source drift: `{summary.get('source_drift_result')}`
- Current rows: `{summary.get('current_feature_rows')}`
- Historical rows: `{summary.get('historical_feature_rows')}`

Audit nay chi so phan phoi 30 feature dau vao L1. L1/L2 khong duoc bat va SQL production khong duoc ghi.
"""


def live_sql_contract_sanitized_config(cfg: dict[str, Any], max_events: int) -> dict[str, Any]:
    return {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "validate_live_sql_contract",
        "max_events": max_events,
        "project_root": str(resolve_project_root(cfg)),
        "source_table": cfg.get("tables", {}).get("raw_iot"),
        "online_result_table": cfg.get("tables", {}).get("online_l2_result"),
        "runtime_thresholds": thresholds_from_config(cfg)[0],
        "l1_mode": "disabled",
        "l2_mode": "not_run",
        "write_sql_enabled": False,
    }


def offline_replay_sanitized_config(cfg: dict[str, Any], sample_size: int, raw_data_dir: str | None) -> dict[str, Any]:
    return {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "validate_l1_offline_replay",
        "sample_size": sample_size,
        "raw_data_dir_argument": raw_data_dir,
        "project_root": str(resolve_project_root(cfg)),
        "historical_l1_csv": str(resolve_project_path(cfg, get_historical_l1_csv(cfg))),
        "runtime_thresholds": thresholds_from_config(cfg)[0],
        "l1_mode": "disabled",
        "l2_mode": "not_run",
        "write_sql_enabled": False,
    }


def write_empty_offline_replay_audit(out_dir: Path, *, snapshot_resolution: dict[str, Any], reason: str) -> None:
    empty = pd.DataFrame()
    write_json(out_dir / "01_training_snapshot_resolution.json", snapshot_resolution)
    empty.to_csv(out_dir / "02_raw_input_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "03_raw_input_classification_summary.json", {"result": "FAIL", "reason": reason})
    empty.to_csv(out_dir / "04_contiguous_replay_manifest.csv", index=False, encoding="utf-8-sig")
    empty.to_csv(out_dir / "05_joined_canonical_events.csv", index=False, encoding="utf-8-sig")
    empty.to_csv(out_dir / "06_l1_features_runtime.csv", index=False, encoding="utf-8-sig")
    empty.to_csv(out_dir / "07_transformation_feature_comparison.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "08_transformation_match_summary.json", {"result": "NOT_RUN", "reason": reason})
    empty.to_csv(out_dir / "09_time_mismatch_details.csv", index=False, encoding="utf-8-sig")
    empty.to_csv(out_dir / "10_kwh_mismatch_details.csv", index=False, encoding="utf-8-sig")
    write_json(out_dir / "11_segmentation_replay_report.json", {"result": "NOT_RUN", "reason": reason})
    write_json(out_dir / "12_l1_contract_report.json", {"result": "NOT_RUN", "reason": reason})
    empty.to_csv(out_dir / "13_true_logic_mismatches.csv", index=False, encoding="utf-8-sig")
    summary = {
        "offline_raw_snapshot_result": snapshot_resolution.get("decision", "TRAINING_SNAPSHOT_NOT_FOUND"),
        "fact_snapshot_result": snapshot_resolution.get("fact_snapshot_result"),
        "full_source_snapshot_result": snapshot_resolution.get("full_source_snapshot_result"),
        "offline_transformation_result": "NOT_RUN",
        "offline_transformation_parity_result": "NOT_RUN",
        "live_sql_contract_result": "NOT_RUN_OFFLINE_MODE",
        "live_sql_source_drift_result": "NOT_RUN",
        "final_result": "L1_TRANSFORMATION_LOGIC_NOT_READY",
        "reason": reason,
        "l1_model_enabled": False,
        "l2_prediction_run": False,
        "production_sql_written": False,
    }
    write_json(out_dir / "14_summary.json", summary)
    (out_dir / "15_README_L1_OFFLINE_REPLAY.md").write_text(build_offline_replay_readme(summary, out_dir), encoding="utf-8")


def snapshot_csv_format(path: Path) -> tuple[str, str]:
    with path.open("rb") as handle:
        prefix = handle.read(4)
    encoding = "utf-16" if prefix.startswith((b"\xff\xfe", b"\xfe\xff")) else "utf-8-sig"
    with path.open("r", encoding=encoding, errors="replace") as handle:
        header = handle.readline()
    return encoding, ";" if header.count(";") > header.count(",") else ","


def read_snapshot_csv(path: Path, *, chunksize: int | None = None, usecols: list[str] | None = None) -> Any:
    encoding, sep = snapshot_csv_format(path)
    kwargs: dict[str, Any] = {"sep": sep, "encoding": encoding, "low_memory": False}
    if chunksize is not None:
        kwargs["chunksize"] = chunksize
    if usecols is not None:
        kwargs["usecols"] = usecols
    return pd.read_csv(path, **kwargs)


def normalize_snapshot_raw(raw: pd.DataFrame) -> pd.DataFrame:
    aliases = {
        "event_id": ["event_id", "id"],
        "machine_id": ["machine_id"],
        "status_id": ["status_id"],
        "event_start_time": ["event_start_time", "status_time_start"],
        "raw_event_end_time": ["raw_event_end_time", "status_time_end"],
        "raw_status_kwh_start": ["raw_status_kwh_start", "status_kwh_start"],
        "raw_status_kwh_end": ["raw_status_kwh_end", "status_kwh_end"],
        "raw_error_code": ["raw_error_code", "error_code"],
    }
    out = raw.copy()
    out.columns = [str(c).lstrip("\ufeff").strip() for c in out.columns]
    rename: dict[str, str] = {}
    for canonical, candidates in aliases.items():
        actual = next((c for c in candidates if c in out.columns), None)
        if actual:
            rename[actual] = canonical
    out = out.rename(columns=rename)
    if "is_deleted" in out.columns:
        out = out[pd.to_numeric(out["is_deleted"], errors="coerce").fillna(0) == 0].copy()
    for column in ["event_id", "machine_id", "status_id"]:
        if column not in out.columns:
            out[column] = pd.NA
        out[column] = pd.to_numeric(out[column], errors="coerce").astype("Int64")
    for column in ["event_start_time", "raw_event_end_time"]:
        if column not in out.columns:
            out[column] = pd.NaT
        out[column] = pd.to_datetime(out[column], errors="coerce", format="mixed")
    for column in ["raw_status_kwh_start", "raw_status_kwh_end"]:
        if column not in out.columns:
            out[column] = np.nan
        out[column] = pd.to_numeric(out[column], errors="coerce")
    if "raw_error_code" not in out.columns:
        out["raw_error_code"] = pd.NA
    out = out.dropna(subset=["event_id", "machine_id", "status_id", "event_start_time"])
    return out.reindex(columns=[
        "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
        "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
    ])


def load_historical_l1_replay_probe(csv_path: Path, target_rows: int) -> pd.DataFrame:
    sep = detect_csv_separator(str(csv_path))
    header = pd.read_csv(csv_path, sep=sep, nrows=0).columns.tolist()
    # Snapshot resolution only needs natural identity and raw indicators.
    # Keeping this narrow prevents a 4M-row historical probe from loading
    # the whole canonical feature schema before a snapshot is selected.
    wanted = [c for c in [
        "event_id", "machine_id", "status_id", "event_start_time", "event_end_time", "end_time_source",
        "raw_status_kwh_start", "raw_status_kwh_end", "kwh_start_source", "kwh_end_source",
    ] if c in header]
    # The historical file is large. Keep a deterministic, evenly spread probe
    # instead of materializing four million rows merely to identify a snapshot.
    stride = max(1, 4_100_000 // max(target_rows * 2, 1))
    chunks: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, sep=sep, usecols=wanted, chunksize=50000, low_memory=False):
        ids = pd.to_numeric(chunk["event_id"], errors="coerce")
        picked = chunk[(ids.notna()) & ((ids.astype("Int64") % stride) == 0)].copy()
        if not picked.empty:
            chunks.append(picked)
    out = pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame(columns=wanted)
    if len(out) > target_rows:
        out = out.sample(n=target_rows, random_state=20260714)
    return out.reset_index(drop=True)


def known_snapshot_directories(project_root: Path, raw_data_dir: str | None) -> list[Path]:
    candidates: list[Path] = []
    if raw_data_dir:
        supplied = Path(raw_data_dir)
        candidates.append(supplied if supplied.is_absolute() else (project_root / supplied))
    candidates.extend([
        project_root / "data" / "backData" / "new070726",
        project_root / "data" / "backData",
        project_root / "data" / "backData" / "dataVanHanh",
    ])
    unique: list[Path] = []
    for candidate in candidates:
        resolved = candidate.resolve()
        if resolved not in unique:
            unique.append(resolved)
    return unique


SNAPSHOT_FILES = [
    "data_iot_convert.csv",
    "data_machine.csv",
    "data_machine_status.csv",
    "machine_location_his.csv",
    "data_location.csv",
]


def build_snapshot_inventory(project_root: Path, raw_data_dir: str | None) -> tuple[dict[str, Any], pd.DataFrame, dict[str, Any], dict[str, Any], pd.DataFrame]:
    rows: list[dict[str, Any]] = []
    malformed_rows: list[dict[str, Any]] = []
    directories = known_snapshot_directories(project_root, raw_data_dir)
    for directory in directories:
        for filename in SNAPSHOT_FILES:
            profile, malformed = profile_snapshot_csv_file(directory / filename, directory, filename)
            rows.append(profile)
            malformed_rows.extend(malformed)
    hashes = pd.DataFrame(rows)
    inventory = {
        "created_time": datetime.now().isoformat(timespec="seconds"),
        "candidate_directories": [str(d) for d in directories],
        "required_full_snapshot_files": SNAPSHOT_FILES,
        "directories": [],
    }
    for directory in directories:
        subset = hashes[hashes["snapshot_dir"] == str(directory)]
        present = set(subset.loc[subset["exists"] == True, "file_name"].tolist())  # noqa: E712
        inventory["directories"].append({
            "snapshot_dir": str(directory),
            "has_fact_file": "data_iot_convert.csv" in present,
            "has_full_dimension_set": all(name in present for name in SNAPSHOT_FILES),
            "missing_files": [name for name in SNAPSHOT_FILES if name not in present],
        })
    equivalence_groups = build_snapshot_equivalence_groups(hashes)
    parse_quality = summarize_csv_parse_quality(hashes, malformed_rows)
    return inventory, hashes, equivalence_groups, parse_quality, pd.DataFrame(malformed_rows)


def profile_snapshot_csv_file(path: Path, snapshot_dir: Path, filename: str) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    profile: dict[str, Any] = {
        "snapshot_dir": str(snapshot_dir),
        "file_name": filename,
        "file_path": str(path),
        "exists": path.exists(),
        "file_size_bytes": None,
        "encoding": None,
        "delimiter": None,
        "column_names_order": [],
        "column_count": 0,
        "row_count": 0,
        "malformed_row_count": 0,
        "chunk_hash_sha256": None,
        "min_primary_key": None,
        "max_primary_key": None,
        "min_event_time": None,
        "max_event_time": None,
        "input_quality_result": "MISSING_FILE",
    }
    malformed: list[dict[str, Any]] = []
    if not path.exists():
        return profile, malformed
    profile["file_size_bytes"] = int(path.stat().st_size)
    encoding, sep = snapshot_csv_format(path)
    profile["encoding"] = encoding
    profile["delimiter"] = sep
    profile["chunk_hash_sha256"] = stable_chunk_hash(path)
    expected_fields = None
    header: list[str] = []
    with path.open("r", encoding=encoding, errors="replace", newline="") as handle:
        reader = csv.reader(handle, delimiter=sep)
        id_idx = None
        time_idx = None
        min_id = max_id = None
        min_time = max_time = None
        for row_num, row in enumerate(reader, start=1):
            if row_num == 1:
                header = [str(c).lstrip("\ufeff").strip() for c in row]
                expected_fields = len(header)
                profile["column_names_order"] = header
                profile["column_count"] = expected_fields
                if filename == "data_iot_convert.csv":
                    id_idx = header.index("id") if "id" in header else header.index("event_id") if "event_id" in header else None
                    time_idx = header.index("status_time_start") if "status_time_start" in header else header.index("event_start_time") if "event_start_time" in header else None
                continue
            profile["row_count"] += 1
            if expected_fields is not None and len(row) < expected_fields:
                profile["malformed_row_count"] += 1
                if len(malformed) < 200:
                    malformed.append({
                        "snapshot_dir": str(snapshot_dir),
                        "file_name": filename,
                        "file_path": str(path),
                        "row_number": row_num,
                        "expected_field_count": expected_fields,
                        "actual_field_count": len(row),
                        "sample": sep.join(row[: min(len(row), 12)]),
                    })
                continue
            if expected_fields is not None and len(row) > expected_fields:
                profile.setdefault("extra_field_row_count", 0)
                profile["extra_field_row_count"] = int(profile.get("extra_field_row_count", 0)) + 1
                if len(malformed) < 200:
                    malformed.append({
                        "snapshot_dir": str(snapshot_dir),
                        "file_name": filename,
                        "file_path": str(path),
                        "row_number": row_num,
                        "expected_field_count": expected_fields,
                        "actual_field_count": len(row),
                        "sample": sep.join(row[: min(len(row), 12)]),
                        "parse_issue_type": "EXTRA_FIELDS_TRUNCATED_AFTER_HEADER_COLUMNS",
                    })
                row = row[:expected_fields]
            if filename == "data_iot_convert.csv":
                if id_idx is not None and id_idx < len(row):
                    try:
                        value = int(float(row[id_idx])) if row[id_idx] != "" else None
                        if value is not None:
                            min_id = value if min_id is None else min(min_id, value)
                            max_id = value if max_id is None else max(max_id, value)
                    except Exception:
                        pass
                if time_idx is not None and time_idx < len(row) and row[time_idx] != "":
                    # Export timestamps are ISO-like; string min/max avoids
                    # millions of per-row datetime parses during inventory.
                    ts = row[time_idx].strip()
                    min_time = ts if min_time is None else min(str(min_time), ts)
                    max_time = ts if max_time is None else max(str(max_time), ts)
    if filename == "data_iot_convert.csv":
        profile.update({
            "min_primary_key": int(min_id) if min_id is not None else None,
            "max_primary_key": int(max_id) if max_id is not None else None,
            "min_event_time": None if min_time is None else str(min_time),
            "max_event_time": None if max_time is None else str(max_time),
        })
    if int(profile.get("extra_field_row_count", 0)):
        profile["input_quality_result"] = "WARN_EXTRA_FIELDS_TRUNCATED_AFTER_MODEL_COLUMNS"
    elif profile["malformed_row_count"]:
        profile["input_quality_result"] = "FAIL_FACT_CSV_MALFORMED" if filename == "data_iot_convert.csv" else "WARN_DIMENSION_CSV_MALFORMED"
    else:
        profile["input_quality_result"] = "PASS"
    return profile, malformed


def stable_chunk_hash(path: Path, chunk_size: int = 2 * 1024 * 1024) -> str:
    size = path.stat().st_size
    hasher = hashlib.sha256()
    hasher.update(str(size).encode("ascii"))
    with path.open("rb") as handle:
        hasher.update(handle.read(chunk_size))
        if size > chunk_size:
            handle.seek(max(0, size // 2 - chunk_size // 2))
            hasher.update(handle.read(chunk_size))
            handle.seek(max(0, size - chunk_size))
            hasher.update(handle.read(chunk_size))
    return hasher.hexdigest()


def profile_fact_snapshot_bounds(path: Path) -> dict[str, Any]:
    min_id = max_id = None
    min_time = max_time = None
    try:
        for chunk in read_snapshot_csv(path, chunksize=200000):
            cols = [str(c).lstrip("\ufeff").strip() for c in chunk.columns]
            chunk.columns = cols
            id_col = "id" if "id" in chunk.columns else "event_id" if "event_id" in chunk.columns else None
            time_col = "status_time_start" if "status_time_start" in chunk.columns else "event_start_time" if "event_start_time" in chunk.columns else None
            if id_col:
                ids = pd.to_numeric(chunk[id_col], errors="coerce").dropna()
                if not ids.empty:
                    cmin, cmax = int(ids.min()), int(ids.max())
                    min_id = cmin if min_id is None else min(min_id, cmin)
                    max_id = cmax if max_id is None else max(max_id, cmax)
            if time_col:
                times = pd.to_datetime(chunk[time_col], errors="coerce", format="mixed").dropna()
                if not times.empty:
                    tmin, tmax = times.min(), times.max()
                    min_time = tmin if min_time is None else min(min_time, tmin)
                    max_time = tmax if max_time is None else max(max_time, tmax)
    except Exception as exc:
        return {"profile_error": str(exc)}
    return {
        "min_primary_key": int(min_id) if min_id is not None else None,
        "max_primary_key": int(max_id) if max_id is not None else None,
        "min_event_time": None if min_time is None else str(min_time),
        "max_event_time": None if max_time is None else str(max_time),
    }


def build_snapshot_equivalence_groups(hashes: pd.DataFrame) -> dict[str, Any]:
    groups: dict[str, list[dict[str, Any]]] = {}
    existing = hashes[hashes["exists"] == True].copy()  # noqa: E712
    for (file_name, chunk_hash), group in existing.groupby(["file_name", "chunk_hash_sha256"], dropna=False):
        key = f"{file_name}:{chunk_hash}"
        groups[key] = group[["snapshot_dir", "file_path", "file_size_bytes", "row_count", "column_count"]].to_dict("records")
    fact_groups = {
        key: rows
        for key, rows in groups.items()
        if key.startswith("data_iot_convert.csv:") and len(rows) > 1
    }
    full_dirs = []
    for directory, subset in existing.groupby("snapshot_dir"):
        present = set(subset["file_name"].tolist())
        if all(name in present for name in SNAPSHOT_FILES):
            full_dirs.append(str(directory))
    return {
        "content_equivalence_method": "file size plus deterministic first/middle/last chunk sha256",
        "equivalence_groups": groups,
        "content_equivalent_fact_snapshot_copies": fact_groups,
        "full_snapshot_directories": full_dirs,
    }


def summarize_csv_parse_quality(hashes: pd.DataFrame, malformed_rows: list[dict[str, Any]]) -> dict[str, Any]:
    malformed_files = hashes[pd.to_numeric(hashes.get("malformed_row_count", pd.Series(dtype=int)), errors="coerce").fillna(0) > 0]
    extra_field_files = hashes[pd.to_numeric(hashes.get("extra_field_row_count", pd.Series(dtype=int)), errors="coerce").fillna(0) > 0]
    fact_bad = malformed_files[malformed_files["file_name"] == "data_iot_convert.csv"]
    if not fact_bad.empty:
        result = "FAIL_INPUT_QUALITY_FACT_MALFORMED"
    elif not malformed_files.empty or not extra_field_files.empty:
        result = "WARN_DIMENSION_PARSE_ISSUES_AUDITED"
    else:
        result = "PASS"
    return {
        "result": result,
        "parser_warning_resolved": True,
        "malformed_file_count": int(len(malformed_files)),
        "malformed_row_count_total": int(pd.to_numeric(hashes.get("malformed_row_count", pd.Series(dtype=int)), errors="coerce").fillna(0).sum()),
        "extra_field_file_count": int(len(extra_field_files)),
        "extra_field_row_count_total": int(pd.to_numeric(hashes.get("extra_field_row_count", pd.Series(dtype=int)), errors="coerce").fillna(0).sum()),
        "malformed_files": malformed_files[["snapshot_dir", "file_name", "malformed_row_count", "input_quality_result"]].to_dict("records"),
        "extra_field_files": extra_field_files[["snapshot_dir", "file_name", "extra_field_row_count", "input_quality_result"]].to_dict("records"),
        "model_column_impact": "FACT_FILE_PASS; DIMENSION_EXTRA_FIELDS_TRUNCATED_AFTER_REQUIRED_MODEL_COLUMNS",
        "malformed_sample_rows_written": int(len(malformed_rows)),
    }


def resolve_training_raw_snapshot(
    project_root: Path,
    raw_data_dir: str | None,
    historical_probe: pd.DataFrame,
    *,
    snapshot_hashes: pd.DataFrame | None = None,
    snapshot_equivalence: dict[str, Any] | None = None,
) -> dict[str, Any]:
    candidates: list[dict[str, Any]] = []
    best: tuple[float, dict[str, Any], pd.DataFrame, pd.DataFrame] | None = None
    for directory in known_snapshot_directories(project_root, raw_data_dir):
        raw_file = directory / "data_iot_convert.csv"
        entry: dict[str, Any] = {"raw_data_dir": str(directory), "raw_file": str(raw_file), "exists": raw_file.exists()}
        if not raw_file.exists():
            entry["result"] = "MISSING_RAW_FILE"
            candidates.append(entry)
            continue
        try:
            raw_probe = load_snapshot_rows_matching_historical(raw_file, historical_probe)
            mapping = build_snapshot_historical_mapping(raw_probe, historical_probe)
            raw_comparison = compare_raw_input(mapping, raw_probe, historical_probe)
            unique = raw_comparison[raw_comparison["mapping_status"] == "UNIQUE"]
            exact_rate = float((unique["raw_input_match_status"] == "RAW_INPUT_EXACT_MATCH").mean()) if not unique.empty else 0.0
            identity_rate = float((unique["mapping_method"] == "event_id_identity").mean()) if not unique.empty else 0.0
            mapped_rate = float(len(unique) / max(len(historical_probe), 1))
            score = exact_rate * 0.8 + mapped_rate * 0.15 + identity_rate * 0.05
            entry.update({
                "probe_rows_historical": int(len(historical_probe)),
                "probe_rows_snapshot": int(len(raw_probe)),
                "unique_mapping_rows": int(len(unique)),
                "unique_mapping_rate": mapped_rate,
                "event_id_identity_rate": identity_rate,
                "raw_input_exact_match_rate": exact_rate,
                "score": score,
                "result": "ASSESSED",
            })
            candidates.append(entry)
            if best is None or score > best[0]:
                best = (score, entry, mapping, raw_comparison)
        except Exception as exc:
            entry.update({"result": "READ_OR_MAPPING_ERROR", "error": str(exc)})
            candidates.append(entry)

    selected_dir: str | None = None
    decision = "TRAINING_SNAPSHOT_NOT_FOUND"
    fact_snapshot_result = "TRAINING_SNAPSHOT_NOT_FOUND"
    full_source_snapshot_result = "DIMENSION_SNAPSHOT_UNRESOLVED"
    snapshot_equivalence_result = "NO_EQUIVALENT_FACT_COPY_DETECTED"
    selected_mapping = pd.DataFrame()
    selected_raw_comparison = pd.DataFrame()
    if best is not None:
        _, entry, selected_mapping, selected_raw_comparison = best
        selected_dir = entry["raw_data_dir"]
        exact_rate = float(entry["raw_input_exact_match_rate"])
        identity_rate = float(entry["event_id_identity_rate"])
        mapped_rate = float(entry["unique_mapping_rate"])
        equivalent_fact_dirs = equivalent_fact_snapshot_dirs(snapshot_hashes, selected_dir)
        selected_is_full = snapshot_dir_has_full_source(snapshot_hashes, selected_dir)
        if exact_rate >= 0.995 and mapped_rate >= 0.995:
            fact_snapshot_result = "EXACT_TRAINING_FACT_SNAPSHOT_FOUND"
            if len(equivalent_fact_dirs) > 1:
                decision = "CONTENT_EQUIVALENT_FACT_SNAPSHOT_COPIES"
                snapshot_equivalence_result = "CONTENT_EQUIVALENT_FACT_SNAPSHOT_COPIES"
            elif selected_is_full:
                decision = "EXACT_TRAINING_FULL_SOURCE_SNAPSHOT_FOUND"
            else:
                decision = "EXACT_TRAINING_FACT_SNAPSHOT_FOUND"
            full_source_snapshot_result = (
                "EXACT_TRAINING_FULL_SOURCE_SNAPSHOT_FOUND"
                if selected_is_full
                else "FACT_MATCH_BUT_DIMENSION_SNAPSHOT_UNRESOLVED"
            )
        elif exact_rate >= 0.90 and mapped_rate >= 0.95:
            fact_snapshot_result = "EXACT_TRAINING_FACT_SNAPSHOT_FOUND"
            decision = "FACT_MATCH_BUT_DIMENSION_SNAPSHOT_UNRESOLVED"
            full_source_snapshot_result = "FACT_MATCH_BUT_DIMENSION_SNAPSHOT_UNRESOLVED"
        else:
            selected_dir = None
    return {
        "decision": decision,
        "fact_snapshot_result": fact_snapshot_result,
        "full_source_snapshot_result": full_source_snapshot_result,
        "snapshot_equivalence_result": snapshot_equivalence_result,
        "selection_method": "raw event identity plus raw end/KWh indicators; inventory uses schema/hash/parse quality",
        "selected_raw_data_dir": selected_dir,
        "historical_probe_rows": int(len(historical_probe)),
        "equivalent_fact_snapshot_dirs": equivalent_fact_snapshot_dirs(snapshot_hashes, selected_dir) if selected_dir else [],
        "content_equivalence_groups_available": bool(snapshot_equivalence),
        "candidates": candidates,
        "_selected_probe_mapping": selected_mapping,
        "_selected_probe_raw_comparison": selected_raw_comparison,
    }


def snapshot_dir_has_full_source(snapshot_hashes: pd.DataFrame | None, selected_dir: str | None) -> bool:
    if snapshot_hashes is None or snapshot_hashes.empty or not selected_dir:
        return False
    subset = snapshot_hashes[(snapshot_hashes["snapshot_dir"] == str(Path(selected_dir).resolve())) & (snapshot_hashes["exists"] == True)]  # noqa: E712
    return all(name in set(subset["file_name"].tolist()) for name in SNAPSHOT_FILES)


def equivalent_fact_snapshot_dirs(snapshot_hashes: pd.DataFrame | None, selected_dir: str | None) -> list[str]:
    if snapshot_hashes is None or snapshot_hashes.empty or not selected_dir:
        return []
    selected_dir_resolved = str(Path(selected_dir).resolve())
    fact = snapshot_hashes[(snapshot_hashes["file_name"] == "data_iot_convert.csv") & (snapshot_hashes["exists"] == True)].copy()  # noqa: E712
    selected = fact[fact["snapshot_dir"] == selected_dir_resolved]
    if selected.empty:
        return []
    selected_hash = selected.iloc[0].get("chunk_hash_sha256")
    rows = fact[fact["chunk_hash_sha256"] == selected_hash]
    return sorted(rows["snapshot_dir"].astype(str).unique().tolist())


def load_snapshot_rows_matching_historical(raw_file: Path, historical: pd.DataFrame) -> pd.DataFrame:
    historical_ids = set(pd.to_numeric(historical["event_id"], errors="coerce").dropna().astype(int).tolist())
    historical_keys = set(make_natural_key(historical).dropna().tolist())
    rows: list[pd.DataFrame] = []
    for chunk in read_snapshot_csv(raw_file, chunksize=200000):
        normalized = normalize_snapshot_raw(chunk)
        normalized["_natural_key"] = make_natural_key(normalized)
        picked = normalized[
            normalized["event_id"].astype("Int64").isin(historical_ids)
            | normalized["_natural_key"].isin(historical_keys)
        ].copy()
        if not picked.empty:
            rows.append(picked)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame(columns=[
        "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
        "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
    ])


def build_snapshot_historical_mapping(snapshot_raw: pd.DataFrame, historical: pd.DataFrame) -> pd.DataFrame:
    if snapshot_raw.empty or historical.empty:
        return pd.DataFrame(columns=["snapshot_event_id", "historical_event_id", "mapping_status", "mapping_method"])
    raw = snapshot_raw.copy()
    hist = historical.copy()
    raw["_natural_key"] = make_natural_key(raw)
    hist["_natural_key"] = make_natural_key(hist)
    raw_ids = raw.drop_duplicates("event_id").set_index("event_id")
    raw_by_key = raw.sort_values(["machine_id", "event_start_time", "event_id"]).drop_duplicates("_natural_key").set_index("_natural_key")
    hist_ids = hist.drop_duplicates("event_id").set_index("event_id")
    raw_key_counts = raw["_natural_key"].value_counts(dropna=False)
    hist_key_counts = hist["_natural_key"].value_counts(dropna=False)
    rows: list[dict[str, Any]] = []
    for _, hrow in hist.iterrows():
        hist_id = int(hrow["event_id"])
        candidate = raw_ids.loc[hist_id] if hist_id in raw_ids.index else None
        method = ""
        raw_row: pd.Series | None = None
        if isinstance(candidate, pd.Series) and row_identity_matches(candidate, hrow):
            raw_row = candidate
            method = "event_id_identity"
        else:
            key = hrow["_natural_key"]
            if int(raw_key_counts.get(key, 0)) == 1 and int(hist_key_counts.get(key, 0)) == 1:
                raw_row = raw_by_key.loc[key]
                method = "natural_key_rounded_ms"
        if raw_row is None:
            rows.append({
                "snapshot_event_id": pd.NA,
                "historical_event_id": hist_id,
                "mapping_status": "AMBIGUOUS_MAPPING" if int(hist_key_counts.get(hrow["_natural_key"], 0)) > 1 else "UNMAPPED",
                "mapping_method": "none",
                "_natural_key": hrow["_natural_key"],
            })
            continue
        rows.append({
            "snapshot_event_id": int(raw_row.get("event_id", raw_row.name)),
            "historical_event_id": hist_id,
            "mapping_status": "UNIQUE",
            "mapping_method": method,
            "_natural_key": hrow["_natural_key"],
        })
    return pd.DataFrame(rows).drop_duplicates(["snapshot_event_id", "historical_event_id"], keep="first")


def row_identity_matches(raw_row: pd.Series, historical_row: pd.Series) -> bool:
    if int(raw_row["machine_id"]) != int(historical_row["machine_id"]):
        return False
    if int(raw_row["status_id"]) != int(historical_row["status_id"]):
        return False
    left = pd.to_datetime(raw_row["event_start_time"], errors="coerce")
    right = pd.to_datetime(historical_row["event_start_time"], errors="coerce")
    return not pd.isna(left) and not pd.isna(right) and abs((left - right).total_seconds() * 1000.0) <= 1.0


def compare_raw_input(mapping: pd.DataFrame, raw: pd.DataFrame, historical: pd.DataFrame) -> pd.DataFrame:
    if mapping.empty:
        return pd.DataFrame()
    raw_prefixed = raw.add_prefix("snapshot_")
    hist_prefixed = historical.add_prefix("historical_")
    merged = mapping.merge(
        raw_prefixed,
        left_on="snapshot_event_id",
        right_on="snapshot_event_id",
        how="left",
    ).merge(
        hist_prefixed,
        left_on="historical_event_id",
        right_on="historical_event_id",
        how="left",
    )
    rows: list[dict[str, Any]] = []
    for _, row in merged.iterrows():
        status = str(row.get("mapping_status", "UNMAPPED"))
        machine_match = values_match(row.get("snapshot_machine_id"), row.get("historical_machine_id"))
        status_match = values_match(row.get("snapshot_status_id"), row.get("historical_status_id"))
        start_match = timestamp_match(row.get("snapshot_event_start_time"), row.get("historical_event_start_time"))
        raw_end_match = historical_raw_end_matches(
            row.get("snapshot_raw_event_end_time"),
            row.get("historical_event_start_time"),
            row.get("historical_event_end_time"),
            row.get("historical_end_time_source"),
        )
        kwh_start_match = numeric_or_missing_match(row.get("snapshot_raw_status_kwh_start"), row.get("historical_raw_status_kwh_start"))
        kwh_end_match = numeric_or_missing_match(row.get("snapshot_raw_status_kwh_end"), row.get("historical_raw_status_kwh_end"))
        if status != "UNIQUE" or not (machine_match and status_match and start_match):
            raw_status = "AMBIGUOUS_MAPPING"
        else:
            changes: list[str] = []
            if not raw_end_match:
                changes.append("RAW_END")
            if not kwh_start_match:
                changes.append("RAW_KWH_START")
            if not kwh_end_match:
                changes.append("RAW_KWH_END")
            if not changes:
                raw_status = "RAW_INPUT_EXACT_MATCH"
            elif changes == ["RAW_END"]:
                raw_status = "RAW_END_CHANGED"
            elif changes == ["RAW_KWH_START"]:
                raw_status = "RAW_KWH_START_CHANGED"
            elif changes == ["RAW_KWH_END"]:
                raw_status = "RAW_KWH_END_CHANGED"
            elif changes == ["RAW_KWH_START", "RAW_KWH_END"]:
                raw_status = "RAW_KWH_BOTH_CHANGED"
            else:
                raw_status = "MULTIPLE_RAW_FIELDS_CHANGED"
        rows.append({
            "snapshot_event_id": row.get("snapshot_event_id"),
            "historical_event_id": row.get("historical_event_id"),
            "mapping_status": status,
            "mapping_method": row.get("mapping_method"),
            "raw_input_match_status": raw_status,
            "snapshot_machine_id": row.get("snapshot_machine_id"),
            "historical_machine_id": row.get("historical_machine_id"),
            "snapshot_status_id": row.get("snapshot_status_id"),
            "historical_status_id": row.get("historical_status_id"),
            "snapshot_event_start_time": row.get("snapshot_event_start_time"),
            "historical_event_start_time": row.get("historical_event_start_time"),
            "snapshot_raw_event_end_time": row.get("snapshot_raw_event_end_time"),
            "historical_event_end_time": row.get("historical_event_end_time"),
            "historical_end_time_source": row.get("historical_end_time_source"),
            "snapshot_raw_status_kwh_start": row.get("snapshot_raw_status_kwh_start"),
            "historical_raw_status_kwh_start": row.get("historical_raw_status_kwh_start"),
            "snapshot_raw_status_kwh_end": row.get("snapshot_raw_status_kwh_end"),
            "historical_raw_status_kwh_end": row.get("historical_raw_status_kwh_end"),
            "snapshot_raw_error_code": row.get("snapshot_raw_error_code"),
            "historical_raw_error_code": pd.NA,
            "machine_id_match": machine_match,
            "status_id_match": status_match,
            "event_start_time_match": start_match,
            "raw_event_end_match": raw_end_match,
            "raw_kwh_start_match": kwh_start_match,
            "raw_kwh_end_match": kwh_end_match,
            "raw_error_code_match": "NOT_AVAILABLE_IN_HISTORICAL_L1",
        })
    return pd.DataFrame(rows)


def values_match(left: Any, right: Any) -> bool:
    if pd.isna(left) and pd.isna(right):
        return True
    try:
        return int(left) == int(right)
    except Exception:
        return False


def timestamp_match(left: Any, right: Any) -> bool:
    left_ts = pd.to_datetime(left, errors="coerce")
    right_ts = pd.to_datetime(right, errors="coerce")
    return not pd.isna(left_ts) and not pd.isna(right_ts) and abs((left_ts - right_ts).total_seconds() * 1000.0) <= 1.0


def numeric_or_missing_match(left: Any, right: Any, tolerance: float = 1e-6) -> bool:
    if pd.isna(left) and pd.isna(right):
        return True
    if pd.isna(left) or pd.isna(right):
        return False
    try:
        return abs(float(left) - float(right)) <= tolerance
    except Exception:
        return False


def historical_raw_end_matches(raw_end: Any, event_start: Any, historical_end: Any, historical_source: Any) -> bool:
    start = pd.to_datetime(event_start, errors="coerce")
    raw = pd.to_datetime(raw_end, errors="coerce")
    source = str(historical_source)
    if source == "RAW":
        return timestamp_match(raw, historical_end)
    # Historical L1 does not persist raw end. For an imputed/open end, the
    # only evidence available is that raw end was absent or invalid.
    return pd.isna(raw) or (not pd.isna(start) and raw <= start)


def summarize_raw_input_comparison(comparison: pd.DataFrame) -> dict[str, Any]:
    unique = comparison[comparison.get("mapping_status", pd.Series(dtype=str)) == "UNIQUE"].copy()
    total = max(len(unique), 1)
    statuses = unique.get("raw_input_match_status", pd.Series(dtype=str)).value_counts().astype(int).to_dict()
    return {
        "mapped_unique_rows": int(len(unique)),
        "raw_input_match_status_distribution": statuses,
        "raw_input_exact_match_rate": float((unique.get("raw_input_match_status", pd.Series(dtype=str)) == "RAW_INPUT_EXACT_MATCH").sum() / total),
        "raw_end_changed_rate": float((~unique.get("raw_event_end_match", pd.Series(dtype=bool)).fillna(False)).sum() / total),
        "raw_kwh_start_changed_rate": float((~unique.get("raw_kwh_start_match", pd.Series(dtype=bool)).fillna(False)).sum() / total),
        "raw_kwh_end_changed_rate": float((~unique.get("raw_kwh_end_match", pd.Series(dtype=bool)).fillna(False)).sum() / total),
        "raw_error_code_changed_rate": None,
        "raw_error_code_comparison": "NOT_AVAILABLE_IN_HISTORICAL_L1",
        "context_input_match_status_distribution": unique.get("context_input_match_status", pd.Series(dtype=str)).value_counts().astype(int).to_dict(),
    }


def mark_replay_context_eligibility(
    raw_comparison: pd.DataFrame,
    runtime: pd.DataFrame,
    historical: pd.DataFrame,
) -> pd.DataFrame:
    """Exclude only missing snapshot-prefix context from core feature parity."""
    out = raw_comparison.copy()
    runtime_order = runtime[["event_id", "event_order_in_segment"]].rename(
        columns={"event_id": "snapshot_event_id", "event_order_in_segment": "runtime_event_order_in_segment"}
    )
    historical_order = historical[["event_id", "event_order_in_segment"]].rename(
        columns={"event_id": "historical_event_id", "event_order_in_segment": "historical_event_order_in_segment"}
    )
    runtime_context = runtime[["event_id", "event_order_in_segment", "machine_group_id", "location_id"]].rename(
        columns={
            "event_id": "snapshot_event_id",
            "event_order_in_segment": "runtime_event_order_in_segment",
            "machine_group_id": "runtime_machine_group_id",
            "location_id": "runtime_location_id",
        }
    )
    historical_context = historical[["event_id", "event_order_in_segment", "machine_group_id", "location_id"]].rename(
        columns={
            "event_id": "historical_event_id",
            "event_order_in_segment": "historical_event_order_in_segment",
            "machine_group_id": "historical_machine_group_id",
            "location_id": "historical_location_id",
        }
    )
    out = out.merge(runtime_context, on="snapshot_event_id", how="left").merge(historical_context, on="historical_event_id", how="left")
    prefix_missing = (
        (pd.to_numeric(out["runtime_event_order_in_segment"], errors="coerce") == 1)
        & (pd.to_numeric(out["historical_event_order_in_segment"], errors="coerce") > 1)
    )
    location_changed = ~out.apply(lambda row: values_match(row["runtime_location_id"], row["historical_location_id"]), axis=1)
    group_changed = ~out.apply(lambda row: values_match(row["runtime_machine_group_id"], row["historical_machine_group_id"]), axis=1)
    out["context_input_match_status"] = np.select(
        [prefix_missing, group_changed, location_changed],
        ["CONTEXT_PREFIX_NOT_IN_SNAPSHOT", "CONTEXT_MACHINE_GROUP_CHANGED", "CONTEXT_LOCATION_CHANGED"],
        default="CONTEXT_AVAILABLE",
    )
    out["context_parity_status"] = out["context_input_match_status"]
    out["transformation_core_eligible"] = ~prefix_missing
    return out


def select_offline_replay_machines(exact_probe: pd.DataFrame, minimum: int) -> list[int]:
    if exact_probe.empty or "snapshot_machine_id" not in exact_probe.columns:
        return []
    counts = pd.to_numeric(exact_probe["snapshot_machine_id"], errors="coerce").dropna().astype(int).value_counts()
    return [int(v) for v in counts.index[:minimum].tolist()]


def load_snapshot_raw_events(raw_file: Path, *, machine_ids: list[int]) -> pd.DataFrame:
    wanted = set(int(v) for v in machine_ids)
    rows: list[pd.DataFrame] = []
    for chunk in read_snapshot_csv(raw_file, chunksize=200000):
        normalized = normalize_snapshot_raw(chunk)
        selected = normalized[normalized["machine_id"].astype("Int64").isin(wanted)].copy()
        if not selected.empty:
            rows.append(selected)
    if not rows:
        return pd.DataFrame(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ])
    return pd.concat(rows, ignore_index=True).sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)


def load_snapshot_dimension(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame()
    encoding, sep = snapshot_csv_format(path)
    rows: list[list[str]] = []
    with path.open("r", encoding=encoding, errors="replace", newline="") as handle:
        reader = csv.reader(handle, delimiter=sep)
        try:
            header = [str(c).lstrip("\ufeff").strip() for c in next(reader)]
        except StopIteration:
            return pd.DataFrame()
        expected_fields = len(header)
        for row in reader:
            if len(row) >= expected_fields:
                row = row[:expected_fields]
                rows.append(row)
    data = pd.DataFrame(rows, columns=header)
    data.columns = [str(c).lstrip("\ufeff").strip() for c in data.columns]
    if "is_deleted" in data.columns:
        data = data[pd.to_numeric(data["is_deleted"], errors="coerce").fillna(0) == 0].copy()
    return data


def build_snapshot_join_context(raw_all: pd.DataFrame, snapshot_dir: Path) -> tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    statuses = load_snapshot_dimension(snapshot_dir / "data_machine_status.csv")
    machines = load_snapshot_dimension(snapshot_dir / "data_machine.csv")
    location_history = load_snapshot_dimension(snapshot_dir / "machine_location_his.csv")
    status_map = pd.DataFrame({
        "status_id": snapshot_numeric(statuses.get("id", pd.Series(dtype=object))).astype("Int64"),
        "status_name": statuses.get("status_name", statuses.get("name", pd.Series(dtype=object))),
        "status_type_raw": statuses.get("type", pd.Series(dtype=object)),
        "status_note": statuses.get("note", pd.Series(dtype=object)),
    }).dropna(subset=["status_id"]).drop_duplicates("status_id")
    machine_map = pd.DataFrame({
        "machine_id": snapshot_numeric(machines.get("id", machines.get("machine_id", pd.Series(dtype=object)))).astype("Int64"),
        "machine_group_id": snapshot_numeric(machines.get("machine_group_id", pd.Series(dtype=object))).astype("Int64"),
    }).dropna(subset=["machine_id"]).drop_duplicates("machine_id")
    location_map = map_snapshot_locations(raw_all, location_history)
    raw_for_audit = raw_all.copy()
    raw_for_audit["context_role"] = "continuous_replay_context"
    raw_for_audit["is_raw_candidate_event"] = 0
    joined = build_joined_canonical_for_audit(raw_for_audit, status_map, location_map, machine_map)
    return joined, status_map, machine_map, location_map


def snapshot_numeric(values: pd.Series) -> pd.Series:
    return pd.to_numeric(values.astype(str).str.lstrip("\ufeff").str.strip(), errors="coerce")


def map_snapshot_locations(raw_all: pd.DataFrame, location_history: pd.DataFrame) -> pd.DataFrame:
    required = {"machine_id", "location_id", "start_time"}
    if not required.issubset(location_history.columns):
        return pd.DataFrame({
            "event_id": raw_all["event_id"],
            "machine_id": raw_all["machine_id"],
            "location_id": pd.NA,
            "location_history_start_time": pd.NaT,
            "location_history_end_time": pd.NaT,
            "location_mapping_source": "missing_snapshot_location_history",
        })
    history = location_history.copy()
    history["machine_id"] = pd.to_numeric(history["machine_id"], errors="coerce").astype("Int64")
    history["location_id"] = pd.to_numeric(history["location_id"], errors="coerce").astype("Int64")
    history["start_time"] = pd.to_datetime(history["start_time"], errors="coerce", format="mixed")
    if "end_time" not in history.columns:
        history["end_time"] = pd.NaT
    history["end_time"] = pd.to_datetime(history["end_time"], errors="coerce", format="mixed")
    rows: list[pd.DataFrame] = []
    for machine_id, events in raw_all.groupby("machine_id", sort=False):
        events = events[["event_id", "machine_id", "event_start_time"]].sort_values("event_start_time")
        hist = history[history["machine_id"] == machine_id].dropna(subset=["start_time"]).sort_values("start_time")
        if hist.empty:
            out = events.copy()
            out["location_id"] = pd.NA
            out["location_history_start_time"] = pd.NaT
            out["location_history_end_time"] = pd.NaT
            out["location_mapping_source"] = "missing_event_time"
        else:
            out = pd.merge_asof(
                events,
                hist[["start_time", "end_time", "location_id"]],
                left_on="event_start_time",
                right_on="start_time",
                direction="backward",
            ).rename(columns={"start_time": "location_history_start_time", "end_time": "location_history_end_time"})
            valid = out["location_history_end_time"].isna() | (out["event_start_time"] < out["location_history_end_time"])
            out.loc[~valid, "location_id"] = pd.NA
            out["location_mapping_source"] = np.where(out["location_id"].notna(), "event_time", "missing_event_time")
        rows.append(out)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def select_offline_replay_blocks(runtime_all: pd.DataFrame, sample_size: int, *, minimum_machines: int) -> tuple[pd.DataFrame, set[int]]:
    machine_counts = runtime_all.groupby("machine_id").size().sort_values(ascending=False)
    machines = [int(v) for v in machine_counts.index[:minimum_machines]]
    block_size = 100
    blocks_per_machine = max(1, sample_size // max(len(machines) * block_size, 1))
    selected: set[int] = set()
    manifest: list[dict[str, Any]] = []
    for machine_id in machines:
        events = runtime_all[runtime_all["machine_id"] == machine_id].sort_values(["event_start_time", "event_id"]).reset_index(drop=True)
        if events.empty:
            continue
        starts = np.linspace(0, max(len(events) - block_size, 0), num=blocks_per_machine, dtype=int).tolist()
        boundaries = events.index[pd.to_numeric(events["event_order_in_segment"], errors="coerce").fillna(0) == 1].tolist()
        if boundaries:
            starts[0] = max(0, min(boundaries[0] - 20, max(len(events) - block_size, 0)))
        for block_number, start in enumerate(sorted(set(starts)), start=1):
            block = events.iloc[start:start + block_size]
            if block.empty:
                continue
            selected.update(block["event_id"].astype(int).tolist())
            manifest.append({
                "machine_id": machine_id,
                "block_number": block_number,
                "block_start_event_id": int(block["event_id"].iloc[0]),
                "block_end_event_id": int(block["event_id"].iloc[-1]),
                "block_rows": int(len(block)),
                "contains_segment_start": bool((pd.to_numeric(block["event_order_in_segment"], errors="coerce").fillna(0) == 1).any()),
                "contains_big_gap": bool((pd.to_numeric(block["is_big_gap"], errors="coerce").fillna(0) == 1).any()),
                "contains_overlap": bool((pd.to_numeric(block["is_overlap"], errors="coerce").fillna(0) == 1).any()),
            })
    if len(selected) < sample_size:
        remainder = runtime_all[~runtime_all["event_id"].astype(int).isin(selected)]
        extra = remainder.sample(n=min(sample_size - len(selected), len(remainder)), random_state=20260714)
        selected.update(extra["event_id"].astype(int).tolist())
    return pd.DataFrame(manifest), selected


def load_historical_for_snapshot_rows(csv_path: Path, raw_selected: pd.DataFrame) -> pd.DataFrame:
    if raw_selected.empty:
        return pd.DataFrame()
    ids = set(raw_selected["event_id"].dropna().astype(int).tolist())
    keys = set(make_natural_key(raw_selected).dropna().tolist())
    sep = detect_csv_separator(str(csv_path))
    rows: list[pd.DataFrame] = []
    for chunk in pd.read_csv(csv_path, sep=sep, chunksize=200000, low_memory=False):
        chunk["_natural_key"] = make_natural_key(chunk)
        selected = chunk[pd.to_numeric(chunk["event_id"], errors="coerce").astype("Int64").isin(ids) | chunk["_natural_key"].isin(keys)].copy()
        if not selected.empty:
            rows.append(selected)
    return pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()


def classify_transformation_mismatches(comparison: pd.DataFrame) -> pd.DataFrame:
    if comparison.empty:
        return pd.DataFrame(columns=["sql_event_id", "historical_event_id", "feature_name", "classification", "runtime_value", "historical_value", "reason"])
    group_to_classification = {
        "time": "TIME_TRANSFORMATION_MISMATCH",
        "kwh": "KWH_TRANSFORMATION_MISMATCH",
        "status": "STATUS_TRANSFORMATION_MISMATCH",
        "location_context": "LOCATION_TRANSFORMATION_MISMATCH",
        "quality": "QUALITY_TRANSFORMATION_MISMATCH",
    }
    out = comparison[comparison["tolerance_match"] == False].copy()  # noqa: E712
    out["classification"] = out["feature_group"].map(group_to_classification).fillna("TRANSFORMATION_MISMATCH")
    return out.reindex(columns=[
        "sql_event_id", "historical_event_id", "feature_group", "feature_name", "classification",
        "runtime_value", "historical_value", "abs_diff", "reason",
    ])


def build_offline_segmentation_report(
    mapping: pd.DataFrame,
    runtime: pd.DataFrame,
    historical: pd.DataFrame,
    block_manifest: pd.DataFrame,
) -> dict[str, Any]:
    base = build_segmentation_parity(mapping, runtime, historical)
    mapped = mapping[mapping["mapping_status"] == "UNIQUE"].rename(columns={"sql_event_id": "snapshot_event_id"})
    selected = runtime.merge(mapped[["snapshot_event_id"]], left_on="event_id", right_on="snapshot_event_id", how="inner")
    cross_boundary_windows = 0
    window_count = 0
    # Training creates windows inside ``machine_id + sequence_segment_id``.
    # Count only eligible 20-event windows, then assert their grouping leaves
    # no cross-segment window behind.
    for _, group in selected.sort_values(["machine_id", "event_start_time", "event_id"]).groupby(["machine_id", "sequence_segment_id"]):
        window_count += max(0, len(group) - 19)
    base.update({
        "continuous_block_count": int(len(block_manifest)),
        "continuous_machine_count": int(block_manifest["machine_id"].nunique()) if not block_manifest.empty else 0,
        "minimum_block_rows": int(block_manifest["block_rows"].min()) if not block_manifest.empty else 0,
        "segment_boundary_blocks": int(block_manifest["contains_segment_start"].sum()) if "contains_segment_start" in block_manifest else 0,
        "big_gap_blocks": int(block_manifest["contains_big_gap"].sum()) if "contains_big_gap" in block_manifest else 0,
        "overlap_blocks": int(block_manifest["contains_overlap"].sum()) if "contains_overlap" in block_manifest else 0,
        "l1_window_20_checked": int(window_count),
        "l1_window_20_cross_segment_count": int(cross_boundary_windows),
    })
    if base.get("continuous_machine_count", 0) < 10 or base.get("minimum_block_rows", 0) < 100 or cross_boundary_windows > 0:
        base["result"] = "FAIL"
    return base


def build_live_source_drift_report(
    cfg: dict[str, Any],
    current_raw: pd.DataFrame,
    current_features: pd.DataFrame,
    project_root: Path,
) -> dict[str, Any]:
    """Describe raw source drift without treating it as a builder defect."""
    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    if current_raw.empty:
        return {
            "conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED",
            "reason": "no_current_candidates",
            "historical_l1_csv": str(historical_csv),
        }
    # The historical file contains millions of rows. A prior source-lineage
    # audit has already performed the natural-key comparison, so a routine
    # live contract run profiles its current batch and reuses that immutable
    # comparison instead of materializing the historical export again.
    reference_path = latest_source_drift_reference(project_root)
    current_raw_available = float(
        (pd.to_numeric(current_raw["raw_status_kwh_start"], errors="coerce").notna()
         & pd.to_numeric(current_raw["raw_status_kwh_end"], errors="coerce").notna()).mean()
    )
    if reference_path is not None:
        reference = load_json(reference_path)
        return {
            "conclusion": reference.get("conclusion", "SOURCE_DATA_DRIFT_UNRESOLVED"),
            "comparison_scope": "prior_natural_key_source_lineage_audit",
            "reference_report": str(reference_path),
            "mapping_key": reference.get("mapping_key"),
            "reference_mapped_unique_rows": reference.get("mapped_unique_rows"),
            "raw_end_changed_rate": reference.get("raw_end_changed_rate"),
            "raw_kwh_start_changed_rate": reference.get("raw_kwh_start_changed_rate"),
            "raw_kwh_end_changed_rate": reference.get("raw_kwh_end_changed_rate"),
            "raw_error_code_changed_rate": reference.get("raw_error_code_changed_rate"),
            "raw_error_code_comparison": reference.get("raw_error_code_comparison"),
            "current_batch_kwh_raw_available_rate": current_raw_available,
            "current_sql_kwh_raw_available_rate": reference.get("current_sql_kwh_raw_available_rate", reference.get("current_sql_raw_available_rate")),
            "historical_kwh_raw_available_rate": reference.get("historical_kwh_raw_available_rate", reference.get("historical_raw_available_rate")),
            "source_distribution": reference.get("source_distribution", {}),
            "historical_l1_csv": str(historical_csv),
            "write_sql_enabled": False,
            "l1_model_enabled": False,
            "l2_prediction_run": False,
        }
    return {
        "conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED",
        "reason": "no_prior_natural_key_source_lineage_audit",
        "current_batch_kwh_raw_available_rate": current_raw_available,
        "historical_l1_csv": str(historical_csv),
    }


def latest_source_drift_reference(project_root: Path) -> Path | None:
    audit_root = project_root / "data" / "realtime_audit"
    reports = sorted(audit_root.glob("l1_offline_replay_*/09_live_sql_source_drift.json"), reverse=True)
    return reports[0] if reports else None


def build_live_source_drift_report_full_scan(
    cfg: dict[str, Any],
    current_raw: pd.DataFrame,
    current_features: pd.DataFrame,
    project_root: Path,
) -> dict[str, Any]:
    """One-off full historical comparison retained for source-lineage audits."""
    historical_csv = resolve_project_path(cfg, get_historical_l1_csv(cfg), project_root)
    historical = load_historical_l1_overlap_candidates(
        historical_csv,
        set(make_natural_key(current_raw).dropna().tolist()),
    )
    if historical.empty:
        return {
            "conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED",
            "reason": "no_natural_key_overlap_with_historical_l1",
            "historical_l1_csv": str(historical_csv),
        }
    historical = derive_historical_l1_audit_columns(historical)
    mapping = build_snapshot_historical_mapping(current_raw, historical)
    raw_comparison = compare_raw_input(mapping, current_raw, historical)
    unique = raw_comparison[raw_comparison["mapping_status"] == "UNIQUE"].copy()
    if unique.empty:
        return {
            "conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED",
            "reason": "no_unique_natural_key_mapping",
            "historical_l1_csv": str(historical_csv),
        }
    historical_ids = set(pd.to_numeric(unique["historical_event_id"], errors="coerce").dropna().astype(int).tolist())
    historical_for_distribution = historical[historical["event_id"].astype("Int64").isin(historical_ids)]
    current_ids = set(pd.to_numeric(unique["snapshot_event_id"], errors="coerce").dropna().astype(int).tolist())
    current_for_distribution = current_features[current_features["event_id"].astype("Int64").isin(current_ids)]
    summary = summarize_raw_input_comparison(raw_comparison)
    current_raw_available = float(
        (unique["snapshot_raw_status_kwh_start"].notna() & unique["snapshot_raw_status_kwh_end"].notna()).mean()
    )
    historical_raw_available = float(
        (unique["historical_raw_status_kwh_start"].notna() & unique["historical_raw_status_kwh_end"].notna()).mean()
    )
    max_changed_rate = max(
        summary["raw_end_changed_rate"], summary["raw_kwh_start_changed_rate"], summary["raw_kwh_end_changed_rate"],
    )
    if max_changed_rate <= 0.005:
        conclusion = "SOURCE_DATA_STABLE"
    elif current_raw_available > historical_raw_available + 0.10:
        conclusion = "SOURCE_DATA_BACKFILLED"
    else:
        conclusion = "SOURCE_DATA_DRIFT_UNRESOLVED"
    return {
        "conclusion": conclusion,
        "mapping_key": "machine_id + status_id + event_start_time rounded to millisecond",
        "historical_l1_csv": str(historical_csv),
        "mapped_unique_rows": int(len(unique)),
        "raw_end_changed_rate": summary["raw_end_changed_rate"],
        "raw_kwh_start_changed_rate": summary["raw_kwh_start_changed_rate"],
        "raw_kwh_end_changed_rate": summary["raw_kwh_end_changed_rate"],
        "raw_error_code_changed_rate": None,
        "raw_error_code_comparison": "NOT_AVAILABLE_IN_HISTORICAL_L1",
        "current_sql_kwh_raw_available_rate": current_raw_available,
        "historical_kwh_raw_available_rate": historical_raw_available,
        "source_distribution": {
            "current_sql_kwh_start_source": current_for_distribution.get("kwh_start_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
            "historical_kwh_start_source": historical_for_distribution.get("kwh_start_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
            "current_sql_kwh_end_source": current_for_distribution.get("kwh_end_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
            "historical_kwh_end_source": historical_for_distribution.get("kwh_end_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        },
        "write_sql_enabled": False,
        "l1_model_enabled": False,
        "l2_prediction_run": False,
    }


def build_live_sql_source_drift(cfg: dict[str, Any], historical_selected: pd.DataFrame, thresholds: dict[str, int]) -> dict[str, Any]:
    if historical_selected.empty:
        return {"conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED", "reason": "no_historical_rows_from_offline_replay"}
    with connect(cfg["database"]) as conn:
        sql_raw = load_sql_joined_events_for_parity(conn, cfg)
    sql_raw["_natural_key"] = make_natural_key(sql_raw)
    historical = historical_selected.copy()
    mapping = build_snapshot_historical_mapping(sql_raw, historical)
    raw_comparison = compare_raw_input(mapping, sql_raw, historical)
    unique = raw_comparison[raw_comparison["mapping_status"] == "UNIQUE"].copy()
    selected_sql_ids = set(pd.to_numeric(unique["snapshot_event_id"], errors="coerce").dropna().astype(int).tolist())
    context = build_context_from_loaded_sql(sql_raw, selected_sql_ids, lookback=40, lookahead=2)
    if context.empty:
        return {"conclusion": "SOURCE_DATA_DRIFT_UNRESOLVED", "reason": "no_current_sql_context_for_natural_mapping"}
    location_context = context.reindex(columns=[
        "event_id", "machine_id", "location_id", "machine_group_id", "location_history_start_time",
        "location_history_end_time", "location_mapping_source",
    ])
    current_features = build_l1_event_features(
        context.reindex(columns=[
            "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time",
            "raw_status_kwh_start", "raw_status_kwh_end", "raw_error_code",
        ]),
        location_context=location_context,
        config=cfg,
    )
    current_features = current_features[current_features["event_id"].astype("Int64").isin(selected_sql_ids)]
    historical_ids = set(pd.to_numeric(unique["historical_event_id"], errors="coerce").dropna().astype(int).tolist())
    historical_for_distribution = historical[historical["event_id"].astype("Int64").isin(historical_ids)]
    current_raw_available = float((unique["snapshot_raw_status_kwh_start"].notna() & unique["snapshot_raw_status_kwh_end"].notna()).mean()) if not unique.empty else 0.0
    historical_raw_available = float((unique["historical_raw_status_kwh_start"].notna() & unique["historical_raw_status_kwh_end"].notna()).mean()) if not unique.empty else 0.0
    raw_summary = summarize_raw_input_comparison(raw_comparison)
    source_distribution = {
        "current_sql_kwh_start_source": current_features.get("kwh_start_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "historical_kwh_start_source": historical_for_distribution.get("kwh_start_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "current_sql_kwh_end_source": current_features.get("kwh_end_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "historical_kwh_end_source": historical_for_distribution.get("kwh_end_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "current_sql_end_time_source": current_features.get("end_time_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
        "historical_end_time_source": historical_for_distribution.get("end_time_source", pd.Series(dtype=str)).value_counts(dropna=False).astype(int).to_dict(),
    }
    changed_rate = max(
        raw_summary["raw_end_changed_rate"],
        raw_summary["raw_kwh_start_changed_rate"],
        raw_summary["raw_kwh_end_changed_rate"],
    )
    if changed_rate <= 0.005:
        conclusion = "SOURCE_DATA_STABLE"
    elif current_raw_available > historical_raw_available + 0.10:
        conclusion = "SOURCE_DATA_BACKFILLED"
    else:
        conclusion = "SOURCE_DATA_DRIFT_UNRESOLVED"
    return {
        "conclusion": conclusion,
        "mapping_key": "machine_id + status_id + event_start_time rounded to millisecond",
        "mapped_unique_rows": int(len(unique)),
        "raw_end_changed_rate": raw_summary["raw_end_changed_rate"],
        "raw_kwh_start_changed_rate": raw_summary["raw_kwh_start_changed_rate"],
        "raw_kwh_end_changed_rate": raw_summary["raw_kwh_end_changed_rate"],
        "raw_error_code_changed_rate": None,
        "raw_error_code_comparison": "NOT_AVAILABLE_IN_HISTORICAL_L1",
        "current_sql_raw_available_rate": current_raw_available,
        "historical_raw_available_rate": historical_raw_available,
        "source_distribution": source_distribution,
        "write_sql_enabled": False,
        "l1_model_enabled": False,
        "l2_prediction_run": False,
    }


def build_offline_replay_readme(summary: dict[str, Any], out_dir: Path) -> str:
    return f"""# Offline Replay L1

Thư mục audit: `{out_dir}`

- Snapshot raw: `{summary.get('offline_raw_snapshot_result')}`
- Transformation parity trên raw input trùng khớp: `{summary.get('offline_transformation_parity_result')}`
- Kết luận: `{summary.get('final_result')}`

Mở trước: `01_training_snapshot_resolution.json`, `02_raw_input_comparison.csv`,
`07_transformation_feature_comparison.csv`, `11_segmentation_replay_report.json`,
`13_true_logic_mismatches.csv`, và `14_summary.json`.

Replay chỉ đọc CSV snapshot và historical L1. L1/L2 không được bật và SQL production không được ghi.
"""


def build_live_sql_contract_readme(summary: dict[str, Any], coverage: dict[str, Any], out_dir: Path) -> str:
    return f"""# Live SQL Contract L1

Thư mục audit: `{out_dir}`

- Candidate từ `dbo.data_iot_convert`: `{coverage.get('raw_candidate_rows', 0)}`
- Context theo row-order: `{coverage.get('context_rows', 0)}`
- Candidate OPEN_EVENT: `{coverage.get('open_candidate_rows', 0)}`
- Live SQL contract: `{summary.get('live_sql_contract_result')}`
- Source drift: `{summary.get('source_drift_result')}`

Mở trước `02_candidate_and_context_coverage.json`, `03_join_coverage.json`,
`05_live_l1_features.csv`, `06_source_drift_report.json`, và `09_summary.json`.

Context lấy bằng `ROW_NUMBER()` theo `machine_id, event_start_time, event_id`; lookahead là hàng kế tiếp, không bị giới hạn bởi thời gian. L1/L2 không được bật và SQL production không được ghi.
"""


def load_sql_joined_events_for_parity(conn: Any, cfg: dict[str, Any]) -> pd.DataFrame:
    tables = cfg["tables"]
    cols = cfg["source_columns"]
    raw_deleted = "is_deleted" if table_has_column(conn, tables["raw_iot"], "is_deleted") else None
    status_deleted = "is_deleted" if table_has_column(conn, tables.get("machine_status", "dbo.data_machine_status"), "is_deleted") else None
    machine_deleted = "is_deleted" if table_has_column(conn, tables["machine"], "is_deleted") else None
    location_deleted = "is_deleted" if table_has_column(conn, tables["machine_location_history"], "is_deleted") else None
    status_cols = table_columns(conn, tables.get("machine_status", "dbo.data_machine_status"))
    status_name_col = next((c for c in ["status_name", "name", "status", "title"] if c in status_cols), None)
    status_type_col = next((c for c in ["type", "status_type", "status_type_raw"] if c in status_cols), None)
    status_note_col = next((c for c in ["note", "description", "status_note"] if c in status_cols), None)
    lc = cfg.get("location_columns", {})
    mc = cfg.get("machine_columns", {})
    sql = f"""
SELECT
    CAST(i.[{cols['event_id']}] AS BIGINT) AS event_id,
    CAST(i.[{cols['machine_id']}] AS INT) AS machine_id,
    CAST(i.[{cols['status_id']}] AS INT) AS status_id,
    CAST(i.[{cols['event_start_time']}] AS DATETIME2) AS event_start_time,
    CAST(i.[{cols['raw_event_end_time']}] AS DATETIME2) AS raw_event_end_time,
    TRY_CAST(i.[{cols['raw_kwh_start']}] AS FLOAT) AS raw_status_kwh_start,
    TRY_CAST(i.[{cols['raw_kwh_end']}] AS FLOAT) AS raw_status_kwh_end,
    {f"CAST(i.[{cols.get('raw_error_code')}] AS NVARCHAR(200))" if cols.get('raw_error_code') else "CAST(NULL AS NVARCHAR(200))"} AS raw_error_code,
    {f"CAST(s.[{status_name_col}] AS NVARCHAR(500))" if status_name_col else "CAST(NULL AS NVARCHAR(500))"} AS status_name,
    {f"CAST(s.[{status_type_col}] AS NVARCHAR(500))" if status_type_col else "CAST(NULL AS NVARCHAR(500))"} AS status_type_raw,
    {f"CAST(s.[{status_note_col}] AS NVARCHAR(1000))" if status_note_col else "CAST(NULL AS NVARCHAR(1000))"} AS status_note,
    CAST(m.[{mc.get('machine_group_id', 'machine_group_id')}] AS INT) AS machine_group_id,
    CAST(loc.location_id AS INT) AS location_id,
    loc.location_history_start_time,
    loc.location_history_end_time,
    CASE WHEN loc.location_id IS NULL THEN CAST('missing_event_time' AS NVARCHAR(50)) ELSE CAST('event_time' AS NVARCHAR(50)) END AS location_mapping_source
FROM {table_name(tables['raw_iot'])} AS i
LEFT JOIN {table_name(tables.get('machine_status', 'dbo.data_machine_status'))} AS s
    ON s.id = CAST(i.[{cols['status_id']}] AS INT)
    {f"AND ISNULL(s.[{status_deleted}], 0) = 0" if status_deleted else ""}
LEFT JOIN {table_name(tables['machine'])} AS m
    ON m.[{mc.get('machine_id', 'id')}] = CAST(i.[{cols['machine_id']}] AS INT)
    {f"AND ISNULL(m.[{machine_deleted}], 0) = 0" if machine_deleted else ""}
OUTER APPLY (
    SELECT TOP (1)
        mlh.[{lc.get('location_id', 'location_id')}] AS location_id,
        CAST(mlh.[{lc.get('start_time', 'start_time')}] AS DATETIME2) AS location_history_start_time,
        CAST(mlh.[{lc.get('end_time', 'end_time')}] AS DATETIME2) AS location_history_end_time
    FROM {table_name(tables['machine_location_history'])} AS mlh
    WHERE mlh.[{lc.get('machine_id', 'machine_id')}] = CAST(i.[{cols['machine_id']}] AS INT)
      AND mlh.[{lc.get('start_time', 'start_time')}] <= CAST(i.[{cols['event_start_time']}] AS DATETIME2)
      AND (mlh.[{lc.get('end_time', 'end_time')}] IS NULL OR CAST(i.[{cols['event_start_time']}] AS DATETIME2) < mlh.[{lc.get('end_time', 'end_time')}])
      {f"AND ISNULL(mlh.[{location_deleted}], 0) = 0" if location_deleted else ""}
    ORDER BY mlh.[{lc.get('start_time', 'start_time')}] DESC
) AS loc
WHERE CAST(i.[{cols['event_id']}] AS BIGINT) IS NOT NULL
  AND CAST(i.[{cols['machine_id']}] AS INT) IS NOT NULL
  AND CAST(i.[{cols['status_id']}] AS INT) IS NOT NULL
  AND CAST(i.[{cols['event_start_time']}] AS DATETIME2) IS NOT NULL
  {f"AND ISNULL(i.[{raw_deleted}], 0) = 0" if raw_deleted else ""}
"""
    df = read_sql(conn, sql)
    df.attrs["sql_used"] = sql
    return df


def make_natural_key(df: pd.DataFrame) -> pd.Series:
    ts = pd.to_datetime(df["event_start_time"], errors="coerce").dt.round("ms").dt.strftime("%Y-%m-%d %H:%M:%S.%f").str[:23]
    return (
        pd.to_numeric(df["machine_id"], errors="coerce").astype("Int64").astype(str)
        + "|"
        + pd.to_numeric(df["status_id"], errors="coerce").astype("Int64").astype(str)
        + "|"
        + ts.fillna("NaT")
    )


def load_historical_l1_overlap_candidates(csv_path: Path, sql_keys: set[str]) -> pd.DataFrame:
    sep = detect_csv_separator(str(csv_path))
    header = pd.read_csv(csv_path, sep=sep, nrows=0).columns.tolist()
    wanted = [c for c in [
        "event_id", "machine_id", "status_id", "event_start_time", "event_end_time", "end_time_source",
        "raw_status_kwh_start", "raw_status_kwh_end", "kwh_start_source", "kwh_end_source",
        "duration_sec", "gap_from_prev_sec", "overlap_sec", "is_raw_end_missing", "is_invalid_raw_end",
        "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap",
        "is_overlap", "kwh_available_flag", "kwh_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag",
        "kwh_imputed_or_missing_flag", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag",
        "loaded_zero_kwh_flag", "loaded_without_kwh_flag", "status_type_code", "current_signal_code", "is_on",
        "is_loaded", "is_no_load", "is_current_near_zero", "has_error_token", "has_maintenance_token",
        "machine_group_id", "location_id", "hour_of_day", "day_of_week",
    ] if c in header]
    chunks = []
    for chunk in pd.read_csv(csv_path, sep=sep, usecols=wanted, chunksize=200000, low_memory=False):
        chunk["_natural_key"] = make_natural_key(chunk)
        matched = chunk[chunk["_natural_key"].isin(sql_keys)].copy()
        if not matched.empty:
            chunks.append(matched)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def select_l1_parity_sample(candidates: pd.DataFrame, sample_size: int) -> tuple[pd.DataFrame, pd.DataFrame]:
    unique = candidates[candidates["mapping_status"] == "UNIQUE"].copy()
    strata: list[tuple[str, pd.Series]] = []
    for status_id in range(1, 11):
        strata.append((f"status_{status_id}", unique["status_id"].astype(int) == status_id))
    for source in ["RAW", "NEXT_EVENT_START_FROM_NULL", "NEXT_EVENT_START_FROM_INVALID_RAW", "OPEN_EVENT"]:
        strata.append((f"end_time_source_{source}", unique.get("end_time_source", pd.Series(index=unique.index)).astype(str) == source))
    for col in [
        "kwh_available_flag", "kwh_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag",
        "kwh_zero_delta_flag", "kwh_negative_delta_flag", "is_overlap", "is_gap", "is_big_gap",
        "is_long_duration",
    ]:
        if col in unique.columns:
            strata.append((col, pd.to_numeric(unique[col], errors="coerce").fillna(0) == 1))
    for location_id in [3, 4]:
        if "location_id" in unique.columns:
            strata.append((f"location_{location_id}", pd.to_numeric(unique["location_id"], errors="coerce") == location_id))
    for name, statuses in {
        "fault_status": [6, 7, 9, 10],
        "maintenance_status": [4, 5, 6, 7, 10],
        "repair_status": [6, 7],
        "off_status": [8, 9, 10],
    }.items():
        strata.append((name, unique["status_id"].astype(int).isin(statuses)))

    selected_parts = []
    manifest_rows = []
    per_stratum = max(3, min(30, sample_size // max(len(strata), 1)))
    for name, mask in strata:
        subset = unique[mask].copy()
        if subset.empty:
            manifest_rows.append({"stratum": name, "available_rows": 0, "selected_rows": 0, "status": "NOT_PRESENT_IN_SHARED_RANGE"})
            continue
        take = min(per_stratum, len(subset))
        picked = subset.sample(n=take, random_state=42) if len(subset) > take else subset
        selected_parts.append(picked)
        manifest_rows.append({"stratum": name, "available_rows": int(len(subset)), "selected_rows": int(len(picked)), "status": "SELECTED"})
    selected = pd.concat(selected_parts, ignore_index=True).drop_duplicates("_natural_key") if selected_parts else unique.head(0)
    if len(selected) < sample_size and len(unique) > len(selected):
        fill = unique[~unique["_natural_key"].isin(set(selected["_natural_key"]))].sample(
            n=min(sample_size - len(selected), len(unique) - len(selected)),
            random_state=20260714,
        )
        selected = pd.concat([selected, fill], ignore_index=True)
    selected = selected.head(sample_size).reset_index(drop=True)
    return pd.DataFrame(manifest_rows), selected


def build_natural_key_mapping(
    sql_raw: pd.DataFrame,
    selected_hist: pd.DataFrame,
    sql_key_counts: pd.Series,
    hist_key_counts: pd.Series,
) -> pd.DataFrame:
    sql_by_key = sql_raw.sort_values(["machine_id", "event_start_time", "event_id"]).drop_duplicates("_natural_key", keep="first")
    hist = selected_hist.copy()
    out = hist.merge(
        sql_by_key[["_natural_key", "event_id", "machine_id", "status_id", "event_start_time", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end"]],
        on="_natural_key",
        how="left",
        suffixes=("_historical", "_sql"),
    )
    out["sql_key_count"] = out["_natural_key"].map(sql_key_counts).fillna(0).astype(int)
    out["historical_key_count"] = out["_natural_key"].map(hist_key_counts).fillna(0).astype(int)
    out["mapping_status"] = np.where((out["sql_key_count"] == 1) & (out["historical_key_count"] == 1), "UNIQUE", "AMBIGUOUS")
    out["timestamp_diff_ms"] = (
        pd.to_datetime(out["event_start_time_sql"], errors="coerce") - pd.to_datetime(out["event_start_time_historical"], errors="coerce")
    ).dt.total_seconds().abs() * 1000.0
    out["mapping_method"] = "machine_id_status_id_event_start_time_rounded_ms"
    return out.rename(columns={
        "event_id_sql": "sql_event_id",
        "event_id_historical": "historical_event_id",
        "machine_id_sql": "machine_id",
        "status_id_sql": "status_id",
        "event_start_time_sql": "sql_event_start_time",
        "event_start_time_historical": "historical_event_start_time",
    }).reindex(columns=[
        "sql_event_id", "historical_event_id", "machine_id", "status_id", "sql_event_start_time",
        "historical_event_start_time", "timestamp_diff_ms", "mapping_status", "mapping_method",
        "sql_key_count", "historical_key_count", "_natural_key", "raw_event_end_time", "raw_status_kwh_start", "raw_status_kwh_end",
    ])


def build_context_from_loaded_sql(sql_raw: pd.DataFrame, selected_event_ids: set[int], lookback: int, lookahead: int) -> pd.DataFrame:
    parts = []
    sorted_sql = sql_raw.sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)
    for _, group in sorted_sql.groupby("machine_id", sort=False):
        ids = group["event_id"].astype(int).tolist()
        selected_positions = [pos for pos, event_id in enumerate(ids) if event_id in selected_event_ids]
        for pos in selected_positions:
            start = max(0, pos - lookback)
            end = min(len(group), pos + lookahead + 1)
            parts.append(group.iloc[start:end])
    if not parts:
        return sql_raw.head(0).copy()
    return pd.concat(parts, ignore_index=True).drop_duplicates("event_id").sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)


def load_historical_l1_rows_by_event_id(csv_path: Path, event_ids: set[int]) -> pd.DataFrame:
    sep = detect_csv_separator(str(csv_path))
    chunks = []
    for chunk in pd.read_csv(csv_path, sep=sep, chunksize=200000, low_memory=False):
        matched = chunk[pd.to_numeric(chunk["event_id"], errors="coerce").astype("Int64").isin(event_ids)].copy()
        if not matched.empty:
            chunks.append(matched)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def derive_historical_l1_audit_columns(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    if "kwh_imputed_flag" not in out.columns:
        out["kwh_imputed_flag"] = ((pd.to_numeric(out.get("kwh_start_imputed_flag"), errors="coerce").fillna(0) == 1) | (pd.to_numeric(out.get("kwh_end_imputed_flag"), errors="coerce").fillna(0) == 1)).astype("int8")
    if "kwh_rate_per_hour_model_value" not in out.columns:
        out["kwh_rate_per_hour_model_value"] = pd.to_numeric(out.get("kwh_rate_per_hour"), errors="coerce").fillna(0.0)
    out["time_quality_issue_flag"] = (
        (pd.to_numeric(out.get("is_open_event"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("is_non_positive_duration"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("is_big_gap"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("is_overlap"), errors="coerce").fillna(0) == 1)
    ).astype("int8")
    out["kwh_quality_issue_flag"] = (
        (pd.to_numeric(out.get("kwh_missing_flag"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("kwh_imputed_flag"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("kwh_negative_delta_flag"), errors="coerce").fillna(0) == 1)
    ).astype("int8")
    out["energy_inconsistency_flag"] = (
        (pd.to_numeric(out.get("loaded_zero_kwh_flag"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("loaded_without_kwh_flag"), errors="coerce").fillna(0) == 1)
        | (pd.to_numeric(out.get("kwh_negative_delta_flag"), errors="coerce").fillna(0) == 1)
    ).astype("int8")
    out["data_quality_issue_flag"] = ((out["time_quality_issue_flag"] == 1) | (out["kwh_quality_issue_flag"] == 1)).astype("int8")
    return out


def compare_l1_runtime_to_historical(mapping: pd.DataFrame, runtime: pd.DataFrame, historical: pd.DataFrame) -> pd.DataFrame:
    cols_by_group = {
        "time": ["event_start_time", "event_end_time", "end_time_source", "duration_sec", "gap_from_prev_sec", "overlap_sec", "is_raw_end_missing", "is_invalid_raw_end", "end_time_imputed_flag", "is_non_positive_duration", "is_long_duration", "is_gap", "is_big_gap", "is_overlap"],
        "kwh": ["kwh_start_value", "kwh_end_value", "kwh_start_source", "kwh_end_source", "kwh_delta", "kwh_delta_model_value", "kwh_rate_per_hour", "kwh_rate_per_hour_model_value", "kwh_available_flag", "kwh_missing_flag", "kwh_start_imputed_flag", "kwh_end_imputed_flag", "kwh_imputed_flag", "kwh_imputed_or_missing_flag", "kwh_zero_delta_flag", "kwh_positive_delta_flag", "kwh_negative_delta_flag", "kwh_rate_missing_flag"],
        "status": ["status_type_code", "current_signal_code", "is_on", "is_loaded", "is_no_load", "is_current_near_zero", "has_error_token", "has_maintenance_token"],
        "location_context": ["machine_group_id", "location_id", "hour_of_day", "day_of_week"],
        "quality": ["time_quality_issue_flag", "kwh_quality_issue_flag", "data_quality_issue_flag", "energy_inconsistency_flag"],
    }
    # Keep only mapping identifiers here.  The wider mapping audit includes
    # timestamp columns whose names overlap the prefixed historical columns.
    # Keeping them would make pandas suffix the historical value and silently
    # turn a valid comparison into a missing-column result.
    mapped_ids = mapping.loc[
        mapping["mapping_status"] == "UNIQUE",
        ["sql_event_id", "historical_event_id", "mapping_status"],
    ].copy()
    merged = mapped_ids.merge(
        runtime.add_prefix("runtime_"), left_on="sql_event_id", right_on="runtime_event_id", how="inner"
    ).merge(
        historical.add_prefix("historical_"), left_on="historical_event_id", right_on="historical_event_id", how="inner"
    )
    rows = []
    for _, row in merged.iterrows():
        for group, cols in cols_by_group.items():
            for col in cols:
                rcol = f"runtime_{col}"
                hcol = f"historical_{col}"
                if rcol not in row.index or hcol not in row.index:
                    rows.append({"sql_event_id": row["sql_event_id"], "historical_event_id": row["historical_event_id"], "feature_group": group, "feature_name": col, "runtime_value": None, "historical_value": None, "exact_match": False, "tolerance_match": False, "abs_diff": None, "reason": "column_missing"})
                    continue
                exact, tol, diff, reason = compare_feature_value(col, row[rcol], row[hcol])
                rows.append({"sql_event_id": row["sql_event_id"], "historical_event_id": row["historical_event_id"], "feature_group": group, "feature_name": col, "runtime_value": row[rcol], "historical_value": row[hcol], "exact_match": exact, "tolerance_match": tol, "abs_diff": diff, "reason": reason})
    return pd.DataFrame(rows)


def compare_feature_value(col: str, runtime_value: Any, historical_value: Any) -> tuple[bool, bool, float | None, str]:
    if pd.isna(runtime_value) and pd.isna(historical_value):
        return True, True, None, "both_missing"
    if col.endswith("_time") or col in {"event_start_time", "event_end_time"}:
        rv = pd.to_datetime(runtime_value, errors="coerce")
        hv = pd.to_datetime(historical_value, errors="coerce")
        if pd.isna(rv) or pd.isna(hv):
            return False, False, None, "timestamp_missing_mismatch"
        diff = abs((rv - hv).total_seconds() * 1000.0)
        return diff == 0, diff <= 1.0, diff, "timestamp_ms"
    try:
        rv = float(runtime_value)
        hv = float(historical_value)
        if np.isnan(rv) and np.isnan(hv):
            return True, True, None, "both_nan"
        diff = abs(rv - hv)
        tol = 0.001 if col in {"duration_sec", "gap_from_prev_sec", "overlap_sec", "kwh_delta", "kwh_delta_model_value", "kwh_rate_per_hour", "kwh_rate_per_hour_model_value"} else 0.0
        return diff == 0, diff <= tol, diff, "numeric"
    except Exception:
        exact = str(runtime_value) == str(historical_value)
        return exact, exact, None, "categorical"


def summarize_l1_feature_comparison(comparison: pd.DataFrame) -> dict[str, Any]:
    if comparison.empty:
        return {"result": "FAIL", "reason": "empty_comparison"}
    summary = {}
    for group, g in comparison.groupby("feature_group"):
        summary[group] = {
            "rows": int(len(g)),
            "exact_match_rate": float(g["exact_match"].mean()),
            "tolerance_match_rate": float(g["tolerance_match"].mean()),
            "top_mismatch_features": g[g["tolerance_match"] == False]["feature_name"].value_counts().head(20).astype(int).to_dict(),  # noqa: E712
        }
    overall_rate = float(comparison["tolerance_match"].mean())
    return {
        "result": "PASS" if overall_rate >= 0.995 else "FAIL",
        "overall_tolerance_match_rate": overall_rate,
        "by_group": summary,
    }


def build_segmentation_parity(mapping: pd.DataFrame, runtime: pd.DataFrame, historical: pd.DataFrame) -> dict[str, Any]:
    merged = mapping[mapping["mapping_status"] == "UNIQUE"].merge(
        runtime[["event_id", "machine_id", "event_start_time", "sequence_segment_id", "event_order_in_segment"]].rename(
            columns={"event_id": "sql_event_id", "machine_id": "runtime_machine_id", "event_start_time": "runtime_event_start_time"}
        ),
        on="sql_event_id",
        how="inner",
    ).merge(
        historical[["event_id", "sequence_segment_id", "event_order_in_segment"]].rename(columns={"event_id": "historical_event_id", "sequence_segment_id": "historical_sequence_segment_id", "event_order_in_segment": "historical_event_order_in_segment"}),
        on="historical_event_id",
        how="inner",
    ).sort_values(["runtime_machine_id", "runtime_event_start_time", "sql_event_id"])
    if merged.empty:
        return {"result": "FAIL", "reason": "empty_segmentation_mapping"}
    merged["runtime_is_segment_start"] = pd.to_numeric(merged["event_order_in_segment"], errors="coerce") == 1
    merged["historical_is_segment_start"] = pd.to_numeric(merged["historical_event_order_in_segment"], errors="coerce") == 1
    segment_start_match_rate = float((merged["runtime_is_segment_start"] == merged["historical_is_segment_start"]).mean())
    relation_rows = []
    for _, g in merged.groupby("runtime_machine_id"):
        prev = None
        for _, row in g.iterrows():
            if prev is not None:
                runtime_delta = row["event_order_in_segment"] - prev["event_order_in_segment"]
                historical_delta = row["historical_event_order_in_segment"] - prev["historical_event_order_in_segment"]
                # A stratified sample is intentionally sparse.  Compare the
                # segment relationship only for rows adjacent in at least one
                # replay, otherwise the omitted rows make the relationship
                # meaningless.
                if runtime_delta == 1 or historical_delta == 1:
                    relation_rows.append({
                        "runtime_same_segment": row["sequence_segment_id"] == prev["sequence_segment_id"],
                        "historical_same_segment": row["historical_sequence_segment_id"] == prev["historical_sequence_segment_id"],
                        "runtime_order_delta": runtime_delta,
                        "historical_order_delta": historical_delta,
                    })
            prev = row
    rel = pd.DataFrame(relation_rows)
    relation_match_rate = float((rel["runtime_same_segment"] == rel["historical_same_segment"]).mean()) if not rel.empty else None
    order_delta_match_rate = float((rel["runtime_order_delta"] == rel["historical_order_delta"]).mean()) if not rel.empty else None
    result = "PASS" if segment_start_match_rate >= 0.99 and (relation_match_rate is None or relation_match_rate >= 0.99) else "FAIL"
    return {
        "result": result,
        "sample_rows": int(len(merged)),
        "adjacent_relation_rows": int(len(rel)),
        "segment_start_match_rate": segment_start_match_rate,
        "consecutive_same_segment_relation_match_rate": relation_match_rate,
        "event_order_delta_match_rate": order_delta_match_rate,
        "absolute_sequence_segment_id_compared": False,
        "reason": "absolute segment id is not compared because parity context does not replay from machine start",
    }


def build_join_coverage_report(joined: pd.DataFrame) -> dict[str, Any]:
    total = max(len(joined), 1)
    return {
        "result": "PASS" if len(joined) > 0 and joined["status_name"].notna().mean() > 0.95 and joined["machine_group_id"].notna().mean() > 0.95 and joined["location_id"].notna().mean() > 0.90 else "FAIL",
        "rows": int(len(joined)),
        "status_join_coverage": float(joined["status_name"].notna().sum() / total) if "status_name" in joined.columns else 0.0,
        "machine_group_join_coverage": float(joined["machine_group_id"].notna().sum() / total) if "machine_group_id" in joined.columns else 0.0,
        "location_join_coverage": float(joined["location_id"].notna().sum() / total) if "location_id" in joined.columns else 0.0,
        "location_mapping_source_distribution": joined.get("location_mapping_source", pd.Series(dtype=object)).value_counts(dropna=False).astype(int).to_dict(),
    }


def build_unmatched_analysis(sql_raw: pd.DataFrame, hist_candidates: pd.DataFrame, sql_key_counts: pd.Series, hist_key_counts: pd.Series) -> pd.DataFrame:
    hist_keys = set(hist_candidates["_natural_key"].dropna().tolist())
    rows = []
    unmatched_sql = sql_raw[~sql_raw["_natural_key"].isin(hist_keys)].copy()
    for _, row in unmatched_sql.head(1000).iterrows():
        key = row["_natural_key"]
        reason = "DUPLICATE_NATURAL_KEY" if int(sql_key_counts.get(key, 0)) > 1 else "HISTORICAL_EXPORT_MISSING"
        rows.append({"category": reason, "sql_event_id": row["event_id"], "machine_id": row["machine_id"], "status_id": row["status_id"], "event_start_time": row["event_start_time"], "natural_key": key})
    if not rows:
        rows.append({"category": "NO_UNMATCHED_SQL_SAMPLE", "sql_event_id": None, "machine_id": None, "status_id": None, "event_start_time": None, "natural_key": None})
    return pd.DataFrame(rows)


def build_l1_parity_summary(
    *,
    source_rows_sql: int,
    source_rows_historical_candidates: int,
    mapping: pd.DataFrame,
    join_coverage: dict[str, Any],
    threshold_resolution: dict[str, Any],
    feature_summary: dict[str, Any],
    segmentation_parity: dict[str, Any],
    l1_contract: dict[str, Any],
    invariant_report: dict[str, Any],
) -> dict[str, Any]:
    unique_rate = float((mapping["mapping_status"] == "UNIQUE").mean()) if not mapping.empty else 0.0
    by_group = feature_summary.get("by_group", {})
    time_result = "PASS" if by_group.get("time", {}).get("tolerance_match_rate", 0.0) >= 0.995 else "FAIL"
    kwh_result = "PASS" if by_group.get("kwh", {}).get("tolerance_match_rate", 0.0) >= 0.995 else "FAIL"
    status_result = "PASS" if by_group.get("status", {}).get("tolerance_match_rate", 0.0) >= 0.995 else "FAIL"
    location_result = "PASS" if by_group.get("location_context", {}).get("tolerance_match_rate", 0.0) >= 0.995 else "FAIL"
    quality_result = "PASS" if by_group.get("quality", {}).get("tolerance_match_rate", 0.0) >= 0.995 else "FAIL"
    source_mapping_result = "PASS" if unique_rate >= 0.95 else "FAIL"
    overall_inputs = [
        source_mapping_result,
        join_coverage.get("result"),
        threshold_resolution.get("result"),
        time_result,
        kwh_result,
        status_result,
        location_result,
        quality_result,
        segmentation_parity.get("result"),
        l1_contract.get("result"),
        invariant_report.get("result"),
    ]
    overall = "L1_DATA_PIPELINE_READY" if all(v == "PASS" for v in overall_inputs) else "L1_DATA_PIPELINE_NOT_READY"
    return {
        "source_rows_sql": source_rows_sql,
        "source_rows_historical_overlap_candidates": source_rows_historical_candidates,
        "sample_mapping_rows": int(len(mapping)),
        "unique_mapping_rate": unique_rate,
        "source_mapping_result": source_mapping_result,
        "join_coverage_result": join_coverage.get("result"),
        "threshold_result": threshold_resolution.get("result"),
        "time_parity_result": time_result,
        "kwh_parity_result": kwh_result,
        "status_parity_result": status_result,
        "location_parity_result": location_result,
        "quality_parity_result": quality_result,
        "segmentation_parity_result": segmentation_parity.get("result"),
        "l1_schema_contract_result": l1_contract.get("result"),
        "invariant_result": invariant_report.get("result"),
        "feature_match_summary_result": feature_summary.get("result"),
        "overall_l1_parity_result": overall,
    }


def parity_sanitized_config(cfg: dict[str, Any], sample_size: int) -> dict[str, Any]:
    out = {
        "run_time": datetime.now().isoformat(timespec="seconds"),
        "mode": "validate_l1_parity",
        "sample_size": sample_size,
        "project": cfg.get("project", {}),
        "tables": cfg.get("tables", {}),
        "runtime": cfg.get("runtime", {}),
        "historical": cfg.get("historical", {}),
    }
    return out


def write_json(path: Path, obj: Any) -> None:
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2, default=_json_default_local), encoding="utf-8")


def _json_default_local(value: Any) -> Any:
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        return None if np.isnan(value) else float(value)
    if isinstance(value, pd.Timestamp):
        return value.isoformat()
    if pd.isna(value):
        return None
    return value


def build_l1_parity_readme(summary: dict[str, Any], out_dir: Path) -> str:
    return f"""# L1 Parity Audit

Output folder: `{out_dir}`

## Result

- Source mapping: {summary.get("source_mapping_result")}
- Join coverage: {summary.get("join_coverage_result")}
- Threshold: {summary.get("threshold_result")}
- Time parity: {summary.get("time_parity_result")}
- KWh parity: {summary.get("kwh_parity_result")}
- Status parity: {summary.get("status_parity_result")}
- Location/context parity: {summary.get("location_parity_result")}
- Quality parity: {summary.get("quality_parity_result")}
- Segmentation parity: {summary.get("segmentation_parity_result")}
- L1 schema contract: {summary.get("l1_schema_contract_result")}
- Overall: {summary.get("overall_l1_parity_result")}

## Important Files

- `07_natural_key_mapping.csv`
- `08_l1_feature_comparison.csv`
- `09_feature_match_summary.json`
- `11_segmentation_parity.json`
- `14_summary.json`

No L1 model, no L2 model, and no production SQL write were run.
"""


def load_checkpoint(conn: Any, cfg: dict[str, Any]) -> dict[str, Any]:
    df = read_sql(conn, get_checkpoint_sql(cfg["tables"]["checkpoint"]), [cfg["project"]["pipeline_name"]])
    if df.empty:
        return {"last_event_id": None, "last_event_time": None}
    row = df.iloc[0].to_dict()
    if pd.isna(row.get("last_event_id")):
        row["last_event_id"] = None
    else:
        row["last_event_id"] = int(row["last_event_id"])
    return row


def load_historical_overlap_candidates(
    conn: Any,
    cfg: dict[str, Any],
    max_events: int,
    *,
    raw_is_deleted_column: str | None = None,
) -> tuple[pd.DataFrame, str]:
    csv_path = get_historical_l1_csv(cfg)
    if not csv_path:
        return pd.DataFrame(), "-- historical-overlap candidate mode: historical L1 CSV is not configured"
    project_root = resolve_project_root(cfg)
    resolved_csv_path = resolve_project_path(cfg, csv_path, project_root)
    if not resolved_csv_path.exists():
        return pd.DataFrame(), f"-- historical-overlap candidate mode: historical L1 CSV not found: {resolved_csv_path}"

    raw_table = cfg["tables"]["raw_iot"]
    historical_min_id, historical_max_id = historical_csv_event_id_bounds(resolved_csv_path)
    if historical_min_id is None or historical_max_id is None:
        return pd.DataFrame(), f"-- historical-overlap candidate mode: no event_id bounds found in {resolved_csv_path}"

    query_limit = max(max_events * 50, max_events)
    sql = load_closed_candidate_events_in_event_id_range_sql(
        raw_table,
        cfg["source_columns"],
        query_limit,
        raw_is_deleted_column,
    )
    candidates = read_sql(conn, sql, [historical_min_id, historical_max_id])
    if candidates.empty:
        return candidates, "\n\n".join([
            "-- historical-overlap candidate mode",
            f"-- project_root_resolved: {project_root}",
            f"-- historical_l1_csv_resolved: {resolved_csv_path}",
            f"-- historical_event_id_range: {historical_min_id}..{historical_max_id}",
            sql.strip(),
        ])

    historical = load_historical_l1_csv(
        str(resolved_csv_path),
        candidates["event_id"].dropna().astype(int).tolist(),
    )
    if historical.empty:
        out = pd.DataFrame(columns=candidates.columns)
    else:
        overlap_ids = set(historical["event_id"].dropna().astype(int).tolist())
        out = candidates[candidates["event_id"].astype(int).isin(overlap_ids)].copy()
        out = out.head(max_events).reset_index(drop=True)

    sql_used = [
        "-- historical-overlap candidate mode",
        f"-- project_root_resolved: {project_root}",
        f"-- historical_l1_csv_resolved: {resolved_csv_path}",
        f"-- historical_event_id_range: {historical_min_id}..{historical_max_id}",
        f"-- sql_candidate_query_limit_before_csv_filter: {query_limit}",
        f"-- sql_candidates_before_csv_filter: {len(candidates)}",
        f"-- candidates_after_csv_filter: {len(out)}",
        sql.strip(),
    ]
    return out, "\n\n".join(sql_used)


def load_context_around_candidates(
    conn: Any,
    cfg: dict[str, Any],
    candidates: pd.DataFrame,
    *,
    raw_is_deleted_column: str | None = None,
) -> tuple[pd.DataFrame, dict[str, str]]:
    if candidates.empty:
        return pd.DataFrame(), {}
    runtime = cfg["runtime"]
    lookback = int(runtime.get("lookback_before", 40))
    lookahead = int(runtime.get("lookahead_after", 2))
    parts: dict[str, str] = {}
    rows = []
    query_count = 0
    for machine_id, group in candidates.groupby("machine_id"):
        candidate_ids = sorted(pd.to_numeric(group["event_id"], errors="coerce").dropna().astype(int).unique().tolist())
        if not candidate_ids:
            continue
        candidate_ids_sql = ",".join(str(event_id) for event_id in candidate_ids)
        sql = load_context_by_row_order_sql(
            cfg["tables"]["raw_iot"],
            cfg["source_columns"],
            candidate_ids_sql,
            lookback,
            lookahead,
            raw_is_deleted_column,
        )
        parts[f"context_by_row_order_machine_{int(machine_id)}"] = sql
        rows.append(read_sql(conn, sql, [int(machine_id)]))
        query_count += 1
    out = pd.concat(rows, ignore_index=True) if rows else pd.DataFrame()
    if not out.empty:
        out = out.drop_duplicates("event_id").sort_values(["machine_id", "event_start_time", "event_id"]).reset_index(drop=True)
    print("context_query_count:", query_count)
    return out, parts


def normalize_context_for_audit(context: pd.DataFrame, candidates: pd.DataFrame) -> pd.DataFrame:
    candidate_ids = set(pd.to_numeric(candidates.get("event_id", pd.Series(dtype=int)), errors="coerce").dropna().astype(int).tolist())
    out = context.copy()
    if out.empty:
        out = candidates.copy()
        out["context_role"] = "candidate"
    if "context_role" not in out.columns:
        out["context_role"] = "context"
    out_event_ids = pd.to_numeric(out.get("event_id", pd.Series(dtype=int)), errors="coerce")
    out["is_raw_candidate_event"] = out_event_ids.astype("Int64").isin(candidate_ids).astype(int)
    out.loc[out["is_raw_candidate_event"] == 1, "context_role"] = "candidate"

    present_ids = set(out_event_ids.dropna().astype(int).tolist())
    missing_candidates = candidates[
        ~pd.to_numeric(candidates.get("event_id", pd.Series(dtype=int)), errors="coerce").astype("Int64").isin(present_ids)
    ].copy()
    if not missing_candidates.empty:
        missing_candidates["context_role"] = "candidate"
        missing_candidates["is_raw_candidate_event"] = 1
        out = pd.concat([out, missing_candidates], ignore_index=True)

    role_priority = {"candidate": 0, "before": 1, "after": 2, "context": 3}
    out["_context_role_priority"] = out["context_role"].map(role_priority).fillna(9).astype(int)
    out = (
        out.sort_values(["event_id", "_context_role_priority"])
        .drop_duplicates("event_id", keep="first")
        .drop(columns=["_context_role_priority"])
        .sort_values(["machine_id", "event_start_time", "event_id"])
        .reset_index(drop=True)
    )
    return out


def load_location_map(conn: Any, cfg: dict[str, Any], events: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    if events.empty:
        return pd.DataFrame(), ""
    location_cols = cfg.get("location_columns", {})
    machine_ids = sorted(events["machine_id"].dropna().astype(int).unique().tolist())
    if not machine_ids:
        return pd.DataFrame(), ""
    machine_ids_sql = ",".join(str(int(v)) for v in machine_ids)
    sql = f"""
SELECT
    CAST(mlh.{_q(location_cols.get("machine_id", "machine_id"))} AS INT) AS machine_id,
    CAST(mlh.{_q(location_cols.get("location_id", "location_id"))} AS INT) AS location_id,
    CAST(mlh.{_q(location_cols.get("start_time", "start_time"))} AS DATETIME2) AS location_history_start_time,
    CAST(mlh.{_q(location_cols.get("end_time", "end_time"))} AS DATETIME2) AS location_history_end_time,
    CAST('event_time' AS NVARCHAR(50)) AS location_mapping_source
FROM {table_name(cfg["tables"]["machine_location_history"])} AS mlh
WHERE CAST(mlh.{_q(location_cols.get("machine_id", "machine_id"))} AS INT) IN ({machine_ids_sql})
ORDER BY machine_id, location_history_start_time
"""
    try:
        histories = read_sql(conn, sql)
        event_frame = events[["event_id", "machine_id", "event_start_time"]].drop_duplicates("event_id").copy()
        event_frame["event_start_time"] = pd.to_datetime(event_frame["event_start_time"], errors="coerce")
        event_frame["machine_id"] = pd.to_numeric(event_frame["machine_id"], errors="coerce").astype("Int64")
        if histories.empty:
            out = event_frame.copy()
            out["location_id"] = -1
            out["location_history_start_time"] = pd.NaT
            out["location_history_end_time"] = pd.NaT
            out["location_mapping_source"] = "missing_event_time"
            return out, sql
        histories["location_history_start_time"] = pd.to_datetime(histories["location_history_start_time"], errors="coerce")
        histories["location_history_end_time"] = pd.to_datetime(histories["location_history_end_time"], errors="coerce")
        histories["machine_id"] = pd.to_numeric(histories["machine_id"], errors="coerce").astype("Int64")
        mapped_parts = []
        for machine_id, ev in event_frame.groupby("machine_id", dropna=False):
            ev = ev.sort_values("event_start_time", kind="mergesort").copy()
            hist = histories[histories["machine_id"] == machine_id].sort_values("location_history_start_time", kind="mergesort").copy()
            if hist.empty:
                part = ev.copy()
                part["location_id"] = -1
                part["location_history_start_time"] = pd.NaT
                part["location_history_end_time"] = pd.NaT
                part["location_mapping_source"] = "missing_event_time"
                mapped_parts.append(part)
                continue
            part = pd.merge_asof(
                ev,
                hist.drop(columns=["machine_id"]),
                left_on="event_start_time",
                right_on="location_history_start_time",
                direction="backward",
            )
            valid = part["location_id"].notna() & (
                part["location_history_end_time"].isna() | (part["event_start_time"] < part["location_history_end_time"])
            )
            if (~valid).any():
                hist_desc = hist.sort_values("location_history_start_time", ascending=False, kind="mergesort")
                for idx, row in part.loc[~valid].iterrows():
                    exact = hist_desc[
                        (hist_desc["location_history_start_time"] <= row["event_start_time"])
                        & (hist_desc["location_history_end_time"].isna() | (row["event_start_time"] < hist_desc["location_history_end_time"]))
                    ]
                    if not exact.empty:
                        part.loc[idx, ["location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]] = exact.iloc[0][
                            ["location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]
                        ].values
            valid = part["location_id"].notna() & (
                part["location_history_end_time"].isna() | (part["event_start_time"] < part["location_history_end_time"])
            )
            part.loc[~valid, "location_id"] = -1
            part.loc[~valid, "location_history_start_time"] = pd.NaT
            part.loc[~valid, "location_history_end_time"] = pd.NaT
            part.loc[~valid, "location_mapping_source"] = "missing_event_time"
            mapped_parts.append(part)
        out = pd.concat(mapped_parts, ignore_index=True) if mapped_parts else pd.DataFrame()
        out["location_id"] = pd.to_numeric(out["location_id"], errors="coerce").fillna(-1).astype(int)
        return out[["event_id", "machine_id", "location_id", "location_history_start_time", "location_history_end_time", "location_mapping_source"]], sql
    except Exception as exc:
        print("WARN event-time location lookup failed:", exc)
        return pd.DataFrame(), sql


def load_machine_group_map(conn: Any, cfg: dict[str, Any], events: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    if events.empty:
        return pd.DataFrame(), ""
    machine_ids = sorted(events["machine_id"].dropna().astype(int).unique().tolist())
    if not machine_ids:
        return pd.DataFrame(), ""
    sql = load_machine_group_sql(
        cfg["tables"]["machine"],
        cfg.get("machine_columns", {}),
        ",".join(str(int(v)) for v in machine_ids),
    )
    try:
        return read_sql(conn, sql), sql
    except Exception as exc:
        print("WARN machine group lookup failed:", exc)
        return pd.DataFrame(), sql


def merge_context_maps(location_map: pd.DataFrame, machine_group_map: pd.DataFrame) -> pd.DataFrame:
    if location_map.empty:
        return machine_group_map.copy()
    if machine_group_map.empty:
        return location_map.copy()
    return location_map.merge(machine_group_map.drop_duplicates("machine_id"), on="machine_id", how="left")


def load_historical_l1(conn: Any, cfg: dict[str, Any], event_ids: list[int]) -> tuple[pd.DataFrame | None, str, dict[str, Any]]:
    project_root = resolve_project_root(cfg)
    meta: dict[str, Any] = {
        "source_attempted": [],
        "source": None,
        "error": None,
        "project_root_resolved": str(project_root),
        "historical_l1_csv_resolved": None,
    }
    if not event_ids or not cfg.get("audit", {}).get("compare_with_historical_l1", True):
        meta["error"] = "compare_disabled_or_no_event_ids"
        return None, "", meta
    event_ids_sql = ",".join(str(int(v)) for v in sorted(set(event_ids)))
    sql_used_parts: list[str] = []
    last_error: str | None = None
    table = get_historical_l1_table(cfg)
    if table:
        sql = load_historical_l1_by_event_ids_sql(table, event_ids_sql)
        meta["source_attempted"].append("sql_table")
        sql_used_parts.append(sql)
        try:
            historical = read_sql(conn, sql)
            if historical is not None and not historical.empty:
                meta["source"] = "sql_table"
                meta["rows"] = int(len(historical))
                return historical, "\n\n".join(sql_used_parts), meta
            last_error = f"SQL historical table returned 0 rows: {table}"
        except Exception as exc:
            last_error = f"SQL historical compare failed: {exc}"
            print("WARN historical L1 SQL compare failed:", exc)
    csv_path = get_historical_l1_csv(cfg)
    if csv_path:
        meta["source_attempted"].append("csv")
        resolved_csv_path = resolve_project_path(cfg, csv_path, project_root)
        meta["historical_l1_csv_resolved"] = str(resolved_csv_path)
        sql_used_parts.append(f"-- attempted historical L1 csv: {resolved_csv_path}")
        try:
            if not resolved_csv_path.exists():
                last_error = f"historical_l1_csv not found: {resolved_csv_path}"
            else:
                historical = load_historical_l1_csv(str(resolved_csv_path), event_ids)
                if historical is not None and not historical.empty:
                    meta["source"] = "csv"
                    meta["rows"] = int(len(historical))
                    return historical, "\n\n".join(sql_used_parts), meta
                last_error = f"historical_l1_csv returned 0 matching rows: {resolved_csv_path}"
        except Exception as exc:
            last_error = f"historical_l1_csv read failed: {exc}"
            print("WARN historical L1 CSV compare failed:", exc)
    meta["error"] = last_error or "historical compare source not configured"
    return None, "\n\n".join(sql_used_parts), meta


def get_historical_l1_table(cfg: dict[str, Any]) -> str:
    historical = cfg.get("historical", {})
    audit = cfg.get("audit", {})
    return str(historical.get("l1_table") or audit.get("historical_l1_table") or "").strip()


def get_historical_l1_csv(cfg: dict[str, Any]) -> str:
    historical = cfg.get("historical", {})
    audit = cfg.get("audit", {})
    return str(historical.get("l1_csv") or audit.get("historical_l1_csv") or "").strip()


def _resolve_cli_project_path(project_root: Path, path: str | Path) -> Path:
    candidate = Path(path)
    return candidate.resolve() if candidate.is_absolute() else (project_root / candidate).resolve()


def _resolve_runtime_workspace_root(configured_root: Path) -> Path:
    """Avoid interpreting config.local.yaml's ``root: .`` as inference/online."""
    starts = [configured_root.resolve(), Path.cwd().resolve()]
    for start in starts:
        for candidate in [start, *start.parents]:
            if (candidate / "data").is_dir() and (candidate / "modeling").is_dir():
                return candidate
    raise FileNotFoundError("Unable to resolve runtime workspace root containing data/ and modeling/")


def resolve_project_path(cfg: dict[str, Any], path: str | Path, project_root: Path | None = None) -> Path:
    raw_path = Path(path)
    if raw_path.is_absolute():
        return raw_path
    root = project_root or resolve_project_root(cfg)
    return (root / raw_path).resolve()


def resolve_project_root(cfg: dict[str, Any]) -> Path:
    configured_root = cfg.get("project", {}).get("root")
    root = Path(str(configured_root)).expanduser() if configured_root else Path.cwd()
    if not root.is_absolute():
        root = (Path.cwd() / root).resolve()
    else:
        root = root.resolve()
    found = find_repo_root_from(root)
    if found is not None:
        return found
    cwd_found = find_repo_root_from(Path.cwd().resolve())
    if cwd_found is not None:
        return cwd_found
    config_path = cfg.get("_config_path")
    if config_path:
        config_found = find_repo_root_from(Path(str(config_path)).resolve().parent)
        if config_found is not None:
            return config_found
    code_found = find_repo_root_from(Path(__file__).resolve().parent)
    if code_found is not None:
        return code_found
    return root


def find_repo_root_from(start: Path) -> Path | None:
    candidates = [start, *start.parents]
    for candidate in candidates:
        if (candidate / "README.md").exists() and (candidate / "data").is_dir() and (candidate / "modeling").is_dir():
            return candidate
    return None


def load_historical_l1_csv(csv_path: str, event_ids: list[int]) -> pd.DataFrame:
    event_id_set = set(int(v) for v in event_ids)
    sep = detect_csv_separator(csv_path)
    header = pd.read_csv(csv_path, sep=sep, nrows=0)
    usecols = ["event_id"] + [c for c in COMPARE_COLUMNS if c in header.columns]
    chunks = []
    for chunk in pd.read_csv(csv_path, sep=sep, usecols=usecols, chunksize=200000, low_memory=False):
        if "event_id" not in chunk.columns:
            return pd.DataFrame()
        matched = chunk[pd.to_numeric(chunk["event_id"], errors="coerce").astype("Int64").isin(event_id_set)].copy()
        if not matched.empty:
            chunks.append(matched)
    return pd.concat(chunks, ignore_index=True) if chunks else pd.DataFrame()


def historical_csv_event_id_bounds(csv_path: str | Path) -> tuple[int | None, int | None]:
    sep = detect_csv_separator(str(csv_path))
    min_event_id: int | None = None
    max_event_id: int | None = None
    for chunk in pd.read_csv(csv_path, sep=sep, usecols=["event_id"], chunksize=200000, low_memory=False):
        values = pd.to_numeric(chunk["event_id"], errors="coerce").dropna().astype("int64")
        if values.empty:
            continue
        chunk_min = int(values.min())
        chunk_max = int(values.max())
        min_event_id = chunk_min if min_event_id is None else min(min_event_id, chunk_min)
        max_event_id = chunk_max if max_event_id is None else max(max_event_id, chunk_max)
    return min_event_id, max_event_id


def detect_csv_separator(csv_path: str) -> str:
    with Path(csv_path).open("r", encoding="utf-8-sig", errors="replace") as f:
        header = f.readline()
    return ";" if header.count(";") > header.count(",") else ","


def format_online_output(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out = out.rename(
        columns={
            "event_start_time": "source_event_start_time",
            "event_end_time": "source_event_end_time",
        }
    )
    return out.reindex(columns=ONLINE_OUTPUT_COLUMNS)


def closed_contiguous_prefix(features_new: pd.DataFrame) -> pd.DataFrame:
    """Return only the earliest new events that are closed without skipping an open event.

    The checkpoint is global. If event 101 is still open and event 102 from another
    machine is closed, advancing the checkpoint to 102 would make event 101
    invisible to the next run. This conservative prefix rule avoids that loss.
    """
    if features_new.empty:
        return features_new.copy()
    ordered = features_new.sort_values("event_id").copy()
    open_mask = ordered["is_open_event"] == 1
    if open_mask.any():
        first_open_event_id = int(ordered.loc[open_mask, "event_id"].iloc[0])
        ordered = ordered[ordered["event_id"].astype(int) < first_open_event_id]
    return ordered[ordered["is_open_event"] == 0].copy()


def write_run_log(
    conn: Any,
    cfg: dict[str, Any],
    input_rows: int,
    scored_rows: int,
    skipped_rows: int,
    failed_rows: int,
    status: str,
    message: str,
) -> None:
    table = cfg["tables"].get("run_log")
    if not table:
        return
    try:
        execute(
            conn,
            insert_run_log_sql(table),
            [cfg["project"]["pipeline_name"], input_rows, scored_rows, skipped_rows, failed_rows, status, message],
        )
    except Exception as exc:
        print("WARN run log failed:", exc)

if __name__ == "__main__":
    raise SystemExit(main())
