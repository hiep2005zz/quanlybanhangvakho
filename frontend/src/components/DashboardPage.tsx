import { useState, useEffect, useRef } from 'react';
import { getProductsApi, getMeApi, ProductItem, User } from '../services/api';
import { sessionManager, SessionState } from '../services/sessionManager';
import SecurityModal from './SecurityModal';
import { UserManagementView } from './UserManagementView';
import './dashboard.css';

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void | Promise<void>;
  onTokenUpdated?: (newToken: string) => void;
  onSwitchUser?: (newUser: User, newToken: string) => void;
  onPermissionsUpdated?: (user: User) => void;
}

export default function DashboardPage({
  user,
  token,
  onLogout,
  onTokenUpdated,
  onPermissionsUpdated,
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'users'>('inventory');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isCostVisible, setIsCostVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionState>(() => sessionManager.getSessionState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [openCustomerCreateOnUsers, setOpenCustomerCreateOnUsers] = useState(false);

  // Timer điều khiển di chuột vào mở rộng, di chuột ra tự động đóng
  const menuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnterMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeaveMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
    }
    menuTimerRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 250);
  };

  const handleCloseMenu = () => {
    if (menuTimerRef.current) {
      clearTimeout(menuTimerRef.current);
      menuTimerRef.current = null;
    }
    setIsMenuOpen(false);
  };

  // Tự động đóng menu khi người dùng bấm phím Esc
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsMenuOpen(false);
        setIsUserMenuOpen(false);
      }
    };
    if (isMenuOpen || isUserMenuOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isMenuOpen, isUserMenuOpen]);

  // Lắng nghe cập nhật trạng thái phiên
  useEffect(() => {
    const unsubscribe = sessionManager.onStatusChange((state) => {
      setSessionInfo(state);
    });
    return () => unsubscribe();
  }, []);

  const remainingSeconds = sessionInfo.remainingSeconds;
  const isWarningZone = remainingSeconds > 0 && remainingSeconds <= 120;
  const hasNoPermissions = user.role !== 'admin' && (!user.permissions || user.permissions.length === 0);

  useEffect(() => {
    if (!hasNoPermissions) return;
    let cancelled = false;
    const checkPermissions = async () => {
      try {
        const latestUser = await getMeApi(token);
        if (!cancelled && latestUser.permissions && latestUser.permissions.length > 0) {
          onPermissionsUpdated?.(latestUser);
        }
      } catch {
        // Keep the permission notice visible while the account still has no access.
      }
    };
    void checkPermissions();
    const timer = window.setInterval(() => void checkPermissions(), 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [hasNoPermissions, onPermissionsUpdated, token]);

  // Tải dữ liệu sản phẩm từ Backend
  useEffect(() => {
    if (hasNoPermissions) {
      setProducts([]);
      setIsLoading(false);
      return;
    }
    let isMounted = true;
    setIsLoading(true);
    getProductsApi(token)
      .then((data) => {
        if (isMounted) {
          setProducts(data.items);
          setIsCostVisible(data.is_cost_price_visible);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err.message || 'Lỗi khi tải dữ liệu sản phẩm từ Backend.');
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token, hasNoPermissions]);

  // Tính toán số liệu thống kê
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sell_price * p.stock, 0);

  // Tính giá vốn và lợi nhuận (chỉ khả dụng khi Backend trả về cho Quản lý kinh doanh / Admin)
  const isCostAvailable = isCostVisible && products.length > 0 && products.every((p) => p.cost_price !== null && p.cost_price !== undefined);
  const totalCostValue = isCostAvailable ? products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0) : 0;
  const totalProfit = totalSellValue - totalCostValue;

  const roleLabelMap: Record<string, string> = {
    admin: 'Quản Trị Hệ Thống',
    sales_manager: 'Quản Lý Kinh Doanh',
    sales: 'Nhân Viên Kinh Doanh',
    warehouse: 'Thủ Kho',
    warehouse_manager: 'Quản Lý Kho',
    accountant: 'Kế Toán',
    purchasing: 'Nhân Viên Mua Hàng',
  };

  const roleBadgeColorMap: Record<string, string> = {
    admin: '#ef4444',
    sales_manager: '#8b5cf6',
    sales: '#3b82f6',
    warehouse: '#10b981',
    warehouse_manager: '#059669',
    accountant: '#f59e0b',
    purchasing: '#06b6d4',
  };

  const currentRoleTitle = roleLabelMap[user.role] || user.role;
  const currentBadgeColor = roleBadgeColorMap[user.role] || '#64748b';

  if (hasNoPermissions) {
    return (
      <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#0b1120', color: '#f1f5f9', padding: 24, fontFamily: 'system-ui, sans-serif' }}>
        <section role="status" style={{ maxWidth: 480, textAlign: 'center', padding: 32, background: '#1e293b', border: '1px solid #334155', borderRadius: 16 }}>
          <h1 style={{ marginTop: 0 }}>Tài khoản chưa được cấp quyền</h1>
          <p>Quản trị viên chưa cấp quyền truy cập cho tài khoản này. Vui lòng liên hệ admin để được phân quyền.</p>
          <button onClick={() => void onLogout()} style={{ marginTop: 12, padding: '10px 18px', border: 0, borderRadius: 8, cursor: 'pointer' }}>Đăng xuất</button>
        </section>
      </main>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0b1120', color: '#f1f5f9', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '24px 32px' }}>
      {/* Top Navbar */}
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 24px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        marginBottom: '28px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        position: 'relative',
        zIndex: 500,
      }}>
        {/* Khối bên trái: Nút 3 gạch (chỉ ở trang chủ) + Logo + Tên hệ thống */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {activeTab === 'inventory' && (
            <button
              onMouseEnter={handleMouseEnterMenu}
              onMouseLeave={handleMouseLeaveMenu}
              onClick={() => setIsMenuOpen((prev) => !prev)}
              aria-label="Mở rộng menu"
              title="Mở rộng menu"
              className="hamburger-left-btn"
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
                <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
                <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
                <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
              </div>
            </button>
          )}

          <div
            onClick={() => setActiveTab('inventory')}
            className="brand-logo-animated"
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              border: '1px solid rgba(255, 255, 255, 0.25)',
              cursor: 'pointer',
              flexShrink: 0
            }}
            title="Trang chủ Quản lý kho hàng"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <h1 className="brand-title-shimmer" style={{ fontSize: '18px', margin: 0 }}>
                Hệ Thống Quản Lý Kho & Bán Hàng
              </h1>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  fontSize: '12px',
                  background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(56, 189, 248, 0.2))',
                  border: '1px solid rgba(168, 85, 247, 0.4)',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  color: '#e9d5ff',
                  fontWeight: '700',
                  letterSpacing: '0.3px',
                }}
              >
                PRO ✨
              </span>
            </div>
            <p className="brand-subtitle-glow" style={{ fontSize: '13px', margin: '2px 0 0 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>Kết nối Backend FastAPI & Bảo mật giá vốn tại Server</span>
            </p>
          </div>
        </div>

        {/* Khối bên phải: Avatar người dùng (Click để mở popup thông tin) */}
        <div style={{ position: 'relative', zIndex: 501 }}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              background: 'transparent',
              border: isUserMenuOpen ? '2px solid #38bdf8' : '2px solid rgba(255, 255, 255, 0.2)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px',
              transition: 'all 0.2s',
              boxShadow: isUserMenuOpen ? '0 0 14px rgba(56, 189, 248, 0.4)' : 'none',
            }}
            title="Tài khoản người dùng"
            aria-label="Tài khoản người dùng"
          >
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: currentBadgeColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </button>

          {/* Popover thông tin người dùng */}
          {isUserMenuOpen && (
            <div
              className="header-popover-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 12px)',
                right: 0,
                width: '320px',
                background: '#ffffff',
                color: '#1e293b',
                borderRadius: '16px',
                padding: '20px',
                boxShadow: '0 20px 50px rgba(0, 0, 0, 0.4), 0 0 1px rgba(0, 0, 0, 0.2)',
                zIndex: 1000,
              }}
            >
              {/* Phần trên: Avatar + Tên + Role Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: currentBadgeColor,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '700',
                  fontSize: '20px',
                  flexShrink: 0
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: '700' }}>
                    {user.full_name}
                  </h4>
                  <span style={{
                    display: 'inline-block',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    background: `${currentBadgeColor}20`,
                    color: currentBadgeColor,
                    fontSize: '12px',
                    fontWeight: '600'
                  }}>
                    {currentRoleTitle}
                  </span>
                </div>
              </div>

              {/* Thông tin tài khoản */}
              <div style={{
                background: '#f8fafc',
                borderRadius: '10px',
                padding: '12px 14px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#64748b',
                lineHeight: '1.6'
              }}>
                <div>Tài khoản: <strong style={{ color: '#1e293b' }}>{user.username}</strong></div>
                <div>Quyền xem giá vốn: <strong style={{ color: isCostVisible ? '#10b981' : '#ef4444' }}>{isCostVisible ? 'Có' : 'Không (Đã khóa)'}</strong></div>
              </div>

              {/* Danh sách hành động */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab('users');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: activeTab === 'users' ? '#e0e7ff' : '#f1f5f9',
                      border: 'none',
                      color: '#4338ca',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                      <circle cx="9" cy="7" r="4" />
                      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                    </svg>
                    Quản lý người dùng (RBAC)
                  </button>
                )}

                {user.role === 'admin' && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setOpenCustomerCreateOnUsers(true);
                      setActiveTab('users');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      background: '#ecfeff',
                      border: 'none',
                      color: '#0f766e',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>👤+</span>
                    Tạo nhân viên kinh doanh
                  </button>
                )}

                <button
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSecurityModalOpen(true);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#f1f5f9',
                    border: 'none',
                    color: '#334155',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Đổi mật khẩu & Bảo mật
                </button>

                <button
                  onClick={async () => {
                    if (isLoggingOut) return;
                    setIsLoggingOut(true);
                    try {
                      await onLogout();
                    } finally {
                      setIsLoggingOut(false);
                    }
                  }}
                  disabled={isLoggingOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#fef2f2',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Backdrop đóng popover user khi click ra ngoài (đặt ở root level ngoài header) */}
      {isUserMenuOpen && (
        <div
          onClick={() => setIsUserMenuOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 499,
            background: 'transparent',
          }}
        />
      )}

      {/* Backdrop mờ khi mở Drawer */}
      <div
        className={`sidebar-drawer-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={handleCloseMenu}
      />

      {/* Drawer menu mở rộng từ bên trái (13 mục nguyên bản, không thêm chức năng thừa) */}
      <aside
        className={`sidebar-drawer ${isMenuOpen ? 'open' : ''}`}
        onMouseEnter={handleMouseEnterMenu}
        onMouseLeave={handleMouseLeaveMenu}
      >
        {/* Header Drawer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 18px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.5)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: '#f8fafc', fontWeight: '600', fontSize: '15px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ width: '18px', height: '2px', background: '#94a3b8', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#94a3b8', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#94a3b8', borderRadius: '2px' }}></span>
            </div>
            <span>Mở rộng menu</span>
          </div>
          <button
            onClick={handleCloseMenu}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px 8px',
              borderRadius: '6px'
            }}
            title="Đóng menu"
          >
            ✕
          </button>
        </div>

        {/* Danh sách 13 chức năng chuẩn của Bitrix24 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {[
            {
              title: 'CRM',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              ),
            },
            {
              title: 'Đặt chỗ',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              ),
            },
            {
              id: 'inventory',
              title: 'Quản lý kho hàng',
              active: activeTab === 'inventory',
              onClick: () => {
                setActiveTab('inventory');
                handleCloseMenu();
              },
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              ),
            },
            {
              id: 'marketing',
              title: 'Tiếp thị',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="6" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
              ),
            },
            {
              id: 'website',
              title: 'Website và cửa hàng',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="9" cy="21" r="1" />
                  <circle cx="20" cy="21" r="1" />
                  <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                </svg>
              ),
            },
            {
              id: 'tasks',
              title: 'Tác vụ',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              ),
            },
            {
              id: 'collaboration',
              title: 'Hợp tác',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              ),
            },
            {
              id: 'bi',
              title: 'BI Builder',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="20" x2="18" y2="10" />
                  <line x1="12" y1="20" x2="12" y2="4" />
                  <line x1="6" y1="20" x2="6" y2="14" />
                </svg>
              ),
            },
            {
              id: 'users',
              title: 'Nhân viên',
              active: activeTab === 'users',
              onClick: () => {
                setActiveTab('users');
                handleCloseMenu();
              },
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="3" width="20" height="18" rx="2" />
                  <circle cx="8" cy="10" r="3" />
                  <line x1="15" y1="9" x2="18" y2="9" />
                  <line x1="15" y1="13" x2="18" y2="13" />
                </svg>
              ),
            },
            {
              id: 'automation',
              title: 'Tự động',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="4" y="4" width="16" height="16" rx="2" />
                  <rect x="9" y="9" width="6" height="6" />
                  <line x1="9" y1="1" x2="9" y2="4" />
                  <line x1="15" y1="1" x2="15" y2="4" />
                  <line x1="9" y1="20" x2="9" y2="23" />
                  <line x1="15" y1="20" x2="15" y2="23" />
                </svg>
              ),
            },
            {
              id: 'apps',
              title: 'Ứng dụng',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              ),
            },
            {
              id: 'knowledge',
              title: 'Cơ sở tri thức 2.0',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              ),
            },
            {
              id: 'settings',
              title: 'Cài đặt',
              active: false,
              onClick: () => {
                setActiveTab('users');
                handleCloseMenu();
              },
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              ),
            },
          ].map((item, index) => (
            <div
              key={index}
              className={`sidebar-menu-item ${item.active ? 'active' : ''}`}
              onClick={item.onClick || handleCloseMenu}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: item.active ? 1 : 0.8 }}>
                {item.icon}
              </span>
              <span>{item.title}</span>
            </div>
          ))}
        </div>

        {/* Nút Đăng xuất ở cuối sidebar */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.7)'
        }}>
          <button
            className="sidebar-logout-btn"
            onClick={async () => {
              if (isLoggingOut) return;
              setIsLoggingOut(true);
              try {
                await onLogout();
              } finally {
                setIsLoggingOut(false);
                setIsMenuOpen(false);
              }
            }}
            disabled={isLoggingOut}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      {/* Main Content: Switch between User Management and Inventory */}
      {activeTab === 'users' ? (
        <UserManagementView
          currentUser={user}
          token={token}
          openCustomerCreate={openCustomerCreateOnUsers}
          onCustomerCreateOpened={() => setOpenCustomerCreateOnUsers(false)}
          onBackToHome={() => setActiveTab('inventory')}
        />
      ) : (
        <>
          {/* Role Banner Notification */}
          {user.role === 'sales' && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.12)',
          border: '1px solid rgba(59, 130, 246, 0.3)',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          color: '#bfdbfe',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>🛡️</span>
          <div>
            <strong>Bảo Mật Máy Chủ (Backend RBAC):</strong> Backend phát hiện bạn có vai trò <strong>Nhân Viên Kinh Doanh</strong> và đã <strong>xóa bỏ hoàn toàn trường Giá Vốn</strong> khỏi dữ liệu API gửi về. Ngay cả khi soi tab Network / F12, bạn cũng không thể thấy giá vốn.
          </div>
        </div>
      )}

      {user.role === 'sales_manager' && (
        <div style={{
          background: 'rgba(139, 92, 246, 0.12)',
          border: '1px solid rgba(139, 92, 246, 0.3)',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          color: '#ddd6fe',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>📈</span>
          <div>
            <strong>Quyền Hạn Quản Lý Kinh Doanh:</strong> Bạn được cấp quyền xem đầy đủ <strong>Giá Vốn Nhập Kho</strong> và <strong>Biên Lợi Nhuận</strong> của các mặt hàng.
          </div>
        </div>
      )}

      {user.role === 'admin' && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          padding: '14px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          color: '#fecaca',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>👑</span>
          <div>
            <strong>Xác Thực Quản Trị Viên Thành Công:</strong> Backend đã xác thực Token hợp lệ và trả về đầy đủ <strong>Giá Vốn</strong>, <strong>Lợi Nhuận Gộp</strong> cùng toàn bộ báo cáo tài chính.
          </div>
        </div>
      )}

      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.2)',
          border: '1px solid #ef4444',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '10px',
          marginBottom: '20px'
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '18px',
        marginBottom: '28px'
      }}>
        {/* Thẻ 1: Tổng số sản phẩm */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Mặt Hàng Trong Kho</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#f8fafc' }}>
            {isLoading ? '...' : `${products.length} mã SP`}
          </div>
          <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>Tổng số lượng: {totalStock} cái</div>
        </div>

        {/* Thẻ 2: Giá trị niêm yết bán */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Tổng Giá Trị Bán Dự Kiến</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#34d399' }}>
            {isLoading ? '...' : `${totalSellValue.toLocaleString()} đ`}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Dựa trên giá niêm yết</div>
        </div>

        {/* Thẻ 3: Tổng Giá Vốn (Chỉ Quản lý kinh doanh & Admin) */}
        <div style={{
          background: isCostVisible ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: isCostVisible ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Tổng Giá Vốn Tồn Kho</div>
          {isCostVisible && isCostAvailable ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#f87171' }}>
                {isLoading ? '...' : `${totalCostValue.toLocaleString()} đ`}
              </div>
              <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>Dữ liệu nội bộ bảo mật từ Server</div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              <span>🔒</span> <em>Backend đã khóa dữ liệu</em>
            </div>
          )}
        </div>

        {/* Thẻ 4: Lợi Nhuận Dự Kiến (Chỉ Quản lý kinh doanh & Admin) */}
        <div style={{
          background: isCostVisible ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: isCostVisible ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Lợi Nhuận Gộp Dự Kiến</div>
          {isCostVisible && isCostAvailable ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#fbbf24' }}>
                {isLoading ? '...' : `+${totalProfit.toLocaleString()} đ`}
              </div>
              <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '4px' }}>
                Biên lãi: +{totalSellValue && totalCostValue ? Math.round(((totalSellValue - totalCostValue) / totalSellValue) * 100) : 0}%
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              <span>🔒</span> <em>Backend đã khóa dữ liệu</em>
            </div>
          )}
        </div>
      </div>

      {/* Main Products Table */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        overflowX: 'auto'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Danh Sách Hàng Hóa Trong Kho (API Thực)</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>Dữ liệu trả về trực tiếp từ FastAPI `/api/v1/products`</p>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Đang tải dữ liệu từ máy chủ Backend...</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Mã SP</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Tên Sản Phẩm</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Danh Mục</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Số Lượng Tồn</th>
                <th style={{ padding: '14px 16px', fontWeight: '600' }}>Giá Niêm Yết (Bán)</th>
                {/* CỘT GIÁ VỐN & BIÊN LỢI NHUẬN - CHỈ HIỆN KHI SERVER CHO PHÉP (QUẢN LÝ KINH DOANH / ADMIN) */}
                {isCostVisible && (
                  <>
                    <th style={{ padding: '14px 16px', fontWeight: '600', color: '#f87171' }}>Giá Vốn Nhập Kho 🔒</th>
                    <th style={{ padding: '14px 16px', fontWeight: '600', color: '#fbbf24' }}>Biên Lợi Nhuận (%) 🔒</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((item, idx) => (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
                    background: idx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.25)'
                  }}
                >
                  <td style={{ padding: '14px 16px', color: '#94a3b8', fontWeight: '500' }}>{item.code}</td>
                  <td style={{ padding: '14px 16px', fontWeight: '600', color: '#f8fafc' }}>{item.name}</td>
                  <td style={{ padding: '14px 16px', color: '#94a3b8' }}>
                    <span style={{ padding: '3px 8px', background: '#334155', borderRadius: '6px', fontSize: '12px' }}>
                      {item.category}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', fontWeight: '600' }}>
                    <span style={{ color: item.stock < 50 ? '#f59e0b' : '#34d399' }}>{item.stock} cái</span>
                  </td>
                  <td style={{ padding: '14px 16px', color: '#38bdf8', fontWeight: '700' }}>
                    {item.sell_price.toLocaleString()} đ
                  </td>
                  {/* GIÁ VỐN & BIÊN LỢI NHUẬN TỪ SERVER */}
                  {isCostVisible && (
                    <>
                      <td style={{ padding: '14px 16px', color: '#f87171', fontWeight: '700' }}>
                        {item.cost_price ? `${item.cost_price.toLocaleString()} đ` : 'N/A'}
                      </td>
                      <td style={{ padding: '14px 16px', color: '#34d399', fontWeight: '700' }}>
                        {item.profit_margin !== undefined && item.profit_margin !== null
                          ? `${item.profit_margin >= 0 ? '+' : ''}${item.profit_margin}%`
                          : 'N/A'}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
        </>
      )}

      {/* Cảnh báo phiên sắp hết hạn khi < 2p */}
      {isWarningZone && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '440px',
            background: '#1e293b',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '18px',
            padding: '28px 24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), 0 0 25px rgba(245, 158, 11, 0.2)',
            textAlign: 'center',
            color: '#f8fafc'
          }}>
            <h3 style={{ fontSize: '19px', fontWeight: '700', margin: '0 0 10px', color: '#fde68a' }}>
              Phiên Làm Việc Sắp Hết Hạn
            </h3>
            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px' }}>
              Hệ thống phát hiện bạn không thao tác trong một khoảng thời gian.
            </p>
          </div>
        </div>
      )}

      {/* Modal Bảo Mật & Đổi Mật Khẩu */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        token={token}
        username={user.username}
        onTokenUpdated={onTokenUpdated}
      />
    </div>
  );
}

