IF OBJECT_ID(N'dbo.store_policies', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.store_policies (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_store_policies PRIMARY KEY,
        policy_key VARCHAR(100) NOT NULL CONSTRAINT UQ_store_policies_key UNIQUE,
        policy_value NVARCHAR(255) NOT NULL,
        value_type VARCHAR(20) NOT NULL CONSTRAINT DF_store_policies_value_type DEFAULT ('INT'),
        description NVARCHAR(255) NULL,
        updated_by CHAR(36) NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_store_policies_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_store_policies_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_store_policies_users FOREIGN KEY (updated_by) REFERENCES dbo.Users(id) ON DELETE SET NULL
    );
END;

IF NOT EXISTS (SELECT 1 FROM dbo.store_policies WHERE policy_key = 'shipping_standard_fee')
BEGIN
    INSERT INTO dbo.store_policies (policy_key, policy_value, value_type, description, createdAt, updatedAt)
    VALUES ('shipping_standard_fee', N'25000', 'INT', N'Phí giao hàng tiêu chuẩn mặc định toàn shop (VNĐ)', SYSUTCDATETIME(), SYSUTCDATETIME());
END;

IF NOT EXISTS (SELECT 1 FROM dbo.store_policies WHERE policy_key = 'free_shipping_threshold')
BEGIN
    INSERT INTO dbo.store_policies (policy_key, policy_value, value_type, description, createdAt, updatedAt)
    VALUES ('free_shipping_threshold', N'250000', 'INT', N'Ngưỡng giá trị đơn hàng tối thiểu để miễn phí vận chuyển toàn shop (VNĐ)', SYSUTCDATETIME(), SYSUTCDATETIME());
END;

