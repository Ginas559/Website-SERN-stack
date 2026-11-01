IF OBJECT_ID(N'dbo.wishlists', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wishlists (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_wishlists PRIMARY KEY,
        user_id CHAR(36) NOT NULL CONSTRAINT UQ_wishlists_user_id UNIQUE,
        createdAt DATETIME NOT NULL CONSTRAINT DF_wishlists_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_wishlists_updatedAt DEFAULT (GETDATE()),
        CONSTRAINT FK_wishlists_users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'dbo.wishlist_books', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.wishlist_books (
        wishlist_id INT NOT NULL,
        book_id INT NOT NULL,
        createdAt DATETIME NOT NULL CONSTRAINT DF_wishlist_books_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_wishlist_books_updatedAt DEFAULT (GETDATE()),
        CONSTRAINT PK_wishlist_books PRIMARY KEY (wishlist_id, book_id),
        CONSTRAINT FK_wishlist_books_wishlists FOREIGN KEY (wishlist_id) REFERENCES dbo.wishlists(id) ON DELETE CASCADE,
        CONSTRAINT FK_wishlist_books_books FOREIGN KEY (book_id) REFERENCES dbo.books(id) ON DELETE CASCADE
    );
END;

