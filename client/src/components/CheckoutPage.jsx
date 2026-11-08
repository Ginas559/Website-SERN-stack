import { useState, useMemo, useCallback } from 'react';
import orderService from '../services/orderService';
import './Checkout.css';

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

function CheckoutPage({ 
    checkoutItems = [], 
    onBackToCart, 
    onContinueShopping,
    onViewOrders,
    currentUser = null,
    onOrderCompleted
}) {
    const items = useMemo(() => {
        if (Array.isArray(checkoutItems) && checkoutItems.length > 0) {
            return checkoutItems;
        }
        try {
            const guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
            return Array.isArray(guestCart) ? guestCart.filter((it) => (Number(it.stock ?? 1) > 0)) : [];
        } catch {
            return [];
        }
    }, [checkoutItems]);

    const [form, setForm] = useState(() => ({
        fullName: currentUser?.fullName || '',
        phone: currentUser?.phone || currentUser?.phoneNumber || '',
        email: currentUser?.email || '',
        address: currentUser?.address || '',
        note: ''
    }));

    const [paymentMethod, setPaymentMethod] = useState('COD');
    const [couponInput, setCouponInput] = useState('');
    const [appliedDiscount, setAppliedDiscount] = useState(0);
    const [toast, setToast] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successOrder, setSuccessOrder] = useState(null);

    const triggerToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 3200);
    }, []);

    const handleChangeForm = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const { selectedCount, subtotal } = useMemo(() => {
        let count = 0;
        let sum = 0;
        items.forEach((item) => {
            const finalPrice = item.discount > 0 
                ? Math.round(item.price * (100 - item.discount) / 100) 
                : item.price;
            const qty = Math.max(1, Number(item.quantity) || 1);
            count += qty;
            sum += finalPrice * qty;
        });
        return { selectedCount: count, subtotal: sum };
    }, [items]);

    const shippingFee = subtotal >= 250000 || subtotal === 0 ? 0 : 25000;
    const finalTotal = Math.max(0, subtotal + shippingFee - appliedDiscount);

    const handleApplyCoupon = (e) => {
        e.preventDefault();
        const code = couponInput.trim().toUpperCase();
        if (!code) {
            triggerToast('Vui lòng nhập mã giảm giá.', 'warning');
            return;
        }

        if (code === 'BOOKWEB10') {
            const discountValue = Math.round(subtotal * 0.1);
            setAppliedDiscount(discountValue);
            triggerToast('Áp dụng mã BOOKWEB10 thành công: Giảm 10% đơn hàng.', 'success');
        } else if (code === 'FREESHIP') {
            setAppliedDiscount(shippingFee);
            triggerToast('Áp dụng mã FREESHIP thành công: Miễn phí vận chuyển.', 'success');
        } else {
            triggerToast('Mã giảm giá không hợp lệ hoặc đã hết hạn.', 'warning');
        }
    };

    const handlePlaceOrder = (e) => {
        e.preventDefault();

        if (items.length === 0) {
            triggerToast('Không có sản phẩm nào trong đơn hàng.', 'warning');
            return;
        }

        if (!form.fullName.trim()) {
            triggerToast('Vui lòng nhập họ tên người nhận.', 'warning');
            return;
        }

        const phoneTrimmed = form.phone.trim();
        const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!phoneTrimmed || !phoneRegex.test(phoneTrimmed)) {
            triggerToast('Vui lòng nhập số điện thoại hợp lệ (10 số).', 'warning');
            return;
        }

        const emailTrimmed = form.email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (emailTrimmed && !emailRegex.test(emailTrimmed)) {
            triggerToast('Vui lòng nhập địa chỉ email hợp lệ.', 'warning');
            return;
        }

        if (!form.address.trim()) {
            triggerToast('Vui lòng nhập địa chỉ nhận hàng.', 'warning');
            return;
        }

        if (!localStorage.getItem('accessToken')) {
            triggerToast('Vui lòng đăng nhập tài khoản trước khi đặt hàng.', 'warning');
            return;
        }

        setIsSubmitting(true);

        const orderPayload = {
            receiverName: form.fullName.trim(),
            recipientName: form.fullName.trim(),
            fullName: form.fullName.trim(),
            phone: phoneTrimmed,
            phoneNumber: phoneTrimmed,
            recipientPhone: phoneTrimmed,
            address: form.address.trim(),
            shippingAddress: form.address.trim(),
            note: form.note.trim() || undefined,
            paymentMethod,
            couponCode: couponInput.trim() || undefined,
            selectedBookIds: items.map((it) => Number(it.book_id || it.id))
        };

        orderService.createOrder(orderPayload)
            .then((res) => {
                const createdOrder = res.data || res;
                if (onOrderCompleted) {
                    onOrderCompleted(createdOrder);
                }

                if (paymentMethod === 'VNPAY' && createdOrder.pay_url) {
                    window.location.href = createdOrder.pay_url;
                    return;
                }

                setIsSubmitting(false);
                setSuccessOrder({
                    orderCode: createdOrder.id,
                    fullName: form.fullName.trim(),
                    phone: phoneTrimmed,
                    address: form.address.trim(),
                    total: createdOrder.total ?? finalTotal,
                    paymentMethod: paymentMethod === 'COD' 
                        ? 'Thanh toán khi nhận hàng (COD)' 
                        : paymentMethod === 'VNPAY' 
                            ? 'Cổng thanh toán VNPAY' 
                            : 'Chuyển khoản ngân hàng',
                    itemsCount: selectedCount
                });
            })
            .catch((err) => {
                setIsSubmitting(false);
                triggerToast(err.message || 'Không thể tạo đơn hàng. Vui lòng thử lại.', 'warning');
            });
    };

    if (items.length === 0 && !successOrder) {
        return (
            <div className="checkout-page-wrapper">
                <div className="checkout-container">
                    <div className="checkout-empty-state">
                        <div className="checkout-empty-icon">🛒</div>
                        <h2 className="checkout-empty-title">Không có sản phẩm nào để thanh toán</h2>
                        <p className="checkout-empty-text">Vui lòng quay lại giỏ hàng và tích chọn các cuốn sách bạn muốn mua trước khi tiếp tục.</p>
                        <button 
                            type="button" 
                            className="checkout-empty-btn"
                            onClick={onBackToCart}
                        >
                            Quay lại giỏ hàng
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-page-wrapper">
            {toast && (
                <div className="cart-toast-container">
                    <div className={`cart-toast ${toast.type}`}>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="checkout-container">
                <div className="checkout-header-section">
                    <h1 className="checkout-page-title">Xác nhận & Đặt hàng</h1>
                    <button 
                        type="button" 
                        className="checkout-back-link"
                        onClick={onBackToCart}
                    >
                        ← Quay lại giỏ hàng
                    </button>
                </div>

                <div className="checkout-layout">
                    <div className="checkout-main-content">
                        <div className="checkout-section-card">
                            <h2 className="checkout-section-title">
                                <span>📍</span> 1. Thông tin giao hàng
                            </h2>
                            <div className="checkout-form-grid">
                                <div className="checkout-form-group">
                                    <label className="checkout-label">
                                        Họ và tên người nhận <span className="required">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        name="fullName"
                                        maxLength={100}
                                        className="checkout-input"
                                        placeholder="Ví dụ: Nguyễn Văn A"
                                        value={form.fullName}
                                        onChange={handleChangeForm}
                                    />
                                </div>

                                <div className="checkout-form-group">
                                    <label className="checkout-label">
                                        Số điện thoại <span className="required">*</span>
                                    </label>
                                    <input 
                                        type="tel" 
                                        name="phone"
                                        maxLength={15}
                                        className="checkout-input"
                                        placeholder="Ví dụ: 0912345678"
                                        value={form.phone}
                                        onChange={handleChangeForm}
                                    />
                                </div>

                                <div className="checkout-form-group full-width">
                                    <label className="checkout-label">Email nhận thông báo đơn hàng</label>
                                    <input 
                                        type="email" 
                                        name="email"
                                        maxLength={100}
                                        className="checkout-input"
                                        placeholder="Ví dụ: khachhang@example.com"
                                        value={form.email}
                                        onChange={handleChangeForm}
                                    />
                                </div>

                                <div className="checkout-form-group full-width">
                                    <label className="checkout-label">
                                        Địa chỉ nhận hàng <span className="required">*</span>
                                    </label>
                                    <input 
                                        type="text" 
                                        name="address"
                                        maxLength={255}
                                        className="checkout-input"
                                        placeholder="Số nhà, tên đường, phường/xã, quận/huyện, tỉnh/thành..."
                                        value={form.address}
                                        onChange={handleChangeForm}
                                    />
                                </div>

                                <div className="checkout-form-group full-width">
                                    <label className="checkout-label">Ghi chú cho shipper (Tùy chọn)</label>
                                    <textarea 
                                        name="note"
                                        maxLength={500}
                                        className="checkout-textarea"
                                        placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                                        value={form.note}
                                        onChange={handleChangeForm}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="checkout-section-card">
                            <h2 className="checkout-section-title">
                                <span>🚚</span> 2. Phương thức vận chuyển
                            </h2>
                            <div className="shipping-option-box">
                                <div className="shipping-option-info">
                                    <span className="shipping-title">Giao Hàng Tiêu Chuẩn (GHN Express)</span>
                                    <span className="shipping-subtitle">Thời gian giao dự kiến: 2 - 4 ngày làm việc</span>
                                </div>
                                <div>
                                    {shippingFee === 0 ? (
                                        <span className="shipping-free-tag">Miễn phí</span>
                                    ) : (
                                        <span className="shipping-price-tag">{formatCurrency(shippingFee)}</span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="checkout-section-card">
                            <h2 className="checkout-section-title">
                                <span>💳</span> 3. Phương thức thanh toán
                            </h2>
                            <div className="payment-options-list">
                                <label className={`payment-option-label ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="COD"
                                        checked={paymentMethod === 'COD'}
                                        onChange={() => setPaymentMethod('COD')}
                                        className="payment-radio"
                                    />
                                    <div className="payment-option-text">
                                        <span className="payment-title">Thanh toán khi nhận hàng (COD)</span>
                                        <span className="payment-desc">Thanh toán bằng tiền mặt trực tiếp cho nhân viên bưu tá khi nhận kiện sách.</span>
                                    </div>
                                </label>

                                <label className={`payment-option-label ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="VNPAY"
                                        checked={paymentMethod === 'VNPAY'}
                                        onChange={() => setPaymentMethod('VNPAY')}
                                        className="payment-radio"
                                    />
                                    <div className="payment-option-text">
                                        <span className="payment-title">Cổng thanh toán VNPAY / QR Code</span>
                                        <span className="payment-desc">Hỗ trợ quét mã QR ngân hàng, thẻ ATM nội địa và thẻ quốc tế Visa/MasterCard.</span>
                                    </div>
                                </label>

                                <label className={`payment-option-label ${paymentMethod === 'BANK' ? 'selected' : ''}`}>
                                    <input 
                                        type="radio" 
                                        name="paymentMethod" 
                                        value="BANK"
                                        checked={paymentMethod === 'BANK'}
                                        onChange={() => setPaymentMethod('BANK')}
                                        className="payment-radio"
                                    />
                                    <div className="payment-option-text">
                                        <span className="payment-title">Chuyển khoản trực tiếp</span>
                                        <span className="payment-desc">Chuyển khoản trực tiếp qua tài khoản ngân hàng chính thức của SERN Bookstore.</span>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    <div className="checkout-sidebar">
                        <div className="checkout-summary-card">
                            <h3 className="checkout-summary-title">Đơn hàng ({selectedCount} cuốn)</h3>
                            
                            <div className="checkout-items-list">
                                {items.map((item) => {
                                    const id = item.bookId || item.id;
                                    const itemPrice = item.discount > 0 
                                        ? Math.round(item.price * (100 - item.discount) / 100) 
                                        : item.price;
                                    const itemQty = Number(item.quantity) || 1;
                                    const itemTotal = itemPrice * itemQty;

                                    return (
                                        <div key={id} className="checkout-item-row">
                                            <img 
                                                src={item.image || 'https://placehold.co/48x64/20201f/f3eadb?text=Book'} 
                                                alt={item.title} 
                                                className="checkout-item-thumb" 
                                            />
                                            <div className="checkout-item-info">
                                                <h4 className="checkout-item-title">{item.title}</h4>
                                                <div className="checkout-item-meta">
                                                    {formatCurrency(itemPrice)} × {itemQty}
                                                </div>
                                            </div>
                                            <div className="checkout-item-price">
                                                {formatCurrency(itemTotal)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <form onSubmit={handleApplyCoupon} className="coupon-section">
                                <input 
                                    type="text" 
                                    className="coupon-input"
                                    placeholder="Mã giảm giá (BOOKWEB10)"
                                    value={couponInput}
                                    onChange={(e) => setCouponInput(e.target.value)}
                                />
                                <button type="submit" className="coupon-btn">
                                    Áp dụng
                                </button>
                            </form>

                            <div className="checkout-calc-list">
                                <div className="checkout-calc-row">
                                    <span>Tạm tính tiền sách:</span>
                                    <span className="checkout-calc-val">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="checkout-calc-row">
                                    <span>Phí giao hàng:</span>
                                    <span className="checkout-calc-val">
                                        {shippingFee === 0 ? 'Miễn phí' : formatCurrency(shippingFee)}
                                    </span>
                                </div>
                                {appliedDiscount > 0 && (
                                    <div className="checkout-calc-row discount-row">
                                        <span>Giảm giá khuyến mãi:</span>
                                        <span className="checkout-calc-val">-{formatCurrency(appliedDiscount)}</span>
                                    </div>
                                )}
                                <div className="checkout-divider" />
                                <div className="checkout-calc-row total-row">
                                    <span>Tổng thanh toán:</span>
                                    <span className="checkout-total-val">{formatCurrency(finalTotal)}</span>
                                </div>
                            </div>

                            <button 
                                type="button" 
                                className="checkout-submit-btn"
                                disabled={isSubmitting}
                                onClick={handlePlaceOrder}
                            >
                                {isSubmitting ? 'Đang xử lý đơn...' : 'Xác nhận đặt hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {successOrder && (
                <div className="checkout-modal-overlay">
                    <div className="checkout-modal-content">
                        <div className="checkout-success-icon">✓</div>
                        <h2 className="checkout-success-title">Đặt hàng thành công!</h2>
                        <p className="checkout-success-desc">
                            Cảm ơn bạn đã lựa chọn SERN Bookstore. Đơn hàng của bạn đã được ghi nhận vào hệ thống và đang được chuẩn bị để đóng gói chuyển giao.
                        </p>
                        
                        <div className="checkout-success-details">
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Mã tham chiếu đơn:</span>
                                <span className="checkout-success-value">{successOrder.orderCode}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Người nhận hàng:</span>
                                <span className="checkout-success-value">{successOrder.fullName}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Số điện thoại:</span>
                                <span className="checkout-success-value">{successOrder.phone}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Địa chỉ giao:</span>
                                <span className="checkout-success-value">{successOrder.address}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Phương thức:</span>
                                <span className="checkout-success-value">{successOrder.paymentMethod}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Tổng thanh toán:</span>
                                <span className="checkout-success-value">{formatCurrency(successOrder.total)}</span>
                            </div>
                        </div>

                        <div className="checkout-modal-actions">
                            {onViewOrders && (
                                <button 
                                    type="button" 
                                    className="checkout-modal-btn-primary"
                                    onClick={onViewOrders}
                                >
                                    Xem đơn hàng của tôi
                                </button>
                            )}
                            <button 
                                type="button" 
                                className={onViewOrders ? "checkout-modal-btn-secondary" : "checkout-modal-btn-primary"}
                                onClick={onContinueShopping}
                            >
                                Tiếp tục mua sắm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CheckoutPage;

