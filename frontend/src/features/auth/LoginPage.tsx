import { useState, useEffect } from 'react';
import './login.css';
import { loginApi, User, AUTH_STORAGE } from '../../services/api';

interface LoginPageProps {
  onLoginSuccess: (user: User, token: string) => void;
  expiredMessage?: string | null;
  onClearExpiredMessage?: () => void;
}

export default function LoginPage({ onLoginSuccess, expiredMessage, onClearExpiredMessage }: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return '⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    const stored = localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) return stored;
    if (expiredMessage) return expiredMessage;
    return null;
  });
  const [lockRemaining, setLockRemaining] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Cập nhật thông báo hết hạn nếu prop thay đổi hoặc có query param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      setSessionExpiredNotice('⚠️ Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.');
    } else if (expiredMessage) {
      setSessionExpiredNotice(expiredMessage);
    }
  }, [expiredMessage]);

  // Tiêu thụ thông báo (Flash Notice): Dọn sạch bộ nhớ lưu trữ và URL ngay sau khi đã nhận
  // Nhờ đó khi người dùng bấm F5 / load lại trang, thông báo sẽ biến mất đúng như mong muốn
  useEffect(() => {
    if (sessionExpiredNotice) {
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

            <button type="submit" className="submit-btn" disabled={lockRemaining > 0 || isLoading}>
              {isLoading ? 'Đang xác thực...' : 'Đăng nhập'}
            </button>
          </form>
        )}

        {/* Danh sách tài khoản demo tiện test */}
        <div className="demo-account-hint" style={{ textAlign: 'left', lineHeight: '1.6' }}>
          <div><strong>Tài khoản thử nghiệm (kết nối Backend):</strong></div>
          <div>• Quản trị: <code>admin</code> / <code>123</code> (Xem trọn vẹn giá vốn)</div>
          <div>• Bán hàng: <code>sales</code> / <code>123</code> (Bị ẩn hoàn toàn giá vốn)</div>
          <div>• Thủ kho: <code>kho</code> / <code>123</code> (Quản lý tồn kho)</div>
        </div>
      </div>
    </div>
  );
}
