from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.deps import get_current_user
from app.schemas.users import UserCreate, UserCreateResponse, UserListResponse, UserResponse, UserUpdate
from app.services.user_service import create_user, delete_user, list_users, update_user
from app.schemas.auth import UserResponse as AuthUserResponse

router = APIRouter()


def require_admin(current_user: AuthUserResponse = Depends(get_current_user)) -> None:
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail={"code": "FORBIDDEN", "message": "Bạn không có quyền quản lý tài khoản."})


@router.get("", response_model=UserListResponse, dependencies=[Depends(require_admin)])
def get_users(search: str = Query(default=""), role: str | None = None, is_active: bool | None = None, page: int = Query(default=1, ge=1), page_size: int = Query(default=20, ge=1, le=100)) -> UserListResponse:
    records = list_users(search, role, is_active)
    total = len(records)
    start = (page - 1) * page_size
    items = records[start:start + page_size]
    return UserListResponse(items=items, page=page, page_size=page_size, total=total, total_pages=(total + page_size - 1) // page_size)


@router.post("", response_model=UserCreateResponse, status_code=status.HTTP_201_CREATED, dependencies=[Depends(require_admin)])
def add_user(data: UserCreate) -> UserCreateResponse:
    user, temporary_password, activation_link = create_user(data)
    return UserCreateResponse(user=user, temporary_password=temporary_password, activation_link=activation_link)


@router.patch("/{user_id}", response_model=UserResponse, dependencies=[Depends(require_admin)])
def edit_user(user_id: int, data: UserUpdate) -> UserResponse:
    return update_user(user_id, data)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(require_admin)])
def remove_user(user_id: int) -> None:
    delete_user(user_id)
