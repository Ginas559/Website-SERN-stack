import { useState, useEffect } from 'react'
import orderService from '../services/orderService'
import './PaymentResult.css'

function formatCurrency(amount) {
  return Number(amount || 0).toLocaleString('vi-VN') + ' đ'
}

function formatDate(dateStr) {
  if (!dateStr) return 'Vừa xong'
  try {
    if (dateStr.length === 14) {
      const year = dateStr.slice(0, 4)
      const month = dateStr.slice(4, 6)
      const day = dateStr.slice(6, 8)
      const hour = dateStr.slice(8, 10)
      const min = dateStr.slice(10, 12)
      const sec = dateStr.slice(12, 14)
      return `${day}/${month}/${year} ${hour}:${min}:${sec}`
    }
    return new Date(dateStr).toLocaleString('vi-VN')
  } catch {
    return dateStr
  }
}

function PaymentResult({
  searchString = '',
  onViewOrders,
  onContinueShopping,
}) {
  const [loading, setLoading] = useState(true)
  const [paymentData, setPaymentData] = useState(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    let isMounted = true

    async function verify() {
      if (!searchString) {
        if (isMounted) {
          setLoading(false)
          setErrorMessage('Không tìm thấy thông tin phản hồi từ cổng thanh toán.')
        }
        return
      }

      try {
        const response = await orderService.verifyPaymentReturn(searchString)
        if (isMounted) {
          setPaymentData(response.data || response)
          setLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setErrorMessage(err.message || 'Xác thực thanh toán thất bại.')
          setLoading(false)
        }
      }
    }

    verify()

    return () => {
      isMounted = false
    }
  }, [searchString])

  const handleRetryPayment = async () => {
    const orderId = paymentData?.order?.id
    if (!orderId) return
    setRetrying(true)
    try {
      const res = await orderService.getPaymentUrl(orderId)
      const paymentUrl = res.data?.paymentUrl || res.paymentUrl
      if (paymentUrl) {
        window.location.href = paymentUrl
      }
    } catch (err) {
      alert(err.message || 'Không thể tạo lại liên kết thanh toán.')
      setRetrying(false)
    }
  }

  if (loading) {
    return (
      <div className="payment-result-wrapper">
        <div className="payment-result-card loading-state">
          <div className="payment-result-spinner" />
          <h2>Đang xác thực giao dịch...</h2>
          <p>Hệ thống đang kết nối với máy chủ VNPAY để kiểm tra tính toàn vẹn của đơn hàng.</p>
        </div>
      </div>
    )
  }

  const isSuccess = paymentData?.isSuccess === true
  const order = paymentData?.order
  const ghnInfo = typeof order?.ghn_info === 'string' 
    ? (() => { try { return JSON.parse(order.ghn_info) } catch { return {} } })()
    : (order?.ghn_info || {})
  const ghnResponse = typeof order?.ghn_response === 'string'
    ? (() => { try { return JSON.parse(order.ghn_response) } catch { return {} } })()
    : (order?.ghn_response || {})

  return (
    <div className="payment-result-wrapper">
      <div className={`payment-result-card ${isSuccess ? 'success-card' : 'fail-card'}`}>
        <div className="payment-result-badge-icon">
          {isSuccess ? '✓' : '!'}
        </div>

        <h1 className="payment-result-title">
          {isSuccess ? 'Thanh toán thành công!' : 'Thanh toán chưa hoàn tất'}
        </h1>

        <p className="payment-result-subtitle">
          {isSuccess 
            ? 'Cảm ơn bạn! Đơn hàng đã được xác nhận thanh toán trực tuyến qua VNPAY.'
            : (errorMessage || paymentData?.message || 'Giao dịch bị gián đoạn hoặc khách hàng đã hủy thanh toán.')}
        </p>

        <div className="payment-result-info-box">
          <div className="payment-info-row">
            <span className="info-label">Mã đơn hàng</span>
            <span className="info-value highlight">{order?.id || '---'}</span>
          </div>
          <div className="payment-info-row">
            <span className="info-label">Số tiền</span>
            <span className="info-value total-price">{formatCurrency(order?.total)}</span>
          </div>
          <div className="payment-info-row">
            <span className="info-label">Phương thức</span>
            <span className="info-value">Cổng thanh toán VNPAY (Sandbox)</span>
          </div>
          {ghnResponse?.vnp_BankCode && (
            <div className="payment-info-row">
              <span className="info-label">Ngân hàng</span>
              <span className="info-value">{ghnResponse.vnp_BankCode}</span>
            </div>
          )}
          {ghnResponse?.vnp_TransactionNo && (
            <div className="payment-info-row">
              <span className="info-label">Mã giao dịch</span>
              <span className="info-value">{ghnResponse.vnp_TransactionNo}</span>
            </div>
          )}
          <div className="payment-info-row">
            <span className="info-label">Thời gian</span>
            <span className="info-value">{formatDate(ghnResponse?.vnp_PayDate || order?.updatedAt)}</span>
          </div>
          <div className="payment-info-row">
            <span className="info-label">Trạng thái đơn</span>
            <span className={`status-pill status-${order?.status ?? 0}`}>
              {order?.status === 1 ? 'Đã thanh toán' : 'Chờ xử lý'}
            </span>
          </div>
        </div>

        {ghnInfo?.receiverName && (
          <div className="payment-shipping-summary">
            <strong>Thông tin giao nhận:</strong> {ghnInfo.receiverName} ({ghnInfo.phone}) — {ghnInfo.address}
          </div>
        )}

        <div className="payment-result-actions">
          {isSuccess ? (
            <>
              {onViewOrders && (
                <button 
                  type="button" 
                  className="btn-primary-action" 
                  onClick={onViewOrders}
                >
                  Xem đơn hàng của tôi
                </button>
              )}
              <button 
                type="button" 
                className="btn-secondary-action" 
                onClick={onContinueShopping}
              >
                Tiếp tục mua sách
              </button>
            </>
          ) : (
            <>
              {order?.id && order?.status === 0 && (
                <button 
                  type="button" 
                  className="btn-primary-action retry-btn" 
                  onClick={handleRetryPayment}
                  disabled={retrying}
                >
                  {retrying ? 'Đang tạo liên kết...' : 'Thanh toán lại ngay'}
                </button>
              )}
              {onViewOrders && (
                <button 
                  type="button" 
                  className="btn-secondary-action" 
                  onClick={onViewOrders}
                >
                  Kiểm tra đơn hàng
                </button>
              )}
              <button 
                type="button" 
                className="btn-secondary-action" 
                onClick={onContinueShopping}
              >
                Quay lại trang chủ
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default PaymentResult
