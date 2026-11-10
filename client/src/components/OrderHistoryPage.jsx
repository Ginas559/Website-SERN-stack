import { useState, useEffect, useCallback } from 'react'
import orderService from '../services/orderService'
import reviewService, { getMyReviewedBookIds } from '../services/reviewService'
import './OrderHistory.css'

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

const statusConfig = {
  0: { label: 'Chờ xác nhận', class: 'status-0' },
  1: { label: 'Đã thanh toán', class: 'status-1' },
  2: { label: 'Đang giao hàng', class: 'status-2' },
  3: { label: 'Hoàn thành', class: 'status-3' },
  4: { label: 'Đã hủy', class: 'status-4' },
}

function OrderHistoryPage({
  onContinueShopping,
  onGoToCart,
  onSelectBook
}) {
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [reviewedBookIds, setReviewedBookIds] = useState(new Set())

  const navigate = (url) => {
    try {
      const parsed = new URL(url, window.location.origin)
      const match = parsed.pathname.match(/\/books\/(\d+)/) || parsed.pathname.match(/\/books\?id=(\d+)/)
      const targetBookId = match ? Number(match[1]) : (Number(parsed.searchParams.get('bookId')) || null)
      const isDiscussion = parsed.searchParams.get('tab') === 'discussion'
      const focusReview = parsed.searchParams.get('focus') === 'review'
      window.location.hash = parsed.hash || 'book-reviews-section'
      if (onSelectBook && targetBookId) {
        onSelectBook(targetBookId, {
          tab: isDiscussion ? 'discussions' : 'reviews',
          focus: focusReview ? 'review' : null,
          scrollToReviews: true,
          scrollToOwnReview: focusReview
        })
      }
    } catch {
      return
    }
  }

  const [reviewModalBook, setReviewModalBook] = useState(null)
  const [reviewRate, setReviewRate] = useState(5)
  const [reviewText, setReviewText] = useState('')
  const [isSubmittingReview, setIsSubmittingReview] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState('')

  const handleOpenReviewModal = (item) => {
    setReviewModalBook(item)
    setReviewRate(5)
    setReviewText('')
    setReviewFeedback('')
  }

  const handleSubmitOrderReview = async () => {
    if (!reviewModalBook) return
    const bookId = reviewModalBook.book_id || reviewModalBook.id
    try {
      setIsSubmittingReview(true)
      setReviewFeedback('')
      await reviewService.createReview(bookId, {
        rate: reviewRate,
        value: reviewText.trim() || null
      })
      showToast('Cảm ơn bạn đã gửi đánh giá cho sản phẩm!', 'success')
      setReviewModalBook(null)
      setReviewedBookIds((prev) => new Set([...prev, Number(bookId)]))
      setOrders((prevOrders) =>
        prevOrders.map((ord) => ({
          ...ord,
          items: Array.isArray(ord.items)
            ? ord.items.map((it) => {
                const currentBookId = it.book_id || it.id
                return currentBookId === bookId ? { ...it, isReviewed: true } : it
              })
            : ord.items
        }))
      )
    } catch (err) {
      setReviewFeedback(err.message || 'Gửi đánh giá thất bại.')
    } finally {
      setIsSubmittingReview(false)
    }
  }

  const [cancelModalOrder, setCancelModalOrder] = useState(null)
  const [cancelReason, setCancelReason] = useState('')
  const [isCancelling, setIsCancelling] = useState(false)

  const [toast, setToast] = useState(null)
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

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 3200)
  }, [])

  useEffect(() => {
    getMyReviewedBookIds()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || [])
        setReviewedBookIds(new Set(list.map(Number)))
      })
      .catch(() => {})
  }, [refreshTrigger])

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
                      <span className="order-id-text" title={`Mã đơn hàng đầy đủ: #${order.id}`}>Mã đơn: #{order.id.slice(0, 8)}...{order.id.slice(-4)}</span>
                      <button 
                        type="button" 
                        className="order-copy-id-btn"
                        title="Sao chép toàn bộ mã đơn hàng"
                        onClick={() => handleCopyOrderId(order.id)}
                      >
                        {copiedOrderId === order.id ? '✓ Đã chép' : '📋 Chép mã'}
                      </button>
                      <span className="order-date-text">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-status-wrap">
                      <span className={`order-status-tag ${statusInfo.class}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                  </div>

                  <div className="order-card-items">
                    {items.map((it) => {
                      const bookId = it.book_id || it.id
                      const unitPrice = it.price || (it.quantity > 0 ? it.total / it.quantity : it.total)
                      return (
                        <div key={bookId} className="order-item-row">
                          <img 
                            className={`order-item-thumb ${onSelectBook ? 'clickable' : ''}`}
                            src={it.image || 'https://placehold.co/48x64/20201f/f3eadb?text=Book'} 
                            alt={it.title || 'Book'} 
                            onClick={() => onSelectBook && onSelectBook(bookId)}
                            title={onSelectBook ? 'Bấm để xem chi tiết và đánh giá cuốn sách này' : undefined}
                          />
                          <div className="order-item-details">
                            <h4 
                              className={`order-item-name ${onSelectBook ? 'clickable' : ''}`}
                              onClick={() => onSelectBook && onSelectBook(bookId)}
                              title={onSelectBook ? 'Bấm để xem chi tiết và đánh giá cuốn sách này' : undefined}
                            >
                              {it.title || `Sách mã #${bookId}`}
                            </h4>
                            <div className="order-item-meta-row">
                              <span className="order-item-qty">Số lượng: <strong>x{it.quantity}</strong></span>
                              <span className="order-item-dot">•</span>
                              <span className="order-item-unit-price">Đơn giá: {formatCurrency(unitPrice)}</span>
                            </div>
                            {order.status === 3 && (() => {
                              const hasReviewed = reviewedBookIds.has(Number(bookId)) || Boolean(it.isReviewed)
                              return (
                                <div className="order-item-actions-row">
                                  {!hasReviewed ? (
                                    <button
                                      type="button"
                                      className="btn-order-review btn-quick-review"
                                      onClick={() => handleOpenReviewModal(it)}
                                      title="Đánh giá nhanh số sao và nhận xét ngay tại đây"
                                    >
                                      ⭐ Đánh giá
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="order-history-btn-reviewed"
                                      onClick={() => navigate(`/books/${bookId}?focus=review#book-reviews-section`)}
                                      title="Xem bài đánh giá của bạn trên trang sản phẩm"
                                    >
                                      ✓ Đã đánh giá
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    className="btn-view-book-detail"
                                    onClick={() => navigate(`/books/${bookId}?tab=discussion#book-reviews-section`)}
                                    title="Chuyển đến trang chi tiết cuốn sách để xem thảo luận cộng đồng"
                                  >
                                    💬 Chi tiết & Thảo luận
                                  </button>
                                </div>
                              )
                            })()}
                          </div>
                          <div className="order-item-price-col">
                            <span className="order-item-price-label">Thành tiền</span>
                            <span className="order-item-price">{formatCurrency(it.total)}</span>
                          </div>
                        </div>
                      )
                    })}
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
                      <div className="order-calc-breakdown">
                        {ghnInfo.subtotal > 0 && ghnInfo.subtotal !== order.total && (
                          <div className="order-calc-item">
                            <span className="order-calc-label">Tạm tính:</span>
                            <span className="order-calc-val">{formatCurrency(ghnInfo.subtotal)}</span>
                          </div>
                        )}
                        {ghnInfo.shippingFee !== undefined && (
                          <div className="order-calc-item">
                            <span className="order-calc-label">Phí vận chuyển:</span>
                            <span className="order-calc-val">{ghnInfo.shippingFee > 0 ? formatCurrency(ghnInfo.shippingFee) : 'Miễn phí'}</span>
                          </div>
                        )}
                        {(ghnInfo.discountValue > 0 || order.discount > 0) && (
                          <div className="order-calc-item discount">
                            <span className="order-calc-label">Voucher giảm giá {ghnInfo.couponCode ? `(${ghnInfo.couponCode})` : ''}:</span>
                            <span className="order-calc-val">-{formatCurrency(ghnInfo.discountValue || order.discount)}</span>
                          </div>
                        )}
                        <div className="order-total-block">
                          <span className="order-total-label">Tổng thanh toán ({order.total_quantity || items.length} cuốn):</span>
                          <span className="order-total-amount">{formatCurrency(order.total)}</span>
                        </div>
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

      {reviewModalBook && (
        <div className="order-modal-backdrop">
          <div className="order-modal-box">
            <h3 className="order-modal-title">Đánh giá sản phẩm</h3>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '16px' }}>
              <img 
                src={reviewModalBook.image || 'https://placehold.co/48x64/20201f/f3eadb?text=Book'} 
                alt={reviewModalBook.title || 'Book'}
                style={{ width: '48px', height: '64px', objectFit: 'cover', borderRadius: '4px' }}
              />
              <div>
                <h4 style={{ margin: '0 0 4px 0', fontSize: '0.95rem' }}>{reviewModalBook.title || `Sách mã #${reviewModalBook.book_id || reviewModalBook.id}`}</h4>
                <span style={{ fontSize: '0.85rem', color: '#8c8273' }}>Đơn hàng đã nhận thành công</span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'block', marginBottom: '6px', fontWeight: 600, fontSize: '0.9rem' }}>
                Chất lượng sản phẩm:
              </label>
              <div style={{ display: 'flex', gap: '8px', fontSize: '1.8rem', cursor: 'pointer' }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <span 
                    key={s} 
                    style={{ color: reviewRate >= s ? '#f59e0b' : '#d1d5db', transition: 'color 0.15s' }}
                    onClick={() => setReviewRate(s)}
                  >
                    ★
                  </span>
                ))}
              </div>
            </div>

            <div className="order-modal-field">
              <label htmlFor="order-review-textarea">Chia sẻ cảm nhận của bạn:</label>
              <textarea
                id="order-review-textarea"
                rows="3"
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Hãy chia sẻ cảm nhận về chất lượng sách, nội dung, giao hàng..."
                maxLength={1000}
              />
            </div>

            {reviewFeedback ? (
              <div style={{ background: '#2d1818', border: '1px solid #5c2828', borderLeft: '4px solid #f87171', color: '#fca5a5', padding: '10px 14px', borderRadius: '8px', fontSize: '0.86rem', marginBottom: '14px', fontWeight: 500 }}>
                {reviewFeedback}
              </div>
            ) : null}

            <div className="order-modal-buttons">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setReviewModalBook(null)}
                disabled={isSubmittingReview}
              >
                Đóng
              </button>
              <button
                type="button"
                className="btn-reorder"
                style={{ background: '#c77736', color: '#fff', border: 'none' }}
                onClick={handleSubmitOrderReview}
                disabled={isSubmittingReview}
              >
                {isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}
              </button>
            </div>
          </div>
        </div>
      )}

      {cancelModalOrder && (
        <div className="order-modal-backdrop">
          <div className="order-modal-box">
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
