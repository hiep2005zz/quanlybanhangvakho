import React, { useState } from 'react';
import { CustomerCreatePayload, createCustomerApi } from '../services/api';

interface CreateCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  onSuccess?: (message: string) => void;
}

export const CreateCustomerModal: React.FC<CreateCustomerModalProps> = ({
  isOpen,
  onClose,
  token,
  onSuccess,
}) => {
  const [formData, setFormData] = useState<CustomerCreatePayload>({
    full_name: '',
    email: '',
    phone: '',
    username: '',
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = formData.full_name.trim();
    if (!trimmedName) {
      setError('Vui lòng nhập Họ và tên nhân viên.');
      return;
    }

    // Ràng buộc họ và tên phải bằng chữ cái, không được chứa số
    if (/\d/.test(trimmedName)) {
      setError('Họ và tên không hợp lệ! Vui lòng chỉ nhập chữ cái, không được chứa chữ số.');
      return;
    }

    const vietnameseNameRegex = /^[a-zA-ZÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚĂĐĨŨƠàáâãèéêìíòóôõùúăđĩũơƯĂẠẢẤẦẨẪẬẮẰẲẴẶẸẺẼỀỀỂưăạảấầẩẫậắằẳẵặẹẻẽềềểỄỆỈỊỌỎỐỒỔỖỘỚỜỞỠỢỤỦỨỪễệỉịọỏốồổỗộớờởỡợụủứừỬỮỰỲỴÝỶỸửữựỳỵỷỹ\s\.\'\-]+$/;
    if (!vietnameseNameRegex.test(trimmedName)) {
      setError('Họ và tên không hợp lệ! Vui lòng chỉ nhập các chữ cái tiếng Việt hoặc tiếng Anh, không nhập số hay ký tự đặc biệt.');
      return;
    }

    if (!formData.email.trim()) {
      setError('Vui lòng nhập địa chỉ Email.');
      return;
    }
    if (!formData.phone.trim()) {
      setError('Vui lòng nhập số điện thoại liên hệ.');
      return;
    }

    // Chuẩn hóa và kiểm tra số điện thoại Việt Nam hợp lệ
    let cleanPhone = formData.phone.trim().replace(/[\s\.\-\(\)]/g, '');
    if (cleanPhone.startsWith('+84')) {
      cleanPhone = '0' + cleanPhone.slice(3);
    } else if (cleanPhone.startsWith('84') && cleanPhone.length === 11) {
      cleanPhone = '0' + cleanPhone.slice(2);
    }

    // Định dạng: 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09 (hoặc máy bàn 11 số bắt đầu 02)
    const vnPhoneRegex = /^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$/;
    if (!vnPhoneRegex.test(cleanPhone)) {
      setError('Số điện thoại không hợp lệ! Vui lòng nhập đúng số điện thoại (10 chữ số, bắt đầu bằng 03, 05, 07, 08, 09. Ví dụ: 0987654321 hoặc +84987654321).');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createCustomerApi(token, {
        full_name: trimmedName,
        email: formData.email.trim(),
        phone: cleanPhone,
        username: formData.username?.trim() || undefined,
      });

      // Phát sự kiện đồng bộ toàn hệ thống để trang Phân quyền lập tức cập nhật người dùng mới
      window.dispatchEvent(new CustomEvent('USER_ACCOUNTS_CHANGED', { detail: { username: res.user.username } }));

      if (onSuccess) {
        onSuccess(`✅ ${res.message} Tài khoản: "${res.user.username}" (${res.user.full_name})`);
      }
      setFormData({
        full_name: '',
        email: '',
        phone: '',
        username: '',
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tạo tài khoản.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      style={{
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
        padding: '20px',
        boxSizing: 'border-box',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: '#1e293b',
          border: '1px solid #334155',
          borderRadius: '18px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.65)',
          overflow: 'hidden',
          color: '#f8fafc',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header Modal */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid #334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(15, 23, 42, 0.8))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '18px',
                boxShadow: '0 4px 12px rgba(16, 185, 129, 0.35)',
              }}
            >
              ✉️
            </div>
            <div>
              <h3 style={{ fontSize: '17px', fontWeight: '700', margin: 0, color: '#f8fafc' }}>
                Tạo Tài Khoản
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Tự sinh mật khẩu bảo mật và gửi thông tin qua Email
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
            title="Đóng modal"
          >
            ✕
          </button>
        </div>

        {/* Form Create Customer */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {error && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.4)',
                color: '#fca5a5',
                padding: '10px 14px',
                borderRadius: '10px',
                fontSize: '13px',
                marginBottom: '18px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Họ và tên */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Họ và tên nhân viên <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Ví dụ: Trần Thị Mai"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Chỉ nhập chữ cái tiếng Việt hoặc tiếng Anh, không chứa chữ số.
              </span>
            </div>

            {/* Email */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Email nhận thông tin tài khoản <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="email"
                required
                placeholder="mai.tran@company.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Số điện thoại */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Số điện thoại liên hệ <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="tel"
                required
                placeholder="Ví dụ: 0987654321 hoặc +84987654321"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{ fontSize: '11.5px', color: '#94a3b8', marginTop: '4px', display: 'block' }}>
                Định dạng: 10 chữ số bắt đầu bằng 03, 05, 07, 08, 09 (hoặc đầu số bàn 02).
              </span>
            </div>

            {/* Tùy chọn Tên đăng nhập (Username) */}
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '600',
                  color: '#cbd5e1',
                  marginBottom: '6px',
                }}
              >
                Tên đăng nhập mong muốn{' '}
                <span style={{ color: '#94a3b8', fontWeight: 'normal' }}>
                  (Để trống hệ thống sẽ tự sinh)
                </span>
              </label>
              <input
                type="text"
                placeholder="Để trống nếu muốn tự động tạo theo email"
                value={formData.username || ''}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  border: '1px solid #475569',
                  background: '#0f172a',
                  color: '#f8fafc',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Thông báo nghiệp vụ */}
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '10px',
                padding: '12px 14px',
                fontSize: '12.5px',
                color: '#7dd3fc',
                lineHeight: '1.5',
              }}
            >
              ℹ️ Hệ thống sẽ cấp một mật khẩu tạm thời ngẫu nhiên (14 ký tự) và kích hoạt tài khoản. Thông tin chi tiết sẽ được tự động gửi vào email nhân viên.
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#334155',
                border: 'none',
                borderRadius: '8px',
                color: '#e2e8f0',
                padding: '10px 18px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              id="btn-submit-customer"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                border: 'none',
                borderRadius: '8px',
                color: '#ffffff',
                padding: '10px 22px',
                fontSize: '13.5px',
                fontWeight: '700',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)',
              }}
            >
              {isSubmitting ? 'Đang tạo & gửi mail...' : 'Tạo tài khoản & Gửi Email'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
export default CreateCustomerModal;
