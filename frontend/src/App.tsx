// frontend/src/App.tsx
import { useState, useEffect, useCallback } from 'react';
import LoginPage from './features/auth/LoginPage';
import DashboardPage from './components/DashboardPage';
import { User, logoutApi, subscribeSessionExpired, getClientSession, clearClientSession, AUTH_STORAGE } from './services/api';
import { sessionManager } from './services/sessionManager';

function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    const session = getClientSession();
    // Kiểm tra hết hạn từ trước
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
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    return localStorage.getItem(AUTH_STORAGE.EXPIRED_MESSAGE);
  });

  // Xử lý sự kiện hết hạn phiên (từ Interceptor 401, Idle Timeout, đếm giây = 0 hoặc forceExpire)
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

  // Lắng nghe sự kiện hết hạn từ API interceptor
  useEffect(() => {
    const unsubscribe = subscribeSessionExpired(handleSessionExpired);
    return () => {
      unsubscribe();
    };
  }, [handleSessionExpired]);

  // Quản lý lifecycle của SessionManager khi có token
  useEffect(() => {
    if (authToken && currentUser) {
      sessionManager.start(authToken);

      // Cập nhật state authToken khi Silent Refresh đổi token mới
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
    sessionManager.start(token);
  };

  const handleLogout = async () => {
    sessionManager.stop();
    if (authToken) {
      // 1. Gọi API thu hồi hiệu lực token ngay lập tức phía server
      await logoutApi(authToken);
    }
    // 2. Xóa toàn bộ dữ liệu phiên ở client
    clearClientSession();
    setCurrentUser(null);
    setAuthToken(null);
    setSessionExpiredMsg(null);
  };

  if (!currentUser || !authToken) {
    return (
      <LoginPage
        onLoginSuccess={handleLoginSuccess}
        expiredMessage={sessionExpiredMsg}
        onClearExpiredMessage={() => setSessionExpiredMsg(null)}
      />
    );
  }

  return (
    <DashboardPage
      user={currentUser}
      token={authToken}
      onLogout={handleLogout}
    />
  );
}

export default App;
