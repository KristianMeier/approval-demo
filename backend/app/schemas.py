# backend/app/schemas.py
from pydantic import BaseModel, EmailStr, validator
from datetime import datetime
from typing import Optional, List
from .models import ApprovalStatus, Priority, UserRole

class UserBase(BaseModel):
    email: EmailStr
    name: str
    role: str
    department: Optional[str] = None
    phone: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    department: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

class User(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class ApprovalRequestBase(BaseModel):
    title: str
    description: str
    category: str
    priority: Priority = Priority.MEDIUM
    amount: Optional[int] = None
    approver_id: int
    due_date: Optional[datetime] = None
    external_reference: Optional[str] = None
    confidentiality_level: str = "normal"

    @validator('title')
    def title_must_not_be_empty(cls, v):
        if not v.strip():
            raise ValueError('Titel må ikke være tom')
        return v

    @validator('amount')
    def amount_must_be_positive(cls, v):
        if v is not None and v < 0:
            raise ValueError('Beløb skal være positivt')
        return v

class ApprovalRequestCreate(ApprovalRequestBase):
    pass

class ApprovalRequestUpdate(BaseModel):
    status: ApprovalStatus
    comment: Optional[str] = None
    approver_id: Optional[int] = None  # For escalation

class ApprovalComment(BaseModel):
    id: int
    content: str
    is_internal: bool
    user_id: int
    created_at: datetime
    user: User
    
    class Config:
        from_attributes = True

class ApprovalRequest(ApprovalRequestBase):
    id: int
    status: ApprovalStatus
    requester_id: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    reference_number: Optional[str] = None
    
    requester: User
    approver: User
    comments: List[ApprovalComment] = []
    
    class Config:
        from_attributes = True

class ApprovalRequestList(BaseModel):
    requests: List[ApprovalRequest]
    total: int
    page: int
    per_page: int

class ApprovalStats(BaseModel):
    total_requests: int
    pending_requests: int
    approved_requests: int
    rejected_requests: int
    avg_processing_time_hours: float
    requests_by_priority: dict
    requests_by_category: dict

class AuditLogEntry(BaseModel):
    id: int
    action: str
    entity_type: str
    entity_id: Optional[int]
    user_id: Optional[int]
    created_at: datetime
    ip_address: Optional[str]
    
    class Config:
        from_attributes = True

class WebSocketMessage(BaseModel):
    type: str
    request_id: Optional[int] = None
    user_id: Optional[int] = None
    message: str
    timestamp: datetime
    data: Optional[dict] = None