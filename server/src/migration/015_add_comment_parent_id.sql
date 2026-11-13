IF COL_LENGTH(N'dbo.comments', N'parent_id') IS NULL
BEGIN
    ALTER TABLE dbo.comments ADD parent_id INT NULL;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = N'FK_comments_parent' AND parent_object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    ALTER TABLE dbo.comments
    ADD CONSTRAINT FK_comments_parent
    FOREIGN KEY (parent_id) REFERENCES dbo.comments(id)
    ON DELETE NO ACTION
    ON UPDATE NO ACTION;
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_comments_parent_not_self' AND parent_object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    ALTER TABLE dbo.comments
    ADD CONSTRAINT CK_comments_parent_not_self
    CHECK (parent_id IS NULL OR parent_id <> id);
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_comments_reply_no_rate' AND parent_object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    ALTER TABLE dbo.comments
    ADD CONSTRAINT CK_comments_reply_no_rate
    CHECK (parent_id IS NULL OR rate IS NULL);
END;
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_comments_parent_id' AND object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    CREATE INDEX IX_comments_parent_id ON dbo.comments(parent_id, isDelete, createdAt, id) WHERE parent_id IS NOT NULL;
END;

