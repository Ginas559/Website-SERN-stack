import { memo, useState, useEffect, useMemo } from 'react'
import debounce from 'lodash.debounce'
import { RefreshIcon, MaterialCommunityIcon } from './common/Icons'
import AdminConfirmModal from './AdminConfirmModal'

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
  onResetFilters,
  onPageChange,
  onToggleStatus,
}) {
  const [localSearch, setLocalSearch] = useState(search)
  const [prevSearch, setPrevSearch] = useState(search)
  const [sortBy, setSortBy] = useState('id')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedReview, setSelectedReview] = useState(null)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)
  const [pendingStatusReview, setPendingStatusReview] = useState(null)

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

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortOrder(field === 'book_title' || field === 'user_name' ? 'asc' : 'desc')
    }
  }

  const handleResetFilters = () => {
    setLocalSearch('')
    debouncedSearch.cancel()
    setSortBy('id')
    setSortOrder('desc')
    if (onResetFilters) {
      onResetFilters()
    } else {
      if (search !== '' && onSearchChange) onSearchChange('')
      if (statusFilter !== 'all' && onStatusFilterChange) onStatusFilterChange('all')
      if (rateFilter !== 'all' && onRateFilterChange) onRateFilterChange('all')
      if (page !== 1 && onPageChange) onPageChange(1)
    }
  }

  const renderSortIndicator = (field) => {
    if (sortBy === field) {
      return (
        <span className="admin-sort-indicator active">
          {sortOrder === 'asc' ? '▲' : '▼'}
        </span>
      )
    }
    return <span className="admin-sort-indicator">↕</span>
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

  const sortedReviews = useMemo(() => {
    if (!reviews || !Array.isArray(reviews)) return []
    const list = [...reviews]
    return list.sort((a, b) => {
      let valA = a[sortBy]
      let valB = b[sortBy]
      if (sortBy === 'book_title' || sortBy === 'user_name') {
        return sortOrder === 'asc'
          ? String(valA || '').localeCompare(String(valB || ''), 'vi')
          : String(valB || '').localeCompare(String(valA || ''), 'vi')
      }
      if (sortBy === 'createdAt') {
        const timeA = valA ? new Date(valA).getTime() : 0
        const timeB = valB ? new Date(valB).getTime() : 0
        return sortOrder === 'asc' ? timeA - timeB : timeB - timeA
      }
      if (sortBy === 'rate') {
        const numA = valA !== null && valA !== undefined ? Number(valA) : -1
        const numB = valB !== null && valB !== undefined ? Number(valB) : -1
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }
      if (sortBy === 'isDelete') {
        const numA = a.isDelete ? 1 : 0
        const numB = b.isDelete ? 1 : 0
        return sortOrder === 'asc' ? numA - numB : numB - numA
      }
      const numA = Number(valA) || 0
      const numB = Number(valB) || 0
      return sortOrder === 'asc' ? numA - numB : numB - numA
    })
  }, [reviews, sortBy, sortOrder])

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
            <option value="0">Đang hiển thị</option>
            <option value="1">Đã ẩn vi phạm</option>
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
             <option value="discussion">Thảo luận &amp; Hỏi đáp</option>
          </select>
          <button
            type="button"
            className="admin-btn-reset-filters"
            onClick={handleResetFilters}
            title="Đặt lại toàn bộ tìm kiếm, bộ lọc và sắp xếp về ban đầu"
          >
            <RefreshIcon size={14} />
            <span>Xóa bộ lọc</span>
          </button>
        </div>
      </div>

      <div className="admin-table-wrapper">
        {loading && sortedReviews.length > 0 && <div className="admin-table-loading-bar" />}
        <table className="admin-table admin-review-table">
          <thead>
            <tr>
              <th
                className={`admin-th-sortable ${sortBy === 'id' ? 'sorted' : ''}`}
                style={{ width: '70px', textAlign: 'center' }}
                onClick={() => handleSort('id')}
                title="Nhấn để sắp xếp theo Mã"
              >
                Mã {renderSortIndicator('id')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'book_title' ? 'sorted' : ''}`}
                style={{ width: '210px' }}
                onClick={() => handleSort('book_title')}
                title="Nhấn để sắp xếp theo Tên ấn phẩm"
              >
                Tên ấn phẩm {renderSortIndicator('book_title')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'user_name' ? 'sorted' : ''}`}
                style={{ width: '170px' }}
                onClick={() => handleSort('user_name')}
                title="Nhấn để sắp xếp theo Độc giả"
              >
                Người gửi {renderSortIndicator('user_name')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'rate' ? 'sorted' : ''}`}
                style={{ width: '130px', textAlign: 'center' }}
                onClick={() => handleSort('rate')}
                title="Nhấn để sắp xếp theo Điểm đánh giá sao"
              >
                Đánh giá {renderSortIndicator('rate')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'isDelete' ? 'sorted' : ''}`}
                style={{ width: '130px', textAlign: 'center' }}
                onClick={() => handleSort('isDelete')}
                title="Nhấn để sắp xếp theo Trạng thái"
              >
                Trạng thái {renderSortIndicator('isDelete')}
              </th>
              <th
                className={`admin-th-sortable ${sortBy === 'createdAt' ? 'sorted' : ''}`}
                style={{ width: '130px' }}
                onClick={() => handleSort('createdAt')}
                title="Nhấn để sắp xếp theo Thời gian (Mới nhất / Cũ nhất)"
              >
                Thời gian {renderSortIndicator('createdAt')}
              </th>
              <th style={{ width: '120px', textAlign: 'center' }}>Thao tác</th>
            </tr>
          </thead>
          <tbody className={loading && sortedReviews.length > 0 ? 'admin-tbody-loading' : ''}>
            {loading && sortedReviews.length === 0 ? (
              <tr>
                  <td colSpan="7" className="admin-table-empty">
                  Đang tải danh sách bài đánh giá...
                </td>
              </tr>
            ) : sortedReviews.length === 0 ? (
              <tr>
                  <td colSpan="7" className="admin-table-empty">
                  Không tìm thấy đánh giá hoặc bình luận nào.
                </td>
              </tr>
            ) : (
              sortedReviews.map((rev) => {
                const isHidden = Boolean(rev.isDelete)
                const isRating = rev.rate !== null && rev.rate !== undefined

                return (
                  <tr
                    key={rev.id}
                    className={`${isHidden ? 'admin-row-muted ' : ''}admin-review-clickable-row`}
                    onClick={() => setSelectedReview(rev)}
                    title="Bấm để xem chi tiết"
                  >
                    <td style={{ textAlign: 'center', fontWeight: 'bold', color: '#0088a9' }}>
                      #{rev.id}
                    </td>
                    <td className="admin-review-book-cell">
                      <div className="admin-review-primary">
                        {rev.book_title || <span style={{ color: '#64748b' }}>Sách #{rev.book_id}</span>}
                      </div>
                    </td>
                    <td className="admin-review-user-cell">
                      <div className="admin-review-primary admin-review-user-name">
                        {rev.user_name || rev.user_full_name || rev.user_username || 'Khách hàng'}
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isRating ? (
                         <span className="admin-review-stars">
                          {'★'.repeat(rev.rate)}{'☆'.repeat(5 - rev.rate)}
                          <span style={{ fontSize: '0.8rem', marginLeft: '4px', color: '#64748b' }}>
                            ({rev.rate})
                          </span>
                        </span>
                      ) : rev.parent_id ? (
                        <span
                          className="admin-review-type reply"
                        >
                            <MaterialCommunityIcon name="arrow-u-turn-left" size={14} /> Phản hồi
                        </span>
                      ) : (
                        <span
                          className="admin-review-type discussion"
                        >
                          <MaterialCommunityIcon name="message" size={14} /> Thảo luận
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isHidden ? (
                        <span className="admin-status-badge blocked" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' }}>
                           <MaterialCommunityIcon name="lock" size={14} /> Đã ẩn
                        </span>
                      ) : (
                        <span className="admin-status-badge active">
                           <MaterialCommunityIcon name="check-circle-outline" size={14} /> Hiển thị
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      {formatDate(rev.createdAt)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div className="admin-review-actions">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            setPendingStatusReview(rev)
                          }}
                          disabled={isUpdatingStatus}
                          title={isHidden ? 'Khôi phục hiển thị bài viết' : 'Ẩn bài viết khỏi người xem'}
                          className={`admin-btn-action ${isHidden ? 'restore' : 'danger'} admin-review-action`}
                        >
                           <><MaterialCommunityIcon name={isHidden ? 'check-circle-outline' : 'lock'} size={15} />{isHidden ? 'Mở lại' : 'Ẩn'}</>
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
          <div className="admin-modal admin-modal-card admin-review-modal" onClick={(e) => e.stopPropagation()}>
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

            <div className="admin-modal-body admin-review-modal-body">
              <div className="admin-review-meta-grid">
                <div className="admin-review-meta-item">
                  <span>Ấn phẩm sách</span>
                  <strong>{selectedReview.book_title || `Sách #${selectedReview.book_id}`}</strong>
                  <small>Mã sách: #{selectedReview.book_id}</small>
                </div>
                <div className="admin-review-meta-item">
                  <span>Người gửi</span>
                  <strong>{selectedReview.user_full_name || selectedReview.user_username || 'Độc giả'}</strong>
                  {selectedReview.user_username ? (
                    <small>@{selectedReview.user_username}</small>
                  ) : null}
                </div>
              </div>

              <div className="admin-review-detail-grid">
                <div className="admin-review-detail-item">
                  <span>Hình thức</span>
                  {selectedReview.rate !== null && selectedReview.rate !== undefined ? (
                    <span style={{ color: '#f59e0b', fontWeight: 700, fontSize: '1rem' }}>
                       <MaterialCommunityIcon name="star" size={15} /> {selectedReview.rate} (Đánh giá chất lượng)
                    </span>
                  ) : selectedReview.parent_id ? (
                    <span style={{ color: '#7e22ce', fontWeight: 600 }}>
                       <MaterialCommunityIcon name="arrow-u-turn-left" size={15} /> Trả lời {selectedReview.parent_user_full_name || selectedReview.parent_user_username ? `@${selectedReview.parent_user_full_name || selectedReview.parent_user_username}` : `bình luận #${selectedReview.parent_id}`}
                    </span>
                  ) : (
                    <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                       <MaterialCommunityIcon name="message" size={15} /> Câu hỏi / Thảo luận
                    </span>
                  )}
                </div>
                <div className="admin-review-detail-item">
                  <span>Trạng thái</span>
                  {selectedReview.isDelete ? (
                     <span style={{ color: '#fca5a5', fontWeight: 600 }}><MaterialCommunityIcon name="lock" size={15} /> Đang bị ẩn</span>
                  ) : (
                     <span style={{ color: '#86efac', fontWeight: 600 }}><MaterialCommunityIcon name="check-circle-outline" size={15} /> Đang hiển thị</span>
                  )}
                </div>
              </div>

              <div className="admin-review-message-block">
                <span>Nội dung nhận xét</span>
                <div className="admin-review-message">
                  {selectedReview.value || <span style={{ fontStyle: 'italic', color: '#64748b' }}>Người dùng không để lại bình luận văn bản.</span>}
                </div>
              </div>

              <div className="admin-review-created-at">
                Tạo lúc {formatDate(selectedReview.createdAt)}
              </div>
            </div>

            <div className="admin-modal-footer admin-review-modal-footer">
              <button
                type="button"
                className={`admin-btn-action ${selectedReview.isDelete ? 'restore' : 'danger'}`}
                onClick={() => setPendingStatusReview(selectedReview)}
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
                 <><MaterialCommunityIcon name={selectedReview.isDelete ? 'check-circle-outline' : 'lock'} size={15} />{selectedReview.isDelete ? 'Khôi phục hiển thị' : 'Khóa ẩn bài viết'}</>
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

      <AdminConfirmModal
        isOpen={Boolean(pendingStatusReview)}
        title={pendingStatusReview?.isDelete ? 'Xác nhận khôi phục nội dung' : 'Xác nhận ẩn nội dung'}
        message={pendingStatusReview?.isDelete ? 'Bạn có muốn hiển thị lại đánh giá hoặc bình luận này không?' : 'Bạn có muốn ẩn đánh giá hoặc bình luận này khỏi website không?'}
        confirmLabel={pendingStatusReview?.isDelete ? 'Xác nhận khôi phục' : 'Xác nhận ẩn'}
        danger={!pendingStatusReview?.isDelete}
        onCancel={() => setPendingStatusReview(null)}
        onConfirm={() => {
          const review = pendingStatusReview
          setPendingStatusReview(null)
          handleActionToggle(review)
        }}
      />
    </div>
  )
}

export default memo(AdminReviewTable)
