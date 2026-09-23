# backend/app/core/config.py
import secrets

class Settings:
    PROJECT_NAME: str = "Backend API - Quan Ly Kho & Ban Hang"
    API_V1_STR: str = "/api/v1"
    
    # JWT Settings (Secret key 32 bytes securely generated or constant for dev)
    SECRET_KEY: str = "09d25e094faa6ca2556c818166b7a9563b93f7099f6f0f4caa6cf63b88e8d3e7"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24  # 1 day

    # Security Lockout Settings
    MAX_FAILED_ATTEMPTS: int = 5
    LOCKOUT_MINUTES: int = 15

settings = Settings()
