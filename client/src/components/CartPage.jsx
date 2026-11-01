import { useState, useMemo, useEffect, useCallback } from 'react';
import CartTable from './CartTable';
import CartSummary from './CartSummary';
import EmptyCart from './EmptyCart';
import './Cart.css';

function cleanCartData(rawList) {
    if (!Array.isArray(rawList)) return [];
    const seen = new Set();
    const result = [];

    for (const it of rawList) {
        if (!it || typeof it !== 'object') continue;
        const id = it.bookId || it.id;
        if (!id || seen.has(id)) continue;
        seen.add(id);

        const stock = Math.max(0, Number(it.stock ?? it.quantityInStock ?? 999));
        const safeQuantity = stock > 0 
            ? Math.max(1, Math.min(stock, Number(it.quantity) || 1)) 
            : 0;

        result.push({
            ...it,
            id,
            bookId: id,
            title: String(it.title || 'Ấn phẩm sách'),
            author: it.author ? String(it.author) : '',
            price: Math.max(0, Number(it.price) || 0),
            discount: Math.max(0, Math.min(100, Number(it.discount) || 0)),
            quantity: safeQuantity,
            stock
        });
    }

    return result;
}

function CartPage({ 
    cart = null, 
    onContinueShopping, 
    onCheckout, 
    onUpdateQuantityOverride, 
    onRemoveItemOverride, 
    onClearCartOverride 
}) {
    const [items, setItems] = useState(() => {
        if (cart && Array.isArray(cart.items)) return cleanCartData(cart.items);
        try {
            const saved = localStorage.getItem('guestCart');
            if (saved) {
                const parsed = JSON.parse(saved);
                return cleanCartData(parsed);
            }
        } catch {
            return [];
        }
        return [];
    });

    const [selectedItemIds, setSelectedItemIds] = useState(() => {
        return items
            .filter((it) => it.stock > 0)
            .map((it) => it.bookId || it.id);
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
            if (e.key === 'guestCart') {
                try {
                    const next = JSON.parse(e.newValue || '[]');
                    setItems(cleanCartData(next));
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

    const handleToggleSelect = (itemId) => {
        const item = items.find((it) => (it.bookId || it.id) === itemId);
        if (item && item.stock <= 0) {
            triggerToast('Sản phẩm này tạm thời hết hàng, không thể chọn mua.', 'warning');
            return;
        }

        setSelectedItemIds((prev) => 
            prev.includes(itemId) 
                ? prev.filter((id) => id !== itemId) 
                : [...prev, itemId]
        );
    };

    const handleToggleSelectAll = () => {
        const availableItemIds = items
            .filter((it) => it.stock > 0)
            .map((it) => it.bookId || it.id);

        if (availableItemIds.length === 0) {
            triggerToast('Không có sản phẩm nào còn hàng để chọn.', 'warning');
            return;
        }

        const isAllAvailableSelected = availableItemIds.every((id) => selectedItemIds.includes(id));
        if (isAllAvailableSelected) {
            setSelectedItemIds([]);
        } else {
            setSelectedItemIds(availableItemIds);
        }
    };

    const handleUpdateQuantity = (bookId, nextQuantity) => {
        if (onUpdateQuantityOverride) {
            onUpdateQuantityOverride(bookId, nextQuantity);
            return;
        }

        setItems((prev) => {
            const next = prev.map((item) => {
                const id = item.bookId || item.id;
                if (id === bookId) {
                    const safeQuantity = item.stock > 0 
                        ? Math.max(1, Math.min(item.stock, nextQuantity)) 
                        : 0;
                    return { ...item, quantity: safeQuantity };
                }
                return item;
            });
            try {
                localStorage.setItem('guestCart', JSON.stringify(next));
            } catch {
                return next;
            }
            return next;
        });

        triggerToast('Đã cập nhật số lượng cuốn sách.', 'success');
    };

    const handleRemoveItem = (bookId) => {
        if (onRemoveItemOverride) {
            onRemoveItemOverride(bookId);
            return;
        }

        setItems((prev) => {
            const next = prev.filter((item) => (item.bookId || item.id) !== bookId);
            try {
                localStorage.setItem('guestCart', JSON.stringify(next));
            } catch {
                return next;
            }
            return next;
        });
        setSelectedItemIds((prev) => prev.filter((id) => id !== bookId));
        triggerToast('Đã xóa cuốn sách khỏi giỏ hàng.', 'info');
    };

    const requestClearCart = () => {
        if (items.length === 0) return;
        setShowClearConfirmModal(true);
    };

    const confirmClearCart = () => {
        if (onClearCartOverride) {
            onClearCartOverride();
        } else {
            setItems([]);
            setSelectedItemIds([]);
            try {
                localStorage.removeItem('guestCart');
            } catch {
                return;
            }
        }
        setShowClearConfirmModal(false);
        triggerToast('Đã làm trống toàn bộ giỏ hàng.', 'info');
    };

    const selectedItems = useMemo(() => {
        return items.filter((item) => {
            const id = item.bookId || item.id;
            return item.stock > 0 && selectedItemIds.includes(id);
        });
    }, [items, selectedItemIds]);

    const { selectedCount, subtotal } = useMemo(() => {
        let count = 0;
        let sum = 0;
        selectedItems.forEach((item) => {
            const finalPrice = item.discount > 0 
                ? Math.round(item.price * (100 - item.discount) / 100) 
                : item.price;
            const qty = Math.max(1, Number(item.quantity) || 1);
            count += qty;
            sum += finalPrice * qty;
        });
        return { selectedCount: count, subtotal: sum };
    }, [selectedItems]);

    const shippingFee = subtotal >= 250000 || subtotal === 0 ? 0 : 25000;
    const total = subtotal + shippingFee;

    const handleCheckoutAction = () => {
        if (selectedItems.length === 0) {
            triggerToast('Vui lòng tích chọn ít nhất 1 cuốn sách còn hàng để đặt hàng.', 'warning');
            return;
        }
        if (onCheckout) {
            onCheckout(selectedItems, total);
        }
    };

    return (
        <div className="cart-page-wrapper">
            <div className="cart-container">
                <div className="cart-header-section">
                    <h1 className="cart-page-title">
                        Giỏ hàng mua sắm 
                        {items.length > 0 && <span className="cart-items-counter">({items.length} đầu sách)</span>}
                    </h1>
                    <div className="cart-breadcrumbs">
                        <span className="crumb-link" onClick={onContinueShopping}>Trang chủ</span>
                        <span className="crumb-sep">/</span>
                        <span className="crumb-current">Giỏ hàng</span>
                    </div>
                </div>

                {toast && (
                    <div className="cart-toast-container">
                        <div className={`cart-toast ${toast.type}`}>
                            <span className="cart-toast-icon">
                                {toast.type === 'success' ? '✓' : toast.type === 'warning' ? '⚠' : 'ℹ'}
                            </span>
                            <span className="cart-toast-message">{toast.message}</span>
                        </div>
                    </div>
                )}

                {items.length === 0 ? (
                    <EmptyCart onExploreBooks={onContinueShopping} />
                ) : (
                    <div className="cart-content-layout">
                        <div className="cart-main-column">
                            <CartTable 
                                items={items}
                                selectedItemIds={selectedItemIds}
                                onToggleSelectAll={handleToggleSelectAll}
                                onToggleSelect={handleToggleSelect}
                                onUpdateQuantity={handleUpdateQuantity}
                                onRemoveItem={handleRemoveItem}
                                onClearCart={requestClearCart}
                            />
                        </div>

                        <div className="cart-sidebar-column">
                            <CartSummary 
                                selectedCount={selectedCount}
                                subtotal={subtotal}
                                shippingFee={shippingFee}
                                total={total}
                                onCheckout={handleCheckoutAction}
                                onContinueShopping={onContinueShopping}
                            />
                        </div>
                    </div>
                )}

                {showClearConfirmModal && (
                    <div className="cart-modal-backdrop" onClick={() => setShowClearConfirmModal(false)}>
                        <div className="cart-modal-card" onClick={(e) => e.stopPropagation()}>
                            <div className="cart-modal-icon-wrap">
                                <span className="cart-modal-icon">🗑️</span>
                            </div>
                            <h3 className="cart-modal-title">Xác nhận làm trống giỏ hàng</h3>
                            <p className="cart-modal-desc">
                                Bạn có chắc chắn muốn xóa toàn bộ {items.length} sản phẩm khỏi giỏ hàng? Thao tác này không thể hoàn tác.
                            </p>
                            <div className="cart-modal-actions">
                                <button 
                                    type="button" 
                                    className="cart-modal-btn cancel"
                                    onClick={() => setShowClearConfirmModal(false)}
                                >
                                    Giữ lại sách
                                </button>
                                <button 
                                    type="button" 
                                    className="cart-modal-btn confirm"
                                    onClick={confirmClearCart}
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

export default CartPage;
