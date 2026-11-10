import { useState, useEffect, memo } from 'react'
import statisticsService from '../services/statisticsService'
import AdminAnalyticsCharts from './AdminAnalyticsCharts'
import './AdminOverviewDashboard.css'

function formatVND(value) {
  const num = Number(value) || 0
  return `${num.toLocaleString('vi-VN')} đ`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const raw = String(dateStr).trim()
    const d = new Date(raw)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`
  } catch {
    return dateStr
  }
}

function getStatusBadge(status) {
  switch (Number(status)) {
    case 0:
      return { label: 'Chờ xác nhận', cls: 'status-0' }
    case 1:
      return { label: 'Đã thanh toán', cls: 'status-1' }
    case 2:
      return { label: 'Đang giao', cls: 'status-2' }
    case 3:
      return { label: 'Hoàn thành', cls: 'status-3' }
    case 4:
      return { label: 'Đã hủy', cls: 'status-4' }
    default:
      return { label: 'Không xác định', cls: 'status-0' }
  }
}

function AdminOverviewDashboard({ onNavigateTab }) {
  const [timeRange, setTimeRange] = useState('7days')
  const [groupBy, setGroupBy] = useState('day')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [queryParams, setQueryParams] = useState({ timeRange: '7days', groupBy: 'day' })
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)
  const [dashboardData, setDashboardData] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)

  const handleTimeRangeChange = (val) => {
    setErrorMsg(null)
    setTimeRange(val)
    if (val === 'custom') {
      return
    }
    const nextGroupBy = val === '6months' || val === '12months' ? 'month' : 'day'
    setGroupBy(nextGroupBy)
    setLoading(true)
    setQueryParams({ timeRange: val, groupBy: nextGroupBy })
  }

  const handleGroupByChange = (nextGroupBy) => {
    setErrorMsg(null)
    setGroupBy(nextGroupBy)
    if (timeRange === 'custom') {
      if (!customStart || !customEnd) {
        setErrorMsg('Vui lòng chọn đầy đủ Ngày bắt đầu và Ngày kết thúc trước khi lọc.')
        return
      }
      if (new Date(customStart) > new Date(customEnd)) {
        setErrorMsg('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
        return
      }
      setLoading(true)
      setQueryParams({ startDate: customStart, endDate: customEnd, groupBy: nextGroupBy })
      return
    }
    setLoading(true)
    setQueryParams({ timeRange, groupBy: nextGroupBy })
  }

  const handleApplyCustomRange = () => {
    setErrorMsg(null)
    if (!customStart || !customEnd) {
      setErrorMsg('Vui lòng chọn đầy đủ cả Ngày bắt đầu và Ngày kết thúc.')
      return
    }
    const startDt = new Date(customStart)
    const endDt = new Date(customEnd)
    if (startDt > endDt) {
      setErrorMsg('Ngày bắt đầu không được lớn hơn ngày kết thúc.')
      return
    }
    const diffDays = Math.ceil((endDt - startDt) / (1000 * 60 * 60 * 24))
    if (diffDays > 366) {
      setErrorMsg('Khoảng thời gian tùy chọn không được vượt quá 366 ngày.')
      return
    }
    const nextGroupBy = diffDays > 60 ? 'month' : groupBy
    setGroupBy(nextGroupBy)
    setLoading(true)
    setQueryParams({ startDate: customStart, endDate: customEnd, groupBy: nextGroupBy })
  }

  const handleRefresh = () => {
    setLoading(true)
    setErrorMsg(null)
    setRefreshTrigger((prev) => prev + 1)
  }

  useEffect(() => {
    let isCurrent = true

    statisticsService
      .getSummary(queryParams)
      .then((res) => {
        if (!isCurrent) return
        setDashboardData(res)
        setLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setLoading(false)
        setErrorMsg(`Lỗi API /admin/statistics/summary: ${err.message || 'Không thể tải dữ liệu thống kê tổng quan.'}`)
      })

    return () => {
      isCurrent = false
    }
  }, [queryParams, refreshTrigger])

  const overview = dashboardData?.overview || {}
  const revenue = overview.revenue || {}
  const orders = overview.orders || {}
  const books = overview.books || {}
  const users = overview.users || {}
  const reviews = overview.reviews || {}
  const promotions = overview.promotions || {}

  const topBooks = dashboardData?.topBooks || []
  const recentOrders = dashboardData?.recentOrders || []

  const totalOrdersCount = orders.total || 0
  const calcPct = (cnt) => (totalOrdersCount > 0 ? ((cnt / totalOrdersCount) * 100).toFixed(1) : '0')

  const pipeline = [
    { name: 'Hoàn thành', count: orders.completed || 0, cls: 'completed' },
    { name: 'Đang giao', count: orders.shipping || 0, cls: 'shipping' },
    { name: 'Đã thanh toán', count: orders.paid || 0, cls: 'paid' },
    { name: 'Chờ xác nhận', count: orders.pending || 0, cls: 'pending' },
    { name: 'Đã hủy', count: orders.cancelled || 0, cls: 'cancelled' }
  ]

  return (
    <div className="admin-overview-container">
      <div className="overview-header-bar">
        <div className="overview-header-title">
          <h2>📊 Tổng Quan Chỉ Số Vận Hành</h2>
          <p>Số liệu thống kê thực tế theo chu kỳ kinh doanh của BookWeb</p>
        </div>

        <div className="overview-controls">
          <select
            className="overview-range-select"
            value={timeRange}
            onChange={(e) => handleTimeRangeChange(e.target.value)}
          >
            <option value="7days">7 ngày qua</option>
            <option value="14days">14 ngày qua</option>
            <option value="30days">30 ngày qua</option>
            <option value="thisMonth">Tháng này</option>
            <option value="6months">6 tháng qua</option>
            <option value="12months">12 tháng qua</option>
            <option value="custom">Tùy chọn ngày...</option>
          </select>

          <select
            className="overview-range-select"
            value={groupBy}
            onChange={(e) => handleGroupByChange(e.target.value)}
          >
            <option value="day">Theo ngày</option>
            <option value="month">Theo tháng</option>
          </select>

          {timeRange === 'custom' ? (
            <div className="overview-custom-date-box">
              <input
                type="date"
                className="overview-date-input"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <span style={{ color: '#8c857b' }}>→</span>
              <input
                type="date"
                className="overview-date-input"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
              <button
                type="button"
                className="overview-apply-btn"
                onClick={handleApplyCustomRange}
                disabled={loading}
              >
                Áp dụng
              </button>
            </div>
          ) : null}

          <button
            type="button"
            className="overview-refresh-btn"
            onClick={handleRefresh}
            disabled={loading}
          >
            🔄 {loading ? 'Đang cập nhật...' : 'Làm mới'}
          </button>
        </div>
      </div>

      {errorMsg ? (
        <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: '8px', color: '#fca5a5' }}>
          {errorMsg}
        </div>
      ) : null}

      <div className="overview-kpi-grid">
        <div className="kpi-card revenue">
          <div className="kpi-top">
            <span className="kpi-label">Tổng Doanh Thu</span>
            <div className="kpi-icon-badge">💰</div>
          </div>
          <div className="kpi-value">{loading && !dashboardData ? '...' : formatVND(revenue.total)}</div>
          <div className="kpi-subtext">
            <span>COD: <strong className="kpi-sub-highlight">{formatVND(revenue.cod)}</strong></span>
            <span>•</span>
            <span>VNPAY: <strong className="kpi-sub-highlight">{formatVND(revenue.vnpay)}</strong></span>
          </div>
        </div>

        <div className="kpi-card orders">
          <div className="kpi-top">
            <span className="kpi-label">Tổng Đơn Hàng</span>
            <div className="kpi-icon-badge">📦</div>
          </div>
          <div className="kpi-value">{loading && !dashboardData ? '...' : orders.total || 0}</div>
          <div className="kpi-subtext">
            <span>Thành công: <strong style={{ color: '#10b981' }}>{orders.completed || 0}</strong></span>
            <span>•</span>
            <span>Đã hủy: <strong style={{ color: '#ef4444' }}>{orders.cancelled || 0}</strong></span>
          </div>
        </div>

        <div className="kpi-card users">
          <div className="kpi-top">
            <span className="kpi-label">Độc Giả Hệ Thống</span>
            <div className="kpi-icon-badge">👥</div>
          </div>
          <div className="kpi-value">{loading && !dashboardData ? '...' : users.customers || 0}</div>
          <div className="kpi-subtext">
            <span>Thành viên VIP: <strong style={{ color: '#e7b26a' }}>{users.vip || 0}</strong></span>
            <span>•</span>
            <span>Quản trị viên: <strong style={{ color: '#8b5cf6' }}>{users.admins || 0}</strong></span>
          </div>
        </div>

        <div className="kpi-card inventory">
          <div className="kpi-top">
            <span className="kpi-label">Ấn Phẩm Kinh Doanh</span>
            <div className="kpi-icon-badge">📚</div>
          </div>
          <div className="kpi-value">{loading && !dashboardData ? '...' : books.total || 0}</div>
          <div className="kpi-subtext">
            <span>Tồn kho: <strong style={{ color: '#3b82f6' }}>{books.totalInventory || 0} cuốn</strong></span>
            <span>•</span>
            <span>Hết hàng: <strong style={{ color: '#f59e0b' }}>{books.outOfStock || 0}</strong></span>
          </div>
        </div>
      </div>

      <AdminAnalyticsCharts revenueChart={dashboardData?.revenueChart} loading={loading} />

      <div className="overview-two-col-grid">
        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">🚚 Tình Trạng Luồng Đơn Hàng</h3>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('orders')}
              >
                Quản lý đơn hàng →
              </button>
            ) : null}
          </div>

          <div className="pipeline-list">
            {pipeline.map((item) => {
              const pct = calcPct(item.count)
              return (
                <div key={item.name} className="pipeline-item">
                  <div className="pipeline-item-top">
                    <span className="pipeline-status-name">{item.name}</span>
                    <div>
                      <span className="pipeline-count">{item.count}</span>
                      <span className="pipeline-pct">({pct}%)</span>
                    </div>
                  </div>
                  <div className="pipeline-bar-track">
                    <div
                      className={`pipeline-bar-fill ${item.cls}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">⭐ Đánh Giá & Hoạt Động Khuyến Mãi</h3>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('reviews')}
              >
                Xem đánh giá →
              </button>
            ) : null}
          </div>

          <div className="mini-stats-grid">
            <div className="mini-stat-box">
              <span className="mini-stat-box-title">Điểm Sao Trung Bình</span>
              <div className="mini-stat-box-value" style={{ color: '#f59e0b' }}>
                {reviews.averageRate || '0.0'} ★
              </div>
              <span className="mini-stat-box-desc">
                Từ {reviews.totalRatings || 0} bài chấm điểm
              </span>
            </div>

            <div className="mini-stat-box">
              <span className="mini-stat-box-title">Hỏi Đáp & Thảo Luận</span>
              <div className="mini-stat-box-value" style={{ color: '#3b82f6' }}>
                {reviews.totalDiscussions || 0}
              </div>
              <span className="mini-stat-box-desc">Câu hỏi từ cộng đồng</span>
            </div>

            <div className="mini-stat-box">
              <span className="mini-stat-box-title">Voucher Đang Chạy</span>
              <div className="mini-stat-box-value" style={{ color: '#10b981' }}>
                {promotions.active || 0}
              </div>
              <span className="mini-stat-box-desc">
                Tổng {promotions.total || 0} mã ưu đãi
              </span>
            </div>

            <div className="mini-stat-box">
              <span className="mini-stat-box-title">Lượt Áp Dụng Mã</span>
              <div className="mini-stat-box-value" style={{ color: '#8b5cf6' }}>
                {promotions.totalUsed || 0}
              </div>
              <span className="mini-stat-box-desc">Đã tiết kiệm cho khách</span>
            </div>
          </div>
        </div>
      </div>

      <div className="overview-two-col-grid">
        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">🔥 Top Ấn Phẩm Bán Chạy Nhất</h3>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('books')}
              >
                Kho sách →
              </button>
            ) : null}
          </div>

          <div className="top-books-list">
            {loading ? (
              <div style={{ color: '#8c857b', textAlign: 'center', padding: '20px' }}>
                Đang nạp top sách bán chạy...
              </div>
            ) : topBooks.length === 0 ? (
              <div style={{ color: '#8c857b', textAlign: 'center', padding: '20px' }}>
                Chưa có dữ liệu sách bán thành công
              </div>
            ) : (
              topBooks.map((b, idx) => (
                <div key={b.id} className="top-book-item">
                  <div className="top-book-left">
                    <span className={`top-book-rank rank-${idx + 1}`}>#{idx + 1}</span>
                    {b.image ? (
                      <img src={b.image} alt="" className="top-book-thumb" />
                    ) : (
                      <div className="top-book-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>📖</div>
                    )}
                    <div className="top-book-info">
                      <span className="top-book-title" title={b.title}>{b.title}</span>
                      <span className="top-book-author">{b.author || 'Tác giả BookWeb'}</span>
                    </div>
                  </div>

                  <div className="top-book-right">
                    <span className="top-book-sold">{b.totalSold} đã bán</span>
                    <span className="top-book-rev">{formatVND(b.totalRevenue)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">⚡ Đơn Hàng Gần Đây Nhất</h3>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('orders')}
              >
                Toàn bộ đơn →
              </button>
            ) : null}
          </div>

          <div className="recent-orders-list">
            {loading ? (
              <div style={{ color: '#8c857b', textAlign: 'center', padding: '20px' }}>
                Đang nạp đơn hàng gần đây...
              </div>
            ) : recentOrders.length === 0 ? (
              <div style={{ color: '#8c857b', textAlign: 'center', padding: '20px' }}>
                Chưa có đơn hàng nào
              </div>
            ) : (
              recentOrders.map((ord) => {
                const b = getStatusBadge(ord.status)
                const shortId = ord.id ? `#${String(ord.id).slice(0, 8)}...` : '#Đơn'
                return (
                  <div key={ord.id} className="recent-order-item">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      <span className="recent-order-code">{shortId}</span>
                      <span className="recent-order-cust">{ord.customerName || ord.customerEmail || 'Khách vãng lai'}</span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <span className="recent-order-total">{formatVND(ord.total)}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.72rem', color: '#8c857b' }}>{formatDate(ord.createdAt)}</span>
                        <span className={`recent-order-badge ${b.cls}`}>{b.label}</span>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(AdminOverviewDashboard)
