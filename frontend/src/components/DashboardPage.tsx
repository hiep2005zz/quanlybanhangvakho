import React, { useState, useEffect, useRef } from 'react';
import { getProductsApi, ProductItem, User } from '../services/api';
import { sessionManager, SessionState } from '../services/sessionManager';
import SecurityModal from './SecurityModal';
import './dashboard.css';

interface DashboardProps {
  user: User;
  token: string;
  onLogout: () => void | Promise<void>;
  onTokenUpdated?: (newToken: string) => void;
}

interface NavigationMenuItem {
  title: string;
  roles: string[];
  icon: React.ReactNode;
}

export default function DashboardPage({ user, token, onLogout, onTokenUpdated }: DashboardProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [_error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionState>(() => sessionManager.getSessionState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const [activeMenuTitle, setActiveMenuTitle] = useState('Tổng quan & Thống kê');
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (window.innerWidth <= 768) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    if (window.innerWidth <= 768) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 280);
  };

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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, [isMenuOpen, isUserMenuOpen]);

  useEffect(() => {
    const unsubscribe = sessionManager.onStatusChange((state) => {
      setSessionInfo(state);
    });
    return () => unsubscribe();
  }, []);

  const remainingSeconds = sessionInfo.remainingSeconds;
  const isWarningZone = remainingSeconds > 0 && remainingSeconds <= 120;

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    getProductsApi(token)
      .then((data) => {
        if (isMounted) {
          setProducts(data.items);
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

  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sell_price * p.stock, 0);

  const isCostAvailable = products.length > 0 && products.every((p) => p.cost_price !== null && p.cost_price !== undefined);
  const totalCostValue = isCostAvailable ? products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0) : 0;
  // @ts-ignore
  const _totalProfit = totalSellValue - totalCostValue;

  const normalizedRole = (user.role === 'kho' ? 'warehouse' : user.role) || 'sales';

  const roleLabel: Record<string, string> = {
    admin: 'Quản Trị Viên (Chủ Cửa Hàng)',
    sales: 'Nhân Viên Bán Hàng',
    warehouse: 'Thủ Kho',
    kho: 'Thủ Kho',
  };

  const roleBadgeColor: Record<string, string> = {
    admin: '#ef4444',
    sales: '#3b82f6',
    warehouse: '#10b981',
    kho: '#10b981',
  };

  const userWorkplace = (user as any).warehouse_name ||
    (user as any).location ||
    (user as any).workplace ||
    (normalizedRole === 'admin'
      ? 'Toàn bộ chi nhánh & kho'
      : normalizedRole === 'sales'
        ? 'Địa bàn Kinh Doanh Miền Bắc'
        : 'Tổng kho Hà Đông');

  const allNavigationItems: NavigationMenuItem[] = [
    {
      title: 'Tổng quan & Thống kê',
      roles: ['admin', 'sales', 'warehouse', 'kho'],
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
      title: 'Quản lý kho hàng',
      roles: ['admin', 'warehouse', 'kho'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      ),
    },
    {
      title: 'Nhập & Xuất kho',
      roles: ['admin', 'warehouse', 'kho'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
        </svg>
      ),
    },
    {
      title: 'Đơn hàng & Bán hàng',
      roles: ['admin', 'sales'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="9" cy="21" r="1" />
          <circle cx="20" cy="21" r="1" />
          <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
        </svg>
      ),
    },
    {
      title: 'Khách hàng & Báo giá',
      roles: ['admin', 'sales'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
      ),
    },
    {
      title: 'Báo cáo tài chính & Giá vốn',
      roles: ['admin'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="20" x2="18" y2="10" />
          <line x1="12" y1="20" x2="12" y2="4" />
          <line x1="6" y1="20" x2="6" y2="14" />
        </svg>
      ),
    },
    {
      title: 'Quản lý tài khoản',
      roles: ['admin'],
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
  ];

  const authorizedNavigationItems = allNavigationItems.filter((item) =>
    item.roles.includes(user.role) || item.roles.includes(normalizedRole)
  );

  return (
    <div
      className="dashboard-wrapper"
      style={{
        minHeight: '100vh',
        background: '#0b1120',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        padding: '16px',
        boxSizing: 'border-box'
      }}
    >
      <header style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        background: 'rgba(30, 41, 59, 0.7)',
        backdropFilter: 'blur(12px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '14px',
        marginBottom: '20px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <button
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Mở rộng menu"
            className="hamburger-left-btn"
            style={{
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
            </div>
          </button>

          <div style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)',
            flexShrink: 0
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>

          <div style={{ minWidth: 0 }}>
            <h1 style={{
              fontSize: '15px',
              fontWeight: '700',
              letterSpacing: '-0.3px',
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              Quản Lý Bán Hàng & Kho
            </h1>
            <p style={{
              fontSize: '11px',
              color: '#94a3b8',
              margin: '2px 0 0 0',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              {user.full_name} • {roleLabel[user.role] || user.role}
            </p>
          </div>
        </div>

        <div style={{ position: 'relative', flexShrink: 0, marginLeft: '8px' }}>
          <button
            onClick={() => setIsUserMenuOpen((prev) => !prev)}
            style={{
              width: '38px',
              height: '38px',
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
          >
            <div style={{
              width: '100%',
              height: '100%',
              borderRadius: '50%',
              background: '#94a3b8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden'
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#ffffff">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </button>

          {isUserMenuOpen && (
            <div
              onClick={() => setIsUserMenuOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 998,
                background: 'transparent',
              }}
            />
          )}

          {isUserMenuOpen && (
            <div
              className="header-popover-menu"
              style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: 'calc(100vw - 32px)',
                maxWidth: '310px',
                background: '#ffffff',
                color: '#1e293b',
                borderRadius: '16px',
                padding: '16px',
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.1)',
                zIndex: 999,
                boxSizing: 'border-box'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  background: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {user.full_name}
                  </div>
                  <div style={{ marginTop: '3px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '16px',
                      background: `${roleBadgeColor[user.role] || '#64748b'}15`,
                      color: roleBadgeColor[user.role] || '#64748b',
                      border: `1px solid ${roleBadgeColor[user.role] || '#64748b'}35`,
                      fontSize: '11.5px',
                      fontWeight: '600'
                    }}>
                      {roleLabel[user.role] || user.role}
                    </span>
                  </div>
                </div>
              </div>

              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '10px 12px',
                marginBottom: '14px',
                fontSize: '12.5px'
              }}>
                <div style={{ color: '#64748b', fontSize: '11px', marginBottom: '2px', fontWeight: '500' }}>
                  🏢 Kho / Địa bàn làm việc:
                </div>
                <div style={{ color: '#0f172a', fontWeight: '600', wordBreak: 'break-word' }}>
                  {userWorkplace}
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <div
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSecurityModalOpen(true);
                  }}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#0284c7';
                    e.currentTarget.style.background = '#f0f9ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.background = '#ffffff';
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0284c7" strokeWidth="2">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <polyline points="9 12 11 14 15 10" />
                  </svg>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0284c7' }}>Bảo mật tài khoản</span>
                </div>
              </div>

              <button
                onClick={async () => {
                  if (isLoggingOut) return;
                  setIsLoggingOut(true);
                  try {
                    await onLogout();
                  } finally {
                    setIsLoggingOut(false);
                    setIsUserMenuOpen(false);
                  }
                }}
                disabled={isLoggingOut}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#ef4444',
                  borderRadius: '10px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s'
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
          )}
        </div>
      </header>

      <div
        className={`sidebar-drawer-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(3px)',
          zIndex: 990,
          display: isMenuOpen ? 'block' : 'none'
        }}
      />

      <aside
        className={`sidebar-drawer ${isMenuOpen ? 'open' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '280px',
          maxWidth: '85vw',
          height: '100vh',
          background: '#0f172a',
          borderRight: '1px solid rgba(255, 255, 255, 0.1)',
          zIndex: 991,
          display: 'flex',
          flexDirection: 'column',
          transform: isMenuOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isMenuOpen ? '4px 0 24px rgba(0,0,0,0.5)' : 'none'
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 16px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          background: 'rgba(15, 23, 42, 0.6)'
        }}>
          <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '14.5px' }}>
            Menu điều hướng
          </span>
          <button
            onClick={() => setIsMenuOpen(false)}
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

        <div style={{
          padding: '12px 14px',
          margin: '10px 12px 6px',
          background: 'rgba(30, 41, 59, 0.6)',
          borderRadius: '10px',
          border: '1px solid rgba(255, 255, 255, 0.06)'
        }}>
          <div style={{ fontSize: '13.5px', fontWeight: '700', color: '#f8fafc', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.full_name}
          </div>
          <div style={{ fontSize: '11.5px', color: roleBadgeColor[user.role] || '#38bdf8', fontWeight: '600', marginTop: '2px' }}>
            {roleLabel[user.role] || user.role}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            📍 {userWorkplace}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 10px' }}>
          <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: '700', padding: '8px 8px 4px' }}>
            Vai trò: {user.role.toUpperCase()}
          </div>
          {authorizedNavigationItems.map((item, index) => {
            const isActive = activeMenuTitle === item.title;
            return (
              <div
                key={index}
                onClick={() => {
                  setActiveMenuTitle(item.title);
                  setIsMenuOpen(false);
                }}
                className={`sidebar-menu-item ${isActive ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  margin: '3px 0',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '13.5px',
                  fontWeight: isActive ? '600' : '500',
                  color: isActive ? '#ffffff' : '#cbd5e1',
                  background: isActive ? '#4f46e5' : 'transparent',
                  transition: 'all 0.15s'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', opacity: isActive ? 1 : 0.85 }}>
                  {item.icon}
                </span>
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {item.title}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{
          padding: '12px 14px',
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
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px',
              borderRadius: '8px',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#f87171',
              cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            {isLoggingOut ? 'Đang thoát...' : 'Đăng xuất'}
          </button>
        </div>
      </aside>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '12px',
        marginBottom: '20px'
      }}>
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>Mặt Hàng Trong Kho</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#f8fafc' }}>
            {isLoading ? '...' : `${products.length} mã SP`}
          </div>
          <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>SL: {totalStock} cái</div>
        </div>

        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
          <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>Tổng Giá Trị Bán</div>
          <div style={{ fontSize: '20px', fontWeight: '700', color: '#34d399' }}>
            {isLoading ? '...' : `${totalSellValue.toLocaleString()} đ`}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>Giá niêm yết</div>
        </div>

        {user.role === 'admin' && isCostAvailable && (
          <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '12px', padding: '14px' }}>
            <div style={{ fontSize: '11.5px', color: '#94a3b8', marginBottom: '4px' }}>Giá Vốn Tồn Kho</div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: '#f87171' }}>
              {isLoading ? '...' : `${totalCostValue.toLocaleString()} đ`}
            </div>
            <div style={{ fontSize: '11px', color: '#fca5a5', marginTop: '4px' }}>Bảo mật Server</div>
          </div>
        )}
      </div>

      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '14px',
        padding: '16px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '700', margin: 0 }}>
            {activeMenuTitle}
          </h2>
          <p style={{ fontSize: '12px', color: '#94a3b8', margin: '3px 0 0 0' }}>
            Dữ liệu đồng bộ trực tiếp từ máy chủ Backend
          </p>
        </div>

        {isLoading ? (
          <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>Đang tải dữ liệu...</div>
        ) : (
          <div style={{ width: '100%', overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left', minWidth: '480px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Mã SP</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Tên Sản Phẩm</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Danh Mục</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Tồn Kho</th>
                  <th style={{ padding: '10px 12px', fontWeight: '600' }}>Giá Bán</th>
                  {user.role === 'admin' && (
                    <th style={{ padding: '10px 12px', fontWeight: '600', color: '#f87171' }}>Giá Vốn 🔒</th>
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
                    <td style={{ padding: '10px 12px', color: '#94a3b8', fontWeight: '500' }}>{item.code}</td>
                    <td style={{ padding: '10px 12px', fontWeight: '600', color: '#f8fafc' }}>{item.name}</td>
                    <td style={{ padding: '10px 12px', color: '#94a3b8' }}>
                      <span style={{ padding: '2px 6px', background: '#334155', borderRadius: '4px', fontSize: '11px' }}>
                        {item.category}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: '600' }}>
                      <span style={{ color: item.stock < 50 ? '#f59e0b' : '#34d399' }}>{item.stock} cái</span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#38bdf8', fontWeight: '700' }}>
                      {item.sell_price.toLocaleString()} đ
                    </td>
                    {user.role === 'admin' && (
                      <td style={{ padding: '10px 12px', color: '#f87171', fontWeight: '700' }}>
                        {item.cost_price ? `${item.cost_price.toLocaleString()} đ` : 'N/A'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

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
          padding: '16px'
        }}>
          <div style={{
            width: '100%',
            maxWidth: '360px',
            background: '#1e293b',
            border: '1px solid rgba(245, 158, 11, 0.5)',
            borderRadius: '16px',
            padding: '20px',
            textAlign: 'center',
            color: '#f8fafc'
          }}>
            <h3 style={{ fontSize: '17px', fontWeight: '700', margin: '0 0 10px', color: '#fde68a' }}>
              Phiên Làm Việc Sắp Hết Hạn
            </h3>
            <p style={{ fontSize: '13px', color: '#cbd5e1', margin: '0 0 12px' }}>
              Thao tác bất kỳ trên màn hình để tự động gia hạn phiên.
            </p>
          </div>
        </div>
      )}

      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        token={token}
        onTokenUpdated={onTokenUpdated}
      />
    </div>
  );
}