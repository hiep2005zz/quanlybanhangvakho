// frontend/src/components/UserManagementView.tsx
import React, { useState, useEffect } from 'react';
import {
  User,
  UserAccount,
  getUsersApi,
  updateUserApi,
  deleteUserApi,
  getUserDealersApi,
  handoverDealersApi,
  DealerItem,
  UserUpdatePayload,
} from '../services/api';
import { sessionManager } from '../services/sessionManager';

interface UserManagementViewProps {
  currentUser: User;
  token: string;
  onBackToHome?: () => void;
  onCreateAccount?: () => void;
}

const ROLES_LIST = [
  {
    role: 'admin',
    title: 'Quản trị hệ thống',
    badgeColor: '#ef4444',
    description: '(Toàn quyền cấu hình, quản trị tài khoản, tạo admin mới và giám sát hệ thống)',
    costPerm: true,
    invPerm: true,
  },
  {
    role: 'sales_manager',
    title: 'Quản lý kinh doanh',
    badgeColor: '#8b5cf6',
    description: '(Quản lý bán hàng, xem báo cáo doanh thu, giá vốn và biên lợi nhuận)',
    costPerm: true,
    invPerm: false,
  },
  {
    role: 'sales',
    title: 'Nhân viên kinh doanh',
    badgeColor: '#3b82f6',
    description: '(Tạo đơn hàng, tra cứu tồn kho bán hàng. Không xem giá vốn và không sửa kho)',
    costPerm: false,
    invPerm: false,
  },
  {
    role: 'warehouse',
    title: 'Thủ kho',
    badgeColor: '#10b981',
    description: '(Thực hiện nhập, xuất, điều chỉnh kho. Tuyệt đối không xem giá vốn & lợi nhuận)',
    costPerm: false,
    invPerm: true,
  },
  {
    role: 'warehouse_manager',
    title: 'Quản lý kho',
    badgeColor: '#059669',
    description: '(Giám sát điều phối hàng hóa kho vận, duyệt phiếu. Không xem giá vốn)',
    costPerm: false,
    invPerm: true,
  },
  {
    role: 'accountant',
    title: 'Kế toán công nợ',
    badgeColor: '#f59e0b',
    description: '(Phát hành hoá đơn, ghi nhận thanh toán, đối chiếu công nợ với đại lý)',
    costPerm: false,
    invPerm: false,
  },
  {
    role: 'customer',
    title: 'Đại lý',
    badgeColor: '#0284c7',
    description: '(Cửa hàng hoặc đại lý mua sỉ, tự đặt hàng, theo dõi đơn và công nợ của mình)',
    costPerm: false,
    invPerm: false,
  },
];

const BRANCH_OPTIONS = [
  'Kho Tổng Hà Nội',
  'Kho Chi Nhánh Đà Nẵng',
  'Kho Chi Nhánh TP. Hồ Chí Minh',
  'Toàn quốc',
  'Khu vực Miền Bắc',
  'Khu vực Miền Trung',
  'Khu vực Miền Nam',
  'Trụ sở chính',
];

// TC-01: Ràng buộc địa bàn và vai trò bàn giao đại lý
const SALES_ROLES = ['sales', 'sales_manager'];

const checkRegionMatch = (userBranch: string, dealerAddress: string, sourceUserBranch: string = ''): boolean => {
  const ub = (userBranch || '').toLowerCase().trim();
  if (ub.includes('toàn quốc') || ub.includes('trụ sở')) {
    return true;
  }
  const sb = (sourceUserBranch || '').toLowerCase().trim();
  if (sb && ub && sb === ub) {
    return true;
  }
  const addr = (dealerAddress || '').toLowerCase();
  // Khu vực Miền Bắc
  if ((ub.includes('miền bắc') || ub.includes('hà nội') || ub.includes('hải phòng')) &&
      ['hà nội', 'hải phòng', 'bắc', 'quảng ninh'].some((x) => addr.includes(x))) {
    return true;
  }
  // Khu vực Miền Trung
  if ((ub.includes('miền trung') || ub.includes('đà nẵng') || ub.includes('huế')) &&
      ['đà nẵng', 'huế', 'quảng', 'nghệ an', 'trung'].some((x) => addr.includes(x))) {
    return true;
  }
  // Khu vực Miền Nam
  if ((ub.includes('miền nam') || ub.includes('hồ chí minh') || ub.includes('tp. hcm')) &&
      ['hồ chí minh', 'tp. hcm', 'bình dương', 'nam', 'tân bình'].some((x) => addr.includes(x))) {
    return true;
  }
  return false;
};



export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  token,
  onBackToHome,
  onCreateAccount,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter, Search & Pagination (S1-08 / S1-10: 20 dòng/trang mặc định)
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);


  // Modal Edit State
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    full_name: string;
    email: string;
    phone: string;
    role: string;
    roles: string[];
    branch: string;
    password: string;
    is_active: boolean;
    lock_reason: string;
  }>({
    full_name: '',
    email: '',
    phone: '',
    role: 'sales',
    roles: ['sales'],
    branch: 'Kho Tổng Hà Nội',
    password: '',
    is_active: true,
    lock_reason: '',
  });

  // Modal Bàn giao đại lý State
  const [handoverUser, setHandoverUser] = useState<UserAccount | null>(null);
  const [handoverDealers, setHandoverDealers] = useState<any[]>([]);
  const [isLoadingDealers, setIsLoadingDealers] = useState<boolean>(false);
  const [targetSaleUsername, setTargetSaleUsername] = useState<string>('');
  const [isSubmittingHandover, setIsSubmittingHandover] = useState<boolean>(false);
  const [handoverModalError, setHandoverModalError] = useState<string | null>(null);

  // Modal Delete State (Popup giữa màn hình thay cho window.confirm)
  const [userToDelete, setUserToDelete] = useState<UserAccount | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteModalError, setDeleteModalError] = useState<string | null>(null);

  // Dropdown 3 chấm (Action Menu) theo từng hàng
  const [activeDropdownUserId, setActiveDropdownUserId] = useState<number | null>(null);

  // Đóng dropdown khi click ra ngoài hoặc bấm Escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.user-action-dropdown-container')) {
        setActiveDropdownUserId(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveDropdownUserId(null);
      }
    };
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Load users from Backend
  const loadUsers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await getUsersApi(token);
      setUsers(res.users);
    } catch (err: any) {
      setError(err.message || 'Không thể tải danh sách người dùng.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();

    // Lắng nghe sự kiện tạo hoặc thay đổi tài khoản người dùng để tự động cập nhật ngay tức thì và hiện thông báo
    const handleAccountsChanged = (e: any) => {
      loadUsers();
      const msg = e?.detail?.message;
      if (msg) {
        setSuccessMessage(msg);
      } else {
        setSuccessMessage('✅ Tạo tài khoản thành công!');
      }
    };
    window.addEventListener('USER_ACCOUNTS_CHANGED', handleAccountsChanged);
    return () => {
      window.removeEventListener('USER_ACCOUNTS_CHANGED', handleAccountsChanged);
    };
  }, [token]);

  // Tự động ẩn thông báo thành công sau 5 giây
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);
  // Helper kiểm tra vai trò kho
  const hasWarehouseRole = (roles: string[]) => roles.some((r) => r === 'warehouse' || r === 'warehouse_manager');
  const isWarehouseBranch = (b: string) => b.startsWith('Kho ');

  // Open Edit Modal
  const openEditModal = (targetUser: UserAccount) => {
    setUserToEdit(targetUser);
    setEditModalError(null);
    const rawRoles = targetUser.roles && targetUser.roles.length > 0 ? targetUser.roles : [targetUser.role];
    // Loại bỏ role tạm 'customer' để quản trị viên chọn vai trò nghiệp vụ chính thức
    const initialRoles = rawRoles.filter((r) => r && r !== 'customer');
    setEditFormData({
      full_name: targetUser.full_name,
      email: targetUser.email || '',
      phone: targetUser.phone || '',
      role: initialRoles[0] || 'sales',
      roles: initialRoles,
      branch: targetUser.branch && targetUser.branch !== 'Chưa phân công' ? targetUser.branch : 'Kho Tổng Hà Nội',
      password: '',
      is_active: targetUser.is_active && targetUser.status !== 'LOCKED',
      lock_reason: targetUser.lock_reason || '',
    });
  };



  // Submit edit user
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userToEdit) return;
    setEditModalError(null);

    const isEditingSelf = (userToEdit.username.toLowerCase() === currentUser.username.toLowerCase());
    const userHadAdmin = (userToEdit.roles || [userToEdit.role]).includes('admin');

    // Nghiệp vụ: Không thể tự thu hồi vai trò quản trị của chính mình
    if (isEditingSelf && userHadAdmin && !editFormData.roles.includes('admin')) {
      setEditModalError('Bảo vệ hệ thống: Không thể tự thu hồi vai trò quản trị (Admin) của chính mình!');
      return;
    }

    if (isEditingSelf && !editFormData.is_active) {
      setEditModalError('Bảo vệ hệ thống: Không được tự khóa tài khoản Admin của chính mình!');
      return;
    }

    if (!editFormData.full_name.trim()) {
      setEditModalError('Họ và tên không được để trống.');
      return;
    }

    if (editFormData.roles.length === 0) {
      setEditModalError('Người dùng phải có ít nhất 1 vai trò hệ thống.');
      return;
    }

    // Nghiệp vụ: Người dùng vai trò Kho phải gắn với ít nhất 1 kho cụ thể
    if (hasWarehouseRole(editFormData.roles) && !isWarehouseBranch(editFormData.branch)) {
      setEditModalError('Người dùng có vai trò Kho bắt buộc phải gắn với ít nhất 1 kho cụ thể.');
      return;
    }

    // AC 2: Bắt buộc ghi lý do khi khóa tài khoản
    if (!editFormData.is_active && !editFormData.lock_reason.trim()) {
      setEditModalError('Bắt buộc phải nhập Lý do khóa tài khoản khi chuyển sang trạng thái Khóa.');
      return;
    }

    setIsSubmittingEdit(true);
    try {
      const updatePayload: UserUpdatePayload = {
        full_name: editFormData.full_name.trim(),
        email: editFormData.email.trim() || undefined,
        phone: editFormData.phone.trim() || undefined,
        role: editFormData.roles[0],
        roles: editFormData.roles,
        branch: editFormData.branch,
        is_active: editFormData.is_active,
        status: editFormData.is_active ? 'ACTIVE' : 'LOCKED',
        lock_reason: editFormData.is_active ? undefined : editFormData.lock_reason.trim(),
      };

      if (editFormData.password.trim()) {
        if (editFormData.password.trim().length < 3) {
          setEditModalError('Mật khẩu mới phải có tối thiểu 3 ký tự.');
          setIsSubmittingEdit(false);
          return;
        }
        updatePayload.password = editFormData.password.trim();
      }

      const updated = await updateUserApi(token, userToEdit.username, updatePayload);
      setSuccessMessage(
        `✅ Đã cập nhật thành công thông tin nhân viên "${updated.full_name}" (@${updated.username}).`
      );
      // Phát tín hiệu đồng bộ vai trò tức thì cho các tab/cửa sổ đang mở
      sessionManager.broadcastUserUpdate(userToEdit.username);
      if (userToEdit.username.toLowerCase() === currentUser.username.toLowerCase()) {
        sessionManager.syncCurrentProfile();
      }
      setUserToEdit(null);
      loadUsers();
    } catch (err: any) {
      setEditModalError(err.message || 'Lỗi khi cập nhật người dùng.');
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  // Mở modal bàn giao đại lý cho nhân viên bị khóa
  const openHandoverModal = async (targetUser: UserAccount) => {
    setHandoverUser(targetUser);
    setHandoverDealers([]);
    setHandoverModalError(null);
    setIsLoadingDealers(true);

    try {
      const data = await getUserDealersApi(token, targetUser.username);
      setHandoverDealers(data.dealers);

      // Tìm default nhân viên kinh doanh phù hợp địa bàn và vai trò
      const dealers = data.dealers || [];
      const eligible = users.filter((u) => {
        if (!u.is_active || u.status === 'LOCKED' || u.username.toLowerCase() === targetUser.username.toLowerCase()) return false;
        const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
        if (!userRoles.some((r) => SALES_ROLES.includes(r))) return false;
        return dealers.every((d: any) => checkRegionMatch(u.branch || '', d.address || '', targetUser.branch || ''));
      });

      if (eligible.length > 0) {
        setTargetSaleUsername(eligible[0].username);
      } else {
        setTargetSaleUsername('');
      }
    } catch (err: any) {
      setHandoverModalError(err.message || 'Không thể tải danh sách đại lý của nhân viên này.');
    } finally {
      setIsLoadingDealers(false);
    }
  };


  // Thực hiện bàn giao đại lý
  const handleConfirmHandover = async () => {
    if (!handoverUser || !targetSaleUsername) return;
    setIsSubmittingHandover(true);
    setHandoverModalError(null);

    try {
      const res = await handoverDealersApi(token, handoverUser.username, targetSaleUsername);
      setSuccessMessage(`✅ ${res.message}`);
      setHandoverUser(null);
      loadUsers();
    } catch (err: any) {
      setHandoverModalError(err.message || 'Lỗi khi bàn giao đại lý.');
    } finally {
      setIsSubmittingHandover(false);
    }
  };

  // Open Delete Confirm Popup
  const openDeleteConfirm = (targetUser: UserAccount) => {
    if (targetUser.username.toLowerCase() === currentUser.username.toLowerCase()) {
      alert('Bảo vệ hệ thống: Bạn không được tự xóa tài khoản Quản trị viên của chính mình!');
      return;
    }
    setDeleteModalError(null);
    setUserToDelete(targetUser);
  };

  // Execute deletion
  const handleConfirmDelete = async () => {
    if (!userToDelete) return;

    setIsDeleting(true);
    setDeleteModalError(null);
    try {
      const res = await deleteUserApi(token, userToDelete.username);
      setSuccessMessage(`✅ ${res.message}`);
      setUserToDelete(null);
      loadUsers();
    } catch (err: any) {
      setDeleteModalError(err.message || 'Lỗi khi xóa người dùng.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Filtered users (Tìm kiếm tên/email/phone, filter vai trò, filter trạng thái)
  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase().trim();
    const matchesSearch =
      !term ||
      u.full_name.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term) ||
      (u.email && u.email.toLowerCase().includes(term)) ||
      (u.phone && u.phone.toLowerCase().includes(term)) ||
      (u.branch && u.branch.toLowerCase().includes(term));

    const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
    const matchesRole =
      selectedRoleFilter === 'all' || userRoles.includes(selectedRoleFilter);

    const isActive = u.is_active && u.status !== 'LOCKED';
    const matchesStatus =
      selectedStatusFilter === 'all' ||
      (selectedStatusFilter === 'active' && isActive) ||
      (selectedStatusFilter === 'locked' && !isActive) ||
      (selectedStatusFilter === 'handover' && (u.dealers_needing_handover || 0) > 0);

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Reset về page 1 khi bộ lọc thay đổi
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* 1. Breadcrumb: Trang chủ / Quản lý người dùng */}
      <nav
        aria-label="Breadcrumb"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontSize: '13.5px',
          color: '#64748b',
          fontWeight: '500',
          padding: '2px 4px',
        }}
      >
        <button
          onClick={onBackToHome}
          style={{
            background: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '20px',
            color: '#2563eb',
            cursor: 'pointer',
            padding: '5px 14px',
            fontSize: '13px',
            fontWeight: '600',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
            transition: 'all 0.18s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#2563eb';
            e.currentTarget.style.background = '#eff6ff';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#cbd5e1';
            e.currentTarget.style.background = '#ffffff';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Trang chủ</span>
        </button>
        <span style={{ color: '#cbd5e1', fontSize: '14px' }}>/</span>
        <span style={{ color: '#0f172a', fontWeight: '600', fontSize: '13.5px' }}>Quản lý người dùng</span>
      </nav>

      {/* 2. Tiêu đề: Quản Lý Phân Quyền Vai Trò */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '14px',
        padding: '16px 22px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.25)',
            flexShrink: 0
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{
              fontSize: '20px',
              fontWeight: '700',
              margin: 0,
              color: '#0f172a',
              letterSpacing: '-0.02em',
            }}>
              Phân Quyền & Quản Lý Người Dùng
            </h2>
            <span style={{
              background: '#eff6ff',
              color: '#1d4ed8',
              border: '1px solid #bfdbfe',
              borderRadius: '999px',
              padding: '2px 10px',
              fontSize: '11.5px',
              fontWeight: '600',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }}></span>
              Quản trị viên
            </span>
          </div>
        </div>

        {/* Nút Tạo tài khoản đặt ở trên góc phải, thẳng phía trên chữ Làm mới */}
        {onCreateAccount && (
          <button
            type="button"
            onClick={onCreateAccount}
            id="btn-userview-create-account"
            style={{
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              border: 'none',
              borderRadius: '9px',
              color: '#ffffff',
              padding: '9px 16px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.18s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1.5px)';
              e.currentTarget.style.boxShadow = '0 4px 14px rgba(16, 185, 129, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 2px 8px rgba(16, 185, 129, 0.35)';
            }}
            title="Tạo tài khoản mới và gửi email kích hoạt"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <line x1="20" y1="8" x2="20" y2="14" />
              <line x1="23" y1="11" x2="17" y2="11" />
            </svg>
            <span>Tạo tài khoản</span>
          </button>
        )}
      </div>

      {/* Success Notification Alert */}
      {successMessage && (
        <div style={{
          background: '#dcfce7',
          border: '1px solid #bbf7d0',
          color: '#15803d',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#15803d', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{
          background: '#fee2e2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          padding: '12px 16px',
          borderRadius: '10px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Filter Bar: [ Tìm kiếm tên/email/SĐT... ]  [ Lọc vai trò ]  [ Lọc trạng thái ]  [ 🔄 Làm mới ] */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '12px',
        boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)',
        padding: '14px 18px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1' }}>
          <span style={{ position: 'absolute', left: '12px', top: '10px', color: '#64748b', display: 'flex', alignItems: 'center' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên, email, số điện thoại, kho..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            style={{
              width: '100%',
              padding: '9px 12px 9px 36px',
              borderRadius: '8px',
              border: '1px solid #cbd5e1',
              background: '#ffffff',
              color: '#0f172a',
              fontSize: '13.5px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Right side controls: Role filter + Status Filter + Refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          {/* Lọc vai trò */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>Vai trò:</label>
            <select
              value={selectedRoleFilter}
              onChange={(e) => {
                setSelectedRoleFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả vai trò ({users.length})</option>
              {ROLES_LIST.map((r) => (
                <option key={r.role} value={r.role}>
                  {r.title}
                </option>
              ))}
            </select>
          </div>

          {/* Lọc trạng thái (Hoạt động / Tạm khóa / Cần bàn giao) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <label style={{ fontSize: '13px', color: '#64748b', fontWeight: '500', whiteSpace: 'nowrap' }}>Trạng thái:</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => {
                setSelectedStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              style={{
                padding: '8px 12px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#ffffff',
                color: '#0f172a',
                fontSize: '13px',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="active">🟢 Đang hoạt động</option>
              <option value="locked">🔴 Tạm khóa / Đã nghỉ</option>
              <option value="handover">⚠️ Cần bàn giao đại lý</option>
            </select>
          </div>

          <button
            onClick={() => {
              loadUsers();
              setCurrentPage(1);
            }}
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              transition: 'all 0.18s ease',
              borderRadius: '8px',
              color: '#334155',
              padding: '8px 14px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#eff6ff';
              e.currentTarget.style.borderColor = '#93c5fd';
              e.currentTarget.style.color = '#1d4ed8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
              e.currentTarget.style.color = '#334155';
            }}
            title="Làm mới danh sách nhân viên"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <polyline points="1 20 1 14 7 14" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* 4. Users Table & Pagination Chuẩn Enterprise */}
      <div
        className="premium-table-card roles-grid-scroll"
        style={{
          position: 'relative',
          overflowX: 'auto',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '4px', height: '20px', borderRadius: '4px', background: 'linear-gradient(180deg, #6366f1 0%, #a855f7 100%)' }} />
            <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#f8fafc', letterSpacing: '-0.01em' }}>
              Danh Sách Nhân Viên
            </h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12.5px', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.05)', padding: '4px 12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
              Kết quả: <strong style={{ color: '#38bdf8' }}>{filteredUsers.length}</strong> / {users.length} nhân viên
            </span>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>⏳</div>
            <div style={{ fontSize: '14px', fontWeight: '500' }}>Đang tải danh sách nhân viên từ Backend...</div>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center', color: '#64748b' }}>
            <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
            <div style={{ fontSize: '15px', color: '#0f172a', fontWeight: '700' }}>Không tìm thấy nhân viên nào phù hợp</div>
            <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>Hãy thử điều chỉnh từ khóa tìm kiếm hoặc đặt lại bộ lọc vai trò / trạng thái</div>
          </div>
        ) : (
          <>
            <div style={{ borderRadius: '12px', border: '1px solid #e2e8f0', background: '#ffffff', overflow: 'visible', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.05)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    color: '#64748b',
                    background: '#f8fafc',
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <th style={{ padding: '14px 16px', fontWeight: '700', width: '60px', textAlign: 'center' }}>STT</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'left' }}>Họ và tên / Tài khoản</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'left' }}>Email & SĐT</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'left' }}>Vai trò hệ thống</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'left' }}>Kho / Địa bàn</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'center' }}>Trạng thái</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'left' }}>Quyền bảo mật</th>
                    <th style={{ padding: '14px 16px', fontWeight: '700', textAlign: 'center', width: '80px' }}>Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map((u, idx) => {
                    const isCurrentSelf = (u.username.toLowerCase() === currentUser.username.toLowerCase());
                    const isDropdownOpen = activeDropdownUserId === u.id;
                    const isActive = u.is_active && u.status !== 'LOCKED';
                    return (
                      <tr
                        key={u.id}
                        className="inventory-row"
                        style={{
                          borderBottom: idx === paginatedUsers.length - 1 ? 'none' : '1px solid #f1f5f9',
                          background: isDropdownOpen
                            ? '#f1f5f9'
                            : idx % 2 === 0 ? '#ffffff' : '#fcfcfd',
                          position: 'relative',
                          zIndex: isDropdownOpen ? 30 : 1,
                        }}
                      >
                        {/* Thứ tự chuẩn STT (#1, #2, #3,...) */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <span
                            title={`Mã ID gốc hệ thống: #${u.id}`}
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                              fontSize: '12px',
                              color: '#475569',
                              fontWeight: '600',
                              background: '#f1f5f9',
                              padding: '2px 7px',
                              borderRadius: '4px'
                            }}
                          >
                            #{startIndex + idx + 1}
                          </span>
                        </td>

                        {/* Họ tên + Avatar */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '38px',
                              height: '38px',
                              borderRadius: '10px',
                              background: u.badge_color ? `linear-gradient(135deg, ${u.badge_color} 0%, #2563eb 100%)` : '#2563eb',
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: '800',
                              fontSize: '15px',
                              flexShrink: 0,
                              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                              border: '1px solid rgba(255, 255, 255, 0.4)',
                            }}>
                              {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span>{u.full_name}</span>
                                {isCurrentSelf && (
                                  <span style={{
                                    background: '#eff6ff',
                                    color: '#2563eb',
                                    border: '1px solid #bfdbfe',
                                    padding: '1px 7px',
                                    borderRadius: '999px',
                                    fontSize: '10.5px',
                                    fontWeight: '700'
                                  }}>
                                    Bạn
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '12px', color: '#64748b', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', marginTop: '2px' }}>
                                @{u.username}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email & Phone */}
                        <td style={{ padding: '14px 16px', color: '#334155' }}>
                          <div style={{ fontSize: '13px', fontWeight: '500' }}>
                            {u.email || <span style={{ color: '#94a3b8' }}>Chưa cập nhật email</span>}
                          </div>
                          {u.phone && (
                            <div style={{ fontSize: '12px', color: '#0284c7', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <span>📞</span>
                              <span style={{ fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}>{u.phone}</span>
                            </div>
                          )}
                        </td>

                        {/* Vai trò */}
                        <td style={{ padding: '14px 16px' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {(() => {
                              const allRoles = (u.roles && u.roles.length > 0) ? u.roles : [u.role];
                              const nonCustomerRoles = allRoles.filter((r) => r !== 'customer');
                              const displayRoles = nonCustomerRoles.length > 0 ? nonCustomerRoles : ['customer'];
                              return displayRoles.map((rCode) => {
                                const rMeta = ROLES_LIST.find((item) => item.role === rCode);
                                const color = rMeta?.badgeColor || u.badge_color || '#2563eb';
                                const title = rMeta?.title || (rCode === 'customer' ? 'Chờ cấp quyền' : rCode);
                                return (
                                  <span
                                    key={rCode}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '5px',
                                      padding: '3px 9px',
                                      borderRadius: '999px',
                                      background: `${color}14`,
                                      color: color,
                                      fontWeight: '700',
                                      fontSize: '11.5px',
                                      border: `1px solid ${color}30`,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color }} />
                                    {title}
                                  </span>
                                );
                              });
                            })()}
                          </div>
                        </td>

                        {/* Kho / Địa bàn */}
                        <td style={{ padding: '14px 16px', color: '#334155', fontSize: '13px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <span>📍</span>
                            <span>{u.branch || 'Kho Tổng Hà Nội'}</span>
                          </span>
                        </td>

                        {/* Trạng thái & Cảnh báo bàn giao */}
                        <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                            {isActive ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#15803d',
                                background: '#dcfce7',
                                border: '1px solid #bbf7d0',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '12px',
                                fontWeight: '700'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#16a34a' }} />
                                Hoạt động
                              </span>
                            ) : (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                color: '#b91c1c',
                                background: '#fee2e2',
                                border: '1px solid #fecaca',
                                padding: '3px 10px',
                                borderRadius: '999px',
                                fontSize: '12px',
                                fontWeight: '700'
                              }}>
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#dc2626' }} />
                                Tạm khóa
                              </span>
                            )}

                            {/* Cảnh báo bàn giao đại lý (AC 3) */}
                            {u.dealers_needing_handover > 0 && (
                              <button
                                type="button"
                                onClick={() => openHandoverModal(u)}
                                title={`Có ${u.dealers_needing_handover} đại lý cần bàn giao gấp`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  background: '#fef3c7',
                                  border: '1px solid #fde68a',
                                  color: '#b45309',
                                  padding: '2px 8px',
                                  borderRadius: '6px',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = '#fde68a')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = '#fef3c7')}
                              >
                                ⚠️ Bàn giao ({u.dealers_needing_handover})
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Quyền hạn bảo mật */}
                        <td style={{ padding: '14px 16px', fontSize: '12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ color: u.can_view_cost ? '#15803d' : '#94a3b8', fontWeight: u.can_view_cost ? '600' : 'normal' }}>
                              {u.can_view_cost ? '✓ Xem giá vốn & lãi' : '— Ẩn giá vốn & lãi'}
                            </span>
                            <span style={{ color: u.can_write_inventory ? '#0284c7' : '#94a3b8', fontWeight: u.can_write_inventory ? '600' : 'normal' }}>
                              {u.can_write_inventory ? '✓ Nhập/xuất/sửa kho' : '— Chặn thao tác kho'}
                            </span>
                          </div>
                        </td>

                        {/* Thao tác (Nút 3 chấm) */}
                        <td style={{ padding: '14px 16px', textAlign: 'center', position: 'relative' }}>
                          <div className="user-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownUserId((prev) => (prev === u.id ? null : u.id));
                              }}
                              title="Tùy chọn thao tác"
                              style={{
                                width: '34px',
                                height: '34px',
                                borderRadius: '8px',
                                border: activeDropdownUserId === u.id
                                  ? '1px solid #2563eb'
                                  : '1px solid #e2e8f0',
                                background: activeDropdownUserId === u.id
                                  ? '#eff6ff'
                                  : '#ffffff',
                                color: activeDropdownUserId === u.id ? '#1d4ed8' : '#64748b',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                              }}
                              onMouseEnter={(e) => {
                                if (activeDropdownUserId !== u.id) {
                                  e.currentTarget.style.background = '#f8fafc';
                                  e.currentTarget.style.color = '#0f172a';
                                  e.currentTarget.style.borderColor = '#cbd5e1';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (activeDropdownUserId !== u.id) {
                                  e.currentTarget.style.background = '#ffffff';
                                  e.currentTarget.style.color = '#64748b';
                                  e.currentTarget.style.borderColor = '#e2e8f0';
                                }
                              }}
                            >
                              <span style={{ display: 'flex', flexDirection: 'column', gap: '3px', pointerEvents: 'none', margin: 'auto' }}>
                                <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                                <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                                <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'currentColor' }} />
                              </span>
                            </button>

                            {/* Dropdown Menu */}
                            {activeDropdownUserId === u.id && (() => {
                              const openUpward = paginatedUsers.length > 3 && idx >= paginatedUsers.length - 2;
                              return (
                                <div
                                  style={{
                                    position: 'absolute',
                                    right: 0,
                                    ...(openUpward
                                      ? { bottom: 'calc(100% + 8px)' }
                                      : { top: 'calc(100% + 8px)' }),
                                    background: '#ffffff',
                                    border: '1px solid #e2e8f0',
                                    borderRadius: '12px',
                                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
                                    minWidth: '200px',
                                    zIndex: 9999,
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '4px',
                                    textAlign: 'left',
                                    animation: 'popoverIn 0.15s ease-out',
                                  }}
                                >
                                  {/* Nút Phân vai trò & Kho */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDropdownUserId(null);
                                      openEditModal(u);
                                    }}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '10px',
                                      width: '100%',
                                      padding: '9px 12px',
                                      borderRadius: '8px',
                                      border: 'none',
                                      background: 'transparent',
                                      color: '#334155',
                                      fontSize: '13px',
                                      fontWeight: '500',
                                      cursor: 'pointer',
                                      transition: 'all 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.background = '#eff6ff';
                                      e.currentTarget.style.color = '#1d4ed8';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.background = 'transparent';
                                      e.currentTarget.style.color = '#334155';
                                    }}
                                  >
                                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                                    </svg>
                                    <span>Phân vai trò & Kho</span>
                                  </button>

                                  {/* Nút Bàn giao đại lý */}
                                  {u.dealers_needing_handover > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownUserId(null);
                                        openHandoverModal(u);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: '#fef3c7',
                                        color: '#b45309',
                                        fontSize: '13px',
                                        fontWeight: '600',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#fde68a';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = '#fef3c7';
                                      }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#b45309" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="23 4 23 10 17 10" />
                                        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                                      </svg>
                                      <span>Bàn giao đại lý ({u.dealers_needing_handover})</span>
                                    </button>
                                  )}

                                  <div style={{ height: '1px', background: '#e2e8f0', margin: '2px 0' }} />

                                  {/* Nút Xóa / Chặn tự xóa */}
                                  {isCurrentSelf ? (
                                    <div
                                      title="Không được tự xóa tài khoản Admin của chính mình"
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        color: '#94a3b8',
                                        fontSize: '12.5px',
                                        cursor: 'not-allowed',
                                        boxSizing: 'border-box'
                                      }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                      </svg>
                                      <span>Không thể tự xóa</span>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDropdownUserId(null);
                                        openDeleteConfirm(u);
                                      }}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '10px',
                                        width: '100%',
                                        padding: '9px 12px',
                                        borderRadius: '8px',
                                        border: 'none',
                                        background: 'transparent',
                                        color: '#dc2626',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.background = '#fee2e2';
                                        e.currentTarget.style.color = '#b91c1c';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.color = '#dc2626';
                                      }}
                                    >
                                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                      </svg>
                                      <span>Xóa tài khoản</span>
                                    </button>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phân Trang Chuẩn Enterprise (Mặc định 20 dòng/trang) */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '14px',
              marginTop: '18px',
              paddingTop: '16px',
              borderTop: '1px solid #e2e8f0',
              fontSize: '13px',
              color: '#64748b',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>Hiển thị</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '8px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#0f172a',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    boxShadow: '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                  }}
                >
                  <option value={10}>10 dòng</option>
                  <option value={20}>20 dòng</option>
                  <option value={50}>50 dòng</option>
                  <option value={100}>100 dòng</option>
                </select>
              </div>

              {/* Điều hướng trang: Chỉ hiển thị khi có từ 2 trang trở lên (tức tổng số dòng vượt quá số dòng / trang) */}
              {totalPages > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    disabled={safeCurrentPage <= 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: safeCurrentPage <= 1 ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage <= 1 ? '#94a3b8' : '#0f172a',
                      cursor: safeCurrentPage <= 1 ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.15s ease',
                      boxShadow: safeCurrentPage <= 1 ? 'none' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                    }}
                  >
                    ← Trước
                  </button>

                  <span style={{ padding: '0 6px', fontWeight: '600', color: '#334155' }}>
                    Trang {safeCurrentPage} / {totalPages}
                  </span>

                  <button
                    type="button"
                    disabled={safeCurrentPage >= totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: safeCurrentPage >= totalPages ? '#f8fafc' : '#ffffff',
                      color: safeCurrentPage >= totalPages ? '#94a3b8' : '#0f172a',
                      cursor: safeCurrentPage >= totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: '600',
                      transition: 'all 0.15s ease',
                      boxShadow: safeCurrentPage >= totalPages ? 'none' : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                    }}
                  >
                    Sau →
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>





      {/* POPUP 2 (Giữa màn hình): Chỉnh sửa thông tin nhân viên */}
      {userToEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '560px',
            maxHeight: 'calc(100vh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            color: '#0f172a',
            animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Header Modal Edit */}
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#f8fafc',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '10px',
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    <path d="M9 12l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, color: '#0f172a' }}>
                    Phân Vai Trò & Kho/Địa Bàn Phụ Trách
                  </h3>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>
                    Tài khoản: @{userToEdit.username} (ID: #{userToEdit.id})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setUserToEdit(null)}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  borderRadius: '50%',
                  color: '#64748b',
                  fontSize: '15px',
                  cursor: 'pointer',
                  width: '30px',
                  height: '30px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Edit (Ẩn thanh cuộn trực quan nhưng vẫn cuộn/di chuột mượt mà) */}
            <form
              onSubmit={handleUpdateUser}
              className="no-scrollbar-form"
              style={{
                padding: '20px',
                overflowY: 'auto',
                flex: 1,
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {editModalError && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}>
                  ⚠️ {editModalError}
                </div>
              )}

              {/* Ràng buộc bảo mật: Ngầm thực thi ở checkbox và logic API bên dưới, không cần hiển thị khung cảnh báo */}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Họ và tên */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Email và Username */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Email (Cố định)
                    </label>
                    <input
                      type="email"
                      disabled
                      readOnly
                      value={editFormData.email}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#64748b', marginBottom: '4px' }}>
                      Tên đăng nhập (Cố định)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={userToEdit.username}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                        color: '#64748b',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>

                {/* Số điện thoại */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Số điện thoại liên hệ
                  </label>
                  <input
                    type="text"
                    placeholder="Ví dụ: 0987654321"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13.5px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Chọn nhiều Vai trò (Trong 7 vai trò hệ thống) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <label style={{ fontSize: '13px', fontWeight: '600', color: '#334155' }}>
                      Vai trò hệ thống (Gán nhiều vai trò cùng lúc) <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                      Đã chọn: <strong style={{ color: '#2563eb' }}>{editFormData.roles?.length || 0}</strong> vai trò
                    </span>
                  </div>

                  {/* Danh sách vai trò */}
                  <div
                    className="roles-grid-scroll"
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                      gap: '8px',
                      background: '#f8fafc',
                      border: '1px solid #e2e8f0',
                      borderRadius: '10px',
                      padding: '10px',
                      maxHeight: '190px',
                      overflowY: 'auto',
                      scrollbarWidth: 'none',
                      msOverflowStyle: 'none',
                    }}
                  >
                    {ROLES_LIST.map((r) => {
                      const currentRoles = editFormData.roles || [];
                      const isChecked = currentRoles.includes(r.role);
                      const isSelf = userToEdit.username.toLowerCase() === currentUser.username.toLowerCase();
                      const isSelfAdminRole = isSelf && r.role === 'admin' && (userToEdit.roles || [userToEdit.role]).includes('admin');
                      const isDisabled = isSelfAdminRole;

                      return (
                        <label
                          key={r.role}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '12px',
                            padding: '10px 12px',
                            borderRadius: '10px',
                            border: `1px solid ${isChecked ? r.badgeColor : '#e2e8f0'}`,
                            background: isChecked ? `${r.badgeColor}12` : '#ffffff',
                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                            opacity: isDisabled ? 0.85 : 1,
                            transition: 'all 0.15s ease',
                            boxShadow: isChecked ? `0 2px 6px ${r.badgeColor}18` : '0 1px 2px 0 rgb(0 0 0 / 0.05)',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={isDisabled}
                            onChange={(e) => {
                              if (isDisabled) return;
                              const checked = e.target.checked;
                              let nextRoles: string[];
                              if (checked) {
                                nextRoles = [...currentRoles.filter((code) => code !== r.role), r.role];
                              } else {
                                nextRoles = currentRoles.filter((code) => code !== r.role);
                              }
                              setEditFormData({
                                ...editFormData,
                                role: nextRoles[0] || 'sales',
                                roles: nextRoles,
                              });
                            }}
                            style={{ marginTop: '2px', cursor: isDisabled ? 'not-allowed' : 'pointer', accentColor: r.badgeColor, width: '16px', height: '16px' }}
                          />
                          <div style={{ fontSize: '12.5px', lineHeight: '1.4' }}>
                            <div style={{ fontWeight: '700', color: isChecked ? r.badgeColor : '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {r.title}
                              {r.role === 'admin' && isChecked && (
                                <span style={{ fontSize: '10.5px', color: '#b91c1c', background: '#fee2e2', padding: '1px 6px', borderRadius: '4px' }}>
                                  Toàn quyền
                                </span>
                              )}
                            </div>
                            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '3px' }}>
                              {r.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>

                  {/* Cảnh báo ràng buộc kho nếu có vai trò kho */}
                  {!((editFormData.roles || []).includes('admin')) && hasWarehouseRole(editFormData.roles || []) && (
                    <div style={{
                      marginTop: '8px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      background: '#dcfce7',
                      border: '1px solid #bbf7d0',
                      fontSize: '12px',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <span>📦</span>
                      <span><strong>Ràng buộc Kho:</strong> Tài khoản này có vai trò Kho (Thủ kho hoặc Quản lý kho), bắt buộc phải gắn với ít nhất 1 kho cụ thể bên dưới.</span>
                    </div>
                  )}
                </div>

                {/* Kho / Địa bàn phụ trách */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Kho / Địa bàn phụ trách <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={editFormData.branch}
                    onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: '#ffffff',
                      color: '#0f172a',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {BRANCH_OPTIONS.map((branch) => (
                      <option key={branch} value={branch}>
                        📍 {branch}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Trạng thái tài khoản */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '4px' }}>
                    Trạng thái hoạt động
                  </label>
                  <select
                    value={editFormData.is_active ? 'true' : 'false'}
                    disabled={userToEdit.username.toLowerCase() === currentUser.username.toLowerCase()}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'true' })}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      background: userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() ? '#f8fafc' : '#ffffff',
                      color: editFormData.is_active ? '#15803d' : '#b91c1c',
                      fontWeight: '600',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                      cursor: userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <option value="true">🟢 Đang hoạt động (Bình thường)</option>
                    <option value="false">🔴 Tạm khóa / Đã nghỉ việc (Chặn đăng nhập)</option>
                  </select>
                </div>

                {/* AC 2: Trường Lý do khóa tài khoản bắt buộc khi chọn Tạm khóa */}
                {!editFormData.is_active && (
                  <div style={{
                    marginTop: '4px',
                    padding: '14px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: '8px',
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#b91c1c', marginBottom: '6px' }}>
                      Lý do khóa tài khoản <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <textarea
                      value={editFormData.lock_reason}
                      onChange={(e) => setEditFormData({ ...editFormData, lock_reason: e.target.value })}
                      placeholder="Ví dụ: Nghỉ việc từ ngày dd/mm/yyyy, cần bàn giao địa bàn..."
                      rows={3}
                      required
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: !editFormData.lock_reason.trim() ? '1px solid #ef4444' : '1px solid #cbd5e1',
                        background: '#ffffff',
                        color: '#0f172a',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: '1.5'
                      }}
                    />
                    {!editFormData.lock_reason.trim() ? (
                      <span style={{ fontSize: '12px', color: '#dc2626', display: 'block', marginTop: '4px' }}>
                        ⚠️ Bắt buộc phải nhập lý do khóa để lưu thay đổi.
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginTop: '4px' }}>
                        ℹ️ Lý do này sẽ được thông báo khi người dùng thử đăng nhập và lưu trong nhật ký hệ thống.
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Actions Footer */}
              <div style={{
                marginTop: '24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid #e2e8f0',
                paddingTop: '18px'
              }}>
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  style={{
                    background: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    borderRadius: '8px',
                    color: '#475569',
                    padding: '10px 20px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#e2e8f0')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = '#f1f5f9')}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || (!editFormData.is_active && !editFormData.lock_reason.trim())}
                  style={{
                    background: (!editFormData.is_active && !editFormData.lock_reason.trim())
                      ? '#94a3b8'
                      : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 24px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: (isSubmittingEdit || (!editFormData.is_active && !editFormData.lock_reason.trim()))
                      ? 'not-allowed'
                      : 'pointer',
                    boxShadow: (!editFormData.is_active && !editFormData.lock_reason.trim())
                      ? 'none'
                      : '0 2px 6px rgba(37, 99, 235, 0.35)',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {isSubmittingEdit ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 3 (Giữa màn hình): Xác Nhận Xóa Người Dùng (Thay cho window.confirm) */}
      {userToDelete && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #fee2e2',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            color: '#0f172a',
            textAlign: 'center',
            padding: '32px 28px',
            animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Warning Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fee2e2',
              border: '2px solid #fecaca',
              color: '#dc2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 18px',
            }}>
              ⚠️
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 10px', color: '#0f172a' }}>
              Xác Nhận Xóa Tài Khoản?
            </h3>

            <p style={{ fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 18px' }}>
              Bạn có chắc chắn muốn xóa tài khoản <strong style={{ color: '#b91c1c' }}>"{userToDelete.full_name}"</strong> (@{userToDelete.username}) khỏi hệ thống?
            </p>

            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#64748b',
              textAlign: 'left',
              lineHeight: '1.6'
            }}>
              <div>• Vai trò: <strong style={{ color: userToDelete.badge_color }}>{userToDelete.role_title}</strong></div>
              <div>• Địa bàn: <strong style={{ color: '#0f172a' }}>{userToDelete.branch}</strong></div>
              <div style={{ color: '#dc2626', marginTop: '4px', fontWeight: '500' }}>
                ⚠️ Dữ liệu tài khoản này sẽ bị xóa khỏi cơ sở dữ liệu và không thể hoàn tác.
              </div>
            </div>

            {deleteModalError && (
              <div style={{
                background: '#fee2e2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                padding: '10px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                marginBottom: '16px'
              }}>
                ⚠️ {deleteModalError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setUserToDelete(null)}
                disabled={isDeleting}
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  padding: '10px 20px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#ffffff',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 2px 6px rgba(220, 38, 38, 0.3)'
                }}
              >
                {isDeleting ? 'Đang xóa...' : 'Xác Nhận Xóa'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP 4 (Giữa màn hình): Quản lý & Bàn Giao Đại Lý Cần Chuyển Giao (AC 3) */}
      {handoverUser && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(6px)',
          WebkitBackdropFilter: 'blur(6px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
          padding: '20px'
        }}>
          <div style={{
            background: '#ffffff',
            border: '1px solid #fde68a',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '640px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            overflow: 'hidden',
            animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px',
              borderBottom: '1px solid #fef3c7',
              background: '#fffbeb'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#92400e' }}>
                    Bàn Giao Đại Lý - {handoverUser.full_name}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#b45309', margin: '2px 0 0' }}>
                    Nhân viên @{handoverUser.username} đang bị khóa tài khoản
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHandoverUser(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontSize: '20px',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Banner cảnh báo AC 3 */}
              <div style={{
                background: '#fffbeb',
                border: '1px solid #fde68a',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>🚨</span>
                <div style={{ fontSize: '13px', color: '#92400e', lineHeight: '1.5' }}>
                  <strong>Cảnh báo bàn giao phụ trách:</strong> Nhân viên phụ trách đã bị khóa tài khoản. Toàn bộ tính năng lên đơn hàng mới cho các đại lý này sẽ bị <strong>chặn hoàn toàn</strong> cho đến khi được bàn giao cho nhân viên mới còn hoạt động.
                  {handoverUser.lock_reason && (
                    <div style={{ marginTop: '6px', color: '#78350f', fontStyle: 'italic' }}>
                      "Lý do khóa: {handoverUser.lock_reason}"
                    </div>
                  )}
                </div>
              </div>

              {/* Danh sách đại lý */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#0f172a', marginBottom: '10px' }}>
                  Danh sách đại lý cần bàn giao ({handoverDealers.length})
                </h4>

                {isLoadingDealers ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#64748b', fontSize: '13px' }}>
                    Đang tải danh sách đại lý...
                  </div>
                ) : handoverDealers.length === 0 ? (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    background: '#f8fafc',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    color: '#64748b',
                    fontSize: '13px'
                  }}>
                    Nhân viên này hiện không phụ trách đại lý nào.
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {handoverDealers.map((d: DealerItem) => (
                      <div
                        key={d.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#0f172a', fontSize: '13.5px' }}>
                            {d.name} <span style={{ color: '#0284c7', fontSize: '12px' }}>({d.code})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            📞 {d.phone || 'Chưa có SĐT'} • 📍 {d.address || 'Chưa có địa chỉ'}
                          </div>
                        </div>
                        <span style={{
                          background: '#fee2e2',
                          border: '1px solid #fecaca',
                          color: '#b91c1c',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '700',
                          flexShrink: 0
                        }}>
                          Cần bàn giao
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Form chọn nhân viên bàn giao mới (TC-01) */}
              {handoverDealers.length > 0 && (() => {
                const eligibleSalesStaff = users.filter((u) => {
                  if (!u.is_active || u.status === 'LOCKED' || u.username.toLowerCase() === handoverUser.username.toLowerCase()) {
                    return false;
                  }
                  const userRoles = u.roles && u.roles.length > 0 ? u.roles : [u.role];
                  if (!userRoles.some((r) => SALES_ROLES.includes(r))) {
                    return false;
                  }
                  const matchesAllDealers = handoverDealers.every((d) =>
                    checkRegionMatch(u.branch || '', d.address || '', handoverUser.branch || '')
                  );
                  return matchesAllDealers;
                });


                return (
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '14px 16px',
                  }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#334155', marginBottom: '8px' }}>
                      Chọn nhân viên phụ trách mới tiếp nhận <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    {eligibleSalesStaff.length === 0 ? (
                      <div style={{
                        padding: '12px 14px',
                        background: '#fef2f2',
                        border: '1px solid #fecaca',
                        borderRadius: '8px',
                        color: '#b91c1c',
                        fontSize: '13px',
                      }}>
                        ⚠️ Không tìm thấy nhân sự Bán hàng / Kinh doanh nào phù hợp với địa bàn của các đại lý trên.
                      </div>
                    ) : (
                      <select
                        value={targetSaleUsername}
                        onChange={(e) => setTargetSaleUsername(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid #cbd5e1',
                          background: '#ffffff',
                          color: '#0f172a',
                          fontSize: '13.5px',
                          boxSizing: 'border-box',
                          cursor: 'pointer'
                        }}
                      >
                        {eligibleSalesStaff.map((u) => (
                          <option key={u.username} value={u.username}>
                            👤 {u.full_name} (@{u.username}) - {u.role_title} ({u.branch})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })()}


              {handoverModalError && (
                <div style={{
                  background: '#fee2e2',
                  border: '1px solid #fecaca',
                  color: '#b91c1c',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  marginTop: '14px'
                }}>
                  ⚠️ {handoverModalError}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#f8fafc'
            }}>
              <button
                type="button"
                onClick={() => setHandoverUser(null)}
                disabled={isSubmittingHandover}
                style={{
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#475569',
                  padding: '10px 18px',
                  fontSize: '13.5px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Đóng
              </button>
              {handoverDealers.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmHandover}
                  disabled={isSubmittingHandover || !targetSaleUsername}
                  style={{
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 22px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: (isSubmittingHandover || !targetSaleUsername) ? 'not-allowed' : 'pointer',
                    boxShadow: '0 2px 6px rgba(217, 119, 6, 0.3)'
                  }}
                >
                  {isSubmittingHandover ? 'Đang bàn giao...' : 'Xác Nhận Bàn Giao Ngay'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
