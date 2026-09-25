import hashlib
import logging
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException, status

from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import USERS_DB, persist_user

logger = logging.getLogger(__name__)
RESET_TOKEN_TTL_MINUTES = 30
RESET_MESSAGE = "Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi."


class PasswordResetService:
    def __init__(self) -> None:
        self._tokens: dict[str, tuple[str, datetime]] = {}

    def request_reset(self, email: str) -> str:
        normalized_email = email.strip().lower()
        user = next((u for u in USERS_DB.values() if u.email and u.email.strip().lower() == normalized_email), None)
        if not user or not user.is_active:
            return RESET_MESSAGE

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        self._tokens[token_hash] = (user.username, expires_at)
        reset_url = f"{settings.FRONTEND_URL.rstrip('/')}/reset-password?token={token}"
        message = EmailMessage()
        message["Subject"] = "Hướng dẫn đặt lại mật khẩu"
        message["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
        message["To"] = normalized_email
        message.set_content(
            f"Xin chào {user.full_name},\n\n"
            f"Dùng liên kết sau để đặt lại mật khẩu (có hiệu lực {RESET_TOKEN_TTL_MINUTES} phút):\n{reset_url}\n\n"
            "Nếu bạn không yêu cầu, hãy bỏ qua email này."
        )
        try:
            if not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
                raise RuntimeError("SMTP is not configured")
            with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=15) as server:
                if settings.MAIL_TLS:
                    server.starttls()
                server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
                server.send_message(message)
        except Exception:
            self._tokens.pop(token_hash, None)
            logger.exception("Unable to send password reset email")
        return RESET_MESSAGE

    def reset_password(self, token: str, new_password: str) -> str:
        token_hash = self._hash_token(token)
        stored = self._tokens.pop(token_hash, None)
        if stored is None or stored[1] <= datetime.now(timezone.utc):
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.")
        user = USERS_DB.get(stored[0])
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Người dùng không tồn tại hoặc đã bị vô hiệu hóa.")
        user.hashed_password = get_password_hash(new_password)
        user.token_version = getattr(user, "token_version", 1) + 1
        persist_user(user)
        return "Đặt lại mật khẩu thành công. Vui lòng đăng nhập với mật khẩu mới."

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode("utf-8")).hexdigest()


password_reset_service = PasswordResetService()
