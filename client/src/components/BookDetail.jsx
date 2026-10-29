import BookCard from "./BookCard";

function BookDetail({ book, onBack, onSelectBook }) {
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

    const inStock = (Number(book.quantity) || 0) > 0;

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
                            <span className="detail-badge-stock">Còn hàng ({book.quantity} cuốn)</span>
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

