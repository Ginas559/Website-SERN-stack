function EmptyWishlist({ onExploreBooks }) {
    return (
        <div className="wishlist-empty-container">
            <div className="wishlist-empty-icon-wrap">
                <span className="wishlist-empty-icon">🤍</span>
            </div>
            <h2 className="wishlist-empty-title">Danh sách yêu thích đang trống</h2>
            <p className="wishlist-empty-desc">
                Chưa có sản phẩm nào trong danh sách yêu thích của bạn.
            </p>
            <button 
                type="button" 
                className="wishlist-empty-explore-btn"
                onClick={onExploreBooks}
            >
                Tiếp tục mua sắm
            </button>
        </div>
    );
}

export default EmptyWishlist;
