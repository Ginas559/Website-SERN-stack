import { useState, useEffect, useMemo } from 'react';
import debounce from 'lodash.debounce';

function CartItem({ item, onUpdateQuantity, onRemove, isSelected, onToggleSelect }) {
    const [imgError, setImgError] = useState(false);

    const rawStock = Number(item.stock ?? item.quantityInStock ?? 999);
    const maxStock = Math.max(0, Number.isFinite(rawStock) ? rawStock : 999);
    const isOutOfStock = maxStock === 0;

    const initialQuantity = isOutOfStock 
        ? 0 
        : Math.max(1, Math.min(maxStock, Number(item.quantity) || 1));

    const [prevQuantity, setPrevQuantity] = useState(initialQuantity);
    const [localQuantity, setLocalQuantity] = useState(initialQuantity);

    if (item.quantity !== prevQuantity) {
        setPrevQuantity(item.quantity);
        setLocalQuantity(isOutOfStock ? 0 : Math.max(1, Math.min(maxStock, Number(item.quantity) || 1)));
    }

    const price = Math.max(0, Number(item.price) || 0);
    const discount = Math.max(0, Math.min(100, Number(item.discount) || 0));
    const finalPrice = discount > 0 
        ? Math.round(price * (100 - discount) / 100) 
        : price;
    const itemTotal = isOutOfStock ? 0 : finalPrice * localQuantity;

    const debouncedUpdate = useMemo(
        () => debounce((bookId, nextQuantity) => {
            if (onUpdateQuantity) {
                onUpdateQuantity(bookId, nextQuantity);
            }
        }, 400),
        [onUpdateQuantity]
    );

    useEffect(() => {
        return () => {
            debouncedUpdate.flush();
        };
    }, [debouncedUpdate]);

    const handleQuantityChange = (nextVal) => {
        if (isOutOfStock) return;
        const validated = Math.max(1, Math.min(maxStock, nextVal));
        setLocalQuantity(validated);
        debouncedUpdate(item.bookId || item.id, validated);
    };

    const handleInputChange = (e) => {
        if (isOutOfStock) return;
        const val = parseInt(e.target.value, 10);
        if (Number.isNaN(val) || val < 1) {
            setLocalQuantity(1);
            debouncedUpdate(item.bookId || item.id, 1);
        } else {
            handleQuantityChange(val);
        }
    };

    const handleKeyDown = (e) => {
        if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
            e.preventDefault();
        }
    };

    const formatPrice = (val) => Number(val).toLocaleString('vi-VN') + ' đ';

    return (
        <tr className={`cart-table-row ${isOutOfStock ? 'out-of-stock-row' : ''}`}>
            <td className="cart-cell-select">
                <input 
                    type="checkbox" 
                    checked={Boolean(isSelected && !isOutOfStock)} 
                    disabled={isOutOfStock}
                    onChange={() => onToggleSelect && onToggleSelect(item.bookId || item.id)}
                    aria-label={`Chọn sách ${item.title}`}
                />
            </td>
            <td className="cart-cell-product">
                <div className="cart-product-info">
                    <div className="cart-product-cover-wrap">
                        {item.image && !imgError ? (
                            <img 
                                src={item.image} 
                                alt={item.title} 
                                className="cart-product-img"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="cart-product-placeholder">📖</div>
                        )}
                    </div>
                    <div className="cart-product-details">
                        <div className="cart-product-title" title={item.title}>{item.title}</div>
                        {item.author && <div className="cart-product-author">Tác giả: {item.author}</div>}
                        {isOutOfStock ? (
                            <div className="cart-product-stock-out">Tạm hết hàng</div>
                        ) : maxStock < 10 ? (
                            <div className="cart-product-stock-warning">Chỉ còn {maxStock} cuốn trong kho</div>
                        ) : null}
                    </div>
                </div>
            </td>
            <td className="cart-cell-price">
                <div className="cart-price-block">
                    <span className="cart-price-current">{formatPrice(finalPrice)}</span>
                    {discount > 0 && (
                        <div className="cart-price-discount-wrap">
                            <span className="cart-price-original">{formatPrice(price)}</span>
                            <span className="cart-discount-badge">-{discount}%</span>
                        </div>
                    )}
                </div>
            </td>
            <td className="cart-cell-quantity">
                {isOutOfStock ? (
                    <span className="cart-qty-disabled-text">Không khả dụng</span>
                ) : (
                    <div className="cart-qty-control">
                        <button 
                            type="button" 
                            className="cart-qty-btn minus"
                            disabled={localQuantity <= 1}
                            onClick={() => handleQuantityChange(localQuantity - 1)}
                            aria-label="Giảm số lượng"
                        >
                            −
                        </button>
                        <input 
                            type="number" 
                            className="cart-qty-input" 
                            value={localQuantity} 
                            min="1" 
                            max={maxStock}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            aria-label="Số lượng sách"
                        />
                        <button 
                            type="button" 
                            className="cart-qty-btn plus"
                            disabled={localQuantity >= maxStock}
                            onClick={() => handleQuantityChange(localQuantity + 1)}
                            aria-label="Tăng số lượng"
                        >
                            +
                        </button>
                    </div>
                )}
            </td>
            <td className="cart-cell-subtotal">
                <span className="cart-subtotal-text">
                    {isOutOfStock ? '0 đ' : formatPrice(itemTotal)}
                </span>
            </td>
            <td className="cart-cell-action">
                <button 
                    type="button" 
                    className="cart-remove-btn" 
                    onClick={() => onRemove && onRemove(item.bookId || item.id)}
                    title="Xóa cuốn sách này khỏi giỏ hàng"
                    aria-label="Xóa"
                >
                    ✕
                </button>
            </td>
        </tr>
    );
}

export default CartItem;
