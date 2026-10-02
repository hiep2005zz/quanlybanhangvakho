from typing import List, Optional
from pydantic import BaseModel

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
