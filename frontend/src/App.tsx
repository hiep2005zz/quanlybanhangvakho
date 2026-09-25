import { FormEvent, useState } from 'react';
import { requestPasswordReset, resetPassword } from './services/auth';
import './app.css';
import ErrorPage from './components/ErrorPage/ErrorPage';

function App() {
  const resetToken = new URLSearchParams(window.location.search).get('token') ?? '';
  const [step, setStep] = useState<'email' | 'reset'>(resetToken ? 'reset' : 'email');
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      const response = await requestPasswordReset(email);
      setMessage(response.message);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Không thể gửi yêu cầu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setMessage('');
    setIsSubmitting(true);
    try {
      const response = await resetPassword(resetToken, newPassword);
      setMessage(response.message);
      setNewPassword('');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Không thể đặt lại mật khẩu.');
    } finally {
      setIsSubmitting(false);
    }
  }

  // return (
  //   <main className="auth-page">
  //     <section className="auth-card" aria-labelledby="page-title">
  //       <p className="eyebrow">QUẢN LÝ BÁN HÀNG & KHO</p>
  //       <h1 id="page-title">Lấy lại quyền truy cập</h1>
  //       <p className="intro">Nhập email tài khoản để nhận hướng dẫn đặt lại mật khẩu.</p>

  //       {step === 'email' ? (
  //         <form onSubmit={handleRequest}>
  //           <label htmlFor="email">Email tài khoản</label>
  //           <input
  //             id="email"
  //             type="email"
  //             value={email}
  //             onChange={(event) => setEmail(event.target.value)}
  //             placeholder="banhang@congty.vn"
  //             autoComplete="email"
  //             required
  //           />
  //           <button type="submit" disabled={isSubmitting}>
  //             {isSubmitting ? 'Đang gửi...' : 'Gửi hướng dẫn'}
  //           </button>
  //         </form>
  //       ) : (
  //         <form onSubmit={handleReset}>
  //           <label htmlFor="new-password">Mật khẩu mới</label>
  //           <input
  //             id="new-password"
  //             type="password"
  //             value={newPassword}
  //             onChange={(event) => setNewPassword(event.target.value)}
  //             minLength={8}
  //             autoComplete="new-password"
  //             required
  //           />
  //           <button type="submit" disabled={isSubmitting}>
  //             {isSubmitting ? 'Đang cập nhật...' : 'Đặt lại mật khẩu'}
  //           </button>
  //           <button
  //             type="button"
  //             className="secondary"
  //             onClick={() => {
  //               window.history.replaceState({}, '', window.location.pathname);
  //               setStep('email');
  //               setMessage('');
  //             }}
  //           >
  //             Gửi lại yêu cầu
  //           </button>
  //         </form>
  //       )}

  //       {message && <p className="message success" role="status">{message}</p>}
  //       {error && <p className="message error" role="alert">{error}</p>}
  //     </section>
  //   </main>
  // );
  return (
  <ErrorPage
    code={403}
    title="Bạn không có quyền truy cập"
    description="Tài khoản của bạn chưa được cấp quyền vào trang này. Liên hệ quản trị viên nếu cần hỗ trợ."
    actionLabel="Về trang chính"
    onAction={() => alert('Đã bấm nút')}
  />
);
}

export default App;
