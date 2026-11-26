IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    THROW 51000, 'Cannot remove legacy admin flag: dbo.Users does not exist.', 1;
END;

IF COL_LENGTH(N'dbo.Users', N'isAdmin') IS NOT NULL
BEGIN
    DECLARE @constraintName sysname;
    SELECT @constraintName = dc.name
    FROM sys.default_constraints dc
    INNER JOIN sys.columns c ON c.default_object_id = dc.object_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Users')
      AND c.name = N'isAdmin';

    IF @constraintName IS NOT NULL
    BEGIN
        DECLARE @dropConstraintSql nvarchar(500);
        SET @dropConstraintSql = N'ALTER TABLE dbo.Users DROP CONSTRAINT ' + QUOTENAME(@constraintName);
        EXEC sys.sp_executesql @dropConstraintSql;
    END;

    ALTER TABLE dbo.Users DROP COLUMN isAdmin;
END;
