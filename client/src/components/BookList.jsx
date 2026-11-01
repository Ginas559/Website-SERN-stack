import BookCard from "./BookCard";

function BookList({
    books = [],
    total = 0,
    page = 1,
    totalPages = 1,
    categories = [],
    filters = {},
    onFilterChange,
    onPageChange,
    onResetFilters,
    onSelectBook,
    loading = false,
}) {
    const handleInputChange = (field, value) => {
        if (onFilterChange) {
            onFilterChange({ ...filters, [field]: value });
        }
    };

    const pages = [];
    for (let i = 1; i <= totalPages; i += 1) {
        if (
            i === 1 || 
            i === totalPages || 
            (i >= page - 2 && i <= page + 2)
        ) {
            pages.push(i);
        }
    }

    return (
        <div className="books-container">
            <div className="books-header">
                <div>
                    <h1 className="books-title">Không Gian Sách Trực Tuyến</h1>
                    <div style={{ color: "#b9b0a7", fontSize: "0.95rem", marginTop: "4px" }}>
                        Khám phá kho tàng tri thức với hàng ngàn đầu sách chọn lọc
                    </div>
                </div>
                <div style={{ color: "#e7b26a", fontWeight: "700" }}>
                    Tìm thấy: {total} cuốn sách
                </div>
            </div>

            <div className="filter-bar">
                <input
                    type="text"
                    className="filter-input"
                    placeholder="Tìm theo tiêu đề hoặc tác giả..."
                    value={filters.search || ""}
                    onChange={(e) => handleInputChange("search", e.target.value)}
                />

                <select
                    className="filter-select"
                    value={filters.categoryId || ""}
                    onChange={(e) => handleInputChange("categoryId", e.target.value)}
                >
                    <option value="">Tất cả thể loại</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                            {cat.name}
                        </option>
                    ))}
                </select>

                <input
                    type="number"
                    className="filter-input"
                    placeholder="Giá từ..."
                    value={filters.minPrice || ""}
                    onChange={(e) => handleInputChange("minPrice", e.target.value)}
                />

                <input
                    type="number"
                    className="filter-input"
                    placeholder="Giá đến..."
                    value={filters.maxPrice || ""}
                    onChange={(e) => handleInputChange("maxPrice", e.target.value)}
                />

                <select
                    className="filter-select"
                    value={filters.sort || "newest"}
                    onChange={(e) => handleInputChange("sort", e.target.value)}
                >
                    <option value="newest">Mới nhất</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="price_asc">Giá tăng dần</option>
                    <option value="price_desc">Giá giảm dần</option>
                    <option value="discount">Giảm giá nhiều nhất</option>
                </select>

                <button
                    type="button"
                    className="filter-btn-reset"
                    onClick={onResetFilters}
                >
                    Đặt lại
                </button>
            </div>

            {loading ? (
                <div className="empty-state">
                    <h3>Đang tải danh sách sách...</h3>
                    <p>Vui lòng đợi trong giây lát</p>
                </div>
            ) : books.length === 0 ? (
                <div className="empty-state">
                    <h3>Không tìm thấy ấn phẩm sách nào</h3>
                    <p>Hãy thử tìm kiếm với từ khóa khác hoặc xóa bớt bộ lọc</p>
                </div>
            ) : (
                <>
                    <div className="books-grid">
                        {books.map((book) => (
                            <BookCard
                                key={book.id}
                                book={book}
                                onSelectBook={onSelectBook}
                            />
                        ))}
                    </div>

                    {totalPages > 1 ? (
                        <div className="pagination-bar">
                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={page <= 1}
                                onClick={() => onPageChange(page - 1)}
                            >
                                ← Trước
                            </button>

                            {pages.map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    className={`pagination-btn ${p === page ? "active" : ""}`}
                                    onClick={() => onPageChange(p)}
                                >
                                    {p}
                                </button>
                            ))}

                            <button
                                type="button"
                                className="pagination-btn"
                                disabled={page >= totalPages}
                                onClick={() => onPageChange(page + 1)}
                            >
                                Sau →
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}

export default BookList;

