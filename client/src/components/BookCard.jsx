import { useState } from "react";

function BookCard({ book, onSelectBook, onToggleFavorite, isFavoriteProp }) {
    const [imgError, setImgError] = useState(false);
    const [localFavorite, setLocalFavorite] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem("guestWishlist") || "[]");
            return saved.some((item) => (item.bookId || item.id) === book.id);
        } catch {
            return false;
        }
    });

    const isFavorite = typeof isFavoriteProp === "boolean" ? isFavoriteProp : localFavorite;
    const discount = Number(book.discount) || 0;
    const originalPrice = Number(book.price) || 0;
    const finalPrice = discount > 0
        ? Math.round(originalPrice * (100 - discount) / 100)
        : originalPrice;
    const formatPrice = (value) => Number(value).toLocaleString("vi-VN") + " đ";
    const categoryName = Array.isArray(book.categories) && book.categories.length > 0
        ? book.categories.map((category) => category.name).join(", ")
        : "";

    const handleHeartClick = (event) => {
        event.stopPropagation();
        const nextState = !isFavorite;
        setLocalFavorite(nextState);

        if (onToggleFavorite) {
            onToggleFavorite(book, nextState);
            return;
        }

        try {
            const current = JSON.parse(localStorage.getItem("guestWishlist") || "[]");
            if (nextState) {
                if (!current.some((item) => (item.bookId || item.id) === book.id)) {
                    current.push({
                        id: book.id,
                        bookId: book.id,
                        title: book.title,
                        author: book.author,
                        price: originalPrice,
                        discount,
                        stock: Number(book.quantity ?? book.stock ?? 999),
                        image: book.image,
                    });
                }
            } else {
                const filtered = current.filter((item) => (item.bookId || item.id) !== book.id);
                localStorage.setItem("guestWishlist", JSON.stringify(filtered));
                return;
            }
            localStorage.setItem("guestWishlist", JSON.stringify(current));
        } catch {
            return;
        }
    };

    return (
        <button
            type="button"
            className="book-card"
            onClick={() => {
                if (onSelectBook) onSelectBook(book.id);
            }}
        >
            <div>
                <div className="book-cover-wrap">
                    {book.image && !imgError ? (
                        <img
                            src={book.image}
                            alt={book.title}
                            className="book-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="book-cover-placeholder">📚</div>
                    )}
                    {discount > 0 ? (
                        <span className="discount-badge">-{discount}%</span>
                    ) : null}
                    <button
                        type="button"
                        className="book-card-heart-btn"
                        onClick={handleHeartClick}
                        title={isFavorite ? "Bỏ thích" : "Thêm vào yêu thích"}
                        aria-label={isFavorite ? "Bỏ thích" : "Thêm vào yêu thích"}
                    >
                        {isFavorite ? "❤️" : "🤍"}
                    </button>
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
                <span className="book-card-btn">Xem chi tiết</span>
            </div>
        </button>
    );
}

export default BookCard;
