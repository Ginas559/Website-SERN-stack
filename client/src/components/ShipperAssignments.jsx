import { useCallback, useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import shipperService from '../services/shipperService'
import { MaterialCommunityIcon } from './common/Icons'
import './ShipperAssignments.css'
import 'leaflet/dist/leaflet.css'

const SHOP_ADDRESS = 'Số 1 Võ Văn Ngân, Phường Linh Chiểu, Thành phố Thủ Đức, Hồ Chí Minh'
const SHOP_COORDINATES = [10.8496, 106.7721]
const AREA_FALLBACKS = [
  { keywords: ['long trường', 'quận 9'], point: [10.8028, 106.8298], label: 'Khu vực Phường Long Trường, Thành phố Thủ Đức' },
  { keywords: ['bình thạnh'], point: [10.8015, 106.7108], label: 'Khu vực Quận Bình Thạnh, Thành phố Hồ Chí Minh' },
  { keywords: ['quận 1,'], point: [10.7769, 106.7009], label: 'Khu vực Quận 1, Thành phố Hồ Chí Minh' },
  { keywords: ['tăng nhơn phú'], point: [10.8418, 106.7896], label: 'Khu vực Phường Tăng Nhơn Phú, Thành phố Thủ Đức' },
  { keywords: ['phước long b'], point: [10.8171, 106.7795], label: 'Khu vực Phường Phước Long B, Thành phố Thủ Đức' },
]

function normalizeAddress(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bso\s+/g, '')
    .replace(/[.,]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const statusLabels = {
  ASSIGNED: 'Chờ nhận',
  ACCEPTED: 'Đang giao',
  REJECTED: 'Đã từ chối',
  COMPLETED: 'Đã hoàn tất',
  CANCELLED: 'Đã hủy',
}

const statusFilters = [
  { value: '', label: 'Tất cả' },
  { value: 'ASSIGNED', label: 'Chờ nhận' },
  { value: 'ACCEPTED', label: 'Đang giao' },
  { value: 'COMPLETED', label: 'Đã hoàn tất' },
  { value: 'REJECTED', label: 'Đã từ chối' },
  { value: 'CANCELLED', label: 'Đã hủy' },
]

const statusIcons = {
  ASSIGNED: 'package-variant-closed',
  ACCEPTED: 'truck-delivery',
  COMPLETED: 'package-variant-closed',
  REJECTED: 'close-circle-outline',
  CANCELLED: 'close-circle-outline',
}

const infoIcons = {
  assignment: 'tag',
  receiver: 'account',
  phone: 'phone',
  address: 'map-marker',
  total: 'cash',
  payment: 'credit-card-outline',
  order: 'package-variant-closed',
  time: 'clock-outline',
}

const ASSIGNMENTS_CACHE_KEY = 'sern:shipper-assignments-cache'

function readAssignmentsCache(cacheKey) {
    try {
        const cache = JSON.parse(window.sessionStorage.getItem(ASSIGNMENTS_CACHE_KEY) || '{}')
        const entry = cache[cacheKey]
        if (!entry || !entry.cachedAt || Date.now() - entry.cachedAt > 30000) return null
        return entry
  } catch {
    return null
  }
}

function writeAssignmentsCache(cacheKey, value) {
  try {
    const cache = JSON.parse(window.sessionStorage.getItem(ASSIGNMENTS_CACHE_KEY) || '{}')
    const now = Date.now()
    const validEntries = Object.entries(cache)
      .filter(([, entry]) => entry?.cachedAt && now - entry.cachedAt <= 30000)
      .sort(([, first], [, second]) => first.cachedAt - second.cachedAt)
      .slice(-9)
      .reduce((entries, [key, entry]) => ({ ...entries, [key]: entry }), {})
    window.sessionStorage.setItem(ASSIGNMENTS_CACHE_KEY, JSON.stringify({ ...validEntries, [cacheKey]: value }))
  } catch {
    return undefined
  }
  return undefined
}

function formatDate(value) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatCurrency(value) {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value) || 0)
}

export default function ShipperAssignments() {
  const [status, setStatus] = useState('')
  const [search, setSearch] = useState('')
  const [assignments, setAssignments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionError, setActionError] = useState('')
  const [busyId, setBusyId] = useState('')
  const [rejectTarget, setRejectTarget] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [completeTarget, setCompleteTarget] = useState(null)
  const [mapTarget, setMapTarget] = useState(null)
  const mapContainerRef = useRef(null)
  const mapPanelRef = useRef(null)
  const routeLayerRef = useRef(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapError, setMapError] = useState('')
  const [routeSummary, setRouteSummary] = useState(null)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [codCollected, setCodCollected] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const requestSequence = useRef(0)
  const firstLoad = useRef(true)
  const cacheUserKey = (() => {
    try {
      return JSON.parse(window.localStorage.getItem('user') || 'null')?.id || 'anonymous'
    } catch {
      return 'anonymous'
    }
  })()

  const loadAssignments = useCallback(async () => {
    const requestId = requestSequence.current + 1
    requestSequence.current = requestId
    const cacheKey = `${cacheUserKey}:${status || 'all'}:${search.trim() || 'all'}:${page}`
    const cached = !firstLoad.current ? null : readAssignmentsCache(cacheKey)
    if (cached) {
      setAssignments(cached.assignments)
      setTotalPages(cached.totalPages)
      firstLoad.current = false
      setLoading(false)
      return
    }
    if (firstLoad.current) setLoading(true)
    setError('')
    try {
      const response = await shipperService.getAssignments({ ...(status ? { status } : {}), ...(search.trim() ? { search: search.trim() } : {}), page, limit: 20 })
      if (requestId !== requestSequence.current) return
      setAssignments(response?.data?.assignments || [])
      setTotalPages(response?.data?.totalPages || 1)
      writeAssignmentsCache(cacheKey, {
        assignments: response?.data?.assignments || [],
        totalPages: response?.data?.totalPages || 1,
        cachedAt: Date.now(),
      })
    } catch (loadError) {
      if (requestId !== requestSequence.current) return
      setError(loadError.message || 'Không thể tải danh sách phân công.')
    } finally {
      if (requestId === requestSequence.current) {
        firstLoad.current = false
        setLoading(false)
      }
    }
  }, [cacheUserKey, status, search, page])

  useEffect(() => {
    const timer = window.setTimeout(loadAssignments, 120)
    return () => window.clearTimeout(timer)
  }, [loadAssignments])

  useEffect(() => {
    if (!mapTarget || !mapContainerRef.current) return undefined
    let cancelled = false
    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      scrollWheelZoom: false,
    }).setView(SHOP_COORDINATES, 13)
    const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
      updateWhenIdle: true,
      keepBuffer: 1,
      updateWhenZooming: false,
    }).addTo(map)
    const refreshMapSize = () => {
      map.invalidateSize()
      mapPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
    const resizeTimers = [120, 500, 1000].map((delay) => window.setTimeout(refreshMapSize, delay))
    const resizeObserver = new ResizeObserver(refreshMapSize)
    resizeObserver.observe(mapContainerRef.current)
    const tileRetryTimers = new Set()
    const requestControllers = new Set()
    const handleTileError = (event) => {
      const tile = event.tile
      const retryCount = Number(tile.dataset.mapRetry || 0)
      if (retryCount >= 2) return
      tile.dataset.mapRetry = String(retryCount + 1)
      const timer = window.setTimeout(() => {
        tile.src = `${tile.src.split('?mapRetry=')[0]}?mapRetry=${retryCount + 1}`
        tileRetryTimers.delete(timer)
      }, 900 * (retryCount + 1))
      tileRetryTimers.add(timer)
    }
    tileLayer.on('tileerror', handleTileError)
    setMapLoading(true)
    setMapError('')
    setRouteSummary(null)

    const fetchJson = async (url, message) => {
      const controller = new AbortController()
      requestControllers.add(controller)
      const timeout = window.setTimeout(() => controller.abort(), 12000)
      try {
        const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error(message)
        return await response.json()
      } catch (error) {
        if (error.name === 'AbortError') throw new Error(`${message} Dịch vụ phản hồi quá lâu.`, { cause: error })
        if (error instanceof TypeError) throw new Error(`${message} Kiểm tra kết nối mạng hoặc máy chủ miễn phí.`, { cause: error })
        throw error
      } finally {
        window.clearTimeout(timeout)
        requestControllers.delete(controller)
      }
    }

    const shopMarker = L.marker(SHOP_COORDINATES).addTo(map).bindPopup(`Shop BookStore HCMUTE<br>${SHOP_ADDRESS}`).openPopup()

    const geocode = async (address) => {
      const rawAddress = String(address || '').trim()
      if (normalizeAddress(rawAddress) === normalizeAddress(SHOP_ADDRESS)) {
        return {
          point: SHOP_COORDINATES,
          approximate: false,
          sameAsShop: true,
          matchedAddress: SHOP_ADDRESS,
        }
      }
      const normalizedAddress = rawAddress.toLowerCase()
      const areaFallback = AREA_FALLBACKS.find((item) => item.keywords.every((keyword) => normalizedAddress.includes(keyword)))
      if (areaFallback) {
        return {
          point: areaFallback.point,
          approximate: true,
          matchedAddress: areaFallback.label,
        }
      }
      const withoutHouseNumber = rawAddress
        .replace(/^số\s+\d+[a-z]?\s*/i, '')
        .replace(/^\d+[a-z]?\s+(?=[^,]+,)/i, '')
        .trim()
      const streetMatch = withoutHouseNumber.match(/^([^,]+)(?:,|$)/)
      const streetName = streetMatch?.[1]?.trim() || withoutHouseNumber
      const candidates = [...new Set([
        rawAddress,
        `${withoutHouseNumber}, Thành phố Hồ Chí Minh`,
        `${streetName}, Thành phố Hồ Chí Minh`,
        `${streetName}, Thủ Đức, Thành phố Hồ Chí Minh`,
      ].filter(Boolean))]

      for (const candidate of candidates) {
        if (cancelled) return null
        let results
        try {
          results = await fetchJson(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&addressdetails=1&q=${encodeURIComponent(candidate)}`, 'Không thể tìm địa chỉ giao hàng.')
        } catch {
          if (cancelled) return null
          continue
        }
        if (cancelled) return null
        if (results[0]) {
          return {
            point: [Number(results[0].lat), Number(results[0].lon)],
            approximate: candidate !== rawAddress,
            matchedAddress: results[0].display_name || candidate,
          }
        }
      }
      throw new Error(`Không tìm thấy vị trí giao hàng. Hãy kiểm tra lại địa chỉ: ${rawAddress}`)
    }

    geocode(mapTarget.address)
      .then(async (customerLocation) => {
        if (cancelled || !customerLocation) return
        const customerPoint = customerLocation.point
        const customerMarker = customerLocation.sameAsShop
          ? L.circleMarker(customerPoint, { radius: 9, color: '#ffffff', weight: 3, fillColor: '#e11d48', fillOpacity: 1 })
          : L.marker(customerPoint)
        customerMarker.addTo(map).bindPopup(`Địa chỉ khách: ${customerLocation.matchedAddress}`).openPopup()
        const markerBounds = L.featureGroup([shopMarker, customerMarker]).getBounds()
        if (customerLocation.sameAsShop) {
          map.setView(SHOP_COORDINATES, 16)
          setRouteSummary({ distance: '0.0', duration: 0, approximate: false, sameAsShop: true })
          return
        }
        map.fitBounds(markerBounds, { padding: [24, 24] })
        const routeUrl = `https://router.project-osrm.org/route/v1/driving/${SHOP_COORDINATES[1]},${SHOP_COORDINATES[0]};${customerPoint[1]},${customerPoint[0]}?overview=full&geometries=geojson`
        const routeData = await fetchJson(routeUrl, 'Không thể tính tuyến đường hiện tại.')
        const route = routeData.routes?.[0]
        if (!route) throw new Error('Không tìm thấy tuyến đường phù hợp.')
        if (cancelled) return
        routeLayerRef.current = L.geoJSON(route.geometry, { style: { color: '#008fa3', weight: 6, opacity: 0.85 } }).addTo(map)
        map.fitBounds(routeLayerRef.current.getBounds(), { padding: [24, 24] })
        setRouteSummary({
          distance: (route.distance / 1000).toFixed(1),
          duration: Math.max(1, Math.round(route.duration / 60)),
          approximate: customerLocation.approximate,
        })
      })
      .catch((routeError) => {
        if (!cancelled) {
          setMapError(routeError.message || 'Không thể hiển thị tuyến đường. Bản đồ vẫn hiển thị các điểm giao hàng.')
          setMapLoading(false)
        }
      })
      .finally(() => {
        if (!cancelled) setMapLoading(false)
      })

    return () => {
      cancelled = true
      requestControllers.forEach((controller) => controller.abort())
      requestControllers.clear()
      resizeTimers.forEach((timer) => window.clearTimeout(timer))
      resizeObserver.disconnect()
      tileRetryTimers.forEach((timer) => window.clearTimeout(timer))
      tileLayer.off('tileerror', handleTileError)
      tileLayer.off()
      routeLayerRef.current = null
      map.remove()
    }
  }, [mapTarget])

  const runAction = async (assignment, action, value = '') => {
    setBusyId(assignment.id)
    setActionError('')
    try {
      if (action === 'accept') await shipperService.acceptAssignment(assignment.id)
      if (action === 'reject') await shipperService.rejectAssignment(assignment.id, value)
      if (action === 'complete') await shipperService.completeAssignment(assignment.id, value, codCollected)
      setRejectTarget(null)
      setCompleteTarget(null)
      setReason('')
      setNote('')
      setCodCollected(false)
      window.sessionStorage.removeItem(ASSIGNMENTS_CACHE_KEY)
      await loadAssignments()
    } catch (actionRequestError) {
      setActionError(actionRequestError.message || 'Thao tác không thành công. Vui lòng tải lại danh sách.')
    } finally {
      setBusyId('')
    }
  }

  const requestAcceptConfirmation = (assignment) => {
    setActionError('')
    setMapTarget(null)
    setConfirmAction({ assignment, action: 'accept', value: '' })
  }

  const requestRejectConfirmation = (event) => {
    event.preventDefault()
    if (!rejectTarget) return
    setMapTarget(null)
    setConfirmAction({ assignment: rejectTarget, action: 'reject', value: reason })
    setRejectTarget(null)
  }

  const assignmentCounts = assignments.reduce((counts, assignment) => {
    counts[assignment.status] = (counts[assignment.status] || 0) + 1
    return counts
  }, {})

  return (
    <section className="shipper-page">
      <div className="shipper-page-header">
        <div>
          <p className="shipper-eyebrow">KHU VỰC GIAO HÀNG</p>
          <h1>Đơn được phân công</h1>
          <p className="shipper-subtitle">Xem và cập nhật các đơn giao nội thành được giao cho bạn.</p>
        </div>
        <button type="button" className="shipper-refresh-btn" onClick={loadAssignments} disabled={loading}><MaterialCommunityIcon name="refresh" size={17} />Tải lại</button>
      </div>

      <div className="shipper-summary" aria-label="Tổng quan đơn hàng">
        <div className="shipper-summary-item waiting"><MaterialCommunityIcon name="package-variant-closed" size={22} /><span><b>{assignmentCounts.ASSIGNED || 0}</b>Chờ nhận</span></div>
        <div className="shipper-summary-item delivering"><MaterialCommunityIcon name="truck-delivery" size={22} /><span><b>{assignmentCounts.ACCEPTED || 0}</b>Đang giao</span></div>
        <div className="shipper-summary-item done"><MaterialCommunityIcon name="check-circle-outline" size={22} /><span><b>{assignmentCounts.COMPLETED || 0}</b>Đã hoàn tất</span></div>
      </div>

      <div className="shipper-search-panel">
        <div className="shipper-search-field">
          <MaterialCommunityIcon name="magnify" size={21} />
          <input
            type="search"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); setMapTarget(null) }}
            placeholder="Tìm theo tên, số điện thoại, địa chỉ hoặc mã đơn..."
            aria-label="Tìm kiếm đơn giao hàng"
          />
          {search && <button type="button" className="shipper-search-clear" onClick={() => { setSearch(''); setPage(1) }} aria-label="Xóa từ khóa tìm kiếm">×</button>}
        </div>
        <span className="shipper-search-hint">Có thể kết hợp với bộ lọc trạng thái bên dưới.</span>
      </div>

      <div className="shipper-filter-row" role="tablist" aria-label="Lọc assignment">
        {statusFilters.map((filter) => (
          <button
            type="button"
            key={filter.value || 'all'}
            className={status === filter.value ? 'shipper-filter active' : 'shipper-filter'}
            onClick={() => { setStatus(filter.value); setPage(1) }}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {actionError && <div className="shipper-alert error">{actionError}</div>}
      {error && <div className="shipper-alert error">{error}</div>}
      {loading && <div className="shipper-empty">Đang tải danh sách phân công...</div>}
      {!loading && !error && assignments.length === 0 && <div className="shipper-empty">Chưa có đơn phù hợp.</div>}

      <div className="shipper-assignment-list">
        {!loading && assignments.map((assignment) => {
          const order = assignment.order || {}
          const shippingInfo = order.shippingInfo || {}
          const isBusy = busyId === assignment.id
          return (
            <article className="shipper-assignment-card" key={assignment.id}>
              <div className="shipper-card-topline">
                <div>
                  <span className="shipper-order-label"><MaterialCommunityIcon name={infoIcons.assignment} size={16} />Mã phân công</span>
                  <strong>{assignment.id}</strong>
                  <span className="shipper-order-id">Mã đơn: {assignment.orderId || '—'}</span>
                </div>
                <span className={`shipper-status status-${assignment.status.toLowerCase()}`}><MaterialCommunityIcon name={statusIcons[assignment.status]} size={16} />{statusLabels[assignment.status] || assignment.status}</span>
              </div>
              <div className="shipper-card-grid">
                <div className="shipper-info receiver"><span><MaterialCommunityIcon name={infoIcons.receiver} size={16} />Người nhận</span><strong>{shippingInfo.receiverName || '—'}</strong></div>
                <div className="shipper-info phone"><span><MaterialCommunityIcon name={infoIcons.phone} size={16} />Số điện thoại</span><strong>{shippingInfo.phone || '—'}</strong></div>
                <div className="shipper-info-address shipper-info address"><span><MaterialCommunityIcon name={infoIcons.address} size={16} />Địa chỉ giao hàng</span><strong>{shippingInfo.address || '—'}</strong></div>
                <div className="shipper-info total"><span><MaterialCommunityIcon name={infoIcons.total} size={16} />Tổng đơn</span><strong className="shipper-total">{formatCurrency(order.total)}</strong></div>
                <div className="shipper-info payment"><span><MaterialCommunityIcon name={infoIcons.payment} size={16} />Thanh toán</span><strong>{order.paymentMethod === 'VNPAY' ? 'VNPAY' : 'COD'}</strong></div>
                <div className="shipper-info order-status"><span><MaterialCommunityIcon name={infoIcons.order} size={16} />Trạng thái đơn</span><strong>{order.status === 1 ? 'Đã xác nhận' : order.status === 2 ? 'Đang giao' : order.status === 3 ? 'Đã giao' : order.status === 4 ? 'Đã hủy' : 'Chờ xử lý'}</strong></div>
                <div className="shipper-info assigned-time"><span><MaterialCommunityIcon name={infoIcons.time} size={16} />Phân công lúc</span><strong>{formatDate(assignment.assignedAt)}</strong></div>
              </div>
              {assignment.note && <p className="shipper-card-note"><b>Ghi chú:</b> {assignment.note}</p>}
              {assignment.rejectionReason && <p className="shipper-card-note"><b>Lý do từ chối:</b> {assignment.rejectionReason}</p>}
              {assignment.cancellationReason && <p className="shipper-card-note"><b>Lý do hủy:</b> {assignment.cancellationReason}</p>}
              {assignment.status === 'ASSIGNED' && assignment.isActive && (
                <div className="shipper-card-actions">
                  <button type="button" className="shipper-action secondary shipper-map-action" disabled={isBusy} onClick={() => setMapTarget({ assignmentId: assignment.id, address: shippingInfo.address, name: shippingInfo.receiverName })}><MaterialCommunityIcon name="map-marker" size={17} />Xem bản đồ</button>
                   <button type="button" className="shipper-action primary" disabled={isBusy} onClick={() => requestAcceptConfirmation(assignment)}><MaterialCommunityIcon name="check-circle-outline" size={17} />{isBusy ? 'Đang xử lý...' : 'Nhận đơn'}</button>
                   <button type="button" className="shipper-action secondary" disabled={isBusy} onClick={() => { setMapTarget(null); setRejectTarget(assignment); setActionError('') }}>Từ chối</button>
                </div>
              )}
              {assignment.status === 'ACCEPTED' && assignment.isActive && (
                <div className="shipper-card-actions">
                  <button type="button" className="shipper-action secondary shipper-map-action" onClick={() => setMapTarget({ assignmentId: assignment.id, address: shippingInfo.address, name: shippingInfo.receiverName })}><MaterialCommunityIcon name="map-marker" size={17} />Mở bản đồ</button>
                   <button type="button" className="shipper-action primary" disabled={isBusy} onClick={() => { setMapTarget(null); setCompleteTarget(assignment); setCodCollected(false); setActionError('') }}><MaterialCommunityIcon name="check-circle-outline" size={17} />Hoàn tất giao hàng</button>
                </div>
              )}
               {mapTarget?.assignmentId === assignment.id && (
                 <section ref={mapPanelRef} className="shipper-map-inline" aria-labelledby="shipper-map-title">
                   <div className="shipper-map-modal-header">
                     <div>
                       <span className="shipper-modal-kicker">ĐỊA CHỈ GIAO HÀNG</span>
                       <h2 id="shipper-map-title">{mapTarget.name || 'Vị trí giao hàng'}</h2>
                       <p>{mapTarget.address || 'Chưa có địa chỉ giao hàng.'}</p>
                     </div>
                     <button type="button" className="shipper-map-close" onClick={() => setMapTarget(null)} aria-label="Đóng bản đồ">×</button>
                  </div>
                  <div className="shipper-map-route-summary">
                    <div className="shipper-route-stat origin"><MaterialCommunityIcon name="store-marker-outline" size={20} /><span><small>Xuất phát</small><strong>BookStore HCMUTE</strong></span></div>
                    {routeSummary && <>
                      <div className="shipper-route-stat"><MaterialCommunityIcon name="map-marker-distance" size={20} /><span><small>Khoảng cách</small><strong>{routeSummary.distance} km</strong></span></div>
                      <div className="shipper-route-stat time"><MaterialCommunityIcon name="clock-outline" size={20} /><span><small>Thời gian dự kiến</small><strong>{routeSummary.duration} phút</strong></span></div>
                      {routeSummary.sameAsShop && <span className="shipper-route-badge">Cùng địa chỉ với Shop</span>}
                      {routeSummary.approximate && <span className="shipper-route-badge approximate">Vị trí gần đúng</span>}
                    </>}
                  </div>
                   {mapTarget.address ? <div ref={mapContainerRef} className="shipper-map-frame" aria-label="Bản đồ tuyến đường giao hàng" /> : <div className="shipper-map-empty">Đơn hàng chưa có địa chỉ để hiển thị bản đồ.</div>}
                   {mapLoading && <div className="shipper-map-status">Đang tìm địa chỉ và tính tuyến đường miễn phí...</div>}
                   {mapError && <div className="shipper-map-status error">{mapError}</div>}
                 </section>
               )}
             </article>
          )
        })}
      </div>
      {!loading && !error && totalPages > 1 && (
        <div className="shipper-pagination">
          <button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Trang trước</button>
          <span>Trang {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Trang sau</button>
        </div>
      )}

      {rejectTarget && (
        <div className="shipper-modal-backdrop" role="presentation" onClick={() => setRejectTarget(null)}>
            <form className="shipper-modal" onSubmit={requestRejectConfirmation} onClick={(event) => event.stopPropagation()}>
            <h2>Từ chối nhận đơn</h2><p>Vui lòng nhập lý do để Admin có thể phân công lại.</p>
            <textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} required placeholder="Nhập lý do từ chối" />
            <div className="shipper-modal-actions"><button type="button" onClick={() => setRejectTarget(null)}>Hủy</button><button type="submit" className="shipper-action primary" disabled={busyId === rejectTarget.id}>Xác nhận từ chối</button></div>
          </form>
        </div>
      )}
      {confirmAction && (
        <div className="shipper-modal-backdrop" role="presentation" onClick={() => setConfirmAction(null)}>
          <div className="shipper-modal" role="dialog" aria-modal="true" aria-labelledby="shipper-confirm-title" onClick={(event) => event.stopPropagation()}>
            <h2 id="shipper-confirm-title">{confirmAction.action === 'accept' ? 'Xác nhận nhận đơn' : 'Xác nhận từ chối đơn'}</h2>
            <p>
              {confirmAction.action === 'accept'
                ? 'Bạn có chắc muốn nhận đơn hàng này và bắt đầu xử lý giao hàng không?'
                : 'Bạn có chắc muốn từ chối đơn hàng này không? Lý do sẽ được gửi đến Admin để xem xét phân công lại.'}
            </p>
            {confirmAction.action === 'reject' && <p className="shipper-confirm-reason"><b>Lý do:</b> {confirmAction.value}</p>}
            <div className="shipper-modal-actions">
              <button type="button" onClick={() => setConfirmAction(null)}>Quay lại</button>
              <button type="button" className="shipper-action primary" disabled={busyId === confirmAction.assignment.id} onClick={() => { const { assignment, action, value } = confirmAction; setConfirmAction(null); runAction(assignment, action, value) }}>
                {confirmAction.action === 'accept' ? 'Xác nhận nhận đơn' : 'Xác nhận từ chối'}
              </button>
            </div>
          </div>
        </div>
      )}
      {completeTarget && (
        <div className="shipper-modal-backdrop" role="presentation" onClick={() => setCompleteTarget(null)}>
            <form className="shipper-modal" onSubmit={(event) => { event.preventDefault(); runAction(completeTarget, 'complete', note) }} onClick={(event) => event.stopPropagation()}>
            <h2>Hoàn tất giao hàng</h2><p>Có thể thêm ghi chú bàn giao nếu cần.</p>
            {completeTarget.order?.paymentMethod === 'COD' && <label className="shipper-cod-confirm"><input type="checkbox" checked={codCollected} onChange={(event) => setCodCollected(event.target.checked)} /> <span>Đã thu đủ {formatCurrency(completeTarget.order.total)} tiền COD từ khách</span></label>}
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={1000} placeholder="Ghi chú hoàn tất (không bắt buộc)" />
            <div className="shipper-modal-actions"><button type="button" onClick={() => setCompleteTarget(null)}>Hủy</button><button type="submit" className="shipper-action primary" disabled={busyId === completeTarget.id}>Xác nhận hoàn tất</button></div>
          </form>
        </div>
      )}
    </section>
  )
}
