from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def test_l2_confidence_uses_precomputed_dominant_risk_before_aggregating() -> None:
    source = (ROOT / "backend" / "app" / "repositories" / "dashboard.py").read_text(encoding="utf-8")
    assert "WITH ready_l2 AS" in source
    assert "FROM ready_l2" in source
    assert "AVG(CAST(dominant_risk AS FLOAT))" in source
