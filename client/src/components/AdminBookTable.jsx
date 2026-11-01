function AdminBookTable({
  books = [],
  total = 0,
  page = 1,
  totalPages = 1,
  loading = false,
  search = '',
  statusFilter = 'all',
  onSearchChange,
  onStatusFilterChange,
  onPageChange,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
}) {
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ'
  }

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo tiêu đề, tác giả..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <select
            className="admin-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="0">Đang bán (Hiển thị)</option>
            <option value="1">Đã ẩn (Tạm dừng)</option>
          </select>
        </div>
        <button type="button" className="admin-btn-primary" onClick={onOpenCreate}>
          + Thêm ấn phẩm mới
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th style={{ minWidth: '240px' }}>Ấn phẩm sách</th>
              <th>Thể loại</th>
              <th>Giá bán</th>
              <th>Giảm giá</th>
              <th>Tồn kho</th>
              <th>Trạng thái</th>
              <th style={{ width: '160px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Đang tải danh sách ấn phẩm...
                </td>
              </tr>
            ) : books.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Không tìm thấy ấn phẩm nào phù hợp.
                </td>
              </tr>
            ) : (
              books.map((book) => {
                const isHidden = Boolean(book.isDelete)
                return (
                  <tr key={book.id} className={isHidden ? 'admin-row-muted' : ''}>
                    <td className="admin-col-id">#{book.id}</td>
                    <td>
                      <div className="admin-book-item">
                        {book.image ? (
                          <img src={book.image} alt={book.title} className="admin-book-thumb" />
                        ) : (
                          <div className="admin-book-thumb-placeholder">📖</div>
                        )}
                        <div>
                          <div className="admin-book-title">{book.title}</div>
                          <div className="admin-book-author">{book.author}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-tag-list">
                        {book.categories && book.categories.length > 0 ? (
                          book.categories.map((c) => (
                            <span key={c.id} className="admin-mini-tag">{c.name}</span>
                          ))
                        ) : (
                          <span className="admin-text-muted">Chưa gán</span>
                        )}
                      </div>
                    </td>
                    <td className="admin-font-medium">{formatCurrency(book.price)}</td>
                    <td>
                      {book.discount > 0 ? (
                        <span className="admin-discount-pill">-{book.discount}%</span>
                      ) : (
                        <span className="admin-text-muted">0%</span>
                      )}
                    </td>
                    <td>{book.quantity || 0}</td>
                    <td>
                      <span className={`admin-badge ${isHidden ? 'danger' : 'success'}`}>
                        {isHidden ? 'Đã ẩn' : 'Đang bán'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-buttons">
                        <button
                          type="button"
                          className="admin-btn-action edit"
                          onClick={() => onOpenEdit(book)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className={`admin-btn-action ${isHidden ? 'restore' : 'hide'}`}
                          onClick={() => onToggleStatus(book)}
                        >
                          {isHidden ? 'Hiện' : 'Ẩn'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="admin-table-footer">
        <div className="admin-total-indicator">
          Tổng cộng: <strong>{total}</strong> ấn phẩm
        </div>
        {totalPages > 1 && (
          <div className="admin-pagination">
            <button
              type="button"
              className="admin-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(page - 1)}
            >
              ‹ Trước
            </button>
            <span className="admin-page-indicator">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              className="admin-page-btn"
              disabled={page >= totalPages || loading}
              onClick={() => onPageChange(page + 1)}
            >
              Sau ›
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminBookTable
