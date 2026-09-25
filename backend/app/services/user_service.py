import secrets
import string
import logging
from datetime import datetime, timezone

from fastapi import HTTPException, status

from app.models.user import User, get_connection, user_from_row
from app.schemas.users import UserCreate, UserUpdate

logger = logging.getLogger(__name__)


def _password() -> str:
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        value = "".join(secrets.choice(alphabet) for _ in range(14))
        if any(c.islower() for c in value) and any(c.isupper() for c in value) and any(c.isdigit() for c in value):
            return value


def _username(email: str) -> str:
    base = email.split("@", 1)[0].lower()
    candidate = base
    suffix = 2
    with get_connection() as connection:
        while connection.execute("SELECT 1 FROM users WHERE username = ?", (candidate,)).fetchone():
            candidate = f"{base}{suffix}"
            suffix += 1
    return candidate


def list_users(search: str, role: str | None, is_active: bool | None) -> list[User]:
    query = search.strip().lower()
    conditions = []
    parameters: list[str | int] = []
    if query:
        conditions.append("(lower(full_name) LIKE ? OR lower(username) LIKE ? OR lower(email) LIKE ? OR phone LIKE ?)")
        parameters.extend([f"%{query}%"] * 4)
    if role is not None:
        conditions.append("role = ?")
        parameters.append(role)
    if is_active is not None:
        conditions.append("is_active = ?")
        parameters.append(int(is_active))
    where = f" WHERE {' AND '.join(conditions)}" if conditions else ""
    with get_connection() as connection:
        rows = connection.execute(f"SELECT * FROM users{where} ORDER BY id", parameters).fetchall()
    return [user_from_row(row) for row in rows]


def create_user(data: UserCreate) -> tuple[User, str, str]:
    email = str(data.email).lower()
    with get_connection() as connection:
        if connection.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE", (email,)).fetchone():
            raise HTTPException(status_code=400, detail={"code": "EMAIL_EXISTS", "message": "Email đã được sử dụng.", "field": "email"})
        if connection.execute("SELECT 1 FROM users WHERE phone = ?", (data.phone.strip(),)).fetchone():
            raise HTTPException(status_code=400, detail={"code": "PHONE_EXISTS", "message": "Số điện thoại đã được sử dụng.", "field": "phone"})
    username = _username(email)
    created_at = datetime.now(timezone.utc)
    with get_connection() as connection:
        cursor = connection.execute(
            "INSERT INTO users (username, full_name, email, phone, role, territory, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?)",
            (username, data.full_name.strip(), email, data.phone.strip(), data.role, data.territory.strip(), created_at.isoformat()),
        )
        user = User(cursor.lastrowid, username, data.full_name.strip(), email, data.phone.strip(), data.role, data.territory.strip(), True, created_at)
    temporary_password = _password()
    activation_link = f"/activate/{user.id}"
    logger.info("user.activation_requested user_id=%s email=%s activation_link=%s", user.id, user.email, activation_link)
    return user, temporary_password, activation_link


def update_user(user_id: int, data: UserUpdate) -> User:
    values = data.model_dump(exclude_unset=True)
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Không tìm thấy tài khoản.", "field": "id"})
    if "email" in values:
        values["email"] = str(values["email"]).lower()
        with get_connection() as connection:
            if connection.execute("SELECT 1 FROM users WHERE email = ? COLLATE NOCASE AND id != ?", (values["email"], user_id)).fetchone():
                raise HTTPException(status_code=400, detail={"code": "EMAIL_EXISTS", "message": "Email đã được sử dụng.", "field": "email"})
    if "phone" in values:
        values["phone"] = str(values["phone"]).strip()
        with get_connection() as connection:
            if connection.execute("SELECT 1 FROM users WHERE phone = ? AND id != ?", (values["phone"], user_id)).fetchone():
                raise HTTPException(status_code=400, detail={"code": "PHONE_EXISTS", "message": "Số điện thoại đã được sử dụng.", "field": "phone"})
    if values:
        assignments = ", ".join(f"{key} = ?" for key in values)
        parameters = [int(value) if key == "is_active" else value for key, value in values.items()]
        with get_connection() as connection:
            connection.execute(f"UPDATE users SET {assignments} WHERE id = ?", [*parameters, user_id])
    with get_connection() as connection:
        return user_from_row(connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone())


def delete_user(user_id: int) -> None:
    with get_connection() as connection:
        result = connection.execute("DELETE FROM users WHERE id = ?", (user_id,))
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail={"code": "USER_NOT_FOUND", "message": "Không tìm thấy tài khoản.", "field": "id"})
