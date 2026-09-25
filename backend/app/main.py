# backend/app/main.py - Fresh Reset
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.endpoints import auth, products, inventory, users, orders

app = FastAPI(
    title="Quan Ly Ban Hang & Kho API",
    description="Hệ thống API quản lý bán hàng và kho với cơ chế RBAC Zero-Trust bảo vệ giá vốn và kho hàng",
    version="1.0.0"
)

# CORS Middleware to allow Frontend (Vite on any localhost port: 5173, 5174, 5175, etc.)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(auth.router, prefix="/api/v1/auth", tags=["Auth"])
app.include_router(products.router, prefix="/api/v1/products", tags=["Products"])
app.include_router(inventory.router, prefix="/api/v1/inventory", tags=["Inventory"])
app.include_router(users.router, prefix="/api/v1/users", tags=["Users"])
app.include_router(orders.router, prefix="/api/v1/orders", tags=["Orders"])

@app.get("/")
def root():
    return {
        "status": "ok",
        "message": "Backend API đang hoạt động bình thường",
        "docs_url": "/docs"
    }
