const VALID_TABS = new Set(['books', 'cart', 'wishlist', 'orders', 'checkout', 'admin', 'account'])
const VALID_ADMIN_TABS = new Set(['overview', 'books', 'categories', 'orders', 'promotions', 'users', 'reviews'])
const MAX_INT32 = 2147483647

function parsePositiveIntId(rawValue) {
  const str = String(rawValue ?? '').trim()
  if (!/^\d+$/.test(str)) return null
  const num = Number(str)
  return Number.isSafeInteger(num) && num > 0 && num <= MAX_INT32 ? num : null
}

export function isPaymentReturnUrl(pathname = '', search = '') {
  return String(search || '').includes('vnp_SecureHash') || String(pathname || '').includes('/payment/vnpay-return')
}

export function getAppBasePath(pathname = '/') {
  if (!pathname || !pathname.startsWith('/') || pathname.startsWith('//') || pathname.includes('/payment/vnpay-return')) {
    return '/'
  }
  return pathname
}

export function parseRouteFromSearch(search = '') {
  const params = new URLSearchParams(search || '')
  const rawTab = params.get('tab')
  const tab = VALID_TABS.has(rawTab) ? rawTab : 'books'
  const bookId = tab === 'books' ? parsePositiveIntId(params.get('bookId')) : null
  const rawAdminTab = params.get('adminTab')
  const adminTab = tab === 'admin' && VALID_ADMIN_TABS.has(rawAdminTab)
    ? rawAdminTab
    : 'overview'
  return { tab, bookId, adminTab }
}

export function sanitizeRoute(route, { isAdmin = false, hasUser = false, hasCheckoutItems = false } = {}) {
  const tab = VALID_TABS.has(route?.tab) ? route.tab : 'books'
  if (tab === 'admin' && !isAdmin) {
    return { tab: 'books', bookId: null, adminTab: 'overview' }
  }
  if (tab === 'orders' && !hasUser) {
    return { tab: 'account', bookId: null, adminTab: 'overview' }
  }
  if (tab === 'checkout' && !hasCheckoutItems) {
    return { tab: 'cart', bookId: null, adminTab: 'overview' }
  }
  if (tab === 'books') {
    return { tab: 'books', bookId: parsePositiveIntId(route?.bookId), adminTab: 'overview' }
  }
  if (tab === 'admin') {
    const adminTab = VALID_ADMIN_TABS.has(route?.adminTab) ? route.adminTab : 'overview'
    return { tab: 'admin', bookId: null, adminTab }
  }
  return { tab, bookId: null, adminTab: 'overview' }
}

export function buildRouteUrl(route, pathname = '/') {
  const basePath = getAppBasePath(pathname)
  if (!route || (route.tab === 'books' && !route.bookId)) {
    return basePath
  }
  const params = new URLSearchParams()
  params.set('tab', route.tab)
  if (route.tab === 'books' && route.bookId) {
    params.set('bookId', String(route.bookId))
  }
  if (route.tab === 'admin') {
    params.set('adminTab', VALID_ADMIN_TABS.has(route.adminTab) ? route.adminTab : 'overview')
  }
  return `${basePath}?${params.toString()}`
}

export function syncBrowserUrl(route, { replace = false } = {}) {
  if (typeof window === 'undefined' || !window.history) return
  try {
    const nextUrl = buildRouteUrl(route, window.location.pathname)
    const currentUrl = `${window.location.pathname}${window.location.search}`
    if (nextUrl === currentUrl) return
    window.history[replace ? 'replaceState' : 'pushState'](route, document.title, nextUrl)
  } catch {
    return
  }
}
