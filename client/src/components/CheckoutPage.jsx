import { useState, useMemo, useCallback, useEffect } from 'react';
import orderService from '../services/orderService';
import discountService from '../services/discountService';
import userService from '../services/userService';
import shippingService from '../services/shippingService';
import {
    getSavedShippingLocation,
    setSavedShippingLocation,
    composeFullAddress,
    resolveAddressToGhn
} from '../utils/addressHelper';
import { MapPinIcon, TruckIcon, CreditCardIcon, TagIcon } from './common/Icons';
import {
    calculateDiscountedUnitPrice,
    calculateSelectedItemsTotals,
    getPaymentMethodLabel
} from '../utils/pricing';
import './Checkout.css';

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

function CheckoutPage({
    checkoutItems = [],
    onBackToCart,
    onContinueShopping,
    onViewOrders,
    currentUser = null,
    onOrderCompleted
}) {
    const items = useMemo(() => {
        if (Array.isArray(checkoutItems) && checkoutItems.length > 0) {
            return checkoutItems;
        }
        try {
            const guestCart = JSON.parse(localStorage.getItem('guestCart') || '[]');
            return Array.isArray(guestCart) ? guestCart.filter((it) => (Number(it.stock ?? 1) > 0)) : [];
        } catch {
            return [];
        }
    }, [checkoutItems]);

    const initialSavedLoc = getSavedShippingLocation();
    const initialAddress = initialSavedLoc?.address || currentUser?.address || '';

    const [form, setForm] = useState(() => ({
        fullName: initialSavedLoc?.fullName || currentUser?.fullName || currentUser?.full_name || '',
        phone: initialSavedLoc?.phone || currentUser?.phone || currentUser?.phoneNumber || currentUser?.phone_number || '',
        note: ''
    }));

    const [activeAddress, setActiveAddress] = useState(initialAddress);
    const [paymentMethod, setPaymentMethod] = useState('COD');
    const [couponInput, setCouponInput] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [appliedDiscount, setAppliedDiscount] = useState(0);
    const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
    const [availableDiscounts, setAvailableDiscounts] = useState([]);
    const [toast, setToast] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successOrder, setSuccessOrder] = useState(null);

    const [provinces, setProvinces] = useState([]);
    const [selectedProvinceId, setSelectedProvinceId] = useState(() => (initialSavedLoc?.provinceId ? String(initialSavedLoc.provinceId) : ''));
    const [selectedDistrictId, setSelectedDistrictId] = useState(() => (initialSavedLoc?.districtId ? String(initialSavedLoc.districtId) : ''));
    const [selectedWardCode, setSelectedWardCode] = useState(() => (initialSavedLoc?.wardCode ? String(initialSavedLoc.wardCode) : ''));
    const [streetAddress, setStreetAddress] = useState(() => (initialSavedLoc?.streetAddress || ''));
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);

    const [shippingDetail, setShippingDetail] = useState(null);
    const [isLoadingFee, setIsLoadingFee] = useState(false);
    const [shippingError, setShippingError] = useState('');
    const [shippingRefreshKey, setShippingRefreshKey] = useState(0);

    const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
    const [addressEditMode, setAddressEditMode] = useState(false);
    const [tempAddress, setTempAddress] = useState({
        fullName: '',
        phone: '',
        provinceId: '',
        districtId: '',
        wardCode: '',
        streetAddress: '',
        isDefault: true
    });
    const [tempDistricts, setTempDistricts] = useState([]);
    const [tempWards, setTempWards] = useState([]);
    const [isLoadingTempDistricts, setIsLoadingTempDistricts] = useState(false);
    const [isLoadingTempWards, setIsLoadingTempWards] = useState(false);

    const triggerToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
        setTimeout(() => {
            setToast(null);
        }, 3200);
    }, []);

    useEffect(() => {
        let isCurrent = true;
        discountService.getActiveDiscounts({ page: 1, limit: 10 })
            .then((res) => {
                if (!isCurrent) return;
                const list = Array.isArray(res) ? res : res?.discounts || [];
                setAvailableDiscounts(list);
            })
            .catch(() => {
                if (!isCurrent) return;
                setAvailableDiscounts([]);
            });
        return () => {
            isCurrent = false;
        };
    }, []);

    useEffect(() => {
        let isCurrent = true;
        if (localStorage.getItem('accessToken')) {
            userService.getProfile()
                .then((res) => {
                    if (!isCurrent) return;
                    const profile = res.data || res;
                    if (profile) {
                        setForm((prev) => ({
                            fullName: prev.fullName || profile.fullName || profile.full_name || '',
                            phone: prev.phone || profile.phone || profile.phoneNumber || profile.phone_number || '',
                            note: prev.note
                        }));
                        if (profile.address && !activeAddress) {
                            setActiveAddress(profile.address);
                        }
                    }
                })
                .catch(() => {});
        }
        return () => {
            isCurrent = false;
        };
    }, [activeAddress]);

    useEffect(() => {
        let isCurrent = true;
        shippingService.getProvinces()
            .then((res) => {
                if (!isCurrent) return;
                const list = res?.data || res || [];
                setProvinces(Array.isArray(list) ? list : []);
                setIsLoadingProvinces(false);
            })
            .catch((err) => {
                if (!isCurrent) return;
                setProvinces([]);
                setIsLoadingProvinces(false);
                triggerToast(err.message || 'Không thể tải danh sách tỉnh/thành phố GHN.', 'error');
            });
        return () => {
            isCurrent = false;
        };
    }, [triggerToast]);

    useEffect(() => {
        if (!activeAddress || !provinces.length) return;
        if (selectedProvinceId && selectedDistrictId && selectedWardCode) return;

        let isCurrent = true;
        resolveAddressToGhn(activeAddress, provinces, shippingService)
            .then((resolved) => {
                if (!isCurrent || !resolved?.provinceId || !resolved?.districtId || !resolved?.wardCode) return;
                const province = provinces.find((item) => String(item.provinceId) === String(resolved.provinceId));
                const districtName = resolved.districtName || '';
                const wardName = resolved.wardName || '';
                const fullAddress = resolved.fullAddress || composeFullAddress(
                    resolved.streetAddress,
                    wardName,
                    districtName,
                    province?.provinceName || resolved.provinceName
                );
                setSelectedProvinceId(String(resolved.provinceId));
                setSelectedDistrictId(String(resolved.districtId));
                setSelectedWardCode(String(resolved.wardCode));
                setStreetAddress(resolved.streetAddress || '');
                setSavedShippingLocation({ ...resolved, address: fullAddress });
            });
        return () => {
            isCurrent = false;
        };
    }, [activeAddress, provinces, selectedProvinceId, selectedDistrictId, selectedWardCode, streetAddress]);

    const { selectedCount, subtotal } = useMemo(
        () => calculateSelectedItemsTotals(items),
        [items]
    );

    const estimatedWeightGrams = useMemo(() => {
        return Math.min(20000, Math.max(300, selectedCount * 350));
    }, [selectedCount]);

    const shippingQuoteKey = `${selectedProvinceId}|${selectedDistrictId}|${selectedWardCode}|${subtotal}|${estimatedWeightGrams}|${shippingRefreshKey}`;

    useEffect(() => {
        let isCurrent = true;
        if (!selectedProvinceId) {
            Promise.resolve().then(() => {
                if (!isCurrent) return;
                setIsLoadingFee(false);
                setShippingError('');
            });
            return () => {
                isCurrent = false;
            };
        }

        const prov = provinces.find((p) => String(p.provinceId) === String(selectedProvinceId));
        const isHcm = Number(selectedProvinceId) === 202 || String(prov?.provinceName || '').toLowerCase().includes('hồ chí minh');
        if (!isHcm && (!selectedDistrictId || !selectedWardCode)) {
            Promise.resolve().then(() => {
                if (!isCurrent) return;
                setIsLoadingFee(false);
                setShippingError('');
            });
            return () => {
                isCurrent = false;
            };
        }

        Promise.resolve().then(() => {
            if (!isCurrent) return;
            setIsLoadingFee(true);
            setShippingError('');
        });
        shippingService.calculateFee({
            provinceId: Number(selectedProvinceId),
            provinceName: prov?.provinceName || '',
            toDistrictId: selectedDistrictId ? Number(selectedDistrictId) : undefined,
            toWardCode: selectedWardCode ? String(selectedWardCode) : undefined,
            orderTotal: subtotal,
            weightInGrams: estimatedWeightGrams
        })
            .then((res) => {
                if (!isCurrent) return;
                const data = res.data || res;
                setShippingDetail({ quoteKey: shippingQuoteKey, data });
            })
            .catch((err) => {
                if (!isCurrent) return;
                setShippingDetail(null);
                setShippingError(err.message || 'Không thể tính phí vận chuyển GHN.');
            })
            .finally(() => {
                if (isCurrent) setIsLoadingFee(false);
            });
        return () => {
            isCurrent = false;
        };
    }, [selectedProvinceId, selectedDistrictId, selectedWardCode, subtotal, provinces, estimatedWeightGrams, shippingRefreshKey, shippingQuoteKey]);

    const isNonHcmAddress = useMemo(() => {
        if (selectedProvinceId) {
            return Number(selectedProvinceId) !== 202;
        }
        const raw = String(activeAddress || '').toLowerCase();
        if (!raw || raw.length < 3) return false;
        return !(raw.includes('hồ chí minh') || raw.includes('tp.hcm') || raw.includes('tphcm') || raw.includes('hcm') || raw.includes('thủ đức') || raw.includes('sài gòn'));
    }, [selectedProvinceId, activeAddress]);

    const currentShippingDetail = shippingDetail?.quoteKey === shippingQuoteKey ? shippingDetail.data : null;

    const displayDeliveryProvider = currentShippingDetail?.deliveryProvider
        || (isNonHcmAddress ? 'Giao Hàng Nhanh (GHN Express)' : 'Shop Shipper (Nội thành TP.HCM)');

    const displayDeliveryType = currentShippingDetail?.deliveryType
        || (isNonHcmAddress ? 'GHN' : 'INTERNAL');

    const displayEstimatedDelivery = currentShippingDetail?.estimatedDelivery
        || (isNonHcmAddress ? '2 - 4 ngày làm việc' : 'Giao nhanh trong 24 giờ');

    const rawShippingFee = currentShippingDetail?.shippingFee;
    const numericShippingFee = Number(rawShippingFee);
    const currentShippingFee = rawShippingFee !== undefined
        && rawShippingFee !== null
        && Number.isFinite(numericShippingFee)
        && numericShippingFee >= 0
        ? numericShippingFee
        : null;

    const finalTotal = currentShippingFee === null
        ? null
        : Math.max(0, subtotal + currentShippingFee - appliedDiscount);

    const handleApplyCoupon = useCallback(async (e, overrideCode) => {
        if (e && e.preventDefault) e.preventDefault();
        const code = (overrideCode || couponInput).trim().toUpperCase();
        if (!code) {
            triggerToast('Vui lòng nhập mã giảm giá.', 'warning');
            return;
        }

        if (subtotal <= 0) {
            triggerToast('Đơn hàng không có sản phẩm để áp dụng mã.', 'warning');
            return;
        }

        setIsValidatingCoupon(true);
        try {
            const res = await discountService.validatePromotion({
                code,
                subtotal
            });
            setAppliedCoupon(res);
            setAppliedDiscount(Number(res.discountAmount) || 0);
            setCouponInput(code);
            triggerToast(res.message || `Áp dụng mã ${code} thành công: Giảm ${formatCurrency(res.discountAmount)}.`, 'success');
        } catch (err) {
            setAppliedCoupon(null);
            setAppliedDiscount(0);
            triggerToast(err.message || 'Mã giảm giá không hợp lệ hoặc đã hết hạn.', 'warning');
        } finally {
            setIsValidatingCoupon(false);
        }
    }, [couponInput, subtotal, triggerToast]);

    const handleRemoveCoupon = useCallback(() => {
        setAppliedCoupon(null);
        setAppliedDiscount(0);
        setCouponInput('');
        triggerToast('Đã gỡ mã giảm giá.', 'info');
    }, [triggerToast]);

    const handleChangeForm = useCallback((e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleOpenAddressModal = useCallback(async () => {
        const pId = selectedProvinceId;
        const dId = selectedDistrictId;
        const wCode = selectedWardCode;

        setTempAddress({
            fullName: form.fullName || '',
            phone: form.phone || '',
            provinceId: pId,
            districtId: dId,
            wardCode: wCode,
            streetAddress,
            isDefault: true
        });

        if (pId) {
            setIsLoadingTempDistricts(true);
            try {
                const res = await shippingService.getDistricts(pId);
                const dList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setTempDistricts(dList);
            } catch (err) {
                setTempDistricts([]);
                triggerToast(err.message || 'Không thể tải danh sách Quận/Huyện từ GHN.', 'error');
            } finally {
                setIsLoadingTempDistricts(false);
            }
        } else {
            setTempDistricts([]);
        }

        if (dId) {
            setIsLoadingTempWards(true);
            try {
                const res = await shippingService.getWards(dId);
                const wList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setTempWards(wList);
            } catch (err) {
                setTempWards([]);
                triggerToast(err.message || 'Không thể tải danh sách Phường/Xã từ GHN.', 'error');
            } finally {
                setIsLoadingTempWards(false);
            }
        } else {
            setTempWards([]);
        }

        setAddressEditMode(!activeAddress);
        setIsAddressModalOpen(true);
    }, [selectedProvinceId, selectedDistrictId, selectedWardCode, streetAddress, form.fullName, form.phone, activeAddress, triggerToast]);

    const handleTempProvinceChange = useCallback(async (e) => {
        const pId = e.target.value;
        setTempAddress((prev) => ({
            ...prev,
            provinceId: pId,
            districtId: '',
            wardCode: ''
        }));
        setTempDistricts([]);
        setTempWards([]);
        if (pId) {
            setIsLoadingTempDistricts(true);
            try {
                const res = await shippingService.getDistricts(pId);
                const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setTempDistricts(list);
                if (list.length === 0) {
                    triggerToast('Không có danh sách Quận/Huyện khả dụng cho tỉnh thành này.', 'warning');
                }
            } catch (err) {
                setTempDistricts([]);
                triggerToast(err.message || 'Không thể tải danh sách Quận/Huyện từ GHN. Vui lòng thử lại.', 'error');
            } finally {
                setIsLoadingTempDistricts(false);
            }
        }
    }, [triggerToast]);

    const handleTempDistrictChange = useCallback(async (e) => {
        const dId = e.target.value;
        setTempAddress((prev) => ({
            ...prev,
            districtId: dId,
            wardCode: ''
        }));
        setTempWards([]);
        if (dId) {
            setIsLoadingTempWards(true);
            try {
                const res = await shippingService.getWards(dId);
                const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setTempWards(list);
                if (list.length === 0) {
                    triggerToast('Không có danh sách Phường/Xã khả dụng cho quận huyện này.', 'warning');
                }
            } catch (err) {
                setTempWards([]);
                triggerToast(err.message || 'Không thể tải danh sách Phường/Xã từ GHN. Vui lòng thử lại.', 'error');
            } finally {
                setIsLoadingTempWards(false);
            }
        }
    }, [triggerToast]);

    const tempPreviewAddress = useMemo(() => {
        const prov = provinces.find((p) => String(p.provinceId) === String(tempAddress.provinceId));
        const dist = tempDistricts.find((d) => String(d.districtId) === String(tempAddress.districtId));
        const ward = tempWards.find((w) => String(w.wardCode) === String(tempAddress.wardCode));
        return composeFullAddress(tempAddress.streetAddress, ward?.wardName, dist?.districtName, prov?.provinceName);
    }, [tempAddress, provinces, tempDistricts, tempWards]);

    const handleConfirmAddressModal = useCallback(async () => {
        if (!addressEditMode) {
            setIsAddressModalOpen(false);
            return;
        }

        const trimmedName = tempAddress.fullName.trim();
        if (!trimmedName) {
            triggerToast('Vui lòng nhập họ và tên người nhận.', 'warning');
            return;
        }

        const trimmedPhone = tempAddress.phone.trim();
        const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!phoneRegex.test(trimmedPhone)) {
            triggerToast('Số điện thoại không hợp lệ (cần đúng 10 chữ số).', 'warning');
            return;
        }

        if (!tempAddress.provinceId) {
            triggerToast('Vui lòng chọn Tỉnh / Thành phố.', 'warning');
            return;
        }

        if (!tempAddress.districtId) {
            triggerToast('Vui lòng chọn Quận / Huyện.', 'warning');
            return;
        }

        if (!tempAddress.wardCode) {
            triggerToast('Vui lòng chọn Phường / Xã.', 'warning');
            return;
        }

        const trimmedStreet = tempAddress.streetAddress.trim();
        if (!trimmedStreet) {
            triggerToast('Vui lòng nhập số nhà, tên đường chi tiết.', 'warning');
            return;
        }

        const prov = provinces.find((p) => String(p.provinceId) === String(tempAddress.provinceId));
        const dist = tempDistricts.find((d) => String(d.districtId) === String(tempAddress.districtId));
        const ward = tempWards.find((w) => String(w.wardCode) === String(tempAddress.wardCode));
        const fullAddr = composeFullAddress(trimmedStreet, ward?.wardName, dist?.districtName, prov?.provinceName);

        setForm((prev) => ({
            ...prev,
            fullName: trimmedName,
            phone: trimmedPhone
        }));

        setActiveAddress(fullAddr);
        setSelectedProvinceId(String(tempAddress.provinceId));
        setSelectedDistrictId(String(tempAddress.districtId));
        setSelectedWardCode(String(tempAddress.wardCode));
        setStreetAddress(trimmedStreet);

        const locationMeta = {
            provinceId: Number(tempAddress.provinceId),
            provinceName: prov?.provinceName || '',
            districtId: Number(tempAddress.districtId),
            districtName: dist?.districtName || '',
            wardCode: String(tempAddress.wardCode),
            wardName: ward?.wardName || '',
            streetAddress: trimmedStreet,
            address: fullAddr,
            fullName: trimmedName,
            phone: trimmedPhone
        };

        let defaultAddressError = '';
        if (tempAddress.isDefault) {
            if (localStorage.getItem('accessToken')) {
                try {
                    await userService.updateProfile({
                        fullName: trimmedName,
                        phoneNumber: trimmedPhone,
                        address: fullAddr
                    });
                    setSavedShippingLocation(locationMeta);
                } catch (err) {
                    defaultAddressError = err.message || 'Không thể lưu địa chỉ mặc định vào hồ sơ.';
                }
            } else {
                setSavedShippingLocation(locationMeta);
            }
        }

        setIsAddressModalOpen(false);
        triggerToast(defaultAddressError || 'Cập nhật địa chỉ nhận hàng thành công.', defaultAddressError ? 'error' : 'success');
    }, [addressEditMode, tempAddress, provinces, tempDistricts, tempWards, triggerToast]);

    const handlePlaceOrder = async (e) => {
        e.preventDefault();

        if (items.length === 0) {
            triggerToast('Không có sản phẩm nào trong đơn hàng.', 'warning');
            return;
        }

        if (!form.fullName.trim()) {
            triggerToast('Vui lòng nhập họ tên người nhận.', 'warning');
            return;
        }

        const phoneTrimmed = form.phone.trim();
        const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
        if (!phoneRegex.test(phoneTrimmed)) {
            triggerToast('Số điện thoại nhận hàng không hợp lệ (cần đúng 10 chữ số).', 'warning');
            return;
        }

        if (!activeAddress || activeAddress.trim().length < 5) {
            triggerToast('Vui lòng thiết lập địa chỉ nhận hàng.', 'warning');
            handleOpenAddressModal();
            return;
        }

        let finalDistrictId = selectedDistrictId;
        let finalWardCode = selectedWardCode;
        let finalProvinceId = selectedProvinceId;
        let finalStreetAddress = streetAddress;
        let resolvedAddress = null;

        if (!finalProvinceId || !finalDistrictId || !finalWardCode || !finalStreetAddress.trim()) {
            resolvedAddress = await resolveAddressToGhn(activeAddress, provinces, shippingService);
            if (resolvedAddress?.provinceId && resolvedAddress?.districtId && resolvedAddress?.wardCode && resolvedAddress?.streetAddress) {
                finalDistrictId = String(resolvedAddress.districtId);
                finalWardCode = String(resolvedAddress.wardCode);
                finalProvinceId = String(resolvedAddress.provinceId);
                finalStreetAddress = resolvedAddress.streetAddress;
                setSelectedProvinceId(finalProvinceId);
                setSelectedDistrictId(finalDistrictId);
                setSelectedWardCode(finalWardCode);
                setStreetAddress(finalStreetAddress);
            } else {
                triggerToast('Vui lòng chọn đầy đủ Tỉnh/Thành, Quận/Huyện, Phường/Xã và địa chỉ cụ thể.', 'warning');
                handleOpenAddressModal();
                return;
            }
        }

        if (isLoadingFee || shippingError || currentShippingFee === null) {
            triggerToast(shippingError || (isLoadingFee
                ? 'Đang cập nhật phí vận chuyển, vui lòng chờ trong giây lát.'
                : 'Chưa thể xác nhận phí vận chuyển. Vui lòng kiểm tra lại địa chỉ.'), 'warning');
            return;
        }

        if (!localStorage.getItem('accessToken')) {
            triggerToast('Vui lòng đăng nhập tài khoản trước khi đặt hàng.', 'warning');
            return;
        }

        setIsSubmitting(true);

        const activeCouponCode = appliedCoupon?.discount?.code || (appliedCoupon ? couponInput.trim().toUpperCase() : undefined);

        const orderPayload = {
            receiverName: form.fullName.trim(),
            recipientName: form.fullName.trim(),
            fullName: form.fullName.trim(),
            phone: phoneTrimmed,
            phoneNumber: phoneTrimmed,
            address: resolvedAddress?.fullAddress || activeAddress.trim(),
            delivery_type: displayDeliveryType,
            provinceId: Number(finalProvinceId),
            toDistrictId: Number(finalDistrictId),
            toWardCode: String(finalWardCode),
            expectedShippingFee: currentShippingFee,
            note: form.note.trim() || undefined,
            paymentMethod,
            discountId: appliedCoupon?.discount?.id,
            couponCode: activeCouponCode,
            selectedBookIds: items.map((it) => it.bookId || it.book_id || it.id),
            items: items.map((it) => ({
                bookId: it.bookId || it.book_id || it.id,
                quantity: it.quantity,
                price: it.price
            }))
        };

        try {
            const res = await orderService.createOrder(orderPayload);
            const created = res.data || res;

            if (onOrderCompleted) {
                onOrderCompleted(items);
            }

            const paymentUrl = created.paymentUrl || created.payUrl || created.pay_url;
            if (paymentMethod === 'VNPAY' && paymentUrl) {
                window.location.href = paymentUrl;
                return;
            }

            const orderCode = created.id || created.orderId || 'SERN-ORDER';
            const createdTotal = Number(created.total);
            if (paymentMethod === 'VNPAY') {
                triggerToast(`Đơn ${orderCode} đã tạo nhưng chưa nhận được liên kết VNPAY. Vui lòng mở lịch sử đơn hàng để thanh toán.`, 'error');
                return;
            }
            if (!Number.isFinite(createdTotal) || createdTotal < 0) {
                triggerToast(`Đơn ${orderCode} đã tạo nhưng phản hồi tổng tiền không hợp lệ. Vui lòng kiểm tra lịch sử đơn hàng.`, 'error');
                return;
            }

            setSuccessOrder({
                orderCode,
                fullName: form.fullName.trim(),
                phone: phoneTrimmed,
                address: activeAddress.trim(),
                total: createdTotal,
                paymentMethod: getPaymentMethodLabel(paymentMethod, 'checkout'),
                ghnCode: created.ghnCode || created.ghn_code || null
            });
        } catch (err) {
            if (err.status === 409) {
                setShippingRefreshKey((current) => current + 1);
            }
            triggerToast(err.message || 'Không thể tạo đơn hàng, vui lòng thử lại.', 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (items.length === 0 && !successOrder) {
        return (
            <div className="checkout-page-wrapper">
                <div className="checkout-container">
                    <div className="checkout-empty-state">
                        <div className="checkout-empty-icon">🛒</div>
                        <h2 className="checkout-empty-title">Không có sản phẩm nào để thanh toán</h2>
                        <p className="checkout-empty-text">Vui lòng quay lại giỏ hàng và tích chọn các cuốn sách bạn muốn mua trước khi tiếp tục.</p>
                        <button
                            type="button"
                            className="checkout-empty-btn"
                            onClick={onBackToCart}
                        >
                            Quay lại giỏ hàng
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="checkout-page-wrapper">
            {toast && (
                <div className="cart-toast-container">
                    <div className={`cart-toast ${toast.type}`}>
                        <span>{toast.message}</span>
                    </div>
                </div>
            )}

            <div className="checkout-container">
                <div className="checkout-header-section">
                    <h1 className="checkout-page-title">Xác nhận & Đặt hàng</h1>
                    <button
                        type="button"
                        className="checkout-back-link"
                        onClick={onBackToCart}
                    >
                        ← Quay lại giỏ hàng
                    </button>
                </div>

                <div className="checkout-layout">
                    <div className="checkout-main-content">
                        <form onSubmit={handlePlaceOrder}>
                            <div className="checkout-section-card">
                                <h2 className="checkout-section-title">
                                    <MapPinIcon size={18} style={{ color: '#0088a9' }} />
                                    <span>1. Thông tin giao hàng</span>
                                </h2>
                                <div className="checkout-form-grid">
                                    <div className="checkout-form-group">
                                        <label className="checkout-label">
                                            Họ và tên người nhận <span className="required">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            name="fullName"
                                            maxLength={100}
                                            className="checkout-input"
                                            placeholder="Ví dụ: Nguyễn Văn A"
                                            value={form.fullName}
                                            onChange={handleChangeForm}
                                        />
                                    </div>
                                </div>

                                <div className="checkout-address-section-body">
                                    {activeAddress ? (
                                        <div className="checkout-default-address-card">
                                            <div className="checkout-default-address-meta">
                                                <div className="checkout-address-user-line">
                                                    <span className="checkout-address-recipient-name">{form.fullName || 'Người nhận'}</span>
                                                    <span className="checkout-address-separator">|</span>
                                                    <span className="checkout-address-recipient-phone">{form.phone || 'Chưa có SĐT'}</span>
                                                    <span className="checkout-default-badge">Mặc định</span>
                                                </div>
                                                <div className="checkout-address-detail-line">
                                                    <MapPinIcon size={16} className="checkout-address-pin-icon" />
                                                    <span className="checkout-default-text">{activeAddress}</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                className="checkout-change-address-btn"
                                                onClick={handleOpenAddressModal}
                                            >
                                                Thay đổi
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="checkout-no-address-box">
                                            <p style={{ color: '#64748b', margin: '0 0 10px' }}>
                                                Bạn chưa có địa chỉ nhận hàng cho đơn này. Vui lòng thiết lập địa chỉ để giao hàng.
                                            </p>
                                            <button
                                                type="button"
                                                className="checkout-add-address-btn"
                                                onClick={handleOpenAddressModal}
                                            >
                                                + Thêm địa chỉ nhận hàng
                                            </button>
                                        </div>
                                    )}

                                <div className="checkout-note-group">
                                    <label className="checkout-label">Ghi chú cho shipper (Tùy chọn)</label>
                                    <textarea
                                        name="note"
                                        maxLength={500}
                                        className="checkout-textarea"
                                        placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao..."
                                        value={form.note}
                                        onChange={handleChangeForm}
                                        rows={2}
                                    />
                                    </div>
                                </div>
                            </div>

                            <div className="checkout-section-card" style={{ marginTop: '24px' }}>
                                <h2 className="checkout-section-title">
                                    <TruckIcon size={18} style={{ color: '#0088a9' }} />
                                    <span>2. Phương thức vận chuyển</span>
                                </h2>
                                <div className="shipping-option-box">
                                    <div className="shipping-option-info">
                                        <div className="shipping-title-row">
                                            <span className="shipping-title">{displayDeliveryProvider}</span>
                                            {displayDeliveryType === 'INTERNAL' && (
                                                <span className="shipping-badge-internal">Nội thành 24h</span>
                                            )}
                                            {displayDeliveryType === 'GHN' && (
                                                <span className="shipping-badge-ghn">GHN Express</span>
                                            )}
                                        </div>
                                        <span className="shipping-subtitle">Thời gian giao dự kiến: {displayEstimatedDelivery}</span>
                                    </div>
                                    <div>
                                        {shippingError ? (
                                            <span style={{ color: '#b42318' }}>{shippingError}</span>
                                        ) : isLoadingFee ? (
                                            <span className="shipping-loading-text">Đang tính cước...</span>
                                        ) : currentShippingFee === null ? (
                                            <span className="shipping-loading-text">Chọn đủ địa chỉ để tính phí</span>
                                        ) : currentShippingFee === 0 ? (
                                            <span className="shipping-free-tag">Miễn phí</span>
                                        ) : (
                                            <span className="shipping-price-tag">{formatCurrency(currentShippingFee)}</span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="checkout-section-card" style={{ marginTop: '24px' }}>
                                <h2 className="checkout-section-title">
                                    <CreditCardIcon size={18} style={{ color: '#0088a9' }} />
                                    <span>3. Phương thức thanh toán</span>
                                </h2>
                                <div className="payment-options-list">
                                    <label className={`payment-option-label ${paymentMethod === 'COD' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="COD"
                                            checked={paymentMethod === 'COD'}
                                            onChange={() => setPaymentMethod('COD')}
                                            className="payment-radio"
                                        />
                                        <div className="payment-option-text">
                                            <span className="payment-title">Thanh toán khi nhận hàng (COD)</span>
                                            <span className="payment-desc">
                                                Thanh toán bằng tiền mặt trực tiếp cho nhân viên bưu tá khi nhận kiện sách.
                                            </span>
                                        </div>
                                    </label>

                                    <label className={`payment-option-label ${paymentMethod === 'VNPAY' ? 'selected' : ''}`}>
                                        <input
                                            type="radio"
                                            name="paymentMethod"
                                            value="VNPAY"
                                            checked={paymentMethod === 'VNPAY'}
                                            onChange={() => setPaymentMethod('VNPAY')}
                                            className="payment-radio"
                                        />
                                        <div className="payment-option-text">
                                            <span className="payment-title">Cổng thanh toán VNPAY / QR Code</span>
                                            <span className="payment-desc">
                                                Hỗ trợ quét mã QR ngân hàng, thẻ ATM nội địa và thẻ quốc tế Visa/MasterCard.
                                            </span>
                                        </div>
                                    </label>
                                </div>
                            </div>
                        </form>
                    </div>

                    <div className="checkout-sidebar">
                        <div className="checkout-summary-card">
                            <h3 className="checkout-summary-title">Đơn hàng ({selectedCount} cuốn)</h3>

                            <div className="checkout-items-list">
                                {items.map((item, idx) => {
                                    const unitPrice = calculateDiscountedUnitPrice(item.price, item.discount);
                                    const qty = Number(item.quantity || 1);
                                    const itemTotal = unitPrice * qty;
                                    return (
                                        <div key={item.bookId || item.id || idx} className="checkout-item-row">
                                            <img
                                                src={item.image || 'https://placehold.co/48x64/f1f5f9/94a3b8?text=Book'}
                                                alt={item.title}
                                                className="checkout-item-thumb"
                                            />
                                            <div className="checkout-item-info">
                                                <h4 className="checkout-item-title">{item.title}</h4>
                                                <div className="checkout-item-meta">
                                                    {formatCurrency(unitPrice)} × {qty}
                                                </div>
                                            </div>
                                            <div className="checkout-item-price">
                                                {formatCurrency(itemTotal)}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {appliedCoupon ? (
                                <div className="applied-coupon-card">
                                    <div className="applied-coupon-info">
                                        <span className="applied-coupon-badge">
                                            <TagIcon size={13} />
                                            <span>{appliedCoupon.discount?.code || couponInput}</span>
                                        </span>
                                        <span className="applied-coupon-text">
                                            {appliedCoupon.discount?.discount_type === 'PERCENT'
                                                ? `Giảm ${appliedCoupon.discount?.value}% (tối đa ${formatCurrency(appliedCoupon.discount?.maxDiscountValue)})`
                                                : `Giảm ${formatCurrency(appliedCoupon.discount?.value)}`}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className="remove-coupon-btn"
                                        onClick={handleRemoveCoupon}
                                        title="Hủy áp dụng mã"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleApplyCoupon} className="coupon-section">
                                    <input
                                        type="text"
                                        placeholder="Nhập mã ưu đãi (ví dụ: GIAM10K)"
                                        value={couponInput}
                                        maxLength={30}
                                        className="coupon-input"
                                        onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                                    />
                                    <button
                                        type="submit"
                                        className="coupon-btn"
                                        disabled={isValidatingCoupon || !couponInput.trim()}
                                    >
                                        {isValidatingCoupon ? 'Đang kiểm tra...' : 'Áp dụng'}
                                    </button>
                                </form>
                            )}

                            {availableDiscounts.length > 0 && !appliedCoupon && (
                                <div className="checkout-avail-promo-section">
                                    <div className="checkout-avail-promo-title">Gợi ý mã dành cho bạn:</div>
                                    <div className="checkout-avail-promo-list">
                                        {availableDiscounts.map((promo) => {
                                            const promoVal = promo.value ?? promo.discount_value ?? 0;
                                            const promoType = promo.discount_type || 'PERCENT';
                                            return (
                                                <div
                                                    key={promo.id}
                                                    className="checkout-promo-chip"
                                                    onClick={(e) => handleApplyCoupon(e, promo.code)}
                                                >
                                                    <span className="checkout-promo-chip-code">{promo.code}</span>
                                                    <span className="checkout-promo-chip-desc">
                                                        {promoType === 'PERCENT' ? `-${promoVal}%` : `-${formatCurrency(promoVal)}`}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            <div className="checkout-calc-list">
                                <div className="checkout-calc-row">
                                    <span>Tạm tính tiền sách:</span>
                                    <span className="checkout-calc-val">{formatCurrency(subtotal)}</span>
                                </div>
                                <div className="checkout-calc-row">
                                    <span>Phí giao hàng:</span>
                                    <span className="checkout-calc-val">
                                        {shippingError
                                            ? 'Chưa thể tính'
                                            : isLoadingFee
                                                ? 'Đang tính...'
                                                : currentShippingFee === null
                                                    ? 'Chọn đủ địa chỉ'
                                                    : currentShippingFee === 0
                                                        ? 'Miễn phí'
                                                        : formatCurrency(currentShippingFee)}
                                    </span>
                                </div>
                                {appliedDiscount > 0 && (
                                    <div className="checkout-calc-row discount-row">
                                        <span>Giảm giá khuyến mãi:</span>
                                        <span className="checkout-calc-val">-{formatCurrency(appliedDiscount)}</span>
                                    </div>
                                )}
                                <div className="checkout-divider" />
                                <div className="checkout-calc-row total-row">
                                    <span>Tổng thanh toán:</span>
                                    <span className="checkout-total-val">
                                        {finalTotal === null ? 'Chưa thể tính' : formatCurrency(finalTotal)}
                                    </span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="checkout-submit-btn"
                                disabled={isSubmitting || isLoadingFee || Boolean(shippingError)}
                                onClick={handlePlaceOrder}
                            >
                                {isSubmitting ? 'Đang xử lý đơn...' : isLoadingFee ? 'Đang tính cước...' : 'Xác nhận đặt hàng'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {isAddressModalOpen && (
                <div className="checkout-modal-overlay">
                    <div className="checkout-address-modal-content">
                        <div className="checkout-address-modal-header">
                            <h3 className="checkout-address-modal-title">Địa chỉ của tôi</h3>
                            <button
                                type="button"
                                className="checkout-address-modal-close-btn"
                                onClick={() => setIsAddressModalOpen(false)}
                            >
                                ×
                            </button>
                        </div>

                        <div className="checkout-address-modal-body">
                            {!addressEditMode && activeAddress ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="checkout-saved-address-item active">
                                        <input
                                            type="radio"
                                            className="checkout-saved-address-radio"
                                            checked
                                            readOnly
                                        />
                                        <div className="checkout-saved-address-info">
                                            <div className="checkout-address-user-line">
                                                <span className="checkout-address-recipient-name">{form.fullName || 'Người nhận'}</span>
                                                <span className="checkout-address-separator">|</span>
                                                <span className="checkout-address-recipient-phone">{form.phone || 'Chưa có SĐT'}</span>
                                                <span className="checkout-default-badge">Mặc định</span>
                                            </div>
                                            <div className="checkout-address-detail-line">
                                                <MapPinIcon size={16} className="checkout-address-pin-icon" />
                                                <span>{activeAddress}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="checkout-change-address-btn"
                                        style={{ alignSelf: 'flex-start', marginTop: '6px' }}
                                        onClick={() => setAddressEditMode(true)}
                                    >
                                        + Chỉnh sửa / Nhập địa chỉ mới
                                    </button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                    <div className="checkout-address-form-grid">
                                        <div className="checkout-select-group">
                                            <label className="checkout-sublabel">Họ và tên người nhận *</label>
                                            <input
                                                type="text"
                                                className="checkout-input"
                                                value={tempAddress.fullName}
                                                maxLength={100}
                                                placeholder="Ví dụ: Nguyễn Văn A"
                                                onChange={(e) => setTempAddress((prev) => ({ ...prev, fullName: e.target.value }))}
                                            />
                                        </div>

                                        <div className="checkout-select-group">
                                            <label className="checkout-sublabel">Số điện thoại nhận hàng *</label>
                                            <input
                                                type="tel"
                                                className="checkout-input"
                                                value={tempAddress.phone}
                                                maxLength={20}
                                                placeholder="Ví dụ: 0912345678"
                                                onChange={(e) => setTempAddress((prev) => ({ ...prev, phone: e.target.value }))}
                                            />
                                        </div>
                                    </div>

                                    <div className="checkout-cascading-address-grid">
                                        <div className="checkout-select-group">
                                            <label className="checkout-sublabel">Tỉnh / Thành phố *</label>
                                            <select
                                                className="checkout-select"
                                                value={tempAddress.provinceId}
                                                onChange={handleTempProvinceChange}
                                                disabled={isLoadingProvinces}
                                            >
                                                <option value="">-- Chọn Tỉnh / Thành phố --</option>
                                                {provinces.map((p) => (
                                                    <option key={p.provinceId} value={p.provinceId}>{p.provinceName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="checkout-select-group">
                                            <label className="checkout-sublabel">Quận / Huyện *</label>
                                            <select
                                                className="checkout-select"
                                                value={tempAddress.districtId}
                                                onChange={handleTempDistrictChange}
                                                disabled={!tempAddress.provinceId || isLoadingTempDistricts}
                                            >
                                                <option value="">{isLoadingTempDistricts ? 'Đang tải...' : '-- Chọn Quận / Huyện --'}</option>
                                                {tempDistricts.map((d) => (
                                                    <option key={d.districtId} value={d.districtId}>{d.districtName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="checkout-select-group">
                                            <label className="checkout-sublabel">Phường / Xã *</label>
                                            <select
                                                className="checkout-select"
                                                value={tempAddress.wardCode}
                                                onChange={(e) => setTempAddress((prev) => ({ ...prev, wardCode: e.target.value }))}
                                                disabled={!tempAddress.districtId || isLoadingTempWards}
                                            >
                                                <option value="">{isLoadingTempWards ? 'Đang tải...' : '-- Chọn Phường / Xã --'}</option>
                                                {tempWards.map((w) => (
                                                    <option key={w.wardCode} value={w.wardCode}>{w.wardName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="checkout-street-group">
                                        <label className="checkout-sublabel">Số nhà, ngõ/ngách, tên đường cụ thể *</label>
                                        <input
                                            type="text"
                                            className="checkout-input"
                                            value={tempAddress.streetAddress}
                                            maxLength={150}
                                            placeholder="Ví dụ: 77 Đ. Tân Lập 2 hoặc 1 Võ Văn Ngân"
                                            onChange={(e) => setTempAddress((prev) => ({ ...prev, streetAddress: e.target.value }))}
                                        />
                                    </div>

                                    {tempPreviewAddress && (
                                        <div className="checkout-address-preview">
                                            <span className="checkout-address-preview-label">📍 Địa chỉ hoàn chỉnh xem trước:</span>
                                            <span className="checkout-address-preview-text">{tempPreviewAddress}</span>
                                        </div>
                                    )}

                                    <label className="checkout-save-default-checkbox">
                                        <input
                                            type="checkbox"
                                            checked={tempAddress.isDefault}
                                            onChange={(e) => setTempAddress((prev) => ({ ...prev, isDefault: e.target.checked }))}
                                        />
                                        <span>Đặt làm địa chỉ giao hàng mặc định cho các đơn hàng sau</span>
                                    </label>

                                    {activeAddress && (
                                        <button
                                            type="button"
                                            className="checkout-revert-address-btn"
                                            onClick={() => setAddressEditMode(false)}
                                        >
                                            ← Quay lại địa chỉ hiện tại
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="checkout-address-modal-footer">
                            <button
                                type="button"
                                className="checkout-modal-btn-secondary"
                                onClick={() => setIsAddressModalOpen(false)}
                            >
                                Hủy
                            </button>
                            <button
                                type="button"
                                className="checkout-modal-btn-primary"
                                onClick={handleConfirmAddressModal}
                            >
                                Xác nhận & Cập nhật
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {successOrder && (
                <div className="checkout-modal-overlay">
                    <div className="checkout-modal-content">
                        <div className="checkout-success-icon">✓</div>
                        <h2 className="checkout-success-title">Đặt hàng thành công!</h2>
                        <p className="checkout-success-desc">
                            Cảm ơn bạn đã lựa chọn SERN Bookstore. Đơn hàng của bạn đã được ghi nhận vào hệ thống và đang được chuẩn bị để đóng gói chuyển giao.
                        </p>

                        <div className="checkout-success-details">
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Mã tham chiếu đơn:</span>
                                <span className="checkout-success-value">
                                    {successOrder.orderCode}
                                    <button
                                        type="button"
                                        className="order-copy-id-btn"
                                        title="Sao chép toàn bộ mã đơn"
                                        onClick={() => {
                                            if (navigator?.clipboard?.writeText) {
                                                navigator.clipboard.writeText(successOrder.orderCode).catch(() => {});
                                            }
                                        }}
                                    >
                                        📋 Chép mã
                                    </button>
                                </span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Người nhận hàng:</span>
                                <span className="checkout-success-value">{successOrder.fullName}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Số điện thoại:</span>
                                <span className="checkout-success-value">{successOrder.phone}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Địa chỉ giao:</span>
                                <span className="checkout-success-value">{successOrder.address}</span>
                            </div>
                            {successOrder.ghnCode && (
                                <div className="checkout-success-row">
                                    <span className="checkout-success-label">Mã vận đơn GHN:</span>
                                    <span className="checkout-success-value" style={{ color: '#c2410c', fontWeight: 700 }}>
                                        {successOrder.ghnCode}
                                    </span>
                                </div>
                            )}
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Phương thức:</span>
                                <span className="checkout-success-value">{successOrder.paymentMethod}</span>
                            </div>
                            <div className="checkout-success-row">
                                <span className="checkout-success-label">Tổng thanh toán:</span>
                                <span className="checkout-success-value">{formatCurrency(successOrder.total)}</span>
                            </div>
                        </div>

                        <div className="checkout-modal-actions">
                            {onViewOrders && (
                                <button
                                    type="button"
                                    className="checkout-modal-btn-primary"
                                    onClick={onViewOrders}
                                >
                                    Xem đơn hàng của tôi
                                </button>
                            )}
                            <button
                                type="button"
                                className={onViewOrders ? "checkout-modal-btn-secondary" : "checkout-modal-btn-primary"}
                                onClick={onContinueShopping}
                            >
                                Tiếp tục mua sắm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default CheckoutPage;
