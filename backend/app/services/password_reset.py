import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from fastapi import HTTPException, status
from app.models.user import USERS_DB, save_users_db, load_users_db
from app.core.config import settings
from app.core.security import get_password_hash

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_MINUTES = 30
RESET_MESSAGE = 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.'


class PasswordResetService:
    def __init__(self) -> None:
        # Lưu token hash -> (username, expires_at)
        self._tokens: dict[str, tuple[str, datetime]] = {}

    def request_reset(self, email: str) -> str:
        # Nạp lại dữ liệu mới nhất từ file JSON để đảm bảo email vừa sửa/tạo được nhận ngay
        load_users_db()
        normalized_email = email.strip().lower()
        
        # Tìm người dùng tương ứng trong USERS_DB (hỗ trợ nhập email hoặc username)
        matched_user = None
        for u in USERS_DB.values():
            if (u.email and u.email.lower() == normalized_email) or (u.username.lower() == normalized_email) or (u.username.lower() == normalized_email.split('@')[0]):
                matched_user = u
                break

        # Anti-enumeration: Nếu email không tồn tại hoặc tài khoản bị khóa, vẫn trả về cùng 1 thông báo
        if not matched_user or not matched_user.is_active:
            print(f"[FORGOT PASSWORD] Không tìm thấy user hoặc tài khoản bị khóa cho input: '{normalized_email}'", flush=True)
            return RESET_MESSAGE

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        self._tokens[token_hash] = (matched_user.username, expires_at)

        reset_token = token
        link_str = f"http://localhost:5173/reset-password?token={reset_token}"
        # In link ra terminal backend an toan cho Windows Console
        print("\n==========================================", flush=True)
        print(f"[RESET PASSWORD LINK]: {link_str}", flush=True)
        print("==========================================\n", flush=True)

        recipient_email = matched_user.email if matched_user.email else normalized_email

        # Gửi email qua Gmail SMTP bằng thư viện smtplib và email.mime
        try:
            self._send_email(
                to_email=recipient_email,
                token=reset_token,
                recipient_name=matched_user.full_name or matched_user.username
            )
            print(f"[GMAIL SENT OK] Da gui email dat lai mat khau thanh cong toi: {recipient_email}", flush=True)
        except Exception as e:
            # Ghi log lỗi rõ ràng trên server nhưng không để lộ exception ra ngoài frontend
            print(f"[GMAIL SEND ERROR] Loi gui email toi {recipient_email}: {e}", flush=True)
            logger.error("Loi khi gui email dat lai mat khau toi %s: %s", recipient_email, e, exc_info=True)

        return RESET_MESSAGE

    def reset_password(self, token: str, new_password: str) -> str:
        token_hash = self._hash_token(token)
        # Liên kết chỉ dùng được 1 lần: pop token ra khỏi bộ nhớ ngay khi sử dụng
        stored_token = self._tokens.pop(token_hash, None)
        if stored_token is None or stored_token[1] <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
            )

        username, _ = stored_token
        user = USERS_DB.get(username)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Người dùng không tồn tại hoặc đã bị vô hiệu hóa.',
            )

        # Cập nhật mật khẩu mã hóa mới và tăng token_version để thu hồi các phiên cũ
        user.hashed_password = get_password_hash(new_password)
        user.token_version = getattr(user, 'token_version', 1) + 1
        save_users_db()
        return 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới.'

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def _send_email(to_email: str, token: str, recipient_name: str = "Quý khách") -> None:
        mail_server = settings.MAIL_SERVER
        mail_port = settings.MAIL_PORT
        mail_username = settings.MAIL_USERNAME
        mail_password = settings.MAIL_PASSWORD
        mail_from = settings.MAIL_FROM or mail_username

        if not mail_server or not mail_username or not mail_password:
            logger.warning("SMTP chưa được cấu hình đầy đủ trong file .env. Bỏ qua gửi email thực tế.")
            return

        reset_link = f"http://localhost:5173/reset-password?token={token}"

        # Tiêu đề email
        subject = "[Hệ Thống Kho & Bán Hàng] Hướng dẫn đặt lại mật khẩu"

        # Bản nội dung Text thuần
        text_content = (
            f"Xin chào {recipient_name},\n\n"
            "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại Hệ Thống Kho & Bán Hàng.\n\n"
            f"Vui lòng truy cập đường dẫn sau để đặt lại mật khẩu:\n{reset_link}\n\n"
            "Lưu ý: Liên kết có hiệu lực trong vòng 30 phút và chỉ sử dụng được 1 lần duy nhất.\n"
            "Nếu bạn không yêu cầu điều này, xin vui lòng bỏ qua thư này.\n\n"
            "Trân trọng,\nHệ Thống Quản Lý Bán Hàng & Kho"
        )

        # Bản nội dung HTML giao diện đẹp mắt
        html_content = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{subject}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
    <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; padding: 30px 10px;">
        <tr>
            <td align="center">
                <table width="100%" max-width="580" border="0" cellspacing="0" cellpadding="0" style="max-width: 580px; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08); border: 1px solid #e2e8f0;">
                    <!-- Header -->
                    <tr>
                        <td style="background-color: #285b4d; padding: 26px 30px; text-align: center;">
                            <h1 style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 700; letter-spacing: 0.5px;">HỆ THỐNG QUẢN LÝ KHO & BÁN HÀNG</h1>
                        </td>
                    </tr>
                    <!-- Body Content -->
                    <tr>
                        <td style="padding: 35px 30px 25px 30px; color: #334155; font-size: 15px; line-height: 1.6;">
                            <p style="margin-top: 0; font-size: 16px; font-weight: 600; color: #0f172a;">
                                Xin chào <strong>{recipient_name}</strong>,
                            </p>
                            <p style="margin: 12px 0;">
                                Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản của bạn tại hệ thống.
                            </p>
                            <p style="margin: 12px 0;">
                                Nhấp vào nút bên dưới để tiến hành thiết lập mật khẩu mới:
                            </p>
                            <!-- Action Button -->
                            <table border="0" cellspacing="0" cellpadding="0" style="margin: 28px auto;">
                                <tr>
                                    <td align="center" style="border-radius: 6px; background-color: #285b4d;">
                                        <a href="{reset_link}" target="_blank" style="display: inline-block; padding: 13px 32px; font-size: 15px; color: #ffffff; text-decoration: none; font-weight: 600; border-radius: 6px;">
                                            Đặt Lại Mật Khẩu
                                        </a>
                                    </td>
                                </tr>
                            </table>
                            <p style="font-size: 13px; color: #64748b; margin-top: 20px;">
                                Hoặc copy trực tiếp liên kết sau vào trình duyệt:
                            </p>
                            <p style="font-size: 13px; word-break: break-all; margin: 6px 0;">
                                <a href="{reset_link}" target="_blank" style="color: #2563eb; text-decoration: underline;">{reset_link}</a>
                            </p>
                            <!-- Notice Box -->
                            <div style="background-color: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px 16px; margin-top: 25px; border-radius: 4px;">
                                <p style="margin: 0; font-size: 13px; color: #92400e;">
                                    ⏱️ <strong>Lưu ý:</strong> Liên kết này có hiệu lực trong vòng <strong>30 phút</strong> và chỉ sử dụng được <strong>một lần duy nhất</strong>. Nếu bạn không gửi yêu cầu này, vui lòng bỏ qua email.
                                </p>
                            </div>
                        </td>
                    </tr>
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #f8fafc; padding: 18px 30px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8;">
                            Email tự động gửi từ Hệ Thống Quản Lý Bán Hàng & Kho. Vui lòng không trả lời thư này.
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>"""

        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = mail_from
        msg["To"] = to_email

        msg.attach(MIMEText(text_content, "plain", "utf-8"))
        msg.attach(MIMEText(html_content, "html", "utf-8"))

        with smtplib.SMTP(mail_server, mail_port, timeout=15) as server:
            if settings.MAIL_TLS:
                server.starttls()
            server.login(mail_username, mail_password)
            server.send_message(msg)
            logger.info("Đã gửi email đặt lại mật khẩu thành công tới %s", to_email)


password_reset_service = PasswordResetService()
