import { useState, useEffect, useCallback, useRef } from 'react'
import { useDispatch } from 'react-redux'
import orderService from '../services/orderService'
import reviewService, { getMyReviewedBookIds } from '../services/reviewService'
import { fetchCart } from '../store/slices/cartSlice'
import { invalidateBooks } from '../store/slices/bookSlice'
import shippingService from '../services/shippingService'
import { getPaymentMethodLabel } from '../utils/pricing'
import { MaterialCommunityIcon } from './common/Icons'
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

function parseOrderTime(dateStr) {
  if (!dateStr) return 0
  const raw = String(dateStr).trim()
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/)
  if (match) {
    const [, year, month, day, hours, minutes, seconds] = match
    return new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds)).getTime()
  }
  return new Date(raw).getTime()
}

const statusConfig = {
  0: { label: 'Chờ xác nhận', class: 'status-0' },
  1: { label: 'Đã xác nhận', class: 'status-1' },
  2: { label: 'Đang giao hàng', class: 'status-2' },
  3: { label: 'Hoàn thành', class: 'status-3' },
  4: { label: 'Đã hủy', class: 'status-4' },
}

function getOrderStatusInfo(order) {
  const statusNum = Number(order?.status)
  const baseStatus = statusConfig[statusNum] || { label: 'Không xác định', class: 'status-unknown' }
  if (statusNum === 1 && String(order?.payment_method || '').toUpperCase() === 'VNPAY') {
    return { ...baseStatus, label: 'Đã thanh toán' }
  }
  return baseStatus
}

function VnpayCountdown({ createdAt, onExpire }) {
  const [secondsLeft, setSecondsLeft] = useState(() => {
    if (!createdAt) return 0
    const createdTime = parseOrderTime(createdAt)
    if (!createdTime || Number.isNaN(createdTime)) return 0
    return Math.max(0, Math.floor((createdTime + 15 * 60 * 1000 - Date.now()) / 1000))
  })

  useEffect(() => {
    if (!createdAt) return undefined
    const createdTime = parseOrderTime(createdAt)
    if (!createdTime || Number.isNaN(createdTime)) return undefined
    const expiryTime = createdTime + 15 * 60 * 1000

    if (expiryTime <= Date.now()) {
      if (onExpire) {
        onExpire()
      }
      return undefined
    }

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((expiryTime - Date.now()) / 1000))
      setSecondsLeft(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        if (onExpire) {
          onExpire()
        }
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [createdAt, onExpire])

  if (secondsLeft <= 0) {
    return (
      <span className="vnpay-countdown-badge expired" title="Thời hạn 15 phút thanh toán đã hết. Đơn hàng đang được tự động hủy và hoàn trả kho.">
        ⏱️ Hết hạn thanh toán
      </span>
    )
  }

  const mins = Math.floor(secondsLeft / 60)
  const secs = secondsLeft % 60
  const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`

  return (
    <span className="vnpay-countdown-badge active" title="Đơn hàng sẽ tự động hủy nếu không thanh toán trong vòng 15 phút kể từ lúc đặt">
      <span className="countdown-pulse-dot" />
      ⏱️ Hạn thanh toán: <strong>{formatted}</strong>
    </span>
  )
}

function OrderHistoryPage({
  onContinueShopping,
  onGoToCart,
  onSelectBook
}) {
  const dispatch = useDispatch()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [statusFilter, setStatusFilter] = useState('all')
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [reviewedBookIds, setReviewedBookIds] = useState(new Set())
  const [expiredOrderIds, setExpiredOrderIds] = useState(new Set())

  const handleOrderExpired = useCallback((orderId) => {
    setExpiredOrderIds((prev) => new Set([...prev, orderId]))
    setRefreshTrigger((prev) => prev + 1)
  }, [])

  const navigate = (url) => {
    try {
      const parsed = new URL(url, window.location.origin)
      const match = parsed.pathname.match(/\/books\/(\d+)/) || parsed.pathname.match(/\/books\?id=(\d+)/)
      const targetBookId = match ? Number(match[1]) : (Number(parsed.searchParams.get('bookId')) || null)
      const isDiscussion = parsed.searchParams.get('tab') === 'discussion'
      const focusReview = parsed.searchParams.get('focus') === 'review'
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
  const [toast, setToast] = useState(null)
  const [copiedOrderId, setCopiedOrderId] = useState(null)
  const toastTimerRef = useRef(null)
  const copiedGhnTimerRef = useRef(null)
  const copiedOrderTimerRef = useRef(null)

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    if (copiedGhnTimerRef.current) clearTimeout(copiedGhnTimerRef.current)
    if (copiedOrderTimerRef.current) clearTimeout(copiedOrderTimerRef.current)
  }, [])

  const showToast = useCallback((message, type = 'info') => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    setToast({ message, type })
    toastTimerRef.current = setTimeout(() => {
      setToast(null)
      toastTimerRef.current = null
    }, 3200)
  }, [])

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

  const [expandedTrackerIds, setExpandedTrackerIds] = useState(new Set())
  const [copiedGhnCode, setCopiedGhnCode] = useState(null)

  const toggleTracker = useCallback((order) => {
    const orderId = typeof order === 'object' && order ? order.id : order
    const shouldExpand = !expandedTrackerIds.has(orderId)
    setExpandedTrackerIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) {
        next.delete(orderId)
      } else {
        next.add(orderId)
      }
      return next
    })
    if (shouldExpand && typeof order === 'object' && Number(order?.status) === 2 && order.ghn_code && !order.ghn_code.startsWith('GHN_')) {
      shippingService.trackOrder(order.ghn_code)
        .then((res) => {
          const trackingData = res?.data || res
          if (trackingData?.status === 'delivered') {
            setRefreshTrigger((p) => p + 1)
          }
        })
        .catch((err) => {
          showToast(err.message || 'Không thể tải trạng thái vận đơn GHN.', 'error')
        })
    }
  }, [expandedTrackerIds, showToast])

  const handleCopyGhnCode = useCallback((code) => {
    if (!code) return
    const markDone = () => {
      if (copiedGhnTimerRef.current) clearTimeout(copiedGhnTimerRef.current)
      setCopiedGhnCode(code)
      copiedGhnTimerRef.current = setTimeout(() => {
        setCopiedGhnCode(null)
        copiedGhnTimerRef.current = null
      }, 2000)
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(code).then(markDone).catch(markDone)
    } else {
      markDone()
    }
  }, [])

  const handleCopyOrderId = useCallback((id) => {
    if (!id) return
    const markDone = () => {
      if (copiedOrderTimerRef.current) clearTimeout(copiedOrderTimerRef.current)
      setCopiedOrderId(id)
      copiedOrderTimerRef.current = setTimeout(() => {
        setCopiedOrderId(null)
        copiedOrderTimerRef.current = null
      }, 2000)
    }
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(id).then(markDone).catch(markDone)
    } else {
      markDone()
    }
  }, [])

  useEffect(() => {
    getMyReviewedBookIds()
      .then((data) => {
        const list = Array.isArray(data) ? data : (data?.data || [])
        setReviewedBookIds(new Set(list.map(Number)))
      })
      .catch((error) => showToast(error.message || 'Không thể tải danh sách sản phẩm đã đánh giá.', 'warning'))
  }, [showToast])

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
      await orderService.cancelOrder(cancelModalOrder.id, cancelReason, cancelModalOrder.status)
      dispatch(invalidateBooks())
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
      dispatch(fetchCart())
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
            Đã xác nhận
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

        {loading && orders.length === 0 ? (
          <div className="order-loading-box">
            <div className="order-spinner" />
            <p>Đang tải danh sách đơn hàng...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className="order-empty-box">
            <div className="order-empty-icon"><MaterialCommunityIcon name="package-variant-closed" size={42} /></div>
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
          <div className="order-cards-list" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
            {orders.map((order) => {
              const statusInfo = getOrderStatusInfo(order)
              const ghnInfo = typeof order.ghn_info === 'string'
                ? (() => { try { return JSON.parse(order.ghn_info) } catch { return {} } })()
                : (order.ghn_info || {})
              const items = Array.isArray(order.items) ? order.items : []
              const rawAddress = String(order.shippingAddress || order.shipping_address || order.address || ghnInfo.address || ghnInfo.shippingAddress || '')
              const addressLower = rawAddress.toLowerCase()
              const isHcmAddress = addressLower.includes('hồ chí minh') || addressLower.includes('tp.hcm') || addressLower.includes('tphcm') || addressLower.includes('hcm') || addressLower.includes('thủ đức') || addressLower.includes('sài gòn')
              const isGhn = Boolean(order.ghn_code || ghnInfo.ghnCode || ghnInfo.deliveryType === 'GHN' || (!isHcmAddress && rawAddress.trim().length > 5))
              const ghnCode = order.ghn_code || ghnInfo.ghnCode || null
              const statusNum = Number(order.status)
              const assignmentStatus = String(order.assignment_status || '').toUpperCase()
              const isInternalAssignmentPending = !isGhn && statusNum === 1 && assignmentStatus === 'ASSIGNED'
              const isInternalAssignmentRejected = !isGhn && statusNum === 1 && ['REJECTED', 'CANCELLED'].includes(assignmentStatus)
              const isExpanded = expandedTrackerIds.has(order.id)

              const isOrderExpired = expiredOrderIds.has(order.id)

              const outOfStockItems = items.filter((it) => {
                const stock = Number(it.stock_quantity ?? it.stock)
                const isDeleted = Boolean(it.book_is_deleted || it.isDelete)
                return isDeleted || (Number.isFinite(stock) && stock <= 0)
              })
              const isAllOutOfStock = items.length > 0 && outOfStockItems.length === items.length
              const hasPartialOutOfStock = outOfStockItems.length > 0 && !isAllOutOfStock

              const cancelReasonText = ghnInfo.cancelReason
                ? `Lý do: ${ghnInfo.cancelReason.charAt(0).toUpperCase() + ghnInfo.cancelReason.slice(1)}`
                : 'Đơn hàng đã hủy'

              const trackerSteps = statusNum === 4
                ? [
                    { key: 'created', label: 'Đặt hàng', sub: formatDate(order.createdAt), done: true },
                    { key: 'packed', label: 'Đóng gói', sub: 'Đã dừng xử lý', cancelled: true },
                    { key: 'shipping', label: 'Vận chuyển', sub: 'Đã hủy đơn', cancelled: true },
                    { key: 'delivered', label: 'Đã hủy', sub: cancelReasonText, cancelled: true }
                  ]
                : isGhn
                  ? [
                      { key: 'created', label: 'Đặt hàng', sub: formatDate(order.createdAt), done: true },
                      {
                        key: 'packed',
                        label: 'Đóng gói',
                        sub: statusNum >= 2 ? 'Đã giao cho GHN' : statusNum === 1 ? 'Kho đang chuẩn bị sách' : order.payment_method === 'VNPAY' ? 'Chờ thanh toán VNPAY' : 'Chờ shop xác nhận',
                        done: statusNum >= 2,
                        active: statusNum === 1 || statusNum === 0
                      },
                      {
                        key: 'shipping',
                        label: 'Vận chuyển',
                        sub: statusNum === 3 ? 'Giao thành công' : statusNum === 2 ? 'GHN đang vận chuyển' : 'GHN Express',
                        done: statusNum === 3,
                        active: statusNum === 2
                      },
                      {
                        key: 'delivered',
                        label: 'Đã nhận',
                        sub: statusNum === 3 ? 'Giao thành công' : (ghnInfo.estimatedDelivery || '2 - 4 ngày làm việc'),
                        done: statusNum === 3
                      }
                    ]
                  : [
                      { key: 'created', label: 'Đặt hàng', sub: formatDate(order.createdAt), done: true },
                       {
                         key: 'packed',
                         label: 'Đóng gói',
                         sub: statusNum >= 2 ? 'Đã xuất kho Thủ Đức' : isInternalAssignmentPending ? 'Shop đã gửi yêu cầu giao hàng' : isInternalAssignmentRejected ? 'Shop đang sắp xếp nhân viên giao hàng phù hợp' : statusNum === 1 ? 'Shop đang soạn sách' : order.payment_method === 'VNPAY' ? 'Chờ thanh toán VNPAY' : 'Chờ shop xác nhận',
                         done: statusNum >= 2 || isInternalAssignmentPending,
                         active: statusNum === 1 || statusNum === 0
                       },
                       {
                         key: 'shipping',
                         label: isInternalAssignmentPending ? 'Chờ Shipper nhận' : isInternalAssignmentRejected ? 'Đang sắp xếp giao hàng' : 'Đang giao',
                         sub: statusNum === 3 ? 'Đã giao tận tay' : statusNum === 2 ? 'Shipper đang vận chuyển đơn hàng' : isInternalAssignmentPending ? 'Đã gửi yêu cầu, đang chờ xác nhận' : isInternalAssignmentRejected ? 'Shop đang tìm nhân viên giao hàng phù hợp' : 'Shop Shipper 24h',
                         done: statusNum === 3,
                         active: statusNum === 2 || isInternalAssignmentPending || isInternalAssignmentRejected
                       },
                      {
                        key: 'delivered',
                        label: 'Đã nhận',
                        sub: statusNum === 3 ? 'Giao thành công' : 'Trong vòng 24 giờ',
                        done: statusNum === 3
                      }
                    ]

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
                         {copiedOrderId === order.id ? '✓ Đã chép' : <><MaterialCommunityIcon name="clipboard-text" size={15} />Chép mã</>}
                      </button>
                      <span className="order-date-text">{formatDate(order.createdAt)}</span>
                    </div>
                    <div className="order-status-wrap">
                      {statusNum === 0 && order.payment_method === 'VNPAY' && (
                        <VnpayCountdown
                          createdAt={order.createdAt}
                          onExpire={() => handleOrderExpired(order.id)}
                        />
                      )}
                      <span className={`order-status-tag ${statusInfo.class}`}>
                        {isOrderExpired ? 'Đang hủy (Hết hạn)' : statusInfo.label}
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
                              {(() => {
                                const stock = Number(it.stock_quantity ?? it.stock)
                                const isDeleted = Boolean(it.book_is_deleted || it.isDelete)
                                if (isDeleted) {
                                  return <span className="order-stock-badge deleted">Ngừng kinh doanh</span>
                                }
                                if (Number.isFinite(stock) && stock <= 0) {
                                  return <span className="order-stock-badge out">Hết hàng</span>
                                }
                                if (Number.isFinite(stock) && stock <= 5) {
                                  return <span className="order-stock-badge low">Chỉ còn {stock} cuốn</span>
                                }
                                return null
                              })()}
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
                                       <><MaterialCommunityIcon name="star" size={15} />Đánh giá</>
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
                                     <><MaterialCommunityIcon name="message" size={15} />Chi tiết &amp; Thảo luận</>
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

                  <div className="order-inline-tracker">
                    <div className="tracker-header">
                      <div className="tracker-channel-badge">
                        {isGhn ? (
                          <span className="channel-tag ghn">
                             <MaterialCommunityIcon name="package-variant-closed" size={16} /> <strong>GHN Express (Liên tỉnh)</strong>
                            {ghnCode && (
                              <span className="tracking-code-chip">
                                Mã: <strong>{ghnCode}</strong>
                                <button
                                  type="button"
                                  className="btn-copy-chip"
                                  onClick={() => handleCopyGhnCode(ghnCode)}
                                  title="Sao chép mã vận đơn"
                                >
                                   {copiedGhnCode === ghnCode ? '✓' : <MaterialCommunityIcon name="clipboard-text" size={14} />}
                                </button>
                              </span>
                            )}
                          </span>
                        ) : (
                          <span className="channel-tag internal">
                             <MaterialCommunityIcon name="truck-delivery" size={16} /> <strong>Shop Shipper (Nội thành TP.HCM)</strong> — Giao nhanh trong 24 giờ
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="btn-toggle-tracker-details"
                        onClick={() => toggleTracker(order)}
                      >
                        {isExpanded ? 'Thu gọn lộ trình ▲' : 'Chi tiết lộ trình ▼'}
                      </button>
                    </div>

                    <div className={`tracker-steps-bar ${statusNum === 4 ? 'has-cancelled' : ''}`}>
                      {trackerSteps.map((st, idx) => {
                        const stateClass = st.done ? 'step-done' : st.active ? 'step-active' : st.cancelled ? 'step-cancelled' : 'step-pending'
                        return (
                          <div key={st.key} className={`tracker-step ${stateClass}`}>
                            <div className="tracker-dot-wrap">
                              <div className={`tracker-line before ${idx === 0 ? 'line-hidden' : ''}`} />
                              <span className="tracker-dot">
                                {st.done ? '✓' : st.cancelled ? '✕' : idx + 1}
                              </span>
                              <div className={`tracker-line after ${idx === trackerSteps.length - 1 ? 'line-hidden' : ''}`} />
                            </div>
                            <div className="tracker-step-label">{st.label}</div>
                            <div className="tracker-step-sub">{st.sub}</div>
                          </div>
                        )
                      })}
                    </div>

                    {isExpanded && (
                      <div className="tracker-expanded-details">
                        <div className="tracker-detail-row">
                           <span className="detail-label"><MaterialCommunityIcon name="store-marker-outline" size={15} /> Kho xuất phát:</span>
                          <span className="detail-value">BookStore HCMUTE — Số 1 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP.HCM</span>
                        </div>
                        <div className="tracker-detail-row">
                           <span className="detail-label"><MaterialCommunityIcon name="map-marker" size={15} /> Địa chỉ nhận hàng:</span>
                          <span className="detail-value">{order.shippingAddress || order.address || ghnInfo.address || '---'}</span>
                        </div>
                        <div className="tracker-detail-row">
                           <span className="detail-label"><MaterialCommunityIcon name="clock-outline" size={15} /> Dự kiến giao hàng:</span>
                          <span className="detail-value">{isGhn ? (ghnInfo.estimatedDelivery && !ghnInfo.estimatedDelivery.includes('24 giờ') ? ghnInfo.estimatedDelivery : '2 - 4 ngày làm việc') : (ghnInfo.estimatedDelivery || 'Trong vòng 24 giờ kể từ khi xác nhận')}</span>
                        </div>
                        {isGhn ? (
                          <>
                            <div className="tracker-detail-row">
                               <span className="detail-label"><MaterialCommunityIcon name="truck-delivery" size={15} /> Đơn vị vận chuyển:</span>
                              <span className="detail-value">Giao Hàng Nhanh (GHN Express)</span>
                            </div>
                            <div className="tracker-detail-row">
                               <span className="detail-label"><MaterialCommunityIcon name="package-variant-closed" size={15} /> Ghi chú bưu tá:</span>
                              <span className="detail-value">Cho xem hàng, không cho thử (CHOXEMHANGKHONGTHU)</span>
                            </div>
                            {ghnCode && !ghnCode.startsWith('GHN_') && (
                              <div className="tracker-detail-row link-row">
                                <a
                                  href={`https://donhang.ghn.vn/?order_code=${ghnCode}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="tracker-external-link"
                                >
                                  ↗ Tra cứu bưu tá trên cổng GHN Quốc Gia
                                </a>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            {(order.assignment_completion_note || order.assignment_note) && statusNum === 3 && (
                              <div className="tracker-detail-row">
                                 <span className="detail-label"><MaterialCommunityIcon name="clipboard-text" size={15} /> Ghi chú giao hàng:</span>
                                <span className="detail-value">{order.assignment_completion_note || order.assignment_note}</span>
                              </div>
                            )}
                            <div className="tracker-detail-row">
                               <span className="detail-label"><MaterialCommunityIcon name="truck-delivery" size={15} /> Đơn vị vận chuyển:</span>
                              <span className="detail-value">Đội ngũ giao hàng trực tiếp BookStore HCMUTE</span>
                            </div>
                            <div className="tracker-detail-row">
                               <span className="detail-label"><MaterialCommunityIcon name="phone" size={15} /> Hỗ trợ giao nhận:</span>
                              <span className="detail-value">Hotline cửa hàng: 0795 865 240 (Hỗ trợ 8h00 - 21h00)</span>
                            </div>
                            <div className="tracker-detail-row">
                               <span className="detail-label"><MaterialCommunityIcon name="shield-check" size={15} /> Chính sách:</span>
                              <span className="detail-value">Đồng kiểm khi nhận hàng, kiểm tra sách trước khi thanh toán</span>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="order-card-footer">
                    <div className="order-shipping-info">
                      <strong>Người nhận:</strong> {order.recipientName || order.recipient_name || order.receiverName || order.fullName || order.customerName || ghnInfo.receiverName || ghnInfo.recipientName || ghnInfo.fullName || '---'} ({order.recipientPhone || order.recipient_phone || order.phoneNumber || order.phone || ghnInfo.phone || ghnInfo.phoneNumber || ghnInfo.recipientPhone || '---'})
                      <br />
                      <strong>Địa chỉ:</strong> {order.shippingAddress || order.shipping_address || order.address || ghnInfo.address || ghnInfo.shippingAddress || '---'}
                      <br />
                      <strong>Phương thức:</strong> {getPaymentMethodLabel(order.payment_method, 'full')}
                      {ghnInfo.ghnDispatchError && (
                        <p role="alert" style={{ color: '#b42318', margin: '8px 0 0' }}>
                          {ghnInfo.ghnDispatchError}
                        </p>
                      )}
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
                        {statusNum === 0 && order.payment_method === 'VNPAY' && (
                          !isOrderExpired ? (
                            <button
                              type="button"
                              className="btn-pay-now"
                              onClick={() => handlePayNow(order)}
                            >
                              Thanh toán ngay
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-pay-now expired"
                              disabled
                              title="Thời gian thanh toán 15 phút đã kết thúc. Đơn hàng đang được tự động hủy và hoàn trả kho."
                            >
                              Đã hết hạn thanh toán
                            </button>
                          )
                        )}
                        {statusNum === 0 && !isOrderExpired && (
                          <button
                            type="button"
                            className="btn-cancel-order"
                            onClick={() => handleOpenCancelModal(order)}
                          >
                            Hủy đơn
                          </button>
                        )}
                        {statusNum === 1 && order.payment_method === 'COD' && (
                          <button
                            type="button"
                            className="btn-cancel-order"
                            onClick={() => handleOpenCancelModal(order)}
                          >
                            Hủy đơn
                          </button>
                        )}
                        {statusNum === 1 && order.payment_method === 'VNPAY' && (
                          <span
                            className="order-vnpay-paid-badge"
                            title="Đơn hàng đã thanh toán qua VNPAY. Vui lòng liên hệ bộ phận Chăm sóc khách hàng nếu cần hủy đơn và đối soát hoàn tiền."
                          >
                            Đã thanh toán (Liên hệ CSKH)
                          </span>
                        )}
                        {(statusNum === 3 || statusNum === 4) && (
                          isAllOutOfStock ? (
                            <button
                              type="button"
                              className="btn-reorder disabled"
                              disabled
                              title={`Tất cả sản phẩm trong đơn hàng hiện đã hết hàng (${outOfStockItems.map((i) => i.title || `Mã #${i.book_id || i.id}`).join(', ')}).`}
                            >
                              <><MaterialCommunityIcon name="close-circle-outline" size={15} />Tạm hết hàng</>
                            </button>
                          ) : hasPartialOutOfStock ? (
                            <button
                              type="button"
                              className="btn-reorder partial"
                              onClick={() => handleReorder(order)}
                              title={`Một số cuốn sách đã hết hàng (${outOfStockItems.map((i) => i.title || `Mã #${i.book_id || i.id}`).join(', ')}). Bấm để thêm các cuốn còn hàng vào giỏ.`}
                            >
                              Mua lại ({items.length - outOfStockItems.length}/{items.length} cuốn)
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-reorder"
                              onClick={() => handleReorder(order)}
                              title="Thêm lại toàn bộ sách trong đơn này vào giỏ hàng"
                            >
                              Mua lại
                            </button>
                          )
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
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderLeft: '4px solid #ef4444', color: '#b91c1c', padding: '10px 14px', borderRadius: '8px', fontSize: '0.86rem', marginBottom: '14px', fontWeight: 500 }}>
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
