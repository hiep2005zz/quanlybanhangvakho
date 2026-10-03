from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr

class RowPreview(BaseModel):
    row_index: int
    full_name: str
    email: str
    phone: str
    role: str
    branch: str
    password: str
    is_valid: bool
    errors: List[str] = []

class PreviewResponse(BaseModel):
    total_rows: int
    valid_rows: int
    invalid_rows: int
    preview_data: List[RowPreview]

class ImportExecuteRequest(BaseModel):
    rows: List[RowPreview]

class ImportExecuteResponse(BaseModel):
    total_processed: int
    success_count: int
    failed_count: int
    failed_rows: List[RowPreview]

class BulkImportRowResult(BaseModel):
    row_index: int
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    branch: Optional[str] = None
    password: Optional[str] = None
    is_valid: bool = True
    errors: Dict[str, str] = {} # column name -> error message

class BulkImportPreviewResponse(BaseModel):
    rows: List[BulkImportRowResult]
    total_rows: int
    valid_count: int
    invalid_count: int

class BulkImportExecuteRequest(BaseModel):
    file_id: str
    rows: List[BulkImportRowResult]

class BulkImportExecuteResponse(BaseModel):
    total_processed: int
    success_count: int
    failed_count: int
    failed_rows: List[BulkImportRowResult]
