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
import AdminOrderTable from './AdminOrderTable'
import orderService from '../services/orderService'
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

  const [adminOrders, setAdminOrders] = useState([])
  const [orderTotal, setOrderTotal] = useState(0)
  const [orderPage, setOrderPage] = useState(1)
  const [orderTotalPages, setOrderTotalPages] = useState(1)
  const [orderSearch, setOrderSearch] = useState('')
  const [orderStatusFilter, setOrderStatusFilter] = useState('all')
  const [orderPaymentFilter, setOrderPaymentFilter] = useState('all')
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [orderRefreshTrigger, setOrderRefreshTrigger] = useState(0)

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

  useEffect(() => {
    if (adminTab !== 'orders') return
    let isCurrent = true
    orderService.getAdminOrders({
      page: orderPage,
      limit: 10,
      ...(orderSearch.trim() ? { search: orderSearch.trim() } : {}),
      ...(orderStatusFilter !== 'all' ? { status: orderStatusFilter } : {}),
      ...(orderPaymentFilter !== 'all' ? { paymentMethod: orderPaymentFilter } : {}),
    })
      .then((res) => {
        if (!isCurrent) return
        setAdminOrders(res.data?.orders || [])
        setOrderTotal(res.data?.total || 0)
        setOrderTotalPages(res.data?.totalPages || 1)
        setOrdersLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setOrdersLoading(false)
        showToast(err.response?.data?.message || err.message || 'Không thể tải danh sách đơn hàng.', 'error')
      })
    return () => {
      isCurrent = false
    }
  }, [adminTab, orderPage, orderSearch, orderStatusFilter, orderPaymentFilter, orderRefreshTrigger, showToast])

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

  const handleUpdateOrderStatus = async (orderId, newStatus, note) => {
    await orderService.updateOrderStatus(orderId, { status: newStatus, note })
    showToast('Cập nhật trạng thái đơn hàng thành công!')
    setOrdersLoading(true)
    setOrderRefreshTrigger((prev) => prev + 1)
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
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'orders' ? 'active' : ''}`}
          onClick={() => {
            setOrdersLoading(true)
            setAdminTab('orders')
          }}
        >
          📦 Quản lý Đơn hàng
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
      ) : adminTab === 'categories' ? (
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
      ) : (
        <AdminOrderTable
          orders={adminOrders}
          total={orderTotal}
          page={orderPage}
          totalPages={orderTotalPages}
          loading={ordersLoading}
          search={orderSearch}
          statusFilter={orderStatusFilter}
          paymentMethodFilter={orderPaymentFilter}
          onSearchChange={(val) => {
            setOrdersLoading(true)
            setOrderSearch(val)
            setOrderPage(1)
          }}
          onStatusFilterChange={(val) => {
            setOrdersLoading(true)
            setOrderStatusFilter(val)
            setOrderPage(1)
          }}
          onPaymentMethodFilterChange={(val) => {
            setOrdersLoading(true)
            setOrderPaymentFilter(val)
            setOrderPage(1)
          }}
          onPageChange={(nextPage) => {
            setOrdersLoading(true)
            setOrderPage(nextPage)
          }}
          onUpdateStatus={handleUpdateOrderStatus}
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
