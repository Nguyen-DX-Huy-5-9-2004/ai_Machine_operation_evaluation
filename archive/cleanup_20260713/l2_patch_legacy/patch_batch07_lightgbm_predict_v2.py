from __future__ import annotations

from pathlib import Path
import re


NEW_PREPARE_X = """def prepare_X(chunk: pd.DataFrame, features: List[str], categorical_columns: List[str], backend: str) -> np.ndarray:
    # Prepare feature matrix for production inference.
    #
    # Fix:
    # LightGBM sklearn model can fail during chunked prediction when pandas
    # category metadata differs from the training metadata:
    #     ValueError: train and valid dataset categorical_feature do not match.
    #
    # In this project, categorical-like features are already integer-coded
    # (status_id, hour_of_day, location_id, machine_group_id, ...), so for
    # inference we pass a plain numpy float32 matrix in the exact trained
    # feature order.
    X = chunk.copy()
    ensure_columns(X, features, fill=0.0)
    X = X[features].copy()

    for c in features:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)

    return X.to_numpy(dtype=np.float32, copy=False)
"""


def main() -> int:
    script_path = Path(__file__).resolve().parent / "score_l2_production.py"
    if not script_path.exists():
        raise FileNotFoundError(script_path)

    original = script_path.read_text(encoding="utf-8")
    text = original

    if "import numpy as np" not in text:
        text = text.replace("import pandas as pd\n", "import pandas as pd\nimport numpy as np\n")

    pattern = re.compile(
        r"def prepare_X\(.*?\n"
        r"(?=def predict_binary\()",
        re.DOTALL,
    )

    text, n = pattern.subn(NEW_PREPARE_X + "\n\n", text, count=1)
    if n != 1:
        raise RuntimeError("Không patch được prepare_X. Hãy kiểm tra lại score_l2_production.py.")

    text = text.replace(
        "def predict_binary(model: Any, X: pd.DataFrame) -> np.ndarray:",
        "def predict_binary(model: Any, X: Any) -> np.ndarray:",
    )

    has_category_double = "astype(\"category\")" in text
    has_category_single = "astype('category')" in text
    if has_category_double or has_category_single:
        raise RuntimeError("Patch chưa sạch: vẫn còn astype(category) trong score_l2_production.py.")
    if "to_numpy(dtype=np.float32" not in text:
        raise RuntimeError("Patch chưa sạch: chưa thấy to_numpy(dtype=np.float32).")

    backup = script_path.with_suffix(".py.bak_before_batch07_fix_v2")
    backup.write_text(original, encoding="utf-8")
    script_path.write_text(text, encoding="utf-8")

    print("Patched successfully:", script_path)
    print("Backup created      :", backup)
    print("Check:")
    print("  has numpy matrix return =", "to_numpy(dtype=np.float32" in text)
    print("  has pandas category     =", has_category_double or has_category_single)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
