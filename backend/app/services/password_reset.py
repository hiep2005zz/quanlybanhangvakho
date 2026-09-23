import hashlib
import logging
import os
import secrets
import smtplib
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage

from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

RESET_TOKEN_TTL_MINUTES = 30
RESET_MESSAGE = 'Nếu email tồn tại, hướng dẫn đặt lại mật khẩu đã được gửi.'


class PasswordResetService:
    """Temporary in-memory implementation until the user model is persisted."""

    def __init__(self) -> None:
        self._users = {'sales@example.com': {'password': 'initial-password'}}
        self._tokens: dict[str, tuple[str, datetime]] = {}

    def request_reset(self, email: str) -> str:
        normalized_email = email.strip().lower()
        if normalized_email not in self._users:
            return RESET_MESSAGE

        token = secrets.token_urlsafe(32)
        token_hash = self._hash_token(token)
        expires_at = datetime.now(timezone.utc) + timedelta(minutes=RESET_TOKEN_TTL_MINUTES)
        self._tokens[token_hash] = (normalized_email, expires_at)

        if os.getenv('SMTP_HOST'):
            self._send_email(normalized_email, token)
        else:
            logger.info('Password reset token generated for %s: %s', normalized_email, token)
        return RESET_MESSAGE

    def reset_password(self, token: str, new_password: str) -> str:
        token_hash = self._hash_token(token)
        stored_token = self._tokens.pop(token_hash, None)
        if stored_token is None or stored_token[1] <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail='Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
            )

        email, _ = stored_token
        self._users[email]['password'] = new_password
        return 'Đặt lại mật khẩu thành công.'

    @staticmethod
    def _hash_token(token: str) -> str:
        return hashlib.sha256(token.encode('utf-8')).hexdigest()

    @staticmethod
    def _send_email(email: str, token: str) -> None:
        smtp_host = os.environ['SMTP_HOST']
        smtp_port = int(os.getenv('SMTP_PORT', '587'))
        smtp_user = os.environ['SMTP_USER']
        smtp_password = os.environ['SMTP_PASSWORD']
        sender = os.getenv('SMTP_FROM', smtp_user)
        reset_url = os.getenv('FRONTEND_RESET_URL', 'http://localhost:5173/reset-password')

        message = EmailMessage()
        message['Subject'] = 'Đặt lại mật khẩu hệ thống bán hàng và kho'
        message['From'] = sender
        message['To'] = email
        message.set_content(
            'Bạn vừa yêu cầu đặt lại mật khẩu.\n\n'
            f'Mã đặt lại của bạn: {token}\n'
            f'Bạn cũng có thể mở: {reset_url}?token={token}\n\n'
            'Mã có hiệu lực trong 30 phút và chỉ dùng được một lần.'
        )

        with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(smtp_user, smtp_password)
            smtp.send_message(message)


password_reset_service = PasswordResetService()
