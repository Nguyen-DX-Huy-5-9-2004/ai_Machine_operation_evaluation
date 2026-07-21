SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'i26s02004_dat_dev'
    THROW 51200, 'Wrong database. Select i26s02004_dat_dev before running.', 1;

IF OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2', N'U') IS NULL
    THROW 51201, 'Online result table does not exist.', 1;

IF (SELECT COUNT_BIG(*) FROM dbo.ai_l2_fault_judgment_online_v2) <> 0
    THROW 51202, 'Online table is no longer empty. Stop and review before index cleanup.', 1;

DECLARE @canonical_index SYSNAME = N'UQ_ai_l2_fault_judgment_online_v2_source_event';
DECLARE @duplicate_index SYSNAME = N'UQ_ai_online_new_source_event';
DECLARE @object_id INT = OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2');

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = @object_id
      AND name = @canonical_index
      AND is_unique = 1
)
    THROW 51203, 'Canonical source/event unique index is missing.', 1;

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = @object_id
      AND name = @duplicate_index
      AND is_unique = 1
)
BEGIN
    SELECT N'NO_DUPLICATE_INDEX_FOUND' AS result;
    RETURN;
END;

;WITH index_keys AS
(
    SELECT
        i.name,
        STRING_AGG(c.name, N',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
    FROM sys.indexes AS i
    JOIN sys.index_columns AS ic
      ON ic.object_id = i.object_id
     AND ic.index_id = i.index_id
     AND ic.is_included_column = 0
    JOIN sys.columns AS c
      ON c.object_id = ic.object_id
     AND c.column_id = ic.column_id
    WHERE i.object_id = @object_id
      AND i.name IN (@canonical_index, @duplicate_index)
    GROUP BY i.name
)
SELECT name, key_columns
INTO #index_keys
FROM index_keys;

IF EXISTS
(
    SELECT 1
    FROM #index_keys
    WHERE name IN (@canonical_index, @duplicate_index)
      AND key_columns <> N'event_source,event_id'
)
    THROW 51204, 'One of the indexes does not have the expected event_source,event_id key.', 1;

DECLARE @is_constraint BIT =
(
    SELECT is_unique_constraint
    FROM sys.indexes
    WHERE object_id = @object_id
      AND name = @duplicate_index
);

DECLARE @sql NVARCHAR(MAX);

IF @is_constraint = 1
BEGIN
    SET @sql =
        N'ALTER TABLE dbo.ai_l2_fault_judgment_online_v2 DROP CONSTRAINT '
        + QUOTENAME(@duplicate_index) + N';';
END
ELSE
BEGIN
    SET @sql =
        N'DROP INDEX ' + QUOTENAME(@duplicate_index)
        + N' ON dbo.ai_l2_fault_judgment_online_v2;';
END;

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
    N'DUPLICATE_INDEX_REMOVED' AS result,
    @duplicate_index AS removed_object,
    @canonical_index AS retained_object;

SELECT
    i.name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint,
    STRING_AGG(c.name, N',') WITHIN GROUP (ORDER BY ic.key_ordinal) AS key_columns
FROM sys.indexes AS i
JOIN sys.index_columns AS ic
  ON ic.object_id = i.object_id
 AND ic.index_id = i.index_id
 AND ic.is_included_column = 0
JOIN sys.columns AS c
  ON c.object_id = ic.object_id
 AND c.column_id = ic.column_id
WHERE i.object_id = @object_id
  AND i.is_hypothetical = 0
GROUP BY
    i.name,
    i.type_desc,
    i.is_unique,
    i.is_primary_key,
    i.is_unique_constraint
ORDER BY i.name;