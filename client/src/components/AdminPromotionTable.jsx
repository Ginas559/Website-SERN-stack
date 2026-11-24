import { memo, useState, useEffect, useMemo } from 'react'
import debounce from 'lodash.debounce'

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function formatDate(dateStr) {
  if (!dateStr) return 'Không giới hạn'
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

function getPromotionStatus(promo) {
  if (promo.isDelete) {
    return { label: 'Đã ẩn', color: '#f87171', bg: '#450a0a' }
  }
  const now = new Date()
  if (promo.expiredAt && new Date(promo.expiredAt) < now) {
    return { label: 'Đã hết hạn', color: '#9ca3af', bg: '#374151' }
  }
  if (promo.usedCount >= promo.quantity) {
    return { label: 'Hết lượt dùng', color: '#fb923c', bg: '#431407' }
  }
  return { label: 'Đang áp dụng', color: '#4ade80', bg: '#14532d' }
}

function AdminPromotionTable({
  promotions = [],
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
  const [localSearch, setLocalSearch] = useState(search)
  const [prevSearch, setPrevSearch] = useState(search)
  const [sortBy, setSortBy] = useState('id')
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
      setSortOrder(field === 'code' ? 'asc' : 'desc')
    }
  }

  const handleResetFilters = () => {
    setLocalSearch('')
    debouncedSearch.cancel()
    setSortBy('id')
    setSortOrder('desc')
    if (onResetFilters) {
      onResetFilters()
    } else {
      if (search !== '' && onSearchChange) onSearchChange('')
      if (statusFilter !== 'all' && onStatusFilterChange) onStatusFilterChange('all')
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

  const sortedPromotions = useMemo(() => {
    if (!promotions || !Array.isArray(promotions)) return []
    const list = [...promotions]
    return list.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'code' || sortBy === 'description') {
        return sortOrder === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''), 'vi')
          : String(valB || '').localeCompare(String(valA || ''), 'vi')
      }
      if (sortBy === 'expiredAt') {
        const timeA = valA ? new Date(valA).getTime() : 0
        const timeB = valB ? new Date(valB).getTime() : 0
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
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
  }, [promotions, sortBy, sortOrder])

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo mã hoặc mô tả khuyến mãi..."
            value={localSearch}
            onChange={handleInputChange}
          />
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="active">Đang áp dụng</option>
            <option value="expired">Đã hết hạn</option>
            <option value="exhausted">Hết lượt dùng</option>
            <option value="deleted">Đã ẩn</option>
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
          + Thêm mã khuyến mãi
        </button>
      </div>

      <div className="admin-table-wrapper">
        {loading && sortedPromotions.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table admin-table-promo">
          <thead>
            <tr>
              <th
                className={`admin-th-sortable ${sortBy === 'code' ? 'sorted' : ''}`}
                onClick={() => handleSort('code')}
                title="Nhấn để sắp xếp theo Mã Voucher"
              >
                Mã Voucher {renderSortIndicator('code')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'value' ? 'sorted' : ''}`}
                onClick={() => handleSort('value')}
                title="Nhấn để sắp xếp theo Mức giảm"
              >
                Mức giảm {renderSortIndicator('value')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'minimumOrderValue' ? 'sorted' : ''}`}
                onClick={() => handleSort('minimumOrderValue')}
                title="Nhấn để sắp xếp theo Điều kiện đơn hàng"
              >
                Điều kiện {renderSortIndicator('minimumOrderValue')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'usedCount' ? 'sorted' : ''}`}
                style={{ textAlign: 'center' }}
                onClick={() => handleSort('usedCount')}
                title="Nhấn để sắp xếp theo Lượt dùng"
              >
                Lượt dùng {renderSortIndicator('usedCount')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'expiredAt' ? 'sorted' : ''}`}
                onClick={() => handleSort('expiredAt')}
                title="Nhấn để sắp xếp theo Thời hạn"
              >
                Thời hạn {renderSortIndicator('expiredAt')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isDelete' ? 'sorted' : ''}`}
                style={{ textAlign: 'center' }}
                onClick={() => handleSort('isDelete')}
                title="Nhấn để sắp xếp theo Trạng thái"
              >
                Trạng thái {renderSortIndicator('isDelete')}
              </th>
              <th className="admin-col-sticky-actions" style={{ textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && sortedPromotions.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && sortedPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Đang tải danh sách khuyến mãi...
                </td>
              </tr>
            ) : sortedPromotions.length === 0 ? (
              <tr>
                <td colSpan="7" className="admin-table-empty">
                  Không tìm thấy mã khuyến mãi nào phù hợp.
                </td>
              </tr>
            ) : (
              sortedPromotions.map((promo) => {
                const status = getPromotionStatus(promo)
                const isHidden = Boolean(promo.isDelete)
                const isPercent = promo.discount_type === 'PERCENT'
                const discountDisplay = isPercent ? `${promo.value}%` : formatCurrency(promo.value)

                return (
                  <tr key={promo.id} className={isHidden ? 'admin-row-muted' : ''}>
                    <td>
                      <div className="admin-promo-code-badge">
                        🎟️ <strong>{promo.code}</strong>
                      </div>
                      <div className="admin-promo-meta">
                        <span className="admin-col-id">#{promo.id}</span>
                        {promo.description && (
                          <span className="admin-promo-desc-inline" title={promo.description}>
                            • {promo.description}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="admin-promo-value-tag">
                        {discountDisplay}
                      </span>
                      <div className="admin-text-sub">
                        {isPercent ? 'Giảm theo %' : 'Giảm cố định'}
                      </div>
                    </td>
                    <td>
                      <div className="admin-promo-condition">
                        Đơn từ: <strong>{formatCurrency(promo.minimumOrderValue)}</strong>
                      </div>
                      {isPercent && promo.maxDiscountValue && (
                        <div className="admin-promo-condition">
                          Tối đa: <strong>{formatCurrency(promo.maxDiscountValue)}</strong>
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-promo-usage">
                        <span className="admin-promo-used-count">{promo.usedCount}</span> / {promo.quantity}
                      </div>
                      <div className="admin-progress-bar-bg">
                        <div
                          className="admin-progress-bar-fill"
                          style={{
                            width: `${Math.min(100, Math.round((promo.usedCount / promo.quantity) * 100))}%`,
                          }}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="admin-promo-date">
                        Từ: {formatDate(promo.startDate)}
                      </div>
                      <div className="admin-promo-date">
                        Đến: {formatDate(promo.expiredAt)}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="admin-status-badge"
                        style={{ color: status.color, backgroundColor: status.bg }}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="admin-col-sticky-actions" style={{ textAlign: 'center' }}>
                      <div className="admin-table-actions">
                        <button
                          type="button"
                          className="admin-btn-action edit"
                          onClick={() => onOpenEdit(promo)}
                          title="Chỉnh sửa khuyến mãi"
                        >
                          ✏️ Sửa
                        </button>
                        <button
                          type="button"
                          className={`admin-btn-action ${isHidden ? 'restore' : 'delete'}`}
                          onClick={() => onToggleStatus(promo)}
                          title={isHidden ? 'Khôi phục khuyến mãi' : 'Ẩn khuyến mãi'}
                        >
                          {isHidden ? '🔄 Mở' : '👁️ Ẩn'}
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

      {totalPages > 1 && (
        <div className="admin-pagination">
          <div className="admin-pagination-info">
            Hiển thị <strong>{promotions.length}</strong> / <strong>{total}</strong> khuyến mãi
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

export default memo(AdminPromotionTable)