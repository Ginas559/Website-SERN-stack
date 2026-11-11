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
import AdminReviewTable from './AdminReviewTable'
import AdminOverviewDashboard from './AdminOverviewDashboard'
import orderService from '../services/orderService'
import discountService from '../services/discountService'
import userService from '../services/userService'
import reviewService from '../services/reviewService'
import './AdminDashboard.css'

function AdminDashboard({ activeAdminTab, onAdminTabChange }) {
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

  const [internalAdminTab, setInternalAdminTab] = useState('overview')
  const adminTab = activeAdminTab || internalAdminTab
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
  const [orderSortBy, setOrderSortBy] = useState('createdAt')
  const [orderSortOrder, setOrderSortOrder] = useState('DESC')
  const [ordersLoading, setOrdersLoading] = useState(() => (activeAdminTab || 'overview') === 'orders')
  const [orderRefreshTrigger, setOrderRefreshTrigger] = useState(0)

  const [adminPromotions, setAdminPromotions] = useState([])
  const [promoTotal, setPromoTotal] = useState(0)
  const [promoPage, setPromoPage] = useState(1)
  const [promoTotalPages, setPromoTotalPages] = useState(1)
  const [promoSearch, setPromoSearch] = useState('')
  const [promoStatusFilter, setPromoStatusFilter] = useState('all')
  const [promosLoading, setPromosLoading] = useState(() => (activeAdminTab || 'overview') === 'promotions')
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
  const [usersLoading, setUsersLoading] = useState(() => (activeAdminTab || 'overview') === 'users')
  const [userRefreshTrigger, setUserRefreshTrigger] = useState(0)
  const [userBlockModalOpen, setUserBlockModalOpen] = useState(false)
  const [userBlockTarget, setUserBlockTarget] = useState(null)
  const [userDetailModalOpen, setUserDetailModalOpen] = useState(false)
  const [userDetailTarget, setUserDetailTarget] = useState(null)

  const [adminReviews, setAdminReviews] = useState([])
  const [reviewTotal, setReviewTotal] = useState(0)
  const [reviewPage, setReviewPage] = useState(1)
  const [reviewTotalPages, setReviewTotalPages] = useState(1)
  const [reviewSearch, setReviewSearch] = useState('')
  const [reviewStatusFilter, setReviewStatusFilter] = useState('all')
  const [reviewRateFilter, setReviewRateFilter] = useState('all')
  const [reviewsLoading, setReviewsLoading] = useState(() => (activeAdminTab || 'overview') === 'reviews')
  const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0)

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
      sortBy: orderSortBy,
      sortOrder: orderSortOrder,
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
  }, [adminTab, orderPage, orderSearch, orderStatusFilter, orderPaymentFilter, orderSortBy, orderSortOrder, orderRefreshTrigger, showToast])

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

  useEffect(() => {
    if (adminTab !== 'reviews') return
    let isCurrent = true
    const queryParams = {
      page: reviewPage,
      limit: 10,
      ...(reviewSearch.trim() ? { search: reviewSearch.trim() } : {}),
      ...(reviewStatusFilter !== 'all' && Number.isInteger(Number(reviewStatusFilter)) ? { isDelete: Number(reviewStatusFilter) } : {}),
      ...(reviewRateFilter === 'discussion' ? { rate: 'discussion' } : (reviewRateFilter !== 'all' && Number.isInteger(Number(reviewRateFilter)) ? { rate: Number(reviewRateFilter) } : {})),
    }

    reviewService.adminGetReviews(queryParams)
      .then((res) => {
        if (!isCurrent) return
        setAdminReviews(res.comments || res.data?.comments || [])
        setReviewTotal(res.total ?? res.data?.total ?? 0)
        setReviewTotalPages(res.totalPages ?? res.data?.totalPages ?? 1)
        setReviewsLoading(false)
      })
      .catch((err) => {
        if (!isCurrent) return
        setReviewsLoading(false)
        showToast(err.message || 'Không thể tải danh sách đánh giá.', 'error')
      })
    return () => {
      isCurrent = false
    }
  }, [adminTab, reviewPage, reviewSearch, reviewStatusFilter, reviewRateFilter, reviewRefreshTrigger, showToast])

  const handleSelectAdminTab = useCallback((targetTab) => {
    if (targetTab === adminTab) return
    if (targetTab === 'orders' && adminOrders.length === 0) setOrdersLoading(true)
    if (targetTab === 'promotions' && adminPromotions.length === 0) setPromosLoading(true)
    if (targetTab === 'users' && adminUsers.length === 0) setUsersLoading(true)
    if (targetTab === 'reviews' && adminReviews.length === 0) setReviewsLoading(true)
    if (onAdminTabChange) {
      onAdminTabChange(targetTab)
    } else {
      setInternalAdminTab(targetTab)
    }
  }, [adminTab, adminOrders.length, adminPromotions.length, adminUsers.length, adminReviews.length, onAdminTabChange])

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

  const handleResetBookFilters = useCallback(() => {
    setBookSearch('')
    setBookStatusFilter('all')
    setBookPage(1)
  }, [])

  const handleResetCategoryFilters = useCallback(() => {
    setCategorySearch('')
  }, [])

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
      if (err?.response?.status === 409 || String(err?.message || err).includes('thay đổi')) {
        fetchBooksData()
      }
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
      if (err?.response?.status === 409 || String(err?.message || err).includes('thay đổi')) {
        fetchCategoriesData()
      }
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
      if (err?.response?.status === 409 || String(err?.message || '').includes('thay đổi')) {
        setOrderRefreshTrigger((prev) => prev + 1)
      }
      throw err
    }
  }, [showToast])

  const handleOrderSearchChange = useCallback((val) => {
    if (val === orderSearch && orderPage === 1) return
    setOrdersLoading(true)
    setOrderSearch(val)
    setOrderPage(1)
  }, [orderSearch, orderPage])

  const handleOrderStatusChange = useCallback((val) => {
    if (val === orderStatusFilter && orderPage === 1) return
    setOrdersLoading(true)
    setOrderStatusFilter(val)
    setOrderPage(1)
  }, [orderStatusFilter, orderPage])

  const handleOrderPaymentChange = useCallback((val) => {
    if (val === orderPaymentFilter && orderPage === 1) return
    setOrdersLoading(true)
    setOrderPaymentFilter(val)
    setOrderPage(1)
  }, [orderPaymentFilter, orderPage])

  const handleOrderPageChange = useCallback((nextPage) => {
    if (nextPage === orderPage) return
    setOrdersLoading(true)
    setOrderPage(nextPage)
  }, [orderPage])

  const handleOrderSortChange = useCallback((field) => {
    setOrdersLoading(true)
    if (orderSortBy === field) {
      setOrderSortOrder((prev) => (prev.toUpperCase() === 'ASC' ? 'DESC' : 'ASC'))
    } else {
      setOrderSortBy(field)
      setOrderSortOrder(field === 'createdAt' || field === 'total' || field === 'total_quantity' ? 'DESC' : 'ASC')
    }
    setOrderPage(1)
  }, [orderSortBy])

  const handleResetOrderFilters = useCallback(() => {
    const hasChanges =
      orderSearch !== '' ||
      orderStatusFilter !== 'all' ||
      orderPaymentFilter !== 'all' ||
      orderSortBy !== 'createdAt' ||
      orderSortOrder !== 'DESC' ||
      orderPage !== 1
    if (!hasChanges) return
    setOrdersLoading(true)
    setOrderSearch('')
    setOrderStatusFilter('all')
    setOrderPaymentFilter('all')
    setOrderSortBy('createdAt')
    setOrderSortOrder('DESC')
    setOrderPage(1)
  }, [orderSearch, orderStatusFilter, orderPaymentFilter, orderSortBy, orderSortOrder, orderPage])

  const handlePromoSearchChange = useCallback((val) => {
    if (val === promoSearch && promoPage === 1) return
    setPromosLoading(true)
    setPromoSearch(val)
    setPromoPage(1)
  }, [promoSearch, promoPage])

  const handlePromoStatusChange = useCallback((val) => {
    if (val === promoStatusFilter && promoPage === 1) return
    setPromosLoading(true)
    setPromoStatusFilter(val)
    setPromoPage(1)
  }, [promoStatusFilter, promoPage])

  const handlePromoPageChange = useCallback((nextPage) => {
    if (nextPage === promoPage) return
    setPromosLoading(true)
    setPromoPage(nextPage)
  }, [promoPage])

  const handleResetPromoFilters = useCallback(() => {
    const hasChanges = promoSearch !== '' || promoStatusFilter !== 'all' || promoPage !== 1
    if (!hasChanges) return
    setPromosLoading(true)
    setPromoSearch('')
    setPromoStatusFilter('all')
    setPromoPage(1)
  }, [promoSearch, promoStatusFilter, promoPage])

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
      if (err?.response?.status === 409 || String(err?.message || '').includes('thay đổi')) {
        setPromoRefreshTrigger((prev) => prev + 1)
      }
    }
  }, [showToast])

  const handleUserSearchChange = useCallback((val) => {
    if (val === userSearch && userPage === 1) return
    setUsersLoading(true)
    setUserSearch(val)
    setUserPage(1)
  }, [userSearch, userPage])

  const handleUserStatusChange = useCallback((val) => {
    if (val === userStatusFilter && userPage === 1) return
    setUsersLoading(true)
    setUserStatusFilter(val)
    setUserPage(1)
  }, [userStatusFilter, userPage])

  const handleUserRoleChange = useCallback((val) => {
    if (val === userRoleFilter && userPage === 1) return
    setUsersLoading(true)
    setUserRoleFilter(val)
    setUserPage(1)
  }, [userRoleFilter, userPage])

  const handleUserVipChange = useCallback((val) => {
    if (val === userVipFilter && userPage === 1) return
    setUsersLoading(true)
    setUserVipFilter(val)
    setUserPage(1)
  }, [userVipFilter, userPage])

  const handleUserPageChange = useCallback((nextPage) => {
    if (nextPage === userPage) return
    setUsersLoading(true)
    setUserPage(nextPage)
  }, [userPage])

  const handleResetUserFilters = useCallback(() => {
    const hasChanges =
      userSearch !== '' ||
      userStatusFilter !== 'all' ||
      userRoleFilter !== 'all' ||
      userVipFilter !== 'all' ||
      userPage !== 1
    if (!hasChanges) return
    setUsersLoading(true)
    setUserSearch('')
    setUserStatusFilter('all')
    setUserRoleFilter('all')
    setUserVipFilter('all')
    setUserPage(1)
  }, [userSearch, userStatusFilter, userRoleFilter, userVipFilter, userPage])

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
      if (err?.response?.status === 409 || String(err?.message || '').includes('thay đổi')) {
        setUserRefreshTrigger((prev) => prev + 1)
      }
    }
  }, [showToast])

  const handleReviewSearchChange = useCallback((val) => {
    if (val === reviewSearch && reviewPage === 1) return
    setReviewsLoading(true)
    setReviewSearch(val)
    setReviewPage(1)
  }, [reviewSearch, reviewPage])

  const handleReviewStatusChange = useCallback((val) => {
    if (val === reviewStatusFilter && reviewPage === 1) return
    setReviewsLoading(true)
    setReviewStatusFilter(val)
    setReviewPage(1)
  }, [reviewStatusFilter, reviewPage])

  const handleReviewRateChange = useCallback((val) => {
    if (val === reviewRateFilter && reviewPage === 1) return
    setReviewsLoading(true)
    setReviewRateFilter(val)
    setReviewPage(1)
  }, [reviewRateFilter, reviewPage])

  const handleReviewPageChange = useCallback((nextPage) => {
    if (nextPage === reviewPage) return
    setReviewsLoading(true)
    setReviewPage(nextPage)
  }, [reviewPage])

  const handleResetReviewFilters = useCallback(() => {
    const hasChanges =
      reviewSearch !== '' ||
      reviewStatusFilter !== 'all' ||
      reviewRateFilter !== 'all' ||
      reviewPage !== 1
    if (!hasChanges) return
    setReviewsLoading(true)
    setReviewSearch('')
    setReviewStatusFilter('all')
    setReviewRateFilter('all')
    setReviewPage(1)
  }, [reviewSearch, reviewStatusFilter, reviewRateFilter, reviewPage])

  const handleToggleReviewStatus = useCallback(async (review) => {
    const nextStatus = review.isDelete ? 0 : 1
    try {
      await reviewService.adminChangeReviewStatus(review.id, nextStatus)
      showToast(nextStatus === 1 ? 'Đã ẩn bình luận/đánh giá vi phạm.' : 'Đã khôi phục bình luận/đánh giá.')
      setReviewsLoading(true)
      setReviewRefreshTrigger((prev) => prev + 1)
    } catch (err) {
      showToast(err.message || 'Lỗi khi cập nhật trạng thái đánh giá.', 'error')
      if (err?.response?.status === 409 || String(err?.message || '').includes('thay đổi')) {
        setReviewRefreshTrigger((prev) => prev + 1)
      }
      throw err
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

      <div className="admin-navigation-tabs">
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'overview' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('overview')}
        >
          📊 Tổng quan hệ thống
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'books' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('books')}
        >
          📚 Quản lý Ấn phẩm Sách
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'categories' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('categories')}
        >
          🏷️ Quản lý Thể loại Sách
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'orders' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('orders')}
        >
          📦 Quản lý Đơn hàng
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'promotions' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('promotions')}
        >
          🎟️ Quản lý Khuyến mãi
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'users' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('users')}
        >
          👥 Quản lý Người dùng
        </button>
        <button
          type="button"
          className={`admin-nav-tab ${adminTab === 'reviews' ? 'active' : ''}`}
          onClick={() => handleSelectAdminTab('reviews')}
        >
          ⭐ Quản lý Đánh giá & Bình luận
        </button>
      </div>

      {adminTab === 'overview' ? (
        <AdminOverviewDashboard
          onNavigateTab={handleSelectAdminTab}
        />
      ) : adminTab === 'books' ? (
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
          onResetFilters={handleResetBookFilters}
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
          onResetFilters={handleResetCategoryFilters}
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
          sortBy={orderSortBy}
          sortOrder={orderSortOrder}
          onSearchChange={handleOrderSearchChange}
          onStatusFilterChange={handleOrderStatusChange}
          onPaymentMethodFilterChange={handleOrderPaymentChange}
          onSortChange={handleOrderSortChange}
          onResetFilters={handleResetOrderFilters}
          onPageChange={handleOrderPageChange}
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
          onSearchChange={handlePromoSearchChange}
          onStatusFilterChange={handlePromoStatusChange}
          onResetFilters={handleResetPromoFilters}
          onPageChange={handlePromoPageChange}
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
      ) : adminTab === 'users' ? (
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
          onSearchChange={handleUserSearchChange}
          onStatusFilterChange={handleUserStatusChange}
          onRoleFilterChange={handleUserRoleChange}
          onVipFilterChange={handleUserVipChange}
          onResetFilters={handleResetUserFilters}
          onPageChange={handleUserPageChange}
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
      ) : (
        <AdminReviewTable
          reviews={adminReviews}
          total={reviewTotal}
          page={reviewPage}
          totalPages={reviewTotalPages}
          loading={reviewsLoading}
          search={reviewSearch}
          statusFilter={reviewStatusFilter}
          rateFilter={reviewRateFilter}
          onSearchChange={handleReviewSearchChange}
          onStatusFilterChange={handleReviewStatusChange}
          onRateFilterChange={handleReviewRateChange}
          onResetFilters={handleResetReviewFilters}
          onPageChange={handleReviewPageChange}
          onToggleStatus={handleToggleReviewStatus}
        />
      )}

      <AdminBookModal
        isOpen={adminTab === 'books' && bookModalOpen}
        mode={bookModalMode}
        book={currentBook}
        categories={activeCategories}
        onClose={() => setBookModalOpen(false)}
        onSave={handleSaveBook}
      />

      <AdminCategoryModal
        isOpen={adminTab === 'categories' && categoryModalOpen}
        mode={categoryModalMode}
        category={currentCategory}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
      />

      <AdminPromotionModal
        isOpen={adminTab === 'promotions' && promoModalOpen}
        mode={promoModalMode}
        promotion={currentPromo}
        onClose={() => setPromoModalOpen(false)}
        onSave={handleSavePromotion}
      />

      <AdminUserBlockModal
        isOpen={adminTab === 'users' && userBlockModalOpen}
        user={userBlockTarget}
        onClose={() => {
          setUserBlockModalOpen(false)
          setUserBlockTarget(null)
        }}
        onConfirmBlock={handleConfirmBlockUser}
      />

      <AdminUserDetailModal
        isOpen={adminTab === 'users' && userDetailModalOpen}
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