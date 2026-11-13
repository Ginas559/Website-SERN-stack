import axiosClient from './axiosClient'

const storePolicyService = {
  getAdminShippingPolicy: () => axiosClient.get('/admin/store-policies/shipping'),
  updateAdminShippingPolicy: (data) => axiosClient.put('/admin/store-policies/shipping', data),
}

export default storePolicyService

