import { useState, useMemo } from 'react'

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
  onResetFilters,
  onPageChange,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
}) {
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' đ'
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'price' || field === 'discount' || field === 'quantity' || field === 'id' ? 'desc' : 'asc')
    }
  }

  const handleResetFilters = () => {
    setSortBy('id')
    setSortOrder('desc')
    if (onResetFilters) {
      onResetFilters()
    } else {
      if (onSearchChange) onSearchChange('')
      if (onStatusFilterChange) onStatusFilterChange('all')
      if (onPageChange) onPageChange(1)
    }
  }

  const renderSortIndicator = (field) => {
    if (sortBy === field) {
      return (
        <span className="admin-sort-indicator active">
          {sortOrder === 'asc' ? '▲' : '▼'}
        </span>
      )
    }
    return <span className="admin-sort-indicator">↕</span>
  }

  const sortedBooks = useMemo(() => {
    if (!books || !Array.isArray(books)) return []
    const list = [...books]
    return list.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'title') {
        return sortOrder === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''), 'vi')
          : String(valB || '').localeCompare(String(valA || ''), 'vi')
      }
      if (sortBy === 'isDelete') {
        const numA = a.isDelete ? 1 : 0
        const numB = b.isDelete ? 1 : 0
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }
      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [books, sortBy, sortOrder])

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
          <button
            type="button"
            className="admin-btn-reset-filters"
            onClick={handleResetFilters}
            title="Đặt lại toàn bộ tìm kiếm, bộ lọc và sắp xếp về ban đầu"
          >
            🔄 Xóa bộ lọc
          </button>
        </div>
        <button type="button" className="admin-btn-primary" onClick={onOpenCreate}>
          + Thêm ấn phẩm mới
        </button>
      </div>

      <div className="admin-table-wrapper">
        {loading && sortedBooks.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table">
          <thead>
            <tr>
              <th
                className={`admin-th-sortable ${sortBy === 'id' ? 'sorted' : ''}`}
                style={{ width: '75px' }}
                onClick={() => handleSort('id')}
                title="Nhấn để sắp xếp theo ID"
              >
                ID {renderSortIndicator('id')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'title' ? 'sorted' : ''}`}
                style={{ minWidth: '240px' }}
                onClick={() => handleSort('title')}
                title="Nhấn để sắp xếp theo Tên sách (A-Z)"
              >
                Ấn phẩm sách {renderSortIndicator('title')}
              </th>
              <th style={{ width: '160px' }}>Thể loại</th>
              <th
                className={`admin-th-sortable ${sortBy === 'price' ? 'sorted' : ''}`}
                style={{ width: '125px' }}
                onClick={() => handleSort('price')}
                title="Nhấn để sắp xếp theo Giá bán"
              >
                Giá bán {renderSortIndicator('price')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'discount' ? 'sorted' : ''}`}
                style={{ width: '115px' }}
                onClick={() => handleSort('discount')}
                title="Nhấn để sắp xếp theo Mức giảm giá"
              >
                Giảm giá {renderSortIndicator('discount')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'quantity' ? 'sorted' : ''}`}
                style={{ width: '105px' }}
                onClick={() => handleSort('quantity')}
                title="Nhấn để sắp xếp theo Tồn kho"
              >
                Tồn kho {renderSortIndicator('quantity')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isDelete' ? 'sorted' : ''}`}
                style={{ width: '130px' }}
                onClick={() => handleSort('isDelete')}
                title="Nhấn để sắp xếp theo Trạng thái"
              >
                Trạng thái {renderSortIndicator('isDelete')}
              </th>
              <th style={{ width: '160px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && sortedBooks.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && sortedBooks.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Đang tải danh sách ấn phẩm...
                </td>
              </tr>
            ) : sortedBooks.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Không tìm thấy ấn phẩm nào phù hợp.
                </td>
              </tr>
            ) : (
              sortedBooks.map((book) => {
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