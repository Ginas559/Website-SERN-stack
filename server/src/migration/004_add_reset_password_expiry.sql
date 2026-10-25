IF COL_LENGTH(N'dbo.Users', N'resetPasswordExpiresAt') IS NULL
BEGIN
    ALTER TABLE dbo.Users
    ADD resetPasswordExpiresAt DATETIME2 NULL;
END;
