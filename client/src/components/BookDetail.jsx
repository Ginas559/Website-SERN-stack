
import { useState, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import BookCard from "./BookCard";
import BookReviews from "./BookReviews";
import { addToCart } from "../store/slices/cartSlice";
import { addToWishlist, removeFromWishlist } from "../store/slices/wishlistSlice";

function BookDetail({
    book,
    onBack,
    onSelectBook,
    onAddToCart,
    currentUser,
    onRequireLogin,
    initialReviewTab = 'reviews',
    scrollToReviews = false,
    scrollToOwnReview = false
}) {
    const dispatch = useDispatch();
    const reduxWishlist = useSelector((state) => state.wishlist);
    const isAuthenticated = Boolean(localStorage.getItem('accessToken'));

    const [quantity, setQuantity] = useState(1);
    const [addedNotice, setAddedNotice] = useState(false);
    const [optimisticFavorite, setOptimisticFavorite] = useState(null);

    const isFavoriteRedux = isAuthenticated && Array.isArray(reduxWishlist.items)
        ? reduxWishlist.items.some((it) => (it.bookId || it.id) === book.id)
        : null;

    const [isFavoriteLocal, setIsFavoriteLocal] = useState(() => {
        try {
            const current = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
            return current.some((it) => (it.bookId || it.id) === book.id);
        } catch {
            return false;
        }
    });

    const isFavorite = optimisticFavorite !== null
        ? optimisticFavorite
        : (isFavoriteRedux !== null ? isFavoriteRedux : isFavoriteLocal);

    
    useEffect(() => {
        const searchParams = new URLSearchParams(window.location.search);
        const hasDiscussionTab = searchParams.get('tab') === 'discussion';
        const hasReviewFocus = searchParams.get('focus') === 'review';
        const hasReviewHash = window.location.hash === '#book-reviews-section';

        if (hasDiscussionTab || hasReviewFocus || hasReviewHash || scrollToReviews) {
            const timer = setTimeout(() => {
                const section = document.getElementById('book-reviews-section');
                if (section) {
                    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 180);
            return () => clearTimeout(timer);
        }
    }, [book?.id, scrollToReviews]);

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
        } else if (isAuthenticated) {
            dispatch(addToCart({ bookId: book.id, quantity }));
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

    const handleToggleFavorite = () => {
        const nextState = !isFavorite;
        setOptimisticFavorite(nextState);
        setIsFavoriteLocal(nextState);

        if (isAuthenticated) {
            if (nextState) {
                dispatch(addToWishlist(book.id));
            } else {
                dispatch(removeFromWishlist(book.id));
            }
            return;
        }

        try {
            const current = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
            if (nextState) {
                if (!current.some((it) => (it.bookId || it.id) === book.id)) {
                    current.push({
                        id: book.id,
                        bookId: book.id,
                        title: book.title,
                        author: book.author,
                        price: originalPrice,
                        discount,
                        stock: stockCount,
                        image: book.image
                    });
                }
            } else {
                const filtered = current.filter((it) => (it.bookId || it.id) !== book.id);
                localStorage.setItem('guestWishlist', JSON.stringify(filtered));
                return;
            }
            localStorage.setItem('guestWishlist', JSON.stringify(current));
        } catch {
            return;
        }
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

                    <div style={{ display: "flex", alignItems: "center", gap: "14px", margin: "16px 0", flexWrap: "wrap" }}>
                        {inStock ? (
                            <>
                                <div style={{ display: "inline-flex", alignItems: "center", height: "42px", border: "1px solid #d9d0c2", borderRadius: "8px", background: "#ffffff", overflow: "hidden", boxSizing: "border-box" }}>
                                    <button
                                        type="button"
                                        disabled={quantity <= 1}
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        style={{ width: "38px", height: "100%", border: "none", background: "#f5ede0", color: "#20201f", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}
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
                                        style={{
                                            width: "52px",
                                            minWidth: "48px",
                                            height: "100%",
                                            textAlign: "center",
                                            border: "none",
                                            borderLeft: "1px solid #d9d0c2",
                                            borderRight: "1px solid #d9d0c2",
                                            fontWeight: "700",
                                            color: "#20201f",
                                            padding: "0 4px",
                                            boxSizing: "border-box",
                                            outline: "none",
                                            fontSize: "15px"
                                        }}
                                    />
                                    <button
                                        type="button"
                                        disabled={quantity >= stockCount}
                                        onClick={() => setQuantity(Math.min(stockCount, quantity + 1))}
                                        style={{ width: "38px", height: "100%", border: "none", background: "#f5ede0", color: "#20201f", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "16px" }}
                                    >
                                        +
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleAdd}
                                    style={{
                                        height: "42px",
                                        padding: "0 22px",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        background: "#c77736",
                                        color: "#fff",
                                        border: "none",
                                        borderRadius: "8px",
                                        fontWeight: "700",
                                        cursor: "pointer",
                                        transition: "background 0.2s",
                                        boxSizing: "border-box"
                                    }}
                                >
                                    🛒 Thêm vào giỏ hàng
                                </button>
                            </>
                        ) : null}

                        <button
                            type="button"
                            onClick={handleToggleFavorite}
                            style={{
                                padding: "10px 18px",
                                background: isFavorite ? "#fbf0ea" : "#ffffff",
                                color: isFavorite ? "#b33b32" : "#20201f",
                                border: isFavorite ? "1px solid #e28a83" : "1px solid #d9d0c2",
                                borderRadius: "8px",
                                fontWeight: "700",
                                cursor: "pointer",
                                transition: "all 0.2s",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "8px"
                            }}
                            title={isFavorite ? "Bỏ thích" : "Thêm vào yêu thích"}
                        >
                            <span>{isFavorite ? "❤️" : "🤍"}</span>
                            <span>{isFavorite ? "Đã thích" : "Yêu thích"}</span>
                        </button>
                    </div>

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

            <div id="book-reviews-section">
            <BookReviews 
                key={`${book.id}-${initialReviewTab}`}
                bookId={book.id} 
                currentUser={currentUser} 
                onRequireLogin={onRequireLogin}
                initialTab={initialReviewTab}
                scrollToOwnReview={scrollToOwnReview}
            />
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
