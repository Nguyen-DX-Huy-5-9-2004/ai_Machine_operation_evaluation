from __future__ import annotations

from inference.online.artifacts import load_config


def test_load_config_hydrates_blank_sql_credentials_from_environment(tmp_path, monkeypatch) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text("database:\n  username: ''\n  password: ''\n", encoding="utf-8")
    monkeypatch.setenv("OBAD_SQL_USER", "runtime-user")
    monkeypatch.setenv("OBAD_SQL_PASSWORD", "runtime-password")

    config = load_config(config_path)

    assert config["database"]["username"] == "runtime-user"
    assert config["database"]["password"] == "runtime-password"


def test_load_config_preserves_explicit_yaml_credentials(tmp_path, monkeypatch) -> None:
    config_path = tmp_path / "config.yaml"
    config_path.write_text("database:\n  username: yaml-user\n  password: yaml-password\n", encoding="utf-8")
    monkeypatch.setenv("OBAD_SQL_USER", "runtime-user")
    monkeypatch.setenv("OBAD_SQL_PASSWORD", "runtime-password")

    config = load_config(config_path)

    assert config["database"]["username"] == "yaml-user"
    assert config["database"]["password"] == "yaml-password"
