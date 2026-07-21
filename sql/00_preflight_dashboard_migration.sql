/*
Read-only DBA preflight. This file contains no DDL/DML and is safe to review
against the target database before considering scripts 01, 02, 04b or 05.
The Python runner scripts/preflight_dashboard_migration_read_only.py produces
the complete JSON audit used by this migration.
*/
SET NOCOUNT ON;

SELECT DB_NAME() AS database_name, @@SERVERNAME AS server_name, @@VERSION AS sql_server_version,
       CAST(DATABASEPROPERTYEX(DB_NAME(), 'CompatibilityLevel') AS INT) AS compatibility_level,
       SUSER_SNAME() AS current_login;

SELECT N'dbo.ai_l2_fault_judgment_online_v2' AS target,
       HAS_PERMS_BY_NAME(N'dbo.ai_l2_fault_judgment_online_v2', N'OBJECT', N'SELECT') AS can_select,
       HAS_PERMS_BY_NAME(N'dbo.ai_l2_fault_judgment_online_v2', N'OBJECT', N'ALTER') AS can_alter,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CREATE TABLE') AS can_create_table,
       HAS_PERMS_BY_NAME(DB_NAME(), N'DATABASE', N'CREATE VIEW') AS can_create_view,
       HAS_PERMS_BY_NAME(N'dbo', N'SCHEMA', N'ALTER') AS can_alter_dbo_schema;

SELECT c.column_id, c.name AS column_name, t.name AS type_name, c.max_length, c.precision, c.scale,
       c.is_nullable, dc.definition AS default_definition
FROM sys.columns AS c
JOIN sys.types AS t ON c.user_type_id=t.user_type_id
LEFT JOIN sys.default_constraints AS dc ON c.default_object_id=dc.object_id
WHERE c.object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2')
ORDER BY c.column_id;
