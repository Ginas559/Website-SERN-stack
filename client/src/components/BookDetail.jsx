import { useState } from "react";
import BookCard from "./BookCard";

function BookDetail({ book, loading = false, error = "", onRetry, onBack, onSelectBook, onAddToCart }) {
    const [quantity, setQuantity] = useState(1);
    const [addedNotice, setAddedNotice] = useState("");

    if (loading) {
        return (
            <div className="books-container">
                <div className="empty-state" aria-live="polite">
                    <h3>Đang tải thông tin sách...</h3>
                    <p>Vui lòng đợi trong giây lát</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="books-container">
                <div className="empty-state error-state" role="alert">
                    <h3>Không thể tải thông tin sách</h3>
                    <p>{error}</p>
                    <button type="button" className="filter-btn-reset" onClick={onRetry}>
                        Thử lại
                    </button>
                </div>
            </div>
        );
    }

    if (!book) {
        return (
            <div className="books-container">
                <div className="empty-state" aria-live="polite">
                    <h3>Đang tải thông tin sách...</h3>
                    <p>Vui lòng đợi trong giây lát</p>
                </div>
            </div>
        );
    }

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

    async function handleAddToCart() {
        if (!inStock) return;
        try {
            if (onAddToCart) {
                await onAddToCart(book, quantity);
            }
            setAddedNotice(`Đã thêm ${quantity} cuốn vào giỏ hàng.`);
        } catch (cartError) {
            setAddedNotice(cartError.message);
        }
    }

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
                        <div className="detail-cart-actions">
                            <div className="detail-quantity">
                                <button type="button" disabled={quantity <= 1} onClick={() => setQuantity((value) => Math.max(1, value - 1))}>-</button>
                                <input
                                    type="number"
                                    value={quantity}
                                    min="1"
                                    max={stockCount}
                                    onChange={(event) => setQuantity(Math.max(1, Math.min(stockCount, Number(event.target.value) || 1)))}
                                />
                                <button type="button" disabled={quantity >= stockCount} onClick={() => setQuantity((value) => Math.min(stockCount, value + 1))}>+</button>
                            </div>
                            <button type="button" className="detail-add-cart" onClick={handleAddToCart}>
                                Thêm vào giỏ hàng
                            </button>
                        </div>
                    ) : null}
                    {addedNotice ? <div className="detail-cart-notice">{addedNotice}</div> : null}

                    {pubDate ? (
                        <div className="detail-publication-date">
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
