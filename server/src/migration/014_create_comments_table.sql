IF OBJECT_ID(N'dbo.comments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.comments (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_comments PRIMARY KEY,
        user_id CHAR(36) NOT NULL,
        book_id INT NOT NULL,
        rate INT NOT NULL CONSTRAINT CK_comments_rate CHECK (rate >= 1 AND rate <= 5),
        value NVARCHAR(1000) NULL,
        isDelete TINYINT NOT NULL CONSTRAINT DF_comments_isDelete DEFAULT (0),
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_comments_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_comments_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT FK_comments_users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT FK_comments_books FOREIGN KEY (book_id) REFERENCES dbo.books(id) ON DELETE CASCADE ON UPDATE CASCADE
    );
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_comments_user_book_active' AND object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    CREATE UNIQUE INDEX UX_comments_user_book_active ON dbo.comments(user_id, book_id) WHERE isDelete = 0;
END;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_comments_book_id' AND object_id = OBJECT_ID(N'dbo.comments'))
BEGIN
    CREATE INDEX IX_comments_book_id ON dbo.comments(book_id, isDelete);
END;

