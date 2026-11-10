import { memo, useState, useEffect, useMemo } from 'react'
import debounce from 'lodash.debounce'

function formatDate(dateStr) {
  if (!dateStr) return '—'
  try {
    const raw = String(dateStr).trim()
    const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (match) {
      const [, year, month, day, hours, minutes] = match
      return `${hours}:${minutes} ${day}/${month}/${year}`
    }
    const d = new Date(raw)
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
  } catch {
    return dateStr
  }
}

function AdminReviewTable({
  reviews = [],
  total = 0,
  page = 1,
  totalPages = 1,
  loading = false,
  search = '',
  statusFilter = 'all',
  rateFilter = 'all',
  onSearchChange,
  onStatusFilterChange,
  onRateFilterChange,
  onPageChange,
  onToggleStatus,
}) {
  const [localSearch, setLocalSearch] = useState(search)
  const [prevSearch, setPrevSearch] = useState(search)
  const [selectedReview, setSelectedReview] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  if (search !== prevSearch) {
    setPrevSearch(search)
    setLocalSearch(search)
  }

  const debouncedSearch = useMemo(
    () =>
      debounce((val) => {
        onSearchChange(val)
      }, 400),
    [onSearchChange]
  )

  useEffect(() => {
    return () => {
      debouncedSearch.cancel()
    }
  }, [debouncedSearch])

  const handleInputChange = (e) => {
    const val = e.target.value
    setLocalSearch(val)
    debouncedSearch(val)
  }

  const handleActionToggle = async (rev) => {
    setIsUpdatingStatus(true)
    try {
      await onToggleStatus(rev)
      if (selectedReview && selectedReview.id === rev.id) {
        setSelectedReview({
          ...selectedReview,
          isDelete: selectedReview.isDelete ? 0 : 1
        })
      }
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <div className="admin-table-container">
      <div className="admin-toolbar">
        <div className="admin-toolbar-filters">
          <input
            type="text"
            className="admin-search-input"
            placeholder="Tìm theo nội dung, tên sách, độc giả..."
            value={localSearch}
            onChange={handleInputChange}
          />
          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="0">🟢 Đang hiển thị</option>
            <option value="1">🔒 Đã ẩn vi phạm</option>
          </select>
          <select
            className="admin-filter-select"
            value={rateFilter}
            onChange={(e) => onRateFilterChange(e.target.value)}
          >
            <option value="all">Tất cả đánh giá / bình luận</option>
            <option value="5">★★★★★ 5 sao</option>
            <option value="4">★★★★☆ 4 sao</option>
            <option value="3">★★★☆☆ 3 sao</option>
            <option value="2">★★☆☆☆ 2 sao</option>
            <option value="1">★☆☆☆☆ 1 sao</option>
            <option value="discussion">💬 Thảo luận & Hỏi đáp</option>
          </select>
        </div>
      </div>

      <div className="admin-table-wrapper">
        <table className="admin-table">
          <thead>
            <tr>
              <th style={{ width: '70px', textAlign: 'center' }}>Mã</th>
              <th style={{ minWidth: '200px' }}>Tên ấn phẩm</th>
              <th style={{ minWidth: '160px' }}>Độc giả</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Đánh giá</th>
              <th style={{ minWidth: '240px' }}>Nội dung nhận xét</th>
              <th style={{ width: '130px', textAlign: 'center' }}>Trạng thái</th>
              <th style={{ width: '130px' }}>Thời gian</th>
              <th style={{ width: '160px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Đang tải danh sách bài đánh giá...
                </td>
              </tr>
            ) : reviews.length === 0 ? (
              <tr>
                <td colSpan="8" className="admin-table-empty">
                  Không tìm thấy bài đánh giá nào phù hợp.
                </td>
              </tr>
            ) : (
              reviews.map((rev) => {
                const isHidden = Boolean(rev.isDelete)
                const isRating = rev.rate !== null && rev.rate !== undefined

                return (
                  <tr key={rev.id} style={{ opacity: isHidden ? 0.65 : 1 }}>
                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#e7b26a' }}>
                      #{rev.id}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#fffaf1', lineHeight: 1.35 }}>
                        {rev.book_title || `Sách #${rev.book_id}`}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#8c857b', marginTop: '2px' }}>
                        ID sách: #{rev.book_id}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {rev.user_avatar ? (
                          <img
                            src={rev.user_avatar}
                            alt=""
                            style={{ width: '28px', height: '28px', borderRadius: '50%', objectFit: 'cover' }}
                          />
                        ) : (
                          <div
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '50%',
                              background: '#3d3a35',
                              color: '#e7b26a',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '12px',
                              fontWeight: 700
                            }}
                          >
                            {(rev.user_full_name || rev.user_username || 'U').charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#f3eadb' }}>
                            {rev.user_full_name || rev.user_username || 'Người dùng'}
                          </div>
                          {rev.user_username && rev.user_full_name ? (
                            <div style={{ fontSize: '0.75rem', color: '#8c857b' }}>
                              @{rev.user_username}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isRating ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '2px',
                            background: '#362817',
                            color: '#f59e0b',
                            border: '1px solid #784c17',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 700,
                            fontSize: '0.82rem'
                          }}
                        >
                          {rev.rate} ★
                        </span>
                      ) : (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            background: '#1a2736',
                            color: '#60a5fa',
                            border: '1px solid #1e40af',
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontWeight: 600,
                            fontSize: '0.78rem'
                          }}
                        >
                          💬 Thảo luận
                        </span>
                      )}
                    </td>
                    <td>
                      <div
                        style={{
                          fontSize: '0.88rem',
                          color: '#e2dacd',
                          lineHeight: 1.4,
                          maxWidth: '300px',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}
                        title={rev.value || ''}
                      >
                        {rev.value || <span style={{ fontStyle: 'italic', color: '#8c857b' }}>Không có nội dung</span>}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isHidden ? (
                        <span className="admin-status-badge blocked" style={{ background: '#3b1818', color: '#fca5a5', border: '1px solid #7f1d1d' }}>
                          🔒 Đã ẩn
                        </span>
                      ) : (
                        <span className="admin-status-badge active">
                          🟢 Hiển thị
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#a8a29e' }}>
                      {formatDate(rev.createdAt)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          className="admin-btn-action"
                          onClick={() => setSelectedReview(rev)}
                          title="Xem chi tiết nội dung"
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                        >
                          👁️ Chi tiết
                        </button>
                        <button
                          type="button"
                          className={`admin-btn-action ${isHidden ? 'restore' : 'danger'}`}
                          onClick={() => handleActionToggle(rev)}
                          disabled={isUpdatingStatus}
                          title={isHidden ? 'Khôi phục hiển thị bài viết' : 'Ẩn bài viết khỏi người xem'}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.8rem',
                            color: isHidden ? '#86efac' : '#fca5a5',
                            borderColor: isHidden ? '#166534' : '#7f1d1d'
                          }}
                        >
                          {isHidden ? '🟢 Mở lại' : '🔒 Ẩn'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="admin-pagination">
          <button
            type="button"
            className="admin-page-btn"
            disabled={page <= 1 || loading}
            onClick={() => onPageChange(page - 1)}
          >
            ← Trước
          </button>
          <span className="admin-page-info">
            Trang <strong>{page}</strong> / {totalPages} ({total} bài viết)
          </span>
          <button
            type="button"
            className="admin-page-btn"
            disabled={page >= totalPages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Sau →
          </button>
        </div>
      ) : null}

      {selectedReview ? (
        <div className="admin-modal-backdrop" onClick={() => setSelectedReview(null)}>
          <div className="admin-modal admin-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '580px' }}>
            <div className="admin-modal-header">
              <h3 className="admin-modal-title">Chi tiết bài đánh giá #{selectedReview.id}</h3>
              <button
                type="button"
                className="admin-modal-close"
                onClick={() => setSelectedReview(null)}
              >
                ×
              </button>
            </div>

            <div className="admin-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', background: '#21201d', padding: '14px', borderRadius: '10px', border: '1px solid #383530' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#8c857b', display: 'block' }}>Ấn phẩm sách:</span>
                  <strong style={{ color: '#fffaf1', fontSize: '0.95rem' }}>{selectedReview.book_title || `Sách #${selectedReview.book_id}`}</strong>
                  <div style={{ fontSize: '0.78rem', color: '#e7b26a' }}>Mã sách: #{selectedReview.book_id}</div>
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#8c857b', display: 'block' }}>Người gửi:</span>
                  <strong style={{ color: '#fffaf1', fontSize: '0.95rem' }}>{selectedReview.user_full_name || selectedReview.user_username || 'Độc giả'}</strong>
                  {selectedReview.user_username ? (
                    <div style={{ fontSize: '0.78rem', color: '#a8a29e' }}>@{selectedReview.user_username}</div>
                  ) : null}
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 2px' }}>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#8c857b', marginRight: '8px' }}>Hình thức:</span>
                  {selectedReview.rate !== null && selectedReview.rate !== undefined ? (
                    <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1rem' }}>
                      {selectedReview.rate} ★ (Đánh giá chất lượng)
                    </span>
                  ) : (
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                      💬 Câu hỏi / Thảo luận
                    </span>
                  )}
                </div>
                <div>
                  <span style={{ fontSize: '0.8rem', color: '#8c857b', marginRight: '8px' }}>Trạng thái:</span>
                  {selectedReview.isDelete ? (
                    <span style={{ color: '#fca5a5', fontWeight: 600 }}>🔒 Đang bị ẩn</span>
                  ) : (
                    <span style={{ color: '#86efac', fontWeight: 600 }}>🟢 Đang hiển thị</span>
                  )}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '0.8rem', color: '#8c857b', display: 'block', marginBottom: '6px' }}>
                  Nội dung nhận xét:
                </span>
                <div
                  style={{
                    background: '#1a1917',
                    border: '1px solid #383530',
                    borderRadius: '8px',
                    padding: '14px',
                    color: '#f3eadb',
                    fontSize: '0.92rem',
                    lineHeight: 1.6,
                    maxHeight: '220px',
                    overflowY: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {selectedReview.value || <span style={{ fontStyle: 'italic', color: '#8c857b' }}>Người dùng không để lại bình luận văn bản.</span>}
                </div>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#8c857b', textAlign: 'right' }}>
                Thời gian tạo: {formatDate(selectedReview.createdAt)}
              </div>
            </div>

            <div className="admin-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', padding: '16px 24px', borderTop: '1px solid #383530' }}>
              <button
                type="button"
                className={`admin-btn-action ${selectedReview.isDelete ? 'restore' : 'danger'}`}
                onClick={() => handleActionToggle(selectedReview)}
                disabled={isUpdatingStatus}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.88rem',
                  color: selectedReview.isDelete ? '#86efac' : '#fca5a5',
                  borderColor: selectedReview.isDelete ? '#166534' : '#7f1d1d'
                }}
              >
                {selectedReview.isDelete ? '🟢 Khôi phục hiển thị' : '🔒 Khóa ẩn bài viết'}
              </button>

              <button
                type="button"
                className="admin-btn-secondary"
                onClick={() => setSelectedReview(null)}
                style={{ padding: '8px 18px', borderRadius: '8px' }}
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default memo(AdminReviewTable)

