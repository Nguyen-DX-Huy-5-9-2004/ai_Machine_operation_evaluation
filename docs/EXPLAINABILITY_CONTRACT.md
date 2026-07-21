# Explainability Contract

Runtime explanations are deterministic evidence formatting from already computed model and policy outputs. They are not LLM output and not SHAP.

`methodology = POLICY_EVIDENCE_CONTRIBUTION` and `notShap = true` are mandatory.

## Four Stages

1. `l1Activation`: window readiness, Candidate A lenient/strict raw and normalized scores, thresholds, margins, behavior anomaly and strict-only audit warning.
2. `l2Risks`: all six probabilities, production thresholds, predictions, margins, selected profile and run.
3. `qualityAndEvidence`: status evidence, time/gap/overlap, event-level KWh evidence and quality flags.
4. `policyDecision`: operational and quality actions, final reason, exact triggered/suppressed rules, readiness and policy version.

`is_behavior_anomaly` is lenient anomaly only. Strict-only (`strict AND NOT lenient`) is included in `suppressedReasons` as `STRICT_ONLY_AUDIT_NO_ACTION_UPLIFT`; it never raises action.

## Contribution Method

Positive evidence weights are deterministic: L1 normalized margin above 1, each L2 probability margin above its production threshold, known status evidence, energy/data-quality evidence and time/gap evidence. Positive values are normalized to 100%. An empty list means no supporting positive evidence was available. These percentages explain decision evidence and never alter model score or policy.

Historical records are formatted from stored columns only. Missing L1/L2 details remain null/unavailable; the backend does not recompute historical model output or invent explanations.

