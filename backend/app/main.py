import uuid
import os

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.endpoints import auth, products
from app.api.v1.endpoints.users import router as users_router

app = FastAPI(
    title="Quan Ly Ban Hang & Kho API",
    description="Hệ thống API quản lý bán hàng và kho với cơ chế bảo vệ giá vốn và chống brute-force",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origin.strip()
        for origin in os.getenv(
            "CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173",
        ).split(",")
        if origin.strip()
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def error_response(request: Request, status_code: int, code: str, message: str, details: dict | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": {"code": code, "message": message, "details": details or {}, "request_id": request.state.request_id}})


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request.state.request_id = request.headers.get("X-Request-Id", str(uuid.uuid4()))
    response = await call_next(request)
    response.headers["X-Request-Id"] = request.state.request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    return error_response(request, 422, "VALIDATION_ERROR", "Dữ liệu gửi lên không hợp lệ.", {"fields": exc.errors()})


@app.exception_handler(HTTPException)
async def http_error_handler(request: Request, exc: HTTPException):
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    return error_response(request, exc.status_code, detail.pop("code", "REQUEST_ERROR"), detail.pop("message", "Yêu cầu không hợp lệ."), detail)


@app.exception_handler(404)
async def not_found_handler(request: Request, _exc):
    return error_response(request, 404, "NOT_FOUND", "Không tìm thấy tài nguyên.")


@app.exception_handler(500)
async def internal_error_handler(request: Request, _exc):
    return error_response(request, 500, "INTERNAL_ERROR", "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.")


app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Backend API đang hoạt động bình thường",
        "docs_url": "/docs"
    }