import { useState, memo } from 'react'
import { buildMonotoneSplinePath, buildMonotoneAreaPath } from '../utils/chartGeometry'
import './AdminAnalyticsCharts.css'

function formatVND(value) {
  return `${(Number(value) || 0).toLocaleString('vi-VN')} đ`
}

function formatCompactVND(value) {
  const num = Number(value) || 0
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)} tỷ`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)} tr`
  if (num >= 1000) return `${Math.round(num / 1000)}k`
  return String(num)
}

function formatAxisLabel(periodStr, groupBy) {
  if (!periodStr) return ''
  if (groupBy === 'month') {
    const parts = String(periodStr).split('-')
    if (parts.length === 2) return `${parts[1]}/${parts[0]}`
    return periodStr
  }
  const parts = String(periodStr).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}`
  return periodStr
}

function formatFullPeriod(periodStr, groupBy) {
  if (!periodStr) return ''
  if (groupBy === 'month') {
    const parts = String(periodStr).split('-')
    if (parts.length === 2) return `Tháng ${parts[1]}/${parts[0]}`
    return periodStr
  }
  const parts = String(periodStr).split('-')
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`
  return periodStr
}

function getNiceScaleMax(rawMax, isCurrency) {
  const minBound = isCurrency ? 100000 : 4
  if (!rawMax || rawMax <= 0) return minBound
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)))
  const normalized = rawMax / magnitude
  let niceNorm = 10
  if (normalized <= 1.2) niceNorm = 1.2
  else if (normalized <= 2) niceNorm = 2
  else if (normalized <= 3) niceNorm = 3
  else if (normalized <= 5) niceNorm = 5
  else if (normalized <= 8) niceNorm = 8
  const result = Math.ceil(niceNorm * magnitude)
  return isCurrency ? result : Math.max(4, result)
}

function AdminAnalyticsCharts({ revenueChart, loading }) {
  const [revenueMode, setRevenueMode] = useState('total')
  const [hoverRevIdx, setHoverRevIdx] = useState(null)
  const [hoverOrderIdx, setHoverOrderIdx] = useState(null)
  const [hoverUserIdx, setHoverUserIdx] = useState(null)

  const chartData = revenueChart?.chartData || []
  const groupBy = revenueChart?.groupBy || 'day'
  const periodSummary = revenueChart?.summary || {}
  const len = chartData.length
  const labelStep = len <= 12 ? 1 : len <= 20 ? 2 : Math.ceil(len / 8)

  const revWidth = 820
  const revHeight = 250
  const revPad = { top: 20, right: 48, bottom: 32, left: 62 }
  const revPlotW = revWidth - revPad.left - revPad.right
  const revPlotH = revHeight - revPad.top - revPad.bottom

  const maxRevRaw = chartData.reduce((mx, d) => {
    const candidate = revenueMode === 'split'
      ? Math.max(Number(d.codRevenue) || 0, Number(d.vnpayRevenue) || 0)
      : revenueMode === 'cashflow'
        ? Math.max(Number(d.revenue) || 0, Number(d.shippingRevenue) || 0, Number(d.pendingRevenue) || 0)
        : (Number(d.revenue) || 0)
    return Math.max(mx, candidate)
  }, 0)
  const revMax = getNiceScaleMax(maxRevRaw, true)

  const maxCompletedRaw = chartData.reduce((mx, d) => Math.max(mx, Number(d.completedOrdersCount) || 0), 0)
  const completedMax = getNiceScaleMax(maxCompletedRaw, false)

  const getRevX = (idx) => {
    if (len <= 1) return revPad.left + revPlotW / 2
    return revPad.left + (idx / (len - 1)) * revPlotW
  }
  const getRevY = (val) => revPad.top + revPlotH - (Math.min(Number(val) || 0, revMax) / revMax) * revPlotH
  const getCompletedY = (val) => revPad.top + revPlotH - (Math.min(Number(val) || 0, completedMax) / completedMax) * revPlotH

  const revBaseY = revPad.top + revPlotH
  const comboBarW = Math.max(8, Math.min(24, (revPlotW / Math.max(1, len)) * 0.42))

  const totalPoints = chartData.map((d, i) => ({ x: getRevX(i), y: getRevY(Number(d.revenue) || 0) }))
  const codPoints = chartData.map((d, i) => ({ x: getRevX(i), y: getRevY(Number(d.codRevenue) || 0) }))
  const vnpayPoints = chartData.map((d, i) => ({ x: getRevX(i), y: getRevY(Number(d.vnpayRevenue) || 0) }))
  const shippingPoints = chartData.map((d, i) => ({ x: getRevX(i), y: getRevY(Number(d.shippingRevenue) || 0) }))
  const pendingPoints = chartData.map((d, i) => ({ x: getRevX(i), y: getRevY(Number(d.pendingRevenue) || 0) }))

  const totalCurvePath = buildMonotoneSplinePath(totalPoints)
  const codCurvePath = buildMonotoneSplinePath(codPoints)
  const vnpayCurvePath = buildMonotoneSplinePath(vnpayPoints)
  const shippingCurvePath = buildMonotoneSplinePath(shippingPoints)
  const pendingCurvePath = buildMonotoneSplinePath(pendingPoints)
  const totalAreaPath = buildMonotoneAreaPath(totalPoints, revBaseY)

  const barWidth = 520
  const barHeight = 230
  const barPad = { top: 20, right: 20, bottom: 32, left: 38 }
  const barPlotW = barWidth - barPad.left - barPad.right
  const barPlotH = barHeight - barPad.top - barPad.bottom

  const userPad = { top: 20, right: 42, bottom: 32, left: 38 }
  const userPlotW = barWidth - userPad.left - userPad.right
  const userPlotH = barHeight - userPad.top - userPad.bottom
  const userBaseY = userPad.top + userPlotH

  const maxOrdersRaw = chartData.reduce((mx, d) => Math.max(mx, Number(d.ordersCount) || 0), 0)
  const ordersMax = getNiceScaleMax(maxOrdersRaw, false)

  const maxUsersRaw = chartData.reduce((mx, d) => Math.max(mx, Number(d.newUsersCount) || 0), 0)
  const usersMax = getNiceScaleMax(maxUsersRaw, false)

  const cumulativeUsers = chartData.reduce((acc, d) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0
    acc.push(prev + (Number(d.newUsersCount) || 0))
    return acc
  }, [])
  const totalCumUsers = cumulativeUsers.length > 0 ? cumulativeUsers[cumulativeUsers.length - 1] : 0
  const cumUsersMax = getNiceScaleMax(totalCumUsers, false)

  const userSlotW = len > 0 ? userPlotW / len : userPlotW
  const getUserX = (idx) => (len <= 1 ? userPad.left + userPlotW / 2 : userPad.left + userSlotW * idx + userSlotW / 2)
  const getUserDailyY = (val) => userBaseY - (Math.min(Number(val) || 0, usersMax) / usersMax) * userPlotH
  const getUserCumY = (val) => userBaseY - (Math.min(Number(val) || 0, cumUsersMax) / cumUsersMax) * userPlotH

  const cumUserPoints = chartData.map((_, i) => ({ x: getUserX(i), y: getUserCumY(cumulativeUsers[i] || 0) }))
  const cumUserLinePath = buildMonotoneSplinePath(cumUserPoints)
  const cumUserAreaPath = buildMonotoneAreaPath(cumUserPoints, userBaseY)

  const slotW = len > 0 ? barPlotW / len : barPlotW
  const colW = Math.max(6, Math.min(28, slotW * 0.58))

  const activeRevItem = hoverRevIdx !== null && hoverRevIdx < len ? chartData[hoverRevIdx] : null
  const activeOrderItem = hoverOrderIdx !== null && hoverOrderIdx < len ? chartData[hoverOrderIdx] : null
  const activeUserItem = hoverUserIdx !== null && hoverUserIdx < len ? chartData[hoverUserIdx] : null
  const activeUserCumulative = hoverUserIdx !== null && hoverUserIdx < len ? (cumulativeUsers[hoverUserIdx] || 0) : 0

  return (
    <div className="analytics-charts-section">
      <div className="chart-panel">
        <div className="chart-panel-header">
          <div className="chart-panel-title-group">
            <h3 className="chart-panel-title">📈 Biến Động Doanh Thu Theo {groupBy === 'month' ? 'Tháng' : 'Ngày'}</h3>
            <p className="chart-panel-subtitle">
              Tổng doanh thu kỳ: <strong style={{ color: '#e7b26a' }}>{formatVND(periodSummary.totalRevenue)}</strong> (đã bù ngày trống liên tục)
            </p>
          </div>

          <div className="chart-header-right">
            <div className="chart-mode-switch">
              <button
                type="button"
                className={`chart-mode-btn ${revenueMode === 'total' ? 'active' : ''}`}
                onClick={() => setRevenueMode('total')}
              >
                Tổng doanh thu
              </button>
              <button
                type="button"
                className={`chart-mode-btn ${revenueMode === 'split' ? 'active' : ''}`}
                onClick={() => setRevenueMode('split')}
              >
                COD vs VNPAY
              </button>
              <button
                type="button"
                className={`chart-mode-btn ${revenueMode === 'cashflow' ? 'active' : ''}`}
                onClick={() => setRevenueMode('cashflow')}
              >
                Dòng tiền trạng thái
              </button>
            </div>
          </div>
        </div>

        <div className="cashflow-summary-grid">
          <div className="cashflow-box reconciled">
            <span className="cashflow-box-label">Đã đối soát (VNPAY)</span>
            <span className="cashflow-box-value" style={{ color: '#10b981' }}>
              {formatVND(periodSummary.reconciledRevenue)}
            </span>
            <span className="cashflow-box-hint">Đã về tài khoản hệ thống</span>
          </div>

          <div className="cashflow-box unreconciled">
            <span className="cashflow-box-label">Chờ đối soát (COD)</span>
            <span className="cashflow-box-value" style={{ color: '#f59e0b' }}>
              {formatVND(periodSummary.unreconciledRevenue)}
            </span>
            <span className="cashflow-box-hint">Đơn hoàn thành chờ thu hộ về</span>
          </div>

          <div className="cashflow-box shipping">
            <span className="cashflow-box-label">Đang vận chuyển</span>
            <span className="cashflow-box-value" style={{ color: '#60a5fa' }}>
              {formatVND(periodSummary.shippingRevenue)}
            </span>
            <span className="cashflow-box-hint">Nguồn tiền đơn đang giao</span>
          </div>

          <div className="cashflow-box pending">
            <span className="cashflow-box-label">Đơn mới (chờ duyệt)</span>
            <span className="cashflow-box-value" style={{ color: '#c084fc' }}>
              {formatVND(periodSummary.pendingRevenue)}
            </span>
            <span className="cashflow-box-hint">Khách mới đặt, tiền chưa về</span>
          </div>
        </div>

        <div className="chart-legend-row">
          {revenueMode === 'total' ? (
            <>
              <span className="chart-legend-item">
                <span className="legend-dot gold" /> Doanh thu hoàn thành (Trục trái)
              </span>
              <span className="chart-legend-item">
                <span className="legend-bar blue" /> Số đơn hoàn thành (Trục phải)
              </span>
            </>
          ) : revenueMode === 'split' ? (
            <>
              <span className="chart-legend-item">
                <span className="legend-dot amber" /> COD (Chờ đối soát)
              </span>
              <span className="chart-legend-item">
                <span className="legend-dot emerald" /> VNPAY (Đã đối soát về tài khoản)
              </span>
            </>
          ) : (
            <>
              <span className="chart-legend-item">
                <span className="legend-dot emerald" /> Đã chốt thành công
              </span>
              <span className="chart-legend-item">
                <span className="legend-dot blue" /> Đang vận chuyển / xử lý
              </span>
              <span className="chart-legend-item">
                <span className="legend-dot purple" /> Đơn mới chờ duyệt
              </span>
            </>
          )}
        </div>

        <div className="chart-svg-wrapper">
          {activeRevItem ? (
            <div className="chart-tooltip">
              <div className="chart-tooltip-date">{formatFullPeriod(activeRevItem.date, groupBy)}</div>
              <div className="chart-tooltip-row">
                <span>Đã chốt thành công:</span>
                <span className="chart-tooltip-val" style={{ color: '#e7b26a' }}>
                  {formatVND(activeRevItem.revenue)} ({activeRevItem.completedOrdersCount || 0} đơn)
                </span>
              </div>
              <div className="chart-tooltip-row">
                <span>• Đã đối soát (VNPAY):</span>
                <span className="chart-tooltip-val" style={{ color: '#10b981' }}>
                  {formatVND(activeRevItem.vnpayRevenue)}
                </span>
              </div>
              <div className="chart-tooltip-row">
                <span>• Chờ đối soát (COD):</span>
                <span className="chart-tooltip-val">{formatVND(activeRevItem.codRevenue)}</span>
              </div>
              <div className="chart-tooltip-row">
                <span>Đang vận chuyển:</span>
                <span className="chart-tooltip-val" style={{ color: '#60a5fa' }}>
                  {formatVND(activeRevItem.shippingRevenue)}
                </span>
              </div>
              <div className="chart-tooltip-row">
                <span>Đơn mới chưa về:</span>
                <span className="chart-tooltip-val" style={{ color: '#c084fc' }}>
                  {formatVND(activeRevItem.pendingRevenue)}
                </span>
              </div>
            </div>
          ) : null}

          {loading && len === 0 ? (
            <div className="chart-empty-state">Đang tải biểu đồ doanh thu...</div>
          ) : len === 0 ? (
            <div className="chart-empty-state">Không có dữ liệu trong khoảng thời gian này</div>
          ) : (
            <svg
              viewBox={`0 0 ${revWidth} ${revHeight}`}
              className={`chart-svg ${loading ? 'loading' : ''}`}
              onMouseLeave={() => setHoverRevIdx(null)}
            >
              <defs>
                <linearGradient id="goldAreaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e7b26a" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#e7b26a" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="comboBarGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.38" />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.08" />
                </linearGradient>
              </defs>

              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const y = revPad.top + revPlotH * (1 - ratio)
                const val = Math.round(revMax * ratio)
                const rightVal = Math.round(completedMax * ratio)
                return (
                  <g key={ratio}>
                    <line
                      x1={revPad.left}
                      y1={y}
                      x2={revPad.left + revPlotW}
                      y2={y}
                      className="chart-grid-line"
                    />
                    <text x={revPad.left - 10} y={y + 4} textAnchor="end" className="chart-axis-text">
                      {formatCompactVND(val)}
                    </text>
                    {revenueMode === 'total' ? (
                      <text x={revPad.left + revPlotW + 8} y={y + 4} textAnchor="start" className="chart-axis-text right">
                        {rightVal}
                      </text>
                    ) : null}
                  </g>
                )
              })}

              {revenueMode === 'total' ? (
                <>
                  {chartData.map((d, i) => {
                    const completedCount = Number(d.completedOrdersCount) || 0
                    if (completedCount <= 0) return null
                    const x = getRevX(i)
                    const yTop = getCompletedY(completedCount)
                    const hBar = Math.max(0, revBaseY - yTop)
                    return (
                      <rect
                        key={`combo-bar-${d.date}`}
                        x={x - comboBarW / 2}
                        y={yTop}
                        width={comboBarW}
                        height={hBar}
                        rx={3}
                        fill="url(#comboBarGrad)"
                        className={`chart-combo-bar ${hoverRevIdx === i ? 'active' : ''}`}
                      />
                    )
                  })}
                  {totalAreaPath ? <path d={totalAreaPath} fill="url(#goldAreaGrad)" /> : null}
                  {len > 1 ? (
                    <path
                      fill="none"
                      stroke="#e7b26a"
                      strokeWidth="2.6"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      d={totalCurvePath}
                      className="chart-line-path"
                    />
                  ) : null}
                  {chartData.map((d, i) => (
                    <circle
                      key={d.date}
                      cx={getRevX(i)}
                      cy={getRevY(d.revenue || 0)}
                      r={hoverRevIdx === i ? 6 : 3.5}
                      fill="#e7b26a"
                      stroke="#1a1917"
                      strokeWidth="1.8"
                    />
                  ))}
                </>
              ) : revenueMode === 'split' ? (
                <>
                  {len > 1 ? (
                    <>
                      <path
                        fill="none"
                        stroke="#f59e0b"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                        d={codCurvePath}
                        className="chart-line-path"
                      />
                      <path
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.4"
                        strokeLinejoin="round"
                        d={vnpayCurvePath}
                        className="chart-line-path"
                      />
                    </>
                  ) : null}
                  {chartData.map((d, i) => (
                    <g key={d.date}>
                      <circle
                        cx={getRevX(i)}
                        cy={getRevY(d.codRevenue || 0)}
                        r={hoverRevIdx === i ? 5.5 : 3.2}
                        fill="#f59e0b"
                        stroke="#1a1917"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={getRevX(i)}
                        cy={getRevY(d.vnpayRevenue || 0)}
                        r={hoverRevIdx === i ? 5.5 : 3.2}
                        fill="#10b981"
                        stroke="#1a1917"
                        strokeWidth="1.5"
                      />
                    </g>
                  ))}
                </>
              ) : (
                <>
                  {len > 1 ? (
                    <>
                      <path
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="2.5"
                        strokeLinejoin="round"
                        d={totalCurvePath}
                        className="chart-line-path"
                      />
                      <path
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2.3"
                        strokeLinejoin="round"
                        d={shippingCurvePath}
                        className="chart-line-path"
                      />
                      <path
                        fill="none"
                        stroke="#a855f7"
                        strokeWidth="2.2"
                        strokeDasharray="5 3"
                        strokeLinejoin="round"
                        d={pendingCurvePath}
                        className="chart-line-path"
                      />
                    </>
                  ) : null}
                  {chartData.map((d, i) => (
                    <g key={d.date}>
                      <circle
                        cx={getRevX(i)}
                        cy={getRevY(d.revenue || 0)}
                        r={hoverRevIdx === i ? 5.5 : 3.2}
                        fill="#10b981"
                        stroke="#1a1917"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={getRevX(i)}
                        cy={getRevY(d.shippingRevenue || 0)}
                        r={hoverRevIdx === i ? 5.5 : 3.2}
                        fill="#3b82f6"
                        stroke="#1a1917"
                        strokeWidth="1.5"
                      />
                      <circle
                        cx={getRevX(i)}
                        cy={getRevY(d.pendingRevenue || 0)}
                        r={hoverRevIdx === i ? 5.5 : 3.2}
                        fill="#a855f7"
                        stroke="#1a1917"
                        strokeWidth="1.5"
                      />
                    </g>
                  ))}
                </>
              )}

              {chartData.map((d, i) => {
                const x = getRevX(i)
                const colWidth = len > 1 ? revPlotW / (len - 1) : revPlotW
                const showLabel = i % labelStep === 0 || i === len - 1
                return (
                  <g key={`rev-x-${d.date}`}>
                    {showLabel ? (
                      <text x={x} y={revHeight - 8} textAnchor="middle" className="chart-axis-text">
                        {formatAxisLabel(d.date, groupBy)}
                      </text>
                    ) : null}
                    <rect
                      x={Math.max(revPad.left, x - colWidth / 2)}
                      y={revPad.top}
                      width={colWidth}
                      height={revPlotH}
                      className={`chart-hover-column ${hoverRevIdx === i ? 'active' : ''}`}
                      onMouseEnter={() => setHoverRevIdx(i)}
                    />
                  </g>
                )
              })}
            </svg>
          )}
        </div>
      </div>

      <div className="charts-two-col">
        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title-group">
              <h3 className="chart-panel-title">📦 Lượng Đơn Hàng Theo {groupBy === 'month' ? 'Tháng' : 'Ngày'}</h3>
              <p className="chart-panel-subtitle">
                Tổng trong kỳ: <strong style={{ color: '#fffaf1' }}>{periodSummary.totalOrders || 0} đơn</strong> ({periodSummary.completedOrders || 0} hoàn thành)
              </p>
            </div>
            <span className="chart-period-badge">{periodSummary.totalOrders || 0} đơn</span>
          </div>

          <div className="chart-legend-row">
            <span className="chart-legend-item"><span className="legend-dot emerald" /> Hoàn thành</span>
            <span className="chart-legend-item"><span className="legend-dot blue" /> Đang xử lý</span>
            <span className="chart-legend-item"><span className="legend-dot red" /> Đã hủy</span>
          </div>

          <div className="chart-svg-wrapper">
            {activeOrderItem ? (
              <div className="chart-tooltip">
                <div className="chart-tooltip-date">{formatFullPeriod(activeOrderItem.date, groupBy)}</div>
                <div className="chart-tooltip-row">
                  <span>Tổng đơn hàng:</span>
                  <span className="chart-tooltip-val">{activeOrderItem.ordersCount || 0}</span>
                </div>
                <div className="chart-tooltip-row">
                  <span>Hoàn thành:</span>
                  <span className="chart-tooltip-val" style={{ color: '#10b981' }}>
                    {activeOrderItem.completedOrdersCount || 0} đơn ({formatCompactVND(activeOrderItem.revenue)})
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span>Đang xử lý/giao:</span>
                  <span className="chart-tooltip-val" style={{ color: '#3b82f6' }}>
                    {Math.max(0, (activeOrderItem.ordersCount || 0) - (activeOrderItem.completedOrdersCount || 0) - (activeOrderItem.cancelledOrdersCount || 0))} đơn ({formatCompactVND((Number(activeOrderItem.shippingRevenue) || 0) + (Number(activeOrderItem.pendingRevenue) || 0))})
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span>Đã hủy:</span>
                  <span className="chart-tooltip-val" style={{ color: '#ef4444' }}>
                    {activeOrderItem.cancelledOrdersCount || 0}
                  </span>
                </div>
              </div>
            ) : null}

            {loading && len === 0 ? (
              <div className="chart-empty-state">Đang tải biểu đồ đơn hàng...</div>
            ) : len === 0 ? (
              <div className="chart-empty-state">Không có dữ liệu đơn hàng</div>
            ) : (
              <svg
                viewBox={`0 0 ${barWidth} ${barHeight}`}
                className={`chart-svg ${loading ? 'loading' : ''}`}
                onMouseLeave={() => setHoverOrderIdx(null)}
              >
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = barPad.top + barPlotH * (1 - ratio)
                  const val = Math.round(ordersMax * ratio)
                  return (
                    <g key={ratio}>
                      <line
                        x1={barPad.left}
                        y1={y}
                        x2={barPad.left + barPlotW}
                        y2={y}
                        className="chart-grid-line"
                      />
                      <text x={barPad.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                        {val}
                      </text>
                    </g>
                  )
                })}

                {chartData.map((d, i) => {
                  const completed = d.completedOrdersCount || 0
                  const cancelled = d.cancelledOrdersCount || 0
                  const processing = Math.max(0, (d.ordersCount || 0) - completed - cancelled)

                  const xCenter = barPad.left + slotW * i + slotW / 2
                  const barX = xCenter - colW / 2
                  const baseBottom = barPad.top + barPlotH

                  const hCompleted = (completed / ordersMax) * barPlotH
                  const hProcessing = (processing / ordersMax) * barPlotH
                  const hCancelled = (cancelled / ordersMax) * barPlotH

                  const yCompleted = baseBottom - hCompleted
                  const yProcessing = yCompleted - hProcessing
                  const yCancelled = yProcessing - hCancelled
                  const showLabel = i % labelStep === 0 || i === len - 1

                  return (
                    <g key={`ord-${d.date}`} onMouseEnter={() => setHoverOrderIdx(i)}>
                      <rect
                        x={barPad.left + slotW * i}
                        y={barPad.top}
                        width={slotW}
                        height={barPlotH}
                        className={`chart-hover-column ${hoverOrderIdx === i ? 'active' : ''}`}
                      />
                      {hCompleted > 0 ? (
                        <rect
                          x={barX}
                          y={yCompleted}
                          width={colW}
                          height={hCompleted}
                          fill="#10b981"
                          rx={hProcessing === 0 && hCancelled === 0 ? 3 : 0}
                          className="chart-bar-rect"
                        />
                      ) : null}
                      {hProcessing > 0 ? (
                        <rect
                          x={barX}
                          y={yProcessing}
                          width={colW}
                          height={hProcessing}
                          fill="#3b82f6"
                          rx={hCancelled === 0 ? 3 : 0}
                          className="chart-bar-rect"
                        />
                      ) : null}
                      {hCancelled > 0 ? (
                        <rect
                          x={barX}
                          y={yCancelled}
                          width={colW}
                          height={hCancelled}
                          fill="#ef4444"
                          rx={3}
                          className="chart-bar-rect"
                        />
                      ) : null}
                      {showLabel ? (
                        <text x={xCenter} y={barHeight - 8} textAnchor="middle" className="chart-axis-text">
                          {formatAxisLabel(d.date, groupBy)}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>

        <div className="chart-panel">
          <div className="chart-panel-header">
            <div className="chart-panel-title-group">
              <h3 className="chart-panel-title">👥 Độc Giả Mới Đăng Ký Theo {groupBy === 'month' ? 'Tháng' : 'Ngày'}</h3>
              <p className="chart-panel-subtitle">
                Tổng trong kỳ: <strong style={{ color: '#c084fc' }}>{periodSummary.totalNewUsers || 0} tài khoản</strong>
              </p>
            </div>
            <span className="chart-period-badge" style={{ color: '#c084fc', borderColor: 'rgba(168, 85, 247, 0.35)', background: 'rgba(168, 85, 247, 0.14)' }}>
              +{periodSummary.totalNewUsers || 0} mới
            </span>
          </div>

          <div className="chart-legend-row">
            <span className="chart-legend-item"><span className="legend-dot purple" /> Mới trong kỳ (Trục trái)</span>
            <span className="chart-legend-item"><span className="legend-line dashed-gold" /> Tích lũy trong kỳ (Trục phải)</span>
          </div>

          <div className="chart-svg-wrapper">
            {activeUserItem ? (
              <div className="chart-tooltip">
                <div className="chart-tooltip-date">{formatFullPeriod(activeUserItem.date, groupBy)}</div>
                <div className="chart-tooltip-row">
                  <span>Độc giả mới:</span>
                  <span className="chart-tooltip-val" style={{ color: '#c084fc' }}>
                    {activeUserItem.newUsersCount || 0} người dùng
                  </span>
                </div>
                <div className="chart-tooltip-row">
                  <span>Tích lũy trong kỳ:</span>
                  <span className="chart-tooltip-val" style={{ color: '#e7b26a' }}>
                    {activeUserCumulative} tài khoản
                  </span>
                </div>
              </div>
            ) : null}

            {loading && len === 0 ? (
              <div className="chart-empty-state">Đang tải biểu đồ người dùng...</div>
            ) : len === 0 ? (
              <div className="chart-empty-state">Không có dữ liệu người dùng</div>
            ) : (
              <svg
                viewBox={`0 0 ${barWidth} ${barHeight}`}
                className={`chart-svg ${loading ? 'loading' : ''}`}
                onMouseLeave={() => setHoverUserIdx(null)}
              >
                <defs>
                  <linearGradient id="purpleCumAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                  const y = userPad.top + userPlotH * (1 - ratio)
                  const val = Math.round(usersMax * ratio)
                  const cumVal = Math.round(cumUsersMax * ratio)
                  return (
                    <g key={ratio}>
                      <line
                        x1={userPad.left}
                        y1={y}
                        x2={userPad.left + userPlotW}
                        y2={y}
                        className="chart-grid-line"
                      />
                      <text x={userPad.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                        {val}
                      </text>
                      <text x={userPad.left + userPlotW + 8} y={y + 4} textAnchor="start" className="chart-axis-text right-gold">
                        {cumVal}
                      </text>
                    </g>
                  )
                })}

                {cumUserAreaPath ? <path d={cumUserAreaPath} fill="url(#purpleCumAreaGrad)" /> : null}
                {len > 1 ? (
                  <path
                    fill="none"
                    stroke="#e7b26a"
                    strokeWidth="2"
                    strokeDasharray="4 3"
                    d={cumUserLinePath}
                    className="chart-cum-line"
                  />
                ) : null}

                {chartData.map((d, i) => {
                  const newUsers = Number(d.newUsersCount) || 0
                  const xCenter = getUserX(i)
                  const yUser = getUserDailyY(newUsers)
                  const showLabel = i % labelStep === 0 || i === len - 1

                  return (
                    <g key={`usr-${d.date}`} onMouseEnter={() => setHoverUserIdx(i)}>
                      <rect
                        x={len <= 1 ? userPad.left : userPad.left + userSlotW * i}
                        y={userPad.top}
                        width={len <= 1 ? userPlotW : userSlotW}
                        height={userPlotH}
                        className={`chart-hover-column ${hoverUserIdx === i ? 'active' : ''}`}
                      />
                      {newUsers > 0 ? (
                        <line
                          x1={xCenter}
                          y1={userBaseY}
                          x2={xCenter}
                          y2={yUser}
                          className={`chart-lollipop-stem ${hoverUserIdx === i ? 'active' : ''}`}
                        />
                      ) : null}
                      <circle
                        cx={xCenter}
                        cy={yUser}
                        r={hoverUserIdx === i ? 6 : (newUsers > 0 ? 4.4 : 2.5)}
                        fill={newUsers > 0 ? '#c084fc' : '#524a3f'}
                        stroke="#1a1917"
                        strokeWidth="1.6"
                        className="chart-lollipop-dot"
                      />
                      {showLabel ? (
                        <text x={xCenter} y={barHeight - 8} textAnchor="middle" className="chart-axis-text">
                          {formatAxisLabel(d.date, groupBy)}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default memo(AdminAnalyticsCharts)
