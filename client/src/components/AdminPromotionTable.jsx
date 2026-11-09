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
  onPageChange,
  onOpenCreate,
  onOpenEdit,
  onToggleStatus,
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
        </div>
        <button type="button" className="admin-btn-primary" onClick={onOpenCreate}>
          + Thêm mã khuyến mãi
        </button>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '60px' }}>ID</th>
              <th style={{ minWidth: '150px' }}>Mã Voucher</th>
              <th style={{ minWidth: '140px' }}>Loại & Mức giảm</th>
              <th style={{ minWidth: '180px' }}>Điều kiện áp dụng</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Lượt dùng</th>
              <th style={{ minWidth: '160px' }}>Thời hạn</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '140px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Đang tải danh sách khuyến mãi...
                </td>
              </tr>
            ) : promotions.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Không tìm thấy mã khuyến mãi nào phù hợp.
                </td>
              </tr>
            ) : (
              promotions.map((promo) => {
                const status = getPromotionStatus(promo)
                const isHidden = Boolean(promo.isDelete)
                const isPercent = promo.discount_type === 'PERCENT'
                const discountDisplay = isPercent ? `${promo.value}%` : formatCurrency(promo.value)

                return (
                  <tr key={promo.id} className={isHidden ? 'admin-row-muted' : ''}>
                    <td className="admin-col-id">#{promo.id}</td>
                    <td>
                      <div className="admin-promo-code-badge">
                        🎟️ <strong>{promo.code}</strong>
                      </div>
                      {promo.description && (
                        <div className="admin-promo-desc">{promo.description}</div>
                      )}
                    </td>
                    <td>
                      <span className="admin-promo-value-tag">
                        {discountDisplay}
                      </span>
                      <div className="admin-text-sub">
                        {isPercent ? 'Giảm theo %' : 'Giảm tiền cố định'}
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
                    <td style={{ textAlign: 'center' }}>
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

