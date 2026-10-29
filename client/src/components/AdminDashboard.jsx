import { useState, useEffect, useCallback } from 'react'
import AdminBookTable from './AdminBookTable'
import AdminBookModal from './AdminBookModal'
import AdminCategoryTable from './AdminCategoryTable'
import AdminCategoryModal from './AdminCategoryModal'
import './AdminDashboard.css'

function AdminDashboard({ request }) {
  const [adminTab, setAdminTab] = useState('books')

  const [books, setBooks] = useState([])
  const [bookTotal, setBookTotal] = useState(0)
  const [bookPage, setBookPage] = useState(1)
  const [bookTotalPages, setBookTotalPages] = useState(1)
  const [bookSearch, setBookSearch] = useState('')
  const [bookStatusFilter, setBookStatusFilter] = useState('all')
  const [booksLoading, setBooksLoading] = useState(false)

  const [categories, setCategories] = useState([])
  const [categorySearch, setCategorySearch] = useState('')
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  const [bookModalOpen, setBookModalOpen] = useState(false)
  const [bookModalMode, setBookModalMode] = useState('create')
  const [currentBook, setCurrentBook] = useState(null)

  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [categoryModalMode, setCategoryModalMode] = useState('create')
  const [currentCategory, setCurrentCategory] = useState(null)

  const [toast, setToast] = useState(null)

  const showToast = useCallback((text, type = 'success') => {
    setToast({ text, type })
    setTimeout(() => {
      setToast(null)
    }, 3500)
  }, [])

  const fetchBooks = useCallback(() => {
    let isMounted = true
    const query = new URLSearchParams()
    query.set('page', String(bookPage))
    query.set('limit', '10')
    if (bookSearch.trim()) query.set('search', bookSearch.trim())
    if (bookStatusFilter === '0' || bookStatusFilter === '1') {
      query.set('isDelete', bookStatusFilter)
    }

    request(`/admin/books?${query.toString()}`)
      .then((data) => {
        if (isMounted && data) {
          setBooks(data.books || [])
          setBookTotal(data.total || 0)
          setBookTotalPages(data.totalPages || 1)
        }
      })
      .catch((err) => {
        if (isMounted) showToast(err.message || 'Không thể tải sách.', 'error')
      })
      .finally(() => {
        if (isMounted) setBooksLoading(false)
      })

    return () => { isMounted = false }
  }, [bookPage, bookSearch, bookStatusFilter, request, showToast])

  const fetchCategories = useCallback(() => {
    let isMounted = true
    request('/admin/categories')
      .then((data) => {
        if (isMounted && data) {
          setCategories(Array.isArray(data) ? data : [])
        }
      })
      .catch((err) => {
        if (isMounted) showToast(err.message || 'Không thể tải thể loại.', 'error')
      })
      .finally(() => {
        if (isMounted) setCategoriesLoading(false)
      })

    return () => { isMounted = false }
  }, [request, showToast])

  useEffect(() => {
    return fetchBooks()
  }, [fetchBooks])

  useEffect(() => {
    return fetchCategories()
  }, [fetchCategories])

  const handleBookSearchChange = (value) => {
    setBookSearch(value)
    setBookPage(1)
    setBooksLoading(true)
  }

  const handleBookStatusChange = (value) => {
    setBookStatusFilter(value)
    setBookPage(1)
    setBooksLoading(true)
  }

  const handleBookPageChange = (nextPage) => {
    setBookPage(nextPage)
    setBooksLoading(true)
  }

  const handleSaveBook = async (payload, bookId) => {
    if (bookId) {
      await request(`/admin/books/${bookId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      showToast('Cập nhật ấn phẩm thành công!')
    } else {
      await request('/admin/books', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      showToast('Thêm ấn phẩm mới thành công!')
    }
    setBooksLoading(true)
    fetchBooks()
    fetchCategories()
  }

  const handleToggleBookStatus = async (book) => {
    const nextStatus = book.isDelete ? 0 : 1
    try {
      await request(`/admin/books/${book.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isDelete: nextStatus }),
      })
      showToast(nextStatus === 1 ? 'Đã ẩn ấn phẩm khỏi cửa hàng.' : 'Đã khôi phục ấn phẩm mở bán.')
      setBooksLoading(true)
      fetchBooks()
      fetchCategories()
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái sách.', 'error')
    }
  }

  const handleSaveCategory = async (payload, categoryId) => {
    if (categoryId) {
      await request(`/admin/categories/${categoryId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      showToast('Cập nhật thể loại thành công!')
    } else {
      await request('/admin/categories', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      showToast('Thêm thể loại mới thành công!')
    }
    setCategoriesLoading(true)
    fetchCategories()
  }

  const handleToggleCategoryStatus = async (category) => {
    const nextStatus = category.isDelete ? 0 : 1
    try {
      await request(`/admin/categories/${category.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ isDelete: nextStatus }),
      })
      showToast(nextStatus === 1 ? 'Đã ẩn thể loại.' : 'Đã khôi phục thể loại.')
      setCategoriesLoading(true)
      fetchCategories()
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái thể loại.', 'error')
    }
  }

  return (
    <div className="admin-container">
      {toast && (
        <div className={`admin-toast ${toast.type}`}>
          {toast.text}
        </div>
      )}

      <div className="admin-header">
        <div>
          <span className="admin-eyebrow">HỆ THỐNG QUẢN TRỊ NỘI BỘ</span>
          <h1 className="admin-title">Bảng điều khiển Quản trị viên</h1>
          <p className="admin-subtitle">
            Quản lý kho ấn phẩm, danh mục thể loại sách và thông tin phát hành trên toàn hệ thống SERN Bookstore.
          </p>
        </div>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng số ấn phẩm</div>
          <div className="admin-stat-value">{bookTotal}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Tổng số thể loại</div>
          <div className="admin-stat-value">{categories.length}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Thể loại đang hoạt động</div>
          <div className="admin-stat-value success">
            {categories.filter((c) => !c.isDelete).length}
          </div>
        </div>
      </div>

      <div className="admin-navigation-tabs">
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'books' ? 'active' : ''}`}
          onClick={() => setAdminTab('books')}
        >
          📚 Quản lý Ấn phẩm Sách
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'categories' ? 'active' : ''}`}
          onClick={() => setAdminTab('categories')}
        >
          🏷️ Quản lý Thể loại Sách
        </button>
      </div>

      {adminTab === 'books' ? (
        <AdminBookTable
          books={books}
          total={bookTotal}
          page={bookPage}
          totalPages={bookTotalPages}
          loading={booksLoading}
          search={bookSearch}
          statusFilter={bookStatusFilter}
          onSearchChange={handleBookSearchChange}
          onStatusFilterChange={handleBookStatusChange}
          onPageChange={handleBookPageChange}
          onOpenCreate={() => {
            setCurrentBook(null)
            setBookModalMode('create')
            setBookModalOpen(true)
          }}
          onOpenEdit={(book) => {
            setCurrentBook(book)
            setBookModalMode('edit')
            setBookModalOpen(true)
          }}
          onToggleStatus={handleToggleBookStatus}
        />
      ) : (
        <AdminCategoryTable
          categories={categories}
          loading={categoriesLoading}
          search={categorySearch}
          onSearchChange={(value) => setCategorySearch(value)}
          onOpenCreate={() => {
            setCurrentCategory(null)
            setCategoryModalMode('create')
            setCategoryModalOpen(true)
          }}
          onOpenEdit={(category) => {
            setCurrentCategory(category)
            setCategoryModalMode('edit')
            setCategoryModalOpen(true)
          }}
          onToggleStatus={handleToggleCategoryStatus}
        />
      )}

      <AdminBookModal
        isOpen={bookModalOpen}
        mode={bookModalMode}
        book={currentBook}
        categories={categories.filter((c) => !c.isDelete)}
        onClose={() => setBookModalOpen(false)}
        onSave={handleSaveBook}
      />

      <AdminCategoryModal
        isOpen={categoryModalOpen}
        mode={categoryModalMode}
        category={currentCategory}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
      />
    </div>
  )
}

export default AdminDashboard
