import { useState, useEffect, useRef } from 'react';
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

export default function DashboardPage({ user, token, onLogout, onTokenUpdated }: DashboardProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionState>(() => sessionManager.getSessionState());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isSecurityModalOpen, setIsSecurityModalOpen] = useState(false);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsMenuOpen(true);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setIsMenuOpen(false);
    }, 280);
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
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
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

  // Calculate metrics
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sell_price * p.stock, 0);
  
  // Cost value calculation (only possible if server sent cost_price for admin)
  const isCostAvailable = products.length > 0 && products.every((p) => p.cost_price !== null && p.cost_price !== undefined);
  const totalCostValue = isCostAvailable ? products.reduce((acc, p) => acc + (p.cost_price || 0) * p.stock, 0) : 0;
  const totalProfit = totalSellValue - totalCostValue;

  const roleLabel = {
    admin: 'Quản Trị Viên (Chủ Cửa Hàng)',
    sales: 'Nhân Viên Bán Hàng',
    warehouse: 'Thủ Kho',
  }[user.role] || user.role;

  const roleBadgeColor = {
    admin: '#ef4444',
    sales: '#3b82f6',
    warehouse: '#10b981',
  }[user.role] || '#64748b';

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
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
      }}>
        {/* Khối bên trái: Nút 3 gạch (Hover mở Drawer) + Logo + Tên hệ thống */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Nút 3 gạch góc trái cùng (hover mở rộng menu như ảnh) */}
          <button
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label="Mở rộng menu"
            title="Di chuột để mở rộng menu"
            className="hamburger-left-btn"
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'center' }}>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
              <span style={{ width: '18px', height: '2px', background: '#f8fafc', borderRadius: '2px' }}></span>
            </div>
          </button>

          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            boxShadow: '0 4px 12px rgba(99, 102, 241, 0.4)'
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: '700', letterSpacing: '-0.3px', margin: 0 }}>Hệ Thống Quản Lý Kho & Bán Hàng</h1>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>Kết nối Backend FastAPI & Bảo mật giá vốn tại Server</p>
          </div>
        </div>

        {/* Khối bên phải: Avatar người dùng (Click để mở popup thông tin) */}
        <div style={{ position: 'relative' }}>
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
              background: '#94a3b8',
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

          {/* Backdrop đóng popover user khi click ra ngoài */}
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

          {/* Popover thông tin người dùng theo mẫu ảnh */}
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
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.35), 0 0 1px rgba(0, 0, 0, 0.1)',
                zIndex: 999,
              }}
            >
              {/* Phần trên: Avatar + Tên + Chevron + Role Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  background: '#94a3b8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="#ffffff">
                    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                  </svg>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '16px', fontWeight: '700', color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {user.full_name}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2.5">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                  <div style={{ marginTop: '4px' }}>
                    <span style={{
                      display: 'inline-block',
                      padding: '2px 10px',
                      borderRadius: '20px',
                      background: `${roleBadgeColor}15`,
                      color: roleBadgeColor,
                      border: `1px solid ${roleBadgeColor}35`,
                      fontSize: '12px',
                      fontWeight: '600'
                    }}>
                      {roleLabel}
                    </span>
                  </div>
                </div>
              </div>



              {/* 2 Card chức năng phụ: Bảo mật & Phần mở rộng */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
                <div
                  onClick={() => {
                    setIsUserMenuOpen(false);
                    setIsSecurityModalOpen(true);
                  }}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '12px',
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
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
                  title="Nhấn để đổi mật khẩu & bảo vệ tài khoản"
                >
                  <div style={{ color: '#0284c7', display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      <polyline points="9 12 11 14 15 10" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#0284c7' }}>Bảo mật</span>
                </div>

                <div style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '12px 8px',
                  textAlign: 'center',
                  cursor: 'default',
                }}>
                  <div style={{ color: '#475569', display: 'flex', justifyContent: 'center', marginBottom: '6px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                      <line x1="12" y1="22.08" x2="12" y2="12" />
                    </svg>
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: '500', color: '#334155' }}>Phần mở rộng</span>
                </div>
              </div>

              {/* Đường kẻ phân cách */}
              <div style={{ height: '1px', background: '#f1f5f9', margin: '0 -20px 14px' }} />

              {/* Nút Đăng xuất ở cuối góc dưới */}
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
                  padding: '11px 14px',
                  background: '#fef2f2',
                  border: '1px solid #fecaca',
                  color: '#ef4444',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: isLoggingOut ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (!isLoggingOut) e.currentTarget.style.background = '#fee2e2';
                }}
                onMouseLeave={(e) => {
                  if (!isLoggingOut) e.currentTarget.style.background = '#fef2f2';
                }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

      {/* Backdrop đóng menu khi click ra vùng ngoài */}
      <div
        className={`sidebar-drawer-overlay ${isMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMenuOpen(false)}
      />

      {/* Drawer menu mở rộng từ bên trái khi di chuột đến nút 3 gạch */}
      <aside
        className={`sidebar-drawer ${isMenuOpen ? 'open' : ''}`}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {/* Header Drawer: ☰ Mở rộng menu */}
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

        {/* Danh sách các chức năng (như ảnh Bitrix24) */}
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
              title: 'Quản lý kho hàng',
              active: true,
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              ),
            },
            {
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
              title: 'Tác vụ',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
              ),
            },
            {
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
              title: 'Nhân viên',
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
              title: 'Cơ sở tri thức 2.0',
              icon: (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              ),
            },
            {
              title: 'Cài đặt',
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
            <strong>Bảo Mật Máy Chủ (Backend RBAC):</strong> Backend phát hiện bạn có vai trò <strong>Nhân Viên Bán Hàng</strong> và đã <strong>xóa bỏ hoàn toàn trường Giá Vốn</strong> khỏi dữ liệu API gửi về. Ngay cả khi soi tab Network / F12, bạn cũng không thể thấy giá vốn.
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

        {/* Thẻ 3: Tổng Giá Vốn (Chỉ Admin) */}
        <div style={{
          background: user.role === 'admin' ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: user.role === 'admin' ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Tổng Giá Vốn Tồn Kho</div>
          {user.role === 'admin' && isCostAvailable ? (
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

        {/* Thẻ 4: Lợi Nhuận Dự Kiến (Chỉ Admin) */}
        <div style={{
          background: user.role === 'admin' ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: user.role === 'admin' ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Lợi Nhuận Gộp Dự Kiến</div>
          {user.role === 'admin' && isCostAvailable ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#fbbf24' }}>
                {isLoading ? '...' : `+${totalProfit.toLocaleString()} đ`}
              </div>
              <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '4px' }}>
                Biên lãi: ~{totalSellValue ? Math.round((totalProfit / totalSellValue) * 100) : 0}%
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
                {/* CỘT GIÁ VỐN - CHỈ HIỆN KHI SERVER GỬI COST_PRICE */}
                {user.role === 'admin' && (
                  <th style={{ padding: '14px 16px', fontWeight: '600', color: '#f87171' }}>Giá Vốn Nhập Kho 🔒</th>
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
                  {/* GIÁ VỐN NHẬN TỪ SERVER */}
                  {user.role === 'admin' && (
                    <td style={{ padding: '14px 16px', color: '#f87171', fontWeight: '700' }}>
                      {item.cost_price ? `${item.cost_price.toLocaleString()} đ` : 'N/A'}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cảnh báo phiên sắp hết hạn khi < 2p (Không cần nút, thao tác bất kỳ tự động gia hạn) */}
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
            {/* Icon cảnh báo */}
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              color: '#fbbf24'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            </div>

            <h3 style={{ fontSize: '19px', fontWeight: '700', margin: '0 0 10px', color: '#fde68a' }}>
              Phiên Làm Việc Sắp Hết Hạn
            </h3>

            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 14px' }}>
              Hệ thống phát hiện bạn không thao tác trong một khoảng thời gian.
            </p>

            <div style={{
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              borderRadius: '12px',
              padding: '14px 16px',
              color: '#fef08a',
              fontSize: '13.5px',
              lineHeight: '1.5'
            }}>
              💡 <strong>Hãy thao tác bất kỳ</strong> (di chuột, nhấp chuột hoặc gõ phím) trên màn hình để hệ thống tự động gia hạn phiên.
            </div>
          </div>
        </div>
      )}

      {/* Modal Bảo Mật & Đổi Mật Khẩu */}
      <SecurityModal
        isOpen={isSecurityModalOpen}
        onClose={() => setIsSecurityModalOpen(false)}
        token={token}
        onTokenUpdated={onTokenUpdated}
      />
    </div>
  );
}
