from pathlib import Path


def test_machine_detail_summary_does_not_select_the_wide_source_aware_view() -> None:
    source = Path("backend/app/repositories/dashboard.py").read_text(encoding="utf-8")
    implementation = source.index("class SqlDashboardRepository")
    start = source.index("    def machine_summary(self, machine_id: int, filters: QueryFilters)", implementation)
    end = source.index("    def machine_series", start)
    summary = source[start:end]
    assert "SELECT TOP (1)" not in summary
    assert "for series in (\"timeline\", \"events\", \"l1\", \"l2\")" in summary
    assert "self.machine_series(machine_id, filters, series, 1)" in summary
