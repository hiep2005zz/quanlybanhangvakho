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
