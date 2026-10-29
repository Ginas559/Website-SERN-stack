function BookCard({ book, onSelectBook }) {
    const discount = Number(book.discount) || 0;
    const originalPrice = Number(book.price) || 0;
    const finalPrice = discount > 0 
        ? Math.round(originalPrice * (100 - discount) / 100) 
        : originalPrice;

    const formatPrice = (val) => Number(val).toLocaleString("vi-VN") + " đ";

    const categoryName = Array.isArray(book.categories) && book.categories.length > 0
        ? book.categories.map((c) => c.name).join(", ")
        : "";

    return (
        <div className="book-card" onClick={() => onSelectBook && onSelectBook(book.id)}>
            <div>
                <div className="book-cover-wrap">
                    {book.image ? (
                        <img 
                            src={book.image} 
                            alt={book.title} 
                            className="book-cover"
                            onError={(e) => {
                                e.target.style.display = "none";
                                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                            }}
                        />
                    ) : null}
                    <div 
                        className="book-cover-placeholder" 
                        style={{ display: book.image ? "none" : "flex" }}
                    >
                        📚
                    </div>
                    {discount > 0 ? (
                        <span className="discount-badge">-{discount}%</span>
                    ) : null}
                </div>

                {categoryName ? (
                    <div className="book-card-category">{categoryName}</div>
                ) : null}

                <h3 className="book-card-title" title={book.title}>{book.title}</h3>
                <div className="book-card-author">{book.author}</div>
            </div>

            <div>
                <div className="book-card-price-row">
                    <span className="book-card-price">{formatPrice(finalPrice)}</span>
                    {discount > 0 ? (
                        <span className="book-card-old-price">{formatPrice(originalPrice)}</span>
                    ) : null}
                </div>

                <button 
                    type="button" 
                    className="book-card-btn"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onSelectBook) onSelectBook(book.id);
                    }}
                >
                    Xem chi tiết
                </button>
            </div>
        </div>
    );
}

export default BookCard;

