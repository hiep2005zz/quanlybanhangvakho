import React, { useState, useEffect } from 'react';
import { changePasswordApi } from '../services/api';
import { CURRENT_TAB_ID } from '../services/sessionManager';

interface SecurityModalProps {
  isOpen: boolean;
  onClose: () => void;
  token: string;
  username?: string;
  onTokenUpdated?: (newToken: string) => void;
}

export default function SecurityModal({
  isOpen,
  onClose, s
  token,
  username,
  onTokenUpdated,
}: SecurityModalProps) {

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reset form khi mở modal
  useEffect(() => {
    if (isOpen) {
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMessage(null);
      setSuccessMessage(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Đóng modal khi bấm phím Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) return null;

  // Tiêu chí mật khẩu mới
  const hasMinLength = newPassword.length >= 8;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const isMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
  const isFormValid =
    currentPassword.trim().length > 0 &&
    hasMinLength &&
    hasLetter &&
    hasNumber &&
    isMatch;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Kiểm tra client-side
    if (!currentPassword.trim()) {
      setErrorMessage('Vui lòng nhập mật khẩu hiện tại.');
      return;
    }

    if (!hasMinLength) {
      setErrorMessage('Mật khẩu mới phải có tối thiểu 8 ký tự.');
      return;
    }

    if (!hasLetter || !hasNumber) {
      setErrorMessage('Mật khẩu mới phải bao gồm cả chữ cái và chữ số.');
      return;
    }

    if (currentPassword === newPassword) {
      setErrorMessage('Mật khẩu mới không được trùng với mật khẩu hiện tại.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Xác nhận mật khẩu mới không khớp.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await changePasswordApi(
        {
          current_password: currentPassword,
          new_password: newPassword,
          confirm_password: confirmPassword,
        },
        token
      );

      setSuccessMessage(
        res.message ||
        'Đổi mật khẩu thành công! Tất cả các phiên đăng nhập khác đã được thu hồi an toàn.'
      );

      if (res.access_token && onTokenUpdated) {
        onTokenUpdated(res.access_token);
      }

      // Phát tín hiệu tức thì sang các tab khác có cùng tài khoản để lập tức thu hồi phiên của họ
      try {
        if (typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('auth_channel');
          channel.postMessage({
            type: 'PASSWORD_CHANGED',
            tabId: CURRENT_TAB_ID,
            username: username,
            newToken: res.access_token,
            timestamp: Date.now(),
          });
          channel.close();
        }
      } catch {
        // ignore
      }

      // Tự động đóng modal sau 2.2 giây
      setTimeout(() => {
        onClose();
      }, 2200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Đổi mật khẩu thất bại. Vui lòng kiểm tra lại thông tin.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        padding: '20px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isLoading) {
          onClose();
        }
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '460px',
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '16px',
          padding: '28px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          color: '#0f172a',
          position: 'relative',
          animation: 'fadeInCard 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Nút đóng [✕] */}
        <button
          onClick={onClose}
          disabled={isLoading}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '18px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            padding: '4px 8px',
            borderRadius: '6px',
            transition: 'color 0.15s',
          }}
          title="Đóng (Esc)"
        >
          ✕
        </button>

        {/* Tiêu đề Modal */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '6px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#2563eb',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#0f172a' }}>
              Bảo Mật & Đổi Mật Khẩu
            </h3>
            <p style={{ margin: '2px 0 0', fontSize: '12.5px', color: '#64748b' }}>
              Chủ động bảo vệ tài khoản sau khi được cấp mật khẩu tạm
            </p>
          </div>
        </div>

        {/* Thông báo thông tin về thu hồi phiên */}
        <div
          style={{
            margin: '18px 0 20px',
            padding: '10px 14px',
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: '10px',
            fontSize: '12.5px',
            color: '#1d4ed8',
            lineHeight: '1.5',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '15px' }}>🛡️</span>
          <span>
            Sau khi đổi mật khẩu thành công, <strong>tất cả các phiên đăng nhập khác</strong> trên các thiết bị khác sẽ được hệ thống <strong>thu hồi ngay lập tức</strong>.
          </span>
        </div>

        {/* Thông báo Lỗi */}
        {errorMessage && (
          <div
            style={{
              marginBottom: '16px',
              padding: '10px 14px',
              background: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#b91c1c',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Thông báo Thành công */}
        {successMessage && (
          <div
            style={{
              marginBottom: '16px',
              padding: '12px 14px',
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              borderRadius: '10px',
              fontSize: '13px',
              color: '#15803d',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>✅</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form Đổi Mật Khẩu */}
        <form onSubmit={handleSubmit}>
          {/* Ô 1: Mật khẩu hiện tại */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Mật khẩu hiện tại <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Nhập mật khẩu đang dùng"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '15px',
                  padding: 0,
                }}
                title={showCurrent ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showCurrent ? '👁️' : '🔒'}
              </button>
            </div>
          </div>

          {/* Ô 2: Mật khẩu mới */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Mật khẩu mới <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Tối thiểu 8 ký tự, có cả chữ và số"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '15px',
                  padding: 0,
                }}
                title={showNew ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showNew ? '👁️' : '🔒'}
              </button>
            </div>

            {/* Checklist kiểm tra điều kiện mật khẩu mới */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px 14px',
                marginTop: '8px',
                fontSize: '12px',
              }}
            >
              <span style={{ color: hasMinLength ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: hasMinLength ? '600' : 'normal' }}>
                {hasMinLength ? '✓' : '○'} Tối thiểu 8 ký tự
              </span>
              <span style={{ color: hasLetter ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: hasLetter ? '600' : 'normal' }}>
                {hasLetter ? '✓' : '○'} Có chữ cái (A-Z)
              </span>
              <span style={{ color: hasNumber ? '#15803d' : '#94a3b8', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: hasNumber ? '600' : 'normal' }}>
                {hasNumber ? '✓' : '○'} Có chữ số (0-9)
              </span>
            </div>
          </div>



          {/* Ô 3: Xác nhận mật khẩu mới */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>
              Xác nhận mật khẩu mới <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Nhập lại chính xác mật khẩu mới"
                disabled={isLoading}
                required
                style={{
                  width: '100%',
                  padding: '11px 40px 11px 14px',
                  background: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  color: '#0f172a',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={(e) => (e.target.style.borderColor = '#2563eb')}
                onBlur={(e) => (e.target.style.borderColor = '#cbd5e1')}
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  fontSize: '15px',
                  padding: 0,
                }}
                title={showConfirm ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              >
                {showConfirm ? '👁️' : '🔒'}
              </button>
            </div>
            {confirmPassword.length > 0 && !isMatch && (
              <span style={{ display: 'block', marginTop: '6px', fontSize: '12px', color: '#dc2626' }}>
                ✕ Mật khẩu xác nhận chưa khớp
              </span>
            )}
          </div>

          {/* Nút hành động */}
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              style={{
                padding: '10px 18px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#475569',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Hủy
            </button>

            <button
              type="submit"
              disabled={isLoading || !isFormValid}
              style={{
                padding: '10px 22px',
                background: isFormValid && !isLoading
                  ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
                  : '#cbd5e1',
                border: 'none',
                color: isFormValid && !isLoading ? '#ffffff' : '#94a3b8',
                borderRadius: '8px',
                fontSize: '13.5px',
                fontWeight: '600',
                cursor: isFormValid && !isLoading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: isFormValid && !isLoading ? '0 2px 6px rgba(37, 99, 235, 0.3)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              {isLoading ? (
                <>
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>Đổi mật khẩu</span>
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
