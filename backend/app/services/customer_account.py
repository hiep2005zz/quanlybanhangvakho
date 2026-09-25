import logging
import secrets
import smtplib
import string
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.core.config import settings

logger = logging.getLogger(__name__)


def generate_temporary_password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        password = "".join(secrets.choice(alphabet) for _ in range(14))
        if any(char.islower() for char in password) and any(char.isupper() for char in password) and any(char.isdigit() for char in password):
            return password


def send_customer_credentials(email: str, full_name: str, username: str, password: str, phone: str) -> bool:
    if not settings.MAIL_SERVER or not settings.MAIL_USERNAME or not settings.MAIL_PASSWORD:
        logger.warning("SMTP is not configured; cannot send customer credentials to %s", email)
        return False

    subject = "Thông tin tài khoản Hệ Thống Kho & Bán Hàng"
    text = (
        f"Xin chào {full_name},\n\n"
        "Tài khoản nhân viên kinh doanh của bạn đã được tạo thành công và đang chờ quản trị viên cấp quyền.\n\n"
        f"Tên đăng nhập: {username}\n"
        f"Email: {email}\n"
        f"Số điện thoại: {phone}\n"
        f"Mật khẩu tạm thời: {password}\n"
        f"Địa chỉ đăng nhập: {settings.FRONTEND_URL.rstrip('/')}\n\n"
        "Vui lòng đăng nhập và đổi mật khẩu sau lần sử dụng đầu tiên.\n\n"
        "Trân trọng,\nHệ Thống Quản Lý Bán Hàng & Kho"
    )
    message = MIMEMultipart("alternative")
    message["Subject"] = subject
    message["From"] = settings.MAIL_FROM or settings.MAIL_USERNAME
    message["To"] = email
    message.attach(MIMEText(text, "plain", "utf-8"))

    try:
        with smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=15) as server:
            if settings.MAIL_TLS:
                server.starttls()
            server.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            server.send_message(message)
        logger.info("Customer account credentials email sent to %s", email)
        return True
    except (OSError, smtplib.SMTPException):
        logger.exception("Unable to send customer credentials email to %s", email)
        return False



