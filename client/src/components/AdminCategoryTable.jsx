function AdminCategoryTable({
  categories = [],
  loading = false,
  search = '',
  onSearchChange,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
}) {
  const filteredCategories = categories.filter((cat) => {
    if (!search || !search.trim()) return true
    const term = search.trim().toLowerCase()
    return (
      (cat.name && cat.name.toLowerCase().includes(term)) ||
      (cat.description && cat.description.toLowerCase().includes(term))
    )
  })

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
        </div>
        <button type="button" className="admin-btn-primary" onClick={onOpenCreate}>
          + Thêm thể loại mới
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th style={{ minWidth: '200px' }}>Tên thể loại</th>
              <th>Mô tả</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Số sách liên kết</th>
              <th style={{ width: '120px' }}>Trạng thái</th>
              <th style={{ width: '160px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
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
