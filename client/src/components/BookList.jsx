
import { useState } from "react";
import BookCard from "./BookCard";

const MAX_PRICE_FILTER = 2147483647;

function formatPriceLabel(val) {
    return `${Number(val || 0).toLocaleString("vi-VN")} đ`;
}

function getSliderStep(maxBound) {
    if (maxBound <= 100000) return 2000;
    if (maxBound <= 1000000) return 10000;
    if (maxBound <= 5000000) return 50000;
    return Math.ceil(maxBound / 100 / 10000) * 10000;
}

function formatRangeSummary(minRaw, maxRaw, sliderMaxBound) {
    const hasMin = minRaw !== "" && minRaw !== null && minRaw !== undefined && Number.isFinite(Number(minRaw));
    const hasMax = maxRaw !== "" && maxRaw !== null && maxRaw !== undefined && Number.isFinite(Number(maxRaw));
    if (!hasMin && !hasMax) {
        return `Tất cả mức giá (0 đ – ${formatPriceLabel(sliderMaxBound)})`;
    }
    if (hasMin && !hasMax) {
        return `Từ ${formatPriceLabel(minRaw)} trở lên`;
    }
    if (!hasMin && hasMax) {
        return `0 đ – ${formatPriceLabel(maxRaw)}`;
    }
    return `${formatPriceLabel(minRaw)} – ${formatPriceLabel(maxRaw)}`;
}

function parsePriceValue(raw) {
    if (raw === "" || raw === null || raw === undefined) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : NaN;
}

function getPriceFilterError(minRaw, maxRaw) {
    const minVal = parsePriceValue(minRaw);
    const maxVal = parsePriceValue(maxRaw);
    if (Number.isNaN(minVal) || Number.isNaN(maxVal)) {
        return "Giá lọc phải là số nguyên không âm.";
    }
    if ((minVal !== null && minVal < 0) || (maxVal !== null && maxVal < 0)) {
        return "Giá lọc không được nhỏ hơn 0 đ.";
    }
    if ((minVal !== null && minVal > MAX_PRICE_FILTER) || (maxVal !== null && maxVal > MAX_PRICE_FILTER)) {
        return "Giá lọc tối đa không được vượt quá 2.147.483.647 đ.";
    }
    if (minVal !== null && maxVal !== null && minVal > maxVal) {
        return "Giá tối thiểu không được lớn hơn giá tối đa.";
    }
    return "";
}

function BookList({
    books = [],
    total = 0,
    page = 1,
    totalPages = 1,
    categories = [],
    priceRange = { min: 0, max: 500000 },
    filters = {},
    error = "",
    onFilterChange,
    onPageChange,
    onResetFilters,
    onSelectBook,
    loading = false,
}) {
    const [activeThumb, setActiveThumb] = useState("max");
    const handleDebouncedInputChange = (field, value) => {
        if (onFilterChange) {
            onFilterChange({ ...filters, [field]: value }, { immediate: false });
        }
    };

    const handleImmediateFilterChange = (field, value) => {
        if (onFilterChange) {
            onFilterChange({ ...filters, [field]: value }, { immediate: true });
        }
    };

    const handleInputKeyDown = (e, blockNonNumeric = false) => {
        if (blockNonNumeric && ["e", "E", "+", "-", ".", ","].includes(e.key)) {
            e.preventDefault();
            return;
        }
        if (e.key === "Enter" && onFilterChange) {
            onFilterChange({ ...filters }, { immediate: true });
        }
    };

    const sliderMaxBound = Math.max(10000, Number(priceRange?.max) || 500000);
    const sliderStep = getSliderStep(sliderMaxBound);
    const parsedMin = parsePriceValue(filters.minPrice);
    const parsedMax = parsePriceValue(filters.maxPrice);
    const safeMin = parsedMin !== null && !Number.isNaN(parsedMin)
        ? Math.max(0, Math.min(sliderMaxBound, parsedMin))
        : 0;
    const safeMaxRaw = parsedMax !== null && !Number.isNaN(parsedMax)
        ? Math.max(0, Math.min(sliderMaxBound, parsedMax))
        : sliderMaxBound;
    const sliderMin = Math.min(safeMin, safeMaxRaw);
    const sliderMax = Math.max(sliderMin, safeMaxRaw);

    const minPercent = (sliderMin / sliderMaxBound) * 100;
    const maxPercent = (sliderMax / sliderMaxBound) * 100;

    let minThumbZ = activeThumb === "min" ? 5 : 3;
    let maxThumbZ = activeThumb === "max" ? 5 : 4;
    if (sliderMax <= sliderStep) {
        minThumbZ = 3;
        maxThumbZ = 5;
    } else if (sliderMin >= sliderMaxBound - sliderStep) {
        minThumbZ = 5;
        maxThumbZ = 3;
    }

    const handleMinSliderChange = (e) => {
        const clamped = Math.min(Number(e.target.value), sliderMax);
        setActiveThumb("min");
        if (onFilterChange) {
            onFilterChange(
                { ...filters, minPrice: clamped <= 0 ? "" : String(clamped) },
                { immediate: false }
            );
        }
    };

    const handleMaxSliderChange = (e) => {
        const clamped = Math.max(Number(e.target.value), sliderMin);
        setActiveThumb("max");
        if (onFilterChange) {
            onFilterChange(
                { ...filters, maxPrice: clamped >= sliderMaxBound ? "" : String(clamped) },
                { immediate: false }
            );
        }
    };

    const priceValidationError = getPriceFilterError(filters.minPrice, filters.maxPrice);
    const feedbackMessage = priceValidationError || error;

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
                    <h1 className="books-title">Cửa Hàng Sách</h1>
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
                    onKeyDown={(e) => handleInputKeyDown(e, false)}
                    onChange={(e) => handleDebouncedInputChange("search", e.target.value)}
                />

                <select
                    className="filter-select"
                    value={String(filters.categoryId || "")}
                    onChange={(e) => handleImmediateFilterChange("categoryId", e.target.value)}
                >
                    <option value="">Tất cả thể loại</option>
                    {categories.map((cat) => (
                        <option key={cat.id} value={String(cat.id)}>
                            {cat.bookCount !== undefined ? `${cat.name} (${cat.bookCount})` : cat.name}
                        </option>
                    ))}
                </select>

                <input
                    type="number"
                    className="filter-input"
                    placeholder="Giá từ..."
                    min="0"
                    max={MAX_PRICE_FILTER}
                    value={filters.minPrice ?? ""}
                    onKeyDown={(e) => handleInputKeyDown(e, true)}
                    onChange={(e) => handleDebouncedInputChange("minPrice", e.target.value)}
                />

                <input
                    type="number"
                    className="filter-input"
                    placeholder="Giá đến..."
                    min="0"
                    max={MAX_PRICE_FILTER}
                    value={filters.maxPrice ?? ""}
                    onKeyDown={(e) => handleInputKeyDown(e, true)}
                    onChange={(e) => handleDebouncedInputChange("maxPrice", e.target.value)}
                />

                <select
                    className="filter-select"
                    value={filters.sort || "newest"}
                    onChange={(e) => handleImmediateFilterChange("sort", e.target.value)}
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

                <div className="price-slider-row">
                    <span className="price-slider-label">Khoảng giá nhanh:</span>
                    <div className="price-slider-control">
                        <span className="price-slider-bound">0 đ</span>
                        <div className="price-slider-track-wrap">
                            <div className="price-slider-rail">
                                <div
                                    className="price-slider-fill"
                                    style={{
                                        left: `${minPercent}%`,
                                        width: `${Math.max(0, maxPercent - minPercent)}%`,
                                    }}
                                />
                            </div>
                            <input
                                type="range"
                                className="price-range-input"
                                aria-label="Kéo chọn giá tối thiểu"
                                min={0}
                                max={sliderMaxBound}
                                step={sliderStep}
                                value={sliderMin}
                                style={{ zIndex: minThumbZ }}
                                onPointerDown={() => setActiveThumb("min")}
                                onFocus={() => setActiveThumb("min")}
                                onChange={handleMinSliderChange}
                            />
                            <input
                                type="range"
                                className="price-range-input"
                                aria-label="Kéo chọn giá tối đa"
                                min={0}
                                max={sliderMaxBound}
                                step={sliderStep}
                                value={sliderMax}
                                style={{ zIndex: maxThumbZ }}
                                onPointerDown={() => setActiveThumb("max")}
                                onFocus={() => setActiveThumb("max")}
                                onChange={handleMaxSliderChange}
                            />
                        </div>
                        <span className="price-slider-bound">{formatPriceLabel(sliderMaxBound)}</span>
                    </div>
                    <span className="price-slider-value">
                        {formatRangeSummary(filters.minPrice, filters.maxPrice, sliderMaxBound)}
                    </span>
                </div>
            </div>

            {feedbackMessage ? (
                <div className="filter-feedback" role="alert">
                    {feedbackMessage}
                </div>
            ) : null}

            {loading && books.length === 0 ? (
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
                    <div className="books-grid" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
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
