import axiosClient from './axiosClient'

const discountService = {
  getAdminDiscounts: (params = {}) => axiosClient.get('/admin/discounts', { params }),
  getAdminDiscountById: (id) => axiosClient.get(`/admin/discounts/${id}`),
  createDiscount: (data) => axiosClient.post('/admin/discounts', data),
  updateDiscount: (id, data) => axiosClient.put(`/admin/discounts/${id}`, data),
  changeDiscountStatus: (id, isDelete) => axiosClient.patch(`/admin/discounts/${id}/status`, { isDelete }),
  getActiveDiscounts: (params = {}) => axiosClient.get('/discounts', { params }),
  getDiscountById: (id) => axiosClient.get(`/discounts/${id}`),
  getDiscountByCode: (code) => axiosClient.get(`/discounts/code/${code}`),
  validatePromotion: (data) => axiosClient.post('/discounts/validate', data),
}

export default discountService

