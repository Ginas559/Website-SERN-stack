import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import userService from '../services/userService';
import discountService from '../services/discountService';
import axiosClient from '../services/axiosClient';
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
        address: user?.address || '',
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

    const triggerFeedback = useCallback((text, type = 'success') => {
        setFeedback({ text, type });
        setTimeout(() => {
            setFeedback(null);
        }, 3500);
    }, []);

    useEffect(() => {
        setFormData({
            fullName: user?.fullName || user?.full_name || '',
            phone: user?.phone || user?.phoneNumber || user?.phone_number || '',
            address: user?.address || '',
            avatar: user?.avatar || ''
        });
    }, [user]);

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

        setLoading(true);
        try {
            const res = await userService.updateProfile({
                fullName: trimmedName,
                phoneNumber: trimmedPhone || null,
                address: formData.address.trim() || null,
                avatar: formData.avatar.trim() || null
            });

            const updatedUser = res.data || res;
            const merged = { ...user, ...updatedUser };
            localStorage.setItem('user', JSON.stringify(merged));
            if (onProfileUpdated) {
                onProfileUpdated(merged);
            }
            triggerFeedback('Cập nhật hồ sơ thành công!', 'success');
        } catch (err) {
            triggerFeedback(err.message || 'Không thể cập nhật hồ sơ.', 'error');
        } finally {
            setLoading(false);
        }
    }, [formData, user, onProfileUpdated, triggerFeedback]);

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
                        👤 Thông tin tài khoản
                    </button>
                    <button 
                        type="button" 
                        className={`user-profile-tab-btn ${activeTab === 'vouchers' ? 'active' : ''}`}
                        onClick={() => setActiveTab('vouchers')}
                    >
                        🏷️ Ưu đãi & Khuyến mãi
                    </button>
                    <button 
                        type="button" 
                        className={`user-profile-tab-btn ${activeTab === 'security' ? 'active' : ''}`}
                        onClick={() => setActiveTab('security')}
                    >
                        🔒 Bảo mật & Mật khẩu
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
                            <span className="user-role-badge">⭐ {roleName}</span>
                            <span className="user-status-badge">🟢 Đang hoạt động</span>
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
                                <label className="user-label">Địa chỉ giao hàng mặc định</label>
                                <input 
                                    type="text" 
                                    name="address"
                                    className="user-input" 
                                    value={formData.address}
                                    maxLength={255}
                                    placeholder="Số nhà, đường, phường/xã, quận/huyện, tỉnh/thành phố"
                                    onChange={handleChange}
                                />
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
                                            address: user?.address || '',
                                            avatar: user?.avatar || ''
                                        });
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
                        <h3 style={{ margin: '0 0 16px 0', color: '#e7b26a' }}>
                            Các mã khuyến mãi đang có hiệu lực
                        </h3>
                        {promotions.length === 0 ? (
                            <p style={{ color: '#b9b0a7' }}>Hiện chưa có mã khuyến mãi nào đang hoạt động.</p>
                        ) : (
                            <div className="user-promo-cards-grid">
                                {promotions.map((p) => (
                                    <div key={p.id || p.code} className="user-promo-card">
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
                                                ? `Giảm ${p.value}% (Tối đa ${p.maxDiscountValue ? formatCurrency(p.maxDiscountValue) : 'không giới hạn'})` 
                                                : `Giảm trực tiếp ${formatCurrency(p.value)}`}
                                            {p.minimumOrderValue > 0 && (
                                                <div style={{ marginTop: '4px', color: '#88827b' }}>
                                                    Áp dụng cho đơn từ {formatCurrency(p.minimumOrderValue)}
                                                </div>
                                            )}
                                        </div>
                                        <div className="user-promo-card-footer">
                                            <span>Còn lại: {Math.max(0, (p.quantity || 0) - (p.usedCount || 0))} lượt</span>
                                            <span>HSD: {p.expiredAt ? new Date(p.expiredAt).toLocaleDateString('vi-VN') : 'Không giới hạn'}</span>
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
                                    minLength={8}
                                    onChange={handleChangePasswordForm}
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
                                    minLength={8}
                                    onChange={handleChangePasswordForm}
                                    required
                                />
                            </div>

                            <div className="user-form-actions profile-actions">
                                <button 
                                    type="submit" 
                                    className="user-save-btn"
                                    disabled={passwordLoading}
                                >
                                    {passwordLoading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
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
