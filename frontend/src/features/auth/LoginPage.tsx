import { useState, useEffect } from 'react';
import './login.css';
import { loginApi, User, AUTH_STORAGE } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  expiredMessage?: string | null;
  onClearExpiredMessage?: () => void;
  onForgotPassword?: () => void;
}

export default function LoginPage({ onLoginSuccess, expiredMessage, onClearExpiredMessage, onForgotPassword }: LoginPageProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const formatNotice = (msg: string) => {
    return msg.startsWith('⚠️') ? msg : `⚠️ ${msg}`;
  };

  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
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

  // Tự động mở modal nếu có thông báo phiên hết hạn để người dùng nhận biết ngay
  useEffect(() => {
    if (sessionExpiredNotice) {
      setIsModalOpen(true);
    }
  }, [sessionExpiredNotice]);

  // Cập nhật thông báo hết hạn nếu prop thay đổi hoặc có query param
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) {
      setSessionExpiredNotice(formatNotice(stored));
      setIsModalOpen(true);
    } else if (expiredMessage) {
      setSessionExpiredNotice(formatNotice(expiredMessage));
      setIsModalOpen(true);
    } else {
      const params = new URLSearchParams(window.location.search);
      if (params.get('expired') === 'true') {
        setSessionExpiredNotice('⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
        setIsModalOpen(true);
      }
    }
  }, [expiredMessage]);

  // Tiêu thụ thông báo (Flash Notice): Dọn sạch bộ nhớ lưu trữ và URL ngay sau khi đã nhận
  // Nhờ đó khi người dùng bấm F5 / load lại trang, thông báo sẽ biến mất đúng như mong muốn
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
        const remainInfo = err.remaining_attempts !== undefined ? ` (Bạn còn ${err.remaining_attempts} lần thử)` : '';
        setErrorMessage((err.message || 'Tên đăng nhập hoặc mật khẩu không chính xác.') + remainInfo);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <div className="login-wrapper">
      {/* 1. Header / Thanh điều hướng cố định trên cùng */}
      <header className="landing-header">
        <div className="landing-header-title">
          HỆ THỐNG QUẢN LÝ BÁN HÀNG VÀ KHO
        </div>
        <button
          type="button"
          className="header-login-btn"
          onClick={() => setIsModalOpen(true)}
        >
          Đăng nhập
        </button>
      </header>

      {/* 2. Modal Form Đăng nhập (hiển thị khi bấm nút Đăng nhập) */}
      {isModalOpen && (
        <div
          className="login-modal-overlay"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="login-card login-modal-card"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="login-modal-title"
          >
            {/* Nút đóng modal "X" */}
            <button
              type="button"
              className="login-modal-close-btn"
              onClick={() => setIsModalOpen(false)}
              title="Đóng cửa sổ"
              aria-label="Đóng cửa sổ đăng nhập"
              style={{
                position: 'absolute',
                top: '18px',
                right: '18px',
                width: '36px',
                height: '36px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '50%',
                color: '#475569',
                cursor: 'pointer',
                zIndex: 50,
                padding: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: 'none' }}>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>

            <div className="login-header">
              <div className="brand-icon">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h2 id="login-modal-title">Đăng nhập</h2>
            </div>

            {/* Thông báo phiên hết hạn */}
            {sessionExpiredNotice && (
              <div className="session-expired-alert" role="alert">
                <div className="session-expired-content">
                  <span>{sessionExpiredNotice.startsWith('⚠️') ? sessionExpiredNotice : `⚠️ ${sessionExpiredNotice}`}</span>
                </div>
                <button
                  type="button"
                  className="session-expired-close-btn"
                  onClick={handleCloseExpiredNotice}
                  title="Đóng thông báo"
                  aria-label="Đóng"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            )}

            {/* Cảnh báo khóa 15 phút */}
            {lockRemaining > 0 ? (
              <div className="lock-alert">
                <p>Tài khoản đã bị tạm khóa do nhập sai quá 5 lần liên tiếp. Vui lòng thử lại sau:</p>
                <div className="lock-timer">{formatTime(lockRemaining)}</div>
              </div>
            ) : (
              <form className="login-form" onSubmit={handleSubmit}>
                {/* Thông báo lỗi chung */}
                {errorMessage && (
                  <div className="error-alert">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="username">Tên đăng nhập</label>
                  <div className="input-container">
                    <input
                      id="username"
                      type="text"
                      placeholder="Nhập tên đăng nhập"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={lockRemaining > 0 || isLoading}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="password">Mật khẩu</label>
                  <div className="input-container">
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={lockRemaining > 0 || isLoading}
                      required
                    />
                    <button
                      type="button"
                      className="toggle-pwd-btn"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? 'Ẩn' : 'Hiện'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px', marginBottom: '14px' }}>
                  <button
                    type="button"
                    onClick={onForgotPassword}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#818cf8',
                      fontSize: '13px',
                      cursor: 'pointer',
                      padding: 0,
                      textDecoration: 'none',
                      fontWeight: '500',
                      transition: 'color 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.textDecoration = 'underline'; e.currentTarget.style.color = '#a5b4fc'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.textDecoration = 'none'; e.currentTarget.style.color = '#818cf8'; }}
                  >
                    Quên mật khẩu?
                  </button>
                </div>

                <button type="submit" className="submit-btn" disabled={lockRemaining > 0 || isLoading}>
                  {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
                </button>
              </form>
            )}

            {/* Danh sách 7 vai trò nghiệp vụ - Gợi ý đăng nhập nhanh */}
            <div className="demo-account-hint" style={{ textAlign: 'left', lineHeight: '1.5', marginTop: '20px', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <strong style={{ color: '#0f172a', fontSize: '13px' }}>🎯 7 Vai Trò Nghiệp Vụ (Click chọn nhanh):</strong>
                <span style={{ fontSize: '11.5px', color: '#64748b' }}>(Mật khẩu chung: <code style={{ background: '#e2e8f0', padding: '1px 5px', borderRadius: '4px', color: '#0f172a' }}>123</code>)</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {[
                  { u: 'admin', label: 'Quản trị hệ thống', color: '#dc2626', bg: '#fef2f2', border: '#fecaca', desc: 'Toàn quyền + Giá vốn + Kho' },
                  { u: 'sales_manager', label: 'Quản lý kinh doanh', color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', desc: 'Xem giá vốn & lãi' },
                  { u: 'sales', label: 'Nhân viên kinh doanh', color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe', desc: 'Chặn giá vốn & kho' },
                  { u: 'kho', label: 'Thủ kho', color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0', desc: 'Thao tác kho, ẩn giá vốn' },
                  { u: 'warehouse_mgr', label: 'Quản lý kho', color: '#059669', bg: '#ecfdf5', border: '#a7f3d0', desc: 'Quản lý kho & mua hàng' },
                  { u: 'ketoan', label: 'Kế toán công nợ', color: '#d97706', bg: '#fffbeb', border: '#fde68a', desc: 'Sổ sách & đối trừ nợ' },
                  { u: 'customer', label: 'Đại lý', color: '#0284c7', bg: '#f0f9ff', border: '#bae6fd', desc: 'Tự đặt hàng & xem nợ' },
                ].map((roleItem) => (
                  <button
                    key={roleItem.u}
                    type="button"
                    onClick={() => {
                      setUsername(roleItem.u);
                      setPassword('123');
                    }}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '9px 11px',
                      textAlign: 'left',
                      boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.04)',
                      cursor: 'pointer',
                      color: '#0f172a',
                      fontSize: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px',
                      transition: 'all 0.18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = roleItem.color;
                      e.currentTarget.style.background = roleItem.bg;
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.boxShadow = '0 4px 6px -1px rgb(0 0 0 / 0.08)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#e2e8f0';
                      e.currentTarget.style.background = '#ffffff';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 1px 2px 0 rgb(0 0 0 / 0.04)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: roleItem.color, flexShrink: 0 }} />
                      <strong style={{ color: roleItem.color, fontSize: '12px' }}>{roleItem.label}</strong>
                    </div>
                    <div style={{ color: '#64748b', fontSize: '11px' }}>
                      <code style={{ color: '#334155', fontWeight: '600' }}>{roleItem.u}</code> • {roleItem.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
