import { useState, useEffect, useCallback, useRef } from 'react'
import reviewService from '../services/reviewService'
import './BookReviews.css'

const STAR_LABELS = {
  1: 'Rất tệ',
  2: 'Tệ',
  3: 'Bình thường',
  4: 'Hài lòng',
  5: 'Tuyệt vời'
}

const DEFAULT_SUMMARY = {
  averageRate: 0,
  totalReviews: 0,
  totalDiscussions: 0,
  breakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
}

const DEFAULT_PURCHASE_STATUS = {
  canReview: false,
  status: 'guest',
  hasPurchased: false
}

function getAuthorDisplay(item, fallbackName = 'Khách hàng') {
  const displayName = item?.user_full_name || item?.full_name || item?.user_username || item?.username || fallbackName
  const avatarUrl = item?.user_avatar || item?.avatar || ''
  const initialLetter = displayName.charAt(0).toUpperCase() || 'U'
  return { displayName, avatarUrl, initialLetter }
}

function resolveReplyTargetAndContent(reply, rootAuthorName, candidateNames = []) {
  const rawValue = String(reply?.value || '').trim()
  const fallbackTarget =
    reply?.parent_user_full_name ||
    reply?.parent_user_username ||
    rootAuthorName ||
    ''

  if (rawValue.startsWith('@')) {
    const sorted = [...candidateNames]
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)

    for (const name of sorted) {
      const prefix = `@${name}`
      if (rawValue.startsWith(prefix)) {
        const rest = rawValue.slice(prefix.length)
        if (rest.length === 0 || /^[:,\s]/.test(rest)) {
          return {
            targetName: name,
            mentionPrefix: prefix,
            cleanContent: rest.replace(/^[:,\s]+/, '')
          }
        }
      }
    }

    const match = rawValue.match(/^@([^\s:,\n]+(?:\s+[^\s:,\n]+){0,4})(?:[:,\s]+(.*)|$)/s)
    if (match && match[1]) {
      const parsedName = match[1].trim()
      return {
        targetName: parsedName,
        mentionPrefix: `@${parsedName}`,
        cleanContent: (match[2] || '').trim()
      }
    }
  }

  return {
    targetName: fallbackTarget,
    mentionPrefix: null,
    cleanContent: rawValue
  }
}

function formatReviewDate(dateValue) {
  if (!dateValue) return ''
  return new Date(dateValue).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  })
}

function isAbortRequestError(error, signal) {
  return Boolean(
    signal?.aborted ||
    error?.name === 'AbortError' ||
    error?.name === 'CanceledError' ||
    error?.code === 'ERR_CANCELED'
  )
}

function getPaginationNumbers(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1)
  }
  const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b)
  const items = []
  sorted.forEach((num, idx) => {
    if (idx > 0 && num - sorted[idx - 1] > 1) {
      items.push(`ellipsis-${sorted[idx - 1]}`)
    }
    items.push(num)
  })
  return items
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
  const [serverUserReview, setServerUserReview] = useState(null)
  const [hasLoadedReviews, setHasLoadedReviews] = useState(false)

  const [summary, setSummary] = useState(DEFAULT_SUMMARY)
  const [purchaseStatus, setPurchaseStatus] = useState(DEFAULT_PURCHASE_STATUS)

  const [pageByTab, setPageByTab] = useState({ reviews: 1, discussions: 1 })
  const [totalPagesByTab, setTotalPagesByTab] = useState({ reviews: 1, discussions: 1 })
  const page = pageByTab[activeTab] || 1
  const totalPages = totalPagesByTab[activeTab] || 1
  const [selectedStar, setSelectedStar] = useState(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const loadedTabsRef = useRef({ bookId: null, userId: null, reviews: false, discussions: false })
  const activeRequestRef = useRef({ controller: null, requestId: 0 })
  const pageByTabRef = useRef(pageByTab)
  const selectedStarRef = useRef(selectedStar)
  const hasAutoScrolledRef = useRef(false)
  const ownReviewCardRef = useRef(null)
  const notificationTimerRef = useRef(null)
  const highlightTimerRef = useRef(null)

  useEffect(() => {
    pageByTabRef.current = pageByTab
  }, [pageByTab])

  useEffect(() => {
    selectedStarRef.current = selectedStar
  }, [selectedStar])

  useEffect(() => {
    hasAutoScrolledRef.current = false
  }, [bookId])

  useEffect(() => {
    return () => {
      if (activeRequestRef.current.controller) {
        activeRequestRef.current.controller.abort()
      }
      if (notificationTimerRef.current) {
        clearTimeout(notificationTimerRef.current)
      }
      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current)
      }
    }
  }, [])

  const [rate, setRate] = useState(5)
  const [hoverRate, setHoverRate] = useState(0)
  const [reviewValue, setReviewValue] = useState('')
  const [discussionValue, setDiscussionValue] = useState('')

  const [editingId, setEditingId] = useState(null)
  const [editingIsReply, setEditingIsReply] = useState(false)
  const [editRate, setEditRate] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [replyingToId, setReplyingToId] = useState(null)
  const [replyingTargetName, setReplyingTargetName] = useState('')
  const [replyValue, setReplyValue] = useState('')

  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  const isAuthenticated = Boolean(localStorage.getItem('accessToken'))
  const currentUserId = currentUser?.id || null
  const isAdminUser = Boolean(
    isAuthenticated &&
    currentUser &&
    (currentUser.isAdmin || currentUser.role === 'Admin' || currentUser.role === 'admin')
  )

  const applyReviewsResponse = useCallback((res, targetTab, fallbackPage, resetOtherTab = false) => {
    if (targetTab === 'reviews') {
      setReviews(res.comments || [])
      setHasLoadedReviews(true)
    } else {
      setDiscussions(res.comments || [])
    }

    if (res && 'userReview' in res) {
      setServerUserReview(res.userReview || null)
    }

    const rawSummary = res.summary || {}
    const breakdown = rawSummary.breakdown || rawSummary.distribution || DEFAULT_SUMMARY.breakdown
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

    setTotalPagesByTab((prev) => ({
      reviews: resetOtherTab ? 1 : prev.reviews,
      discussions: resetOtherTab ? 1 : prev.discussions,
      [targetTab]: res.totalPages || 1
    }))
    setPageByTab((prev) => ({
      reviews: resetOtherTab ? 1 : prev.reviews,
      discussions: resetOtherTab ? 1 : prev.discussions,
      [targetTab]: res.page || fallbackPage
    }))
  }, [])

  const fetchReviewsData = useCallback(async (targetTab, targetPage = 1, starOverride = undefined, { resetContext = false } = {}) => {
    if (!bookId) return

    if (activeRequestRef.current.controller) {
      activeRequestRef.current.controller.abort()
    }
    const controller = new AbortController()
    const requestId = activeRequestRef.current.requestId + 1
    activeRequestRef.current = { controller, requestId }

    const effectiveStar = targetTab === 'reviews'
      ? (starOverride !== undefined ? starOverride : selectedStarRef.current)
      : null

    const params = {
      page: targetPage,
      limit: 5,
      type: targetTab
    }
    if (effectiveStar) {
      params.rate = effectiveStar
    }

    try {
      setLoading(true)
      const res = await reviewService.getBookReviews(bookId, params, { signal: controller.signal })
      if (controller.signal.aborted || requestId !== activeRequestRef.current.requestId) {
        return
      }
      const shouldResetContext = resetContext || loadedTabsRef.current.bookId !== bookId || loadedTabsRef.current.userId !== currentUserId
      if (shouldResetContext) {
        loadedTabsRef.current = { bookId, userId: currentUserId, reviews: false, discussions: false }
        setSelectedStar(null)
        setEditingId(null)
        setEditingIsReply(false)
        setReplyingToId(null)
        setReplyingTargetName('')
        setReplyValue('')
      }
      loadedTabsRef.current = { ...loadedTabsRef.current, bookId, userId: currentUserId, [targetTab]: true }
      applyReviewsResponse(res, targetTab, targetPage, shouldResetContext)
    } catch (err) {
      if (!isAbortRequestError(err, controller.signal) && requestId === activeRequestRef.current.requestId) {
        setErrorMsg(err.message || 'Không thể tải dữ liệu đánh giá.')
      }
    } finally {
      if (requestId === activeRequestRef.current.requestId) {
        setLoading(false)
      }
    }
  }, [bookId, currentUserId, applyReviewsResponse])

  useEffect(() => {
    if (!bookId) return undefined

    const isSameContext = loadedTabsRef.current.bookId === bookId && loadedTabsRef.current.userId === currentUserId
    if (isSameContext && loadedTabsRef.current[activeTab]) {
      return undefined
    }

    const targetPage = isSameContext ? (pageByTabRef.current[activeTab] || 1) : 1
    const effectiveStar = isSameContext && activeTab === 'reviews' ? selectedStarRef.current : null
    let disposed = false

    Promise.resolve().then(() => {
      if (!disposed) {
        fetchReviewsData(activeTab, targetPage, effectiveStar, { resetContext: !isSameContext })
      }
    })

    return () => {
      disposed = true
      if (activeRequestRef.current.controller) {
        activeRequestRef.current.controller.abort()
      }
    }
  }, [bookId, activeTab, currentUserId, fetchReviewsData])

  const userReview = isAuthenticated
    ? (
        serverUserReview ||
        (currentUserId && Array.isArray(reviews)
          ? reviews.find((r) => String(r.user_id).toLowerCase() === String(currentUserId).toLowerCase() && r.rate !== null)
          : null) ||
        null
      )
    : null

  useEffect(() => {
    const focusParam = new URLSearchParams(window.location.search).get('focus') === 'review'
    if (hasAutoScrolledRef.current || loading || !hasLoadedReviews || !userReview || (!scrollToOwnReview && !focusParam)) {
      return
    }
    const targetEl = ownReviewCardRef.current
    if (!targetEl) return

    hasAutoScrolledRef.current = true
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    targetEl.classList.add('review-highlight')
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current)
    }
    highlightTimerRef.current = setTimeout(() => {
      targetEl.classList.remove('review-highlight')
    }, 3000)
  }, [loading, hasLoadedReviews, scrollToOwnReview, userReview])

  const showNotification = (success, message) => {
    if (notificationTimerRef.current) {
      clearTimeout(notificationTimerRef.current)
    }
    if (success) {
      setSuccessMsg(message)
      setErrorMsg('')
    } else {
      setErrorMsg(message)
      setSuccessMsg('')
    }
    notificationTimerRef.current = setTimeout(() => {
      setSuccessMsg('')
      setErrorMsg('')
    }, 4000)
  }

  const handleSelectStarFilter = (starValue) => {
    const nextStar = selectedStar === starValue ? null : starValue
    setSelectedStar(nextStar)
    setEditingId(null)
    setEditingIsReply(false)
    setReplyingToId(null)
    setReplyingTargetName('')
    setReplyValue('')
    fetchReviewsData('reviews', 1, nextStar)
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
      setSelectedStar(null)
      await fetchReviewsData('reviews', 1, null)
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
      await fetchReviewsData('discussions', 1, null)
    } catch (err) {
      showNotification(false, err.message || 'Gửi thảo luận thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleStartEdit = (item, isReplyItem = false) => {
    setReplyingToId(null)
    setReplyingTargetName('')
    setReplyValue('')
    setEditingId(item.id)
    setEditingIsReply(Boolean(isReplyItem || item?.parent_id))
    setEditRate(item.rate)
    setEditValue(item.value || '')
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditingIsReply(false)
    setEditRate(null)
    setEditValue('')
  }

  const handleUpdateSubmit = async (e) => {
    e.preventDefault()
    if (!editingId) return
    if ((editingIsReply || editRate === null) && !editValue.trim()) {
      showNotification(
        false,
        editingIsReply
          ? 'Nội dung trả lời bình luận không được để trống.'
          : 'Nội dung thảo luận không được để trống.'
      )
      return
    }

    try {
      setSubmitting(true)
      const payload = editingIsReply
        ? { value: editValue.trim() }
        : { rate: editRate, value: editValue.trim() || null }
      await reviewService.updateReview(editingId, payload)
      showNotification(true, 'Cập nhật thành công!')
      setEditingId(null)
      setEditingIsReply(false)
      await fetchReviewsData(activeTab, page, activeTab === 'reviews' ? selectedStar : null)
    } catch (err) {
      showNotification(false, err.message || 'Cập nhật thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenReply = (rootCommentId, targetDisplayName = '', mentionName = '') => {
    if (!isAuthenticated) {
      if (onRequireLogin) onRequireLogin()
      return
    }
    setEditingId(null)
    setEditingIsReply(false)
    const effectiveMention = mentionName || targetDisplayName
    if (replyingToId === rootCommentId && replyingTargetName === targetDisplayName) {
      setReplyingToId(null)
      setReplyingTargetName('')
      setReplyValue('')
      return
    }
    setReplyingToId(rootCommentId)
    setReplyingTargetName(targetDisplayName)
    setReplyValue(effectiveMention ? `@${effectiveMention} ` : '')
  }

  const handleCancelReply = () => {
    setReplyingToId(null)
    setReplyingTargetName('')
    setReplyValue('')
  }

  const handleSubmitReply = async (e, rootCommentId) => {
    e.preventDefault()
    if (!isAuthenticated) {
      if (onRequireLogin) onRequireLogin()
      return
    }
    const trimmed = replyValue.trim()
    if (!trimmed) {
      showNotification(false, 'Vui lòng nhập nội dung trả lời bình luận.')
      return
    }

    try {
      setSubmitting(true)
      await reviewService.createReview(bookId, {
        parentId: rootCommentId,
        rate: null,
        value: trimmed
      })
      showNotification(true, 'Đã gửi phản hồi bình luận thành công!')
      setReplyingToId(null)
      setReplyingTargetName('')
      setReplyValue('')
      await fetchReviewsData(activeTab, page, activeTab === 'reviews' ? selectedStar : null)
    } catch (err) {
      showNotification(false, err.message || 'Gửi phản hồi thất bại.')
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
      if (editingId === itemId) {
        handleCancelEdit()
      }
      if (replyingToId === itemId) {
        handleCancelReply()
      }
      showNotification(true, 'Đã xóa bài viết thành công.')
      await fetchReviewsData(activeTab, page, activeTab === 'reviews' ? selectedStar : null)
    } catch (err) {
      showNotification(false, err.message || 'Xóa bài viết thất bại.')
    } finally {
      setSubmitting(false)
    }
  }

  const renderCommentCard = (item, { isDiscussion = false, attachOwnRef = false, cardKeyPrefix = 'item' } = {}) => {
    const isAuthor = Boolean(
      isAuthenticated &&
      currentUserId &&
      item.user_id &&
      String(item.user_id).toLowerCase() === String(currentUserId).toLowerCase()
    )
    const canReplyToItem = isDiscussion || isAdminUser
    const isOwnReviewCard = !isDiscussion && isAuthor
    const isEditing = editingId === item.id
    const { displayName, avatarUrl, initialLetter } = getAuthorDisplay(
      item,
      isDiscussion ? 'Độc giả' : 'Khách hàng'
    )
    const formattedDate = formatReviewDate(item.createdAt)

    if (isEditing) {
      return (
        <div
          key={`${cardKeyPrefix}-edit-${item.id}`}
          ref={attachOwnRef ? ownReviewCardRef : null}
          className="review-item user-own-review-card"
        >
          <h4 style={{ margin: '0 0 12px 0', color: '#20201f' }}>
            {isDiscussion ? 'Chỉnh sửa câu hỏi / thảo luận' : 'Chỉnh sửa bài đánh giá của bạn'}
          </h4>
          <form onSubmit={handleUpdateSubmit}>
            {!isDiscussion ? (
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
            ) : null}

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
        key={`${cardKeyPrefix}-${item.id}`}
        ref={attachOwnRef ? ownReviewCardRef : null}
        className={`review-item ${isOwnReviewCard ? 'user-own-review-card' : ''}`}
      >
        {isOwnReviewCard ? (
          <div className="own-review-badge">★ Đánh giá của bạn</div>
        ) : null}

        <div className="review-item-header">
          <div className="review-author-info">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="author-avatar"
              />
            ) : (
              <div className="author-avatar">{initialLetter}</div>
            )}
            <div className="author-details">
              <div className="author-name-row">
                <span className="author-name">{displayName}</span>
                {isDiscussion ? (
                  <span className="discussion-tag">Hỏi đáp / Thảo luận</span>
                ) : null}
                {item.isPurchased ? (
                  <span
                    className="purchased-badge"
                    title={isDiscussion ? undefined : 'Đã mua và nhận sách thành công'}
                  >
                    ✓ Đã mua hàng
                  </span>
                ) : null}
              </div>
              <div className="review-date">{formattedDate}</div>
            </div>
          </div>

          {!isDiscussion ? <StarRatingDisplay rate={item.rate} /> : null}
        </div>

        <p className="review-content">
          {item.value || (!isDiscussion ? <em style={{ color: '#9ca3af' }}>(Người mua chỉ chấm điểm sao)</em> : null)}
        </p>

        {canReplyToItem || isAuthor ? (
          <div className="review-actions">
            {canReplyToItem ? (
              <button
                type="button"
                className="btn-review-action btn-review-reply"
                onClick={() => handleOpenReply(item.id, displayName, displayName)}
                disabled={submitting}
              >
                {isDiscussion ? '↩️ Trả lời' : '↩️ Phản hồi đánh giá'}
              </button>
            ) : null}
            {isAuthor ? (
              <>
                <button
                  type="button"
                  className="btn-review-action btn-review-edit"
                  onClick={() => handleStartEdit(item, false)}
                  disabled={submitting}
                >
                  ✏️ Chỉnh sửa
                </button>
                <button
                  type="button"
                  className="btn-review-action btn-review-delete"
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={submitting}
                >
                  {isDiscussion ? '🗑️ Xóa thảo luận' : '🗑️ Xóa đánh giá'}
                </button>
              </>
            ) : null}
          </div>
        ) : null}

        {Array.isArray(item.replies) && item.replies.length > 0 ? (
          <div className="review-replies-list">
            {item.replies.map((reply) => {
              const isReplyAuthor = Boolean(
                isAuthenticated &&
                currentUserId &&
                reply.user_id &&
                String(reply.user_id).toLowerCase() === String(currentUserId).toLowerCase()
              )
              const replyAuthor = getAuthorDisplay(reply, 'Thành viên')
              const isEditingThisReply = editingId === reply.id

              if (isEditingThisReply) {
                return (
                  <div key={`${cardKeyPrefix}-reply-edit-${reply.id}`} className="review-reply-item">
                    <h5 className="reply-edit-title">Chỉnh sửa phản hồi của bạn</h5>
                    <form onSubmit={handleUpdateSubmit}>
                      <textarea
                        className="review-textarea review-reply-textarea"
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

              const replyCandidateNames = [
                displayName,
                ...(Array.isArray(item.replies)
                  ? item.replies.map((r) => getAuthorDisplay(r, 'Thành viên').displayName)
                  : [])
              ]
              const targetInfo = resolveReplyTargetAndContent(
                reply,
                displayName,
                replyCandidateNames
              )

              return (
                <div key={`${cardKeyPrefix}-reply-${reply.id}`} className="review-reply-item">
                  <div className="review-reply-header">
                    {replyAuthor.avatarUrl ? (
                      <img
                        src={replyAuthor.avatarUrl}
                        alt={replyAuthor.displayName}
                        className="author-avatar reply-avatar"
                      />
                    ) : (
                      <div className="author-avatar reply-avatar">{replyAuthor.initialLetter}</div>
                    )}
                    <div className="author-details">
                      <div className="author-name-row">
                        <span className="author-name">{replyAuthor.displayName}</span>
                        {targetInfo.targetName ? (
                          <span
                            className="reply-target-tag"
                            title={`Trả lời ${targetInfo.targetName}`}
                          >
                            <span className="reply-target-arrow">&gt;</span>
                            <span className="reply-target-name">{targetInfo.targetName}</span>
                          </span>
                        ) : null}
                        {reply.user_isAdmin ? (
                          <span className="admin-reply-badge">Quản trị viên</span>
                        ) : null}
                        {reply.isPurchased ? (
                          <span className="purchased-badge">✓ Đã mua hàng</span>
                        ) : null}
                      </div>
                      <div className="review-date">{formatReviewDate(reply.createdAt)}</div>
                    </div>
                  </div>
                  <p className="review-reply-content">
                    {targetInfo.mentionPrefix ? (
                      <span className="review-mention-highlight">{targetInfo.mentionPrefix}</span>
                    ) : null}
                    {targetInfo.mentionPrefix && targetInfo.cleanContent ? ' ' : ''}
                    {targetInfo.cleanContent || (targetInfo.mentionPrefix ? '' : reply.value)}
                  </p>
                  {canReplyToItem || isReplyAuthor ? (
                    <div className="review-reply-actions">
                      {canReplyToItem ? (
                        <button
                          type="button"
                          className="btn-review-action btn-review-reply"
                          onClick={() => handleOpenReply(item.id, replyAuthor.displayName, replyAuthor.displayName)}
                          disabled={submitting}
                        >
                          ↩️ Trả lời
                        </button>
                      ) : null}
                      {isReplyAuthor ? (
                        <>
                          <button
                            type="button"
                            className="btn-review-action btn-review-edit"
                            onClick={() => handleStartEdit(reply, true)}
                            disabled={submitting}
                          >
                            ✏️ Chỉnh sửa
                          </button>
                          <button
                            type="button"
                            className="btn-review-action btn-review-delete"
                            onClick={() => handleDeleteItem(reply.id)}
                            disabled={submitting}
                          >
                            🗑️ Xóa
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : null}

        {replyingToId === item.id ? (
          <form className="review-reply-form-box" onSubmit={(e) => handleSubmitReply(e, item.id)}>
            <div className="reply-form-target">
              Đang trả lời <strong>{replyingTargetName || displayName}</strong>
            </div>
            <textarea
              className="review-textarea review-reply-textarea"
              placeholder={`Viết phản hồi cho ${replyingTargetName || displayName}...`}
              value={replyValue}
              maxLength={1000}
              onChange={(e) => setReplyValue(e.target.value)}
            />
            <div className="form-footer">
              <span className="char-counter">{replyValue.length}/1000 ký tự</span>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="filter-btn"
                  onClick={handleCancelReply}
                  disabled={submitting}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn-submit-review"
                  disabled={submitting}
                >
                  {submitting ? 'Đang gửi...' : 'Gửi phản hồi'}
                </button>
              </div>
            </div>
          </form>
        ) : null}
      </article>
    )
  }

  const avgScore = Number(summary.averageRate || 0).toFixed(1)
  const totalReviewCount = Number(summary.totalReviews || 0)
  const totalDiscussionCount = Number(summary.totalDiscussions || 0)
  const shouldRenderPinnedOwnReview = Boolean(isAuthenticated && userReview)
  const listReviews = shouldRenderPinnedOwnReview
    ? reviews.filter((rev) => rev.id !== userReview.id)
    : reviews
  const paginationItems = getPaginationNumbers(page, totalPages)

  return (
    <section id="book-reviews-section" className="reviews-container" aria-label="Đánh giá và thảo luận từ độc giả">
      <div className="reviews-tab-nav">
        <button
          type="button"
          className={`reviews-tab-btn ${activeTab === 'reviews' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('reviews')
            handleCancelEdit()
            handleCancelReply()
          }}
        >
          ⭐ Đánh giá từ người mua ({totalReviewCount})
        </button>
        <button
          type="button"
          className={`reviews-tab-btn ${activeTab === 'discussions' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('discussions')
            handleCancelEdit()
            handleCancelReply()
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
          ) : shouldRenderPinnedOwnReview ? (
            renderCommentCard(userReview, { isDiscussion: false, attachOwnRef: true, cardKeyPrefix: 'pinned-own' })
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
              onClick={() => handleSelectStarFilter(null)}
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
                  onClick={() => handleSelectStarFilter(s)}
                >
                  {s} sao ({count})
                </button>
              )
            })}
          </div>

          <div className="reviews-list-stage">
            {loading && reviews.length === 0 ? (
              <div className="reviews-empty-box">Đang tải danh sách đánh giá...</div>
            ) : listReviews.length === 0 ? (
              <div className="reviews-empty-box">
                <div className="reviews-empty-icon">💬</div>
                <p>
                  {reviews.length > 0 && shouldRenderPinnedOwnReview
                    ? totalPages > 1
                      ? 'Không còn đánh giá nào khác ở trang này ngoài bài của bạn đã ghim ở trên.'
                      : selectedStar
                        ? `Chưa có đánh giá ${selectedStar} sao nào khác ngoài bài của bạn đã ghim ở trên.`
                        : 'Hiện chưa có đánh giá nào khác ngoài bài của bạn đã ghim ở trên.'
                    : selectedStar
                      ? `Chưa có bài đánh giá nào ${selectedStar} sao.`
                      : 'Chưa có bài đánh giá nào từ người mua. Hãy là người đầu tiên đánh giá sau khi nhận sách!'}
                </p>
              </div>
            ) : (
              <div className="reviews-list" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
                {listReviews.map((rev) =>
                  renderCommentCard(rev, {
                    isDiscussion: false,
                    attachOwnRef: false,
                    cardKeyPrefix: 'rev'
                  })
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div>
          {!isAuthenticated ? (
            <div className="login-prompt-banner">
              <p className="login-prompt-text">
                Đăng nhập để tham gia đặt câu hỏi và trao đổi cùng cộng đồng độc giả BookWeb.
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

          <div className="reviews-list-stage">
            {loading && discussions.length === 0 ? (
              <div className="reviews-empty-box">Đang tải danh sách thảo luận...</div>
            ) : discussions.length === 0 ? (
              <div className="reviews-empty-box">
                <div className="reviews-empty-icon">💭</div>
                <p>Chưa có câu hỏi hay thảo luận nào. Hãy là người đầu tiên đặt câu hỏi về cuốn sách này!</p>
              </div>
            ) : (
              <div className="reviews-list" style={{ opacity: loading ? 0.65 : 1, transition: 'opacity 0.15s ease' }}>
                {discussions.map((disc) =>
                  renderCommentCard(disc, { isDiscussion: true, cardKeyPrefix: 'disc' })
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="reviews-pagination">
          <button
            type="button"
            className="btn-page"
            disabled={page <= 1 || loading}
            onClick={() => {
              handleCancelEdit()
              handleCancelReply()
              fetchReviewsData(activeTab, page - 1)
            }}
          >
            ←
          </button>
          {paginationItems.map((item) =>
            typeof item === 'string' ? (
              <span key={item} style={{ padding: '0 4px', color: '#8c8273' }}>...</span>
            ) : (
              <button
                type="button"
                key={item}
                className={`btn-page ${page === item ? 'active' : ''}`}
                disabled={loading}
                onClick={() => {
                  handleCancelEdit()
                  handleCancelReply()
                  fetchReviewsData(activeTab, item)
                }}
              >
                {item}
              </button>
            )
          )}
          <button
            type="button"
            className="btn-page"
            disabled={page >= totalPages || loading}
            onClick={() => {
              handleCancelEdit()
              handleCancelReply()
              fetchReviewsData(activeTab, page + 1)
            }}
          >
            →
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default BookReviews
