// frontend/src/components/UserManagementView.tsx
import React, { useState, useEffect } from 'react';
import {
  User,
  UserAccount,
  getUsersApi,
  createUserApi,
  updateUserApi,
  deleteUserApi,
  getUserDealersApi,
  handoverDealersApi,
  DealerItem,
  UserCreatePayload,
  UserUpdatePayload,
} from '../services/api';

interface UserManagementViewProps {
  currentUser: User;
  token: string;
  onBackToHome?: () => void;
}

const ROLES_LIST = [
  {
    role: 'admin',
    title: 'Quản trị hệ thống',
    badgeColor: '#ef4444',
    description: 'Toàn quyền cấu hình, quản trị tài khoản, tạo admin mới và giám sát hệ thống.',
    costPerm: true,
    invPerm: true,
  },
  {
    role: 'sales_manager',
    title: 'Quản lý kinh doanh',
    badgeColor: '#8b5cf6',
    description: 'Quản lý bán hàng, xem báo cáo doanh thu, giá vốn và biên lợi nhuận.',
    costPerm: true,
    invPerm: false,
  },
  {
    role: 'sales',
    title: 'Nhân viên kinh doanh',
    badgeColor: '#3b82f6',
    description: 'Tạo đơn hàng, tra cứu tồn kho bán hàng. Không xem giá vốn và không sửa kho.',
    costPerm: false,
    invPerm: false,
  },
  {
    role: 'warehouse',
    title: 'Thủ kho',
    badgeColor: '#10b981',
    description: 'Thực hiện nhập, xuất, điều chỉnh kho. Tuyệt đối không xem giá vốn & lợi nhuận.',
    costPerm: false,
    invPerm: true,
  },
  {
    role: 'warehouse_manager',
    title: 'Quản lý kho',
    badgeColor: '#059669',
    description: 'Giám sát điều phối hàng hóa kho vận, duyệt phiếu. Không xem giá vốn.',
    costPerm: false,
    invPerm: true,
  },
  {
    role: 'accountant',
    title: 'Kế toán',
    badgeColor: '#f59e0b',
    description: 'Đối soát hóa đơn, chứng từ doanh thu và chi phí đơn hàng.',
    costPerm: false,
    invPerm: false,
  },
  {
    role: 'purchasing',
    title: 'Nhân viên mua hàng',
    badgeColor: '#06b6d4',
    description: 'Lập phiếu mua hàng, theo dõi đơn nhập hàng từ nhà cung cấp.',
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

export const UserManagementView: React.FC<UserManagementViewProps> = ({
  currentUser,
  token,
  onBackToHome,
}) => {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Filter & Search
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedRoleFilter, setSelectedRoleFilter] = useState<string>('all');

  // Modal Create State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState<boolean>(false);
  const [createModalError, setCreateModalError] = useState<string | null>(null);
  const [createFormData, setCreateFormData] = useState<UserCreatePayload>({
    full_name: '',
    username: '',
    email: '',
    password: '',
    role: 'sales',
    branch: 'Kho Tổng Hà Nội',
  });

  // Modal Edit State
  const [userToEdit, setUserToEdit] = useState<UserAccount | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState<boolean>(false);
  const [editModalError, setEditModalError] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    full_name: string;
    email: string;
    role: string;
    branch: string;
    password: string;
    is_active: boolean;
    lock_reason: string;
  }>({
    full_name: '',
    email: '',
    role: 'sales',
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
  }, [token]);

  // Tự động ẩn thông báo thành công sau 5 giây
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => {
      setSuccessMessage(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Handle create form change
  const handleCreateChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setCreateFormData((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'email' && (!prev.username || prev.username === prev.email.split('@')[0])) {
        updated.username = value.split('@')[0].toLowerCase().replace(/[^a-z0-9_\-\.]/g, '');
      }
      return updated;
    });
  };

  // Submit create user
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateModalError(null);

    if (!createFormData.full_name.trim()) {
      setCreateModalError('Vui lòng nhập Họ và tên.');
      return;
    }
    if (!createFormData.email.trim()) {
      setCreateModalError('Vui lòng nhập địa chỉ Email.');
      return;
    }
    if (!createFormData.password.trim() || createFormData.password.length < 3) {
      setCreateModalError('Mật khẩu phải có tối thiểu 3 ký tự.');
      return;
    }

    setIsSubmittingCreate(true);
    try {
      const created = await createUserApi(token, {
        full_name: createFormData.full_name.trim(),
        username: createFormData.username?.trim() || undefined,
        email: createFormData.email.trim(),
        password: createFormData.password,
        role: createFormData.role,
        branch: createFormData.branch,
      });

      setSuccessMessage(
        `✅ Đã tạo tài khoản "${created.username}" (${created.full_name}) với vai trò "${created.role_title}". Tài khoản đã lưu vào DB và có thể đăng nhập ngay!`
      );
      setIsCreateModalOpen(false);
      setCreateFormData({
        full_name: '',
        username: '',
        email: '',
        password: '',
        role: 'sales',
        branch: 'Kho Tổng Hà Nội',
      });
      loadUsers();
    } catch (err: any) {
      setCreateModalError(err.message || 'Lỗi khi tạo người dùng.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (targetUser: UserAccount) => {
    setUserToEdit(targetUser);
    setEditModalError(null);
    setEditFormData({
      full_name: targetUser.full_name,
      email: targetUser.email || '',
      role: targetUser.role,
      branch: targetUser.branch || 'Kho Tổng Hà Nội',
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

    if (isEditingSelf && editFormData.role !== 'admin') {
      setEditModalError('Bảo vệ hệ thống: Không được tự hạ quyền Admin của chính mình!');
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
        role: editFormData.role,
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

    // Tìm default nhân viên mới (khác user này, đang active)
    const activeStaff = users.filter((u) => u.username.toLowerCase() !== targetUser.username.toLowerCase() && u.is_active && u.status !== 'LOCKED');
    if (activeStaff.length > 0) {
      setTargetSaleUsername(activeStaff[0].username);
    } else {
      setTargetSaleUsername('');
    }

    try {
      const data = await getUserDealersApi(token, targetUser.username);
      setHandoverDealers(data.dealers);
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

  // Filtered users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (u.email && u.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (u.branch && u.branch.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole =
      selectedRoleFilter === 'all' || u.role === selectedRoleFilter;

    return matchesSearch && matchesRole;
  });

  const selectedCreateRoleMeta = ROLES_LIST.find((r) => r.role === createFormData.role) || ROLES_LIST[0];

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
          color: '#94a3b8',
          fontWeight: '500',
          padding: '2px 4px',
        }}
      >
        <button
          onClick={onBackToHome}
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
            boxShadow: '0 3px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            backdropFilter: 'blur(8px)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(30, 41, 59, 0.95))';
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.7)';
            e.currentTarget.style.color = '#7dd3fc';
            e.currentTarget.style.boxShadow = '0 6px 16px rgba(56, 189, 248, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.2)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.background = 'linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95))';
            e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
            e.currentTarget.style.color = '#38bdf8';
            e.currentTarget.style.boxShadow = '0 3px 10px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)';
          }}
          onMouseDown={(e) => {
            e.currentTarget.style.transform = 'translateY(0) scale(0.96)';
          }}
          onMouseUp={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
            <polyline points="9 22 9 12 15 12 15 22" />
          </svg>
          <span>Trang chủ</span>
        </button>
        <span style={{ color: '#475569', fontSize: '14px' }}>/</span>
        <span style={{ color: '#f8fafc', fontWeight: '600', fontSize: '13.5px' }}>Quản lý người dùng</span>
      </nav>

      {/* 2. Tiêu đề: Quản Lý Phân Quyền Vai Trò */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.95))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '16px',
        padding: '24px 28px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '24px' }}>👥</span>
            <h2 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#f8fafc', letterSpacing: '-0.02em' }}>
              Phân Quyền Vai Trò Hệ Thống (RBAC)
            </h2>
            <span style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '999px',
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: '700'
            }}>
              Khu vực Quản trị viên
            </span>
          </div>
          <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px', maxWidth: '680px', lineHeight: '1.5' }}>
            Quản lý và gán vai trò theo 7 nhóm nghiệp vụ, giám sát quyền xem giá vốn và quyền can thiệp kho của nhân viên theo chính sách Zero-Trust.
          </p>
        </div>
      </div>

      {/* Success Notification Alert (Auto dismiss after 5s) */}
      {successMessage && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          color: '#6ee7b7',
          padding: '14px 18px',
          borderRadius: '12px',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
        }}>
          <div>{successMessage}</div>
          <button
            onClick={() => setSuccessMessage(null)}
            style={{ background: 'none', border: 'none', color: '#6ee7b7', cursor: 'pointer', fontSize: '16px' }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.15)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          color: '#fca5a5',
          padding: '14px 18px',
          borderRadius: '12px',
          fontSize: '14px',
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* 3. Filter Bar: [ Tìm theo tên, email... ]  [ Lọc theo vai trò (v) ]  [ 🔄 Làm mới ] */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '14px',
        padding: '16px 20px',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px'
      }}>
        {/* Search Input */}
        <div style={{ position: 'relative', minWidth: '280px', flex: '1' }}>
          <span style={{ position: 'absolute', left: '14px', top: '10px', color: '#64748b' }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Tìm theo tên, email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px 10px 40px',
              borderRadius: '10px',
              border: '1px solid #475569',
              background: '#0f172a',
              color: '#f8fafc',
              fontSize: '14px',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {/* Right side controls: Role filter + Refresh button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13.5px', color: '#94a3b8', fontWeight: '500' }}>Lọc theo vai trò:</label>
            <select
              value={selectedRoleFilter}
              onChange={(e) => setSelectedRoleFilter(e.target.value)}
              style={{
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid #475569',
                background: '#0f172a',
                color: '#f8fafc',
                fontSize: '13.5px',
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

          <button
            onClick={loadUsers}
            style={{
              background: '#334155',
              border: '1px solid #475569',
              borderRadius: '10px',
              color: '#f8fafc',
              padding: '10px 16px',
              fontSize: '13.5px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#475569')}
            onMouseLeave={(e) => (e.currentTarget.style.background = '#334155')}
            title="Làm mới danh sách"
          >
            🔄 Làm mới
          </button>
        </div>
      </div>

      {/* 4. Users Table */}
      <div style={{
        background: '#1e293b',
        border: '1px solid #334155',
        borderRadius: '16px',
        padding: '20px 24px',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.2)',
        overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
              Danh Sách Nhân Viên & Tài Khoản ({filteredUsers.length})
            </h2>
            <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
              Dữ liệu người dùng được lưu trữ trong Backend và kiểm soát phiên làm việc theo Zero-Trust.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
            Đang tải danh sách người dùng...
          </div>
        ) : filteredUsers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>
            Không tìm thấy người dùng nào phù hợp với bộ lọc.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px', textAlign: 'left' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #334155', color: '#94a3b8' }}>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>ID</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Họ và tên / Tài khoản</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Email</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Vai trò hệ thống</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Kho / Địa bàn</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Trạng thái</th>
                <th style={{ padding: '12px 14px', fontWeight: '600' }}>Quyền hạn cốt lõi</th>
                <th style={{ padding: '12px 14px', fontWeight: '600', textAlign: 'center' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u, idx) => {
                const isCurrentSelf = (u.username.toLowerCase() === currentUser.username.toLowerCase());
                const isDropdownOpen = activeDropdownUserId === u.id;
                return (
                  <tr
                    key={u.id}
                    style={{
                      borderBottom: '1px solid rgba(51, 65, 85, 0.6)',
                      background: isDropdownOpen
                        ? 'rgba(30, 41, 59, 0.8)'
                        : idx % 2 === 0 ? 'transparent' : 'rgba(15, 23, 42, 0.25)',
                      position: 'relative',
                      zIndex: isDropdownOpen ? 30 : 1,
                    }}
                  >
                    <td style={{ padding: '14px', color: '#64748b', fontWeight: '600' }}>
                      #{u.id}
                    </td>

                    {/* Họ tên + Avatar */}
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '36px',
                          height: '36px',
                          borderRadius: '50%',
                          background: u.badge_color || '#64748b',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '700',
                          fontSize: '15px',
                          flexShrink: 0
                        }}>
                          {u.full_name ? u.full_name.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: '600', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {u.full_name}
                            {isCurrentSelf && (
                              <span style={{
                                background: 'rgba(99, 102, 241, 0.2)',
                                color: '#a5b4fc',
                                border: '1px solid rgba(99, 102, 241, 0.4)',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: '600'
                              }}>
                                Tài khoản của bạn
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12.5px', color: '#94a3b8' }}>
                            @{u.username}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '14px', color: '#cbd5e1' }}>
                      {u.email || <span style={{ color: '#64748b' }}>Chưa có</span>}
                    </td>

                    {/* Vai trò */}
                    <td style={{ padding: '14px' }}>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '4px 10px',
                        borderRadius: '8px',
                        background: `${u.badge_color}22`,
                        color: u.badge_color,
                        fontWeight: '700',
                        fontSize: '12.5px',
                        border: `1px solid ${u.badge_color}44`
                      }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.badge_color }}></span>
                        {u.role_title}
                      </span>
                    </td>

                    {/* Kho / Địa bàn */}
                    <td style={{ padding: '14px', color: '#e2e8f0', fontSize: '13px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        📍 {u.branch || 'Kho Tổng Hà Nội'}
                      </span>
                    </td>

                    {/* Trạng thái & Cảnh báo bàn giao */}
                    <td style={{ padding: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-start' }}>
                        {u.is_active && u.status !== 'LOCKED' ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#34d399',
                            fontSize: '12.5px',
                            fontWeight: '600'
                          }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#34d399' }}></span>
                            Hoạt động
                          </span>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              color: '#f87171',
                              fontSize: '12.5px',
                              fontWeight: '600'
                            }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#f87171' }}></span>
                              Đã khóa
                            </span>
                            {u.lock_reason && (
                              <span
                                title={u.lock_reason}
                                style={{
                                  fontSize: '11px',
                                  color: '#94a3b8',
                                  maxWidth: '160px',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  cursor: 'help'
                                }}
                              >
                                💬 {u.lock_reason}
                              </span>
                            )}
                          </div>
                        )}

                        {/* AC 3: Cảnh báo bàn giao đại lý */}
                        {u.dealers_needing_handover > 0 && (
                          <button
                            type="button"
                            onClick={() => openHandoverModal(u)}
                            title={`Có ${u.dealers_needing_handover} đại lý cần bàn giao gấp sang nhân viên mới`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              background: 'rgba(245, 158, 11, 0.15)',
                              border: '1px solid rgba(245, 158, 11, 0.4)',
                              color: '#fbbf24',
                              padding: '2px 8px',
                              borderRadius: '6px',
                              fontSize: '11.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              animation: 'pulse 2s infinite',
                            }}
                          >
                            ⚠️ Có {u.dealers_needing_handover} đại lý cần bàn giao
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Quyền hạn cốt lõi */}
                    <td style={{ padding: '14px', fontSize: '12.5px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span style={{ color: u.can_view_cost ? '#10b981' : '#64748b' }}>
                          {u.can_view_cost ? '✓ Xem giá vốn & lãi' : '✕ Bị chặn xem giá vốn'}
                        </span>
                        <span style={{ color: u.can_write_inventory ? '#38bdf8' : '#64748b' }}>
                          {u.can_write_inventory ? '✓ Nhập/xuất/sửa kho' : '✕ Bị chặn can thiệp kho'}
                        </span>
                      </div>
                    </td>

                    {/* Thao tác (Nút 3 chấm) */}
                    <td style={{ padding: '14px', textAlign: 'center', position: 'relative' }}>
                      <div className="user-action-dropdown-container" style={{ position: 'relative', display: 'inline-block' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveDropdownUserId((prev) => (prev === u.id ? null : u.id));
                          }}
                          title="Tùy chọn thao tác"
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '10px',
                            border: activeDropdownUserId === u.id
                              ? '1px solid rgba(99, 102, 241, 0.7)'
                              : '1px solid rgba(255, 255, 255, 0.15)',
                            background: activeDropdownUserId === u.id
                              ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.35), rgba(168, 85, 247, 0.3))'
                              : 'rgba(30, 41, 59, 0.85)',
                            backdropFilter: 'blur(8px)',
                            color: activeDropdownUserId === u.id ? '#a5b4fc' : '#cbd5e1',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: activeDropdownUserId === u.id
                              ? '0 0 16px rgba(99, 102, 241, 0.4)'
                              : '0 2px 8px rgba(0, 0, 0, 0.25)',
                          }}
                          onMouseEnter={(e) => {
                            if (activeDropdownUserId !== u.id) {
                              e.currentTarget.style.background = 'rgba(51, 65, 85, 0.95)';
                              e.currentTarget.style.color = '#ffffff';
                              e.currentTarget.style.borderColor = 'rgba(129, 140, 248, 0.5)';
                              e.currentTarget.style.transform = 'scale(1.06)';
                              e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.35)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (activeDropdownUserId !== u.id) {
                              e.currentTarget.style.background = 'rgba(30, 41, 59, 0.85)';
                              e.currentTarget.style.color = '#cbd5e1';
                              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                              e.currentTarget.style.transform = 'scale(1)';
                              e.currentTarget.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.25)';
                            }
                          }}
                        >
                          <span
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '3.5px',
                              pointerEvents: 'none',
                            }}
                          >
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                            <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: 'currentColor', display: 'block' }} />
                          </span>
                        </button>

                        {/* Menu thả xuống */}
                        {activeDropdownUserId === u.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 'calc(100% + 6px)',
                              background: '#1e293b',
                              border: '1px solid #475569',
                              borderRadius: '10px',
                              boxShadow: '0 12px 28px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 0, 0, 0.3)',
                              minWidth: '175px',
                              zIndex: 100,
                              padding: '6px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '4px',
                              textAlign: 'left',
                              animation: 'fadeIn 0.15s ease-out',
                            }}
                          >
                            {/* Nút Phân vai trò & Kho/Địa bàn */}
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
                                padding: '8px 12px',
                                borderRadius: '6px',
                                border: 'none',
                                background: 'transparent',
                                color: '#e2e8f0',
                                fontSize: '13px',
                                fontWeight: '500',
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)';
                                e.currentTarget.style.color = '#a5b4fc';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = 'transparent';
                                e.currentTarget.style.color = '#e2e8f0';
                              }}
                            >
                              <span style={{ fontSize: '15px' }}>🛡️</span>
                              <span>Phân vai trò & Kho/Địa bàn</span>
                            </button>

                            {/* Nút Bàn giao đại lý (nếu có đại lý cần bàn giao) */}
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
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'rgba(245, 158, 11, 0.1)',
                                  color: '#fbbf24',
                                  fontSize: '13px',
                                  fontWeight: '600',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.25)';
                                  e.currentTarget.style.color = '#fde68a';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.1)';
                                  e.currentTarget.style.color = '#fbbf24';
                                }}
                              >
                                <span style={{ fontSize: '15px' }}>🔄</span>
                                <span>Bàn giao đại lý ({u.dealers_needing_handover})</span>
                              </button>
                            )}

                            {/* Đường kẻ phân cách */}
                            <div style={{ height: '1px', background: '#334155', margin: '2px 0' }} />

                            {/* Nút Xóa hoặc Không thể xóa */}
                            {isCurrentSelf ? (
                              <div
                                title="Không được tự xóa tài khoản Admin của chính mình"
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '10px',
                                  width: '100%',
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  color: '#64748b',
                                  fontSize: '13px',
                                  cursor: 'not-allowed',
                                  boxSizing: 'border-box'
                                }}
                              >
                                <span style={{ fontSize: '15px' }}>🔒</span>
                                <span>Không thể xóa</span>
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
                                  padding: '8px 12px',
                                  borderRadius: '6px',
                                  border: 'none',
                                  background: 'transparent',
                                  color: '#f87171',
                                  fontSize: '13px',
                                  fontWeight: '500',
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                                  e.currentTarget.style.color = '#fca5a5';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = '#f87171';
                                }}
                              >
                                <span style={{ fontSize: '15px' }}>🗑️</span>
                                <span>Xóa tài khoản</span>
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* POPUP 1 (Giữa màn hình): Thêm người dùng mới */}
      {isCreateModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(11, 17, 32, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            color: '#f8fafc',
          }}>
            {/* Header Modal */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>✨</span>
                <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                  Thêm Người Dùng Mới
                </h3>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Create */}
            <form onSubmit={handleCreateUser} style={{ padding: '24px' }}>
              {createModalError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}>
                  ⚠️ {createModalError}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Họ và tên */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="full_name"
                    required
                    placeholder="Ví dụ: Nguyễn Văn An"
                    value={createFormData.full_name}
                    onChange={handleCreateChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Email và Tên đăng nhập */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                      Email <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="an.nguyen@congty.vn"
                      value={createFormData.email}
                      onChange={handleCreateChange}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #475569',
                        background: '#0f172a',
                        color: '#f8fafc',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                      Tên đăng nhập (Username)
                    </label>
                    <input
                      type="text"
                      name="username"
                      placeholder="an.nguyen (tự động)"
                      value={createFormData.username}
                      onChange={handleCreateChange}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #475569',
                        background: '#0f172a',
                        color: '#f8fafc',
                        fontSize: '14px',
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                </div>

                {/* Mật khẩu khởi tạo */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Mật khẩu đăng nhập ban đầu <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    placeholder="Nhập mật khẩu (tối thiểu 3 ký tự, ví dụ: 123)"
                    value={createFormData.password}
                    onChange={handleCreateChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                    💡 Người dùng có thể đăng nhập bằng Username hoặc Email và tự đổi mật khẩu sau.
                  </span>
                </div>

                {/* Dropdown Vai trò (Trong 7 vai trò hệ thống) */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Vai trò hệ thống (7 vai trò RBAC) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="role"
                    value={createFormData.role}
                    onChange={handleCreateChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.title} ({r.role}) {r.role === 'admin' ? '— Có toàn quyền hệ thống' : ''}
                      </option>
                    ))}
                  </select>

                  {/* Role summary card */}
                  <div style={{
                    marginTop: '8px',
                    padding: '10px 12px',
                    background: `${selectedCreateRoleMeta.badgeColor}15`,
                    border: `1px solid ${selectedCreateRoleMeta.badgeColor}33`,
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    color: '#e2e8f0',
                    lineHeight: '1.5'
                  }}>
                    <div style={{ fontWeight: '700', color: selectedCreateRoleMeta.badgeColor, marginBottom: '2px' }}>
                      {selectedCreateRoleMeta.title}
                    </div>
                    <div>{selectedCreateRoleMeta.description}</div>
                    <div style={{ marginTop: '4px', display: 'flex', gap: '14px', fontSize: '12px' }}>
                      <span style={{ color: selectedCreateRoleMeta.costPerm ? '#34d399' : '#f87171' }}>
                        {selectedCreateRoleMeta.costPerm ? '✓ Được xem giá vốn' : '✕ Khóa giá vốn'}
                      </span>
                      <span style={{ color: selectedCreateRoleMeta.invPerm ? '#38bdf8' : '#f87171' }}>
                        {selectedCreateRoleMeta.invPerm ? '✓ Có quyền sửa kho' : '✕ Khóa quyền sửa kho'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Kho / Địa bàn phụ trách */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Kho / Địa bàn phụ trách <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    name="branch"
                    value={createFormData.branch}
                    onChange={handleCreateChange}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
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
              </div>

              {/* Actions Footer */}
              <div style={{
                marginTop: '24px',
                display: 'flex',
                justifyContent: 'flex-end',
                gap: '12px',
                borderTop: '1px solid #334155',
                paddingTop: '18px'
              }}>
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  style={{
                    background: '#334155',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    padding: '10px 18px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCreate}
                  id="btn-submit-user"
                  style={{
                    background: 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 22px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: isSubmittingCreate ? 'not-allowed' : 'pointer',
                    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.4)',
                  }}
                >
                  {isSubmittingCreate ? 'Đang lưu vào DB...' : 'Lưu người dùng vào Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* POPUP 2 (Giữa màn hình): Chỉnh sửa thông tin nhân viên */}
      {userToEdit && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(11, 17, 32, 0.82)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '560px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            color: '#f8fafc',
          }}>
            {/* Header Modal Edit */}
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid #334155',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(15, 23, 42, 0.6)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🛡️</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '700', margin: 0 }}>
                    Phân Vai Trò & Kho/Địa Bàn Phụ Trách
                  </h3>
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                    Tài khoản: @{userToEdit.username} (ID: #{userToEdit.id})
                  </span>
                </div>
              </div>
              <button
                onClick={() => setUserToEdit(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Form Edit */}
            <form onSubmit={handleUpdateUser} style={{ padding: '24px' }}>
              {editModalError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}>
                  ⚠️ {editModalError}
                </div>
              )}

              {/* Ràng buộc bảo vệ Admin */}
              {userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() && (
                <div style={{
                  background: 'rgba(245, 158, 11, 0.12)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: '#fde68a',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12.5px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <span>🔒</span>
                  <span><strong>Bảo vệ hệ thống:</strong> Đây là tài khoản Quản trị viên của bạn. Hệ thống nghiêm cấm tự hạ quyền hoặc tự khóa tài khoản của chính mình.</span>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Họ và tên */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Họ và tên <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={editFormData.full_name}
                    onChange={(e) => setEditFormData({ ...editFormData, full_name: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                {/* Email và Username */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                      Email (Cố định)
                    </label>
                    <input
                      type="email"
                      disabled
                      readOnly
                      value={editFormData.email}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#64748b',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#94a3b8', marginBottom: '6px' }}>
                      Tên đăng nhập (Cố định)
                    </label>
                    <input
                      type="text"
                      disabled
                      value={userToEdit.username}
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        border: '1px solid #334155',
                        background: '#1e293b',
                        color: '#64748b',
                        fontSize: '14px',
                        boxSizing: 'border-box',
                        cursor: 'not-allowed'
                      }}
                    />
                  </div>
                </div>


                {/* Vai trò */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Vai trò hệ thống <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={editFormData.role}
                    disabled={userToEdit.username.toLowerCase() === currentUser.username.toLowerCase()}
                    onChange={(e) => setEditFormData({ ...editFormData, role: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() ? '#1e293b' : '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
                      boxSizing: 'border-box',
                      cursor: userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {ROLES_LIST.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.title} ({r.role})
                      </option>
                    ))}
                  </select>

                  </div>

                {/* Kho / Địa bàn phụ trách */}
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Kho / Địa bàn phụ trách <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={editFormData.branch}
                    onChange={(e) => setEditFormData({ ...editFormData, branch: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#0f172a',
                      color: '#f8fafc',
                      fontSize: '14px',
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
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#cbd5e1', marginBottom: '6px' }}>
                    Trạng thái hoạt động
                  </label>
                  <select
                    value={editFormData.is_active ? 'true' : 'false'}
                    disabled={userToEdit.username.toLowerCase() === currentUser.username.toLowerCase()}
                    onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.value === 'true' })}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: userToEdit.username.toLowerCase() === currentUser.username.toLowerCase() ? '#1e293b' : '#0f172a',
                      color: editFormData.is_active ? '#34d399' : '#f87171',
                      fontWeight: '600',
                      fontSize: '14px',
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
                    background: 'rgba(239, 68, 68, 0.08)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    animation: 'fadeIn 0.2s ease-in-out'
                  }}>
                    <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#fca5a5', marginBottom: '6px' }}>
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
                        border: !editFormData.lock_reason.trim() ? '1px solid #ef4444' : '1px solid #475569',
                        background: '#0f172a',
                        color: '#f8fafc',
                        fontSize: '13.5px',
                        boxSizing: 'border-box',
                        resize: 'vertical',
                        outline: 'none',
                        lineHeight: '1.5'
                      }}
                    />
                    {!editFormData.lock_reason.trim() ? (
                      <span style={{ fontSize: '12px', color: '#f87171', display: 'block', marginTop: '4px' }}>
                        ⚠️ Bắt buộc phải nhập lý do khóa để lưu thay đổi.
                      </span>
                    ) : (
                      <span style={{ fontSize: '12px', color: '#94a3b8', display: 'block', marginTop: '4px' }}>
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
                borderTop: '1px solid #334155',
                paddingTop: '18px'
              }}>
                <button
                  type="button"
                  onClick={() => setUserToEdit(null)}
                  style={{
                    background: '#334155',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#e2e8f0',
                    padding: '10px 18px',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    cursor: 'pointer'
                  }}
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingEdit || (!editFormData.is_active && !editFormData.lock_reason.trim())}
                  style={{
                    background: (!editFormData.is_active && !editFormData.lock_reason.trim())
                      ? '#475569'
                      : 'linear-gradient(135deg, #4f46e5, #7c3aed)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#ffffff',
                    padding: '10px 22px',
                    fontSize: '13.5px',
                    fontWeight: '700',
                    cursor: (isSubmittingEdit || (!editFormData.is_active && !editFormData.lock_reason.trim()))
                      ? 'not-allowed'
                      : 'pointer',
                    boxShadow: (!editFormData.is_active && !editFormData.lock_reason.trim())
                      ? 'none'
                      : '0 4px 12px rgba(79, 70, 229, 0.4)',
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
          background: 'rgba(11, 17, 32, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '18px',
            width: '100%',
            maxWidth: '460px',
            boxShadow: '0 25px 60px rgba(0, 0, 0, 0.7), 0 0 30px rgba(239, 68, 68, 0.15)',
            overflow: 'hidden',
            color: '#f8fafc',
            textAlign: 'center',
            padding: '28px 24px',
          }}>
            {/* Warning Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.15)',
              border: '2px solid rgba(239, 68, 68, 0.4)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              margin: '0 auto 18px',
            }}>
              ⚠️
            </div>

            <h3 style={{ fontSize: '20px', fontWeight: '800', margin: '0 0 10px', color: '#f8fafc' }}>
              Xác Nhận Xóa Tài Khoản?
            </h3>

            <p style={{ fontSize: '14px', color: '#cbd5e1', lineHeight: '1.6', margin: '0 0 18px' }}>
              Bạn có chắc chắn muốn xóa tài khoản <strong style={{ color: '#f87171' }}>"{userToDelete.full_name}"</strong> (@{userToDelete.username}) khỏi hệ thống?
            </p>

            <div style={{
              background: '#0f172a',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '20px',
              fontSize: '13px',
              color: '#94a3b8',
              textAlign: 'left',
              lineHeight: '1.6'
            }}>
              <div>• Vai trò: <strong style={{ color: userToDelete.badge_color }}>{userToDelete.role_title}</strong></div>
              <div>• Địa bàn: <strong style={{ color: '#f8fafc' }}>{userToDelete.branch}</strong></div>
              <div style={{ color: '#ef4444', marginTop: '4px' }}>
                ⚠️ Dữ liệu tài khoản này sẽ bị xóa khỏi cơ sở dữ liệu và không thể hoàn tác.
              </div>
            </div>

            {deleteModalError && (
              <div style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
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
                  background: '#334155',
                  border: 'none',
                  borderRadius: '10px',
                  color: '#e2e8f0',
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
                  borderRadius: '10px',
                  color: '#ffffff',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: '700',
                  cursor: isDeleting ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(220, 38, 38, 0.4)'
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
          background: 'rgba(11, 17, 32, 0.85)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: '#1e293b',
            border: '1px solid #f59e0b',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '620px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 20px rgba(245, 158, 11, 0.2)',
            overflow: 'hidden'
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 24px',
              borderBottom: '1px solid #334155',
              background: 'rgba(245, 158, 11, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '22px' }}>⚠️</span>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#fef3c7' }}>
                    Bàn Giao Đại Lý - {handoverUser.full_name}
                  </h3>
                  <p style={{ fontSize: '12.5px', color: '#cbd5e1', margin: '2px 0 0' }}>
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
                background: 'rgba(245, 158, 11, 0.15)',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                borderRadius: '10px',
                padding: '12px 16px',
                marginBottom: '18px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '12px'
              }}>
                <span style={{ fontSize: '20px', flexShrink: 0 }}>🚨</span>
                <div style={{ fontSize: '13px', color: '#fde68a', lineHeight: '1.5' }}>
                  <strong>Cảnh báo bàn giao phụ trách:</strong> Nhân viên phụ trách đã bị khóa tài khoản. Toàn bộ tính năng lên đơn hàng mới cho các đại lý này sẽ bị <strong>chặn hoàn toàn</strong> cho đến khi được bàn giao cho nhân viên mới còn hoạt động.
                  {handoverUser.lock_reason && (
                    <div style={{ marginTop: '6px', color: '#f8fafc', fontStyle: 'italic' }}>
                      "Lý do khóa: {handoverUser.lock_reason}"
                    </div>
                  )}
                </div>
              </div>

              {/* Danh sách đại lý */}
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: '700', color: '#f8fafc', marginBottom: '10px' }}>
                  Danh sách đại lý cần bàn giao ({handoverDealers.length})
                </h4>

                {isLoadingDealers ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#94a3b8', fontSize: '13px' }}>
                    Đang tải danh sách đại lý...
                  </div>
                ) : handoverDealers.length === 0 ? (
                  <div style={{
                    padding: '16px',
                    textAlign: 'center',
                    background: '#0f172a',
                    borderRadius: '8px',
                    color: '#94a3b8',
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
                          background: '#0f172a',
                          border: '1px solid #334155',
                          borderRadius: '8px',
                          padding: '10px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px'
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '13.5px' }}>
                            {d.name} <span style={{ color: '#38bdf8', fontSize: '12px' }}>({d.code})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                            📞 {d.phone || 'Chưa có SĐT'} • 📍 {d.address || 'Chưa có địa chỉ'}
                          </div>
                        </div>
                        <span style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#fca5a5',
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

              {/* Form chọn nhân viên bàn giao mới */}
              {handoverDealers.length > 0 && (
                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '10px',
                  padding: '14px 16px',
                }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '700', color: '#cbd5e1', marginBottom: '8px' }}>
                    Chọn nhân viên phụ trách mới tiếp nhận <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <select
                    value={targetSaleUsername}
                    onChange={(e) => setTargetSaleUsername(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid #475569',
                      background: '#1e293b',
                      color: '#f8fafc',
                      fontSize: '13.5px',
                      boxSizing: 'border-box',
                      cursor: 'pointer'
                    }}
                  >
                    {users
                      .filter((u) => u.username.toLowerCase() !== handoverUser.username.toLowerCase() && u.is_active && u.status !== 'LOCKED')
                      .map((u) => (
                        <option key={u.username} value={u.username}>
                          👤 {u.full_name} (@{u.username}) - {u.role_title} ({u.branch})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {handoverModalError && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  color: '#fca5a5',
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
              borderTop: '1px solid #334155',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              background: '#0f172a'
            }}>
              <button
                type="button"
                onClick={() => setHandoverUser(null)}
                disabled={isSubmittingHandover}
                style={{
                  background: '#334155',
                  border: 'none',
                  borderRadius: '8px',
                  color: '#e2e8f0',
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
                    boxShadow: '0 4px 12px rgba(217, 119, 6, 0.4)'
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
