import { useState, useMemo } from 'react'

function AdminCategoryTable({
  categories = [],
  loading = false,
  search = '',
  onSearchChange,
  onResetFilters,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
}) {
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('asc')

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'bookCount' ? 'desc' : 'asc')
    }
  }

  const handleResetFilters = () => {
    setSortBy('id')
    setSortOrder('asc')
    if (onResetFilters) {
      onResetFilters()
    } else if (onSearchChange) {
      onSearchChange('')
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

  const filteredCategories = useMemo(() => {
    let list = categories.filter((cat) => {
      if (!search || !search.trim()) return true
      const term = search.trim().toLowerCase()
      return (
        (cat.name && cat.name.toLowerCase().includes(term)) ||
        (cat.description && cat.description.toLowerCase().includes(term))
      )
    })

    return list.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'name') {
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
  }, [categories, search, sortBy, sortOrder])

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo tên thể loại, mô tả..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <button
            type="button"
            className="admin-btn-reset-filters"
            onClick={handleResetFilters}
            title="Đặt lại tìm kiếm và sắp xếp về ban đầu"
          >
            🔄 Xóa bộ lọc
          </button>
        </div>
        <button type="button" className="admin-btn-primary" onClick={onOpenCreate}>
          + Thêm thể loại mới
        </button>
      </div>

      <div className="admin-table-wrapper">
        {loading && filteredCategories.length > 0 && <div className="admin-table-loading-bar" />}
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
                className={`admin-th-sortable ${sortBy === 'name' ? 'sorted' : ''}`}
                style={{ width: '230px' }}
                onClick={() => handleSort('name')}
                title="Nhấn để sắp xếp theo Tên thể loại (A-Z)"
              >
                Tên thể loại {renderSortIndicator('name')}
              </th>
              <th style={{ minWidth: '240px' }}>Mô tả</th>
              <th
                className={`admin-th-sortable ${sortBy === 'bookCount' ? 'sorted' : ''}`}
                style={{ width: '165px', textAlign: 'center' }}
                onClick={() => handleSort('bookCount')}
                title="Nhấn để sắp xếp theo Số sách liên kết"
              >
                Số sách liên kết {renderSortIndicator('bookCount')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isDelete' ? 'sorted' : ''}`}
                style={{ width: '135px' }}
                onClick={() => handleSort('isDelete')}
                title="Nhấn để sắp xếp theo Trạng thái"
              >
                Trạng thái {renderSortIndicator('isDelete')}
              </th>
              <th style={{ width: '160px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && filteredCategories.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="6" className="admin-table-empty">
                  Đang tải danh sách thể loại...
                </td>
              </tr>
            ) : filteredCategories.length === 0 ? (
              <tr>
                <td colSpan="6" className="admin-table-empty">
                  Không tìm thấy thể loại nào.
                </td>
              </tr>
            ) : (
              filteredCategories.map((cat) => {
                const isHidden = Boolean(cat.isDelete)
                return (
                  <tr key={cat.id} className={isHidden ? 'admin-row-muted' : ''}>
                    <td className="admin-col-id">#{cat.id}</td>
                    <td>
                      <div className="admin-category-item">
                        <div className="admin-category-icon">📁</div>
                        <div className="admin-category-name">{cat.name}</div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-category-desc">
                        {cat.description || <span className="admin-text-muted">Chưa có mô tả</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className="admin-book-count-badge">
                        {cat.bookCount || 0} sách
                      </span>
                    </td>
                    <td>
                      <span className={`admin-badge ${isHidden ? 'danger' : 'success'}`}>
                        {isHidden ? 'Đã ẩn' : 'Hoạt động'}
                      </span>
                    </td>
                    <td>
                      <div className="admin-action-buttons">
                        <button
                          type="button"
                          className="admin-btn-action edit"
                          onClick={() => onOpenEdit(cat)}
                        >
                          Sửa
                        </button>
                        <button
                          type="button"
                          className={`admin-btn-action ${isHidden ? 'restore' : 'hide'}`}
                          onClick={() => onToggleStatus(cat)}
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
          Tổng cộng: <strong>{filteredCategories.length}</strong> thể loại
        </div>
      </div>
    </div>
  )
}

export default AdminCategoryTable