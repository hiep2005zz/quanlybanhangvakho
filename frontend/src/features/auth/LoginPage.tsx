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

  // Cập nhật thông báo hết hạn nếu prop thay đổi hoặc có query param
  useEffect(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
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
      const data = await loginApi(username, password);

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
      <div className="login-card">
        <div className="login-header">
          <div className="brand-icon">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <h2>Quản Lý Bán Hàng & Kho</h2>
          <p>Hệ thống kết nối Backend API & Phân quyền bảo mật</p>
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
                  color: '#38bdf8',
                  fontSize: '13px',
                  cursor: 'pointer',
                  padding: 0,
                  textDecoration: 'none',
                  fontWeight: '500'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
              >
                Quên mật khẩu?
              </button>
            </div>

            <button type="submit" className="submit-btn" disabled={lockRemaining > 0 || isLoading}>
              {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* Danh sách 7 vai trò nghiệp vụ (AC 1) - Click điền nhanh để kiểm thử */}
        <div className="demo-account-hint" style={{ textAlign: 'left', lineHeight: '1.5', marginTop: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <strong style={{ color: '#e2e8f0', fontSize: '13px' }}>🎯 7 Vai Trò Nghiệp Vụ (Click chọn nhanh):</strong>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>Mật khẩu chung: <code>123</code></span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {[
              { u: 'admin', label: 'Quản trị hệ thống', color: '#ef4444', desc: 'Toàn quyền + Giá vốn + Kho' },
              { u: 'sales_manager', label: 'Quản lý kinh doanh', color: '#8b5cf6', desc: 'Xem giá vốn & lãi' },
              { u: 'sales', label: 'Nhân viên kinh doanh', color: '#3b82f6', desc: 'Chặn giá vốn & chặn kho' },
              { u: 'kho', label: 'Thủ kho', color: '#10b981', desc: 'Thao tác kho, ẩn giá vốn' },
              { u: 'warehouse_mgr', label: 'Quản lý kho', color: '#059669', desc: 'Quản lý kho & mua hàng' },
              { u: 'ketoan', label: 'Kế toán', color: '#f59e0b', desc: 'Sổ sách chứng từ' },
              { u: 'muahang', label: 'Nhân viên mua hàng', color: '#06b6d4', desc: 'Lập phiếu mua hàng' },
            ].map((roleItem) => (
              <button
                key={roleItem.u}
                type="button"
                onClick={() => {
                  setUsername(roleItem.u);
                  setPassword('123');
                }}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '6px',
                  padding: '6px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  color: '#f8fafc',
                  fontSize: '11.5px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = roleItem.color)}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: roleItem.color }} />
                  <strong style={{ color: roleItem.color }}>{roleItem.label}</strong>
                </div>
                <div style={{ color: '#94a3b8', fontSize: '10.5px' }}>
                  <code>{roleItem.u}</code> • {roleItem.desc}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
