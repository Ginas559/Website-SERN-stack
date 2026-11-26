import { useState, useCallback } from 'react'
import { RefreshIcon, MaterialCommunityIcon } from './common/Icons'
import { getPaymentMethodLabel } from '../utils/pricing'

const orderStatusLabels = {
  0: { label: 'Chờ xác nhận', color: '#b45309', bg: '#fef3c7' },
  1: { label: 'Đã xác nhận', color: '#059669', bg: '#d1fae5' },
  2: { label: 'Đang giao hàng', color: '#2563eb', bg: '#dbeafe' },
  3: { label: 'Hoàn thành', color: '#16a34a', bg: '#dcfce7' },
  4: { label: 'Đã hủy', color: '#dc2626', bg: '#fee2e2' },
}

const assignmentStatusLabels = {
  ASSIGNED: 'Chờ shipper nhận',
  ACCEPTED: 'Shipper đang giao',
  REJECTED: 'Shipper đã từ chối',
  COMPLETED: 'Đã giao hoàn tất',
  CANCELLED: 'Phân công đã hủy',
}

const deliveryTypeLabels = {
  INTERNAL: 'Nội thành',
  GHN: 'GHN',
}

const deliveryTypeTitles = {
  INTERNAL: 'Nội thành · Shipper nội bộ',
  GHN: 'Ngoại thành · GHN',
}

function normalizeDeliveryType(value) {
  return String(value || '').trim().toUpperCase()
}

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const raw = String(dateStr).trim()
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (match) {
      const [, year, month, day, hours, minutes] = match
      return `${hours}:${minutes} ${day}/${month}/${year}`
    }
    const d = new Date(raw)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function AdminOrderTable({
  orders = [],
  total = 0,
  page = 1,
  totalPages = 1,
  loading = false,
  search = '',
  statusFilter = 'all',
  paymentMethodFilter = 'all',
  deliveryTypeFilter = 'all',
  sortBy = 'createdAt',
  sortOrder = 'DESC',
  onSearchChange,
  onStatusFilterChange,
  onPaymentMethodFilterChange,
  onDeliveryTypeFilterChange,
  onSortChange,
  onResetFilters,
  onPageChange,
  onUpdateStatus,
  shippers = [],
  shippersLoading = false,
  onLoadShippers,
  onAssignOrder,
}) {
  const [detailModalOrder, setDetailModalOrder] = useState(null)
  const [statusModalOrder, setStatusModalOrder] = useState(null)
  const [nextStatus, setNextStatus] = useState(1)
  const [adminNote, setAdminNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [copiedOrderId, setCopiedOrderId] = useState(null)
  const [assignmentModalOrder, setAssignmentModalOrder] = useState(null)
  const [assignmentShipperId, setAssignmentShipperId] = useState('')
  const [assignmentNote, setAssignmentNote] = useState('')
  const [assignmentError, setAssignmentError] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  const renderSortIndicator = (field) => {
    if (sortBy === field) {
      return (
        <span className="admin-sort-indicator active">
          {sortOrder?.toUpperCase() === 'ASC' ? '▲' : '▼'}
        </span>
      )
    }
    return <span className="admin-sort-indicator">↕</span>
  }

  const handleCopyOrderId = useCallback((id) => {
    if (!id) return
    const markDone = () => {
      setCopiedOrderId(id)
      setTimeout(() => setCopiedOrderId(null), 2000)
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id).then(markDone).catch(markDone)
    } else {
      markDone()
    }
  }, [])

  const handleOpenStatusModal = (order) => {
    setStatusModalOrder(order)
    setNextStatus(order.status < 3 ? order.status + 1 : order.status)
    setAdminNote('')
  }

  const handleCloseStatusModal = () => {
    setStatusModalOrder(null)
    setAdminNote('')
    setIsUpdating(false)
  }

  const handleSubmitStatusUpdate = async (e) => {
    e.preventDefault()
    if (!statusModalOrder) return
    setIsUpdating(true)
    try {
      await onUpdateStatus(statusModalOrder.id, {
        status: Number(nextStatus),
        currentStatus: statusModalOrder.status,
        note: adminNote.trim() || undefined,
      })
      handleCloseStatusModal()
    } catch {
      setIsUpdating(false)
    }
  }

  const sortableHeaderProps = (field, label) => ({
    className: `admin-th-sortable ${sortBy === field ? 'sorted' : ''}`,
    onClick: () => onSortChange?.(field),
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSortChange?.(field)
      }
    },
    role: 'button',
    tabIndex: 0,
    'aria-label': `Sắp xếp theo ${label}`,
    'aria-sort': sortBy === field ? (sortOrder?.toUpperCase() === 'ASC' ? 'ascending' : 'descending') : 'none',
  })

  const isInternalOrder = (order) => {
    const info = typeof order?.ghn_info === 'string' ? (() => { try { return JSON.parse(order.ghn_info) } catch { return {} } })() : (order?.ghn_info || {})
    return normalizeDeliveryType(info.deliveryType) === 'INTERNAL'
  }

  const handleOpenAssignmentModal = (order) => {
    setAssignmentModalOrder(order)
    setAssignmentShipperId('')
    setAssignmentNote('')
    setAssignmentError('')
    onLoadShippers?.()
  }

  const handleCloseAssignmentModal = () => {
    if (isAssigning) return
    setAssignmentModalOrder(null)
    setAssignmentError('')
  }

  const handleSubmitAssignment = async (event) => {
    event.preventDefault()
    if (!assignmentModalOrder || !assignmentShipperId) return
    setIsAssigning(true)
    setAssignmentError('')
    try {
      await onAssignOrder(assignmentModalOrder.id, { shipperId: assignmentShipperId, note: assignmentNote.trim() || undefined })
      setAssignmentModalOrder(null)
    } catch (error) {
      setAssignmentError(error.message || 'Không thể phân công shipper.')
    } finally {
      setIsAssigning(false)
    }
  }

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo mã đơn, khách hàng, SĐT..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="0">Chờ xác nhận (0)</option>
            <option value="1">Đã xác nhận / sẵn sàng giao (1)</option>
            <option value="2">Đang giao hàng (2)</option>
            <option value="3">Hoàn thành (3)</option>
            <option value="4">Đã hủy (4)</option>
          </select>
          <select
            className="admin-filter-select"
            value={deliveryTypeFilter}
            onChange={(e) => onDeliveryTypeFilterChange(e.target.value)}
            title="Phân loại tuyến giao hàng"
          >
            <option value="all">Tất cả tuyến giao</option>
            <option value="INTERNAL">Nội thành · Shipper nội bộ</option>
            <option value="GHN">Ngoại thành · GHN</option>
          </select>
          <select
            className="admin-filter-select"
            value={paymentMethodFilter}
            onChange={(e) => onPaymentMethodFilterChange(e.target.value)}
          >
            <option value="all">Tất cả phương thức</option>
            <option value="COD">COD (Tiền mặt)</option>
            <option value="VNPAY">VNPAY Sandbox</option>
          </select>
          <button
            type="button"
            className="admin-btn-reset-filters"
            onClick={onResetFilters}
            title="Đặt lại toàn bộ tìm kiếm, bộ lọc và sắp xếp về mặc định ban đầu"
          >
            <RefreshIcon size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="admin-table-wrapper">
        {loading && orders.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table admin-order-table">
          <thead>
            <tr>
              <th
                {...sortableHeaderProps('id', 'Mã đơn')}
                style={{ width: '150px' }}
                title="Nhấn để sắp xếp theo Mã đơn"
              >
                Mã đơn {renderSortIndicator('id')}
              </th>
              <th
                {...sortableHeaderProps('customer_name', 'Tên khách hàng')}
                style={{ minWidth: '190px' }}
                title="Nhấn để sắp xếp theo Tên khách hàng"
              >
                Khách hàng {renderSortIndicator('customer_name')}
              </th>
              <th
                {...sortableHeaderProps('createdAt', 'Ngày đặt')}
                style={{ width: '155px' }}
                title="Nhấn để sắp xếp theo Ngày đặt (Mới nhất / Cũ nhất)"
              >
                Ngày đặt {renderSortIndicator('createdAt')}
              </th>
              <th
                {...sortableHeaderProps('total_quantity', 'Số lượng sản phẩm')}
                style={{ width: '115px', textAlign: 'center' }}
                title="Nhấn để sắp xếp theo Số lượng sản phẩm"
              >
                Sản phẩm {renderSortIndicator('total_quantity')}
              </th>
              <th
                {...sortableHeaderProps('total', 'Tổng tiền')}
                style={{ width: '135px' }}
                title="Nhấn để sắp xếp theo Tổng tiền"
              >
                Tổng tiền {renderSortIndicator('total')}
              </th>
              <th style={{ width: '120px' }}>Phương thức</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Loại đơn</th>
              <th
                {...sortableHeaderProps('status', 'Trạng thái đơn')}
                style={{ width: '145px', textAlign: 'center' }}
                title="Nhấn để sắp xếp theo Trạng thái đơn"
              >
                Trạng thái {renderSortIndicator('status')}
              </th>
              <th style={{ width: '170px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && orders.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && orders.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="admin-spinner" style={{ margin: '0 auto 12px' }} />
                  Đang nạp danh sách đơn hàng...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: '#64748b' }}>
                  Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const statusMeta = orderStatusLabels[order.status] || { label: 'Không xác định', color: '#fff', bg: '#333' }
                return (
                  <tr key={order.id} className="admin-order-clickable-row" onClick={() => setDetailModalOrder(order)} title="Bấm để xem chi tiết đơn hàng">
                    <td>
                      <div className="admin-order-id-cell">
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#0088a9' }} title={`Mã đầy đủ: #${order.id}`}>
                          #{order.id.slice(0, 8)}...
                        </span>
                        <button
                          type="button"
                          className="order-copy-id-btn"
                          title="Sao chép toàn bộ mã đơn"
                           onClick={(event) => {
                             event.stopPropagation()
                             handleCopyOrderId(order.id)
                           }}
                        >
                           {copiedOrderId === order.id ? '✓' : <MaterialCommunityIcon name="clipboard-text" size={15} />}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: '#0f172a' }}>
                        {order.customer_name || 'Khách hàng vãng lai'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {order.customer_phone || order.customer_email || '---'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#64748b' }}>
                      {formatDate(order.createdAt)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>
                      {order.total_quantity || 1} cuốn
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: '#059669' }}>
                        {formatCurrency(order.total)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        {getPaymentMethodLabel(order.payment_method, 'compact')}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {(() => {
                        const info = typeof order.ghn_info === 'string' ? (() => { try { return JSON.parse(order.ghn_info) } catch { return {} } })() : (order.ghn_info || {})
                        const deliveryType = normalizeDeliveryType(info.deliveryType)
                        return deliveryType ? <span className={`admin-delivery-badge ${deliveryType.toLowerCase()}`} title={deliveryTypeTitles[deliveryType] || deliveryType}>{deliveryTypeLabels[deliveryType] || deliveryType}</span> : null
                      })()}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="admin-status-badge"
                        style={{
                          color: statusMeta.color,
                          backgroundColor: statusMeta.bg,
                        }}
                      >
                        {statusMeta.label}
                      </span>
                      {order.assignment_status && (
                        <div className="admin-assignment-summary">
                          <span>{order.assignment_status === 'REJECTED' ? 'Cần phân công lại' : (assignmentStatusLabels[order.assignment_status] || order.assignment_status)}</span>
                          {order.assignment_shipper_name && <small>{order.assignment_shipper_name}</small>}
                        </div>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-order-action-buttons" onClick={(event) => event.stopPropagation()}>
                        {isInternalOrder(order) && order.status === 1 && (!order.assignment_id || ['REJECTED', 'CANCELLED'].includes(order.assignment_status)) && (
                          <button
                            type="button"
                            className="admin-btn-action assign"
                            onClick={() => handleOpenAssignmentModal(order)}
                            title={order.assignment_id ? 'Phân công lại shipper nội bộ' : 'Phân công shipper nội bộ'}
                          >
                            <MaterialCommunityIcon name="truck-delivery" size={15} /><span>{order.assignment_id ? 'Phân công lại' : 'Phân công'}</span>
                          </button>
                        )}
                          <button
                            type="button"
                            className="admin-btn-action edit"
                            onClick={() => handleOpenStatusModal(order)}
                            title="Cập nhật trạng thái"
                            aria-label="Chỉnh sửa trạng thái đơn hàng"
                          >
                            <MaterialCommunityIcon name="pencil" size={15} /><span>Chỉnh sửa</span>
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
            Hiển thị <strong>{orders.length}</strong> / <strong>{total}</strong> đơn hàng
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

      {detailModalOrder && (() => {
        const ghnInfo = typeof detailModalOrder.ghn_info === 'string'
          ? (() => { try { return JSON.parse(detailModalOrder.ghn_info) } catch { return {} } })()
          : (detailModalOrder.ghn_info || {})
        const items = Array.isArray(detailModalOrder.items) ? detailModalOrder.items : []

        return (
          <div className="admin-modal-overlay">
            <div className="admin-modal-box user-detail">
              <div className="admin-modal-header">
                <div>
                  <h2 className="admin-modal-title">
                    Chi tiết Đơn hàng #{detailModalOrder.id.slice(0, 8)}...
                  </h2>
                  <div className="admin-order-id-full">
                    Mã UUID: <code>{detailModalOrder.id}</code>
                    <button
                      type="button"
                      className="order-copy-id-btn"
                      title="Sao chép toàn bộ mã đơn"
                      onClick={() => handleCopyOrderId(detailModalOrder.id)}
                    >
                       {copiedOrderId === detailModalOrder.id ? '✓ Đã chép' : <><MaterialCommunityIcon name="clipboard-text" size={15} />Chép mã</>}
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  className="admin-modal-close"
                  onClick={() => setDetailModalOrder(null)}
                >
                  &times;
                </button>
              </div>

              <div className="admin-modal-body" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <section className="admin-order-detail-section admin-order-customer-section">
                  <h3 className="admin-order-detail-section-title">Thông tin đơn hàng</h3>
                  <div className="admin-user-detail-grid">
                  <div className="admin-user-detail-field">
                    <span className="label">Người nhận hàng:</span>
                       <span className="value">
                      {detailModalOrder.recipientName || detailModalOrder.recipient_name || detailModalOrder.receiverName || detailModalOrder.fullName || detailModalOrder.customer_name || '---'}
                    </span>
                  </div>
                  <div className="admin-user-detail-field">
                    <span className="label">Số điện thoại:</span>
                     <span className="value">
                      {detailModalOrder.recipientPhone || detailModalOrder.recipient_phone || detailModalOrder.phoneNumber || detailModalOrder.customer_phone || '---'}
                    </span>
                  </div>
                  <div className="admin-user-detail-field" style={{ gridColumn: 'span 2' }}>
                    <span className="label">Địa chỉ giao hàng:</span>
                    <span className="value">
                      {detailModalOrder.shippingAddress || detailModalOrder.shipping_address || detailModalOrder.address || '---'}
                    </span>
                  </div>
                  <div className="admin-user-detail-field">
                    <span className="label">Phương thức thanh toán:</span>
                    <span className="value">
                      {getPaymentMethodLabel(detailModalOrder.payment_method, 'full')}
                    </span>
                  </div>
                   <div className="admin-user-detail-field">
                      <span className="label">Trạng thái đơn:</span>
                     <span className="value admin-order-status-value">
                       <span className="admin-status-badge" style={{ color: orderStatusLabels[detailModalOrder.status]?.color, backgroundColor: orderStatusLabels[detailModalOrder.status]?.bg }}>
                        {orderStatusLabels[detailModalOrder.status]?.label || '---'}
                      </span>
                    </span>
                  </div>
                  <div className="admin-user-detail-field">
                    <span className="label">Ngày đặt hàng:</span>
                    <span className="value">{formatDate(detailModalOrder.createdAt)}</span>
                  </div>
                   <div className="admin-user-detail-field">
                     <span className="label">Email khách hàng:</span>
                     <span className="value">{detailModalOrder.customer_email || '---'}</span>
                   </div>
                  </div>
                </section>

                <section className="admin-order-detail-section admin-order-delivery-section">
                  <h3 className="admin-order-detail-section-title">Vận hành giao hàng</h3>
                  <div className="admin-user-detail-grid">
                  {detailModalOrder.ghn_code && (
                    <div className="admin-user-detail-field">
                      <span className="label">Mã vận đơn GHN:</span>
                      <span className="value" style={{ color: '#c2410c', fontWeight: 700 }}>
                        {detailModalOrder.ghn_code}
                        {!detailModalOrder.ghn_code.startsWith('GHN_') && (
                          <a
                            href={`https://donhang.ghn.vn/?order_code=${detailModalOrder.ghn_code}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ marginLeft: '10px', color: '#ea580c', fontWeight: 600, fontSize: '0.85rem', textDecoration: 'none' }}
                          >
                            ↗ Xem trên GHN
                          </a>
                        )}
                      </span>
                    </div>
                  )}
                  <div className="admin-user-detail-field">
                    <span className="label">Loại đơn:</span>
                    <span className="value">
                      {(() => {
                        const deliveryType = normalizeDeliveryType(ghnInfo.deliveryType)
                        return <span className={`admin-delivery-badge ${deliveryType.toLowerCase()}`} title={deliveryTypeTitles[deliveryType] || deliveryType}>{deliveryTypeLabels[deliveryType] || '—'}</span>
                      })()}
                    </span>
                  </div>
                  <div className="admin-user-detail-field">
                    <span className="label">Tình trạng phân công:</span>
                     <span className="value admin-assignment-status-value">
                       {detailModalOrder.assignment_status ? (assignmentStatusLabels[detailModalOrder.assignment_status] || detailModalOrder.assignment_status) : 'Chưa phân công'}
                    </span>
                  </div>
                  {detailModalOrder.assignment_shipper_name && (
                    <div className="admin-user-detail-field">
                      <span className="label">Shipper phụ trách:</span>
                      <span className="value">{detailModalOrder.assignment_shipper_name}</span>
                    </div>
                  )}
                   {detailModalOrder.assignment_rejection_reason && detailModalOrder.assignment_status === 'REJECTED' && (
                    <div className="admin-user-detail-field admin-order-rejection-detail">
                      <span className="label">Lý do từ chối:</span>
                        <span className="value admin-rejection-detail-value">{detailModalOrder.assignment_rejection_reason}</span>
                    </div>
                   )}
                    {(detailModalOrder.assignment_completion_note || detailModalOrder.assignment_note) && detailModalOrder.assignment_status === 'COMPLETED' && (
                      <div className="admin-user-detail-field">
                        <span className="label">Ghi chú của Shipper:</span>
                        <span className="value">{detailModalOrder.assignment_completion_note || detailModalOrder.assignment_note}</span>
                      </div>
                    )}
                  </div>
                </section>

                {items.length > 0 && (
                  <div className="admin-order-items-box">
                    <h4 className="admin-order-section-title">
                      Danh sách ấn phẩm ({items.length} đầu sách)
                    </h4>
                    <div className="admin-order-items-scroll">
                      {items.map((it) => (
                        <div key={it.book_id || it.id} className="admin-order-item-card">
                          <img
                            src={it.image || 'https://placehold.co/48x64/20201f/f3eadb?text=Book'}
                            alt={it.title}
                            className="admin-order-item-thumb"
                          />
                          <div className="admin-order-item-info">
                            <div className="admin-order-item-title">{it.title || `Sách #${it.book_id}`}</div>
                            <div className="admin-order-item-qty">Số lượng: x{it.quantity}</div>
                          </div>
                          <div className="admin-order-item-price">
                            {formatCurrency(it.total)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="admin-order-calc-breakdown">
                  {ghnInfo.subtotal > 0 && ghnInfo.subtotal !== detailModalOrder.total && (
                    <div className="admin-order-calc-row">
                      <span>Tạm tính tiền sách:</span>
                      <span>{formatCurrency(ghnInfo.subtotal)}</span>
                    </div>
                  )}
                  {ghnInfo.shippingFee !== undefined && (
                    <div className="admin-order-calc-row">
                      <span>Phí vận chuyển:</span>
                      <span>{ghnInfo.shippingFee > 0 ? formatCurrency(ghnInfo.shippingFee) : 'Miễn phí'}</span>
                    </div>
                  )}
                  {(ghnInfo.discountValue > 0 || detailModalOrder.discount > 0) && (
                    <div className="admin-order-calc-row discount">
                      <span>Voucher giảm giá {ghnInfo.couponCode ? `(${ghnInfo.couponCode})` : ''}:</span>
                      <span>-{formatCurrency(ghnInfo.discountValue || detailModalOrder.discount)}</span>
                    </div>
                  )}
                  <div className="admin-order-calc-row total">
                    <span>Tổng thanh toán:</span>
                    <span className="admin-order-total-highlight">{formatCurrency(detailModalOrder.total)}</span>
                  </div>
                </div>
              </div>

              <div className="admin-modal-actions" style={{ padding: '16px 28px' }}>
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={() => setDetailModalOrder(null)}
                >
                  Đóng
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {statusModalOrder && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box block-confirm">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">
                Cập nhật Trạng thái Đơn hàng
              </h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={handleCloseStatusModal}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSubmitStatusUpdate} className="admin-modal-form">
              <div className="admin-order-status-current-box">
                <span style={{ color: '#64748b' }}>
                  Đơn hàng <strong>#{statusModalOrder.id.slice(0, 8)}...</strong> hiện tại:
                </span>
                <span
                  className="admin-status-badge"
                  style={{
                    color: orderStatusLabels[statusModalOrder.status]?.color,
                    backgroundColor: orderStatusLabels[statusModalOrder.status]?.bg,
                  }}
                >
                  {orderStatusLabels[statusModalOrder.status]?.label}
                </span>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">
                  Chuyển sang trạng thái mới <span className="req">*</span>
                </label>
                <select
                  className="admin-form-select"
                  value={nextStatus}
                  onChange={(e) => setNextStatus(Number(e.target.value))}
                >
                  <option value="0">Chờ xác nhận (0)</option>
                  <option value="1">Đã xác nhận / sẵn sàng giao (1)</option>
                  <option value="2">Đang giao hàng (2)</option>
                  <option value="3">Hoàn thành (3)</option>
                  <option value="4">Hủy đơn hàng (4 - Hoàn trả kho)</option>
                </select>
              </div>

              <div className="admin-form-group">
                <label className="admin-form-label">Ghi chú quản trị (Tùy chọn)</label>
                <textarea
                  className="admin-form-textarea"
                  rows="3"
                  value={adminNote}
                  onChange={(e) => setAdminNote(e.target.value)}
                  placeholder="Ví dụ: Đã đóng gói giao cho shipper, liên hệ khách thành công..."
                />
              </div>

              <div className="admin-modal-actions">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={handleCloseStatusModal}
                  disabled={isUpdating}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="admin-btn-primary"
                  disabled={isUpdating}
                >
                  {isUpdating ? 'Đang cập nhật...' : 'Lưu trạng thái'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {assignmentModalOrder && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-box block-confirm">
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Phân công shipper nội thành</h2>
              <button type="button" className="admin-modal-close" onClick={handleCloseAssignmentModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmitAssignment} className="admin-modal-form">
              <div className="admin-order-status-current-box">Đơn hàng <strong>#{assignmentModalOrder.id.slice(0, 8)}...</strong></div>
              {assignmentError && <div className="admin-form-error">{assignmentError}</div>}
              <div className="admin-form-group">
                <label className="admin-form-label">Chọn shipper <span className="req">*</span></label>
                <select className="admin-form-select" value={assignmentShipperId} onChange={(event) => setAssignmentShipperId(event.target.value)} required disabled={shippersLoading || isAssigning}>
                  <option value="">{shippersLoading ? 'Đang tải danh sách shipper...' : 'Chọn shipper đang hoạt động'}</option>
                  {shippers.map((shipper) => <option key={shipper.id} value={shipper.id}>{shipper.full_name || shipper.fullName || shipper.username} — {shipper.email}</option>)}
                </select>
                {!shippersLoading && shippers.length === 0 && <small>Chưa có shipper đang hoạt động.</small>}
              </div>
              <div className="admin-form-group">
                <label className="admin-form-label">Ghi chú phân công (Tùy chọn)</label>
                <textarea className="admin-form-textarea" rows="3" maxLength="1000" value={assignmentNote} onChange={(event) => setAssignmentNote(event.target.value)} placeholder="Ví dụ: Giao trước 18 giờ..." />
              </div>
              <div className="admin-modal-actions">
                <button type="button" className="admin-btn-secondary" onClick={handleCloseAssignmentModal} disabled={isAssigning}>Hủy bỏ</button>
                <button type="submit" className="admin-btn-primary" disabled={isAssigning || shippersLoading || !assignmentShipperId}>{isAssigning ? 'Đang phân công...' : 'Xác nhận phân công'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminOrderTable
