import axiosClient from './axiosClient';

const shippingService = {
    getProvinces: () => axiosClient.get('/shipping/provinces'),
    getDistricts: (provinceId) => axiosClient.get(`/shipping/districts/${provinceId}`),
    getWards: (districtId) => axiosClient.get(`/shipping/wards/${districtId}`),
    calculateFee: (payload) => axiosClient.post('/shipping/calculate-fee', payload),
    trackOrder: (orderCode) => axiosClient.get(`/shipping/track/${orderCode}`)
};

export default shippingService;
