import { useState } from "react";
import BookCard from "./BookCard";

function BookDetail({ book, onBack, onSelectBook, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);
    const [addedNotice, setAddedNotice] = useState(false);

    if (!book) return null;

    const discount = Number(book.discount) || 0;
    const originalPrice = Number(book.price) || 0;
    const finalPrice = discount > 0 
        ? Math.round(originalPrice * (100 - discount) / 100) 
        : originalPrice;

    const formatPrice = (val) => Number(val).toLocaleString("vi-VN") + " đ";

    const pubDate = book.publication_date 
        ? new Date(book.publication_date).toLocaleDateString("vi-VN")
        : null;

    const stockCount = Number(book.quantity) || 0;
    const inStock = stockCount > 0;

    const handleAdd = () => {
        if (!inStock) return;
        if (onAddToCart) {
            onAddToCart(book, quantity);
        } else {
            try {
                const current = JSON.parse(localStorage.getItem("guestCart") || "[]");
                const existingIndex = current.findIndex((item) => (item.bookId || item.id) === book.id);
                if (existingIndex >= 0) {
                    current[existingIndex].quantity = Math.min(stockCount, current[existingIndex].quantity + quantity);
                } else {
                    current.push({
                        id: book.id,
                        bookId: book.id,
                        title: book.title,
                        author: book.author,
                        price: originalPrice,
                        discount,
                        quantity,
                        stock: stockCount,
                        image: book.image
                    });
                }
                localStorage.setItem("guestCart", JSON.stringify(current));
            } catch {
                return;
            }
        }
        setAddedNotice(true);
        setTimeout(() => setAddedNotice(false), 2500);
    };

    return (
        <div className="books-container">
            <button type="button" className="detail-back-btn" onClick={onBack}>
                ← Quay lại danh sách sách
            </button>

            <div className="book-detail-card">
                <div className="detail-cover-wrap">
                    {book.image ? (
                        <img 
                            src={book.image} 
                            alt={book.title} 
                            className="detail-cover"
                            onError={(e) => {
                                e.target.style.display = "none";
                                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                            }}
                        />
                    ) : null}
                    <div 
                        className="book-cover-placeholder" 
                        style={{ display: book.image ? "none" : "flex", fontSize: "4rem" }}
                    >
                        📚
                    </div>
                    {discount > 0 ? (
                        <span className="discount-badge">-{discount}%</span>
                    ) : null}
                </div>

                <div>
                    <div className="detail-badge-group">
                        {inStock ? (
                            <span className="detail-badge-stock">Còn hàng ({stockCount} cuốn)</span>
                        ) : (
                            <span className="detail-badge-out">Tạm hết hàng</span>
                        )}
                        {Array.isArray(book.categories) ? book.categories.map((c) => (
                            <span key={c.id} className="detail-badge">{c.name}</span>
                        )) : null}
                    </div>

                    <h1 className="detail-title">{book.title}</h1>
                    <div className="detail-author">Tác giả: <strong>{book.author}</strong></div>

                    <div className="detail-price-box">
                        <span className="detail-price">{formatPrice(finalPrice)}</span>
                        {discount > 0 ? (
                            <span className="detail-old-price">{formatPrice(originalPrice)}</span>
                        ) : null}
                    </div>

                    {inStock ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "16px 0" }}>
                            <div style={{ display: "inline-flex", border: "1px solid #d9d0c2", borderRadius: "8px", background: "#ffffff", overflow: "hidden" }}>
                                <button
                                    type="button"
                                    disabled={quantity <= 1}
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    style={{ width: "34px", height: "34px", border: "none", background: "#f5ede0", color: "#20201f", fontWeight: "700", cursor: "pointer" }}
                                >
                                    −
                                </button>
                                <input
                                    type="number"
                                    value={quantity}
                                    min="1"
                                    max={stockCount}
                                    onKeyDown={(e) => { if (['e', 'E', '+', '-', '.', ','].includes(e.key)) e.preventDefault(); }}
                                    onChange={(e) => setQuantity(Math.max(1, Math.min(stockCount, parseInt(e.target.value, 10) || 1)))}
                                    style={{ width: "46px", textAlign: "center", border: "none", borderLeft: "1px solid #d9d0c2", borderRight: "1px solid #d9d0c2", fontWeight: "700", color: "#20201f" }}
                                />
                                <button
                                    type="button"
                                    disabled={quantity >= stockCount}
                                    onClick={() => setQuantity(Math.min(stockCount, quantity + 1))}
                                    style={{ width: "34px", height: "34px", border: "none", background: "#f5ede0", color: "#20201f", fontWeight: "700", cursor: "pointer" }}
                                >
                                    +
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={handleAdd}
                                style={{
                                    padding: "10px 22px",
                                    background: "#c77736",
                                    color: "#fff",
                                    border: "none",
                                    borderRadius: "8px",
                                    fontWeight: "700",
                                    cursor: "pointer",
                                    transition: "background 0.2s"
                                }}
                            >
                                🛒 Thêm vào giỏ hàng
                            </button>
                        </div>
                    ) : null}

                    {addedNotice ? (
                        <div style={{ color: "#2e7d32", fontWeight: "600", marginBottom: "12px" }}>
                            ✓ Đã thêm {quantity} cuốn vào giỏ hàng thành công!
                        </div>
                    ) : null}

                    {pubDate ? (
                        <div style={{ marginBottom: "14px", color: "#83796e", fontSize: "0.9rem" }}>
                            Ngày xuất bản: {pubDate}
                        </div>
                    ) : null}

                    <div className="detail-desc">
                        {book.description || "Chưa có mô tả chi tiết cho ấn phẩm sách này."}
                    </div>
                </div>
            </div>

            {Array.isArray(book.relatedBooks) && book.relatedBooks.length > 0 ? (
                <div className="related-section">
                    <h2 className="related-title">Sách cùng thể loại gợi ý</h2>
                    <div className="books-grid">
                        {book.relatedBooks.map((relBook) => (
                            <BookCard 
                                key={relBook.id} 
                                book={relBook} 
                                onSelectBook={onSelectBook}
                            />
                        ))}
                    </div>
                </div>
            ) : null}
        </div>
    );
}

export default BookDetail;
