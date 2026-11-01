IF EXISTS (
    SELECT 1
    FROM dbo.categories
    WHERE isDelete = 0
    GROUP BY name
    HAVING COUNT(*) > 1
)
BEGIN
    THROW 51000, 'Cannot create active category name index: duplicate active category names exist.', 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_categories_active_name'
      AND object_id = OBJECT_ID(N'dbo.categories')
)
BEGIN
    CREATE UNIQUE INDEX UX_categories_active_name
    ON dbo.categories(name)
    WHERE isDelete = 0;
END;
