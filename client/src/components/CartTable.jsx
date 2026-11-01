import CartItem from './CartItem';

function CartTable({ 
    items, 
    selectedItemIds, 
    onToggleSelectAll, 
    onToggleSelect, 
    onUpdateQuantity, 
    onRemoveItem, 
    onClearCart 
}) {
    const availableItems = items.filter((it) => {
        const stock = Number(it.stock ?? it.quantityInStock ?? 999);
        return stock > 0;
    });

    const isAllSelected = availableItems.length > 0 && availableItems.every((it) => 
        selectedItemIds.includes(it.bookId || it.id)
    );

    return (
        <div className="cart-table-container">
            <table className="cart-table">
                <thead>
                    <tr>
                        <th className="cart-th-select">
                            <input 
                                type="checkbox" 
                                checked={isAllSelected} 
                                disabled={availableItems.length === 0}
                                onChange={onToggleSelectAll}
                                aria-label="Chọn tất cả sản phẩm còn hàng"
                            />
                        </th>
                        <th className="cart-th-product">Sản phẩm</th>
                        <th className="cart-th-price">Đơn giá</th>
                        <th className="cart-th-quantity">Số lượng</th>
                        <th className="cart-th-subtotal">Thành tiền</th>
                        <th className="cart-th-action">Xóa</th>
                    </tr>
                </thead>
                <tbody>
                    {items.map((item) => {
                        const itemId = item.bookId || item.id;
                        return (
                            <CartItem 
                                key={itemId}
                                item={item}
                                isSelected={selectedItemIds.includes(itemId)}
                                onToggleSelect={onToggleSelect}
                                onUpdateQuantity={onUpdateQuantity}
                                onRemove={onRemoveItem}
                            />
                        );
                    })}
                </tbody>
            </table>

            <div className="cart-table-footer">
                <div className="cart-footer-left">
                    <button 
                        type="button" 
                        className="cart-action-link-btn clear-all"
                        onClick={onClearCart}
                    >
                        🗑 Làm trống giỏ hàng
                    </button>
                </div>
                <div className="cart-footer-right">
                    <span className="cart-selected-count-badge">
                        Đã chọn: <strong>{selectedItemIds.length}</strong> / {availableItems.length} sản phẩm khả dụng
                    </span>
                </div>
            </div>
        </div>
    );
}

export default CartTable;
