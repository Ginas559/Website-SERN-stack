import { useState, useCallback } from 'react'

const orderStatusLabels = {
  0: { label: 'Chờ xác nhận', color: '#f59e0b', bg: '#451a03' },
  1: { label: 'Đã thanh toán', color: '#34d399', bg: '#064e3b' },
  2: { label: 'Đang giao hàng', color: '#60a5fa', bg: '#1e3a8a' },
  3: { label: 'Hoàn thành', color: '#4ade80', bg: '#14532d' },
  4: { label: 'Đã hủy', color: '#f87171', bg: '#450a0a' },
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
  onSearchChange,
  onStatusFilterChange,
  onPaymentMethodFilterChange,
  onPageChange,
  onUpdateStatus,
}) {
  const [detailModalOrder, setDetailModalOrder] = useState(null)
  const [statusModalOrder, setStatusModalOrder] = useState(null)
  const [nextStatus, setNextStatus] = useState(1)
  const [adminNote, setAdminNote] = useState('')
  const [isUpdating, setIsUpdating] = useState(false)
  const [copiedOrderId, setCopiedOrderId] = useState(null)

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
            <option value="1">Đã thanh toán (1)</option>
            <option value="2">Đang giao hàng (2)</option>
            <option value="3">Hoàn thành (3)</option>
            <option value="4">Đã hủy (4)</option>
          </select>
          <select
            className="admin-filter-select"
            value={paymentMethodFilter}
            onChange={(e) => onPaymentMethodFilterChange(e.target.value)}
          >
            <option value="all">Tất cả phương thức</option>
            <option value="COD">COD (Tiền mặt)</option>
            <option value="VNPAY">VNPAY Sandbox</option>
            <option value="BANK">Chuyển khoản</option>
          </select>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '150px' }}>Mã đơn</th>
              <th style={{ minWidth: '180px' }}>Khách hàng</th>
              <th>Ngày đặt</th>
              <th style={{ textAlign: 'center' }}>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Phương thức</th>
              <th style={{ textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '170px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div className="admin-spinner" style={{ margin: '0 auto 12px' }} />
                  Đang nạp danh sách đơn hàng...
                </td>
              </tr>
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '40px 0', color: '#b9b0a7' }}>
                  Không tìm thấy đơn hàng nào phù hợp với bộ lọc.
                </td>
              </tr>
            ) : (
              orders.map((order) => {
                const statusMeta = orderStatusLabels[order.status] || { label: 'Không xác định', color: '#fff', bg: '#333' }
                return (
                  <tr key={order.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#e7b26a' }} title={`Mã đầy đủ: #${order.id}`}>
                          #{order.id.slice(0, 8)}...
                        </span>
                        <button
                          type="button"
                          className="order-copy-id-btn"
                          title="Sao chép toàn bộ mã đơn"
                          onClick={() => handleCopyOrderId(order.id)}
                        >
                          {copiedOrderId === order.id ? '✓' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: '600', color: '#fffaf1' }}>
                        {order.customer_name || 'Khách hàng vãng lai'}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#b9b0a7' }}>
                        {order.customer_phone || order.customer_email || '---'}
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: '#b9b0a7' }}>
                      {formatDate(order.createdAt)}
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: '600' }}>
                      {order.total_quantity || 1} cuốn
                    </td>
                    <td>
                      <span style={{ fontWeight: '700', color: '#4ade80' }}>
                        {formatCurrency(order.total)}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                        {order.payment_method === 'VNPAY' ? 'VNPAY' : order.payment_method === 'BANK' ? 'BANK' : 'COD'}
                      </span>
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
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="admin-btn-action detail"
                          onClick={() => setDetailModalOrder(order)}
                          title="Xem chi tiết"
                        >
                          👁️ Chi tiết
                        </button>
                        <button
                          type="button"
                          className="admin-btn-action edit"
                          onClick={() => handleOpenStatusModal(order)}
                          title="Cập nhật trạng thái"
                        >
                          ✏️ Đổi
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
                      {copiedOrderId === detailModalOrder.id ? '✓ Đã chép' : '📋 Chép mã'}
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
                      {detailModalOrder.payment_method === 'VNPAY' ? 'VNPAY Sandbox' : detailModalOrder.payment_method === 'BANK' ? 'Chuyển khoản' : 'Thanh toán khi nhận hàng (COD)'}
                    </span>
                  </div>
                  <div className="admin-user-detail-field">
                    <span className="label">Trạng thái đơn:</span>
                    <span className="value">
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
                <span style={{ color: '#b9b0a7' }}>
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
                  <option value="1">Đã xác nhận / Đã thanh toán (1)</option>
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
    </div>
  )
}

export default AdminOrderTable
