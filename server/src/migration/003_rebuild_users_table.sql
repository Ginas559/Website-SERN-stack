IF OBJECT_ID(N'dbo.RefreshTokens', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.RefreshTokens;
END;

IF OBJECT_ID(N'dbo.Users', N'U') IS NOT NULL
BEGIN
    DROP TABLE dbo.Users;
END;

CREATE TABLE dbo.Users (
    id CHAR(36) NOT NULL CONSTRAINT PK_users PRIMARY KEY,
    username VARCHAR(255) NOT NULL CONSTRAINT UQ_users_username UNIQUE,
    email VARCHAR(255) NOT NULL CONSTRAINT UQ_users_email UNIQUE,
    [password] VARCHAR(255) NOT NULL,
    phone_number VARCHAR(255) NULL,
    full_name VARCHAR(255) NULL,
    [address] VARCHAR(255) NULL,
    avatar VARCHAR(255) NULL,
    isAdmin TINYINT NOT NULL CONSTRAINT DF_users_isAdmin DEFAULT (0),
    createdAt DATETIME NOT NULL CONSTRAINT DF_users_createdAt DEFAULT (GETDATE()),
    updatedAt DATETIME NOT NULL CONSTRAINT DF_users_updatedAt DEFAULT (GETDATE()),
    isDelete TINYINT NOT NULL CONSTRAINT DF_users_isDelete DEFAULT (0),
    blockReason VARCHAR(255) NULL,
    isVerified TINYINT NOT NULL CONSTRAINT DF_users_isVerified DEFAULT (0),
    verificationToken VARCHAR(255) NULL,
    isVip TINYINT NOT NULL CONSTRAINT DF_users_isVip DEFAULT (0)
);

CREATE TABLE dbo.RefreshTokens (
    Id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_RefreshTokens PRIMARY KEY,
    UserId CHAR(36) NOT NULL,
    TokenId VARCHAR(36) NOT NULL CONSTRAINT UQ_RefreshTokens_TokenId UNIQUE,
    ExpiresAt DATETIME2 NOT NULL,
    RevokedAt DATETIME2 NULL,
    CreatedAt DATETIME2 NOT NULL CONSTRAINT DF_RefreshTokens_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_RefreshTokens_Users FOREIGN KEY (UserId) REFERENCES dbo.Users(id)
);
