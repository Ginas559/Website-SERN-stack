IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    THROW 51000, 'Cannot convert user text columns: dbo.Users does not exist.', 1;
END;

IF EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.Users')
      AND name IN ('username', 'email', 'phone_number', 'full_name', 'address', 'avatar', 'blockReason', 'verificationToken')
      AND system_type_id <> 231
)
BEGIN
    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_users_username' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
    BEGIN
        ALTER TABLE dbo.Users DROP CONSTRAINT UQ_users_username;
    END;

    IF EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_users_email' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
    BEGIN
        ALTER TABLE dbo.Users DROP CONSTRAINT UQ_users_email;
    END;

    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'username' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN username NVARCHAR(255) NOT NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'email' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN email NVARCHAR(255) NOT NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'phone_number' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN phone_number NVARCHAR(255) NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'full_name' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN full_name NVARCHAR(255) NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'address' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN [address] NVARCHAR(255) NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'avatar' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN avatar NVARCHAR(255) NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'blockReason' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN blockReason NVARCHAR(255) NULL;
    IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.Users') AND name = N'verificationToken' AND system_type_id <> 231)
        ALTER TABLE dbo.Users ALTER COLUMN verificationToken NVARCHAR(255) NULL;

    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_users_username' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
        ALTER TABLE dbo.Users ADD CONSTRAINT UQ_users_username UNIQUE (username);
    IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = N'UQ_users_email' AND parent_object_id = OBJECT_ID(N'dbo.Users'))
        ALTER TABLE dbo.Users ADD CONSTRAINT UQ_users_email UNIQUE (email);
END;
