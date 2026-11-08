import { useState, useEffect, useCallback } from 'react'
import orderService from '../services/orderService'
import './OrderHistory.css'

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    const raw = String(dateStr).trim()
    const cleanStr = raw.endsWith('Z') ? raw.slice(0, -1) : raw
    const d = new Date(cleanStr)
    return d.toLocaleString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateStr
  }
}

const statusConfig = {
  0: { label: 'Chờ xác nhận', class: 'status-0' },
  1: { label: 'Đã thanh toán', class: 'status-1' },
  2: { label: 'Đang giao hàng', class: 'status-2' },
  3: { label: 'Hoàn thành', class: 'status-3' },
  4: { label: 'Đã hủy', class: 'status-4' },
}

function OrderHistoryPage({
  onContinueShopping,
  onGoToCart
}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [toast, setToast] = useState(null)

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3200)
  }, [])

  useEffect(() => {
    let isCurrent = true
    const params = {
      page,
      limit: 5,
      ...(statusFilter !== 'all' ? { status: Number(statusFilter) } : {})
    }
    orderService.getUserOrders(params)
      .then((res) => {
        if (!isCurrent) return
        const data = res.data || res
        setOrders(data.orders || [])
        setTotalPages(data.totalPages || 1)
        setTotal(data.total || 0)
        setLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setLoading(false)
        showToast(err.message || 'Không thể tải lịch sử đơn hàng.', 'error')
      })
    return () => {
      isCurrent = false
    }
  }, [page, statusFilter, refreshTrigger, showToast])

  const handleTabChange = (status) => {
    setLoading(true)
    setStatusFilter(status)
    setPage(1)
  }

  const handlePayNow = async (order) => {
    try {
      showToast('Đang chuyển hướng sang cổng thanh toán VNPAY...', 'info')
      const res = await orderService.getPaymentUrl(order.id)
      const paymentUrl = res.data?.paymentUrl || res.paymentUrl
      if (paymentUrl) {
        window.location.assign(paymentUrl)
      }
    } catch (err) {
      showToast(err.message || 'Không thể lấy liên kết thanh toán.', 'error')
    }
  }

  const handleOpenCancelModal = (order) => {
    setCancelModalOrder(order)
    setCancelReason('')
  }

  const handleCloseCancelModal = () => {
    setCancelModalOrder(null)
    setCancelReason('')
    setIsCancelling(false)
  }

  const handleConfirmCancel = async () => {
    if (!cancelModalOrder) return
    setIsCancelling(true)
    try {
      await orderService.cancelOrder(cancelModalOrder.id, cancelReason)
      showToast('Hủy đơn hàng thành công.', 'success')
      handleCloseCancelModal()
      setLoading(true)
      setRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      showToast(err.message || 'Không thể hủy đơn hàng.', 'error')
      setIsCancelling(false)
    }
  }

  const handleReorder = async (order) => {
    try {
      showToast('Đang thêm các sản phẩm vào giỏ hàng...', 'info')
      const res = await orderService.reorder(order.id)
      const data = res.data || res
      if (data.warnings && data.warnings.length > 0) {
        showToast(data.warnings.join(' | '), 'warning')
      } else {
        showToast('Đã thêm sản phẩm từ đơn hàng cũ vào giỏ hàng.', 'success')
      }
      if (onGoToCart) {
        onGoToCart()
      }
    } catch (err) {
      showToast(err.message || 'Không thể mua lại đơn hàng.', 'error')
    }
  }

  return (
    <div className="order-history-wrapper">
      {toast && (
        <div className="cart-toast-container">
          <div className={`cart-toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      <div className="order-history-container">
        <div className="order-history-header">
          <div>
            <h1 className="order-history-title">Đơn hàng của tôi</h1>
            <p className="order-history-subtitle">
              Quản lý và tra cứu trạng thái đơn hàng của bạn ({total} đơn)
            </p>
          </div>
          <button 
            type="button" 
            className="order-continue-btn"
            onClick={onContinueShopping}
          >
            ← Tiếp tục mua sắm
          </button>
        </div>

        <div className="order-tabs-bar">
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => handleTabChange('all')}
          >
            Tất cả
          </button>
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === '0' ? 'active' : ''}`}
            onClick={() => handleTabChange('0')}
          >
            Chờ xác nhận
          </button>
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === '1' ? 'active' : ''}`}
            onClick={() => handleTabChange('1')}
          >
            Đã thanh toán
          </button>
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === '2' ? 'active' : ''}`}
            onClick={() => handleTabChange('2')}
          >
            Đang giao
          </button>
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === '3' ? 'active' : ''}`}
            onClick={() => handleTabChange('3')}
          >
            Hoàn thành
          </button>
          <button 
            type="button" 
            className={`order-tab-btn ${statusFilter === '4' ? 'active' : ''}`}
            onClick={() => handleTabChange('4')}
          >
            Đã hủy
          </button>
        </div>

        {loading ? (
          <div className="order-loading-box">
            <div className="order-spinner" />
            <p>Đang tải danh sách đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="order-empty-box">
            <div className="order-empty-icon">📦</div>
            <h3>Chưa có đơn hàng nào</h3>
            <p>Bạn chưa có đơn hàng nào trong mục này. Hãy khám phá và chọn những cuốn sách yêu thích!</p>
            <button 
              type="button" 
              className="order-empty-cta"
              onClick={onContinueShopping}
            >
              Khám phá sách ngay
            </button>
          </div>
        ) : (
          <div className="order-cards-list">
            {orders.map((order) => {
              const statusInfo = statusConfig[order.status] || { label: 'Không xác định', class: 'status-unknown' }
              const ghnInfo = typeof order.ghn_info === 'string'
                ? (() => { try { return JSON.parse(order.ghn_info) } catch { return {} } })()
                : (order.ghn_info || {})
              const items = Array.isArray(order.items) ? order.items : []

              return (
                <div key={order.id} className="order-card-item">
                  <div className="order-card-header">
                    <div className="order-id-meta">
                      <span className="order-id-text">Mã đơn: #{order.id.slice(0, 8)}...{order.id.slice(-4)}</span>
                      <span className="order-date-text">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-status-wrap">
                      <span className={`order-status-tag ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="order-card-items">
                    {items.map((it) => (
                      <div key={it.book_id || it.id} className="order-item-row">
                        <img 
                          className="order-item-thumb" 
                          src={it.image || 'https://placehold.co/48x64/20201f/f3eadb?text=Book'} 
                          alt={it.title || 'Book'} 
                        />
                        <div className="order-item-details">
                          <h4 className="order-item-name">{it.title || `Sách mã #${it.book_id}`}</h4>
                          <span className="order-item-qty">Số lượng: x{it.quantity}</span>
                        </div>
                        <div className="order-item-price-col">
                          <span className="order-item-price">{formatCurrency(it.total)}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="order-card-footer">
                    <div className="order-shipping-info">
                      <strong>Người nhận:</strong> {order.recipientName || order.recipient_name || order.receiverName || order.fullName || order.customerName || ghnInfo.receiverName || ghnInfo.recipientName || ghnInfo.fullName || '---'} ({order.recipientPhone || order.recipient_phone || order.phoneNumber || order.phone || ghnInfo.phone || ghnInfo.phoneNumber || ghnInfo.recipientPhone || '---'})
                      <br />
                      <strong>Địa chỉ:</strong> {order.shippingAddress || order.shipping_address || order.address || ghnInfo.address || ghnInfo.shippingAddress || '---'}
                      <br />
                      <strong>Phương thức:</strong> {order.payment_method === 'VNPAY' ? 'VNPAY Sandbox' : order.payment_method === 'BANK' ? 'Chuyển khoản' : 'Thanh toán khi nhận hàng (COD)'}
                    </div>

                    <div className="order-summary-and-actions">
                      <div className="order-total-block">
                        <span className="order-total-label">Tổng tiền ({order.total_quantity || items.length} cuốn):</span>
                        <span className="order-total-amount">{formatCurrency(order.total)}</span>
                      </div>

                      <div className="order-action-buttons">
                        {order.status === 0 && order.payment_method === 'VNPAY' && (
                          <button 
                            type="button" 
                            className="btn-pay-now"
                            onClick={() => handlePayNow(order)}
                          >
                            Thanh toán ngay
                          </button>
                        )}
                        {order.status === 0 && (
                          <button 
                            type="button" 
                            className="btn-cancel-order"
                            onClick={() => handleOpenCancelModal(order)}
                          >
                            Hủy đơn
                          </button>
                        )}
                        {(order.status === 3 || order.status === 4) && (
                          <button 
                            type="button" 
                            className="btn-reorder"
                            onClick={() => handleReorder(order)}
                          >
                            Mua lại
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}

            {totalPages > 1 && (
              <div className="order-pagination-bar">
                <button 
                  type="button" 
                  disabled={page <= 1} 
                  onClick={() => {
                    setLoading(true)
                    setPage((p) => Math.max(1, p - 1))
                  }}
                >
                  ← Trước
                </button>
                <span>Trang {page} / {totalPages}</span>
                <button 
                  type="button" 
                  disabled={page >= totalPages} 
                  onClick={() => {
                    setLoading(true)
                    setPage((p) => Math.min(totalPages, p + 1))
                  }}
                >
                  Sau →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {cancelModalOrder && (
        <div className="order-modal-backdrop" onClick={handleCloseCancelModal}>
          <div className="order-modal-box" onClick={(e) => e.stopPropagation()}>
            <h3 className="order-modal-title">Xác nhận hủy đơn hàng</h3>
            <p className="order-modal-desc">
              Bạn có chắc chắn muốn hủy đơn hàng <strong>#{cancelModalOrder.id.slice(0, 8)}...</strong> không? Toàn bộ số lượng sách sẽ được hoàn trả về kho.
            </p>
            <div className="order-modal-field">
              <label htmlFor="cancel-reason-input">Lý do hủy đơn (tùy chọn):</label>
              <textarea 
                id="cancel-reason-input"
                rows="3"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ví dụ: Đổi ý, muốn mua cuốn sách khác, nhập sai địa chỉ..."
              />
            </div>
            <div className="order-modal-buttons">
              <button 
                type="button" 
                className="btn-modal-cancel"
                onClick={handleCloseCancelModal}
                disabled={isCancelling}
              >
                Giữ đơn hàng
              </button>
              <button 
                type="button" 
                className="btn-modal-confirm-cancel"
                onClick={handleConfirmCancel}
                disabled={isCancelling}
              >
                {isCancelling ? 'Đang xử lý...' : 'Xác nhận hủy'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderHistoryPage
