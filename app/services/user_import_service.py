import io
import re
from typing import List, Dict, Any, Tuple
import openpyxl
from pydantic import ValidationError
from app.models.user import USERS_DB, UserInDB, get_next_user_id, save_users_db
from app.schemas.user_import import RowPreview, PreviewResponse, ImportExecuteRequest, ImportExecuteResponse
from app.core.rbac import Role, is_warehouse_role, is_specific_warehouse, SPECIFIC_WAREHOUSES
from app.core.security import get_password_hash
from app.schemas.user import UserCreate

def generate_temp_password(length: int = 8) -> str:
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(length))

def validate_excel_file(file_content: bytes) -> PreviewResponse:
    try:
        wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
        sheet = wb.active
    except Exception as e:
        raise ValueError("Không thể đọc tệp Excel. Vui lòng đảm bảo tệp đúng định dạng .xlsx")

    rows = list(sheet.iter_rows(values_only=True))
    if len(rows) < 2:
        return PreviewResponse(total_rows=0, valid_rows=0, invalid_rows=0, preview_data=[])

    header = rows[0]
    data_rows = rows[1:]

    preview_data: List[RowPreview] = []
    
    seen_emails = set()
    seen_phones = set()

    for idx, row in enumerate(data_rows):
        row_index = idx + 2
        if not any(row):
            continue

        full_name = str(row[0] or "").strip()
        email = str(row[1] or "").strip()
        phone = str(row[2] or "").strip()
        if phone.endswith(".0"):
            phone = phone[:-2]
            
        role = str(row[3] or "").strip()
        branch = str(row[4] or "").strip()
        password = str(row[5] or "").strip()

        errors = []

        if not full_name:
            errors.append("Thiếu Họ và tên")

        if not email:
            errors.append("Thiếu Email")
        else:
            email_lower = email.lower()
            if not re.match(r"[^@]+@[^@]+\.[^@]+", email_lower):
                errors.append("Email không đúng định dạng")
            elif email_lower in seen_emails:
                errors.append("Email trùng lặp trong tệp Excel")
            else:
                seen_emails.add(email_lower)
                for u in USERS_DB.values():
                    if u.email and u.email.lower() == email_lower:
                        errors.append("Email đã tồn tại trong hệ thống")
                        break

        if phone:
            cleaned_phone = re.sub(r'[\s\.\-\(\)]', '', phone)
            if cleaned_phone.startswith('+84'):
                cleaned_phone = '0' + cleaned_phone[3:]
            elif cleaned_phone.startswith('84') and len(cleaned_phone) == 11:
                cleaned_phone = '0' + cleaned_phone[2:]
            
            vn_phone_pattern = r'^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$'
            if not re.match(vn_phone_pattern, cleaned_phone):
                errors.append("Số điện thoại không đúng định dạng (cần 10 số)")
            elif cleaned_phone in seen_phones:
                errors.append("Số điện thoại trùng lặp trong tệp Excel")
            else:
                seen_phones.add(cleaned_phone)
                phone = cleaned_phone

        valid_roles = [r.value for r in Role]
        if not role:
            errors.append("Thiếu Vai trò")
        elif role not in valid_roles:
            errors.append(f"Vai trò không hợp lệ (hợp lệ: {', '.join(valid_roles)})")

        if role and role in valid_roles:
            if is_warehouse_role([role]):
                if not branch:
                    errors.append("Vai trò Kho yêu cầu chỉ định Phòng ban/Địa bàn")
                elif not is_specific_warehouse(branch):
                    errors.append(f"Địa bàn Kho không hợp lệ (Ví dụ: {', '.join(SPECIFIC_WAREHOUSES)})")

        if not password:
            password = generate_temp_password()

        is_valid = len(errors) == 0

        preview = RowPreview(
            row_index=row_index,
            full_name=full_name,
            email=email,
            phone=phone,
            role=role,
            branch=branch,
            password=password,
            is_valid=is_valid,
            errors=errors
        )
        preview_data.append(preview)

    total_rows = len(preview_data)
    valid_rows = sum(1 for r in preview_data if r.is_valid)
    invalid_rows = total_rows - valid_rows

    return PreviewResponse(
        total_rows=total_rows,
        valid_rows=valid_rows,
        invalid_rows=invalid_rows,
        preview_data=preview_data
    )

def execute_import(request: ImportExecuteRequest) -> ImportExecuteResponse:
    success_count = 0
    failed_count = 0
    failed_rows: List[RowPreview] = []

    for row in request.rows:
        if not row.is_valid:
            failed_count += 1
            failed_rows.append(row)
            continue
            
        try:
            clean_email = row.email.strip().lower()
            
            prefix = re.sub(r'[^a-z0-9]', '', clean_email.split('@')[0].lower())
            if not prefix:
                prefix = "user"
            clean_username = prefix
            counter = 1
            while clean_username in USERS_DB:
                clean_username = f"{prefix}{counter}"
                counter += 1

            new_user = UserInDB(
                id=get_next_user_id(),
                username=clean_username,
                full_name=row.full_name,
                email=clean_email,
                phone=row.phone if row.phone else None,
                role=row.role,
                roles=[row.role],
                hashed_password=get_password_hash(row.password),
                branch=row.branch if row.branch else "Kho Tổng Hà Nội",
                is_active=True,
            )
            USERS_DB[clean_username] = new_user
            success_count += 1
        except Exception as e:
            row.errors.append(str(e))
            row.is_valid = False
            failed_rows.append(row)
            failed_count += 1

    if success_count > 0:
        save_users_db()

    return ImportExecuteResponse(
        total_processed=len(request.rows),
        success_count=success_count,
        failed_count=failed_count,
        failed_rows=failed_rows
    )

def create_template_excel() -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Users Import"
    
    headers = ["Họ và tên", "Email", "Số điện thoại", "Vai trò (Role)", "Phòng ban/Địa bàn", "Mật khẩu"]
    ws.append(headers)
    
    example_row = ["Nguyễn Văn A", "nva@congty.vn", "0912345678", "sales", "Kho Tổng Hà Nội", "123456"]
    ws.append(example_row)
    
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def create_error_excel(failed_rows: List[RowPreview]) -> io.BytesIO:
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Failed Rows"
    
    headers = ["Dòng", "Họ và tên", "Email", "Số điện thoại", "Vai trò (Role)", "Phòng ban/Địa bàn", "Mật khẩu", "Lỗi"]
    ws.append(headers)
    
    for row in failed_rows:
        ws.append([
            row.row_index,
            row.full_name,
            row.email,
            row.phone,
            row.role,
            row.branch,
            row.password,
            " | ".join(row.errors)
        ])
        
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def generate_temp_password(length: int = 8) -> str:
    import secrets
    import string
    alphabet = string.ascii_letters + string.digits
    return ''.join(secrets.choice(alphabet) for i in range(length))

def validate_excel_file(file_content: bytes) -> PreviewResponse:
    return PreviewResponse(total_rows=0, valid_rows=0, invalid_rows=0, preview_data=[])

def execute_import(request: ImportExecuteRequest) -> ImportExecuteResponse:
    return ImportExecuteResponse(total_processed=0, success_count=0, failed_count=0, failed_rows=[])

def create_template_excel() -> io.BytesIO:
    return io.BytesIO()

def create_error_excel(failed_rows: List[RowPreview]) -> io.BytesIO:
    return io.BytesIO()
