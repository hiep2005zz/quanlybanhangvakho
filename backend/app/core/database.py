# backend/app/core/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.core.config import settings

# Engine kết nối CSDL (SQLite hoặc SQL Server tùy theo cấu hình .env)
is_sqlite = settings.DATABASE_URL.startswith("sqlite")
connect_args = {"check_same_thread": False} if is_sqlite else {}

engine = create_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args=connect_args,
    **({"pool_pre_ping": True, "pool_recycle": 3600} if not is_sqlite else {})
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Dependency cung cấp db session cho FastAPI endpoints."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
