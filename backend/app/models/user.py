from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import sqlite3
from typing import Optional
from pydantic import BaseModel
from app.core.security import get_password_hash

class UserInDB(BaseModel):
    id: int
    username: str
    full_name: str
    email: Optional[str] = None
    role: str  # 'admin', 'sales', 'warehouse'
    hashed_password: str
    is_active: bool = True
    failed_attempts: int = 0
    locked_until: Optional[datetime] = None
    token_version: int = 1


@dataclass
class User:
    id: int
    username: str
    full_name: str
    email: str
    phone: str
    role: str
    territory: str
    is_active: bool
    created_at: datetime


DATABASE_PATH = Path(__file__).resolve().parents[2] / "data" / "users.db"


def get_connection() -> sqlite3.Connection:
    DATABASE_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database() -> None:
    with get_connection() as connection:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                phone TEXT NOT NULL,
                role TEXT NOT NULL,
                territory TEXT NOT NULL,
                is_active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
            """
        )


def user_from_row(row: sqlite3.Row) -> User:
    return User(
        id=row["id"],
        username=row["username"],
        full_name=row["full_name"],
        email=row["email"],
        phone=row["phone"],
        role=row["role"],
        territory=row["territory"],
        is_active=bool(row["is_active"]),
        created_at=datetime.fromisoformat(row["created_at"]),
    )


initialize_database()

# Initial database seed (passwords are '123' hashed with bcrypt)
USERS_DB: dict[str, UserInDB] = {
    "admin": UserInDB(
        id=1,
        username="admin",
        full_name="Nguyễn Quản Trị",
        email="daongochiep645@gmail.com",
        role="admin",
        hashed_password=get_password_hash("123"),
    ),
    "sales": UserInDB(
        id=2,
        username="sales",
        full_name="Trần Bán Hàng",
        email="daongochiep645@gmail.com",
        role="sales",
        hashed_password=get_password_hash("123"),
    ),
    "kho": UserInDB(
        id=3,
        username="kho",
        full_name="Lê Thủ Kho",
        email="kho@congty.vn",
        role="warehouse",
        hashed_password=get_password_hash("123"),
    ),
}
