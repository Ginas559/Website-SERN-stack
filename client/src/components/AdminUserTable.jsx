import { memo, useState, useEffect, useMemo, useRef } from 'react'
import debounce from 'lodash.debounce'
import { RefreshIcon, MaterialCommunityIcon } from './common/Icons'
import AdminConfirmModal from './AdminConfirmModal'

function formatShortUserId(id) {
  const raw = String(id || '').trim()
  if (!raw) return '—'
  if (raw.length <= 14) return raw
  return `${raw.slice(0, 6)}…${raw.slice(-4)}`
}

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
  const [pendingRestoreUser, setPendingRestoreUser] = useState(null)
  const [copiedUserId, setCopiedUserId] = useState(null)
  const copyTimerRef = useRef(null)

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
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
    }
  }, [debouncedSearch])

  const handleCopyUserId = async (userId) => {
    const rawId = String(userId || '').trim()
    if (!rawId) return
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(rawId)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = rawId
        textarea.setAttribute('readonly', '')
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setCopiedUserId(rawId)
      if (copyTimerRef.current) {
        clearTimeout(copyTimerRef.current)
      }
      copyTimerRef.current = setTimeout(() => {
        setCopiedUserId(null)
      }, 1800)
    } catch {
      return
    }
  }

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
      if (sortBy === 'role') {
        return sortOrder === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''), 'vi')
          : String(valB || '').localeCompare(String(valA || ''), 'vi')
      }
      if (sortBy === 'isVip' || sortBy === 'isDelete') {
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
            <option value="0">Đang hoạt động</option>
            <option value="1">Đang bị khóa</option>
          </select>
          <select
            className="admin-filter-select"
            value={roleFilter}
            onChange={(e) => onRoleFilterChange(e.target.value)}
          >
            <option value="all">Tất cả vai trò</option>
            <option value="admin">Quản trị viên</option>
            <option value="customer">Khách hàng</option>
            <option value="shipper">Shipper</option>
          </select>
          <select
            className="admin-filter-select"
            value={vipFilter}
            onChange={(e) => onVipFilterChange(e.target.value)}
          >
            <option value="all">Tất cả hạng</option>
            <option value="1">Khách hàng VIP</option>
            <option value="0">Thường</option>
          </select>
          <button
            type="button"
            className="admin-btn-reset-filters"
            onClick={handleResetFilters}
            title="Đặt lại toàn bộ tìm kiếm, bộ lọc và sắp xếp về ban đầu"
          >
            <RefreshIcon size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="admin-table-wrapper">
        {loading && sortedUsers.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table admin-user-table">
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
                className={`admin-th-sortable ${sortBy === 'role' ? 'sorted' : ''}`}
                style={{ width: '130px', textAlign: 'center' }}
                onClick={() => handleSort('role')}
                title="Nhấn để sắp xếp theo Vai trò"
              >
                Vai trò {renderSortIndicator('role')}
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
                const hasAdminRole = user.role === 'Admin'
                const isShipper = user.role === 'Shipper'
                const rawUserId = String(user.id || '').trim()
                const isCopied = copiedUserId === rawUserId

                return (
                  <tr
                    key={user.id}
                    className={`${isBlocked ? 'admin-row-muted ' : ''}admin-user-clickable-row`}
                    onClick={() => onViewDetail(user)}
                    title="Bấm để xem chi tiết người dùng"
                  >
                    <td>
                      <div className="admin-user-cell">
                        <div className="admin-user-avatar-small">
                          {(user.full_name || user.fullName) ? (user.full_name || user.fullName).charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <div className="admin-user-name">{user.full_name || user.fullName || 'Chưa đặt tên'}</div>
                          <div className="admin-user-id-row">
                            <span className="admin-user-id-code" title={`#${rawUserId}`}>
                              #{formatShortUserId(rawUserId)}
                            </span>
                            <button
                              type="button"
                              className={`admin-copy-id-btn ${isCopied ? 'copied' : ''}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                handleCopyUserId(rawUserId)
                              }}
                              title={isCopied ? 'Đã sao chép ID đầy đủ' : `Sao chép ID đầy đủ: ${rawUserId}`}
                            >
                               {isCopied ? '✓ Đã chép' : <><MaterialCommunityIcon name="clipboard-text" size={14} />Chép</>}
                            </button>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                        <div className="admin-contact-email"><MaterialCommunityIcon name="email" size={14} /> {user.email}</div>
                      <div className="admin-contact-phone">
                          <MaterialCommunityIcon name="cellphone" size={14} /> {user.phone_number || user.phoneNumber || user.phone || <span className="admin-text-muted">Chưa cập nhật</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {hasAdminRole ? (
                        <span className="admin-role-badge admin">Quản trị</span>
                      ) : isShipper ? (
                        <span className="admin-role-badge customer">Shipper</span>
                      ) : (
                        <span className="admin-role-badge customer">Độc giả</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {user.isVip ? (
                         <span className="admin-vip-badge"><MaterialCommunityIcon name="star" size={14} /> VIP ({user.vipTier || 'Gold'})</span>
                      ) : (
                        <span className="admin-regular-badge">Thường</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isBlocked ? (
                         <span className="admin-status-badge blocked"><MaterialCommunityIcon name="lock" size={14} /> Đã khóa</span>
                      ) : (
                         <span className="admin-status-badge active"><MaterialCommunityIcon name="check-circle-outline" size={14} /> Hoạt động</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-date-text">{formatDate(user.createdAt)}</div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-table-actions" onClick={(event) => event.stopPropagation()}>
                        {isBlocked ? (
                          <button
                            type="button"
                            className="admin-btn-action restore"
                            onClick={() => setPendingRestoreUser(user)}
                            title="Khôi phục tài khoản"
                          >
                             <MaterialCommunityIcon name="sync" size={15} />Mở khóa
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="admin-btn-action delete"
                            disabled={hasAdminRole}
                            onClick={() => onRequestBlock(user)}
                            title={hasAdminRole ? 'Không thể khóa tài khoản Admin' : 'Khóa tài khoản'}
                          >
                             <MaterialCommunityIcon name="lock" size={15} />Khóa
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

      <AdminConfirmModal
        isOpen={Boolean(pendingRestoreUser)}
        title="Xác nhận mở khóa tài khoản"
        message={`Bạn có muốn mở khóa tài khoản của “${pendingRestoreUser?.fullName || pendingRestoreUser?.username || 'người dùng này'}” không?`}
        confirmLabel="Xác nhận mở khóa"
        onCancel={() => setPendingRestoreUser(null)}
        onConfirm={() => {
          const user = pendingRestoreUser
          setPendingRestoreUser(null)
          onRestoreUser(user)
        }}
      />
    </div>
  )
}

export default memo(AdminUserTable)
