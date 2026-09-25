// frontend/src/App.tsx
import { useState, useEffect, useCallback, FormEvent } from 'react';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './components/DashboardPage';
import { User, logoutApi, subscribeSessionExpired, getClientSession, saveClientSession, clearClientSession, AUTH_STORAGE, getMeApi } from './services/api';
import { sessionManager } from './services/sessionManager';
import { requestPasswordReset, resetPassword } from './services/auth';
import './app.css';

function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialResetToken = queryParams.get('token') ?? '';
  const isResetPath = window.location.pathname.includes('reset-password') || Boolean(initialResetToken);

  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>(
    isResetPath ? 'reset' : 'login'
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetNewPassword, setShowResetNewPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Đếm ngược 60 giây chống spam request
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = getClientSession();
    if (session.expiresAt && session.expiresAt < Date.now()) {
      clearClientSession();
      return null;
    }
    return session.user;
  });

  const [authToken, setAuthToken] = useState<string | null>(() => {
    const session = getClientSession();
    if (session.expiresAt && session.expiresAt < Date.now()) {
      return null;
    }
    return session.token;
  });

  const [sessionExpiredMsg, setSessionExpiredMsg] = useState<string | null>(() => {
    const stored = sessionStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE) || localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
    if (stored) return stored;
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return null;
  });

  // Tự động đồng bộ vai trò và thông tin mới nhất từ máy chủ khi load trang (F5)
  useEffect(() => {
    if (authToken) {
      getMeApi(authToken).then((freshUser) => {
        if (freshUser) {
          setCurrentUser(freshUser);
          sessionStorage.setItem(AUTH_STORAGE.USER, JSON.stringify(freshUser));
        }
      });
    }
  }, [authToken]);

  // Xử lý sự kiện hết hạn phiên
  const handleSessionExpired = useCallback((message: string) => {
    sessionManager.stop();
    clearClientSession();
    setCurrentUser(null);
    setAuthToken(null);
    setSessionExpiredMsg(message);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('expired', 'true');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(handleSessionExpired);
    return () => {
      unsubscribe();
    };
  }, [handleSessionExpired]);

  // Quản lý lifecycle của SessionManager
  useEffect(() => {
    if (authToken && currentUser) {
      sessionManager.start(authToken, currentUser.username);
      const unsubscribeRefresh = sessionManager.onTokenRefreshed((newToken) => {
        setAuthToken(newToken);
      });
      const unsubscribeProfile = sessionManager.onUserProfileUpdated((updatedUser) => {
        setCurrentUser(updatedUser);
      });
      return () => {
        unsubscribeRefresh();
        unsubscribeProfile();
        sessionManager.stop();
      };
    } else {
      sessionManager.stop();
    }
  }, [authToken, currentUser?.username]);

  const handleLoginSuccess = (user: User, token: string) => {
    setSessionExpiredMsg(null);
    setCurrentUser(user);
    setAuthToken(token);
    sessionManager.start(token, user.username);
  };

  const handleLogout = async () => {
    sessionManager.stop();
    if (authToken) {
      await logoutApi(authToken);
    }
    clearClientSession();
    setCurrentUser(null);
    setAuthToken(null);
    setSessionExpiredMsg(null);
  };

  // Xử lý yêu cầu gửi email đặt lại mật khẩu (chống spam với isSubmitting và countdown 60s)
  async function handleForgotRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || countdown > 0) return;

    setResetError('');
    setResetMessage('');
    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(forgotEmail);
      setResetMessage(response.message);
      setCountdown(60); // Bắt đầu đếm ngược 60 giây
    } catch (requestError) {
      setResetError(requestError instanceof Error ? requestError.message : 'Không thể gửi yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // Xử lý xác nhận đổi mật khẩu qua token
  async function handleResetSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setResetError('');
    setResetMessage('');

    if (resetNewPassword.length < 8) {
      setResetError('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    if (resetConfirmPassword && resetNewPassword !== resetConfirmPassword) {
      setResetError('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await resetPassword(resetToken, resetNewPassword);
      setResetMessage(response.message);
      setResetNewPassword('');
      setResetConfirmPassword('');
      // Sau 2.5s chuyển về màn hình đăng nhập
      setTimeout(() => {
        window.history.replaceState({}, '', window.location.pathname.replace(/\/reset-password.*/, '') || '/');
        setAuthView('login');
      }, 2500);
    } catch (resetErr) {
      setResetError(resetErr instanceof Error ? resetErr.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  const handleSwitchUser = (newUser: User, newToken: string) => {
    saveClientSession(newUser, newToken);
    setCurrentUser(newUser);
    setAuthToken(newToken);
    sessionManager.start(newToken);
  };

  // Component video background động toàn trang web
  const videoBackground = (
    <div className="global-bg-video-wrapper" aria-hidden="true">
      <video
        className="global-bg-video"
        autoPlay
        loop
        muted
        playsInline
      >
        <source src="/bg-video.mp4" type="video/mp4" />
      </video>
      <div className="global-bg-video-overlay" />
    </div>
  );

  // Nếu đã đăng nhập thành công
  if (currentUser && authToken) {
    return (
      <>
        {videoBackground}
        <DashboardPage
          user={currentUser}
          token={authToken}
          onLogout={handleLogout}
          onSwitchUser={handleSwitchUser}
          onTokenUpdated={(newToken) => {
            setAuthToken(newToken);
            if (currentUser) {
              saveClientSession(currentUser, newToken);
              sessionManager.start(newToken, currentUser.username);
            }
          }}
        />
      </>
    );
  }

  // Màn hình Quên mật khẩu / Đặt lại mật khẩu
  if (authView === 'forgot' || authView === 'reset') {
    return (
      <>
        {videoBackground}
        <main className="auth-page" style={{ background: 'transparent' }}>
        <section className="auth-card" aria-labelledby="page-title">
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                margin: '0 auto 14px',
                background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
                borderRadius: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(99, 102, 241, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.35)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <p className="eyebrow">HỆ THỐNG QUẢN LÝ KHO & BÁN HÀNG</p>
            <h1 id="page-title">
              {authView === 'forgot' ? 'Lấy lại quyền truy cập' : 'Đặt lại mật khẩu mới'}
            </h1>
            <p className="intro">
              {authView === 'forgot'
                ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu có hiệu lực trong 30 phút.'
                : 'Tạo mật khẩu mới cho tài khoản của bạn (tối thiểu 8 ký tự).'}
            </p>
          </div>

          {authView === 'forgot' ? (
            <form onSubmit={handleForgotRequest}>
              <label htmlFor="email">Email tài khoản hoặc Tên đăng nhập</label>
              <input
                id="email"
                type="text"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="Nhập email (ví dụ: hiep2005zz@gmail.com) hoặc admin"
                autoComplete="username email"
                required
              />
              <button type="submit" disabled={isSubmitting || countdown > 0}>
                {isSubmitting
                  ? 'Đang gửi...'
                  : countdown > 0
                  ? `Gửi lại sau (${countdown}s)`
                  : 'Gửi liên kết đặt lại'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setResetMessage('');
                  setResetError('');
                  setAuthView('login');
                }}
              >
                ← Quay lại Đăng nhập
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetSubmit}>
              <label htmlFor="new-password">Mật khẩu mới</label>
              <div className="pwd-input-wrapper">
                <input
                  id="new-password"
                  type={showResetNewPassword ? 'text' : 'password'}
                  value={resetNewPassword}
                  onChange={(event) => setResetNewPassword(event.target.value)}
                  minLength={8}
                  placeholder="Tối thiểu 8 ký tự"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="reset-toggle-pwd-btn"
                  onClick={() => setShowResetNewPassword(!showResetNewPassword)}
                  aria-label={showResetNewPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showResetNewPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
              <div className="pwd-input-wrapper">
                <input
                  id="confirm-password"
                  type={showResetConfirmPassword ? 'text' : 'password'}
                  value={resetConfirmPassword}
                  onChange={(event) => setResetConfirmPassword(event.target.value)}
                  minLength={8}
                  placeholder="Nhập lại mật khẩu mới"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="reset-toggle-pwd-btn"
                  onClick={() => setShowResetConfirmPassword(!showResetConfirmPassword)}
                  aria-label={showResetConfirmPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showResetConfirmPassword ? 'Ẩn' : 'Hiện'}
                </button>
              </div>

              <button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Đang cập nhật...' : 'Xác nhận đặt lại mật khẩu'}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  window.history.replaceState({}, '', window.location.pathname.replace(/\/reset-password.*/, '') || '/');
                  setResetToken('');
                  setResetMessage('');
                  setResetError('');
                  setAuthView('login');
                }}
              >
                ← Quay lại Đăng nhập
              </button>
            </form>
          )}

          {resetMessage && <p className="message success" role="status">{resetMessage}</p>}
          {resetError && <p className="message error" role="alert">{resetError}</p>}
        </section>
      </main>
      </>
    );
  }

  // Màn hình Đăng nhập chuẩn
  return (
    <>
      {videoBackground}
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        expiredMessage={sessionExpiredMsg}
        onClearExpiredMessage={() => setSessionExpiredMsg(null)}
        onForgotPassword={() => {
          setResetMessage('');
          setResetError('');
          setAuthView('forgot');
        }}
      />
    </>
  );
}

export default App;
