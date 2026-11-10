import { memo, useState, useEffect, useMemo } from 'react'
import debounce from 'lodash.debounce'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const raw = String(dateStr).trim()
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (match) {
      const [, year, month, day] = match
      return `${day}/${month}/${year}`
    }
    const d = new Date(raw)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function AdminUserTable({
  users = [],
  total = 0,
  page = 1,
  totalPages = 1,
  loading = false,
  search = '',
  statusFilter = 'all',
  roleFilter = 'all',
  vipFilter = 'all',
  onSearchChange,
  onStatusFilterChange,
  onRoleFilterChange,
  onVipFilterChange,
  onResetFilters,
  onPageChange,
  onViewDetail,
  onRequestBlock,
  onRestoreUser,
}) {
  const [localSearch, setLocalSearch] = useState(search)
  const [prevSearch, setPrevSearch] = useState(search)
  const [sortBy, setSortBy] = useState('createdAt')
  const [sortOrder, setSortOrder] = useState('desc')

  if (search !== prevSearch) {
    setPrevSearch(search)
    setLocalSearch(search)
  }

  const debouncedSearch = useMemo(
    () =>
      debounce((val) => {
        onSearchChange(val)
      }, 400),
    [onSearchChange]
  )

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const handleInputChange = (e) => {
    const val = e.target.value
    setLocalSearch(val)
    debouncedSearch(val)
  }

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'full_name' || field === 'email' ? 'asc' : 'desc')
    }
  }

  const handleResetFilters = () => {
    setLocalSearch('')
    debouncedSearch.cancel()
    setSortBy('createdAt')
    setSortOrder('desc')
    if (onResetFilters) {
      onResetFilters()
    } else {
      if (search !== '' && onSearchChange) onSearchChange('')
      if (statusFilter !== 'all' && onStatusFilterChange) onStatusFilterChange('all')
      if (roleFilter !== 'all' && onRoleFilterChange) onRoleFilterChange('all')
      if (vipFilter !== 'all' && onVipFilterChange) onVipFilterChange('all')
      if (page !== 1 && onPageChange) onPageChange(1)
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

  const sortedUsers = useMemo(() => {
    if (!users || !Array.isArray(users)) return []
    const list = [...users]
    return list.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'full_name' || sortBy === 'email' || sortBy === 'phone_number') {
        return sortOrder === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''), 'vi')
          : String(valB || '').localeCompare(String(valA || ''), 'vi')
      }
      if (sortBy === 'createdAt') {
        const timeA = valA ? new Date(valA).getTime() : 0
        const timeB = valB ? new Date(valB).getTime() : 0
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
      }
      if (sortBy === 'isAdmin' || sortBy === 'isVip' || sortBy === 'isDelete') {
        const numA = a[sortBy] ? 1 : 0
        const numB = b[sortBy] ? 1 : 0
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }
      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [users, sortBy, sortOrder])

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo tên, email, SĐT..."
            value={localSearch}
            onChange={handleInputChange}
          />
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="0">🟢 Đang hoạt động</option>
            <option value="1">🔒 Đang bị khóa</option>
          </select>
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="customer">Khách hàng</option>
          </select>
          <select
            className="admin-filter-select"
            value={vipFilter}
            onChange={(e) => onVipFilterChange(e.target.value)}
          >
            <option value="all">Tất cả hạng</option>
            <option value="1">⭐ Khách hàng VIP</option>
            <option value="0">Thường</option>
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
      </div>

      <div className="admin-table-wrapper">
        {loading && sortedUsers.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table">
          <thead>
            <tr>
              <th
                className={`admin-th-sortable ${sortBy === 'full_name' ? 'sorted' : ''}`}
                style={{ minWidth: '220px' }}
                onClick={() => handleSort('full_name')}
                title="Nhấn để sắp xếp theo Tên độc giả"
              >
                Thành viên {renderSortIndicator('full_name')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'email' ? 'sorted' : ''}`}
                style={{ width: '240px' }}
                onClick={() => handleSort('email')}
                title="Nhấn để sắp xếp theo Email"
              >
                Thông tin liên hệ {renderSortIndicator('email')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isAdmin' ? 'sorted' : ''}`}
                style={{ width: '130px', textAlign: 'center' }}
                onClick={() => handleSort('isAdmin')}
                title="Nhấn để sắp xếp theo Vai trò"
              >
                Vai trò {renderSortIndicator('isAdmin')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isVip' ? 'sorted' : ''}`}
                style={{ width: '140px', textAlign: 'center' }}
                onClick={() => handleSort('isVip')}
                title="Nhấn để sắp xếp theo Đặc quyền VIP"
              >
                Đặc quyền {renderSortIndicator('isVip')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isDelete' ? 'sorted' : ''}`}
                style={{ width: '140px', textAlign: 'center' }}
                onClick={() => handleSort('isDelete')}
                title="Nhấn để sắp xếp theo Trạng thái"
              >
                Trạng thái {renderSortIndicator('isDelete')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'createdAt' ? 'sorted' : ''}`}
                style={{ width: '130px' }}
                onClick={() => handleSort('createdAt')}
                title="Nhấn để sắp xếp theo Ngày tạo (Mới nhất / Cũ nhất)"
              >
                Ngày tạo {renderSortIndicator('createdAt')}
              </th>
              <th style={{ width: '180px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && sortedUsers.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && sortedUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : sortedUsers.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Không tìm thấy người dùng nào phù hợp.
                </td>
              </tr>
            ) : (
              sortedUsers.map((user) => {
                const isBlocked = Boolean(user.isDelete)
                const isAdmin = Boolean(user.isAdmin)

                return (
                  <tr key={user.id} className={isBlocked ? 'admin-row-muted' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar">
                          {user.full_name ? user.full_name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="admin-user-name">{user.full_name || 'Chưa đặt tên'}</div>
                          <div className="admin-user-id">#{user.id}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-contact-email">📧 {user.email}</div>
                      <div className="admin-contact-phone">
                        📱 {user.phone_number || <span className="admin-text-muted">Chưa cập nhật</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin ? (
                        <span className="admin-role-badge admin">Quản trị</span>
                      ) : (
                        <span className="admin-role-badge customer">Độc giả</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {user.isVip ? (
                        <span className="admin-vip-badge">⭐ VIP ({user.vipTier || 'Gold'})</span>
                      ) : (
                        <span className="admin-regular-badge">Thường</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isBlocked ? (
                        <span className="admin-status-badge blocked">🔒 Đã khóa</span>
                      ) : (
                        <span className="admin-status-badge active">🟢 Hoạt động</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-date-text">{formatDate(user.createdAt)}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-btn-action detail"
                          onClick={() => onViewDetail(user)}
                          title="Xem chi tiết người dùng"
                        >
                          👁️ Chi tiết
                        </button>
                        {isBlocked ? (
                          <button
                            type="button"
                            className="admin-btn-action restore"
                            onClick={() => onRestoreUser(user)}
                            title="Khôi phục tài khoản"
                          >
                            🔄 Mở khóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn-action delete"
                            disabled={isAdmin}
                            onClick={() => onRequestBlock(user)}
                            title={isAdmin ? 'Không thể khóa tài khoản Admin' : 'Khóa tài khoản'}
                          >
                            🔒 Khóa
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="admin-pagination">
          <div className="admin-pagination-info">
            Hiển thị <strong>{users.length}</strong> / <strong>{total}</strong> người dùng
          </div>
          <div className="admin-pagination-controls">
            <button
              type="button"
              className="admin-page-btn"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
            >
              &laquo; Trang trước
            </button>
            <span className="admin-page-current">
              Trang {page} / {totalPages}
            </span>
            <button
              type="button"
              className="admin-page-btn"
              disabled={page >= totalPages}
              onClick={() => onPageChange(page + 1)}
            >
              Trang sau &raquo;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(AdminUserTable)