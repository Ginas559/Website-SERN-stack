import axiosClient from './axiosClient'

const statisticsService = {
  getOverview: () => axiosClient.get('/admin/statistics/overview'),
  getRevenueOrders: (params) => axiosClient.get('/admin/statistics/revenue-orders', { params }),
  getTopBooks: (params) => axiosClient.get('/admin/statistics/top-books', { params }),
  getCategoryStats: () => axiosClient.get('/admin/statistics/categories'),
  getSummary: (params) => axiosClient.get('/admin/statistics/summary', { params })
}

export default statisticsService

