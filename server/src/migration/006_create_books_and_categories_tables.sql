IF OBJECT_ID(N'dbo.categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.categories (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_categories PRIMARY KEY,
        name NVARCHAR(255) NOT NULL,
        description NVARCHAR(MAX) NULL,
        image VARCHAR(255) NULL,
        createdAt DATETIME NOT NULL CONSTRAINT DF_categories_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_categories_updatedAt DEFAULT (GETDATE()),
        isDelete INT NOT NULL CONSTRAINT DF_categories_isDelete DEFAULT (0)
    );
END;

IF OBJECT_ID(N'dbo.books', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.books (
        id INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_books PRIMARY KEY,
        title NVARCHAR(255) NOT NULL,
        author NVARCHAR(255) NOT NULL,
        price INT NOT NULL CONSTRAINT CK_books_price CHECK (price > 0),
        description NVARCHAR(MAX) NULL,
        image VARCHAR(255) NULL,
        publication_date DATETIME NULL,
        createdAt DATETIME NOT NULL CONSTRAINT DF_books_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_books_updatedAt DEFAULT (GETDATE()),
        isDelete INT NOT NULL CONSTRAINT DF_books_isDelete DEFAULT (0),
        quantity INT NOT NULL CONSTRAINT DF_books_quantity DEFAULT (0) CONSTRAINT CK_books_quantity CHECK (quantity >= 0),
        discount INT NOT NULL CONSTRAINT DF_books_discount DEFAULT (0) CONSTRAINT CK_books_discount CHECK (discount >= 0 AND discount <= 100),
        purchase_price INT NOT NULL CONSTRAINT DF_books_purchase_price DEFAULT (0) CONSTRAINT CK_books_purchase_price CHECK (purchase_price >= 0)
    );
END;

IF OBJECT_ID(N'dbo.book_categories', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.book_categories (
        createdAt DATETIME NOT NULL CONSTRAINT DF_book_categories_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_book_categories_updatedAt DEFAULT (GETDATE()),
        book_id INT NOT NULL,
        category_id INT NOT NULL,
        CONSTRAINT PK_book_categories PRIMARY KEY (book_id, category_id),
        CONSTRAINT FK_book_categories_books FOREIGN KEY (book_id) REFERENCES dbo.books(id) ON DELETE CASCADE,
        CONSTRAINT FK_book_categories_categories FOREIGN KEY (category_id) REFERENCES dbo.categories(id) ON DELETE CASCADE
    );
END;
