IF OBJECT_ID(N'dbo.orders', N'U') IS NULL OR OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    THROW 51000, 'Cannot create order assignments: dbo.orders or dbo.Users does not exist.', 1;
END;

IF OBJECT_ID(N'dbo.order_assignments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_assignments (
        id CHAR(36) NOT NULL CONSTRAINT PK_order_assignments PRIMARY KEY,
        order_id CHAR(36) NOT NULL,
        shipper_id CHAR(36) NOT NULL,
        assigned_by CHAR(36) NOT NULL,
        status VARCHAR(20) NOT NULL CONSTRAINT DF_order_assignments_status DEFAULT ('ASSIGNED'),
        isActive BIT NOT NULL CONSTRAINT DF_order_assignments_isActive DEFAULT (1),
        assignedAt DATETIME2 NOT NULL CONSTRAINT DF_order_assignments_assignedAt DEFAULT (SYSUTCDATETIME()),
        acceptedAt DATETIME2 NULL,
        rejectedAt DATETIME2 NULL,
        completedAt DATETIME2 NULL,
        cancelledAt DATETIME2 NULL,
        rejectionReason NVARCHAR(500) NULL,
        cancellationReason NVARCHAR(500) NULL,
        note NVARCHAR(1000) NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_order_assignments_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_order_assignments_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT CK_order_assignments_status CHECK (status IN ('ASSIGNED', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'CANCELLED')),
        CONSTRAINT FK_order_assignments_order FOREIGN KEY (order_id) REFERENCES dbo.orders(id),
        CONSTRAINT FK_order_assignments_shipper FOREIGN KEY (shipper_id) REFERENCES dbo.Users(id),
        CONSTRAINT FK_order_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES dbo.Users(id)
    );
END;

IF COL_LENGTH(N'dbo.order_assignments', N'assignment_note') IS NULL
BEGIN
    ALTER TABLE dbo.order_assignments ADD assignment_note NVARCHAR(1000) NULL;
END;

IF COL_LENGTH(N'dbo.order_assignments', N'completion_note') IS NULL
BEGIN
    ALTER TABLE dbo.order_assignments ADD completion_note NVARCHAR(1000) NULL;
END;

EXEC sys.sp_executesql N'
    UPDATE dbo.order_assignments
    SET completion_note = CASE WHEN status = ''COMPLETED'' AND completion_note IS NULL THEN note ELSE completion_note END,
        assignment_note = CASE WHEN status <> ''COMPLETED'' AND assignment_note IS NULL THEN note ELSE assignment_note END
    WHERE note IS NOT NULL;';

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'UX_order_assignments_active_order'
      AND object_id = OBJECT_ID(N'dbo.order_assignments')
)
BEGIN
    CREATE UNIQUE INDEX UX_order_assignments_active_order
        ON dbo.order_assignments(order_id)
        WHERE isActive = 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_order_assignments_shipper_status'
      AND object_id = OBJECT_ID(N'dbo.order_assignments')
)
BEGIN
    CREATE INDEX IX_order_assignments_shipper_status
        ON dbo.order_assignments(shipper_id, status, assignedAt DESC);
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = N'IX_order_assignments_order_created'
      AND object_id = OBJECT_ID(N'dbo.order_assignments')
)
BEGIN
    CREATE INDEX IX_order_assignments_order_created
        ON dbo.order_assignments(order_id, createdAt DESC);
END;
