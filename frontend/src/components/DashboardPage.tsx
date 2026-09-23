// frontend/src/components/DashboardPage.tsx
interface User {
  username: string;
  name: string;
  role: string;
}

interface DashboardProps {
  user: User;
  onLogout: () => void;
}

export default function DashboardPage({ user, onLogout }: DashboardProps) {
  // Dữ liệu sản phẩm mẫu trong kho & bán hàng
  const products = [
    { id: 1, code: 'SP001', name: 'Áo thun Polo Nam Cao Cấp', category: 'Thời trang', stock: 120, costPrice: 85000, sellPrice: 199000 },
    { id: 2, code: 'SP002', name: 'Quần Jeans Slimfit Co Giãn', category: 'Thời trang', stock: 45, costPrice: 160000, sellPrice: 380000 },
    { id: 3, code: 'SP003', name: 'Áo khoác Bomber Chống Nước', category: 'Thời trang', stock: 30, costPrice: 220000, sellPrice: 490000 },
    { id: 4, code: 'SP004', name: 'Giày Sneaker Thể Thao', category: 'Giày dép', stock: 65, costPrice: 310000, sellPrice: 650000 },
    { id: 5, code: 'SP005', name: 'Thắt lưng da bò nguyên tấm', category: 'Phụ kiện', stock: 80, costPrice: 95000, sellPrice: 250000 },
  ];

  // Tính toán số liệu tổng hợp
  const totalStock = products.reduce((acc, p) => acc + p.stock, 0);
  const totalSellValue = products.reduce((acc, p) => acc + p.sellPrice * p.stock, 0);
  const totalCostValue = products.reduce((acc, p) => acc + p.costPrice * p.stock, 0);
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
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
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '2px 0 0 0' }}>Phân hệ quản trị phân quyền dữ liệu</p>
          </div>
        </div>

        {/* User Info & Logout Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#f8fafc' }}>{user.name}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px', marginTop: '3px' }}>
              <span style={{
                display: 'inline-block',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: roleBadgeColor
              }}></span>
              <span style={{ fontSize: '12px', color: roleBadgeColor, fontWeight: '500' }}>{roleLabel}</span>
            </div>
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: '9px 16px',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.25)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Đăng xuất
          </button>
        </div>
      </header>

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
            <strong>Chính Sách Bảo Mật Nghiệp Vụ Bán Hàng:</strong> Bạn đang thao tác với vai trò <strong>Nhân Viên Bán Hàng</strong>. Toàn bộ thông tin <strong>Giá Vốn Nhập Kho</strong> và <strong>Biên Lợi Nhuận</strong> đã được ẩn tuyệt đối theo quy định bảo mật kinh doanh.
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
            <strong>Quyền Quản Trị Tối Cao:</strong> Bạn có quyền xem toàn bộ dữ liệu tài chính nhạy cảm bao gồm <strong>Giá Vốn</strong>, <strong>Doanh Thu Tiềm Năng</strong> và <strong>Lợi Nhuận Dự Kiến</strong>.
          </div>
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
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#f8fafc' }}>{products.length} mã SP</div>
          <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px' }}>Tổng số lượng: {totalStock} cái</div>
        </div>

        {/* Thẻ 2: Giá trị niêm yết bán */}
        <div style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '14px', padding: '20px' }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Tổng Giá Trị Bán Dự Kiến</div>
          <div style={{ fontSize: '26px', fontWeight: '700', color: '#34d399' }}>{totalSellValue.toLocaleString()} đ</div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>Dựa trên giá niêm yết</div>
        </div>

        {/* Thẻ 3: Tổng Giá Vốn (Chỉ Admin thấy) */}
        <div style={{
          background: user.role === 'admin' ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: user.role === 'admin' ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Tổng Giá Vốn Tồn Kho</div>
          {user.role === 'admin' ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#f87171' }}>{totalCostValue.toLocaleString()} đ</div>
              <div style={{ fontSize: '12px', color: '#fca5a5', marginTop: '4px' }}>Dữ liệu nội bộ bảo mật</div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              <span>🔒</span> <em>Đã khóa quyền truy cập</em>
            </div>
          )}
        </div>

        {/* Thẻ 4: Lợi Nhuận Dự Kiến (Chỉ Admin thấy) */}
        <div style={{
          background: user.role === 'admin' ? '#1e293b' : 'rgba(30, 41, 59, 0.4)',
          border: user.role === 'admin' ? '1px solid #334155' : '1px dashed #475569',
          borderRadius: '14px',
          padding: '20px'
        }}>
          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '8px' }}>Lợi Nhuận Gộp Dự Kiến</div>
          {user.role === 'admin' ? (
            <>
              <div style={{ fontSize: '26px', fontWeight: '700', color: '#fbbf24' }}>+{totalProfit.toLocaleString()} đ</div>
              <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '4px' }}>Biên lãi: ~{Math.round((totalProfit / totalSellValue) * 100)}%</div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748b', fontSize: '14px', marginTop: '8px' }}>
              <span>🔒</span> <em>Đã khóa quyền truy cập</em>
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
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>Danh Sách Hàng Hóa Trong Kho</h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>Hiển thị danh mục theo phân quyền của tài khoản hiện tại</p>
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
              <th style={{ padding: '14px 16px', fontWeight: '600' }}>Mã SP</th>
              <th style={{ padding: '14px 16px', fontWeight: '600' }}>Tên Sản Phẩm</th>
              <th style={{ padding: '14px 16px', fontWeight: '600' }}>Danh Mục</th>
              <th style={{ padding: '14px 16px', fontWeight: '600' }}>Số Lượng Tồn</th>
              <th style={{ padding: '14px 16px', fontWeight: '600' }}>Giá Niêm Yết (Bán)</th>
              {/* CỘT GIÁ VỐN - CHỈ ADMIN MỚI THẤY */}
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
                  {item.sellPrice.toLocaleString()} đ
                </td>
                {/* DỮ LIỆU GIÁ VỐN - CHỈ ADMIN MỚI ĐƯỢC RENDER */}
                {user.role === 'admin' && (
                  <td style={{ padding: '14px 16px', color: '#f87171', fontWeight: '700' }}>
                    {item.costPrice.toLocaleString()} đ
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
