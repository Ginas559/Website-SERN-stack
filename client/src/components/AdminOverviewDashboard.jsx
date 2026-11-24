import { useState, useEffect, memo } from 'react'
import statisticsService from '../services/statisticsService'
import { buildCircularSegments } from '../utils/chartGeometry'
import AdminAnalyticsCharts from './AdminAnalyticsCharts'
import AdminCatalogAnalyticsCharts from './AdminCatalogAnalyticsCharts'
import './AdminOverviewDashboard.css'

function formatVND(value) {
  const num = Number(value) || 0
  return `${num.toLocaleString('vi-VN')} đ`
}

function formatCompactMoney(value) {
  const num = Number(value) || 0
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}tỷ`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}tr`
  if (num >= 1000) return `${Math.round(num / 1000)}k`
  return String(num)
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
  const calcPct = (cnt) => (totalOrdersCount > 0 ? ((cnt / totalOrdersCount) * 100).toFixed(1) : '0.0')

  const completedOrdersCount = Number(orders.completed) || 0
  const cancelledOrdersCount = Number(orders.cancelled) || 0
  const activeOrdersCount = Math.max(0, totalOrdersCount - cancelledOrdersCount)

  const orderLifecycleStages = [
    { key: 'pending', name: 'Chờ xác nhận', shortLabel: 'Chờ duyệt', count: Number(orders.pending) || 0, color: '#eab308' },
    { key: 'paid', name: 'Đã thanh toán', shortLabel: 'Đã TT', count: Number(orders.paid) || 0, color: '#f59e0b' },
    { key: 'shipping', name: 'Đang giao', shortLabel: 'Đang giao', count: Number(orders.shipping) || 0, color: '#3b82f6' },
    { key: 'completed', name: 'Hoàn thành', shortLabel: 'Hoàn thành', count: completedOrdersCount, color: '#10b981' },
    { key: 'cancelled', name: 'Đã hủy', shortLabel: 'Đã hủy', count: cancelledOrdersCount, color: '#ef4444' }
  ]
  const maxOrderStageCount = Math.max(4, ...orderLifecycleStages.map((st) => st.count))

  const codOrdersCount = Number(orders.byPaymentMethod?.cod) || 0
  const vnpayOrdersCount = Number(orders.byPaymentMethod?.vnpay) || 0
  const codRevVal = Number(revenue.cod) || 0
  const vnpayRevVal = Number(revenue.vnpay) || 0
  const payRingRadius = 34
  const payRingCirc = 2 * Math.PI * payRingRadius
  const orderMethodSlices = buildCircularSegments(
    [
      { key: 'cod', label: 'COD', value: codOrdersCount, color: '#f59e0b' },
      { key: 'vnpay', label: 'VNPAY', value: vnpayOrdersCount, color: '#10b981' },
    ],
    payRingRadius
  )
  const revMethodSlices = buildCircularSegments(
    [
      { key: 'cod', label: 'COD', value: codRevVal, color: '#f59e0b' },
      { key: 'vnpay', label: 'VNPAY', value: vnpayRevVal, color: '#10b981' },
    ],
    payRingRadius
  )
  const avgCompletedOrderValue = completedOrdersCount > 0
    ? Math.round((Number(revenue.total) || 0) / completedOrdersCount)
    : 0

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

      <AdminCatalogAnalyticsCharts
        categories={dashboardData?.categories}
        topBooks={topBooks}
        booksOverview={books}
        reviewAnalytics={dashboardData?.reviewAnalytics}
        reviewsOverview={reviews}
        promotionAnalytics={dashboardData?.promotionAnalytics}
        promotionsOverview={promotions}
        loading={loading}
        onNavigateTab={onNavigateTab}
      />

      <div className="overview-two-col-grid">
        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">🚚 Trạng Thái Xử Lý Đơn Hàng</h3>
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

          <div className="order-health-stacked-strip">
            {totalOrdersCount > 0 ? orderLifecycleStages.map((st) => (
              st.count > 0 ? (
                <div
                  key={st.key}
                  style={{ width: `${(st.count / totalOrdersCount) * 100}%`, backgroundColor: st.color }}
                  title={`${st.name}: ${st.count} đơn (${calcPct(st.count)}%)`}
                />
              ) : null
            )) : null}
          </div>

          <svg viewBox="0 0 460 142" className="order-stage-svg">
            {[0, 0.5, 1].map((ratio) => {
              const y = 22 + 86 * (1 - ratio)
              return (
                <g key={ratio}>
                  <line x1={32} y1={y} x2={446} y2={y} className="chart-grid-line" />
                  <text x={26} y={y + 4} textAnchor="end" className="chart-axis-text">
                    {Math.round(maxOrderStageCount * ratio)}
                  </text>
                </g>
              )
            })}

            {orderLifecycleStages.map((st, idx) => {
              const plotW = 414
              const slotW = plotW / orderLifecycleStages.length
              const barW = 34
              const x = 32 + idx * slotW + (slotW - barW) / 2
              const cx = x + barW / 2
              const barH = st.count > 0 ? Math.max(6, (st.count / maxOrderStageCount) * 86) : 0
              const yBar = 108 - barH
              return (
                <g key={st.key}>
                  <rect
                    x={x}
                    y={22}
                    width={barW}
                    height={86}
                    rx={6}
                    fill="#1a1917"
                  />
                  {barH > 0 ? (
                    <rect
                      x={x}
                      y={yBar}
                      width={barW}
                      height={barH}
                      rx={6}
                      fill={st.color}
                      className="order-stage-bar"
                    />
                  ) : null}
                  <text x={cx} y={st.count > 0 ? yBar - 6 : 102} textAnchor="middle" className="order-stage-count">
                    {st.count} ({calcPct(st.count)}%)
                  </text>
                  <text x={cx} y={128} textAnchor="middle" className="order-stage-label">
                    {st.shortLabel}
                  </text>
                </g>
              )
            })}
          </svg>

          <div className="order-stage-summary-row">
            <span>Tiếp nhận: <strong>{totalOrdersCount} đơn</strong></span>
            <span>Đơn hiệu lực: <strong style={{ color: '#60a5fa' }}>{activeOrdersCount} ({calcPct(activeOrdersCount)}%)</strong></span>
            <span>Hoàn thành: <strong style={{ color: '#10b981' }}>{completedOrdersCount} ({calcPct(completedOrdersCount)}%)</strong></span>
          </div>
        </div>

        <div className="overview-panel">
          <div className="overview-panel-header">
            <h3 className="overview-panel-title">💳 Kênh Thanh Toán & Giá Trị Đơn (AOV)</h3>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('orders')}
              >
                Chi tiết kênh →
              </button>
            ) : null}
          </div>

          <div className="payment-duals-grid">
            <div className="payment-donut-card">
              <svg viewBox="0 0 92 92" className="payment-donut-svg">
                <circle cx="46" cy="46" r={payRingRadius} fill="none" stroke="#2e2b26" strokeWidth="12" />
                {(codOrdersCount + vnpayOrdersCount) > 0 ? orderMethodSlices.map((sl) => (
                  sl.segLen > 0 ? (
                    <circle
                      key={sl.key}
                      cx="46"
                      cy="46"
                      r={payRingRadius}
                      fill="none"
                      stroke={sl.color}
                      strokeWidth="12"
                      strokeDasharray={`${sl.segLen} ${Math.max(0, payRingCirc - sl.segLen)}`}
                      strokeDashoffset={-sl.offset}
                      transform="rotate(-90 46 46)"
                    />
                  ) : null
                )) : null}
                <text x="46" y="44" textAnchor="middle" className="payment-donut-num">{codOrdersCount + vnpayOrdersCount}</text>
                <text x="46" y="57" textAnchor="middle" className="payment-donut-sub">đơn</text>
              </svg>
              <div className="payment-donut-meta">
                <span className="payment-donut-title">Số lượng đơn</span>
                <span>🟡 COD: <strong>{codOrdersCount}</strong> ({orderMethodSlices[0]?.percentage || 0}%)</span>
                <span>🟢 VNPAY: <strong>{vnpayOrdersCount}</strong> ({orderMethodSlices[1]?.percentage || 0}%)</span>
              </div>
            </div>

            <div className="payment-donut-card">
              <svg viewBox="0 0 92 92" className="payment-donut-svg">
                <circle cx="46" cy="46" r={payRingRadius} fill="none" stroke="#2e2b26" strokeWidth="12" />
                {(codRevVal + vnpayRevVal) > 0 ? revMethodSlices.map((sl) => (
                  sl.segLen > 0 ? (
                    <circle
                      key={sl.key}
                      cx="46"
                      cy="46"
                      r={payRingRadius}
                      fill="none"
                      stroke={sl.color}
                      strokeWidth="12"
                      strokeDasharray={`${sl.segLen} ${Math.max(0, payRingCirc - sl.segLen)}`}
                      strokeDashoffset={-sl.offset}
                      transform="rotate(-90 46 46)"
                    />
                  ) : null
                )) : null}
                <text x="46" y="44" textAnchor="middle" className="payment-donut-num">{formatCompactMoney(codRevVal + vnpayRevVal)}</text>
                <text x="46" y="57" textAnchor="middle" className="payment-donut-sub">VNĐ</text>
              </svg>
              <div className="payment-donut-meta">
                <span className="payment-donut-title">Doanh thu đã chốt</span>
                <span>🟡 COD: <strong>{revMethodSlices[0]?.percentage || 0}%</strong></span>
                <span>🟢 VNPAY: <strong>{revMethodSlices[1]?.percentage || 0}%</strong></span>
              </div>
            </div>
          </div>

          <div className="payment-aov-strip">
            <div className="payment-aov-box">
              <span>Giá trị đơn TB (AOV)</span>
              <strong style={{ color: '#e7b26a' }}>{formatVND(avgCompletedOrderValue)}</strong>
            </div>
            <div className="payment-aov-box">
              <span>Tỷ lệ hoàn thành</span>
              <strong style={{ color: '#10b981' }}>{calcPct(completedOrdersCount)}%</strong>
            </div>
            <div className="payment-aov-box">
              <span>Giá trị đơn đã hủy</span>
              <strong style={{ color: '#ef4444' }}>{formatVND(revenue.cancelled)}</strong>
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
            {loading && topBooks.length === 0 ? (
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
            {loading && recentOrders.length === 0 ? (
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
