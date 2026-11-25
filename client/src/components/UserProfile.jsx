import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import userService from '../services/userService';
import discountService from '../services/discountService';
import shippingService from '../services/shippingService';
import axiosClient from '../services/axiosClient';
import {
    getSavedShippingLocation,
    setSavedShippingLocation,
    composeFullAddress,
    resolveAddressToGhn
} from '../utils/addressHelper';
import './UserProfile.css';

function formatCurrency(amount) {
    return Number(amount || 0).toLocaleString('vi-VN') + ' đ';
}

const UserProfile = memo(function UserProfile({
    user,
    onLogout,
    onProfileUpdated
}) {
    const [activeTab, setActiveTab] = useState('info');
    const [formData, setFormData] = useState({
        fullName: user?.fullName || user?.full_name || '',
        phone: user?.phone || user?.phoneNumber || user?.phone_number || '',
        avatar: user?.avatar || ''
    });

    const [passwordForm, setPasswordForm] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });

    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [feedback, setFeedback] = useState(null);
    const [promotions, setPromotions] = useState([]);
    const [copiedCode, setCopiedCode] = useState('');

    const [provinces, setProvinces] = useState([]);
    const [districts, setDistricts] = useState([]);
    const [wards, setWards] = useState([]);
    const [selectedProvinceId, setSelectedProvinceId] = useState('');
    const [selectedDistrictId, setSelectedDistrictId] = useState('');
    const [selectedWardCode, setSelectedWardCode] = useState('');
    const [streetAddress, setStreetAddress] = useState('');
    const [isLoadingProvinces, setIsLoadingProvinces] = useState(true);
    const [isLoadingDistricts, setIsLoadingDistricts] = useState(false);
    const [isLoadingWards, setIsLoadingWards] = useState(false);

    const triggerFeedback = useCallback((text, type = 'success') => {
        setFeedback({ text, type });
        setTimeout(() => {
            setFeedback(null);
        }, 3500);
    }, []);

    const loadDistricts = useCallback(async (pId) => {
        if (!pId) {
            setDistricts([]);
            setWards([]);
            return [];
        }
        setIsLoadingDistricts(true);
        try {
            const res = await shippingService.getDistricts(pId);
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setDistricts(list);
            return list;
        } catch (err) {
            setDistricts([]);
            triggerFeedback(err.message || 'Không thể tải danh sách quận/huyện GHN.', 'error');
            return [];
        } finally {
            setIsLoadingDistricts(false);
        }
    }, [triggerFeedback]);

    const loadWards = useCallback(async (dId) => {
        if (!dId) {
            setWards([]);
            return [];
        }
        setIsLoadingWards(true);
        try {
            const res = await shippingService.getWards(dId);
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setWards(list);
            return list;
        } catch (err) {
            setWards([]);
            triggerFeedback(err.message || 'Không thể tải danh sách phường/xã GHN.', 'error');
            return [];
        } finally {
            setIsLoadingWards(false);
        }
    }, [triggerFeedback]);

    useEffect(() => {
        setFormData({
            fullName: user?.fullName || user?.full_name || '',
            phone: user?.phone || user?.phoneNumber || user?.phone_number || '',
            avatar: user?.avatar || ''
        });
    }, [user]);

    useEffect(() => {
        let isCurrent = true;
        shippingService.getProvinces()
            .then(async (res) => {
                if (!isCurrent) return;
                const provList = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
                setProvinces(provList);
                setIsLoadingProvinces(false);

                const savedLoc = getSavedShippingLocation();
                if (savedLoc?.provinceId) {
                    setSelectedProvinceId(String(savedLoc.provinceId));
                    setSelectedDistrictId(String(savedLoc.districtId || ''));
                    setSelectedWardCode(String(savedLoc.wardCode || ''));
                    setStreetAddress(savedLoc.streetAddress || '');
                    if (savedLoc.provinceId) {
                        await loadDistricts(savedLoc.provinceId);
                    }
                    if (savedLoc.districtId) {
                        await loadWards(savedLoc.districtId);
                    }
                } else if (user?.address) {
                    const resolved = await resolveAddressToGhn(user.address, provList, shippingService);
                    if (!isCurrent) return;
                    if (resolved?.provinceId) {
                        setSelectedProvinceId(String(resolved.provinceId));
                        setSelectedDistrictId(String(resolved.districtId || ''));
                        setSelectedWardCode(String(resolved.wardCode || ''));
                        setStreetAddress(resolved.streetAddress || '');
                        setSavedShippingLocation({
                            ...resolved,
                            address: resolved.fullAddress || composeFullAddress(
                                resolved.streetAddress,
                                resolved.wardName,
                                resolved.districtName,
                                resolved.provinceName
                            ),
                            fullName: user?.fullName || user?.full_name || '',
                            phone: user?.phone || user?.phoneNumber || user?.phone_number || ''
                        });
                        if (resolved.provinceId) {
                            await loadDistricts(resolved.provinceId);
                        }
                        if (resolved.districtId) {
                            await loadWards(resolved.districtId);
                        }
                    }
                }
            })
            .catch((err) => {
                if (!isCurrent) return;
                setProvinces([]);
                setIsLoadingProvinces(false);
                triggerFeedback(err.message || 'Không thể tải danh sách tỉnh/thành phố GHN.', 'error');
            });
        return () => {
            isCurrent = false;
        };
    }, [user?.address, user?.fullName, user?.full_name, user?.phone, user?.phoneNumber, user?.phone_number, loadDistricts, loadWards, triggerFeedback]);

    useEffect(() => {
        if (!user?.id) return;
        let isCurrent = true;
        userService.getProfile()
            .then((res) => {
                if (!isCurrent) return;
                const fresh = res?.data || res;
                if (fresh && fresh.id) {
                    const existing = (() => {
                        try {
                            return JSON.parse(localStorage.getItem('user') || 'null') || {};
                        } catch {
                            return {};
                        }
                    })();
                    const merged = { ...existing, ...fresh };
                    try {
                        localStorage.setItem('user', JSON.stringify(merged));
                    } catch {
                        return;
                    }
                    if (onProfileUpdated) {
                        onProfileUpdated(merged);
                    }
                }
            })
            .catch(() => {});
        return () => {
            isCurrent = false;
        };
    }, [user?.id, onProfileUpdated]);

    useEffect(() => {
        let isCurrent = true;
        if (activeTab === 'vouchers') {
            discountService.getActiveDiscounts({ page: 1, limit: 20 })
                .then((res) => {
                    if (!isCurrent) return;
                    const list = Array.isArray(res) ? res : res?.discounts || [];
                    setPromotions(list);
                })
                .catch(() => {
                    if (!isCurrent) return;
                    setPromotions([]);
                });
        }
        return () => {
            isCurrent = false;
        };
    }, [activeTab]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
    };

    const handleProvinceChange = useCallback(async (e) => {
        const pId = e.target.value;
        setSelectedProvinceId(pId);
        setSelectedDistrictId('');
        setSelectedWardCode('');
        setWards([]);
        if (pId) {
            await loadDistricts(pId);
        } else {
            setDistricts([]);
        }
    }, [loadDistricts]);

    const handleDistrictChange = useCallback(async (e) => {
        const dId = e.target.value;
        setSelectedDistrictId(dId);
        setSelectedWardCode('');
        if (dId) {
            await loadWards(dId);
        } else {
            setWards([]);
        }
    }, [loadWards]);

    const handleWardChange = useCallback((e) => {
        setSelectedWardCode(e.target.value);
    }, []);

    const handleStreetChange = useCallback((e) => {
        setStreetAddress(e.target.value);
    }, []);

    const handleChangePasswordForm = useCallback((e) => {
        const { name, value } = e.target;
        setPasswordForm((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleCopyCode = useCallback((code) => {
        if (!code) return;
        setCopiedCode(code);
        setTimeout(() => setCopiedCode(''), 2000);
        if (navigator?.clipboard?.writeText) {
            navigator.clipboard.writeText(code).catch(() => {});
        }
    }, []);

    const previewAddress = useMemo(() => {
        const prov = provinces.find((p) => String(p.provinceId) === String(selectedProvinceId));
        const dist = districts.find((d) => String(d.districtId) === String(selectedDistrictId));
        const ward = wards.find((w) => String(w.wardCode) === String(selectedWardCode));
        return composeFullAddress(streetAddress, ward?.wardName, dist?.districtName, prov?.provinceName);
    }, [streetAddress, selectedWardCode, selectedDistrictId, selectedProvinceId, provinces, districts, wards]);

    const handleSaveProfile = useCallback(async (e) => {
        e.preventDefault();
        const trimmedName = formData.fullName.trim();
        if (!trimmedName) {
            triggerFeedback('Họ và tên không được để trống.', 'error');
            return;
        }

        const trimmedPhone = formData.phone.trim();
        const phoneRegex = /(84|0[3|5|7|8|9])+([0-9]{8})\b/;
        if (trimmedPhone && !phoneRegex.test(trimmedPhone)) {
            triggerFeedback('Định dạng số điện thoại không hợp lệ (10 chữ số).', 'error');
            return;
        }

        let canonicalAddress = null;
        let savedLocation = null;
        if (selectedProvinceId || selectedDistrictId || selectedWardCode || streetAddress.trim()) {
            if (!selectedProvinceId) {
                triggerFeedback('Vui lòng chọn Tỉnh / Thành phố cho địa chỉ giao hàng.', 'error');
                return;
            }
            if (!selectedDistrictId) {
                triggerFeedback('Vui lòng chọn Quận / Huyện cho địa chỉ giao hàng.', 'error');
                return;
            }
            if (!selectedWardCode) {
                triggerFeedback('Vui lòng chọn Phường / Xã cho địa chỉ giao hàng.', 'error');
                return;
            }
            if (!streetAddress.trim()) {
                triggerFeedback('Vui lòng nhập số nhà, tên đường cụ thể.', 'error');
                return;
            }
            const prov = provinces.find((p) => String(p.provinceId) === String(selectedProvinceId));
            const dist = districts.find((d) => String(d.districtId) === String(selectedDistrictId));
            const ward = wards.find((w) => String(w.wardCode) === String(selectedWardCode));
            canonicalAddress = composeFullAddress(streetAddress.trim(), ward?.wardName, dist?.districtName, prov?.provinceName);

            savedLocation = {
                provinceId: Number(selectedProvinceId),
                provinceName: prov?.provinceName || '',
                districtId: Number(selectedDistrictId),
                districtName: dist?.districtName || '',
                wardCode: String(selectedWardCode),
                wardName: ward?.wardName || '',
                streetAddress: streetAddress.trim(),
                address: canonicalAddress,
                fullName: trimmedName,
                phone: trimmedPhone
            };
        }

        setLoading(true);
        try {
            const res = await userService.updateProfile({
                fullName: trimmedName,
                phoneNumber: trimmedPhone || null,
                address: canonicalAddress,
                avatar: formData.avatar.trim() || null
            });

            const updatedUser = res.data || res;
            const merged = { ...user, ...updatedUser, address: canonicalAddress };
            localStorage.setItem('user', JSON.stringify(merged));
            setSavedShippingLocation(savedLocation);
            if (onProfileUpdated) {
                onProfileUpdated(merged);
            }
            triggerFeedback('Cập nhật hồ sơ thành công!', 'success');
        } catch (err) {
            triggerFeedback(err.message || 'Không thể cập nhật hồ sơ.', 'error');
        } finally {
            setLoading(false);
        }
    }, [formData, user, onProfileUpdated, triggerFeedback, selectedProvinceId, selectedDistrictId, selectedWardCode, streetAddress, provinces, districts, wards]);

    const handleChangePassword = useCallback(async (e) => {
        e.preventDefault();
        if (!passwordForm.currentPassword) {
            triggerFeedback('Vui lòng nhập mật khẩu hiện tại.', 'error');
            return;
        }

        if (passwordForm.newPassword.length < 8) {
            triggerFeedback('Mật khẩu mới phải có tối thiểu 8 ký tự.', 'error');
            return;
        }

        if (passwordForm.newPassword !== passwordForm.confirmPassword) {
            triggerFeedback('Mật khẩu xác nhận không khớp.', 'error');
            return;
        }

        setPasswordLoading(true);
        try {
            await axiosClient.post('/auth/change-password', passwordForm);

            setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
            triggerFeedback('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.', 'success');
            setTimeout(() => {
                if (onLogout) onLogout();
            }, 1800);
        } catch (err) {
            triggerFeedback(err.message || 'Không thể đổi mật khẩu.', 'error');
        } finally {
            setPasswordLoading(false);
        }
    }, [passwordForm, onLogout, triggerFeedback]);

    const roleName = useMemo(() => {
        if (!user) return 'Khách hàng';
        return user.isAdmin || user.role === 'Admin' || user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Khách hàng thân thiết';
    }, [user]);

    return (
        <div className="user-profile-wrapper">
            <div className="user-profile-container">
                <div className="user-profile-header">
                    <div>
                        <h1 className="user-profile-title">Hồ sơ người dùng</h1>
                    </div>
                    <button
                        type="button"
                        className="user-profile-logout-btn"
                        onClick={onLogout}
                    >
                        Đăng xuất tài khoản
                    </button>
                </div>

                <div className="user-profile-tabs">
                    <button
                        type="button"
                        className={`user-profile-tab-btn ${activeTab === 'info' ? 'active' : ''}`}
                        onClick={() => setActiveTab('info')}
                    >
                        <UserIcon size={16} />
                        <span>Thông tin tài khoản</span>
                    </button>
                    <button
                        type="button"
                        className={`user-profile-tab-btn ${activeTab === 'vouchers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('vouchers')}
                    >
                        <TagIcon size={16} />
                        <span>Ưu đãi & Khuyến mãi</span>
                    </button>
                    <button
                        type="button"
                        className={`user-profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        <LockIcon size={16} />
                        <span>Bảo mật & Mật khẩu</span>
                    </button>
                </div>

                {feedback && (
                    <div className={`user-feedback-msg ${feedback.type}`}>
                        {feedback.text}
                    </div>
                )}

                {activeTab === 'info' && (
                    <div className="user-profile-card">
                        <div className="user-profile-badge-row">
                            <span className="user-role-badge">
                                <StarIcon size={14} className="badge-star-icon" />
                                <span>{roleName}</span>
                            </span>
                            <span className="user-status-badge">
                                <span className="status-dot-active"></span>
                                <span>Đang hoạt động</span>
                            </span>
                        </div>

                        <form onSubmit={handleSaveProfile} className="user-form-grid">
                            <div className="user-form-group">
                                <label className="user-label">Tên đăng nhập</label>
                                <input
                                    type="text"
                                    className="user-input"
                                    value={user?.username || ''}
                                    disabled
                                />
                            </div>

                            <div className="user-form-group">
                                <label className="user-label">Địa chỉ email</label>
                                <input
                                    type="email"
                                    className="user-input"
                                    value={user?.email || ''}
                                    disabled
                                />
                            </div>

                            <div className="user-form-group">
                                <label className="user-label">Họ và tên</label>
                                <input
                                    type="text"
                                    name="fullName"
                                    className="user-input"
                                    value={formData.fullName}
                                    maxLength={100}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="user-form-group">
                                <label className="user-label">Số điện thoại</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    className="user-input"
                                    value={formData.phone}
                                    maxLength={20}
                                    placeholder="0912345678"
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="user-form-group full-width">
                                <label className="user-label">Địa chỉ giao hàng mặc định (3 cấp hành chính GHN)</label>
                                <div className="user-address-picker-grid">
                                    <div className="user-address-col">
                                        <label className="user-sublabel">Tỉnh / Thành phố *</label>
                                        <select
                                            className="user-select"
                                            value={selectedProvinceId}
                                            onChange={handleProvinceChange}
                                            disabled={isLoadingProvinces}
                                        >
                                            <option value="">-- Chọn Tỉnh / Thành phố --</option>
                                            {provinces.map((p) => (
                                                <option key={p.provinceId} value={p.provinceId}>
                                                    {p.provinceName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="user-address-col">
                                        <label className="user-sublabel">Quận / Huyện *</label>
                                        <select
                                            className="user-select"
                                            value={selectedDistrictId}
                                            onChange={handleDistrictChange}
                                            disabled={!selectedProvinceId || isLoadingDistricts}
                                        >
                                            <option value="">
                                                {isLoadingDistricts ? 'Đang tải...' : '-- Chọn Quận / Huyện --'}
                                            </option>
                                            {districts.map((d) => (
                                                <option key={d.districtId} value={d.districtId}>
                                                    {d.districtName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="user-address-col">
                                        <label className="user-sublabel">Phường / Xã *</label>
                                        <select
                                            className="user-select"
                                            value={selectedWardCode}
                                            onChange={handleWardChange}
                                            disabled={!selectedDistrictId || isLoadingWards}
                                        >
                                            <option value="">
                                                {isLoadingWards ? 'Đang tải...' : '-- Chọn Phường / Xã --'}
                                            </option>
                                            {wards.map((w) => (
                                                <option key={w.wardCode} value={w.wardCode}>
                                                    {w.wardName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="user-address-col full-width">
                                        <label className="user-sublabel">Số nhà, ngõ/ngách, tên đường cụ thể *</label>
                                        <input
                                            type="text"
                                            className="user-input"
                                            value={streetAddress}
                                            maxLength={150}
                                            placeholder="Ví dụ: 77 Đ. Tân Lập 2 hoặc 1 Võ Văn Ngân"
                                            onChange={handleStreetChange}
                                        />
                                    </div>
                                </div>

                                {previewAddress && (
                                    <div className="user-address-preview">
                                        <span className="user-address-preview-tag">📍 Địa chỉ hoàn chỉnh xem trước:</span>
                                        <span>{previewAddress}</span>
                                    </div>
                                )}
                            </div>

                            <div className="user-form-group full-width">
                                <label className="user-label">Đường dẫn ảnh đại diện (URL)</label>
                                <input
                                    type="url"
                                    name="avatar"
                                    className="user-input"
                                    value={formData.avatar}
                                    maxLength={255}
                                    placeholder="https://example.com/avatar.jpg"
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="user-form-actions profile-actions">
                                <button
                                    type="button"
                                    className="user-reset-btn"
                                    onClick={() => {
                                        setFormData({
                                            fullName: user?.fullName || user?.full_name || '',
                                            phone: user?.phone || user?.phoneNumber || user?.phone_number || '',
                                            avatar: user?.avatar || ''
                                        });
                                        const savedLoc = getSavedShippingLocation();
                                        if (savedLoc?.provinceId) {
                                            setSelectedProvinceId(String(savedLoc.provinceId));
                                            setSelectedDistrictId(String(savedLoc.districtId || ''));
                                            setSelectedWardCode(String(savedLoc.wardCode || ''));
                                            setStreetAddress(savedLoc.streetAddress || '');
                                        } else {
                                            setSelectedProvinceId('');
                                            setSelectedDistrictId('');
                                            setSelectedWardCode('');
                                            setStreetAddress('');
                                        }
                                    }}
                                >
                                    Khôi phục
                                </button>
                                <button
                                    type="submit"
                                    className="user-save-btn"
                                    disabled={loading}
                                >
                                    {loading ? 'Đang lưu...' : 'Lưu thay đổi'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {activeTab === 'vouchers' && (
                    <div className="user-profile-card">
                        {promotions.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                                <p>Hiện không có mã ưu đãi nào khả dụng.</p>
                            </div>
                        ) : (
                            <div className="user-promo-cards-grid">
                                {promotions.map((p) => (
                                    <div key={p.id} className="user-promo-card">
                                        <div className="user-promo-card-header">
                                            <span className="user-promo-card-code">{p.code}</span>
                                            <button
                                                type="button"
                                                className="user-promo-copy-btn"
                                                onClick={() => handleCopyCode(p.code)}
                                            >
                                                {copiedCode === p.code ? 'Đã sao chép!' : 'Sao chép mã'}
                                            </button>
                                        </div>
                                        <div className="user-promo-card-desc">
                                            {p.discount_type === 'PERCENT'
                                                ? `Giảm ${p.value ?? p.discount_value ?? 0}% (Tối đa ${p.maxDiscountValue ? formatCurrency(p.maxDiscountValue) : 'không giới hạn'})`
                                                : `Giảm trực tiếp ${formatCurrency(p.value ?? p.discount_value ?? 0)}`}
                                            {(p.minimumOrderValue || p.min_order_value) > 0 && (
                                                <div style={{ marginTop: '4px', color: '#64748b' }}>
                                                    Áp dụng cho đơn từ {formatCurrency(p.minimumOrderValue || p.min_order_value)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="user-promo-card-footer">
                                            <span>Còn lại: {Math.max(0, (p.quantity || 0) - (p.usedCount || 0))} lượt</span>
                                            <span>HSD: {(p.expiredAt || p.end_date) ? new Date(p.expiredAt || p.end_date).toLocaleDateString('vi-VN') : 'Không giới hạn'}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'security' && (
                    <div className="user-profile-card">
                        <form onSubmit={handleChangePassword} className="user-form-grid">
                            <div className="user-form-group full-width">
                                <label className="user-label">Mật khẩu hiện tại</label>
                                <input
                                    type="password"
                                    name="currentPassword"
                                    className="user-input"
                                    value={passwordForm.currentPassword}
                                    onChange={handleChangePasswordForm}
                                    required
                                />
                            </div>

                            <div className="user-form-group">
                                <label className="user-label">Mật khẩu mới (tối thiểu 8 ký tự)</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    className="user-input"
                                    value={passwordForm.newPassword}
                                    onChange={handleChangePasswordForm}
                                    minLength={8}
                                    required
                                />
                            </div>

                            <div className="user-form-group">
                                <label className="user-label">Xác nhận mật khẩu mới</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    className="user-input"
                                    value={passwordForm.confirmPassword}
                                    onChange={handleChangePasswordForm}
                                    minLength={8}
                                    required
                                />
                            </div>

                            <div className="user-form-actions profile-actions">
                                <button
                                    type="submit"
                                    className="user-save-btn"
                                    disabled={passwordLoading}
                                >
                                    {passwordLoading ? 'Đang đổi mật khẩu...' : 'Xác nhận đổi mật khẩu'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
});

export default UserProfile;
