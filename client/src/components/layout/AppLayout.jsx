import Header from './Header'
import Footer from './Footer'
import './AppLayout.css'

export default function AppLayout({
  activeTab,
  navigateTo,
  cartBadgeCount = 0,
  wishlistBadgeCount = 0,
  user = null,
  isAdmin = false,
  onQuickSearch = null,
  children
}) {
  return (
    <div className="lumina-layout-root">
      <Header
        activeTab={activeTab}
        navigateTo={navigateTo}
        cartBadgeCount={cartBadgeCount}
        wishlistBadgeCount={wishlistBadgeCount}
        user={user}
        isAdmin={isAdmin}
        onQuickSearch={onQuickSearch}
      />
      <main className="lumina-main-content">
        {children}
      </main>
      <Footer onNavigate={navigateTo} />
    </div>
  )
}

