IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users (
        Id INT IDENTITY(1,1) PRIMARY KEY,
        FullName NVARCHAR(100) NOT NULL,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        PasswordHash NVARCHAR(255) NOT NULL,
        Role VARCHAR(20) NOT NULL DEFAULT 'Customer' CHECK (Role IN ('Customer', 'Admin')),
        IsActive BIT NOT NULL DEFAULT 1,
        ResetPasswordTokenHash CHAR(64) NULL,
        ResetPasswordExpiresAt DATETIME2 NULL,
        CreatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        UpdatedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
END;
