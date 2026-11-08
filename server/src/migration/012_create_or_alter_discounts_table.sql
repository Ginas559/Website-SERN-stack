IF OBJECT_ID(N'dbo.discounts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.discounts (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_discounts PRIMARY KEY,
        code VARCHAR(50) NULL,
        discount_type VARCHAR(20) NOT NULL CONSTRAINT DF_discounts_type DEFAULT ('PERCENT'),
        value INT NOT NULL CONSTRAINT DF_discounts_value DEFAULT (0),
        maxDiscountValue INT NULL,
        minimumOrderValue INT NOT NULL CONSTRAINT DF_discounts_min_order DEFAULT (0),
        description NVARCHAR(255) NULL,
        quantity INT NOT NULL CONSTRAINT DF_discounts_quantity DEFAULT (100),
        usedCount INT NOT NULL CONSTRAINT DF_discounts_usedCount DEFAULT (0),
        startDate DATETIME NOT NULL CONSTRAINT DF_discounts_startDate DEFAULT (GETDATE()),
        expiredAt DATETIME NULL,
        isDelete TINYINT NOT NULL CONSTRAINT DF_discounts_isDelete DEFAULT (0),
        createdAt DATETIME NOT NULL CONSTRAINT DF_discounts_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_discounts_updatedAt DEFAULT (GETDATE())
    );
END
ELSE
BEGIN
    IF COL_LENGTH(N'dbo.discounts', N'code') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD code VARCHAR(50) NULL;
    END;

    IF COL_LENGTH(N'dbo.discounts', N'discount_type') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD discount_type VARCHAR(20) NOT NULL CONSTRAINT DF_discounts_type DEFAULT ('PERCENT');
    END;

    IF COL_LENGTH(N'dbo.discounts', N'maxDiscountValue') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD maxDiscountValue INT NULL;
    END;

    IF COL_LENGTH(N'dbo.discounts', N'quantity') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD quantity INT NOT NULL CONSTRAINT DF_discounts_quantity DEFAULT (100);
    END;

    IF COL_LENGTH(N'dbo.discounts', N'usedCount') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD usedCount INT NOT NULL CONSTRAINT DF_discounts_usedCount DEFAULT (0);
    END;

    IF COL_LENGTH(N'dbo.discounts', N'startDate') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD startDate DATETIME NOT NULL CONSTRAINT DF_discounts_startDate DEFAULT (GETDATE());
    END;

    IF COL_LENGTH(N'dbo.discounts', N'isDelete') IS NULL
    BEGIN
        ALTER TABLE dbo.discounts ADD isDelete TINYINT NOT NULL CONSTRAINT DF_discounts_isDelete DEFAULT (0);
    END;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_discounts_code' AND object_id = OBJECT_ID(N'dbo.discounts'))
BEGIN
    EXEC(N'CREATE UNIQUE NONCLUSTERED INDEX UX_discounts_code ON dbo.discounts(code) WHERE isDelete = 0 AND code IS NOT NULL;');
END;

