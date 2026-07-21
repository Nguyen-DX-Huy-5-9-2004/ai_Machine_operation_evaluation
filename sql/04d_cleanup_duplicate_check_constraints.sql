SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'i26s02004_dat_dev'
    THROW 51300, 'Wrong database. Select i26s02004_dat_dev before running.', 1;

DECLARE @table_name NVARCHAR(300) =
    N'dbo.ai_l2_fault_judgment_online_v2';
DECLARE @object_id INT = OBJECT_ID(@table_name, N'U');

IF @object_id IS NULL
    THROW 51301, 'Online result table does not exist.', 1;

DECLARE
    @canonical_source SYSNAME = N'CK_ai_l2_fault_judgment_online_v2_source',
    @duplicate_source SYSNAME = N'CK_ai_online_new_source',
    @canonical_action SYSNAME = N'CK_ai_l2_fault_judgment_online_v2_action',
    @duplicate_action SYSNAME = N'CK_ai_online_new_action';

DECLARE
    @canonical_source_def NVARCHAR(MAX),
    @duplicate_source_def NVARCHAR(MAX),
    @canonical_action_def NVARCHAR(MAX),
    @duplicate_action_def NVARCHAR(MAX);

SELECT @canonical_source_def = definition
FROM sys.check_constraints
WHERE parent_object_id = @object_id
  AND name = @canonical_source;

SELECT @duplicate_source_def = definition
FROM sys.check_constraints
WHERE parent_object_id = @object_id
  AND name = @duplicate_source;

SELECT @canonical_action_def = definition
FROM sys.check_constraints
WHERE parent_object_id = @object_id
  AND name = @canonical_action;

SELECT @duplicate_action_def = definition
FROM sys.check_constraints
WHERE parent_object_id = @object_id
  AND name = @duplicate_action;

IF @canonical_source_def IS NULL
    THROW 51302, 'Canonical source check constraint is missing.', 1;

IF @canonical_action_def IS NULL
    THROW 51303, 'Canonical action check constraint is missing.', 1;

IF @duplicate_source_def IS NULL
   AND @duplicate_action_def IS NULL
BEGIN
    SELECT N'NO_DUPLICATE_CHECK_CONSTRAINTS_FOUND' AS result;
    RETURN;
END;

-- Normalize harmless formatting differences before comparing definitions.
DECLARE
    @canonical_source_norm NVARCHAR(MAX),
    @duplicate_source_norm NVARCHAR(MAX),
    @canonical_action_norm NVARCHAR(MAX),
    @duplicate_action_norm NVARCHAR(MAX);

SET @canonical_source_norm =
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @canonical_source_def, N' ', N''), N'[', N''), N']', N''),
        CHAR(13), N''), CHAR(10), N''));

SET @duplicate_source_norm =
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @duplicate_source_def, N' ', N''), N'[', N''), N']', N''),
        CHAR(13), N''), CHAR(10), N''));

SET @canonical_action_norm =
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @canonical_action_def, N' ', N''), N'[', N''), N']', N''),
        CHAR(13), N''), CHAR(10), N''));

SET @duplicate_action_norm =
    LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        @duplicate_action_def, N' ', N''), N'[', N''), N']', N''),
        CHAR(13), N''), CHAR(10), N''));

IF @duplicate_source_def IS NOT NULL
   AND @canonical_source_norm <> @duplicate_source_norm
BEGIN
    SELECT
        @canonical_source AS canonical_constraint,
        @canonical_source_def AS canonical_definition,
        @duplicate_source AS duplicate_constraint,
        @duplicate_source_def AS duplicate_definition;

    THROW 51304, 'Source check constraints are not equivalent. Stop for review.', 1;
END;

IF @duplicate_action_def IS NOT NULL
   AND @canonical_action_norm <> @duplicate_action_norm
BEGIN
    SELECT
        @canonical_action AS canonical_constraint,
        @canonical_action_def AS canonical_definition,
        @duplicate_action AS duplicate_constraint,
        @duplicate_action_def AS duplicate_definition;

    THROW 51305, 'Action check constraints are not equivalent. Stop for review.', 1;
END;

DECLARE @sql NVARCHAR(MAX) = N'';

IF @duplicate_source_def IS NOT NULL
    SET @sql +=
        N'ALTER TABLE ' + @table_name
        + N' DROP CONSTRAINT ' + QUOTENAME(@duplicate_source) + N';';

IF @duplicate_action_def IS NOT NULL
    SET @sql +=
        N'ALTER TABLE ' + @table_name
        + N' DROP CONSTRAINT ' + QUOTENAME(@duplicate_action) + N';';

BEGIN TRY
    BEGIN TRANSACTION;

    EXEC sys.sp_executesql @sql;

    COMMIT TRANSACTION;
END TRY
BEGIN CATCH
    IF XACT_STATE() <> 0
        ROLLBACK TRANSACTION;

    THROW;
END CATCH;

SELECT
    N'DUPLICATE_CHECK_CONSTRAINTS_REMOVED' AS result,
    @duplicate_source AS removed_source_constraint,
    @duplicate_action AS removed_action_constraint,
    @canonical_source AS retained_source_constraint,
    @canonical_action AS retained_action_constraint;

SELECT
    name,
    definition,
    is_disabled,
    is_not_trusted
FROM sys.check_constraints
WHERE parent_object_id = @object_id
ORDER BY name;
