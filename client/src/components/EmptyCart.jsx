function EmptyCart({ onExploreBooks }) {
    return (
        <div className="cart-empty-container">
            <div className="cart-empty-icon-wrap">
                <span className="cart-empty-icon">🛒</span>
            </div>
            <h2 className="cart-empty-title">Giỏ hàng đang trống</h2>
            <p className="cart-empty-desc">
                Chưa có sản phẩm nào trong giỏ hàng của bạn.
            </p>
            <button 
                type="button" 
                className="cart-empty-explore-btn"
                onClick={onExploreBooks}
            >
                Tiếp tục mua sắm
            </button>
        </div>
    );
}

export default EmptyCart;
