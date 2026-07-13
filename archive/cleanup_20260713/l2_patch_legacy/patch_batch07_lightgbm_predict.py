from __future__ import annotations

from pathlib import Path
import re


def main() -> int:
    script_path = Path(__file__).resolve().parent / 'score_l2_production.py'
    if not script_path.exists():
        raise FileNotFoundError(script_path)

    original = script_path.read_text(encoding='utf-8')
    text = original

    old_prepare = '''def prepare_X(
    chunk: pd.DataFrame,
    features: List[str],
    categorical_columns: List[str],
    backend: str,
) -> pd.DataFrame:
    X = chunk.copy()
    ensure_columns(X, features, fill=0.0)
    X = X[features].copy()

    for c in features:
        if c in categorical_columns and c in X.columns and backend == "lightgbm":
            X[c] = X[c].astype("category")
        elif c in X.columns:
            X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)

    return X
'''

    new_prepare = '''def prepare_X(
    chunk: pd.DataFrame,
    features: List[str],
    categorical_columns: List[str],
    backend: str,
) -> np.ndarray:
    # Prepare feature matrix for inference.
    # LightGBM sklearn models trained with pandas categorical columns can raise:
    # ValueError: train and valid dataset categorical_feature do not match.
    # To avoid pandas category metadata mismatch across chunks, production scoring
    # passes a plain numpy float32 matrix in the exact profile feature order.
    # Categorical-like features in this project are already integer-coded.
    X = chunk.copy()
    ensure_columns(X, features, fill=0.0)
    X = X[features].copy()

    for c in features:
        X[c] = pd.to_numeric(X[c], errors="coerce").fillna(0.0)

    return X.to_numpy(dtype=np.float32, copy=False)
'''

    if old_prepare in text:
        text = text.replace(old_prepare, new_prepare)
    else:
        pattern = re.compile(
            r'def prepare_X\(\n'
            r'    chunk: pd\.DataFrame,\n'
            r'    features: List\[str\],\n'
            r'    categorical_columns: List\[str\],\n'
            r'    backend: str,\n'
            r'\) -> pd\.DataFrame:\n'
            r'.*?\n    return X\n',
            re.DOTALL,
        )
        text, n = pattern.subn(new_prepare, text, count=1)
        if n != 1:
            raise RuntimeError('Không tìm thấy hàm prepare_X cũ để patch.')

    text = text.replace(
        'def predict_binary(model: Any, X: pd.DataFrame) -> np.ndarray:',
        'def predict_binary(model: Any, X: Any) -> np.ndarray:',
    )

    backup = script_path.with_suffix('.py.bak_before_batch07_fix')
    backup.write_text(original, encoding='utf-8')
    script_path.write_text(text, encoding='utf-8')

    print('Patched:', script_path)
    print('Backup :', backup)
    print('Fix    : LightGBM inference now uses numpy float32 matrix to avoid pandas categorical metadata mismatch.')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
