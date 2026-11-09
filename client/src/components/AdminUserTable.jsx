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
  onPageChange,
  onViewDetail,
  onRequestBlock,
  onRestoreUser,
}) {
  const [localSearch, setLocalSearch] = useState(search)
  const [prevSearch, setPrevSearch] = useState(search)

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

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo username, họ tên, email, SĐT..."
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
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ minWidth: '220px' }}>Thành viên</th>
              <th style={{ minWidth: '200px' }}>Thông tin liên hệ</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Vai trò</th>
              <th style={{ width: '140px', textAlign: 'center' }}>Đặc quyền</th>
              <th style={{ width: '140px', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '120px' }}>Ngày tạo</th>
              <th style={{ width: '180px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Đang tải danh sách người dùng...
                </td>
              </tr>
            ) : users.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Không tìm thấy người dùng nào phù hợp.
                </td>
              </tr>
            ) : (
              users.map((user) => {
                const isBlocked = Boolean(user.isDelete)
                const isAdmin = Boolean(user.isAdmin)

                return (
                  <tr key={user.id} className={isBlocked ? 'admin-row-muted' : ''}>
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar-small">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.username} />
                          ) : (
                            <span>{(user.full_name || user.username || 'U')[0].toUpperCase()}</span>
                          )}
                        </div>
                        <div>
                          <div className="admin-user-name">
                            {user.full_name || user.username}
                          </div>
                          <div className="admin-user-handle">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="admin-user-contact">
                        <div>📧 {user.email || '—'}</div>
                        {user.phone_number && (
                          <div className="admin-user-phone">📞 {user.phone_number}</div>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin ? (
                        <span className="admin-role-badge admin">Quản trị viên</span>
                      ) : (
                        <span className="admin-role-badge customer">Khách hàng</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-user-privileges">
                        {user.isVip ? (
                          <span className="admin-badge-vip" title="Thành viên VIP">
                            ⭐ VIP
                          </span>
                        ) : null}
                        {user.isVerified ? (
                          <span className="admin-verified-tag yes" title="Email đã xác thực">
                            ✓ Xác thực
                          </span>
                        ) : null}
                        {!user.isVip && !user.isVerified && <span>—</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isBlocked ? (
                        <div>
                          <span className="admin-status-badge blocked">🔒 Bị khóa</span>
                          {user.blockReason && (
                            <div className="admin-block-reason-preview" title={user.blockReason}>
                              {user.blockReason}
                            </div>
                          )}
                        </div>
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

