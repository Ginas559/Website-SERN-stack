import { useState } from 'react'

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
    return new Date(dateStr).toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
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
            className="admin-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="0">Chờ xác nhận (0)</option>
            <option value="1">Đã thanh toán (1)</option>
            <option value="2">Đang giao (2)</option>
            <option value="3">Hoàn thành (3)</option>
            <option value="4">Đã hủy (4)</option>
          </select>
          <select
            className="admin-select"
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
              <th style={{ width: '130px' }}>Mã đơn</th>
              <th style={{ minWidth: '180px' }}>Khách hàng</th>
              <th>Ngày đặt</th>
              <th>Sản phẩm</th>
              <th>Tổng tiền</th>
              <th>Phương thức</th>
              <th>Trạng thái</th>
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
                      <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#e7b26a' }}>
                        #{order.id.slice(0, 8)}...
                      </span>
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
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '4px 10px',
                          borderRadius: '999px',
                          fontSize: '0.75rem',
                          fontWeight: '700',
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
                          className="admin-btn-action"
                          onClick={() => setDetailModalOrder(order)}
                          title="Xem chi tiết"
                        >
                          👁️ Chi tiết
                        </button>
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => handleOpenStatusModal(order)}
                          title="Cập nhật trạng thái"
                          style={{ borderColor: '#e7b26a', color: '#e7b26a' }}
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
          <button
            type="button"
            className="admin-page-btn"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
          >
            ← Trước
          </button>
          <span className="admin-page-info">
            Trang {page} / {totalPages} (Tổng {total} đơn)
          </span>
          <button
            type="button"
            className="admin-page-btn"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Sau →
          </button>
        </div>
      )}

      {detailModalOrder && (
        <div className="admin-modal-backdrop" onClick={() => setDetailModalOrder(null)}>
          <div className="admin-modal" style={{ maxWidth: '620px' }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2 className="admin-modal-title">Chi tiết đơn hàng #{detailModalOrder.id.slice(0, 8)}...</h2>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setDetailModalOrder(null)}
              >
                ✕
              </button>
            </div>
            <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ background: '#222220', padding: '14px', borderRadius: '10px', fontSize: '0.9rem', lineHeight: '1.6' }}>
                <div><strong>Khách hàng:</strong> {detailModalOrder.customer_name || '---'}</div>
                <div><strong>Email:</strong> {detailModalOrder.customer_email || '---'} | <strong>SĐT:</strong> {detailModalOrder.customer_phone || '---'}</div>
                <div><strong>Ngày đặt:</strong> {formatDate(detailModalOrder.createdAt)}</div>
                <div><strong>Phương thức:</strong> {detailModalOrder.payment_method}</div>
                <div><strong>Trạng thái:</strong> {orderStatusLabels[detailModalOrder.status]?.label || '---'}</div>
              </div>

              {detailModalOrder.items && detailModalOrder.items.length > 0 && (
                <div>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: '0.95rem', color: '#e7b26a' }}>Danh sách sản phẩm ({detailModalOrder.items.length})</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                    {detailModalOrder.items.map((it) => (
                      <div key={it.book_id || it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#2a2a28', padding: '8px 12px', borderRadius: '8px', fontSize: '0.85rem' }}>
                        <div>
                          <strong>{it.title || `Sách #${it.book_id}`}</strong>
                          <span style={{ color: '#b9b0a7', marginLeft: '8px' }}>x{it.quantity}</span>
                        </div>
                        <span style={{ fontWeight: '700', color: '#4ade80' }}>{formatCurrency(it.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #3d3d3a', paddingTop: '12px' }}>
                <span style={{ fontSize: '1rem', fontWeight: '700' }}>Tổng giá trị:</span>
                <span style={{ fontSize: '1.3rem', fontWeight: '800', color: '#e7b26a' }}>{formatCurrency(detailModalOrder.total)}</span>
              </div>
            </div>
            <div className="admin-modal-footer">
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
      )}

      {statusModalOrder && (
        <div className="admin-modal-backdrop" onClick={handleCloseStatusModal}>
          <div className="admin-modal" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <form onSubmit={handleSubmitStatusUpdate}>
              <div className="admin-modal-header">
                <h2 className="admin-modal-title">Cập nhật trạng thái đơn hàng</h2>
                <button
                  type="button"
                  className="admin-modal-close"
                  onClick={handleCloseStatusModal}
                >
                  ✕
                </button>
              </div>
              <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <p style={{ margin: 0, fontSize: '0.9rem', color: '#b9b0a7' }}>
                  Đơn hàng <strong>#{statusModalOrder.id.slice(0, 8)}...</strong> hiện tại là: <strong>{orderStatusLabels[statusModalOrder.status]?.label}</strong>.
                </p>

                <div className="admin-form-group">
                  <label className="admin-label">Chuyển sang trạng thái mới *</label>
                  <select
                    className="admin-select"
                    style={{ width: '100%' }}
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
                  <label className="admin-label">Ghi chú quản trị (Tùy chọn)</label>
                  <textarea
                    className="admin-textarea"
                    rows="3"
                    value={adminNote}
                    onChange={(e) => setAdminNote(e.target.value)}
                    placeholder="Ví dụ: Đã đóng gói giao cho shipper, liên hệ khách thành công..."
                  />
                </div>
              </div>
              <div className="admin-modal-footer">
                <button
                  type="button"
                  className="admin-btn-secondary"
                  onClick={handleCloseStatusModal}
                  disabled={isUpdating}
                >
                  Hủy
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

