// frontend/src/features/auth/LoginPage.tsx
import { useState, useEffect } from 'react';
import './login.css';

// Danh sách tài khoản thử nghiệm các vai trò
export const MOCK_USERS = [
    { username: 'admin', password: '123', role: 'admin', name: 'Nguyễn Quản Trị' },
    { username: 'sales', password: '123', role: 'sales', name: 'Trần Bán Hàng' },
    { username: 'kho', password: '123', role: 'warehouse', name: 'Lê Thủ Kho' },
];

interface LoginPageProps {
    onLoginSuccess: (user: typeof MOCK_USERS[0]) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');
    const [lockRemaining, setLockRemaining] = useState<number>(0);

    // Kiểm tra trạng thái khóa 15 phút khi load trang
    useEffect(() => {
        const lockUntilStr = localStorage.getItem('lockout_until');
        if (lockUntilStr) {
            const lockUntil = parseInt(lockUntilStr, 10);
            const now = Date.now();
            if (lockUntil > now) {
                setLockRemaining(Math.ceil((lockUntil - now) / 1000));
            } else {
                localStorage.removeItem('lockout_until');
                localStorage.removeItem('login_failed_count');
            }
        }
    }, []);

    // Bộ đếm ngược thời gian khóa
    useEffect(() => {
        if (lockRemaining <= 0) return;
        const timer = setInterval(() => {
            setLockRemaining((prev) => {
                if (prev <= 1) {
                    localStorage.removeItem('lockout_until');
                    localStorage.removeItem('login_failed_count');
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [lockRemaining]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (lockRemaining > 0) return;

        // Tìm tài khoản
        const matchedUser = MOCK_USERS.find(
            (u) => u.username === username.trim() && u.password === password
        );

        if (matchedUser) {
            // Đăng nhập thành công: xóa lịch sử nhập sai
            localStorage.removeItem('login_failed_count');
            localStorage.removeItem('lockout_until');
            setErrorMessage('');
            onLoginSuccess(matchedUser);
        } else {
            // Đăng nhập sai: tăng biến đếm
            const currentFails = parseInt(localStorage.getItem('login_failed_count') || '0', 10) + 1;
            localStorage.setItem('login_failed_count', currentFails.toString());

            if (currentFails >= 5) {
                // Khóa 15 phút (15 * 60 = 900 giây)
                const lockDuration = 15 * 60 * 1000;
                const lockUntil = Date.now() + lockDuration;
                localStorage.setItem('lockout_until', lockUntil.toString());
                setLockRemaining(15 * 60);
                setErrorMessage('');
            } else {
                // Thông báo chung, không tiết lộ tài khoản có tồn tại hay không
                setErrorMessage(
                    `Tên đăng nhập hoặc mật khẩu không chính xác. (Bạn còn ${5 - currentFails} lần thử)`
                );
            }
        }
    };

    // Định dạng mm:ss
    const formatTime = (secs: number) => {
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = (secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    };

    return (
        <div className="login-wrapper">
            <div className="login-card">
                <div className="login-header">
                    <div className="brand-icon">
                        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                        </svg>
                    </div>
                    <h2>Quản Lý Bán Hàng & Kho</h2>
                    <p>Hệ thống phân quyền truy cập nội bộ</p>
                </div>

                {/* Cảnh báo khóa 15 phút */}
                {lockRemaining > 0 ? (
                    <div className="lock-alert">
                        <p>Tài khoản đã bị tạm khóa do nhập sai quá 5 lần liên tiếp. Vui lòng thử lại sau:</p>
                        <div className="lock-timer">{formatTime(lockRemaining)}</div>
                    </div>
                ) : (
                    <form className="login-form" onSubmit={handleSubmit}>
                        {/* Thông báo lỗi chung */}
                        {errorMessage && (
                            <div className="error-alert">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <circle cx="12" cy="12" r="10" />
                                    <line x1="12" y1="8" x2="12" y2="12" />
                                    <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <div className="form-group">
                            <label htmlFor="username">Tên đăng nhập</label>
                            <div className="input-container">
                                <input
                                    id="username"
                                    type="text"
                                    placeholder="Nhập tên đăng nhập"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    disabled={lockRemaining > 0}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="password">Mật khẩu</label>
                            <div className="input-container">
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    disabled={lockRemaining > 0}
                                    required
                                />
                                <button
                                    type="button"
                                    className="toggle-pwd-btn"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? 'Ẩn' : 'Hiện'}
                                </button>
                            </div>
                        </div>

                        <button type="submit" className="submit-btn" disabled={lockRemaining > 0}>
                            Đăng nhập
                        </button>
                    </form>
                )}

                {/* Danh sách tài khoản demo tiện test */}
                <div className="demo-account-hint" style={{ textAlign: 'left', lineHeight: '1.6' }}>
                    <div><strong>Tài khoản thử nghiệm:</strong></div>
                    <div>• Quản trị: <code>admin</code> / <code>123</code> (Xem trọn vẹn giá vốn)</div>
                    <div>• Bán hàng: <code>sales</code> / <code>123</code> (Bị ẩn hoàn toàn giá vốn)</div>
                    <div>• Thủ kho: <code>kho</code> / <code>123</code> (Quản lý tồn kho)</div>
                </div>
            </div>
        </div>
    );
}
