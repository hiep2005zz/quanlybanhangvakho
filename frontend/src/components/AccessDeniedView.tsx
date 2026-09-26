import React, { useState, useEffect } from 'react';
import { User, getAdminContactApi } from '../services/api';

interface AccessDeniedViewProps {
  currentUser: User;
  requiredPermission?: string;
  onBackToWorkflow: () => void;
  onLogout?: () => void | Promise<void>;
}

export const AccessDeniedView: React.FC<AccessDeniedViewProps> = ({
  currentUser,
  requiredPermission = 'Quản trị hệ thống (Admin)',
  onBackToWorkflow,
  onLogout,
}) => {
  const officialRoles = (currentUser.roles && currentUser.roles.length > 0
    ? currentUser.roles
    : [currentUser.role]
  ).filter((r) => r && r !== 'customer');

  const roleLabelMap: Record<string, string> = {
    admin: 'Quản Trị Hệ Thống',
    sales_manager: 'Quản Lý Kinh Doanh',
    sales: 'Nhân Viên Kinh Doanh',
    warehouse: 'Thủ Kho',
    warehouse_manager: 'Quản Lý Kho',
    accountant: 'Kế Toán',
    purchasing: 'Nhân Viên Mua Hàng',
    customer: 'Chờ Cấp Quyền',
  };

  const roleBadgeColorMap: Record<string, string> = {
    admin: '#ef4444',
    sales_manager: '#8b5cf6',
    sales: '#3b82f6',
    warehouse: '#10b981',
    warehouse_manager: '#059669',
    accountant: '#f59e0b',
    purchasing: '#06b6d4',
    customer: '#94a3b8',
  };

  const primaryRole = officialRoles[0] || currentUser.role || 'customer';
  const roleName = roleLabelMap[primaryRole] || primaryRole;
  const badgeColor = roleBadgeColorMap[primaryRole] || '#64748b';

  const [adminEmail, setAdminEmail] = useState<string>('daongochiep645@gmail.com');

  useEffect(() => {
    let isMounted = true;
    getAdminContactApi().then((info) => {
      if (isMounted && info?.admin_email) {
        setAdminEmail(info.admin_email);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      maxWidth: '920px',
      margin: '20px auto 60px auto',
      padding: '0 16px',
      animation: 'fadeInCard 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {/* 1. Breadcrumb điều hướng */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#94a3b8',
          fontWeight: '500',
        }}
      >
        <button
          onClick={onBackToWorkflow}
          style={{
            background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))',
            border: '1px solid rgba(56, 189, 248, 0.35)',
            borderRadius: '20px',
            color: '#38bdf8',
            cursor: 'pointer',
            padding: '6px 14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 3px 10px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.7)';
            e.currentTarget.style.color = '#7dd3fc';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            e.currentTarget.style.color = '#38bdf8';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          <span>Quay lại trang làm việc</span>
        </button>
        <span style={{ color: '#475569', fontSize: '14px' }}>/</span>
        <span style={{ color: '#ef4444', fontWeight: '600', fontSize: '13.5px' }}>403 Không có quyền truy cập</span>
      </nav>

      {/* 2. Thẻ lỗi trung tâm Glassmorphism sang trọng */}
      <div style={{
        background: 'linear-gradient(145deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.35)',
        borderRadius: '24px',
        padding: '44px 36px',
        boxShadow: '0 25px 60px rgba(0, 0, 0, 0.5), 0 0 30px rgba(239, 68, 68, 0.15)',
        backdropFilter: 'blur(20px)',
        position: 'relative',
        overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Vệt sáng mờ nền */}
        <div style={{
          position: 'absolute',
          top: '-80px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '320px',
          height: '200px',
          background: 'radial-gradient(ellipse at center, rgba(239, 68, 68, 0.25) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Khối Icon Khiên Bị Khóa 3D */}
        <div style={{
          width: '84px',
          height: '84px',
          borderRadius: '24px',
          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.35) 100%)',
          border: '1px solid rgba(248, 113, 113, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 22px auto',
          boxShadow: '0 12px 30px rgba(239, 68, 68, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
          color: '#f87171',
        }}>
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>

        {/* Mã lỗi & Tiêu đề */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          padding: '4px 14px',
          borderRadius: '999px',
          color: '#fca5a5',
          fontSize: '12.5px',
          fontWeight: '700',
          letterSpacing: '0.05em',
          marginBottom: '16px',
        }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px #ef4444' }} />
          MÃ LỖI 403: TRUY CẬP BỊ TỪ CHỐI (ZERO-TRUST)
        </div>

        <h1 style={{
          fontSize: '28px',
          fontWeight: '800',
          color: '#ffffff',
          letterSpacing: '-0.02em',
          margin: '0 0 14px 0',
        }}>
          Bạn Không Có Quyền Truy Cập Chức Năng Này
        </h1>

        <p style={{
          fontSize: '15px',
          color: '#94a3b8',
          lineHeight: '1.7',
          maxWidth: '640px',
          margin: '0 auto 28px auto',
        }}>
          Chức năng <strong>Phân quyền & Quản lý người dùng</strong> yêu cầu quyền hạn cấp cao{' '}
          <span style={{ color: '#f87171', fontWeight: '700' }}>{requiredPermission}</span>.
          Tài khoản của bạn hiện không thuộc danh sách được phân quyền thực thi nghiệp vụ này.
        </p>

        {/* Khung chi tiết tài khoản hiện tại */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.65)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '18px 24px',
          maxWidth: '560px',
          margin: '0 auto 32px auto',
          textAlign: 'left',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          fontSize: '13.5px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Tài khoản đang đăng nhập:</span>
            <strong style={{ color: '#f8fafc', fontFamily: 'monospace' }}>@{currentUser.username} ({currentUser.full_name})</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: '#64748b' }}>Vai trò hiện tại:</span>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 10px',
              borderRadius: '999px',
              background: `${badgeColor}22`,
              color: badgeColor,
              fontWeight: '700',
              border: `1px solid ${badgeColor}55`,
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: badgeColor }} />
              {roleName}
            </span>
          </div>
          {currentUser.branch && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#64748b' }}>Khu vực / Chi nhánh:</span>
              <span style={{ color: '#cbd5e1' }}>📍 {currentUser.branch}</span>
            </div>
          )}
        </div>

        {/* 3. KHỐI HÀNH ĐỘNG QUAY LẠI LUỒNG LÀM VIỆC */}
        <div style={{
          background: 'rgba(30, 41, 59, 0.45)',
          border: '1px solid rgba(255, 255, 255, 0.06)',
          borderRadius: '18px',
          padding: '24px',
          maxWidth: '680px',
          margin: '0 auto',
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '12px',
          }}>
            {/* Hành động 1: Quay lại màn hình làm việc chính */}
            <button
              onClick={onBackToWorkflow}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '14px 18px',
                borderRadius: '12px',
                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                border: 'none',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: '700',
                cursor: 'pointer',
                textAlign: 'left',
                boxShadow: '0 6px 20px rgba(37, 99, 235, 0.35)',
                transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 10px 25px rgba(37, 99, 235, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(37, 99, 235, 0.35)';
              }}
            >
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              </div>
              <div>
                <div style={{ color: '#ffffff' }}>Quản lý kho hàng & sản phẩm</div>
                <div style={{ fontSize: '12px', color: '#bfdbfe', fontWeight: '500' }}>Trang nghiệp vụ chính của bạn</div>
              </div>
            </button>

            {/* Hành động 2: Đăng xuất / Đổi tài khoản có quyền */}
            {onLogout && (
              <button
                onClick={onLogout}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '14px 18px',
                  borderRadius: '12px',
                  background: 'rgba(15, 23, 42, 0.75)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#e2e8f0',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.background = 'rgba(30, 41, 59, 0.9)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.background = 'rgba(15, 23, 42, 0.75)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
              >
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: '#f87171',
                }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                </div>
                <div>
                  <div style={{ color: '#f8fafc' }}>Đổi tài khoản khác</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Đăng nhập tài khoản Quản trị viên</div>
                </div>
              </button>
            )}
          </div>

          {/* Dòng trợ giúp liên hệ quản trị */}
          <div style={{
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            fontSize: '12.5px',
            color: '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
          }}>
            <span>🔒 Cần quyền hạn này cho công việc? Vui lòng liên hệ Quản trị viên hệ thống:</span>
            <a
              href={`mailto:${adminEmail}`}
              style={{
                color: '#38bdf8',
                fontWeight: '700',
                textDecoration: 'none',
                borderBottom: '1px dashed rgba(56, 189, 248, 0.5)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#7dd3fc')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#38bdf8')}
              title={`Gửi email đến Quản trị viên: ${adminEmail}`}
            >
              {adminEmail}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
