from __future__ import annotations

from pathlib import Path

import nbformat


NOTEBOOK = Path("modeling/l1_tcn/notebooks/OBAD_L1_Candidate_C_Evaluation_Colab.ipynb")
HISTORICAL_NOTEBOOK = Path("modeling/l1_tcn/notebooks/OBAD_L1_Candidate_C_Colab.ipynb")


def test_candidate_c_evaluation_notebook_is_valid_and_read_only():
    notebook = nbformat.read(NOTEBOOK, as_version=4)
    assert notebook.nbformat == 4
    # The read-only notebook has 13 required cells. Users may append optional
    # diagnostics/reporting cells without changing the protected workflow.
    assert len(notebook.cells) >= 13
    source = "\n".join(cell.source for cell in notebook.cells)

    assert "OBAD L1 Candidate C - A/B/C Evaluation Only" in source
    assert "run_candidate_c_colab.py', 'evaluate'" in source
    for token in ("--candidate-package-dir", "--candidate-artifact-dir", "--adaptation-audit-dir"):
        assert token in source
    assert "candidate_abc_scores.parquet" in source
    assert "EVALUATION_OUTPUT_CONTRACT_FAILED" in source
    assert "make_archive" in source
    assert "prepare-l1-retrain-candidate" not in source
    assert "--export-l1-candidate-source-snapshot" not in source
    assert "pyodbc" not in source
    assert "--l1-shadow-audit" not in source
    assert HISTORICAL_NOTEBOOK.exists()


def test_candidate_c_evaluation_notebook_has_numbered_cell_contract():
    notebook = nbformat.read(NOTEBOOK, as_version=4)
    for number, cell in enumerate(notebook.cells[:13], start=1):
        assert f"Cell {number}" in cell.source
