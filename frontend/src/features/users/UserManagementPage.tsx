import { FormEvent, useEffect, useState } from 'react';
import { createUser, deleteUser, getUsers, ManagedUser, UserInput, UserRole, updateUser } from '../../services/users';
import './users.css';

const emptyForm: UserInput = { full_name: '', email: '', phone: '', role: 'sales', territory: '' };
const phonePattern = /^(0|\+84)(3|5|7|8|9)\d{8}$/;
const gmailPattern = /^[a-zA-Z0-9._%+-]+@gmail\.com$/i;

function UserModal({ token, user, onClose, onSaved }: { token: string; user: ManagedUser | null; onClose: () => void; onSaved: (message: string) => void }) {
  const [form, setForm] = useState<UserInput>(user ? { full_name: user.full_name, email: user.email, phone: user.phone, role: user.role, territory: user.territory } : emptyForm);
  const [active, setActive] = useState(user?.is_active ?? true);
  const [error, setError] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true); setError('');
    try {
      if (!phonePattern.test(form.phone.trim())) {
        setError('Số điện thoại không đúng định dạng Việt Nam, ví dụ 0901234567.');
        setSaving(false);
        return;
      }
      if (!gmailPattern.test(form.email.trim())) {
        setError('Email phải có định dạng @gmail.com.');
        setSaving(false);
        return;
      }
      if (user) {
        await updateUser(token, user.id, { ...form, is_active: active });
        onSaved('Đã cập nhật tài khoản.');
      } else {
        const result = await createUser(token, form);
        setTemporaryPassword(result.temporary_password);
        onSaved(`Đã tạo tài khoản ${result.user.username}. Sự kiện gửi email kích hoạt đã được ghi nhận.`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Không thể lưu tài khoản.');
    } finally { setSaving(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
    <section className="modal" role="dialog" aria-modal="true" aria-labelledby="user-modal-title" onMouseDown={(event) => event.stopPropagation()}>
      <div className="modal-heading"><div><span className="eyebrow">TÀI KHOẢN</span><h2 id="user-modal-title">{user ? 'Sửa tài khoản' : 'Tạo tài khoản mới'}</h2></div><button className="icon-button" onClick={onClose} aria-label="Đóng">×</button></div>
      <form onSubmit={submit} className="user-form">
        <label>Họ và tên<input required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></label>
        <label>Email<input required type="email" pattern="[a-zA-Z0-9._%+-]+@gmail\.com" placeholder="ten@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
        <label>Số điện thoại<input required inputMode="tel" pattern="(0|\+84)(3|5|7|8|9)[0-9]{8}" placeholder="0901234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
        <label>Vai trò<select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}><option value="sales">Bán hàng</option><option value="warehouse">Kho</option></select></label>
        <label>Địa bàn / Kho<input required value={form.territory} onChange={(e) => setForm({ ...form, territory: e.target.value })} /></label>
        {user && <label className="checkbox-label"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Tài khoản đang hoạt động</label>}
        {error && <p className="form-error" role="alert">{error}</p>}
        {temporaryPassword && <div className="temporary-password"><strong>Mật khẩu tạm:</strong> {temporaryPassword}<small>Gửi thông tin này qua kênh bảo mật cho người dùng.</small></div>}
        <div className="modal-actions"><button type="button" className="button-secondary" onClick={onClose}>Đóng</button><button type="submit" disabled={saving}>{saving ? 'Đang lưu...' : user ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button></div>
      </form>
    </section>
  </div>;
}

export default function UserManagementPage({ token, onLogout, onBack }: { token: string; onLogout: () => void | Promise<void>; onBack: () => void }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [isActive, setIsActive] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    try { const result = await getUsers(token, { search, role, isActive, page }); setUsers(result.items); setTotal(result.total); setTotalPages(result.total_pages); setError(''); }
    catch (loadError) { setError(loadError instanceof Error ? loadError.message : 'Không thể tải danh sách tài khoản.'); }
  }
  useEffect(() => { void load(); }, [search, role, isActive, page, token]);

  function saved(message: string) { setCreating(false); setEditing(null); setNotice(message); void load(); }

  async function remove(user: ManagedUser) {
    if (!window.confirm(`Xóa tài khoản ${user.full_name}? Thao tác này không thể hoàn tác.`)) return;
    setDeletingId(user.id);
    setError('');
    try {
      await deleteUser(token, user.id);
      setNotice(`Đã xóa tài khoản ${user.username}.`);
      await load();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Không thể xóa tài khoản.');
    } finally {
      setDeletingId(null);
    }
  }

  return <main className="users-page">
    <header className="page-header"><div><span className="eyebrow">HỆ THỐNG / QUẢN TRỊ</span><h1>Quản lý tài khoản</h1><p>Kiểm soát người dùng, vai trò và phạm vi phụ trách.</p></div><div><button className="button-secondary" onClick={onBack}>Quay lại</button><button className="button-secondary" onClick={() => void onLogout()}>Đăng xuất</button><button onClick={() => setCreating(true)}>＋ Tạo tài khoản</button></div></header>
    {notice && <div className="notice" role="status">{notice}</div>}
    <section className="account-summary" aria-label="Tổng quan tài khoản"><div><strong>{total}</strong><span>Tổng tài khoản</span></div><div><strong>{users.filter((user) => user.is_active).length}</strong><span>Đang hoạt động</span></div><div><strong>{users.filter((user) => user.role === 'sales').length}</strong><span>Bán hàng</span></div><div><strong>{users.filter((user) => user.role === 'warehouse').length}</strong><span>Kho</span></div></section>
    <section className="users-toolbar"><input aria-label="Tìm kiếm tài khoản" placeholder="Tìm theo tên, tài khoản, email, số điện thoại..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} /><select aria-label="Lọc vai trò" value={role} onChange={(e) => { setRole(e.target.value); setPage(1); }}><option value="">Tất cả vai trò</option><option value="admin">Quản trị viên</option><option value="sales">Bán hàng</option><option value="warehouse">Kho</option></select><select aria-label="Lọc trạng thái" value={isActive} onChange={(e) => { setIsActive(e.target.value); setPage(1); }}><option value="">Tất cả trạng thái</option><option value="true">Hoạt động</option><option value="false">Bị khóa</option></select></section>
    {error ? <div className="inline-error" role="alert">{error}</div> : <section className="table-shell"><table><thead><tr><th>Người dùng</th><th>Liên hệ</th><th>Vai trò</th><th>Địa bàn / Kho</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><strong>{user.full_name}</strong><small>@{user.username}</small></td><td>{user.email}<small>{user.phone}</small></td><td><span className={`role role-${user.role}`}>{user.role === 'sales' ? 'Bán hàng' : user.role === 'warehouse' ? 'Kho' : 'Quản trị viên'}</span></td><td>{user.territory}</td><td><span className={user.is_active ? 'status-active' : 'status-inactive'}>{user.is_active ? 'Hoạt động' : 'Bị khóa'}</span></td><td className="row-actions"><button className="text-button" onClick={() => setEditing(user)}>Sửa</button><button className="delete-button" disabled={deletingId === user.id} onClick={() => void remove(user)}>{deletingId === user.id ? 'Đang xóa...' : 'Xóa'}</button></td></tr>)}</tbody></table>{users.length === 0 && <div className="empty">Chưa có tài khoản phù hợp.</div>}<footer className="pagination"><span>{total} tài khoản</span><div><button disabled={page <= 1} onClick={() => setPage(page - 1)}>←</button><span>Trang {page} / {totalPages}</span><button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>→</button></div></footer></section>}
    {(creating || editing) && <UserModal token={token} user={editing} onClose={() => { setCreating(false); setEditing(null); }} onSaved={saved} />}
  </main>;
}
