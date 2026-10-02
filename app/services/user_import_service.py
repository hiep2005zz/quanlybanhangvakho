import io
import openpyxl
from openpyxl import Workbook
from openpyxl.utils.exceptions import InvalidFileException
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
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
    def _clean_phone(phone: Any) -> str:
        if phone is None:
            return ""
        if isinstance(phone, float):
            phone = int(phone)
        cleaned = re.sub(r'[\s\.\-\(\)]', '', str(phone).strip())
        if cleaned.startswith('+84'):
            cleaned = '0' + cleaned[3:]
        elif cleaned.startswith('84') and len(cleaned) == 11:
            cleaned = '0' + cleaned[2:]
        elif len(cleaned) == 9 and cleaned[0] in '35789':
            # Excel strips leading 0 when cell is stored as number
            cleaned = '0' + cleaned
        return cleaned

    @staticmethod
    def _is_valid_phone(phone: str) -> bool:
        vn_phone_pattern = r'^(0[3|5|7|8|9][0-9]{8}|02[0-9]{9})$'
        return re.match(vn_phone_pattern, phone) is not None

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

        # Existing emails/phones from DB and memory USERS_DB
        from app.models.user import USERS_DB
        existing_users = db.query(UserEntity.email, UserEntity.phone).all()
        existing_emails = {u.email.lower().strip() for u in existing_users if u.email}
        existing_phones = {UserBulkImportService._clean_phone(u.phone) for u in existing_users if u.phone}

        for u in USERS_DB.values():
            if u.email:
                existing_emails.add(u.email.lower().strip())
            if u.phone:
                existing_phones.add(UserBulkImportService._clean_phone(u.phone))
        
        valid_roles = list(ROLE_DETAILS.keys())
        role_mapping: Dict[str, str] = {
            r.lower().strip(): r for r in valid_roles
        }
        for k, v in ROLE_DETAILS.items():
            title = v.get("title", "").lower().strip()
            if title:
                role_mapping[title] = k
        role_mapping.update({
            "nhan vien kinh doanh": "sales",
            "quan tri he thong": "admin",
            "quan ly kinh doanh": "sales_manager",
            "thu kho": "warehouse",
            "quan ly kho": "warehouse_manager",
            "ke toan": "accountant",
            "nhan vien mua hang": "purchasing",
        })

        for idx, row in enumerate(sheet.iter_rows(min_row=2, values_only=True), start=2):
            if all(v is None for v in row):
                continue
                
            full_name = str(row[0]).strip() if row[0] is not None and str(row[0]).strip() != "None" else ""
            email = str(row[1]).strip() if row[1] is not None and str(row[1]).strip() != "None" else ""
            raw_phone = row[2]
            phone = UserBulkImportService._clean_phone(raw_phone)
            raw_role = str(row[3]).strip() if row[3] is not None and str(row[3]).strip() != "None" else ""
            branch = str(row[4]).strip() if len(row) > 4 and row[4] is not None and str(row[4]).strip() != "None" else "Kho Tổng Hà Nội"
            password = str(row[5]).strip() if len(row) > 5 and row[5] is not None and str(row[5]).strip() != "None" else "123"

            errors = {}

            if not full_name:
                errors['full_name'] = "Bắt buộc nhập họ và tên."

            clean_email = email.lower().strip()
            if not clean_email:
                errors['email'] = "Bắt buộc nhập email."
            elif not UserBulkImportService._is_valid_email(clean_email):
                errors['email'] = "Email không hợp lệ."
            else:
                if clean_email in existing_emails:
                    errors['email'] = "Email đã tồn tại trong hệ thống."
                elif clean_email in emails_in_file:
                    errors['email'] = "Email bị trùng lặp trong file."
                emails_in_file.add(clean_email)

            if not phone:
                errors['phone'] = "Bắt buộc nhập số điện thoại."
            elif not UserBulkImportService._is_valid_phone(phone):
                errors['phone'] = "Số điện thoại không hợp lệ (cần 10 số di động VN)."
            else:
                if phone in existing_phones:
                    errors['phone'] = "Số điện thoại đã tồn tại trong hệ thống."
                elif phone in phones_in_file:
                    errors['phone'] = "Số điện thoại bị trùng lặp trong file."
                phones_in_file.add(phone)

            role = raw_role
            if not raw_role:
                errors['role'] = "Bắt buộc nhập vai trò."
            else:
                normalized_role = role_mapping.get(raw_role.lower().strip())
                if normalized_role:
                    role = normalized_role
                elif raw_role not in valid_roles:
                    errors['role'] = f"Vai trò '{raw_role}' không hợp lệ. Chọn từ: {', '.join(valid_roles)}"

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
                email=clean_email if clean_email else email,
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
        headers = ["Họ và tên", "Email", "Số điện thoại", "Vai trò", "Chi nhánh", "Mật khẩu"]
        ws.append(headers)
        
        # Example rows
        ws.append(["Nguyễn Văn A", "nguyenvana@gmail.com", "0912345678", "sales", "Kho Tổng Hà Nội", "123"])
        ws.append(["Trần Thị B", "tranthib@gmail.com", "0987654321", "kho", "Kho HCM", "123"])
        ws.append(["Lê Văn C", "levanc@gmail.com", "0901112223", "sales_manager", "Hà Nội", "123456"])
        
        # Styling variables
        header_fill = PatternFill(start_color="0284C7", end_color="0284C7", fill_type="solid")
        header_font = Font(color="FFFFFF", bold=True)
        center_alignment = Alignment(horizontal="center", vertical="center")
        left_alignment = Alignment(horizontal="left", vertical="center")
        thin_border = Border(
            left=Side(style='thin', color='D1D5DB'),
            right=Side(style='thin', color='D1D5DB'),
            top=Side(style='thin', color='D1D5DB'),
            bottom=Side(style='thin', color='D1D5DB')
        )
        
        # Style header row (row 1)
        ws.row_dimensions[1].height = 30
        for col_idx, cell in enumerate(ws[1], 1):
            cell.fill = header_fill
            cell.font = header_font
            cell.alignment = center_alignment
            cell.border = thin_border
        
        # Style data rows (rows 2 to max_row)
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row):
            for cell in row:
                cell.border = thin_border
                if cell.column == 1: # Họ và tên
                    cell.alignment = left_alignment
                else: # Email, SĐT, Vai trò, Chi nhánh, Mật khẩu
                    cell.alignment = center_alignment
                    
        # Auto-fit columns
        for col in ws.columns:
            max_length = 0
            column_letter = col[0].column_letter
            for cell in col:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(str(cell.value))
                except:
                    pass
            
            # Min 18, Max 35
            adjusted_width = min(max(max_length + 4, 18), 35)
            ws.column_dimensions[column_letter].width = adjusted_width

        output = io.BytesIO()
        wb.save(output)
        output.seek(0)
        return output.getvalue()
