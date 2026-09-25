// frontend/src/App.tsx
import { useState, useEffect, useCallback, FormEvent } from 'react';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './components/DashboardPage';
import { User, logoutApi, subscribeSessionExpired, subscribeAccessDenied, getClientSession, saveClientSession, clearClientSession, AUTH_STORAGE } from './services/api';
import { sessionManager } from './services/sessionManager';
import { requestPasswordReset, resetPassword } from './services/auth';
import './app.css';
import ErrorPage from './components/ErrorPage/ErrorPage';

function App() {
  const queryParams = new URLSearchParams(window.location.search);
  const initialResetToken = queryParams.get('token') ?? '';
  const isResetPath = window.location.pathname.includes('reset-password') || Boolean(initialResetToken);
  const previewError = queryParams.get('preview'); // vd: ?preview=403 - chỉ để test khi backend chưa gọi tới

  const [authView, setAuthView] = useState<'login' | 'forgot' | 'reset'>(
    isResetPath ? 'reset' : 'login'
  );
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [countdown, setCountdown] = useState<number>(0);

  // Thông báo lỗi 403 - không đủ quyền truy cập (tự động bật khi server trả về 403)
  const [accessDeniedMsg, setAccessDeniedMsg] = useState<string | null>(null);

  // Lắng nghe sự kiện bị từ chối quyền truy cập (403) từ bất kỳ API nào trong app
  useEffect(() => {
    const unsubscribe = subscribeAccessDenied((message) => {
      setAccessDeniedMsg(message);
    });
    return () => {
      unsubscribe();
    };
  }, []);

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
      return () => {
        unsubscribeRefresh();
        sessionManager.stop();
      };
    } else {
      sessionManager.stop();
    }
  }, [authToken, currentUser]);

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

  const handleSwitchUser = (newUser: User, newToken: string) => {
    saveClientSession(newUser, newToken);
    setCurrentUser(newUser);
    setAuthToken(newToken);
    sessionManager.start(newToken);
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

  // 1) Lỗi 403 THẬT phát hiện tự động từ bất kỳ API nào -> ưu tiên hiện đầu tiên
  if (accessDeniedMsg) {
    return (
      <ErrorPage
        code={403}
        title="Bạn không có quyền truy cập"
        description={accessDeniedMsg}
        actionLabel="Về trang chính"
        onAction={() => setAccessDeniedMsg(null)}
      />
    );
  }

  // 2) Chế độ xem trước qua URL (?preview=403) - chỉ để demo/test khi backend chưa gọi tới
  if (previewError === '403' || previewError === '404') {
    return (
      <ErrorPage
        code={Number(previewError)}
        title={previewError === '403' ? 'Bạn không có quyền truy cập' : 'Không tìm thấy trang'}
        description={
          previewError === '403'
            ? 'Tài khoản của bạn chưa được cấp quyền vào trang này. Liên hệ quản trị viên nếu cần hỗ trợ.'
            : 'Trang bạn tìm không tồn tại hoặc đã bị di chuyển.'
        }
        actionLabel="Về trang chính"
        onAction={() => {
          const url = new URL(window.location.href);
          url.searchParams.delete('preview');
          window.location.href = url.pathname + (url.search ? url.search : '');
        }}
      />
    );
  }

  // 3) Nếu đã đăng nhập thành công -> vào Dashboard (trang chính thật)
  if (currentUser && authToken) {
    return (
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
    );
  }

  // 4) Màn hình Quên mật khẩu / Đặt lại mật khẩu
  if (authView === 'forgot' || authView === 'reset') {
    return (
      <main className="auth-page">
        <section className="auth-card" aria-labelledby="page-title">
          <p className="eyebrow">QUẢN LÝ BÁN HÀNG & KHO</p>
          <h1 id="page-title">
            {authView === 'forgot' ? 'Lấy lại quyền truy cập' : 'Đặt lại mật khẩu mới'}
          </h1>
          <p className="intro">
            {authView === 'forgot'
              ? 'Nhập email tài khoản để nhận liên kết đặt lại mật khẩu có hiệu lực trong 30 phút.'
              : 'Tạo mật khẩu mới cho tài khoản của bạn (tối thiểu 8 ký tự).'}
          </p>

          {authView === 'forgot' ? (
            <form onSubmit={handleForgotRequest}>
              <label htmlFor="email">Email tài khoản</label>
              <input
                id="email"
                type="email"
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                placeholder="banhang@congty.vn"
                autoComplete="email"
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
              <input
                id="new-password"
                type="password"
                value={resetNewPassword}
                onChange={(event) => setResetNewPassword(event.target.value)}
                minLength={8}
                placeholder="Tối thiểu 8 ký tự"
                autoComplete="new-password"
                required
              />

              <label htmlFor="confirm-password">Xác nhận mật khẩu mới</label>
              <input
                id="confirm-password"
                type="password"
                value={resetConfirmPassword}
                onChange={(event) => setResetConfirmPassword(event.target.value)}
                minLength={8}
                placeholder="Nhập lại mật khẩu mới"
                autoComplete="new-password"
                required
              />

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
    );
  }

  // 5) Màn hình Đăng nhập chuẩn
  return (
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
  );
}

export default App;