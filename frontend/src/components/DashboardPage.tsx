import { useState, useEffect, useRef } from 'react';
import { getProductsApi, ProductItem, User } from '../services/api';
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
}

export default function DashboardPage({
  user,
  token,
  onLogout,
  onTokenUpdated,
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

  // Tải dữ liệu sản phẩm từ Backend
  useEffect(() => {
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
  }, [token]);

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

  const currentBadgeColor = roleBadgeColorMap[user.role] || '#64748b';

  return (
    <div className="dashboard-main-container">
      {/* Top Navbar */}
      <header className="dashboard-header-bar">
        {/* Khối bên trái: Nút 3 gạch (chỉ ở trang chủ) + Logo + Tên hệ thống */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
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

          {/* Popover thông tin người dùng (Glassmorphism Dark Theme Đỉnh Cao) */}
          {isUserMenuOpen && (
            <div
              className="header-popover-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 14px)',
                right: 0,
                width: '330px',
                background: 'rgba(15, 23, 42, 0.92)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                color: '#f8fafc',
                borderRadius: '20px',
                padding: '22px',
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 35px rgba(99, 102, 241, 0.25)',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                zIndex: 1000,
                animation: 'fadeInCard 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Phần trên: Avatar + Tên + Role Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '18px' }}>
                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '16px',
                  background: `linear-gradient(135deg, ${currentBadgeColor} 0%, #6366f1 100%)`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ffffff',
                  fontWeight: '800',
                  fontSize: '22px',
                  flexShrink: 0,
                  boxShadow: `0 8px 20px ${currentBadgeColor}55, inset 0 1px 0 rgba(255, 255, 255, 0.4)`,
                  border: '1px solid rgba(255, 255, 255, 0.25)',
                }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h4 style={{
                    margin: '0 0 6px 0',
                    fontSize: '16.5px',
                    fontWeight: '700',
                    color: '#ffffff',
                    letterSpacing: '-0.01em',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {user.full_name}
                  </h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {((user.roles && user.roles.length > 0) ? user.roles : [user.role]).map((rCode) => {
                      const color = roleBadgeColorMap[rCode] || '#64748b';
                      const label = roleLabelMap[rCode] || rCode;
                      return (
                        <span
                          key={rCode}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            background: `${color}22`,
                            color: color,
                            fontSize: '11px',
                            fontWeight: '700',
                            border: `1px solid ${color}55`,
                            boxShadow: `0 2px 8px ${color}20`,
                          }}
                        >
                          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: color }} />
                          {label}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Thông tin tài khoản Glass Card */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.65)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '14px',
                padding: '12px 16px',
                marginBottom: '16px',
                fontSize: '13px',
                color: '#94a3b8',
                lineHeight: '1.7',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Tài khoản:</span>
                  <strong style={{ color: '#f8fafc', fontFamily: 'monospace', fontSize: '13px' }}>{user.username}</strong>
                </div>
                {user.branch && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Kho / Địa bàn:</span>
                    <strong style={{ color: '#e2e8f0' }}>📍 {user.branch}</strong>
                  </div>
                )}
              </div>

              {/* Danh sách hành động (Interactive Buttons with Hover Glow) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
                  <button
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      setActiveTab('users');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      width: '100%',
                      padding: '11px 16px',
                      borderRadius: '12px',
                      background: activeTab === 'users'
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.3))'
                        : 'rgba(30, 41, 59, 0.65)',
                      border: activeTab === 'users'
                        ? '1px solid rgba(99, 102, 241, 0.6)'
                        : '1px solid rgba(255, 255, 255, 0.08)',
                      color: activeTab === 'users' ? '#c7d2fe' : '#f8fafc',
                      fontSize: '13.5px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      boxShadow: activeTab === 'users' ? '0 4px 14px rgba(99, 102, 241, 0.3)' : 'none',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99, 102, 241, 0.25), rgba(168, 85, 247, 0.2))';
                      e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.6)';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = activeTab === 'users'
                        ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.3))'
                        : 'rgba(30, 41, 59, 0.65)';
                      e.currentTarget.style.borderColor = activeTab === 'users'
                        ? 'rgba(99, 102, 241, 0.6)'
                        : 'rgba(255, 255, 255, 0.08)';
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.color = activeTab === 'users' ? '#c7d2fe' : '#f8fafc';
                    }}
                  >
                    <div style={{
                      width: '28px',
                      height: '28px',
                      borderRadius: '8px',
                      background: 'rgba(99, 102, 241, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#818cf8',
                    }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <span>Phân quyền</span>
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
                    gap: '12px',
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    background: 'rgba(30, 41, 59, 0.65)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    color: '#f8fafc',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(51, 65, 85, 0.8)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(30, 41, 59, 0.65)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(56, 189, 248, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                  <span>Đổi mật khẩu & Bảo mật</span>
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
                    gap: '12px',
                    width: '100%',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    color: '#f87171',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    marginTop: '2px',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.22)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.color = '#fca5a5';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
                    e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.color = '#f87171';
                  }}
                >
                  <div style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                  }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                      <polyline points="16 17 21 12 16 7" />
                      <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                  </div>
                  <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
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

        {/* Danh sách mục menu: Hiển thị đúng theo quyền của người dùng */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
          {/* Quản lý kho hàng - Tất cả nhân viên đều truy cập trang kho */}
          <div
            className={`sidebar-menu-item ${activeTab === 'inventory' ? 'active' : ''}`}
            onClick={() => {
              setActiveTab('inventory');
              handleCloseMenu();
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', opacity: activeTab === 'inventory' ? 1 : 0.8 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </span>
            <span>Quản lý kho hàng</span>
          </div>

          {/* Mục Phân quyền nhân viên (RBAC) - CHỈ hiển thị nếu là Admin */}
          {(user.role === 'admin' || (user.roles && user.roles.includes('admin'))) && (
            <div
              className={`sidebar-menu-item ${activeTab === 'users' ? 'active' : ''}`}
              onClick={() => {
                setActiveTab('users');
                handleCloseMenu();
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', opacity: activeTab === 'users' ? 1 : 0.8 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
              </span>
              <span>Phân quyền</span>
            </div>
          )}
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
          onBackToHome={() => setActiveTab('inventory')}
        />
      ) : (
        <>
          {/* Main Dashboard Content */}

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

      {/* KPI Cards (Luxury Tech Glassmorphism) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
        gap: '20px',
        marginBottom: '28px'
      }}>
        {/* Thẻ 1: Tổng số sản phẩm */}
        <div className="kpi-stat-card kpi-card-blue">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Mặt Hàng Trong Kho</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid rgba(56, 189, 248, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #ffffff 0%, #cbd5e1 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            {isLoading ? '...' : `${products.length} mã SP`}
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12.5px',
            color: '#38bdf8',
            marginTop: '8px',
            background: 'rgba(56, 189, 248, 0.1)',
            padding: '2px 8px',
            borderRadius: '6px',
            fontWeight: '600'
          }}>
            <span>📦 Tổng số lượng: {totalStock} cái</span>
          </div>
        </div>

        {/* Thẻ 2: Giá trị niêm yết bán */}
        <div className="kpi-stat-card kpi-card-green">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tổng Giá Trị Bán Dự Kiến</span>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '10px',
              background: 'rgba(52, 211, 153, 0.15)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#34d399'
            }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="1" x2="12" y2="23" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            </div>
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: '800',
            letterSpacing: '-0.02em',
            color: '#34d399',
            textShadow: '0 0 20px rgba(52, 211, 153, 0.3)'
          }}>
            {isLoading ? '...' : `${totalSellValue.toLocaleString()} đ`}
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '8px' }}>Dựa trên giá niêm yết</div>
        </div>

        {/* Thẻ 3: Tổng Giá Vốn (Chỉ Quản lý kinh doanh & Admin) */}
        {isCostVisible && isCostAvailable && (
          <div className="kpi-stat-card kpi-card-red">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Tổng Giá Vốn Tồn Kho</span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(248, 113, 113, 0.15)',
                border: '1px solid rgba(248, 113, 113, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f87171'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              color: '#f87171',
              textShadow: '0 0 20px rgba(248, 113, 113, 0.3)'
            }}>
              {isLoading ? '...' : `${totalCostValue.toLocaleString()} đ`}
            </div>
            <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '8px' }}>Dữ liệu nội bộ bảo mật từ Server</div>
          </div>
        )}

        {/* Thẻ 4: Lợi Nhuận Dự Kiến (Chỉ Quản lý kinh doanh & Admin) */}
        {isCostVisible && isCostAvailable && (
          <div className="kpi-stat-card kpi-card-amber">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
              <span style={{ fontSize: '13px', color: '#94a3b8', fontWeight: '600' }}>Lợi Nhuận Gộp Dự Kiến</span>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '10px',
                background: 'rgba(251, 191, 36, 0.15)',
                border: '1px solid rgba(251, 191, 36, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fbbf24'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
            </div>
            <div style={{
              fontSize: '28px',
              fontWeight: '800',
              letterSpacing: '-0.02em',
              color: '#fbbf24',
              textShadow: '0 0 20px rgba(251, 191, 36, 0.35)'
            }}>
              {isLoading ? '...' : `+${totalProfit.toLocaleString()} đ`}
            </div>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#fde68a',
              marginTop: '8px',
              background: 'rgba(251, 191, 36, 0.12)',
              padding: '2px 8px',
              borderRadius: '6px',
              fontWeight: '700'
            }}>
              Biên lãi: +{totalSellValue && totalCostValue ? Math.round(((totalSellValue - totalCostValue) / totalSellValue) * 100) : 0}%
            </div>
          </div>
        )}
      </div>

      {/* Main Products Table (Glassmorphism Luxury Container) */}
      <div className="premium-table-card roles-grid-scroll" style={{ overflowX: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #6366f1 0%, #a855f7 100%)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Danh Sách Hàng Hóa Trong Kho
            </h2>
          </div>
          <span style={{ fontSize: '12.5px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            Tổng số: <strong style={{ color: '#38bdf8' }}>{products.length}</strong> mặt hàng
          </span>
        </div>

        {isLoading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>⏳</div>
            <div>Đang tải dữ liệu từ máy chủ Backend...</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: '0 6px', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ color: '#94a3b8', background: 'rgba(15, 23, 42, 0.6)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                <th style={{ padding: '14px 18px', fontWeight: '700', borderTopLeftRadius: '12px', borderBottomLeftRadius: '12px' }}>Mã SP</th>
                <th style={{ padding: '14px 18px', fontWeight: '700' }}>Tên Sản Phẩm</th>
                <th style={{ padding: '14px 18px', fontWeight: '700' }}>Danh Mục</th>
                <th style={{ padding: '14px 18px', fontWeight: '700' }}>Số Lượng Tồn</th>
                <th style={{ padding: '14px 18px', fontWeight: '700' }}>Giá Niêm Yết (Bán)</th>
                {/* CỘT GIÁ VỐN & BIÊN LỢI NHUẬN - CHỈ HIỆN KHI SERVER CHO PHÉP (QUẢN LÝ KINH DOANH / ADMIN) */}
                {isCostVisible && (
                  <>
                    <th style={{ padding: '14px 18px', fontWeight: '700', color: '#f87171' }}>Giá Vốn Nhập Kho</th>
                    <th style={{ padding: '14px 18px', fontWeight: '700', color: '#fbbf24', borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }}>Biên Lợi Nhuận (%)</th>
                  </>
                )}
                {!isCostVisible && (
                  <th style={{ borderTopRightRadius: '12px', borderBottomRightRadius: '12px' }} />
                )}
              </tr>
            </thead>
            <tbody>
              {products.map((item, idx) => (
                <tr
                  key={item.id}
                  className="inventory-row"
                  style={{
                    background: idx % 2 === 0 ? 'rgba(30, 41, 59, 0.45)' : 'rgba(15, 23, 42, 0.55)',
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
                  }}
                >
                  {/* Mã SP */}
                  <td style={{
                    padding: '16px 18px',
                    color: '#e2e8f0',
                    fontWeight: '700',
                    fontSize: '13.5px',
                    borderTopLeftRadius: '10px',
                    borderBottomLeftRadius: '10px',
                  }}>
                    <span style={{
                      background: 'rgba(255, 255, 255, 0.08)',
                      padding: '3px 8px',
                      borderRadius: '6px',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      letterSpacing: '0.02em',
                      color: '#93c5fd'
                    }}>
                      {item.code}
                    </span>
                  </td>

                  {/* Tên Sản Phẩm */}
                  <td style={{ padding: '16px 18px', fontWeight: '600', color: '#ffffff', fontSize: '14.5px' }}>
                    {item.name}
                  </td>

                  {/* Danh Mục */}
                  <td style={{ padding: '16px 18px' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      padding: '4px 10px',
                      background: 'rgba(99, 102, 241, 0.15)',
                      border: '1px solid rgba(129, 140, 248, 0.35)',
                      color: '#c7d2fe',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#818cf8' }} />
                      {item.category}
                    </span>
                  </td>

                  {/* Số Lượng Tồn */}
                  <td style={{ padding: '16px 18px', fontWeight: '600' }}>
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: item.stock < 50 ? '#fbbf24' : '#34d399',
                      background: item.stock < 50 ? 'rgba(245, 158, 11, 0.14)' : 'rgba(16, 185, 129, 0.14)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '700',
                      border: item.stock < 50 ? '1px solid rgba(245, 158, 11, 0.35)' : '1px solid rgba(16, 185, 129, 0.35)',
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: item.stock < 50 ? '#fbbf24' : '#34d399',
                        boxShadow: item.stock < 50 ? '0 0 6px #fbbf24' : '0 0 6px #34d399'
                      }} />
                      {item.stock} cái
                    </span>
                  </td>

                  {/* Giá Niêm Yết */}
                  <td style={{ padding: '16px 18px', color: '#38bdf8', fontWeight: '700', fontSize: '14.5px' }}>
                    {item.sell_price.toLocaleString()} đ
                  </td>

                  {/* GIÁ VỐN & BIÊN LỢI NHUẬN TỪ SERVER */}
                  {isCostVisible && (
                    <>
                      <td style={{ padding: '16px 18px', color: '#f87171', fontWeight: '700', fontSize: '14.5px' }}>
                        {item.cost_price ? `${item.cost_price.toLocaleString()} đ` : 'N/A'}
                      </td>
                      <td style={{
                        padding: '16px 18px',
                        borderTopRightRadius: '10px',
                        borderBottomRightRadius: '10px',
                      }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          background: 'rgba(52, 211, 153, 0.12)',
                          color: '#34d399',
                          fontWeight: '800',
                          fontSize: '13px',
                          border: '1px solid rgba(52, 211, 153, 0.3)'
                        }}>
                          {item.profit_margin !== undefined && item.profit_margin !== null
                            ? `${item.profit_margin >= 0 ? '+' : ''}${item.profit_margin}%`
                            : 'N/A'}
                        </span>
                      </td>
                    </>
                  )}
                  {!isCostVisible && (
                    <td style={{ borderTopRightRadius: '10px', borderBottomRightRadius: '10px' }} />
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
