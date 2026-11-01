function EmptyCart({ onExploreBooks }) {
    return (
        <div className="cart-empty-container">
            <div className="cart-empty-icon-wrap">
                <span className="cart-empty-icon">🛒</span>
            </div>
            <h2 className="cart-empty-title">Giỏ hàng của bạn đang trống</h2>
            <p className="cart-empty-desc">
                Chưa có ấn phẩm sách nào được thêm vào giỏ hàng. 
                Hãy dạo quanh thư viện sách phong phú của chúng tôi và chọn cho mình những tựa sách yêu thích nhé!
            </p>
            <button 
                type="button" 
                className="cart-empty-explore-btn"
                onClick={onExploreBooks}
            >
                Khám phá danh mục sách ngay
            </button>
        </div>
    );
}

export default EmptyCart;

