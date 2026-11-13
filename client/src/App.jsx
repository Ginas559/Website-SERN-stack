import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import debounce from 'lodash.debounce'
import './App.css'
import './components/BooksPage.css'
import BookList from './components/BookList'
import BookDetail from './components/BookDetail'
import AdminDashboard from './components/AdminDashboard'
import CartPage from './components/CartPage'
import WishlistPage from './components/WishlistPage'
import CheckoutPage from './components/CheckoutPage'
import PaymentResult from './components/PaymentResult'
import OrderHistoryPage from './components/OrderHistoryPage'
import UserProfile from './components/UserProfile'
import { fetchBooks, fetchBookById, invalidateBooks } from './store/slices/bookSlice'
import { fetchPublicCategories } from './store/slices/categorySlice'
import { fetchCart, syncGuestCart, clearCartState, invalidateCart } from './store/slices/cartSlice'
import { fetchWishlist, syncGuestWishlist, clearWishlistState } from './store/slices/wishlistSlice'
import { parseRouteFromSearch, sanitizeRoute, syncBrowserUrl, isPaymentReturnUrl } from './utils/navigationHistory'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const MAX_PRICE_FILTER = 2147483647
const DEFAULT_BOOK_FILTERS = { search: '', categoryId: '', minPrice: '', maxPrice: '', sort: 'newest' }
const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('resetToken') || ''
if (resetToken) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)
const hasInitialPaymentReturn = typeof window !== 'undefined' && isPaymentReturnUrl(window.location.pathname, window.location.search)

function createEmptyAuthForm(token = '') {
  return {
    username: '',
    fullName: '',
    email: '',
    phone: '',
    address: '',
    password: '',
    confirmPassword: '',
    currentPassword: '',
    newPassword: '',
    token,
  }
}

function readStoredUser() {
  try {
    if (!localStorage.getItem('accessToken')) return null
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    return null
  }
}

function isUserAdmin(userObj) {
  return Boolean(userObj && (userObj.isAdmin || userObj.role === 'Admin' || userObj.role === 'admin'))
}

function getInitialRoute(storedUser) {
  if (hasInitialPaymentReturn) {
    return { tab: 'books', bookId: null, adminTab: 'overview' }
  }
  const parsed = parseRouteFromSearch(window.location.search)
  if (resetToken && !new URLSearchParams(window.location.search).get('tab')) {
    parsed.tab = 'account'
  }
  return sanitizeRoute(parsed, {
    isAdmin: isUserAdmin(storedUser),
    hasUser: Boolean(storedUser),
    hasCheckoutItems: false,
  })
}

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) }
  const accessToken = localStorage.getItem('accessToken')
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: 'include' })
  const data = response.status === 204 ? null : await response.json()
  if (!response.ok) throw new Error(data?.message || 'Đã xảy ra lỗi.')
  return data
}

function App() {
  const dispatch = useDispatch()
  const {
    books,
    total,
    totalPages,
    priceRange,
    selectedBook,
    booksQueryKey,
    booksNeedsReload,
    selectedBookAttemptedId,
    selectedBookNeedsReload,
    loading: booksLoading,
    error: bookError,
  } = useSelector((state) => state.books)
  const { publicCategories, publicFetchStatus } = useSelector((state) => state.categories)

  const [user, setUser] = useState(() => readStoredUser())
  const [initialRoute] = useState(() => getInitialRoute(readStoredUser()))
  const [activeTab, setActiveTab] = useState(initialRoute.tab)
  const [page, setPage] = useState(1)
  const [filters, setFilters] = useState(DEFAULT_BOOK_FILTERS)
  const [queryFilters, setQueryFilters] = useState(DEFAULT_BOOK_FILTERS)
  const [selectedBookId, setSelectedBookId] = useState(initialRoute.bookId)
  const [adminTab, setAdminTab] = useState(initialRoute.adminTab)
  const [bookViewOptions, setBookViewOptions] = useState(null)
  const [checkoutData, setCheckoutData] = useState({ items: [], total: 0 })
  const [isPaymentReturn, setIsPaymentReturn] = useState(hasInitialPaymentReturn)
  const completedCheckoutRef = useRef(false)
  const cartState = useSelector((state) => state.cart)
  const wishlistState = useSelector((state) => state.wishlist)
  const isAdmin = isUserAdmin(user)

  const [mode, setMode] = useState(resetToken ? 'reset' : 'login')
  const [form, setForm] = useState(() => createEmptyAuthForm(resetToken))
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const applyRouteState = useCallback((route, viewOptions = null) => {
    setActiveTab(route.tab)
    setSelectedBookId(route.bookId)
    setAdminTab(route.adminTab)
    setBookViewOptions(viewOptions)
  }, [])

  const clearAuthenticatedSession = useCallback(() => {
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setUser(null)
    setCheckoutData({ items: [], total: 0 })
    completedCheckoutRef.current = false
    setForm(createEmptyAuthForm())
    dispatch(clearCartState())
    dispatch(clearWishlistState())
  }, [dispatch])

  const navigateTo = useCallback((nextRoute, options = {}) => {
    const {
      replace = false,
      viewOptions = null,
      allowCheckout = false,
    } = options
    const leavingCompletedCheckout = activeTab === 'checkout' && completedCheckoutRef.current && nextRoute?.tab !== 'checkout'
    if (leavingCompletedCheckout) {
      completedCheckoutRef.current = false
      setCheckoutData({ items: [], total: 0 })
    }
    const leavingPaymentReturn = isPaymentReturn
    if (leavingPaymentReturn) {
      setIsPaymentReturn(false)
    }
    const liveUser = readStoredUser()
    if (!liveUser && user) {
      clearAuthenticatedSession()
    }
    const effectiveUser = liveUser || null
    const authorized = sanitizeRoute(nextRoute, {
      isAdmin: isUserAdmin(effectiveUser),
      hasUser: Boolean(effectiveUser),
      hasCheckoutItems: allowCheckout || checkoutData.items.length > 0,
    })
    applyRouteState(authorized, viewOptions)
    syncBrowserUrl(authorized, { replace: replace || leavingCompletedCheckout || leavingPaymentReturn })
  }, [activeTab, user, checkoutData.items.length, isPaymentReturn, applyRouteState, clearAuthenticatedSession])

  const handleSelectBook = useCallback((id, options = null) => {
    navigateTo({ tab: 'books', bookId: Number(id) }, { viewOptions: options })
  }, [navigateTo])

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const changeMode = (nextMode) => {
    setMode(nextMode)
    setMessage('')
    setError('')
  }

  const debouncedApplyFilters = useMemo(
    () => debounce((nextFilters) => {
      setQueryFilters(nextFilters)
      setPage(1)
    }, 350),
    []
  )

  useEffect(() => {
    return () => {
      debouncedApplyFilters.cancel()
    }
  }, [debouncedApplyFilters])

  const handleFilterChange = useCallback((nextFilters, { immediate = false } = {}) => {
    setFilters(nextFilters)
    if (immediate) {
      debouncedApplyFilters.cancel()
      setQueryFilters(nextFilters)
      setPage(1)
      return
    }
    debouncedApplyFilters(nextFilters)
  }, [debouncedApplyFilters])

  const handleResetFilters = useCallback(() => {
    debouncedApplyFilters.cancel()
    setFilters({ ...DEFAULT_BOOK_FILTERS })
    setQueryFilters({ ...DEFAULT_BOOK_FILTERS })
    setPage(1)
  }, [debouncedApplyFilters])

  const loadBooks = useCallback(() => {
    if (activeTab !== 'books' || selectedBookId) return
    const trimmedSearch = typeof queryFilters.search === 'string' ? queryFilters.search.trim() : ''
    const hasMin = queryFilters.minPrice !== '' && queryFilters.minPrice !== null && queryFilters.minPrice !== undefined
    const hasMax = queryFilters.maxPrice !== '' && queryFilters.maxPrice !== null && queryFilters.maxPrice !== undefined
    const minVal = hasMin ? Number(queryFilters.minPrice) : null
    const maxVal = hasMax ? Number(queryFilters.maxPrice) : null
    if (
      (hasMin && (!Number.isInteger(minVal) || minVal < 0 || minVal > MAX_PRICE_FILTER)) ||
      (hasMax && (!Number.isInteger(maxVal) || maxVal < 0 || maxVal > MAX_PRICE_FILTER)) ||
      (minVal !== null && maxVal !== null && minVal > maxVal)
    ) {
      return
    }
    const query = {
      page,
      limit: 8,
      ...(trimmedSearch ? { search: trimmedSearch } : {}),
      ...(queryFilters.categoryId ? { categoryId: queryFilters.categoryId } : {}),
      ...(hasMin ? { minPrice: minVal } : {}),
      ...(hasMax ? { maxPrice: maxVal } : {}),
      ...(queryFilters.sort ? { sort: queryFilters.sort } : {}),
    }
    const queryKey = JSON.stringify(query)
    if (!booksNeedsReload && booksQueryKey === queryKey) {
      return
    }
    dispatch(fetchBooks(query))
  }, [activeTab, page, queryFilters, selectedBookId, booksQueryKey, booksNeedsReload, dispatch])

  useEffect(() => {
    loadBooks()
  }, [loadBooks])

  useEffect(() => {
    if (activeTab === 'books' && !selectedBookId && publicFetchStatus === 'idle') {
      dispatch(fetchPublicCategories())
    }
  }, [activeTab, selectedBookId, publicFetchStatus, dispatch])

  useEffect(() => {
    if (!selectedBookId) return
    if (!selectedBookNeedsReload && Number(selectedBookAttemptedId) === Number(selectedBookId)) {
      return
    }
    dispatch(fetchBookById(selectedBookId))
  }, [selectedBookId, selectedBookAttemptedId, selectedBookNeedsReload, dispatch])

  useEffect(() => {
    if (isPaymentReturn) return
    syncBrowserUrl(initialRoute, { replace: true })
  }, [isPaymentReturn, initialRoute])

  useEffect(() => {
    const handlePopState = () => {
      if (isPaymentReturnUrl(window.location.pathname, window.location.search)) {
        setIsPaymentReturn(true)
        return
      }
      if (isPaymentReturn) {
        setIsPaymentReturn(false)
      }
      const hadCompletedCheckout = completedCheckoutRef.current
      if (hadCompletedCheckout) {
        completedCheckoutRef.current = false
        setCheckoutData({ items: [], total: 0 })
      }
      const liveUser = readStoredUser()
      if (!liveUser && user) {
        clearAuthenticatedSession()
      } else if (liveUser && liveUser.id !== user?.id) {
        setUser(liveUser)
      }
      const parsed = parseRouteFromSearch(window.location.search)
      const authorized = sanitizeRoute(parsed, {
        isAdmin: isUserAdmin(liveUser),
        hasUser: Boolean(liveUser),
        hasCheckoutItems: hadCompletedCheckout ? false : checkoutData.items.length > 0,
      })
      applyRouteState(authorized)
      if (
        authorized.tab !== parsed.tab ||
        authorized.bookId !== parsed.bookId ||
        authorized.adminTab !== parsed.adminTab
      ) {
        syncBrowserUrl(authorized, { replace: true })
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [isPaymentReturn, user, checkoutData.items.length, applyRouteState, clearAuthenticatedSession])

  useEffect(() => {
    const handleStorageSync = (event) => {
      if (event.key !== null && event.key !== 'accessToken' && event.key !== 'user') return
      const liveUser = readStoredUser()
      if (!liveUser || liveUser.id !== user?.id) {
        if (!liveUser) {
          clearAuthenticatedSession()
        } else {
          setUser(liveUser)
          setCheckoutData({ items: [], total: 0 })
          completedCheckoutRef.current = false
          dispatch(fetchCart())
          dispatch(fetchWishlist())
        }
        const sanitized = sanitizeRoute({ tab: activeTab, bookId: selectedBookId, adminTab }, {
          isAdmin: isUserAdmin(liveUser),
          hasUser: Boolean(liveUser),
          hasCheckoutItems: false,
        })
        applyRouteState(sanitized)
        if (!isPaymentReturnUrl(window.location.pathname, window.location.search)) {
          syncBrowserUrl(sanitized, { replace: true })
        }
        if (!liveUser) setMode('login')
      }
    }

    window.addEventListener('storage', handleStorageSync)
    return () => {
      window.removeEventListener('storage', handleStorageSync)
    }
  }, [activeTab, selectedBookId, adminTab, user, dispatch, applyRouteState, clearAuthenticatedSession])

  useEffect(() => {
    if (localStorage.getItem('accessToken')) {
      dispatch(fetchCart())
      dispatch(fetchWishlist())
    }
  }, [dispatch])

  const forceToLoginWithError = useCallback((errorMsg) => {
    clearAuthenticatedSession()
    const nextRoute = { tab: 'account', bookId: null, adminTab: 'overview' }
    applyRouteState(nextRoute)
    syncBrowserUrl(nextRoute, { replace: true })
    setMode('login')
    setError(errorMsg)
  }, [applyRouteState, clearAuthenticatedSession])

  useEffect(() => {
    const handleAccountBlocked = (event) => {
      const blockMsg = event?.detail?.message || 'Tài khoản của bạn đã bị khóa bởi Quản trị viên.'
      forceToLoginWithError(blockMsg)
    }

    const handleSessionExpired = (event) => {
      const expiredMsg = event?.detail?.message || 'Phiên đăng nhập đã hết hạn hoặc không hợp lệ. Vui lòng đăng nhập lại.'
      forceToLoginWithError(expiredMsg)
    }

    const handleSessionRefreshed = (event) => {
      if (event?.detail?.user) {
        setUser(event.detail.user)
      }
    }

    window.addEventListener('sern:account-blocked', handleAccountBlocked)
    window.addEventListener('sern:session-expired', handleSessionExpired)
    window.addEventListener('sern:session-refreshed', handleSessionRefreshed)
    return () => {
      window.removeEventListener('sern:account-blocked', handleAccountBlocked)
      window.removeEventListener('sern:session-expired', handleSessionExpired)
      window.removeEventListener('sern:session-refreshed', handleSessionRefreshed)
    }
  }, [forceToLoginWithError])

  async function submit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    setLoading(true)
    try {
      const path = mode === 'register' ? '/auth/register'
        : mode === 'forgot' ? '/auth/forgot-password'
          : mode === 'reset' ? '/auth/reset-password'
            : mode === 'change' ? '/auth/change-password' : '/auth/login'
      const payload = mode === 'register'
        ? { username: form.username, fullName: form.fullName, email: form.email, phone: form.phone, address: form.address, password: form.password, confirmPassword: form.confirmPassword }
        : mode === 'forgot'
          ? { email: form.email }
          : mode === 'reset'
            ? { token: form.token, password: form.password, confirmPassword: form.confirmPassword }
            : mode === 'change'
              ? { currentPassword: form.currentPassword, newPassword: form.newPassword, confirmPassword: form.confirmPassword }
              : { email: form.email, password: form.password }
      const data = await request(path, { method: 'POST', body: JSON.stringify(payload) })
      if (mode === 'forgot') {
        setMessage(data.message)
      } else if (mode === 'reset' || mode === 'change') {
        localStorage.removeItem('accessToken')
        localStorage.removeItem('user')
        setUser(null)
        setMode('login')
        setForm({ ...form, password: '', confirmPassword: '', currentPassword: '', newPassword: '', token: '' })
        if (mode === 'reset') syncBrowserUrl({ tab: 'account', bookId: null, adminTab: 'overview' }, { replace: true })
        setMessage(data.message)
      } else if (mode === 'register') {
        setMode('login')
        setForm({ ...form, password: '', confirmPassword: '' })
        setMessage(data.message || 'Đăng ký thành công.')
      } else {
        setUser(data.user)
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.user))
        setForm(createEmptyAuthForm())
        dispatch(syncGuestCart())
        dispatch(syncGuestWishlist())
        setMessage('Đăng nhập thành công.')
      }
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setLoading(false)
    }
  }

  function logout() {
    request('/auth/logout', { method: 'POST' }).catch(() => {})
    clearAuthenticatedSession()
    const nextRoute = { tab: 'books', bookId: null, adminTab: 'overview' }
    applyRouteState(nextRoute)
    syncBrowserUrl(nextRoute, { replace: false })
    setMessage('Bạn đã đăng xuất.')
  }

  const handleProfileUpdated = useCallback((updated) => {
    setUser(updated)
  }, [])

  const guestCartCount = (() => {
    try {
      const g = JSON.parse(localStorage.getItem('guestCart') || '[]')
      return Array.isArray(g) ? g.reduce((sum, it) => sum + (Number(it.quantity) || 1), 0) : 0
    } catch {
      return 0
    }
  })()

  const guestWishlistCount = (() => {
    try {
      const g = JSON.parse(localStorage.getItem('guestWishlist') || '[]')
      return Array.isArray(g) ? g.length : 0
    } catch {
      return 0
    }
  })()

  const cartBadgeCount = user ? (cartState.totalQuantity || cartState.items.length) : guestCartCount
  const wishlistBadgeCount = user ? (wishlistState.totalItems || wishlistState.items.length) : guestWishlistCount

  return (
    <div>
      <header className="app-navbar">
        <div 
          className="app-brand" 
          onClick={() => navigateTo({ tab: 'books', bookId: null })}
        >
          SERN BOOKSTORE
        </div>
        <nav className="app-nav-links">
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => navigateTo({ tab: 'books', bookId: null })}
          >
            Cửa hàng sách
          </button>
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'cart' ? 'active' : ''}`}
            onClick={() => navigateTo({ tab: 'cart' })}
          >
            🛒 Giỏ hàng {cartBadgeCount > 0 ? `(${cartBadgeCount})` : ''}
          </button>
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'wishlist' ? 'active' : ''}`}
            onClick={() => navigateTo({ tab: 'wishlist' })}
          >
            ❤️ Yêu thích {wishlistBadgeCount > 0 ? `(${wishlistBadgeCount})` : ''}
          </button>
          {user && (
            <button 
              type="button" 
              className={`nav-btn ${activeTab === 'orders' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'orders' })}
            >
              📦 Đơn mua
            </button>
          )}
          {isAdmin && (
            <button 
              type="button" 
              className={`nav-btn ${activeTab === 'admin' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'admin', adminTab: 'overview' })}
            >
              Quản trị
            </button>
          )}
          <button 
            type="button" 
            className={`nav-btn nav-btn-account ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => navigateTo({ tab: 'account' })}
          >
            👤 {user?.fullName || user?.username || 'Tài khoản'}
          </button>
        </nav>
      </header>

      {isPaymentReturn ? (
        <PaymentResult 
          searchString={window.location.search}
          onViewOrders={() => {
            dispatch(invalidateCart())
            dispatch(invalidateBooks())
            navigateTo({ tab: 'orders' }, { replace: true })
          }}
          onContinueShopping={() => {
            dispatch(invalidateCart())
            dispatch(invalidateBooks())
            navigateTo({ tab: 'books', bookId: null }, { replace: true })
          }}
        />
      ) : activeTab === 'admin' && isAdmin ? (
        <AdminDashboard
          activeAdminTab={adminTab}
          onAdminTabChange={(nextAdminTab) => navigateTo({ tab: 'admin', adminTab: nextAdminTab })}
        />
      ) : activeTab === 'checkout' ? (
        <CheckoutPage 
          checkoutItems={checkoutData.items}
          currentUser={user}
          onBackToCart={() => navigateTo({ tab: 'cart' })}
          onContinueShopping={() => navigateTo({ tab: 'books', bookId: null })}
          onViewOrders={() => navigateTo({ tab: 'orders' })}
          onOrderCompleted={() => {
            completedCheckoutRef.current = true
            dispatch(clearCartState())
            dispatch(invalidateBooks())
            try {
              localStorage.removeItem('guestCart')
            } catch {
              return
            }
          }}
        />
      ) : activeTab === 'orders' ? (
        <OrderHistoryPage 
          onContinueShopping={() => navigateTo({ tab: 'books', bookId: null })}
          onGoToCart={() => navigateTo({ tab: 'cart' })}
          onSelectBook={handleSelectBook}
        />
      ) : activeTab === 'cart' ? (
        <CartPage 
          onContinueShopping={() => navigateTo({ tab: 'books', bookId: null })} 
          onCheckout={(items, total) => {
            completedCheckoutRef.current = false
            setCheckoutData({ items, total })
            navigateTo({ tab: 'checkout' }, { allowCheckout: items.length > 0 })
          }}
        />
      ) : activeTab === 'wishlist' ? (
        <WishlistPage 
          onContinueShopping={() => navigateTo({ tab: 'books', bookId: null })} 
          onSelectBook={handleSelectBook}
        />
      ) : activeTab === 'books' ? (
        selectedBookId ? (
          selectedBook && Number(selectedBook.id) === Number(selectedBookId) ? (
            <BookDetail 
              book={selectedBook} 
              onBack={() => navigateTo({ tab: 'books', bookId: null })} 
              onSelectBook={handleSelectBook}
              currentUser={user}
              onRequireLogin={() => { navigateTo({ tab: 'account' }); setMode('login'); }}
              initialReviewTab={bookViewOptions?.tab}
              scrollToReviews={Boolean(bookViewOptions?.scrollToReviews || bookViewOptions?.scrollToDiscussions || bookViewOptions?.scrollToOwnReview)}
              scrollToOwnReview={Boolean(bookViewOptions?.scrollToOwnReview)}
            />
          ) : (
            <div className="books-page">
              <div className="empty-state">
                {booksLoading ? (
                  <>
                    <h3>Đang tải chi tiết sách...</h3>
                    <p>Vui lòng chờ trong giây lát.</p>
                  </>
                ) : (
                  <>
                    <h3>Không tìm thấy thông tin sách</h3>
                    <p>{bookError || 'Ấn phẩm không tồn tại hoặc đã ngừng phát hành.'}</p>
                    <button
                      type="button"
                      className="btn-reset"
                      style={{ marginTop: 16 }}
                      onClick={() => navigateTo({ tab: 'books', bookId: null })}
                    >
                      Quay lại cửa hàng sách
                    </button>
                  </>
                )}
              </div>
            </div>
          )
        ) : (
          <BookList 
            books={books}
            total={total}
            page={page}
            totalPages={totalPages}
            categories={publicCategories}
            priceRange={priceRange}
            filters={filters}
            error={bookError}
            loading={booksLoading}
            onFilterChange={handleFilterChange}
            onPageChange={(nextPage) => setPage(nextPage)}
            onResetFilters={handleResetFilters}
            onSelectBook={handleSelectBook}
          />
        )
      ) : user ? (
        <UserProfile 
          user={user} 
          onLogout={logout} 
          onProfileUpdated={handleProfileUpdated} 
        />
      ) : (
        <main className="page">
          <section className="intro">
            <span className="eyebrow">SERN BOOKSTORE</span>
            <h1>Mở cánh cửa<br /><em>tri thức.</em></h1>
            <p>Hệ thống bán sách trực tuyến sử dụng SQL Server, Express, React và Node.js.</p>
          </section>
          <section className="card auth-card">
            <div className="tabs">
              <button className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Đăng nhập</button>
              <button className={mode === 'register' ? 'active' : ''} onClick={() => changeMode('register')}>Đăng ký</button>
            </div>
            <h2>{mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Quên mật khẩu' : mode === 'reset' ? 'Đặt lại mật khẩu' : 'Chào mừng trở lại'}</h2>
            <p className="muted">{mode === 'login' ? 'Đăng nhập để tiếp tục mua sắm.' : 'Nhập thông tin để tiếp tục.'}</p>
            <form onSubmit={submit}>
              {mode === 'register' && <label>Họ và tên<input name="fullName" value={form.fullName} onChange={update} required minLength="2" /></label>}
              {mode === 'register' && <label>Username<input name="username" value={form.username} onChange={update} required minLength="3" /></label>}
              {mode === 'register' && <label>Số điện thoại<input name="phone" value={form.phone} onChange={update} required /></label>}
              {mode === 'register' && <label>Địa chỉ<input name="address" value={form.address} onChange={update} required minLength="2" /></label>}
              {mode === 'reset' && !resetToken && <label>Mã đặt lại mật khẩu<input name="token" value={form.token} onChange={update} required autoComplete="off" /></label>}
              {mode !== 'reset' && <label>Email<input type="email" name="email" value={form.email} onChange={update} required /></label>}
              {mode !== 'forgot' && <label>Mật khẩu<input type="password" name="password" value={form.password} onChange={update} required minLength="8" /></label>}
              {(mode === 'register' || mode === 'reset') && <label>Xác nhận mật khẩu<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength="8" /></label>}
              <button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : mode === 'register' ? 'Tạo tài khoản' : mode === 'forgot' ? 'Gửi yêu cầu' : mode === 'reset' ? 'Đổi mật khẩu' : 'Đăng nhập'}</button>
            </form>
            {mode === 'login' && <button className="link" onClick={() => changeMode('forgot')}>Quên mật khẩu?</button>}
            {(mode === 'forgot' || mode === 'reset') && <button className="link" onClick={() => changeMode('login')}>Quay lại đăng nhập</button>}
            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </section>
        </main>
      )}
    </div>
  )
}

export default App
