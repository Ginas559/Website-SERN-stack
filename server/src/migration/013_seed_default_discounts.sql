IF OBJECT_ID(N'dbo.discounts', N'U') IS NOT NULL
BEGIN
    IF NOT EXISTS (SELECT 1 FROM dbo.discounts WHERE code = 'WELCOME10')
    BEGIN
        INSERT INTO dbo.discounts (code, discount_type, value, maxDiscountValue, minimumOrderValue, description, quantity, usedCount, startDate, expiredAt, isDelete, createdAt, updatedAt)
        VALUES ('WELCOME10', 'PERCENT', 10, 50000, 150000, N'Giảm 10% tối đa 50.000đ cho đơn từ 150.000đ', 200, 0, GETDATE(), DATEADD(MONTH, 6, GETDATE()), 0, GETDATE(), GETDATE());
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.discounts WHERE code = 'FREESHIP')
    BEGIN
        INSERT INTO dbo.discounts (code, discount_type, value, maxDiscountValue, minimumOrderValue, description, quantity, usedCount, startDate, expiredAt, isDelete, createdAt, updatedAt)
        VALUES ('FREESHIP', 'FIXED', 25000, 25000, 200000, N'Hỗ trợ 25.000đ phí vận chuyển cho đơn từ 200.000đ', 500, 0, GETDATE(), DATEADD(MONTH, 6, GETDATE()), 0, GETDATE(), GETDATE());
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.discounts WHERE code = 'BOOKWORM20')
    BEGIN
        INSERT INTO dbo.discounts (code, discount_type, value, maxDiscountValue, minimumOrderValue, description, quantity, usedCount, startDate, expiredAt, isDelete, createdAt, updatedAt)
        VALUES ('BOOKWORM20', 'PERCENT', 20, 100000, 300000, N'Đại tiệc sách: Giảm 20% tối đa 100.000đ cho đơn từ 300.000đ', 100, 0, GETDATE(), DATEADD(MONTH, 3, GETDATE()), 0, GETDATE(), GETDATE());
    END;
END;

