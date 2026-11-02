IF COL_LENGTH(N'dbo.Users', N'resetPasswordUsedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD resetPasswordUsedAt DATETIME2 NULL;
END;
