import { useState, useEffect } from 'react';
import './login.css';
import { loginApi, User, AUTH_STORAGE } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  expiredMessage?: string | null;
  onClearExpiredMessage?: () => void;
  onForgotPassword?: () => void;
}

export default function LoginPage({
  onLoginSuccess,
  expiredMessage,
  onClearExpiredMessage,
  onForgotPassword,
}: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const formatNotice = (msg: string) => {
    return msg.startsWith('⚠️') ? msg : `⚠️ ${msg}`;
  };

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    const stored =
      sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) ||
      localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) return formatNotice(stored);
    if (expiredMessage) return formatNotice(expiredMessage);
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return '⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return null;
  });
  const [lockRemaining, setLockRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Cập nhật thông báo hết hạn nếu prop thay đổi hoặc có query param
  useEffect(() => {
    const stored =
      sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) ||
      localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) {
      setSessionExpiredNotice(formatNotice(stored));
    } else if (expiredMessage) {
      setSessionExpiredNotice(formatNotice(expiredMessage));
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') {
        setSessionExpiredNotice('⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
      }
    }
  }, [expiredMessage]);

  // Flash Notice: Dọn sạch bộ nhớ lưu trữ và URL ngay sau khi đã nhận
  useEffect(() => {
    if (sessionExpiredNotice) {
      sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      onClearExpiredMessage?.();
      if (typeof window !== 'undefined' && window.location.search.includes('expired')) {
        const url = new URL(window.location.href);
        url.searchParams.delete('expired');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      }
    }
  }, [sessionExpiredNotice, onClearExpiredMessage]);

  const handleCloseExpiredNotice = () => {
    setSessionExpiredNotice(null);
    sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    onClearExpiredMessage?.();
    if (typeof window !== 'undefined' && window.location.search.includes('expired')) {
      const url = new URL(window.location.href);
      url.searchParams.delete('expired');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    }
  };

  // Kiểm tra trạng thái khóa khi load trang
  useEffect(() => {
    const lockUntilStr = localStorage.getItem('lockout_until');
    if (lockUntilStr) {
      const lockUntil = parseInt(lockUntilStr, 10);
      const now = Date.now();
      if (lockUntil > now) {
        setLockRemaining(Math.ceil((lockUntil - now) / 1000));
      } else {
        localStorage.removeItem('lockout_until');
        localStorage.removeItem('login_failed_count');
      }
    }
  }, []);

  // Bộ đếm ngược thời gian khóa
  useEffect(() => {
    if (lockRemaining <= 0) return;
    const timer = setInterval(() => {
      setLockRemaining((prev) => {
        if (prev <= 1) {
          localStorage.removeItem('lockout_until');
          localStorage.removeItem('login_failed_count');
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [lockRemaining]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (lockRemaining > 0 || isLoading) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();
      const data = await loginApi(cleanUsername, cleanPassword);

      // Đăng nhập thành công
      localStorage.removeItem('login_failed_count');
      localStorage.removeItem('lockout_until');
      sessionStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      localStorage.removeItem(AUTH_STORAGE.EXPIRED_MESSAGE);
      setSessionExpiredNotice(null);
      onClearExpiredMessage?.();
      setErrorMessage('');
      onLoginSuccess(data.user, data.access_token);
    } catch (err: any) {
      // Trường hợp bị khóa 15 phút (HTTP 429)
      if (err.lock_remaining_seconds) {
        const lockUntil = Date.now() + err.lock_remaining_seconds * 1000;
        localStorage.setItem('lockout_until', lockUntil.toString());
        setLockRemaining(err.lock_remaining_seconds);
        setErrorMessage('');
      } else {
        const remainInfo =
          err.remaining_attempts !== undefined ? ` (Bạn còn ${err.remaining_attempts} lần thử)` : '';
        setErrorMessage((err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.') + remainInfo);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60)
      .toString()
      .padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const roleList = [
    {
      u: 'admin',
      label: 'Quản trị hệ thống',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fecaca',
      desc: 'Toàn quyền + Giá vốn + Kho',
    },
    {
      u: 'sales_manager',
      label: 'Quản lý kinh doanh',
      color: '#7c3aed',
      bg: '#f5f3ff',
      border: '#ddd6fe',
      desc: 'Xem giá vốn & lãi',
    },
    {
      u: 'sales',
      label: 'Nhân viên kinh doanh',
      color: '#2563eb',
      bg: '#eff6ff',
      border: '#bfdbfe',
      desc: 'Chặn giá vốn & kho',
    },
    {
      u: 'kho',
      label: 'Thủ kho',
      color: '#16a34a',
      bg: '#f0fdf4',
      border: '#bbf7d0',
      desc: 'Thao tác kho, ẩn giá vốn',
    },
    {
      u: 'warehouse_mgr',
      label: 'Quản lý kho',
      color: '#059669',
      bg: '#ecfdf5',
      border: '#a7f3d0',
      desc: 'Quản lý kho & mua hàng',
    },
    {
      u: 'ketoan',
      label: 'Kế toán công nợ',
      color: '#d97706',
      bg: '#fffbeb',
      border: '#fde68a',
      desc: 'Sổ sách & đối trừ nợ',
    },
    {
      u: 'customer',
      label: 'Đại lý',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#bae6fd',
      desc: 'Tự đặt hàng & xem nợ',
    },
  ];

  return (
    <div className="login-split-container">
      {/* ================= NỬA BÊN TRÁI: VISUAL (50%) ================= */}
      <section className="login-visual-pane">
        <div className="visual-bg-image" />
        <div className="visual-gradient-overlay" />
        <div className="visual-noise" />

        {/* Nội dung trung tâm của phần Visual */}
        <div className="visual-content">
          {/* Logo & Brand Box */}
          <div className="visual-brand-header">
            <div className="visual-logo-box">
              <svg
                width="34"
                height="34"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div className="visual-brand-badge">ENTERPRISE WMS & COMMERCE</div>
          </div>

          <h1 className="visual-headline">
            Hệ Thống Quản Lý Kho <br />
            <span className="gradient-text">&amp; Bán Hàng Thông Minh</span>
          </h1>

          <p className="visual-slogan">
            Tối ưu hóa quy trình vận hành kho bãi, kiểm soát tồn kho thời gian thực và quản trị doanh số
            bán hàng đa kênh chính xác, chuẩn mực.
          </p>

          {/* Feature Highlights Bullets */}
          <div className="visual-features">
            <div className="feature-pill">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <div className="feature-text">
                <strong>Báo cáo Lãi/Lỗ Tức thì</strong>
                <span>Kiểm soát giá vốn chuẩn xác</span>
              </div>
            </div>

            <div className="feature-pill">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="feature-text">
                <strong>Điều chuyển Kho &amp; Tồn kho</strong>
                <span>Cảnh báo hết hàng tự động</span>
              </div>
            </div>

            <div className="feature-pill">
              <div className="feature-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </div>
              <div className="feature-text">
                <strong>Phân quyền 7 Cấp độ</strong>
                <span>Bảo mật dữ liệu tối đa</span>
              </div>
            </div>
          </div>

          <div className="visual-footer">
            <span>© 2026 Enterprise Warehouse &amp; Sales Management. All rights reserved.</span>
          </div>
        </div>
      </section>

      {/* ================= NỬA BÊN PHẢI: FORM ĐĂNG NHẬP (50%) ================= */}
      <section className="login-form-pane">
        <div className="form-card-container">
          {/* Header Form */}
          <div className="form-header">
            <div className="form-badge-pill">CỔNG TRUY CẬP HỆ THỐNG</div>
            <h2 className="form-title">Đăng nhập tài khoản</h2>
            <p className="form-subtitle">Chào mừng bạn quay trở lại. Vui lòng nhập thông tin để tiếp tục.</p>
          </div>

          {/* Thông báo phiên hết hạn (Flash notice) */}
          {sessionExpiredNotice && (
            <div className="session-expired-alert" role="alert">
              <div className="session-expired-content">
                <span>{sessionExpiredNotice}</span>
              </div>
              <button
                type="button"
                className="session-expired-close-btn"
                onClick={handleCloseExpiredNotice}
                title="Đóng thông báo"
                aria-label="Đóng"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          )}

          {/* Cảnh báo khóa 15 phút */}
          {lockRemaining > 0 ? (
            <div className="lock-alert">
              <div className="lock-icon-wrap">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
              <p>Tài khoản đã bị tạm khóa do nhập sai quá 5 lần liên tiếp. Vui lòng thử lại sau:</p>
              <div className="lock-timer">{formatTime(lockRemaining)}</div>
            </div>
          ) : (
            <form className="auth-form" onSubmit={handleSubmit}>
              {/* Thông báo lỗi chung */}
              {errorMessage && (
                <div className="error-alert" role="alert">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Ô Tên đăng nhập */}
              <div className="field-group">
                <label htmlFor="username">Tên đăng nhập</label>
                <div className="input-box">
                  <span className="input-icon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  </span>
                  <input
                    id="username"
                    type="text"
                    placeholder="Nhập tên đăng nhập hoặc email"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={lockRemaining > 0 || isLoading}
                    required
                    autoComplete="username"
                  />
                </div>
              </div>

              {/* Ô Mật khẩu */}
              <div className="field-group">
                <div className="label-with-link">
                  <label htmlFor="password">Mật khẩu</label>
                  {onForgotPassword && (
                    <button
                      type="button"
                      className="forgot-pwd-btn"
                      onClick={onForgotPassword}
                    >
                      Quên mật khẩu?
                    </button>
                  )}
                </div>
                <div className="input-box">
                  <span className="input-icon">
                    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={lockRemaining > 0 || isLoading}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    className="toggle-pwd-btn"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                  >
                    {showPassword ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                        <line x1="1" y1="1" x2="23" y2="23" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              {/* Nút Đăng nhập */}
              <button
                type="submit"
                className="login-submit-btn"
                disabled={lockRemaining > 0 || isLoading}
              >
                {isLoading ? (
                  <span className="btn-loading-content">
                    <span className="btn-spinner" />
                    Đang xác thực hệ thống...
                  </span>
                ) : (
                  <span className="btn-normal-content">
                    Đăng nhập hệ thống
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                      <polyline points="12 5 19 12 12 19"></polyline>
                    </svg>
                  </span>
                )}
              </button>
            </form>
          )}

          {/* Danh sách 7 vai trò nghiệp vụ (Click điền nhanh) */}
          <div className="quick-roles-card">
            <div className="quick-roles-header">
              <div className="roles-title">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.5">
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                </svg>
                <span>7 Vai Trò Nghiệp Vụ (Click để chọn nhanh)</span>
              </div>
              <span className="roles-pass-tag">
                Mật khẩu chung: <code>123</code>
              </span>
            </div>

            <div className="quick-roles-grid">
              {roleList.map((role) => (
                <button
                  key={role.u}
                  type="button"
                  className="role-select-item"
                  onClick={() => {
                    setUsername(role.u);
                    setPassword('123');
                  }}
                  style={{
                    borderColor: '#e2e8f0',
                  }}
                >
                  <div className="role-item-top">
                    <span
                      className="role-dot"
                      style={{ backgroundColor: role.color, boxShadow: `0 0 6px ${role.color}40` }}
                    />
                    <strong className="role-label" style={{ color: role.color }}>
                      {role.label}
                    </strong>
                  </div>
                  <div className="role-item-bottom">
                    <code className="role-code">{role.u}</code>
                    <span className="role-desc">{role.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
