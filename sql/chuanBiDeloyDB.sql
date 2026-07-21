--query chuẩn bị deloy SQL vào prj
--kiểm tra bảng online đang trống -> số dòng = 0
SELECT
    DB_NAME() AS database_name,
    COUNT_BIG(*) AS online_rows
FROM dbo.ai_l2_fault_judgment_online_v2;

--kiểm tra tên bakcup chưa tồn tại -> null
SELECT OBJECT_ID(
    N'dbo.ai_l2_fault_judgment_online_v2_legacy_mig_20260720_01',
    N'U'
) AS backup_object_id;

--Chạy từng file riêng trong SSMS, không chọn tất cả rồi Execute cùng lúc. Thứ tự: 00 → 01a → 01b → 01 → 02a → 02 → 03 → 04a
--Không chạy: 04b_apply_approved_dashboard_indexes.sql, 05_rollback_dashboard_migration.sql, 05 chỉ dùng khi thật sự rollback.
