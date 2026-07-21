/* Read-only index equivalence report. Compare keys/include/filter, never names alone. */
SET NOCOUNT ON;
SELECT i.name,i.type_desc,i.is_unique,i.has_filter,i.filter_definition,
 STRING_AGG(CONCAT(CASE WHEN ic.is_included_column=1 THEN N'INCLUDE ' ELSE N'KEY ' END,c.name,CASE WHEN ic.is_descending_key=1 THEN N' DESC' ELSE N' ASC' END),N', ') WITHIN GROUP(ORDER BY ic.is_included_column,ic.key_ordinal,ic.index_column_id) AS definition
FROM sys.indexes i LEFT JOIN sys.index_columns ic ON i.object_id=ic.object_id AND i.index_id=ic.index_id LEFT JOIN sys.columns c ON c.object_id=ic.object_id AND c.column_id=ic.column_id
WHERE i.object_id=OBJECT_ID(N'dbo.ai_l2_fault_judgment_online_v2') AND i.index_id>0 GROUP BY i.name,i.type_desc,i.is_unique,i.has_filter,i.filter_definition;
SELECT N'NO_INDEX_APPROVED' AS recommendation,N'Online table volume and source-aware schema must be re-reviewed after migration verification.' AS reason;
