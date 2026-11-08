
import { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { addToWishlist, removeFromWishlist } from '../store/slices/wishlistSlice';

function BookCard({ book, onSelectBook, onToggleFavorite, isFavoriteProp }) {
    const dispatch = useDispatch();
    const reduxWishlist = useSelector((state) => state.wishlist);
    const isAuthenticated = Boolean(localStorage.getItem('accessToken'));

    const isFavoriteRedux = isAuthenticated && Array.isArray(reduxWishlist.items)
        ? reduxWishlist.items.some((it) => (it.bookId || it.id) === book.id)
        : null;

    const [imgError, setImgError] = useState(false);
    const [optimisticState, setOptimisticState] = useState(null);
    const [localFavorite, setLocalFavorite] = useState(() => {
        try {
            const saved = JSON.parse(localStorage.getItem('guestWishlist') || '[]');
            return saved.some((it) => (it.bookId || it.id) === book.id);
        } catch {
            return false;
        }
    });

    const isFavorite = optimisticState !== null
        ? optimisticState
        : typeof isFavoriteProp === 'boolean'
            ? isFavoriteProp
            : (isFavoriteRedux !== null ? isFavoriteRedux : localFavorite);

    const discount = Math.max(0, Math.min(100, Number(book.discount) || 0));
    const originalPrice = Math.max(0, Number(book.price) || 0);
    const finalPrice = discount > 0 
        ? Math.round(originalPrice * (100 - discount) / 100) 
        : originalPrice;

    const formatPrice = (val) => Number(val).toLocaleString('vi-VN') + ' đ';

    const categoryName = Array.isArray(book.categories) && book.categories.length > 0
        ? book.categories.map((c) => c.name).join(', ')
        : '';

    const handleHeartClick = (e) => {
        e.stopPropagation();
        const nextState = !isFavorite;
        setOptimisticState(nextState);
        setLocalFavorite(nextState);

        if (onToggleFavorite) {
            onToggleFavorite(book, nextState);
            return;
        }

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
                        stock: Number(book.quantity ?? book.stock ?? 999),
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
        <div className="book-card" onClick={() => onSelectBook && onSelectBook(book.id)}>
            <div>
                <div className="book-cover-wrap">
                    {book.image && !imgError ? (
                        <img 
                            src={book.image} 
                            alt={book.title} 
                            className="book-cover"
                            onError={(e) => {
                                setImgError(true);
                                e.target.style.display = "none";
                                if (e.target.nextSibling) e.target.nextSibling.style.display = "flex";
                            }}
                        />
                    ) : null}
                    <div 
                        className="book-cover-placeholder" 
                        style={{ display: book.image && !imgError ? "none" : "flex" }}
                    >
                        📚
                    </div>

                    {discount > 0 && (
                        <span className="discount-badge">-{discount}%</span>
                    )}

                    <button 
                        type="button"
                        className="book-card-heart-btn"
                        onClick={handleHeartClick}
                        title={isFavorite ? 'Bỏ thích' : 'Thêm vào yêu thích'}
                        aria-label={isFavorite ? 'Bỏ thích' : 'Thêm vào yêu thích'}
                    >
                        {isFavorite ? '❤️' : '🤍'}
                    </button>
                </div>

                {categoryName && (
                    <div className="book-card-category">{categoryName}</div>
                )}

                <h3 className="book-card-title" title={book.title}>{book.title}</h3>
                <div className="book-card-author">{book.author}</div>
            </div>

            <div>
                <div className="book-card-price-row">
                    <span className="book-card-price">{formatPrice(finalPrice)}</span>
                    {discount > 0 && (
                        <span className="book-card-old-price">{formatPrice(originalPrice)}</span>
                    )}
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
