import { useState, useEffect, useCallback, useMemo } from 'react'
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
import AdminPromotionTable from './AdminPromotionTable'
import AdminPromotionModal from './AdminPromotionModal'
import AdminUserTable from './AdminUserTable'
import AdminUserBlockModal from './AdminUserBlockModal'
import AdminUserDetailModal from './AdminUserDetailModal'
import orderService from '../services/orderService'
import discountService from '../services/discountService'
import userService from '../services/userService'
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

  const [adminPromotions, setAdminPromotions] = useState([])
  const [promoTotal, setPromoTotal] = useState(0)
  const [promoPage, setPromoPage] = useState(1)
  const [promoTotalPages, setPromoTotalPages] = useState(1)
  const [promoSearch, setPromoSearch] = useState('')
  const [promoStatusFilter, setPromoStatusFilter] = useState('all')
  const [promosLoading, setPromosLoading] = useState(false)
  const [promoRefreshTrigger, setPromoRefreshTrigger] = useState(0)
  const [promoModalOpen, setPromoModalOpen] = useState(false)
  const [promoModalMode, setPromoModalMode] = useState('create')
  const [currentPromo, setCurrentPromo] = useState(null)

  const [adminUsers, setAdminUsers] = useState([])
  const [userTotal, setUserTotal] = useState(0)
  const [userPage, setUserPage] = useState(1)
  const [userTotalPages, setUserTotalPages] = useState(1)
  const [userSearch, setUserSearch] = useState('')
  const [userStatusFilter, setUserStatusFilter] = useState('all')
  const [userRoleFilter, setUserRoleFilter] = useState('all')
  const [userVipFilter, setUserVipFilter] = useState('all')
  const [usersLoading, setUsersLoading] = useState(false)
  const [userRefreshTrigger, setUserRefreshTrigger] = useState(0)
  const [userBlockModalOpen, setUserBlockModalOpen] = useState(false)
  const [userBlockTarget, setUserBlockTarget] = useState(null)
  const [userDetailModalOpen, setUserDetailModalOpen] = useState(false)
  const [userDetailTarget, setUserDetailTarget] = useState(null)

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
    let isCurrent = true
    orderService.getAdminOrders({ page: 1, limit: 1 })
      .then((res) => {
        if (!isCurrent) return
        setOrderTotal(res.total ?? res.data?.total ?? 0)
      })
      .catch(() => {})
    discountService.getAdminDiscounts({ page: 1, limit: 1 })
      .then((res) => {
        if (!isCurrent) return
        setPromoTotal(res.total ?? res.data?.total ?? 0)
      })
      .catch(() => {})
    userService.getAdminUsers({ page: 1, limit: 1 })
      .then((res) => {
        if (!isCurrent) return
        setUserTotal(res.total ?? res.data?.total ?? 0)
      })
      .catch(() => {})
    return () => {
      isCurrent = false
    }
  }, [])

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
        setAdminOrders(res.orders || res.data?.orders || [])
        setOrderTotal(res.total ?? res.data?.total ?? 0)
        setOrderTotalPages(res.totalPages ?? res.data?.totalPages ?? 1)
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

  useEffect(() => {
    if (adminTab !== 'promotions') return
    let isCurrent = true
    const queryParams = {
      page: promoPage,
      limit: 10,
      ...(promoSearch.trim() ? { search: promoSearch.trim() } : {}),
    }
    if (promoStatusFilter === 'deleted') {
      queryParams.isDelete = 1
    } else if (promoStatusFilter !== 'all') {
      queryParams.status = promoStatusFilter
      queryParams.isDelete = 0
    }

    discountService.getAdminDiscounts(queryParams)
      .then((res) => {
        if (!isCurrent) return
        setAdminPromotions(res.discounts || res.data?.discounts || [])
        setPromoTotal(res.total ?? res.data?.total ?? 0)
        setPromoTotalPages(res.totalPages ?? res.data?.totalPages ?? 1)
        setPromosLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setPromosLoading(false)
        showToast(err.response?.data?.message || err.message || 'Không thể tải danh sách khuyến mãi.', 'error')
      })
    return () => {
      isCurrent = false
    }
  }, [adminTab, promoPage, promoSearch, promoStatusFilter, promoRefreshTrigger, showToast])

  useEffect(() => {
    if (adminTab !== 'users') return
    let isCurrent = true
    const queryParams = {
      page: userPage,
      limit: 10,
      ...(userSearch.trim() ? { search: userSearch.trim() } : {}),
      ...(userStatusFilter !== 'all' ? { isDelete: userStatusFilter } : {}),
      ...(userRoleFilter === 'admin' ? { isAdmin: 1 } : userRoleFilter === 'customer' ? { isAdmin: 0 } : {}),
      ...(userVipFilter !== 'all' ? { isVip: userVipFilter } : {}),
    }

    userService.getAdminUsers(queryParams)
      .then((res) => {
        if (!isCurrent) return
        setAdminUsers(res.users || res.data?.users || [])
        setUserTotal(res.total ?? res.data?.total ?? 0)
        setUserTotalPages(res.totalPages ?? res.data?.totalPages ?? 1)
        setUsersLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setUsersLoading(false)
        showToast(err.response?.data?.message || err.message || 'Không thể tải danh sách người dùng.', 'error')
      })
    return () => {
      isCurrent = false
    }
  }, [adminTab, userPage, userSearch, userStatusFilter, userRoleFilter, userVipFilter, userRefreshTrigger, showToast])

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

  const handleUpdateOrderStatus = useCallback(async (orderId, payload, legacyNote) => {
    try {
      const body = typeof payload === 'object' && payload !== null
        ? payload
        : { status: payload, note: legacyNote }
      await orderService.updateOrderStatus(orderId, body)
      showToast('Cập nhật trạng thái đơn hàng thành công!')
      setOrdersLoading(true)
      setOrderRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái đơn hàng.', 'error')
      throw err
    }
  }, [showToast])

  const handleSavePromotion = useCallback(async (payload, promoId) => {
    if (promoId) {
      await discountService.updateDiscount(promoId, payload)
      showToast('Cập nhật mã khuyến mãi thành công!')
    } else {
      await discountService.createDiscount(payload)
      showToast('Thêm mã khuyến mãi mới thành công!')
    }
    setPromosLoading(true)
    setPromoRefreshTrigger((prev) => prev + 1)
  }, [showToast])

  const handleTogglePromotionStatus = useCallback(async (promo) => {
    const nextStatus = promo.isDelete ? 0 : 1
    try {
      await discountService.changeDiscountStatus(promo.id, nextStatus)
      showToast(nextStatus === 1 ? 'Đã ẩn mã khuyến mãi.' : 'Đã khôi phục mã khuyến mãi.')
      setPromosLoading(true)
      setPromoRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái khuyến mãi.', 'error')
    }
  }, [showToast])

  const handleConfirmBlockUser = useCallback(async (userId, reason) => {
    await userService.blockUser(userId, { blockReason: reason })
    showToast('Đã khóa tài khoản người dùng thành công.')
    setUsersLoading(true)
    setUserRefreshTrigger((prev) => prev + 1)
  }, [showToast])

  const handleRestoreUser = useCallback(async (user) => {
    try {
      await userService.restoreUser(user.id)
      showToast('Đã mở khóa tài khoản người dùng thành công.')
      setUsersLoading(true)
      setUserRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      showToast(err.message || 'Lỗi khi mở khóa người dùng.', 'error')
    }
  }, [showToast])

  const activeCategories = useMemo(() => categories.filter((c) => !c.isDelete), [categories])

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
            Quản lý kho ấn phẩm, danh mục thể loại, đơn hàng, chương trình khuyến mãi và người dùng toàn hệ thống BookWeb.
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
          <div className="admin-stat-label">Tổng số đơn hàng</div>
          <div className="admin-stat-value">{orderTotal}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Mã khuyến mãi</div>
          <div className="admin-stat-value">{promoTotal}</div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-label">Người dùng hệ thống</div>
          <div className="admin-stat-value">{userTotal}</div>
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
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'promotions' ? 'active' : ''}`}
          onClick={() => {
            setPromosLoading(true)
            setAdminTab('promotions')
          }}
        >
          🎟️ Quản lý Khuyến mãi
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'users' ? 'active' : ''}`}
          onClick={() => {
            setUsersLoading(true)
            setAdminTab('users')
          }}
        >
          👥 Quản lý Người dùng
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
      ) : adminTab === 'orders' ? (
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
      ) : adminTab === 'promotions' ? (
        <AdminPromotionTable
          promotions={adminPromotions}
          total={promoTotal}
          page={promoPage}
          totalPages={promoTotalPages}
          loading={promosLoading}
          search={promoSearch}
          statusFilter={promoStatusFilter}
          onSearchChange={(val) => {
            setPromosLoading(true)
            setPromoSearch(val)
            setPromoPage(1)
          }}
          onStatusFilterChange={(val) => {
            setPromosLoading(true)
            setPromoStatusFilter(val)
            setPromoPage(1)
          }}
          onPageChange={(nextPage) => {
            setPromosLoading(true)
            setPromoPage(nextPage)
          }}
          onOpenCreate={() => {
            setCurrentPromo(null)
            setPromoModalMode('create')
            setPromoModalOpen(true)
          }}
          onOpenEdit={(promo) => {
            setCurrentPromo(promo)
            setPromoModalMode('edit')
            setPromoModalOpen(true)
          }}
          onToggleStatus={handleTogglePromotionStatus}
        />
      ) : (
        <AdminUserTable
          users={adminUsers}
          total={userTotal}
          page={userPage}
          totalPages={userTotalPages}
          loading={usersLoading}
          search={userSearch}
          statusFilter={userStatusFilter}
          roleFilter={userRoleFilter}
          vipFilter={userVipFilter}
          onSearchChange={(val) => {
            setUsersLoading(true)
            setUserSearch(val)
            setUserPage(1)
          }}
          onStatusFilterChange={(val) => {
            setUsersLoading(true)
            setUserStatusFilter(val)
            setUserPage(1)
          }}
          onRoleFilterChange={(val) => {
            setUsersLoading(true)
            setUserRoleFilter(val)
            setUserPage(1)
          }}
          onVipFilterChange={(val) => {
            setUsersLoading(true)
            setUserVipFilter(val)
            setUserPage(1)
          }}
          onPageChange={(nextPage) => {
            setUsersLoading(true)
            setUserPage(nextPage)
          }}
          onViewDetail={(user) => {
            setUserDetailTarget(user)
            setUserDetailModalOpen(true)
          }}
          onRequestBlock={(user) => {
            setUserBlockTarget(user)
            setUserBlockModalOpen(true)
          }}
          onRestoreUser={handleRestoreUser}
        />
      )}

      <AdminBookModal
        isOpen={bookModalOpen}
        mode={bookModalMode}
        book={currentBook}
        categories={activeCategories}
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

      <AdminPromotionModal
        isOpen={promoModalOpen}
        mode={promoModalMode}
        promotion={currentPromo}
        onClose={() => setPromoModalOpen(false)}
        onSave={handleSavePromotion}
      />

      <AdminUserBlockModal
        isOpen={userBlockModalOpen}
        user={userBlockTarget}
        onClose={() => {
          setUserBlockModalOpen(false)
          setUserBlockTarget(null)
        }}
        onConfirmBlock={handleConfirmBlockUser}
      />

      <AdminUserDetailModal
        isOpen={userDetailModalOpen}
        user={userDetailTarget}
        onClose={() => {
          setUserDetailModalOpen(false)
          setUserDetailTarget(null)
        }}
      />
    </div>
  )
}

export default AdminDashboard
