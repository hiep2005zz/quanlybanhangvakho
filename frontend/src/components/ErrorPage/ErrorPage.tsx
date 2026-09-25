import './ErrorPage.css';

interface ErrorPageProps {
  /** Mã lỗi HTTP, ví dụ 403 hoặc 404 */
  code: number;
  /** Tiêu đề ngắn gọn, ví dụ "Bạn không có quyền truy cập" */
  title: string;
  /** Mô tả chi tiết hơn cho người dùng */
  description: string;
  /** Nhãn nút hành động gợi ý, ví dụ "Về trang chính" */
  actionLabel: string;
  /** Hàm xử lý khi bấm nút hành động */
  onAction: () => void;
}

export default function ErrorPage({
  code,
  title,
  description,
  actionLabel,
  onAction,
}: ErrorPageProps) {
  return (
    <div className="error-page">
      <div className="error-page__card">
        <p className="error-page__eyebrow">QUẢN LÝ BÁN HÀNG &amp; KHO</p>
        <p className="error-page__code">{code}</p>
        <h1 className="error-page__title">{title}</h1>
        <p className="error-page__description">{description}</p>
        <button className="error-page__action" onClick={onAction}>
          {actionLabel}
        </button>
      </div>
    </div>
  );
}