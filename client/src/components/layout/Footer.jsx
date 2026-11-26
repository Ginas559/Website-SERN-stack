import { useEffect, useRef, useState } from 'react'
import { MaterialCommunityIcon } from '../common/Icons'
import './Footer.css'

export default function Footer({ onNavigate = null }) {
  const [email, setEmail] = useState('')
  const [subscribed, setSubscribed] = useState(false)
  const subscribedTimerRef = useRef(null)

  useEffect(() => () => {
    if (subscribedTimerRef.current) clearTimeout(subscribedTimerRef.current)
  }, [])

  const handleSubscribe = (e) => {
    e.preventDefault()
    if (email.trim()) {
      setSubscribed(true)
      setEmail('')
      if (subscribedTimerRef.current) clearTimeout(subscribedTimerRef.current)
      subscribedTimerRef.current = setTimeout(() => {
        setSubscribed(false)
        subscribedTimerRef.current = null
      }, 4000)
    }
  }

  const handleLinkClick = (tab) => {
    if (typeof onNavigate === 'function') {
      onNavigate({ tab, bookId: null })
    }
  }

  return (
    <footer className="lumina-footer-root">
      <div className="lumina-footer-container">
        <div className="lumina-footer-grid">
          <div className="footer-col brand-col">
            <div className="footer-brand">
              <div className="footer-logo-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div className="footer-brand-text">
                <span className="footer-brand-title">BookStore</span>
              </div>
            </div>
            <p className="footer-desc">
              Nền tảng thương mại điện tử sách cao cấp, cung cấp hàng ngàn đầu sách chọn lọc chất lượng cao với dịch vụ tận tâm và giao hàng nhanh chóng toàn quốc.
            </p>
            <div className="footer-trust-chips">
              <span className="trust-chip"><MaterialCommunityIcon name="shield-check" size={14} />100% Chính hãng</span>
              <span className="trust-chip"><MaterialCommunityIcon name="lightning-bolt" size={14} />Giao nhanh 1-2 ngày</span>
              <span className="trust-chip"><MaterialCommunityIcon name="sync" size={14} />Đổi trả 7 ngày</span>
            </div>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">VỀ BOOKSTORE</h4>
            <ul className="footer-links-list">
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Giới thiệu nhà sách</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Hệ thống phân phối</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Tuyển dụng nhân sự</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Chính sách bảo mật</button></li>
            </ul>
          </div>

          <div className="footer-col">
            <h4 className="footer-col-title">HỖ TRỢ KHÁCH HÀNG</h4>
            <ul className="footer-links-list">
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Trung tâm trợ giúp</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Chính sách đổi trả</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Phương thức thanh toán</button></li>
              <li><button type="button" className="footer-link-btn" onClick={() => handleLinkClick('books')}>Chính sách vận chuyển</button></li>
            </ul>
          </div>

          <div className="footer-col newsletter-col">
            <h4 className="footer-col-title">ĐĂNG KÝ NHẬN TIN</h4>
            <p className="newsletter-desc">
              Nhận thông tin sách mới phát hành và các voucher ưu đãi độc quyền sớm nhất.
            </p>
            <form className="newsletter-form" onSubmit={handleSubscribe}>
              <div className="newsletter-input-group">
                <input
                  type="email"
                  className="newsletter-input"
                  placeholder="Email của bạn..."
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <button type="button" className="newsletter-btn" onClick={handleSubscribe}>Gửi</button>
              </div>
            </form>
            {subscribed && (
              <span className="newsletter-success-msg">Cảm ơn bạn đã đăng ký nhận tin!</span>
            )}
          </div>
        </div>

        <div className="lumina-footer-bottom">
          <div className="footer-bottom-copy">
            © 2026 BookStore. Dự án Website SERN Stack (HCMUTE). All rights reserved.
          </div>
          <div className="footer-bottom-badges">
            <span className="tech-badge">SQL Server</span>
            <span className="tech-badge">Express.js</span>
            <span className="tech-badge">React 19</span>
            <span className="tech-badge">Node.js</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
