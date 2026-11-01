import { useState, useMemo, useEffect, useCallback } from 'react';
import WishlistCard from './WishlistCard';
import EmptyWishlist from './EmptyWishlist';
import './Wishlist.css';

function cleanWishlistData(rawList) {
    if (!Array.isArray(rawList)) return [];
    const seen = new Set();
    const result = [];

    for (const it of rawList) {
        if (!it || typeof it !== 'object') continue;
        const id = it.bookId || it.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const stock = Math.max(0, Number(it.stock ?? it.quantityInStock ?? 999));

        result.push({
            ...it,
            id,
            bookId: id,
            title: String(it.title || 'Ấn phẩm sách'),
            author: it.author ? String(it.author) : '',
            price: Math.max(0, Number(it.price) || 0),
            discount: Math.max(0, Math.min(100, Number(it.discount) || 0)),
            stock,
            image: it.image || null
        });
    }

    return result;
}

function WishlistPage({ 
    wishlist = null, 
    onContinueShopping, 
    onSelectBook,
    onAddToCartOverride,
    onRemoveOverride,
    onClearOverride
}) {
    const [items, setItems] = useState(() => {
        if (wishlist && Array.isArray(wishlist.items)) return cleanWishlistData(wishlist.items);
        try {
            const saved = localStorage.getItem('guestWishlist');
            if (saved) {
                const parsed = JSON.parse(saved);
                return cleanWishlistData(parsed);
            }
        } catch {
            return [];
        }
        return [];
    });

    const [toast, setToast] = useState(null);
    const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);

    const triggerToast = useCallback((message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 3000);
    }, []);

    useEffect(() => {
        const handleStorage = (e) => {
            if (e.key === 'guestWishlist') {
                try {
                    const next = JSON.parse(e.newValue || '[]');
                    setItems(cleanWishlistData(next));
                } catch {
                    setItems([]);
                }
            }
        };
        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && showClearConfirmModal) {
                setShowClearConfirmModal(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showClearConfirmModal]);

    const handleAddToCart = (book) => {
        if (onAddToCartOverride) {
            onAddToCartOverride(book);
            return;
        }

        const rawStock = Number(book.stock ?? book.quantityInStock ?? 999);
        const stockCount = Math.max(0, Number.isFinite(rawStock) ? rawStock : 999);
        if (stockCount <= 0) {
            triggerToast('Sản phẩm này tạm thời hết hàng trong kho.', 'warning');
            return;
        }

        try {
            const currentCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
            const bookId = book.bookId || book.id;
            const existingIndex = currentCart.findIndex((item) => (item.bookId || item.id) === bookId);

            if (existingIndex >= 0) {
                const currentQty = Number(currentCart[existingIndex].quantity) || 1;
                if (currentQty >= stockCount) {
                    triggerToast(`Bạn đã thêm tối đa ${stockCount} cuốn có sẵn trong kho.`, 'warning');
                    return;
                }
                currentCart[existingIndex].quantity = Math.min(stockCount, currentQty + 1);
            } else {
                currentCart.push({
                    id: bookId,
                    bookId: bookId,
                    title: book.title,
                    author: book.author,
                    price: book.price,
                    discount: book.discount,
                    quantity: 1,
                    stock: stockCount,
                    image: book.image
                });
            }
            localStorage.setItem('guestCart', JSON.stringify(currentCart));
            triggerToast(`Đã thêm "${book.title}" vào giỏ hàng.`, 'success');
        } catch {
            triggerToast('Không thể lưu giỏ hàng vào trình duyệt.', 'warning');
        }
    };

    const handleAddAllToCart = () => {
        const availableItems = items.filter((it) => it.stock > 0);
        if (availableItems.length === 0) {
            triggerToast('Không có sách nào còn hàng để thêm vào giỏ.', 'warning');
            return;
        }

        try {
            const currentCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
            let addedCount = 0;

            availableItems.forEach((book) => {
                const bookId = book.bookId || book.id;
                const existingIndex = currentCart.findIndex((item) => (item.bookId || item.id) === bookId);
                const stockCount = book.stock;

                if (existingIndex >= 0) {
                    const currentQty = Number(currentCart[existingIndex].quantity) || 1;
                    if (currentQty < stockCount) {
                        currentCart[existingIndex].quantity = Math.min(stockCount, currentQty + 1);
                        addedCount += 1;
                    }
                } else {
                    currentCart.push({
                        id: bookId,
                        bookId: bookId,
                        title: book.title,
                        author: book.author,
                        price: book.price,
                        discount: book.discount,
                        quantity: 1,
                        stock: stockCount,
                        image: book.image
                    });
                    addedCount += 1;
                }
            });

            localStorage.setItem('guestCart', JSON.stringify(currentCart));
            triggerToast(`Đã thêm ${addedCount} cuốn sách vào giỏ hàng thành công!`, 'success');
        } catch {
            triggerToast('Không thể đồng bộ giỏ hàng.', 'warning');
        }
    };

    const handleRemove = (bookId) => {
        if (onRemoveOverride) {
            onRemoveOverride(bookId);
            return;
        }

        setItems((prev) => {
            const next = prev.filter((it) => (it.bookId || it.id) !== bookId);
            try {
                localStorage.setItem('guestWishlist', JSON.stringify(next));
            } catch {
                return next;
            }
            return next;
        });
        triggerToast('Đã xóa khỏi danh sách yêu thích.', 'info');
    };

    const confirmClearAll = () => {
        if (onClearOverride) {
            onClearOverride();
        } else {
            setItems([]);
            try {
                localStorage.removeItem('guestWishlist');
            } catch {
                return;
            }
        }
        setShowClearConfirmModal(false);
        triggerToast('Đã làm trống toàn bộ danh sách yêu thích.', 'info');
    };

    const inStockCount = useMemo(() => {
        return items.filter((it) => it.stock > 0).length;
    }, [items]);

    return (
        <div className="wishlist-page-wrapper">
            <div className="wishlist-container">
                <div className="wishlist-header-section">
                    <h1 className="wishlist-page-title">
                        Danh sách yêu thích 
                        {items.length > 0 && <span className="wishlist-items-counter">({items.length} cuốn sách)</span>}
                    </h1>

                    {items.length > 0 && (
                        <div className="wishlist-header-actions">
                            <button 
                                type="button" 
                                className="wishlist-header-btn add-all"
                                disabled={inStockCount === 0}
                                onClick={handleAddAllToCart}
                            >
                                🛒 Thêm tất cả vào giỏ ({inStockCount})
                            </button>
                            <button 
                                type="button" 
                                className="wishlist-header-btn clear-all"
                                onClick={() => setShowClearConfirmModal(true)}
                            >
                                🗑 Xóa tất cả
                            </button>
                        </div>
                    )}
                </div>

                {toast && (
                    <div className="wishlist-toast-container">
                        <div className={`wishlist-toast ${toast.type}`}>
                            <span className="wishlist-toast-icon">
                                {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠' : 'ℹ'}
                            </span>
                            <span className="wishlist-toast-message">{toast.message}</span>
                        </div>
                    </div>
                )}

                {items.length === 0 ? (
                    <EmptyWishlist onExploreBooks={onContinueShopping} />
                ) : (
                    <div className="wishlist-grid">
                        {items.map((item) => {
                            const itemId = item.bookId || item.id;
                            return (
                                <WishlistCard 
                                    key={itemId}
                                    item={item}
                                    onAddToCart={handleAddToCart}
                                    onRemove={handleRemove}
                                    onSelectBook={onSelectBook}
                                />
                            );
                        })}
                    </div>
                )}

                {showClearConfirmModal && (
                    <div className="wishlist-modal-backdrop" onClick={() => setShowClearConfirmModal(false)}>
                        <div className="wishlist-modal-card" onClick={(e) => e.stopPropagation()}>
                            <div className="wishlist-modal-icon-wrap">
                                <span className="wishlist-modal-icon">💔</span>
                            </div>
                            <h3 className="wishlist-modal-title">Xác nhận làm trống yêu thích</h3>
                            <p className="wishlist-modal-desc">
                                Bạn có chắc chắn muốn xóa toàn bộ {items.length} cuốn sách khỏi danh sách yêu thích?
                            </p>
                            <div className="wishlist-modal-actions">
                                <button 
                                    type="button" 
                                    className="wishlist-modal-btn cancel"
                                    onClick={() => setShowClearConfirmModal(false)}
                                >
                                    Giữ lại sách
                                </button>
                                <button 
                                    type="button" 
                                    className="wishlist-modal-btn confirm"
                                    onClick={confirmClearAll}
                                >
                                    Đồng ý xóa hết
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default WishlistPage;

