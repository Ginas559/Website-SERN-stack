import { useState, memo } from 'react'
import { buildCircularSegments } from '../utils/chartGeometry'
import './AdminCatalogAnalyticsCharts.css'

const CATEGORY_COLORS = [
  '#e7b26a',
  '#3b82f6',
  '#10b981',
  '#a855f7',
  '#f59e0b',
  '#ec4899',
  '#14b8a6',
  '#f97316'
]

function formatVND(val) {
  return Number(val || 0).toLocaleString('vi-VN') + ' đ'
}

function formatCompactVND(val) {
  const num = Number(val) || 0
  if (num >= 1000000000) return `${(num / 1000000000).toFixed(1)}tỷ`
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}tr`
  if (num >= 1000) return `${Math.round(num / 1000)}k`
  return `${num}đ`
}

function truncateText(text, maxLen) {
  const str = String(text || '')
  return str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str
}

function getNicePromoMax(rawMax) {
  if (!rawMax || rawMax <= 4) return 4
  const step = rawMax <= 10 ? 2 : rawMax <= 30 ? 5 : rawMax <= 100 ? 10 : Math.pow(10, Math.floor(Math.log10(rawMax)) - 1) * 2
  return Math.ceil(rawMax / step) * step
}

const PROMO_STATUS_META = {
  active: { label: 'Đang chạy', cls: 'active', color: '#a855f7' },
  scheduled: { label: 'Chờ mở', cls: 'scheduled', color: '#3b82f6' },
  exhausted: { label: 'Hết lượt', cls: 'exhausted', color: '#f59e0b' },
  expired: { label: 'Hết hạn', cls: 'expired', color: '#6b7280' }
}

function AdminCatalogAnalyticsCharts({
  categories = [],
  topBooks = [],
  booksOverview = {},
  reviewAnalytics = null,
  reviewsOverview = {},
  promotionAnalytics = null,
  promotionsOverview = {},
  loading = false,
  onNavigateTab
}) {
  const [catMetric, setCatMetric] = useState('revenue')
  const [bookMetric, setBookMetric] = useState('sold')
  const [hoverCatIdx, setHoverCatIdx] = useState(null)
  const [hoverBookIdx, setHoverBookIdx] = useState(null)
  const [hoverStockKey, setHoverStockKey] = useState(null)
  const [hoverReviewSlice, setHoverReviewSlice] = useState(null)
  const [hoverPromoIdx, setHoverPromoIdx] = useState(null)

  const safeCategories = Array.isArray(categories) ? categories : []
  const donutRadius = 72
  const donutCircumference = 2 * Math.PI * donutRadius
  const totalCatValue = safeCategories.reduce(
    (sum, c) => sum + (catMetric === 'revenue' ? (Number(c.totalRevenue) || 0) : (Number(c.bookCount) || 0)),
    0
  )
  const donutSegments = buildCircularSegments(
    safeCategories.map((cat, idx) => ({
      id: cat.id || idx,
      name: cat.name || 'Thể loại',
      value: catMetric === 'revenue' ? (Number(cat.totalRevenue) || 0) : (Number(cat.bookCount) || 0),
      bookCount: Number(cat.bookCount) || 0,
      totalSold: Number(cat.totalSold) || 0,
      totalRevenue: Number(cat.totalRevenue) || 0,
      color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
    })),
    donutRadius
  )
  const hoveredCat = hoverCatIdx !== null && hoverCatIdx < donutSegments.length ? donutSegments[hoverCatIdx] : null

  const safeTopBooks = (Array.isArray(topBooks) ? topBooks : []).slice(0, 5)
  const maxBookBarVal = Math.max(
    1,
    ...safeTopBooks.map((b) => (bookMetric === 'sold' ? (Number(b.totalSold) || 0) : (Number(b.totalRevenue) || 0)))
  )
  const hoveredBook = hoverBookIdx !== null && hoverBookIdx < safeTopBooks.length ? safeTopBooks[hoverBookIdx] : null

  const totalBooksCount = Number(booksOverview.total) || 0
  const outOfStockCount = Number(booksOverview.outOfStock) || 0
  const lowStockCount = Number(booksOverview.lowStock) || 0
  const inStockCount = booksOverview.inStock !== undefined
    ? Number(booksOverview.inStock) || 0
    : Math.max(0, totalBooksCount - outOfStockCount - lowStockCount)

  const gaugeRadius = 80
  const gaugeSemiCircumference = Math.PI * gaugeRadius
  const gaugeFullCircumference = 2 * Math.PI * gaugeRadius
  const stockBuckets = [
    { key: 'instock', label: 'Còn nhiều', count: inStockCount, color: '#10b981' },
    { key: 'low', label: 'Sắp hết', count: lowStockCount, color: '#f59e0b' },
    { key: 'out', label: 'Hết hàng', count: outOfStockCount, color: '#ef4444' },
  ]
  const totalStockClassified = stockBuckets.reduce((sum, b) => sum + Math.max(0, b.count), 0)
  const stockGaugeArcs = stockBuckets.reduce((acc, item) => {
    const ratio = totalStockClassified > 0 ? Math.max(0, item.count) / totalStockClassified : 0
    const arcLen = ratio * gaugeSemiCircumference
    const offset = acc.length > 0 ? acc[acc.length - 1].endOffset : 0
    acc.push({
      ...item,
      percentage: Number((ratio * 100).toFixed(1)),
      arcLen,
      offset,
      endOffset: offset + arcLen,
    })
    return acc
  }, [])
  const hoveredStock = stockGaugeArcs.find((s) => s.key === hoverStockKey) || null

  const resolvedTotalRatings = reviewAnalytics
    ? (Number(reviewAnalytics.totalRatings) || 0)
    : (Number(reviewsOverview.totalRatings) || 0)
  const resolvedTotalDiscussions = reviewAnalytics
    ? (Number(reviewAnalytics.totalDiscussions) || 0)
    : (Number(reviewsOverview.totalDiscussions) || 0)
  const resolvedAvgRate = reviewAnalytics
    ? (Number(reviewAnalytics.averageRate) || 0)
    : (Number(reviewsOverview.averageRate) || 0)
  const resolvedTotalPosts = resolvedTotalRatings + resolvedTotalDiscussions
  const ratingShare = reviewAnalytics
    ? (Number(reviewAnalytics.ratingShare) || 0)
    : (resolvedTotalPosts > 0 ? Number(((resolvedTotalRatings / resolvedTotalPosts) * 100).toFixed(1)) : 0)
  const discussionShare = reviewAnalytics
    ? (Number(reviewAnalytics.discussionShare) || 0)
    : (resolvedTotalPosts > 0 ? Number(((resolvedTotalDiscussions / resolvedTotalPosts) * 100).toFixed(1)) : 0)

  const scoreRingRadius = 40
  const scoreRingCirc = 2 * Math.PI * scoreRingRadius
  const scoreRingRatio = Math.min(1, Math.max(0, resolvedAvgRate / 5))
  const scoreRingDash = scoreRingRatio * scoreRingCirc

  const miniSplitRadius = 30
  const miniSplitCirc = 2 * Math.PI * miniSplitRadius
  const reviewSplitSlices = buildCircularSegments(
    [
      { key: 'ratings', label: 'Đánh giá', value: resolvedTotalRatings, share: ratingShare, color: '#f59e0b' },
      { key: 'discussions', label: 'Thảo luận', value: resolvedTotalDiscussions, share: discussionShare, color: '#3b82f6' },
    ],
    miniSplitRadius
  )

  const fallbackBreakdown = reviewsOverview.ratingBreakdown || {}
  const resolvedStars = reviewAnalytics && Array.isArray(reviewAnalytics.stars)
    ? reviewAnalytics.stars
    : [5, 4, 3, 2, 1].map((star) => {
        const count = Number(fallbackBreakdown[star]) || 0
        return {
          star,
          count,
          percentage: resolvedTotalRatings > 0 ? Number(((count / resolvedTotalRatings) * 100).toFixed(1)) : 0
        }
      })
  const topRatedBooks = reviewAnalytics && Array.isArray(reviewAnalytics.topRatedBooks)
    ? reviewAnalytics.topRatedBooks
    : []

  const promoAdoption = promotionAnalytics?.adoption || {
    totalOrders: 0,
    ordersWithPromo: 0,
    ordersWithoutPromo: 0,
    promoRate: 0,
    promoRevenue: 0,
    regularRevenue: 0
  }
  const topPromotions = (Array.isArray(promotionAnalytics?.topPromotions) ? promotionAnalytics.topPromotions : []).slice(0, 5)
  const promoRingRadius = 38
  const promoRingCirc = 2 * Math.PI * promoRingRadius
  const promoRingRatio = Math.min(1, Math.max(0, (Number(promoAdoption.promoRate) || 0) / 100))
  const promoRingDash = promoRingRatio * promoRingCirc
  const hoveredPromo = hoverPromoIdx !== null && hoverPromoIdx < topPromotions.length ? topPromotions[hoverPromoIdx] : null
  const promoMaxUsedRaw = topPromotions.reduce((mx, p) => Math.max(mx, Number(p.usedCount) || 0), 0)
  const promoScaleMax = getNicePromoMax(promoMaxUsedRaw)

  const bookSvgW = 540
  const bookRowH = 34
  const bookPad = { left: 206, right: 112, top: 8, bottom: 24 }
  const bookPlotW = bookSvgW - bookPad.left - bookPad.right
  const bookSvgH = bookPad.top + Math.max(1, safeTopBooks.length) * bookRowH + bookPad.bottom

  const starSvgW = 520
  const starRowH = 26
  const starPad = { left: 44, right: 100, top: 8, bottom: 24 }
  const starPlotW = starSvgW - starPad.left - starPad.right
  const starSvgH = starPad.top + 5 * starRowH + starPad.bottom

  const promoSvgW = 520
  const promoSvgH = 166
  const promoPad = { left: 42, right: 16, top: 24, bottom: 16 }
  const promoPlotW = promoSvgW - promoPad.left - promoPad.right
  const promoPlotH = promoSvgH - promoPad.top - promoPad.bottom
  const promoColSlot = topPromotions.length > 0 ? promoPlotW / topPromotions.length : promoPlotW
  const promoColW = Math.min(44, Math.max(22, promoColSlot * 0.48))

  return (
    <div className="catalog-analytics-section">
      <div className={`catalog-chart-card ${loading && safeCategories.length > 0 ? 'loading' : ''}`}>
        <div className="catalog-chart-header">
          <div className="catalog-chart-title-wrap">
            <h3 className="catalog-chart-title">🏷️ Cơ Cấu Thể Loại Sách</h3>
            <p className="catalog-chart-sub">
              Phân bổ thực tế theo {catMetric === 'revenue' ? 'doanh thu đã chốt' : 'số lượng đầu sách'}
            </p>
          </div>
          <div className="catalog-chart-actions">
            <div className="chart-mode-switch">
              <button
                type="button"
                className={`chart-mode-btn ${catMetric === 'revenue' ? 'active' : ''}`}
                onClick={() => setCatMetric('revenue')}
              >
                Doanh thu
              </button>
              <button
                type="button"
                className={`chart-mode-btn ${catMetric === 'books' ? 'active' : ''}`}
                onClick={() => setCatMetric('books')}
              >
                Đầu sách
              </button>
            </div>
            {onNavigateTab ? (
              <button
                type="button"
                className="overview-panel-action-btn"
                onClick={() => onNavigateTab('categories')}
              >
                Thể loại →
              </button>
            ) : null}
          </div>
        </div>

        {loading && safeCategories.length === 0 ? (
          <div className="catalog-empty-placeholder">Đang tải biểu đồ thể loại...</div>
        ) : safeCategories.length === 0 ? (
          <div className="catalog-empty-placeholder">Chưa có dữ liệu thể loại</div>
        ) : (
          <div className="catalog-donut-layout">
            <div className="catalog-donut-svg-box">
              <svg viewBox="0 0 200 200" className="catalog-donut-svg" onMouseLeave={() => setHoverCatIdx(null)}>
                <circle
                  cx="100"
                  cy="100"
                  r={donutRadius}
                  fill="none"
                  stroke="#33302b"
                  strokeWidth="30"
                />
                {totalCatValue > 0 ? donutSegments.map((seg, idx) => (
                  seg.segLen > 0 ? (
                    <circle
                      key={seg.id}
                      cx="100"
                      cy="100"
                      r={donutRadius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={hoverCatIdx === idx ? 36 : 30}
                      strokeDasharray={`${seg.segLen} ${Math.max(0, donutCircumference - seg.segLen)}`}
                      strokeDashoffset={-seg.offset}
                      transform="rotate(-90 100 100)"
                      className="catalog-donut-slice"
                      style={{ opacity: hoverCatIdx !== null && hoverCatIdx !== idx ? 0.45 : 1 }}
                      onMouseEnter={() => setHoverCatIdx(idx)}
                    />
                  ) : null
                )) : null}
              </svg>
              <div className="catalog-donut-center">
                {hoveredCat ? (
                  <>
                    <span className="catalog-donut-center-label" title={hoveredCat.name}>{hoveredCat.name}</span>
                    <span className="catalog-donut-center-val">
                      {catMetric === 'revenue' ? formatCompactVND(hoveredCat.totalRevenue) : `${hoveredCat.bookCount} đầu`}
                    </span>
                    <span className="catalog-donut-center-pct">{hoveredCat.percentage}%</span>
                  </>
                ) : (
                  <>
                    <span className="catalog-donut-center-label">
                      {catMetric === 'revenue' ? 'Tổng DT' : 'Tổng đầu sách'}
                    </span>
                    <span className="catalog-donut-center-val">
                      {catMetric === 'revenue' ? formatCompactVND(totalCatValue) : `${totalCatValue} lượt`}
                    </span>
                    <span className="catalog-donut-center-pct">{safeCategories.length} thể loại</span>
                  </>
                )}
              </div>
            </div>

            <div className="catalog-donut-legend">
              {donutSegments.slice(0, 6).map((seg, idx) => (
                <div
                  key={seg.id}
                  className={`catalog-legend-row ${hoverCatIdx === idx ? 'active' : ''}`}
                  onMouseEnter={() => setHoverCatIdx(idx)}
                  onMouseLeave={() => setHoverCatIdx(null)}
                >
                  <div className="catalog-legend-left">
                    <span className="catalog-legend-dot" style={{ backgroundColor: seg.color }} />
                    <span className="catalog-legend-name" title={seg.name}>{seg.name}</span>
                  </div>
                  <div className="catalog-legend-right">
                    <span className="catalog-legend-metric">
                      {catMetric === 'revenue' ? formatCompactVND(seg.totalRevenue) : `${seg.bookCount} cuốn`}
                    </span>
                    <span className="catalog-legend-pct">{seg.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`catalog-chart-card ${loading && safeTopBooks.length > 0 ? 'loading' : ''}`}>
        <div className="catalog-chart-header">
          <div className="catalog-chart-title-wrap">
            <h3 className="catalog-chart-title">📚 Top Sách Bán Chạy & Kho Hàng</h3>
            <p className="catalog-chart-sub">
              Biểu đồ cột ngang xếp hạng bán chạy & đồng hồ sức khỏe tồn kho
            </p>
          </div>
          <div className="catalog-chart-actions">
            <div className="chart-mode-switch">
              <button
                type="button"
                className={`chart-mode-btn ${bookMetric === 'sold' ? 'active' : ''}`}
                onClick={() => setBookMetric('sold')}
              >
                Số lượng
              </button>
              <button
                type="button"
                className={`chart-mode-btn ${bookMetric === 'revenue' ? 'active' : ''}`}
                onClick={() => setBookMetric('revenue')}
              >
                Doanh thu
              </button>
            </div>
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
        </div>

        {loading && safeTopBooks.length === 0 ? (
          <div className="catalog-empty-placeholder">Đang tải biểu đồ sách...</div>
        ) : safeTopBooks.length === 0 ? (
          <div className="catalog-empty-placeholder">Chưa có dữ liệu sách bán thành công</div>
        ) : (
          <div className="catalog-svg-box">
            <div className={`catalog-detail-strip ${hoveredBook ? 'active' : ''}`}>
              {hoveredBook ? (
                <>
                  <strong className="catalog-detail-title">{hoveredBook.title}</strong>
                  <span className="catalog-detail-meta">
                    {hoveredBook.totalSold || 0} cuốn • {formatVND(hoveredBook.totalRevenue)} • Tồn: {hoveredBook.currentStock || 0}
                  </span>
                </>
              ) : (
                <span className="catalog-detail-hint">Rê chuột vào cột sách để xem tên đầy đủ, doanh thu và tồn kho</span>
              )}
            </div>

            <svg
              viewBox={`0 0 ${bookSvgW} ${bookSvgH}`}
              className="catalog-hbar-svg"
              onMouseLeave={() => setHoverBookIdx(null)}
            >
              <defs>
                <clipPath id="bookTitleClip">
                  <rect x="28" y="0" width={bookPad.left - 38} height={bookSvgH} />
                </clipPath>
              </defs>

              {[0, 0.5, 1].map((ratio) => {
                const x = bookPad.left + bookPlotW * ratio
                const tickVal = Math.round(maxBookBarVal * ratio)
                return (
                  <g key={ratio}>
                    <line
                      x1={x}
                      y1={bookPad.top}
                      x2={x}
                      y2={bookSvgH - bookPad.bottom}
                      className="chart-grid-line"
                    />
                    <text x={x} y={bookSvgH - 6} textAnchor="middle" className="chart-axis-text">
                      {bookMetric === 'sold' ? `${tickVal}` : formatCompactVND(tickVal)}
                    </text>
                  </g>
                )
              })}

              {safeTopBooks.map((book, idx) => {
                const rawVal = bookMetric === 'sold' ? (Number(book.totalSold) || 0) : (Number(book.totalRevenue) || 0)
                const barW = Math.max(6, (rawVal / maxBookBarVal) * bookPlotW)
                const rowY = bookPad.top + idx * bookRowH
                const barY = rowY + 8
                const barColor = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
                const valLabel = bookMetric === 'sold' ? `${book.totalSold || 0} cuốn` : formatVND(book.totalRevenue)
                return (
                  <g
                    key={book.id}
                    className="catalog-svg-row"
                    aria-label={`${book.title} — Tác giả: ${book.author || 'N/A'} | Tồn: ${book.currentStock || 0}`}
                    onMouseEnter={() => setHoverBookIdx(idx)}
                  >
                    <rect
                      x={0}
                      y={rowY}
                      width={bookSvgW}
                      height={bookRowH}
                      rx={6}
                      fill={hoverBookIdx === idx ? 'rgba(231, 178, 106, 0.08)' : 'transparent'}
                    />
                    <text x={4} y={rowY + 21} className="catalog-svg-rank" fill={barColor}>
                      #{idx + 1}
                    </text>
                    <g clipPath="url(#bookTitleClip)">
                      <text x={28} y={rowY + 21} className="catalog-svg-label">
                        {truncateText(book.title, 22)}
                      </text>
                    </g>
                    <rect
                      x={bookPad.left}
                      y={barY}
                      width={bookPlotW}
                      height={16}
                      rx={4}
                      fill="#1a1917"
                    />
                    <rect
                      x={bookPad.left}
                      y={barY}
                      width={barW}
                      height={16}
                      rx={4}
                      fill={barColor}
                      style={{ opacity: hoverBookIdx !== null && hoverBookIdx !== idx ? 0.55 : 0.92 }}
                    />
                    <text
                      x={bookPad.left + bookPlotW + 10}
                      y={rowY + 21}
                      className="catalog-svg-val"
                    >
                      {valLabel}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        )}

        <div className="stock-gauge-panel">
          <div className="stock-gauge-svg-wrap">
            <svg viewBox="0 0 220 122" className="stock-gauge-svg" onMouseLeave={() => setHoverStockKey(null)}>
              <circle
                cx="110"
                cy="104"
                r={gaugeRadius}
                fill="none"
                stroke="#2e2b26"
                strokeWidth="18"
                strokeDasharray={`${gaugeSemiCircumference} ${gaugeFullCircumference}`}
                transform="rotate(180 110 104)"
                strokeLinecap="butt"
              />
              {totalStockClassified > 0 ? stockGaugeArcs.map((arc) => (
                arc.arcLen > 0 ? (
                  <circle
                    key={arc.key}
                    cx="110"
                    cy="104"
                    r={gaugeRadius}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={hoverStockKey === arc.key ? 22 : 18}
                    strokeDasharray={`${arc.arcLen} ${gaugeFullCircumference}`}
                    strokeDashoffset={-arc.offset}
                    transform="rotate(180 110 104)"
                    className="stock-gauge-arc"
                    style={{ opacity: hoverStockKey && hoverStockKey !== arc.key ? 0.45 : 1 }}
                    onMouseEnter={() => setHoverStockKey(arc.key)}
                  />
                ) : null
              )) : null}
              <text x="110" y="84" textAnchor="middle" className="stock-gauge-main">
                {hoveredStock ? `${hoveredStock.count} đầu` : `${booksOverview.totalInventory || 0}`}
              </text>
              <text x="110" y="102" textAnchor="middle" className="stock-gauge-sub">
                {hoveredStock ? `${hoveredStock.label} (${hoveredStock.percentage}%)` : `cuốn / ${totalBooksCount} đầu`}
              </text>
            </svg>
          </div>

          <div className="stock-gauge-legend-col">
            <span className="stock-gauge-title">Sức khỏe tồn kho ({totalBooksCount} đầu sách)</span>
            <div className="inventory-health-legend vertical">
              <span onMouseEnter={() => setHoverStockKey('instock')} onMouseLeave={() => setHoverStockKey(null)}>
                🟢 Còn nhiều: <strong>{inStockCount}</strong>
              </span>
              <span onMouseEnter={() => setHoverStockKey('low')} onMouseLeave={() => setHoverStockKey(null)}>
                🟡 Sắp hết: <strong>{lowStockCount}</strong>
              </span>
              <span onMouseEnter={() => setHoverStockKey('out')} onMouseLeave={() => setHoverStockKey(null)}>
                🔴 Hết hàng: <strong>{outOfStockCount}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className={`catalog-chart-card ${loading && resolvedTotalPosts > 0 ? 'loading' : ''}`}>
        <div className="catalog-chart-header">
          <div className="catalog-chart-title-wrap">
            <h3 className="catalog-chart-title">⭐ Phân Bố Đánh Giá & Thảo Luận</h3>
            <p className="catalog-chart-sub">
              Vòng điểm chất lượng, tỷ trọng tương tác & phổ 1★ → 5★ ({resolvedTotalPosts} bài)
            </p>
          </div>
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

        <div className="review-visual-hero">
          <div className="review-ring-box">
            <svg viewBox="0 0 98 98" className="review-ring-svg">
              <circle cx="49" cy="49" r={scoreRingRadius} fill="none" stroke="#33302b" strokeWidth="8" />
              <circle
                cx="49"
                cy="49"
                r={scoreRingRadius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${scoreRingDash} ${scoreRingCirc}`}
                transform="rotate(-90 49 49)"
              />
            </svg>
            <div className="review-ring-center">
              <span className="review-score-big">{resolvedAvgRate.toFixed(1)} ★</span>
            </div>
          </div>

          <div className="review-split-donut-box">
            <svg viewBox="0 0 84 84" className="review-split-svg" onMouseLeave={() => setHoverReviewSlice(null)}>
              <circle cx="42" cy="42" r={miniSplitRadius} fill="none" stroke="#33302b" strokeWidth="16" />
              {resolvedTotalPosts > 0 ? reviewSplitSlices.map((sl) => (
                sl.segLen > 0 ? (
                  <circle
                    key={sl.key}
                    cx="42"
                    cy="42"
                    r={miniSplitRadius}
                    fill="none"
                    stroke={sl.color}
                    strokeWidth={hoverReviewSlice === sl.key ? 19 : 16}
                    strokeDasharray={`${sl.segLen} ${Math.max(0, miniSplitCirc - sl.segLen)}`}
                    strokeDashoffset={-sl.offset}
                    transform="rotate(-90 42 42)"
                    className="catalog-donut-slice"
                    onMouseEnter={() => setHoverReviewSlice(sl.key)}
                  />
                ) : null
              )) : null}
            </svg>
            <div className="review-split-legend">
              <span
                className={hoverReviewSlice === 'ratings' ? 'highlighted' : ''}
                onMouseEnter={() => setHoverReviewSlice('ratings')}
                onMouseLeave={() => setHoverReviewSlice(null)}
              >
                ⭐ Đánh giá: <strong>{resolvedTotalRatings}</strong> ({ratingShare}%)
              </span>
              <span
                className={hoverReviewSlice === 'discussions' ? 'highlighted' : ''}
                onMouseEnter={() => setHoverReviewSlice('discussions')}
                onMouseLeave={() => setHoverReviewSlice(null)}
              >
                💬 Thảo luận: <strong>{resolvedTotalDiscussions}</strong> ({discussionShare}%)
              </span>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${starSvgW} ${starSvgH}`} className="rating-dist-svg">
          {[0, 0.5, 1].map((ratio) => {
            const x = starPad.left + starPlotW * ratio
            return (
              <g key={ratio}>
                <line
                  x1={x}
                  y1={starPad.top}
                  x2={x}
                  y2={starSvgH - starPad.bottom}
                  className="chart-grid-line"
                />
                <text x={x} y={starSvgH - 6} textAnchor="middle" className="chart-axis-text">
                  {Math.round(ratio * 100)}%
                </text>
              </g>
            )
          })}

          {resolvedStars.map((row, idx) => {
            const rowY = starPad.top + idx * starRowH
            const pct = Math.min(100, Math.max(0, Number(row.percentage) || 0))
            const fillW = (pct / 100) * starPlotW
            const barColor = row.star >= 4 ? '#10b981' : row.star === 3 ? '#f59e0b' : '#ef4444'
            return (
              <g key={row.star}>
                <text x={4} y={rowY + 17} className="rating-svg-star" fill="#f59e0b">
                  {row.star} ★
                </text>
                <rect
                  x={starPad.left}
                  y={rowY + 5}
                  width={starPlotW}
                  height={14}
                  rx={4}
                  fill="#1a1917"
                />
                {fillW > 0 ? (
                  <rect
                    x={starPad.left}
                    y={rowY + 5}
                    width={Math.max(4, fillW)}
                    height={14}
                    rx={4}
                    fill={barColor}
                  />
                ) : null}
                <text x={starPad.left + starPlotW + 8} y={rowY + 16} className="rating-svg-count">
                  {row.count} ({row.percentage}%)
                </text>
              </g>
            )
          })}
        </svg>

        {topRatedBooks.length > 0 ? (
          <div className="top-rated-pills">
            {topRatedBooks.slice(0, 3).map((b) => (
              <span key={b.id} className="top-rated-pill" title={`${b.title} (${b.avgRating} ★ / ${b.reviewCount} đánh giá)`}>
                <strong style={{ color: '#f59e0b' }}>{b.avgRating}★</strong>
                <span className="top-rated-pill-title">{b.title}</span>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className={`catalog-chart-card ${loading && topPromotions.length > 0 ? 'loading' : ''}`}>
        <div className="catalog-chart-header">
          <div className="catalog-chart-title-wrap">
            <h3 className="catalog-chart-title">🎟️ Hiệu Quả Khuyến Mãi & Voucher</h3>
            <p className="catalog-chart-sub">
              Đang chạy {promotionsOverview.active || 0}/{promotionsOverview.total || 0} mã · Tổng {promotionsOverview.totalUsed || 0} lượt áp dụng
            </p>
          </div>
          {onNavigateTab ? (
            <button
              type="button"
              className="overview-panel-action-btn"
              onClick={() => onNavigateTab('promotions')}
            >
              Khuyến mãi →
            </button>
          ) : null}
        </div>

        <div className="promo-radial-hero">
          <div className="promo-ring-box">
            <svg viewBox="0 0 92 92" className="promo-ring-svg">
              <circle cx="46" cy="46" r={promoRingRadius} fill="none" stroke="#33302b" strokeWidth="9" />
              <circle
                cx="46"
                cy="46"
                r={promoRingRadius}
                fill="none"
                stroke="#a855f7"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={`${promoRingDash} ${promoRingCirc}`}
                transform="rotate(-90 46 46)"
              />
            </svg>
            <div className="promo-ring-center">
              <strong style={{ color: '#e7b26a', fontSize: '1.02rem' }}>{promoAdoption.promoRate || 0}%</strong>
            </div>
          </div>

          <div className="promo-hero-details">
            <div className="promo-adoption-top">
              <span style={{ color: '#d6cfc5' }}>
                Đơn áp mã kỳ lọc: <strong style={{ color: '#10b981' }}>{promoAdoption.ordersWithPromo || 0}</strong> / {promoAdoption.totalOrders || 0} đơn
              </span>
            </div>
            <div className="promo-rev-split">
              <span>🟣 DT có mã: <strong>{formatCompactVND(promoAdoption.promoRevenue)}</strong></span>
              <span>🔵 DT nguyên giá: <strong>{formatCompactVND(promoAdoption.regularRevenue)}</strong></span>
            </div>
          </div>
        </div>

        {loading && topPromotions.length === 0 ? (
          <div className="catalog-empty-placeholder">Đang tải hiệu suất voucher...</div>
        ) : topPromotions.length === 0 ? (
          <div className="catalog-empty-placeholder">Chưa có chương trình khuyến mãi nào</div>
        ) : (
          <div className="promo-chart-area">
            <div className={`catalog-detail-strip ${hoveredPromo ? 'active' : ''}`}>
              {hoveredPromo ? (
                <>
                  <strong className="catalog-detail-title">{hoveredPromo.code}</strong>
                  <span className="catalog-detail-meta">
                    Giảm {hoveredPromo.discount_type === 'PERCENT' ? `${hoveredPromo.value}%` : formatCompactVND(hoveredPromo.value)} • Còn {hoveredPromo.remaining} lượt ({hoveredPromo.usageRate}%)
                  </span>
                </>
              ) : (
                <span className="catalog-detail-hint">Rê chuột vào cột voucher để xem mức giảm và hạn mức còn lại</span>
              )}
            </div>

            <svg
              viewBox={`0 0 ${promoSvgW} ${promoSvgH}`}
              className="promo-cols-svg"
              onMouseLeave={() => setHoverPromoIdx(null)}
            >
              {[0, 0.5, 1].map((ratio) => {
                const y = promoPad.top + promoPlotH * (1 - ratio)
                const tickVal = Math.round(promoScaleMax * ratio)
                return (
                  <g key={ratio}>
                    <line
                      x1={promoPad.left}
                      y1={y}
                      x2={promoPad.left + promoPlotW}
                      y2={y}
                      className="chart-grid-line"
                    />
                    <text x={promoPad.left - 8} y={y + 4} textAnchor="end" className="chart-axis-text">
                      {tickVal}
                    </text>
                  </g>
                )
              })}

              {topPromotions.map((promo, idx) => {
                const statusMeta = PROMO_STATUS_META[promo.status] || PROMO_STATUS_META.active
                const usedCount = Number(promo.usedCount) || 0
                const fillH = usedCount > 0 ? Math.max(8, (usedCount / promoScaleMax) * promoPlotH) : 0
                const colX = promoPad.left + promoColSlot * idx + (promoColSlot - promoColW) / 2
                const colCenterX = colX + promoColW / 2
                const baseBottom = promoPad.top + promoPlotH
                const yFill = baseBottom - fillH
                return (
                  <g
                    key={promo.id}
                    className="promo-svg-col-group"
                    onMouseEnter={() => setHoverPromoIdx(idx)}
                  >
                    <rect
                      x={promoPad.left + promoColSlot * idx}
                      y={promoPad.top}
                      width={promoColSlot}
                      height={promoPlotH}
                      fill={hoverPromoIdx === idx ? 'rgba(231, 178, 106, 0.06)' : 'transparent'}
                    />
                    {fillH > 0 ? (
                      <rect
                        x={colX}
                        y={yFill}
                        width={promoColW}
                        height={fillH}
                        rx={6}
                        fill={statusMeta.color}
                        style={{ opacity: hoverPromoIdx !== null && hoverPromoIdx !== idx ? 0.55 : 0.94 }}
                      />
                    ) : null}
                    <text
                      x={colCenterX}
                      y={usedCount > 0 ? yFill - 6 : baseBottom - 6}
                      textAnchor="middle"
                      className="promo-col-ratio"
                    >
                      {promo.usedCount}/{promo.quantity}
                    </text>
                  </g>
                )
              })}
            </svg>

            <div
              className="promo-cols-aligned-tags"
              style={{
                paddingLeft: `${(promoPad.left / promoSvgW) * 100}%`,
                paddingRight: `${(promoPad.right / promoSvgW) * 100}%`,
                gridTemplateColumns: `repeat(${topPromotions.length}, minmax(0, 1fr))`
              }}
            >
              {topPromotions.map((promo, idx) => {
                const statusMeta = PROMO_STATUS_META[promo.status] || PROMO_STATUS_META.active
                const valueLabel = promo.discount_type === 'PERCENT'
                  ? `-${promo.value}%`
                  : `-${formatCompactVND(promo.value)}`
                return (
                  <div
                    key={promo.id}
                    className={`promo-aligned-col-label ${hoverPromoIdx === idx ? 'active' : ''}`}
                    onMouseEnter={() => setHoverPromoIdx(idx)}
                    onMouseLeave={() => setHoverPromoIdx(null)}
                  >
                    <span className="promo-code-tag">{promo.code}</span>
                    <div className="promo-sub-meta">
                      <span className="promo-value-badge">{valueLabel}</span>
                      <span className={`promo-status-chip ${statusMeta.cls}`}>{statusMeta.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(AdminCatalogAnalyticsCharts)
