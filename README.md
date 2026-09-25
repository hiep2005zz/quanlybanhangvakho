# Dự Án Fullstack (Frontend + Backend)

## Cấu trúc thư mục
- `frontend/`: React 19 + TypeScript + Vite
- `backend/`: FastAPI + Python 3.14

---

## 1. Hướng dẫn chạy Frontend

1. Di chuyển vào thư mục `frontend`:
   ```bash
   cd frontend
   ```
2. Cài đặt các thư viện cần thiết:
   ```bash
   npm install
   ```
3. Chạy môi trường phát triển (Dev Server):
   ```bash
   npm run dev
   ```
4. Truy cập giao diện tại: `http://localhost:5173`

---

## 2. Hướng dẫn chạy Backend

1. Di chuyển vào thư mục `backend`:
   ```bash
   cd backend
   ```
2. Tạo và kích hoạt môi trường ảo (Virtual Environment):
   - **Windows**:
     ```powershell
     python -m venv venv
     .\venv\Scripts\activate
     ```
   - **macOS / Linux**:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```
3. Cài đặt các thư viện:
   ```bash
   pip install -r requirements.txt
   ```
4. Khởi chạy server FastAPI:
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```
5. Kiểm tra API:
   - Root API: `http://127.0.0.1:8000`
   - Tài liệu Swagger UI: `http://127.0.0.1:8000/docs`

### Gửi mật khẩu tài khoản nhân viên kinh doanh qua Gmail

Để nút **Tạo tài khoản nhân viên kinh doanh** gửi username và mật khẩu tự sinh qua Gmail, tạo file `backend/.env` và khai báo Gmail App Password (không dùng mật khẩu Gmail chính):

```env
MAIL_USERNAME=your-account@gmail.com
MAIL_PASSWORD=your-gmail-app-password
MAIL_FROM=your-account@gmail.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_TLS=True
FRONTEND_URL=http://localhost:5173
```

Tài khoản nhân viên kinh doanh mới được tạo ở trạng thái chưa phân quyền; admin chọn vai trò trong phần Sửa tài khoản trước khi nhân viên sử dụng hệ thống. Mật khẩu tạm được tạo ngẫu nhiên và chỉ lưu dưới dạng mã hóa; tài khoản chỉ được tạo sau khi gửi email thành công. Nếu SMTP chưa cấu hình hoặc gửi thất bại, giao diện báo lỗi và có thể thử lại sau khi cấu hình SMTP.

---

## 3. Hệ Thống Phân Quyền Theo Vai Trò (RBAC) & Bảo Mật Dữ Liệu

Hệ thống triển khai nguyên tắc **Zero-Trust (Default Deny)** tại Backend FastAPI:

### Danh sách 7 vai trò nghiệp vụ (Mật khẩu mặc định: `123`):
| Vai trò | Username | Quyền Xem Giá Vốn & Lợi Nhuận (AC 3) | Quyền Ghi Kho (AC 4) | Mô tả |
|---------|----------|--------------------------------------|----------------------|-------|
| **Quản trị hệ thống** | `admin` | ✓ Có quyền | ✓ Có quyền | Toàn quyền quản trị hệ thống |
| **Quản lý kinh doanh** | `sales_manager` | ✓ Có quyền | ⛔ Bị chặn (403) | Xem báo cáo tài chính, giá vốn & lãi |
| **Nhân viên kinh doanh** | `sales` | 🔒 Ẩn hoàn toàn (Server strip) | ⛔ Bị chặn (403) | Bán hàng, xem tồn kho. Bị chặn giá vốn và kho |
| **Thủ kho** | `kho` | 🔒 Ẩn hoàn toàn (Server strip) | ✓ Có quyền | Nhập/xuất/điều chỉnh kho. Ẩn giá vốn |
| **Quản lý kho** | `warehouse_mgr` | 🔒 Ẩn hoàn toàn (Server strip) | ✓ Có quyền | Quản lý quy trình kho vận & mua hàng |
| **Kế toán** | `ketoan` | 🔒 Ẩn hoàn toàn (Server strip) | ⛔ Bị chặn (403) | Đối soát chứng từ, hóa đơn |
| **Nhân viên mua hàng** | `muahang` | 🔒 Ẩn hoàn toàn (Server strip) | ⛔ Bị chặn (403) | Lập phiếu mua hàng nhà cung cấp |

### Chạy bộ kiểm thử tự động (AC 5):
```powershell
cd backend
.\venv\Scripts\python.exe -m pytest tests/rbac -v
```



