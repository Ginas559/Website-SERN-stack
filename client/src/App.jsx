import { useState, useEffect } from 'react'
import './App.css'
import './components/BooksPage.css'
import BookList from './components/BookList'
import BookDetail from './components/BookDetail'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'
const resetToken = new URLSearchParams(window.location.hash.slice(1)).get('resetToken') || ''
if (resetToken) window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`)

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
  const [activeTab, setActiveTab] = useState('books')
  const [books, setBooks] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [filters, setFilters] = useState({ search: '', minPrice: '', maxPrice: '', sort: 'newest' })
  const [selectedBookId, setSelectedBookId] = useState(null)
  const [selectedBook, setSelectedBook] = useState(null)
  const [booksLoading, setBooksLoading] = useState(true)
  const [booksError, setBooksError] = useState('')
  const [booksRetry, setBooksRetry] = useState(0)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [detailRetry, setDetailRetry] = useState(0)

  const [mode, setMode] = useState(resetToken ? 'reset' : 'login')
  const [form, setForm] = useState({
    username: '', fullName: '', email: '', phone: '', address: '',
    password: '', confirmPassword: '', currentPassword: '', newPassword: '', token: resetToken,
  })
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('user') || 'null'))

  const update = (event) => setForm({ ...form, [event.target.name]: event.target.value })
  const changeMode = (nextMode) => {
    setMode(nextMode)
    setMessage('')
    setError('')
  }

  useEffect(() => {
    if (activeTab !== 'books' || selectedBookId) return
    const controller = new AbortController()
    const query = new URLSearchParams()
    query.set('page', String(page))
    query.set('limit', '8')
    if (filters.search) query.set('search', filters.search)
    if (filters.minPrice) query.set('minPrice', filters.minPrice)
    if (filters.maxPrice) query.set('maxPrice', filters.maxPrice)
    if (filters.sort) query.set('sort', filters.sort)

    request(`/books?${query.toString()}`, { signal: controller.signal })
      .then((data) => {
        if (!data || !Array.isArray(data.books) || typeof data.total !== 'number' || typeof data.totalPages !== 'number') {
          throw new Error('Dữ liệu danh sách sách không hợp lệ.')
        }
        setBooks(data.books)
        setTotal(data.total)
        setTotalPages(data.totalPages)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setBooksError(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setBooksLoading(false)
      })
    return () => controller.abort()
  }, [activeTab, page, filters, selectedBookId, booksRetry])

  useEffect(() => {
    if (activeTab !== 'books' || !selectedBookId) return
    const controller = new AbortController()
    request(`/books/${selectedBookId}`, { signal: controller.signal })
      .then((data) => {
        if (!data || typeof data !== 'object' || Array.isArray(data) || data.id === undefined || data.id === null) {
          throw new Error('Dữ liệu thông tin sách không hợp lệ.')
        }
        setSelectedBook(data)
      })
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setDetailError(requestError.message)
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDetailLoading(false)
      })
    return () => controller.abort()
  }, [activeTab, selectedBookId, detailRetry])

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
        if (mode === 'reset') window.history.replaceState({}, '', window.location.pathname)
        setMessage(data.message)
      } else if (mode === 'register') {
        setMode('login')
        setForm({ ...form, password: '', confirmPassword: '' })
        setMessage(data.message || 'Đăng ký thành công.')
      } else {
        setUser(data.user)
        localStorage.setItem('accessToken', data.accessToken)
        localStorage.setItem('user', JSON.stringify(data.user))
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
    localStorage.removeItem('accessToken')
    localStorage.removeItem('user')
    setUser(null)
    setMessage('Bạn đã đăng xuất.')
  }

  return (
    <div>
      <header className="app-navbar">
        <button
          type="button"
          className="app-brand"
          onClick={() => {
            setActiveTab('books')
            setSelectedBookId(null)
            setSelectedBook(null)
            setBooksLoading(true)
            setBooksError('')
          }}
        >
          SERN BOOKSTORE
        </button>
        <nav className="app-nav-links">
          <button
            type="button"
            className={`nav-btn ${activeTab === 'books' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('books')
              setSelectedBookId(null)
              setSelectedBook(null)
              setBooksLoading(true)
              setBooksError('')
            }}
          >
            Cửa hàng sách
          </button>
          <button 
            type="button" 
            className={`nav-btn ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('account')
              setSelectedBookId(null)
              setSelectedBook(null)
              setDetailLoading(false)
              setDetailError('')
            }}
          >
            {user ? user.fullName : 'Tài khoản'}
          </button>
        </nav>
      </header>

      {activeTab === 'books' ? (
        selectedBookId ? (
          <BookDetail
            book={selectedBook}
            loading={detailLoading}
            error={detailError}
            onRetry={() => {
              setDetailLoading(true)
              setDetailError('')
              setDetailRetry((retry) => retry + 1)
            }}
            onBack={() => {
              setSelectedBookId(null)
              setSelectedBook(null)
              setBooks([])
              setTotal(0)
              setTotalPages(1)
              setBooksLoading(true)
              setBooksError('')
            }}
            onSelectBook={(id) => {
              setDetailLoading(true)
              setDetailError('')
              setSelectedBookId(id)
              setSelectedBook(null)
            }}
          />
        ) : (
          <BookList
            books={books}
            total={total}
            page={page}
            totalPages={totalPages}
            filters={filters}
            loading={booksLoading}
            error={booksError}
            onRetry={() => {
              setBooksLoading(true)
              setBooksError('')
              setBooks([])
              setBooksRetry((retry) => retry + 1)
            }}
            onFilterChange={(nextFilters) => {
              setBooksLoading(true)
              setBooksError('')
              setBooks([])
              setFilters(nextFilters)
              setPage(1)
            }}
            onPageChange={(nextPage) => {
              setBooksLoading(true)
              setBooksError('')
              setBooks([])
              setPage(nextPage)
            }}
            onResetFilters={() => {
              setBooksLoading(true)
              setBooksError('')
              setBooks([])
              setFilters({ search: '', minPrice: '', maxPrice: '', sort: 'newest' })
              setPage(1)
            }}
            onSelectBook={(id) => {
              setDetailLoading(true)
              setDetailError('')
              setSelectedBookId(id)
              setSelectedBook(null)
            }}
          />
        )
      ) : user ? (
        <main className="page">
          <section className="card welcome">
            <span className="eyebrow">SERN BOOKSTORE</span>
            <h1>Xin chào, {user.fullName}</h1>
            <p>Bạn đang đăng nhập với vai trò <strong>{user.role || (user.isAdmin ? 'Admin' : 'Customer')}</strong>.</p>
            <button onClick={() => changeMode('change')}>Đổi mật khẩu</button>
            <button className="secondary" onClick={logout}>Đăng xuất</button>
            {mode === 'change' && (
              <form onSubmit={submit}>
                <label>Mật khẩu hiện tại<input type="password" name="currentPassword" value={form.currentPassword} onChange={update} required /></label>
                <label>Mật khẩu mới<input type="password" name="newPassword" value={form.newPassword} onChange={update} required minLength="8" /></label>
                <label>Xác nhận mật khẩu<input type="password" name="confirmPassword" value={form.confirmPassword} onChange={update} required minLength="8" /></label>
                <button type="submit" disabled={loading}>{loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}</button>
              </form>
            )}
            {message && <p className="success">{message}</p>}
            {error && <p className="error">{error}</p>}
          </section>
        </main>
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
