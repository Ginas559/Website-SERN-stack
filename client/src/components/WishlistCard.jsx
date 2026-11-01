import { useState } from 'react';

function WishlistCard({ item, onAddToCart, onRemove, onSelectBook }) {
    const [imgError, setImgError] = useState(false);

    const price = Math.max(0, Number(item.price) || 0);
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const finalPrice = discount > 0 
        ? Math.round(price * (100 - discount) / 100) 
        : price;

    const rawStock = Number(item.stock ?? item.quantityInStock ?? 999);
    const maxStock = Math.max(0, Number.isFinite(rawStock) ? rawStock : 999);
    const inStock = maxStock > 0;

    const formatPrice = (val) => Number(val).toLocaleString('vi-VN') + ' đ';

    const bookId = item.bookId || item.id;

    return (
        <div className={`wishlist-card ${!inStock ? 'out-of-stock-card' : ''}`}>
            <div 
                className="wishlist-cover-wrap"
                onClick={() => onSelectBook && onSelectBook(bookId)}
            >
                {item.image && !imgError ? (
                    <img 
                        src={item.image} 
                        alt={item.title} 
                        className="wishlist-cover-img"
                        onError={() => setImgError(true)}
                    />
                ) : (
                    <div className="wishlist-placeholder-cover">📖</div>
                )}

                {discount > 0 && (
                    <span className="wishlist-discount-badge">-{discount}%</span>
                )}

                <button 
                    type="button" 
                    className="wishlist-remove-icon-btn"
                    title="Xóa khỏi danh sách yêu thích"
                    onClick={(e) => {
                        e.stopPropagation();
                        if (onRemove) onRemove(bookId);
                    }}
                    aria-label="Bỏ thích"
                >
                    ✕
                </button>
            </div>

            <div className="wishlist-info-block">
                <div className="wishlist-stock-status">
                    {inStock ? (
                        <span className="wishlist-stock-badge-in">Còn {maxStock} cuốn</span>
                    ) : (
                        <span className="wishlist-stock-badge-out">Tạm hết hàng</span>
                    )}
                </div>

                <h3 
                    className="wishlist-book-title" 
                    title={item.title}
                    onClick={() => onSelectBook && onSelectBook(bookId)}
                >
                    {item.title}
                </h3>
                {item.author && <div className="wishlist-book-author">Tác giả: {item.author}</div>}

                <div className="wishlist-price-row">
                    <span className="wishlist-price-current">{formatPrice(finalPrice)}</span>
                    {discount > 0 && (
                        <span className="wishlist-price-original">{formatPrice(price)}</span>
                    )}
                </div>

                <div className="wishlist-actions-row">
                    <button 
                        type="button" 
                        className="wishlist-add-cart-btn"
                        disabled={!inStock}
                        onClick={() => onAddToCart && onAddToCart(item)}
                    >
                        {inStock ? '🛒 Thêm vào giỏ' : 'Hết hàng'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default WishlistCard;

