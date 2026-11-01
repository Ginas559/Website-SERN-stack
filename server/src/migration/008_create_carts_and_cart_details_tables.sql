IF OBJECT_ID(N'dbo.carts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.carts (
        id CHAR(36) NOT NULL CONSTRAINT PK_carts PRIMARY KEY,
        user_id CHAR(36) NOT NULL CONSTRAINT UQ_carts_user_id UNIQUE,
        total INT NOT NULL CONSTRAINT DF_carts_total DEFAULT (0),
        total_quantity INT NOT NULL CONSTRAINT DF_carts_total_quantity DEFAULT (0),
        discount_id INT NULL,
        createdAt DATETIME NOT NULL CONSTRAINT DF_carts_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_carts_updatedAt DEFAULT (GETDATE()),
        CONSTRAINT FK_carts_users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE CASCADE
    );
END;

IF OBJECT_ID(N'dbo.cart_details', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.cart_details (
        cart_id CHAR(36) NOT NULL,
        book_id INT NOT NULL,
        quantity INT NOT NULL CONSTRAINT DF_cart_details_quantity DEFAULT (1) CONSTRAINT CK_cart_details_quantity CHECK (quantity > 0),
        total INT NOT NULL CONSTRAINT DF_cart_details_total DEFAULT (0) CONSTRAINT CK_cart_details_total CHECK (total >= 0),
        createdAt DATETIME NOT NULL CONSTRAINT DF_cart_details_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_cart_details_updatedAt DEFAULT (GETDATE()),
        CONSTRAINT PK_cart_details PRIMARY KEY (cart_id, book_id),
        CONSTRAINT FK_cart_details_carts FOREIGN KEY (cart_id) REFERENCES dbo.carts(id) ON DELETE CASCADE,
        CONSTRAINT FK_cart_details_books FOREIGN KEY (book_id) REFERENCES dbo.books(id)
    );
END;
