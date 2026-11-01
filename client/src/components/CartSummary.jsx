function CartSummary({ 
    selectedCount, 
    subtotal, 
    shippingFee, 
    total, 
    onCheckout, 
    onContinueShopping,
    isCheckingOut
}) {
    const formatPrice = (val) => Number(val).toLocaleString('vi-VN') + ' đ';

    return (
        <div className="cart-summary-card">
            <h3 className="cart-summary-title">Tóm tắt đơn hàng</h3>
            
            <div className="cart-summary-row">
                <span className="cart-summary-label">Số lượng đã chọn:</span>
                <span className="cart-summary-value">{selectedCount} cuốn sách</span>
            </div>

            <div className="cart-summary-row">
                <span className="cart-summary-label">Tạm tính:</span>
                <span className="cart-summary-value">{formatPrice(subtotal)}</span>
            </div>

            <div className="cart-summary-row">
                <span className="cart-summary-label">Phí vận chuyển:</span>
                <span className="cart-summary-value">
                    {shippingFee === 0 ? (
                        <span className="cart-free-shipping-badge">Miễn phí</span>
                    ) : (
                        formatPrice(shippingFee)
                    )}
                </span>
            </div>

            <div className="cart-summary-divider" />

            <div className="cart-summary-row total-row">
                <span className="cart-summary-label-total">Tổng thanh toán:</span>
                <span className="cart-summary-value-total">{formatPrice(total)}</span>
            </div>
            <div className="cart-vat-note">(Đã bao gồm thuế VAT nếu có)</div>

            <button 
                type="button" 
                className="cart-checkout-btn" 
                disabled={selectedCount === 0 || isCheckingOut}
                onClick={onCheckout}
            >
                {isCheckingOut ? 'Đang chuyển trang...' : 'Tiến hành đặt hàng'}
            </button>

            <button 
                type="button" 
                className="cart-continue-btn"
                onClick={onContinueShopping}
            >
                ← Tiếp tục xem sách
            </button>
        </div>
    );
}

export default CartSummary;
