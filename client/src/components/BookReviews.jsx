import { useState, useEffect, useCallback, useMemo } from 'react'
import reviewService from '../services/reviewService'
import './BookReviews.css'

const STAR_LABELS = {
  1: 'Rất tệ',
  2: 'Tệ',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời'
}

function StarRatingDisplay({ rate }) {
  const fullStars = Math.round(Number(rate) || 0)
  return (
    <span className="review-stars" aria-label={`${rate} sao`}>
      {'★'.repeat(Math.max(0, Math.min(5, fullStars)))}
      {'☆'.repeat(Math.max(0, 5 - fullStars))}
    </span>
  )
}

function BookReviews({
  bookId,
  currentUser,
  onRequireLogin,
  initialTab = 'reviews',
  scrollToOwnReview = false
}) {
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const sp = new URLSearchParams(window.location.search)
      if (sp.get('tab') === 'discussion') return 'discussions'
    } catch {
      return initialTab === 'discussions' ? 'discussions' : 'reviews'
    }
    return initialTab === 'discussions' ? 'discussions' : 'reviews'
  })

  const [reviews, setReviews] = useState([])
  const [discussions, setDiscussions] = useState([])

  const [summary, setSummary] = useState({
    averageRate: 0,
    totalReviews: 0,
    totalDiscussions: 0,
    breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  })
  const [purchaseStatus, setPurchaseStatus] = useState({
    canReview: false,
    status: 'guest',
    hasPurchased: false
  })

  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedStar, setSelectedStar] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [rate, setRate] = useState(5)
  const [hoverRate, setHoverRate] = useState(0)
  const [reviewValue, setReviewValue] = useState('')
  const [discussionValue, setDiscussionValue] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editRate, setEditRate] = useState(null)
  const [editValue, setEditValue] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!loading && (scrollToOwnReview || new URLSearchParams(window.location.search).get('focus') === 'review')) {
      const ownCard = document.querySelector('.user-own-review-card')
      if (ownCard) {
        ownCard.scrollIntoView({ behavior: 'smooth', block: 'center' })
        ownCard.classList.add('review-highlight')
        setTimeout(() => ownCard.classList.remove('review-highlight'), 3000)
      }
    }
  }, [loading, scrollToOwnReview])

  const isAuthenticated = Boolean(localStorage.getItem('accessToken'))
  const currentUserId = currentUser?.id || null

  const fetchReviewsData = useCallback(async (targetTab, targetPage = 1) => {
    if (!bookId) return
    try {
      setLoading(true)
      const res = await reviewService.getBookReviews(bookId, {
        page: targetPage,
        limit: 5,
        type: targetTab
      })

      if (targetTab === 'reviews') {
        setReviews(res.comments || [])
      } else {
        setDiscussions(res.comments || [])
      }

      const rawSummary = res.summary || {}
      const breakdown = rawSummary.breakdown || rawSummary.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
      const averageRate = rawSummary.averageRate ?? rawSummary.avgRating ?? 0
      const totalReviews = rawSummary.totalReviews || 0
      const totalDiscussions = rawSummary.totalDiscussions || 0

      setSummary({
        averageRate,
        totalReviews,
        totalDiscussions,
        breakdown
      })

      if (res.purchaseStatus) {
        setPurchaseStatus(res.purchaseStatus)
      }

      setTotalPages(res.totalPages || 1)
      setPage(res.page || targetPage)
    } catch (err) {
      setErrorMsg(err.message || 'Không thể tải dữ liệu đánh giá.')
    } finally {
      setLoading(false)
    }
  }, [bookId])

  useEffect(() => {
    let ignore = false
    if (!bookId) return undefined

    reviewService.getBookReviews(bookId, { page: 1, limit: 5, type: activeTab })
      .then((res) => {
        if (!ignore) {
          if (activeTab === 'reviews') {
            setReviews(res.comments || [])
          } else {
            setDiscussions(res.comments || [])
          }
          const rawSummary = res.summary || {}
          const breakdown = rawSummary.breakdown || rawSummary.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
          const averageRate = rawSummary.averageRate ?? rawSummary.avgRating ?? 0
          const totalReviews = rawSummary.totalReviews || 0
          const totalDiscussions = rawSummary.totalDiscussions || 0

          setSummary({
            averageRate,
            totalReviews,
            totalDiscussions,
            breakdown
          })
          if (res.purchaseStatus) {
            setPurchaseStatus(res.purchaseStatus)
          }
          setTotalPages(res.totalPages || 1)
          setPage(res.page || 1)
        }
      })
      .catch((err) => {
        if (!ignore) {
          setErrorMsg(err.message || 'Không thể tải dữ liệu đánh giá.')
        }
      })

    return () => {
      ignore = true
    }
  }, [bookId, activeTab])

  const userReview = useMemo(() => {
    if (!currentUserId || !Array.isArray(reviews)) return null
    return reviews.find((r) => r.user_id === currentUserId && r.rate !== null) || null
  }, [reviews, currentUserId])

  const filteredReviews = useMemo(() => {
    if (!Array.isArray(reviews)) return []
    if (!selectedStar) return reviews
    return reviews.filter((r) => Number(r.rate) === selectedStar)
  }, [reviews, selectedStar])

  const showNotification = (success, message) => {
    if (success) {
      setSuccessMsg(message)
      setErrorMsg('')
    } else {
      setErrorMsg(message)
      setSuccessMsg('')
    }
    setTimeout(() => {
      setSuccessMsg('')
      setErrorMsg('')
    }, 4000)
  }

  const handleCreateReviewSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      if (onRequireLogin) onRequireLogin()
      return
    }
    if (rate < 1 || rate > 5) {
      showNotification(false, 'Vui lòng chọn số sao từ 1 đến 5.')
      return
    }

    try {
      setSubmitting(true)
      await reviewService.createReview(bookId, {
        rate,
        value: reviewValue.trim() || null
      })
      showNotification(true, 'Cảm ơn bạn đã gửi đánh giá chất lượng cho cuốn sách!')
      setReviewValue('')
      setRate(5)
      await fetchReviewsData('reviews', 1)
    } catch (err) {
      showNotification(false, err.message || 'Gửi đánh giá thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateDiscussionSubmit = async (e) => {
    e.preventDefault()
    if (!isAuthenticated) {
      if (onRequireLogin) onRequireLogin()
      return
    }
    if (!discussionValue.trim()) {
      showNotification(false, 'Vui lòng nhập nội dung câu hỏi hoặc thảo luận.')
      return
    }

    try {
      setSubmitting(true)
      await reviewService.createReview(bookId, {
        rate: null,
        value: discussionValue.trim()
      })
      showNotification(true, 'Câu hỏi/thảo luận của bạn đã được đăng thành công!')
      setDiscussionValue('')
      await fetchReviewsData('discussions', 1)
    } catch (err) {
      showNotification(false, err.message || 'Gửi thảo luận thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (item) => {
    setEditingId(item.id)
    setEditRate(item.rate)
    setEditValue(item.value || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditRate(null)
    setEditValue('')
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingId) return

    try {
      setSubmitting(true)
      await reviewService.updateReview(editingId, {
        rate: editRate,
        value: editValue.trim() || null
      })
      showNotification(true, 'Cập nhật thành công!')
      setEditingId(null)
      await fetchReviewsData(activeTab, page)
    } catch (err) {
      showNotification(false, err.message || 'Cập nhật thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) {
      return
    }

    try {
      setSubmitting(true)
      await reviewService.deleteReview(itemId)
      showNotification(true, 'Đã xóa bài viết thành công.')
      await fetchReviewsData(activeTab, 1)
    } catch (err) {
      showNotification(false, err.message || 'Xóa bài viết thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const avgScore = Number(summary.averageRate || 0).toFixed(1)
  const totalReviewCount = Number(summary.totalReviews || 0)
  const totalDiscussionCount = Number(summary.totalDiscussions || 0)

  return (
    <section id="book-reviews-section" className="reviews-container" aria-label="Đánh giá và thảo luận từ độc giả">
      <div className="reviews-tab-nav">
        <button
          type="button"
          className={`reviews-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('reviews')
            setEditingId(null)
          }}
        >
          ⭐ Đánh giá từ người mua ({totalReviewCount})
        </button>
        <button
          type="button"
          className={`reviews-tab-btn ${activeTab === 'discussions' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('discussions')
            setEditingId(null)
          }}
        >
          💬 Hỏi đáp & Thảo luận ({totalDiscussionCount})
        </button>
      </div>

      {errorMsg ? <div className="feedback-msg-error">{errorMsg}</div> : null}
      {successMsg ? <div className="feedback-msg-success">{successMsg}</div> : null}

      {activeTab === 'reviews' ? (
        <div>
          <div className="reviews-summary-card">
            <div className="summary-score-box">
              <div className="summary-big-score">{avgScore}</div>
              <div className="summary-stars-row">
                <StarRatingDisplay rate={summary.averageRate} />
              </div>
              <p className="summary-total-text">{totalReviewCount} lượt đánh giá thực tế</p>
            </div>

            <div className="summary-bars-box">
              {[5, 4, 3, 2, 1].map((s) => {
                const count = summary.breakdown ? Number(summary.breakdown[s] || 0) : 0
                const percentage = totalReviewCount > 0 ? Math.round((count / totalReviewCount) * 100) : 0
                return (
                  <div key={s} className="bar-row">
                    <span className="bar-label">
                      <span className="bar-num">{s}</span>
                      <span className="bar-star">★</span>
                    </span>
                    <div className="bar-track">
                      <div className="bar-fill" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="bar-count">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {!isAuthenticated ? (
            <div className="login-prompt-banner">
              <p className="login-prompt-text">
                Bạn cần đăng nhập để xem trạng thái mua hàng và gửi đánh giá chất lượng sách.
              </p>
              <button
                type="button"
                className="btn-login-now"
                onClick={onRequireLogin}
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : purchaseStatus.status === 'pending' ? (
            <div className="order-pending-banner">
              <span className="banner-icon">⏳</span>
              <div>
                <strong>Đơn hàng đang xử lý hoặc đang trên đường giao:</strong>
                <p className="banner-desc">
                  Bạn đã đặt mua cuốn sách này nhưng đơn hàng chưa hoàn tất. Bạn hãy quay lại chấm điểm sau khi nhận được sách nhé!
                </p>
              </div>
            </div>
          ) : !purchaseStatus.canReview ? (
            <div className="not-purchased-banner">
              <span className="banner-icon">🛒</span>
              <div>
                <strong>Chỉ dành cho độc giả đã nhận sách:</strong>
                <p className="banner-desc">
                  Để đảm bảo tính khách quan và uy tín, chỉ những khách hàng đã mua và nhận sách thành công mới có thể gửi đánh giá chất lượng. Bạn có thể sang mục <strong>"Hỏi đáp & Thảo luận"</strong> để trao đổi cùng mọi người.
                </p>
              </div>
            </div>
          ) : !userReview ? (
            <div className="review-form-card">
              <h3 className="review-form-title">Đánh giá chất lượng sách (Dành cho người đã mua)</h3>
              <form onSubmit={handleCreateReviewSubmit}>
                <div className="star-picker">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      className={`star-btn ${(hoverRate || rate) >= star ? 'active' : ''}`}
                      onClick={() => setRate(star)}
                      onMouseEnter={() => setHoverRate(star)}
                      onMouseLeave={() => setHoverRate(0)}
                      aria-label={`${star} sao`}
                    >
                      ★
                    </button>
                  ))}
                  <span className="star-hint">{STAR_LABELS[hoverRate || rate]}</span>
                </div>

                <textarea
                  className="review-textarea"
                  placeholder="Chia sẻ cảm nhận chi tiết về chất lượng sách, nội dung, bìa, mực in và dịch vụ giao hàng..."
                  value={reviewValue}
                  maxLength={1000}
                  onChange={(e) => setReviewValue(e.target.value)}
                />

                <div className="form-footer">
                  <span className="char-counter">{reviewValue.length}/1000 ký tự</span>
                  <button
                    type="submit"
                    className="btn-submit-review"
                    disabled={submitting}
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          <div className="reviews-filter-bar">
            <button
              type="button"
              className={`filter-btn ${selectedStar === null ? 'active' : ''}`}
              onClick={() => setSelectedStar(null)}
            >
              Tất cả ({totalReviewCount})
            </button>
            {[5, 4, 3, 2, 1].map((s) => {
              const count = summary.breakdown ? Number(summary.breakdown[s] || 0) : 0
              return (
                <button
                  type="button"
                  key={s}
                  className={`filter-btn ${selectedStar === s ? 'active' : ''}`}
                  onClick={() => setSelectedStar(selectedStar === s ? null : s)}
                >
                  {s} sao ({count})
                </button>
              )
            })}
          </div>

          {loading && filteredReviews.length === 0 ? (
            <div className="reviews-empty-box">Đang tải danh sách đánh giá...</div>
          ) : filteredReviews.length === 0 ? (
            <div className="reviews-empty-box">
              <div className="reviews-empty-icon">💬</div>
              <p>
                {selectedStar
                  ? `Chưa có bài đánh giá nào ${selectedStar} sao.`
                  : 'Chưa có bài đánh giá nào từ người mua. Hãy là người đầu tiên đánh giá sau khi nhận sách!'}
              </p>
            </div>
          ) : (
            <div className="reviews-list" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
              {filteredReviews.map((rev) => {
                const isAuthor = currentUserId && rev.user_id === currentUserId
                const isEditing = editingId === rev.id
                const initialLetter = (rev.full_name || rev.username || 'U').charAt(0).toUpperCase()
                const formattedDate = rev.createdAt
                  ? new Date(rev.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                  : ''

                if (isEditing) {
                  return (
                    <div key={rev.id} className="review-item user-own-review-card">
                      <h4 style={{ margin: '0 0 12px 0', color: '#20201f' }}>Chỉnh sửa bài đánh giá của bạn</h4>
                      <form onSubmit={handleUpdateSubmit}>
                        <div className="star-picker">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <button
                              type="button"
                              key={s}
                              className={`star-btn ${editRate >= s ? 'active' : ''}`}
                              onClick={() => setEditRate(s)}
                            >
                              ★
                            </button>
                          ))}
                          <span className="star-hint">{STAR_LABELS[editRate]}</span>
                        </div>

                        <textarea
                          className="review-textarea"
                          value={editValue}
                          maxLength={1000}
                          onChange={(e) => setEditValue(e.target.value)}
                        />

                        <div className="form-footer">
                          <span className="char-counter">{editValue.length}/1000 ký tự</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="filter-btn"
                              onClick={handleCancelEdit}
                              disabled={submitting}
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="btn-submit-review"
                              disabled={submitting}
                            >
                              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )
                }

                return (
                  <article
                    key={rev.id}
                    className={`review-item ${isAuthor ? 'user-own-review-card' : ''}`}
                  >
                    {isAuthor ? (
                      <div className="own-review-badge">★ Đánh giá của bạn</div>
                    ) : null}

                    <div className="review-item-header">
                      <div className="review-author-info">
                        {rev.avatar ? (
                          <img
                            src={rev.avatar}
                            alt={rev.full_name || rev.username}
                            className="author-avatar"
                          />
                        ) : (
                          <div className="author-avatar">{initialLetter}</div>
                        )}
                        <div className="author-details">
                          <div className="author-name-row">
                            <span className="author-name">
                              {rev.full_name || rev.username || 'Khách hàng'}
                            </span>
                            {rev.isPurchased ? (
                              <span className="purchased-badge" title="Đã mua và nhận sách thành công">
                                ✓ Đã mua hàng
                              </span>
                            ) : null}
                          </div>
                          <div className="review-date">{formattedDate}</div>
                        </div>
                      </div>

                      <StarRatingDisplay rate={rev.rate} />
                    </div>

                    {rev.value ? (
                      <p className="review-content">{rev.value}</p>
                    ) : (
                      <p className="review-content" style={{ fontStyle: 'italic', color: '#8c8273' }}>
                        Người mua không để lại bình luận văn bản.
                      </p>
                    )}

                    {isAuthor ? (
                      <div className="review-actions">
                        <button
                          type="button"
                          className="btn-review-action btn-review-edit"
                          onClick={() => handleStartEdit(rev)}
                          disabled={submitting}
                        >
                          ✏️ Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          className="btn-review-action btn-review-delete"
                          onClick={() => handleDeleteItem(rev.id)}
                          disabled={submitting}
                        >
                          🗑️ Xóa đánh giá
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="discussion-info-banner">
            💬 <strong>Mục Hỏi đáp & Thảo luận cộng đồng</strong>: Mọi độc giả đều có thể đặt câu hỏi hoặc trao đổi tự do về cuốn sách mà không cần mua trước (không tính điểm sao).
          </div>

          {!isAuthenticated ? (
            <div className="login-prompt-banner">
              <p className="login-prompt-text">
                Vui lòng đăng nhập để đặt câu hỏi hoặc tham gia thảo luận về cuốn sách này.
              </p>
              <button
                type="button"
                className="btn-login-now"
                onClick={onRequireLogin}
              >
                Đăng nhập ngay
              </button>
            </div>
          ) : (
            <div className="review-form-card">
              <h3 className="review-form-title">Đặt câu hỏi hoặc thảo luận về sách</h3>
              <form onSubmit={handleCreateDiscussionSubmit}>
                <textarea
                  className="review-textarea"
                  placeholder="Đặt câu hỏi về bản dịch, phụ kiện tặng kèm, hoặc bàn luận về nội dung sách..."
                  value={discussionValue}
                  maxLength={1000}
                  onChange={(e) => setDiscussionValue(e.target.value)}
                />

                <div className="form-footer">
                  <span className="char-counter">{discussionValue.length}/1000 ký tự</span>
                  <button
                    type="submit"
                    className="btn-submit-review"
                    disabled={submitting}
                  >
                    {submitting ? 'Đang gửi...' : 'Gửi thảo luận'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading && discussions.length === 0 ? (
            <div className="reviews-empty-box">Đang tải danh sách thảo luận...</div>
          ) : discussions.length === 0 ? (
            <div className="reviews-empty-box">
              <div className="reviews-empty-icon">💭</div>
              <p>Chưa có câu hỏi hay thảo luận nào. Hãy là người đầu tiên đặt câu hỏi về cuốn sách này!</p>
            </div>
          ) : (
            <div className="reviews-list" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
              {discussions.map((disc) => {
                const isAuthor = currentUserId && disc.user_id === currentUserId
                const isEditing = editingId === disc.id
                const initialLetter = (disc.full_name || disc.username || 'U').charAt(0).toUpperCase()
                const formattedDate = disc.createdAt
                  ? new Date(disc.createdAt).toLocaleDateString('vi-VN', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric'
                    })
                  : ''

                if (isEditing) {
                  return (
                    <div key={disc.id} className="review-item user-own-review-card">
                      <h4 style={{ margin: '0 0 12px 0', color: '#20201f' }}>Chỉnh sửa câu hỏi / thảo luận</h4>
                      <form onSubmit={handleUpdateSubmit}>
                        <textarea
                          className="review-textarea"
                          value={editValue}
                          maxLength={1000}
                          onChange={(e) => setEditValue(e.target.value)}
                        />

                        <div className="form-footer">
                          <span className="char-counter">{editValue.length}/1000 ký tự</span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              type="button"
                              className="filter-btn"
                              onClick={handleCancelEdit}
                              disabled={submitting}
                            >
                              Hủy
                            </button>
                            <button
                              type="submit"
                              className="btn-submit-review"
                              disabled={submitting}
                            >
                              {submitting ? 'Đang lưu...' : 'Lưu thay đổi'}
                            </button>
                          </div>
                        </div>
                      </form>
                    </div>
                  )
                }

                return (
                  <article key={disc.id} className="review-item">
                    <div className="review-item-header">
                      <div className="review-author-info">
                        {disc.avatar ? (
                          <img
                            src={disc.avatar}
                            alt={disc.full_name || disc.username}
                            className="author-avatar"
                          />
                        ) : (
                          <div className="author-avatar">{initialLetter}</div>
                        )}
                        <div className="author-details">
                          <div className="author-name-row">
                            <span className="author-name">
                              {disc.full_name || disc.username || 'Độc giả'}
                            </span>
                            <span className="discussion-tag">Hỏi đáp / Thảo luận</span>
                            {disc.isPurchased ? (
                              <span className="purchased-badge">✓ Đã mua hàng</span>
                            ) : null}
                          </div>
                          <div className="review-date">{formattedDate}</div>
                        </div>
                      </div>
                    </div>

                    <p className="review-content">{disc.value}</p>

                    {isAuthor ? (
                      <div className="review-actions">
                        <button
                          type="button"
                          className="btn-review-action btn-review-edit"
                          onClick={() => handleStartEdit(disc)}
                          disabled={submitting}
                        >
                          ✏️ Chỉnh sửa
                        </button>
                        <button
                          type="button"
                          className="btn-review-action btn-review-delete"
                          onClick={() => handleDeleteItem(disc.id)}
                          disabled={submitting}
                        >
                          🗑️ Xóa thảo luận
                        </button>
                      </div>
                    ) : null}
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="reviews-pagination">
          <button
            type="button"
            className="btn-page"
            disabled={page <= 1 || loading}
            onClick={() => fetchReviewsData(activeTab, page - 1)}
          >
            ←
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <button
              type="button"
              key={p}
              className={`btn-page ${page === p ? 'active' : ''}`}
              disabled={loading}
              onClick={() => fetchReviewsData(activeTab, p)}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            className="btn-page"
            disabled={page >= totalPages || loading}
            onClick={() => fetchReviewsData(activeTab, page + 1)}
          >
            →
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default BookReviews
