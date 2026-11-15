import { useState } from 'react'
import { BookIcon, CartIcon, HeartIcon, PackageIcon, ShieldCheckIcon, UserIcon } from '../common/Icons'
import './Header.css'

export default function Header({
  activeTab,
  navigateTo,
  cartBadgeCount = 0,
  wishlistBadgeCount = 0,
  user = null,
  isAdmin = false,
  onQuickSearch = null
}) {
  const [searchValue, setSearchValue] = useState('')

  const handleSearchSubmit = (e) => {
    e.preventDefault()
    if (typeof onQuickSearch === 'function') {
      onQuickSearch(searchValue)
    } else if (typeof navigateTo === 'function') {
      navigateTo({ tab: 'books', bookId: null })
    }
  }

  const rawName = user?.fullName || user?.full_name || user?.username || ''
  const accountDisplayLabel = rawName
    ? (rawName.length > 12 ? (user?.username || 'Tài khoản') : rawName)
    : 'Tài khoản'

  return (
    <header className="lumina-header-root">
      <div className="lumina-topbar">
        <div className="lumina-topbar-container">
          <div className="lumina-topbar-left">
            <span className="topbar-item">
              <span className="topbar-icon">📞</span>
              <span className="topbar-text">1900 8386</span>
            </span>
            <span className="topbar-divider">•</span>
            <span className="topbar-item">
              <span className="topbar-icon">✉️</span>
              <span className="topbar-text">bookstore@gmail.com</span>
            </span>
          </div>
          <div className="lumina-topbar-right">
            <span className="topbar-item">
              <span className="topbar-icon">📍</span>
              <span className="topbar-text">1 Võ Văn Ngân, Phường Linh Trung, Thủ Đức, TP. Hồ Chí Minh</span>
            </span>
          </div>
        </div>
      </div>

      <div className="lumina-main-header">
        <div className="lumina-header-container">
          <div 
            className="lumina-brand"
            onClick={() => navigateTo({ tab: 'books', bookId: null })}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') navigateTo({ tab: 'books', bookId: null })
            }}
          >
            <div className="brand-logo-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
              </svg>
            </div>
            <span className="brand-name">BookStore</span>
          </div>

          <form className="lumina-search-form" onSubmit={handleSearchSubmit}>
            <div className="search-input-wrap">
              <input
                type="text"
                className="lumina-search-input"
                placeholder="Tìm kiếm sách, tác giả, thể loại..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
              />
              <button type="submit" className="lumina-search-btn">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span>Tìm kiếm</span>
              </button>
            </div>
          </form>

          <nav className="lumina-nav-actions">
            <button
              type="button"
              className={`lumina-nav-pill-btn shop-pill ${activeTab === 'books' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'books', bookId: null })}
              title="Cửa hàng sách"
            >
              <BookIcon className="pill-icon" size={16} />
              <span className="pill-label">Cửa hàng</span>
            </button>

            <button
              type="button"
              className={`lumina-nav-pill-btn cart-pill ${activeTab === 'cart' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'cart' })}
              title="Giỏ hàng"
            >
              <CartIcon className="pill-icon" size={16} />
              <span className="pill-label">Giỏ hàng</span>
              <span className="pill-badge">{cartBadgeCount}</span>
            </button>

            <button
              type="button"
              className={`lumina-nav-pill-btn wishlist-pill ${activeTab === 'wishlist' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'wishlist' })}
              title="Danh sách yêu thích"
            >
              <HeartIcon className="pill-icon" size={16} />
              <span className="pill-label">Yêu thích</span>
              <span className="pill-badge wishlist-badge">{wishlistBadgeCount}</span>
            </button>

            {user && (
              <button
                type="button"
                className={`lumina-nav-pill-btn orders-pill ${activeTab === 'orders' ? 'active' : ''}`}
                onClick={() => navigateTo({ tab: 'orders' })}
                title="Lịch sử đơn mua"
              >
                <PackageIcon className="pill-icon" size={16} />
                <span className="pill-label">Đơn mua</span>
              </button>
            )}

            {isAdmin && (
              <button
                type="button"
                className={`lumina-nav-pill-btn admin-pill ${activeTab === 'admin' ? 'active' : ''}`}
                onClick={() => navigateTo({ tab: 'admin', adminTab: 'overview' })}
                title="Quản trị hệ thống"
              >
                <ShieldCheckIcon className="pill-icon" size={16} />
                <span className="pill-label">Quản trị</span>
              </button>
            )}

            <button
              type="button"
              className={`lumina-nav-pill-btn account-pill ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => navigateTo({ tab: 'account' })}
              title="Tài khoản cá nhân"
            >
              <UserIcon className="pill-icon" size={16} />
              <span className="pill-text-truncate">{accountDisplayLabel}</span>
            </button>
          </nav>
        </div>
      </div>
    </header>
  )
}
