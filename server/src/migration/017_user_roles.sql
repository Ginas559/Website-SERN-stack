IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    THROW 51000, 'Cannot add user roles: dbo.Users does not exist.', 1;
END;

IF COL_LENGTH(N'dbo.Users', N'role') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD role VARCHAR(20) NOT NULL CONSTRAINT DF_users_role DEFAULT ('Customer');
END;

UPDATE dbo.Users
SET role = 'Admin'
WHERE isAdmin = 1 AND role <> 'Admin';

IF EXISTS (
    SELECT 1
    FROM dbo.Users
    WHERE role NOT IN ('Customer', 'Admin', 'Shipper')
)
BEGIN
    THROW 51001, 'Cannot add user roles: unsupported role values exist.', 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = N'CK_users_role'
      AND parent_object_id = OBJECT_ID(N'dbo.Users')
)
BEGIN
    ALTER TABLE dbo.Users
        ADD CONSTRAINT CK_users_role CHECK (role IN ('Customer', 'Admin', 'Shipper'));
END;
