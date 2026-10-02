import io
import openpyxl
from openpyxl import Workbook
from openpyxl.utils.exceptions import InvalidFileException
from typing import List, Tuple, Dict, Any
import re
from sqlalchemy.orm import Session
from app.models.entities import UserEntity
from app.schemas.user_import import BulkImportRowResult, BulkImportPreviewResponse, BulkImportExecuteResponse
from app.core.rbac import ROLE_DETAILS

class UserBulkImportService:
    @staticmethod
    def _is_valid_email(email: str) -> bool:
        pattern = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"
        return re.match(pattern, email) is not None

    @staticmethod
    def _is_valid_phone(phone: str) -> bool:
        cleaned = re.sub(r'[\s\.\-\(\)]', '', phone.strip())
        if cleaned.startswith('+84'):
            cleaned = '0' + cleaned[3:]
        elif cleaned.startswith('84') and len(cleaned) == 11:
            cleaned = '0' + cleaned[2:]
        vn_phone_pattern = r'^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$'
        return re.match(vn_phone_pattern, cleaned) is not None

    @staticmethod
    def parse_and_validate(file_content: bytes, db: Session) -> BulkImportPreviewResponse:
        try:
            wb = openpyxl.load_workbook(io.BytesIO(file_content), data_only=True)
            sheet = wb.active
        except Exception as e:
            raise ValueError(f"Không thể đọc file Excel: {str(e)}")

        # Template format: 
        # Cột A: Họ và tên
        # Cột B: Email
        # Cột C: Số điện thoại
        # Cột D: Vai trò (Role)
        # Cột E: Chi nhánh / Địa bàn
        # Cột F: Mật khẩu

        rows_result = []
        emails_in_file = set()
        phones_in_file = set()
        
        valid_count = 0
        invalid_count = 0

        # Existing emails/phones from DB
        existing_users = db.query(UserEntity.email, UserEntity.phone).all()
        existing_emails = {u.email for u in existing_users if u.email}
        existing_phones = {u.phone for u in existing_users if u.phone}
        
        valid_roles = list(ROLE_DETAILS.keys())

        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if all(v is None for v in row):
                continue
                
            full_name = str(row[0]).strip() if row[0] else ""
            email = str(row[1]).strip() if row[1] else ""
            phone = str(row[2]).strip() if row[2] else ""
            role = str(row[3]).strip() if row[3] else ""
            branch = str(row[4]).strip() if len(row) > 4 and row[4] else "Kho Tổng Hà Nội"
            password = str(row[5]).strip() if len(row) > 5 and row[5] else "123"

            errors = {}

            if not full_name:
                errors['full_name'] = "Bắt buộc nhập họ và tên."
            if not email:
                errors['email'] = "Bắt buộc nhập email."
            elif not UserBulkImportService._is_valid_email(email):
                errors['email'] = "Email không hợp lệ."
            else:
                if email in existing_emails:
                    errors['email'] = "Email đã tồn tại trong hệ thống."
                elif email in emails_in_file:
                    errors['email'] = "Email bị trùng lặp trong file."
                emails_in_file.add(email)

            if not phone:
                errors['phone'] = "Bắt buộc nhập số điện thoại."
            elif not UserBulkImportService._is_valid_phone(phone):
                errors['phone'] = "Số điện thoại không hợp lệ."
            else:
                cleaned_phone = re.sub(r'[\s\.\-\(\)]', '', phone)
                if cleaned_phone.startswith('+84'):
                    cleaned_phone = '0' + cleaned_phone[3:]
                elif cleaned_phone.startswith('84') and len(cleaned_phone) == 11:
                    cleaned_phone = '0' + cleaned_phone[2:]
                
                if cleaned_phone in existing_phones:
                    errors['phone'] = "Số điện thoại đã tồn tại trong hệ thống."
                elif cleaned_phone in phones_in_file:
                    errors['phone'] = "Số điện thoại bị trùng lặp trong file."
                phones_in_file.add(cleaned_phone)

            if not role:
                errors['role'] = "Bắt buộc nhập vai trò."
            elif role not in valid_roles:
                errors['role'] = f"Vai trò không hợp lệ. Chọn từ: {', '.join(valid_roles)}"

            if not password:
                errors['password'] = "Bắt buộc nhập mật khẩu."

            is_valid = len(errors) == 0
            if is_valid:
                valid_count += 1
            else:
                invalid_count += 1

            rows_result.append(BulkImportRowResult(
                row_index=idx,
                full_name=full_name,
                email=email,
                phone=phone,
                role=role,
                branch=branch,
                password=password,
                is_valid=is_valid,
                errors=errors
            ))
            
        return BulkImportPreviewResponse(
            rows=rows_result,
            total_rows=len(rows_result),
            valid_count=valid_count,
            invalid_count=invalid_count
        )

    @staticmethod
    def generate_template() -> bytes:
        wb = Workbook()
        ws = wb.active
        ws.title = "Import_Users_Template"
        headers = ["Họ và tên", "Email", "Số điện thoại", "Vai trò (Role)", "Chi nhánh / Địa bàn", "Mật khẩu (Tự chọn, mặc định 123)"]
        ws.append(headers)
        
        # Example row
        ws.append(["Nguyễn Văn A", "nguyenvana@gmail.com", "0912345678", "sales", "Kho Tổng Hà Nội", "123"])
        
        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
