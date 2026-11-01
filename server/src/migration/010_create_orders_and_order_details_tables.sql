IF OBJECT_ID(N'dbo.orders', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.orders (
        id CHAR(36) NOT NULL CONSTRAINT PK_orders PRIMARY KEY,
        total INT NOT NULL CONSTRAINT DF_orders_total DEFAULT (0) CONSTRAINT CK_orders_total CHECK (total >= 0),
        total_quantity INT NOT NULL CONSTRAINT DF_orders_total_quantity DEFAULT (0) CONSTRAINT CK_orders_total_quantity CHECK (total_quantity >= 0),
        createdAt DATETIME NOT NULL CONSTRAINT DF_orders_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_orders_updatedAt DEFAULT (GETDATE()),
        user_id CHAR(36) NULL,
        status INT NOT NULL CONSTRAINT DF_orders_status DEFAULT (0),
        pay_url VARCHAR(255) NULL,
        discount INT NULL,
        payment_method VARCHAR(50) NOT NULL CONSTRAINT DF_orders_payment_method DEFAULT ('COD'),
        ghn_info NVARCHAR(MAX) NULL,
        ghn_response NVARCHAR(MAX) NULL,
        ghn_code VARCHAR(255) NULL,
        ghn_fee INT NOT NULL CONSTRAINT DF_orders_ghn_fee DEFAULT (0) CONSTRAINT CK_orders_ghn_fee CHECK (ghn_fee >= 0),
        CONSTRAINT FK_orders_users FOREIGN KEY (user_id) REFERENCES dbo.Users(id) ON DELETE SET NULL,
        CONSTRAINT FK_orders_discounts FOREIGN KEY (discount) REFERENCES dbo.discounts(id) ON DELETE SET NULL
    );

    CREATE NONCLUSTERED INDEX IX_orders_user_id ON dbo.orders(user_id);
    CREATE NONCLUSTERED INDEX IX_orders_discount ON dbo.orders(discount);
    CREATE NONCLUSTERED INDEX IX_orders_createdAt ON dbo.orders(createdAt DESC);
    CREATE NONCLUSTERED INDEX IX_orders_status ON dbo.orders(status);
END;

IF OBJECT_ID(N'dbo.order_details', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.order_details (
        order_id CHAR(36) NOT NULL,
        book_id INT NOT NULL,
        quantity INT NOT NULL CONSTRAINT DF_order_details_quantity DEFAULT (1) CONSTRAINT CK_order_details_quantity CHECK (quantity > 0),
        total INT NOT NULL CONSTRAINT DF_order_details_total DEFAULT (0) CONSTRAINT CK_order_details_total CHECK (total >= 0),
        createdAt DATETIME NOT NULL CONSTRAINT DF_order_details_createdAt DEFAULT (GETDATE()),
        updatedAt DATETIME NOT NULL CONSTRAINT DF_order_details_updatedAt DEFAULT (GETDATE()),
        CONSTRAINT PK_order_details PRIMARY KEY (order_id, book_id),
        CONSTRAINT FK_order_details_orders FOREIGN KEY (order_id) REFERENCES dbo.orders(id) ON DELETE CASCADE,
        CONSTRAINT FK_order_details_books FOREIGN KEY (book_id) REFERENCES dbo.books(id) ON DELETE CASCADE
    );

    CREATE NONCLUSTERED INDEX IX_order_details_book_id ON dbo.order_details(book_id);
END;
