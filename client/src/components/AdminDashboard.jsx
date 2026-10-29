import { useState, useEffect, useCallback } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import {
  fetchAdminBooks,
  createBook,
  updateBook,
  updateBookStatus,
} from '../store/slices/bookSlice'
import {
  fetchCategories,
  createCategory,
  updateCategory,
  updateCategoryStatus,
} from '../store/slices/categorySlice'
import AdminBookTable from './AdminBookTable'
import AdminBookModal from './AdminBookModal'
import AdminCategoryTable from './AdminCategoryTable'
import AdminCategoryModal from './AdminCategoryModal'
import './AdminDashboard.css'

function AdminDashboard() {
  const dispatch = useDispatch()
  const {
    adminBooks: books,
    adminTotal: bookTotal,
    adminTotalPages: bookTotalPages,
    loading: booksLoading,
  } = useSelector((state) => state.books)
  const {
    categories,
    loading: categoriesLoading,
  } = useSelector((state) => state.categories)

  const [adminTab, setAdminTab] = useState('books')
  const [bookPage, setBookPage] = useState(1)
  const [bookSearch, setBookSearch] = useState('')
  const [bookStatusFilter, setBookStatusFilter] = useState('all')

  const [categorySearch, setCategorySearch] = useState('')

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

  const fetchBooksData = useCallback(() => {
    const query = {
      page: bookPage,
      limit: 10,
      ...(bookSearch.trim() ? { search: bookSearch.trim() } : {}),
      ...(bookStatusFilter === '0' || bookStatusFilter === '1' ? { isDelete: bookStatusFilter } : {}),
    }
    dispatch(fetchAdminBooks(query))
      .unwrap()
      .catch((err) => {
        showToast(err || 'Không thể tải sách.', 'error')
      })
  }, [bookPage, bookSearch, bookStatusFilter, dispatch, showToast])

  const fetchCategoriesData = useCallback(() => {
    dispatch(fetchCategories())
      .unwrap()
      .catch((err) => {
        showToast(err || 'Không thể tải thể loại.', 'error')
      })
  }, [dispatch, showToast])

  useEffect(() => {
    fetchBooksData()
  }, [fetchBooksData])

  useEffect(() => {
    fetchCategoriesData()
  }, [fetchCategoriesData])

  const handleBookSearchChange = (value) => {
    setBookSearch(value)
    setBookPage(1)
  }

  const handleBookStatusChange = (value) => {
    setBookStatusFilter(value)
    setBookPage(1)
  }

  const handleBookPageChange = (nextPage) => {
    setBookPage(nextPage)
  }

  const handleSaveBook = async (payload, bookId) => {
    if (bookId) {
      await dispatch(updateBook({ id: bookId, data: payload })).unwrap()
      showToast('Cập nhật ấn phẩm thành công!')
    } else {
      await dispatch(createBook(payload)).unwrap()
      showToast('Thêm ấn phẩm mới thành công!')
    }
    fetchBooksData()
    fetchCategoriesData()
  }

  const handleToggleBookStatus = async (book) => {
    const nextStatus = book.isDelete ? 0 : 1
    try {
      await dispatch(updateBookStatus({ id: book.id, isDelete: nextStatus })).unwrap()
      showToast(nextStatus === 1 ? 'Đã ẩn ấn phẩm khỏi cửa hàng.' : 'Đã khôi phục ấn phẩm mở bán.')
      fetchBooksData()
      fetchCategoriesData()
    } catch (err) {
      showToast(err.message || err || 'Lỗi khi cập nhật trạng thái sách.', 'error')
    }
  }

  const handleSaveCategory = async (payload, categoryId) => {
    if (categoryId) {
      await dispatch(updateCategory({ id: categoryId, data: payload })).unwrap()
      showToast('Cập nhật thể loại thành công!')
    } else {
      await dispatch(createCategory(payload)).unwrap()
      showToast('Thêm thể loại mới thành công!')
    }
    fetchCategoriesData()
  }

  const handleToggleCategoryStatus = async (category) => {
    const nextStatus = category.isDelete ? 0 : 1
    try {
      await dispatch(updateCategoryStatus({ id: category.id, isDelete: nextStatus })).unwrap()
      showToast(nextStatus === 1 ? 'Đã ẩn thể loại.' : 'Đã khôi phục thể loại.')
      fetchCategoriesData()
    } catch (err) {
      showToast(err.message || err || 'Lỗi khi cập nhật trạng thái thể loại.', 'error')
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
