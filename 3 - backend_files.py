# backend/Dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create logs directory
RUN mkdir -p logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

---
# backend/requirements.txt
fastapi==0.104.1
uvicorn[standard]==0.24.0
sqlalchemy==2.0.23
psycopg2-binary==2.9.9
pydantic==2.5.0
python-multipart==0.0.6
python-jose[cryptography]==3.3.0
passlib[bcrypt]==1.7.4
asyncpg==0.29.0

---
# backend/app/__init__.py
"""
Politisk Godkendelsessystem API

Et sikkert, on-premise system til håndtering af godkendelsesworkflows
i politiske kontorer og statslige institutioner.
"""

__version__ = "1.0.0"
__author__ = "System Administrator"
__description__ = "Sikker godkendelsesworkflow til politisk brug"

---
# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
import os
import logging

logger = logging.getLogger(__name__)

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL", 
    "postgresql://approval_user:secure_password@localhost/approvals"
)

# Create engine with connection pooling
engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,  # Verify connections before use
    echo=True if os.getenv("DEBUG") == "true" else False
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """Database dependency for FastAPI"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_database():
    """Initialize database tables"""
    try:
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables created successfully")
    except Exception as e:
        logger.error(f"Error creating database tables: {e}")
        raise

def check_database_connection():
    """Check if database is accessible"""
    try:
        db = SessionLocal()
        db.execute("SELECT 1")
        db.close()
        return True
    except Exception as e:
        logger.error(f"Database connection failed: {e}")
        return False

---
# backend/app/models.py
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Enum, Boolean
from sqlalchemy.relationship import relationship
from sqlalchemy.sql import func
from .database import Base
import enum
from datetime import datetime

class ApprovalStatus(enum.Enum):
    """Status for godkendelsesanmodninger"""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ESCALATED = "escalated"
    CANCELLED = "cancelled"

class Priority(enum.Enum):
    """Prioritetsniveauer for anmodninger"""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    URGENT = "urgent"

class UserRole(enum.Enum):
    """Brugerroller i systemet"""
    EMPLOYEE = "employee"
    MANAGER = "manager"
    SENIOR_MANAGER = "senior_manager"
    ADMIN = "admin"

class User(Base):
    """Brugertabel - alle systembrugere"""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    role = Column(String, nullable=False)  # Will use UserRole enum values
    department = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    last_login = Column(DateTime(timezone=True), nullable=True)
    
    # Relationships
    submitted_requests = relationship(
        "ApprovalRequest", 
        foreign_keys="ApprovalRequest.requester_id", 
        back_populates="requester"
    )
    assigned_requests = relationship(
        "ApprovalRequest", 
        foreign_keys="ApprovalRequest.approver_id", 
        back_populates="approver"
    )
    audit_entries = relationship("AuditLog", back_populates="user")

class ApprovalRequest(Base):
    """Godkendelsesanmodninger - hovedtabel"""
    __tablename__ = "approval_requests"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, index=True, nullable=False)
    description = Column(Text, nullable=False)
    category = Column(String, nullable=False)
    priority = Column(Enum(Priority), default=Priority.MEDIUM)
    status = Column(Enum(ApprovalStatus), default=ApprovalStatus.PENDING)
    
    # Financial information
    amount = Column(Integer, nullable=True)  # Amount in øre (Danish currency)
    currency = Column(String, default="DKK")
    
    # User relationships
    requester_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    approver_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    approved_at = Column(DateTime(timezone=True), nullable=True)
    due_date = Column(DateTime(timezone=True), nullable=True)
    
    # Additional metadata
    reference_number = Column(String, unique=True, nullable=True)
    external_reference = Column(String, nullable=True)
    confidentiality_level = Column(String, default="normal")  # normal, confidential, secret
    
    # Relationships
    requester = relationship("User", foreign_keys=[requester_id], back_populates="submitted_requests")
    approver = relationship("User", foreign_keys=[approver_id], back_populates="assigned_requests")
    comments = relationship("ApprovalComment", back_populates="request", cascade="all, delete-orphan")
    audit_entries = relationship("AuditLog", back_populates="approval_request")

class ApprovalComment(Base):
    """Kommentarer til godkendelsesanmodninger"""
    __tablename__ = "approval_comments"
    
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)  # Internal notes vs public comments
    
    # Relationships
    request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    request = relationship("ApprovalRequest", back_populates="comments")
    user = relationship("User")

class AuditLog(Base):
    """Audit log - sporing af alle systemhændelser"""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, index=True)
    action = Column(String, nullable=False)  # CREATE, UPDATE, DELETE, LOGIN, etc.
    entity_type = Column(String, nullable=False)  # USER, APPROVAL_REQUEST, etc.
    entity_id = Column(Integer, nullable=True)
    
    # Details
    old_values = Column(Text, nullable=True)  # JSON string of old values
    new_values = Column(Text, nullable=True)  # JSON string of new values
    ip_address = Column(String, nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Relationships
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    approval_request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="audit_entries")
    approval_request = relationship("ApprovalRequest", back_populates="audit_entries")

class SystemConfig(Base):
    """Systemkonfiguration"""
    __tablename__ = "system_config"
    
    id = Column(Integer, primary_key=True, index=True)
    key = Column(String, unique=True, nullable=False)
    value = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    is_sensitive = Column(Boolean, default=False)  # For passwords, tokens, etc.
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

---
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

---
# backend/app/crud.py
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, desc
from . import models, schemas
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import logging
import json

logger = logging.getLogger(__name__)

# User CRUD operations
def create_user(db: Session, user: schemas.UserCreate):
    """Opret ny bruger"""
    db_user = models.User(**user.dict())
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    logger.info(f"Created user: {db_user.email}")
    return db_user

def get_user(db: Session, user_id: int):
    """Hent bruger på ID"""
    return db.query(models.User).filter(models.User.id == user_id).first()

def get_user_by_email(db: Session, email: str):
    """Hent bruger på email"""
    return db.query(models.User).filter(models.User.email == email).first()

def get_users(db: Session, skip: int = 0, limit: int = 100):
    """Hent alle brugere med pagination"""
    return db.query(models.User).filter(models.User.is_active == True).offset(skip).limit(limit).all()

def update_user(db: Session, user_id: int, user_update: schemas.UserUpdate):
    """Opdater bruger"""
    db_user = db.query(models.User).filter(models.User.id == user_id).first()
    if not db_user:
        return None
    
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_user, field, value)
    
    db.commit()
    db.refresh(db_user)
    logger.info(f"Updated user: {db_user.email}")
    return db_user

# Approval Request CRUD operations
def create_approval_request(db: Session, request: schemas.ApprovalRequestCreate, requester_id: int):
    """Opret ny godkendelsesanmodning"""
    db_request = models.ApprovalRequest(**request.dict(), requester_id=requester_id)
    
    # Generate reference number
    db_request.reference_number = f"REQ-{datetime.now().strftime('%Y%m%d')}-{db_request.id or 'TMP'}"
    
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    
    # Update reference number with actual ID
    db_request.reference_number = f"REQ-{datetime.now().strftime('%Y%m%d')}-{db_request.id:04d}"
    db.commit()
    db.refresh(db_request)
    
    logger.info(f"Created approval request: {db_request.reference_number}")
    return db_request

def get_approval_request(db: Session, request_id: int):
    """Hent enkelt godkendelsesanmodning"""
    return db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == request_id).first()

def get_approval_requests(
    db: Session, 
    skip: int = 0, 
    limit: int = 20,
    status: Optional[str] = None,
    priority: Optional[str] = None,
    category: Optional[str] = None,
    approver_id: Optional[int] = None,
    requester_id: Optional[int] = None,
    search: Optional[str] = None
):
    """Hent godkendelsesanmodninger med filtre og søgning"""
    query = db.query(models.ApprovalRequest)
    
    # Apply filters
    if status:
        query = query.filter(models.ApprovalRequest.status == status)
    if priority:
        query = query.filter(models.ApprovalRequest.priority == priority)
    if category:
        query = query.filter(models.ApprovalRequest.category == category)
    if approver_id:
        query = query.filter(models.ApprovalRequest.approver_id == approver_id)
    if requester_id:
        query = query.filter(models.ApprovalRequest.requester_id == requester_id)
    
    # Search in title and description
    if search:
        search_filter = or_(
            models.ApprovalRequest.title.ilike(f"%{search}%"),
            models.ApprovalRequest.description.ilike(f"%{search}%"),
            models.ApprovalRequest.reference_number.ilike(f"%{search}%")
        )
        query = query.filter(search_filter)
    
    # Order by priority and creation date
    priority_order = {
        'urgent': 1,
        'high': 2,
        'medium': 3,
        'low': 4
    }
    
    total = query.count()
    
    # Order by priority (urgent first) then by creation date (newest first)
    requests = query.order_by(
        desc(models.ApprovalRequest.created_at)
    ).offset(skip).limit(limit).all()
    
    return {"requests": requests, "total": total}

def update_approval_request(
    db: Session, 
    request_id: int, 
    update: schemas.ApprovalRequestUpdate, 
    user_id: int
):
    """Opdater godkendelsesanmodning"""
    db_request = db.query(models.ApprovalRequest).filter(models.ApprovalRequest.id == request_id).first()
    if not db_request:
        return None
    
    old_status = db_request.status
    
    # Update status
    db_request.status = update.status
    db_request.updated_at = datetime.utcnow()
    
    # Set approval timestamp for final decisions
    if update.status in [models.ApprovalStatus.APPROVED, models.ApprovalStatus.REJECTED]:
        db_request.approved_at = datetime.utcnow()
    
    # Handle escalation
    if update.approver_id:
        db_request.approver_id = update.approver_id
    
    # Add comment if provided
    if update.comment:
        comment = models.ApprovalComment(
            content=update.comment,
            request_id=request_id,
            user_id=user_id,
            is_internal=False
        )
        db.add(comment)
    
    # Create audit log entry
    audit_entry = models.AuditLog(
        action="UPDATE",
        entity_type="APPROVAL_REQUEST",
        entity_id=request_id,
        user_id=user_id,
        old_values=json.dumps({"status": old_status.value}),
        new_values=json.dumps({"status": update.status.value})
    )
    db.add(audit_entry)
    
    db.commit()
    db.refresh(db_request)
    
    logger.info(f"Updated approval request {db_request.reference_number}: {old_status.value} -> {update.status.value}")
    return db_request

# Comment operations
def add_comment(db: Session, request_id: int, user_id: int, content: str, is_internal: bool = False):
    """Tilføj kommentar til anmodning"""
    comment = models.ApprovalComment(
        content=content,
        request_id=request_id,
        user_id=user_id,
        is_internal=is_internal
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    logger.info(f"Added comment to request {request_id}")
    return comment

# Statistics and reporting
def get_approval_stats(db: Session, days: int = 30) -> schemas.ApprovalStats:
    """Hent statistikker for godkendelser"""
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    # Basic counts
    total_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.created_at >= cutoff_date
    ).count()
    
    pending_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.status == models.ApprovalStatus.PENDING,
        models.ApprovalRequest.created_at >= cutoff_date
    ).count()
    
    approved_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.status == models.ApprovalStatus.APPROVED,
        models.ApprovalRequest.created_at >= cutoff_date
    ).count()
    
    rejected_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.status == models.ApprovalStatus.REJECTED,
        models.ApprovalRequest.created_at >= cutoff_date
    ).count()
    
    # Average processing time
    completed_requests = db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.approved_at.isnot(None),
        models.ApprovalRequest.created_at >= cutoff_date
    ).all()
    
    if completed_requests:
        total_time = sum([
            (req.approved_at - req.created_at).total_seconds() 
            for req in completed_requests
        ])
        avg_processing_time_hours = total_time / len(completed_requests) / 3600
    else:
        avg_processing_time_hours = 0.0
    
    # Requests by priority
    priority_stats = db.query(
        models.ApprovalRequest.priority,
        func.count(models.ApprovalRequest.id)
    ).filter(
        models.ApprovalRequest.created_at >= cutoff_date
    ).group_by(models.ApprovalRequest.priority).all()
    
    requests_by_priority = {str(priority.value): count for priority, count in priority_stats}
    
    # Requests by category
    category_stats = db.query(
        models.ApprovalRequest.category,
        func.count(models.ApprovalRequest.id)
    ).filter(
        models.ApprovalRequest.created_at >= cutoff_date
    ).group_by(models.ApprovalRequest.category).all()
    
    requests_by_category = {category: count for category, count in category_stats}
    
    return schemas.ApprovalStats(
        total_requests=total_requests,
        pending_requests=pending_requests,
        approved_requests=approved_requests,
        rejected_requests=rejected_requests,
        avg_processing_time_hours=avg_processing_time_hours,
        requests_by_priority=requests_by_priority,
        requests_by_category=requests_by_category
    )

def get_overdue_requests(db: Session) -> List[models.ApprovalRequest]:
    """Hent forfaldne anmodninger"""
    return db.query(models.ApprovalRequest).filter(
        models.ApprovalRequest.status == models.ApprovalStatus.PENDING,
        models.ApprovalRequest.due_date < datetime.utcnow()
    ).all()

def create_audit_log(
    db: Session,
    action: str,
    entity_type: str,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    old_values: Optional[Dict] = None,
    new_values: Optional[Dict] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
):
    """Opret audit log entry"""
    audit_entry = models.AuditLog(
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        user_id=user_id,
        old_values=json.dumps(old_values) if old_values else None,
        new_values=json.dumps(new_values) if new_values else None,
        ip_address=ip_address,
        user_agent=user_agent
    )
    db.add(audit_entry)
    db.commit()
    return audit_entry

---
# backend/app/websocket_manager.py
from typing import Dict, List, Set
from fastapi import WebSocket, WebSocketDisconnect
import json
from datetime import datetime
import logging
import asyncio

logger = logging.getLogger(__name__)

class ConnectionManager:
    """WebSocket forbindelseshåndtering for real-time notifikationer"""
    
    def __init__(self):
        # Active connections: user_id -> list of websocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        
        # User roles for targeted messaging
        self.user_roles: Dict[WebSocket, str] = {}
        
        # Connection metadata
        self.connection_metadata: Dict[WebSocket, Dict] = {}
        
        # Statistics
        self.total_connections = 0
        self.messages_sent = 0
    
    async def connect(self, websocket: WebSocket, user_id: int, role: str = "user"):
        """Etabler WebSocket forbindelse"""
        try:
            await websocket.accept()
            
            # Add to active connections
            if user_id not in self.active_connections:
                self.active_connections[user_id] = []
            
            self.active_connections[user_id].append(websocket)
            self.user_roles[websocket] = role
            self.connection_metadata[websocket] = {
                "user_id": user_id,
                "role": role,
                "connected_at": datetime.utcnow(),
                "last_ping": datetime.utcnow()
            }
            
            self.total_connections += 1
            
            logger.info(f"User {user_id} ({role}) connected via WebSocket. Total connections: {self.total_connections}")
            
            # Send welcome message
            await self.send_personal_message({
                "type": "connection_established",
                "message": "Real-time forbindelse etableret",
                "timestamp": datetime.utcnow().isoformat(),
                "user_id": user_id
            }, websocket)
            
        except Exception as e:
            logger.error(f"Error connecting user {user_id}: {e}")
            raise
    
    def disconnect(self, websocket: WebSocket):
        """Afbryd WebSocket forbindelse"""
        user_id = None
        
        # Find and remove connection
        for uid, connections in self.active_connections.items():
            if websocket in connections:
                user_id = uid
                connections.remove(websocket)
                if not connections:
                    del self.active_connections[uid]
                break
        
        # Clean up metadata
        if websocket in self.user_roles:
            del self.user_roles[websocket]
        
        if websocket in self.connection_metadata:
            del self.connection_metadata[websocket]
        
        self.total_connections = max(0, self.total_connections - 1)
        
        logger.info(f"User {user_id} disconnected. Total connections: {self.total_connections}")
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        """Send besked til specifik WebSocket forbindelse"""
        try:
            await websocket.send_text(json.dumps(message, default=str))
            self.messages_sent += 1
        except WebSocketDisconnect:
            logger.warning("WebSocket disconnected during message send")
            self.disconnect(websocket)
        except Exception as e:
            logger.error(f"Error sending personal message: {e}")
    
    async def send_to_user(self, message: dict, user_id: int):
        """Send besked til alle forbindelser for en specifik bruger"""
        if user_id not in self.active_connections:
            logger.debug(f"No active connections for user {user_id}")
            return
        
        # Add timestamp if not present
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        dead_connections = []
        sent_count = 0
        
        for connection in self.active_connections[user_id]:
            try:
                await connection.send_text(json.dumps(message, default=str))
                sent_count += 1
                self.messages_sent += 1
            except WebSocketDisconnect:
                dead_connections.append(connection)
            except Exception as e:
                logger.error(f"Error sending message to user {user_id}: {e}")
                dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        if sent_count > 0:
            logger.debug(f"Sent message to user {user_id} on {sent_count} connections")
    
    async def send_to_role(self, message: dict, role: str):
        """Send besked til alle brugere med specifik rolle"""
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        sent_count = 0
        dead_connections = []
        
        for connection, conn_role in self.user_roles.items():
            if conn_role.lower() == role.lower():
                try:
                    await connection.send_text(json.dumps(message, default=str))
                    sent_count += 1
                    self.messages_sent += 1
                except WebSocketDisconnect:
                    dead_connections.append(connection)
                except Exception as e:
                    logger.error(f"Error sending message to role {role}: {e}")
                    dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        logger.info(f"Sent message to {sent_count} users with role '{role}'")
    
    async def broadcast_to_all(self, message: dict):
        """Send besked til alle forbundne brugere"""
        if "timestamp" not in message:
            message["timestamp"] = datetime.utcnow().isoformat()
        
        sent_count = 0
        dead_connections = []
        
        for user_connections in self.active_connections.values():
            for connection in user_connections:
                try:
                    await connection.send_text(json.dumps(message, default=str))
                    sent_count += 1
                    self.messages_sent += 1
                except WebSocketDisconnect:
                    dead_connections.append(connection)
                except Exception as e:
                    logger.error(f"Error broadcasting message: {e}")
                    dead_connections.append(connection)
        
        # Clean up dead connections
        for dead_conn in dead_connections:
            self.disconnect(dead_conn)
        
        logger.info(f"Broadcast message to {sent_count} connections")
    
    async def handle_ping_pong(self):
        """Håndter ping/pong for at holde forbindelser i live"""
        while True:
            try:
                dead_connections = []
                
                for connection, metadata in self.connection_metadata.items():
                    try:
                        # Send ping
                        await connection.send_text(json.dumps({
                            "type": "ping",
                            "timestamp": datetime.utcnow().isoformat()
                        }))
                        
                        # Update last ping time
                        metadata["last_ping"] = datetime.utcnow()
                        
                    except WebSocketDisconnect:
                        dead_connections.append(connection)
                    except Exception as e:
                        logger.error(f"Error sending ping: {e}")
                        dead_connections.append(connection)
                
                # Clean up dead connections
                for dead_conn in dead_connections:
                    self.disconnect(dead_conn)
                
                # Wait 30 seconds before next ping
                await asyncio.sleep(30)
                
            except Exception as e:
                logger.error(f"Error in ping/pong handler: {e}")
                await asyncio.sleep(30)
    
    def get_connection_stats(self) -> Dict:
        """Hent statistikker over forbindelser"""
        role_counts = {}
        for role in self.user_roles.values():
            role_counts[role] = role_counts.get(role, 0) + 1
        
        return {
            "total_connections": self.total_connections,
            "unique_users": len(self.active_connections),
            "messages_sent": self.messages_sent,
            "role_distribution": role_counts,
            "active_users": list(self.active_connections.keys())
        }

# Global connection manager instance
manager = ConnectionManager()

---
# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from sqlalchemy.orm import Session
from typing import Optional, List
import asyncio
import logging
import os
from datetime import datetime

from . import crud, models, schemas
from .database import SessionLocal, engine, get_db, init_database, check_database_connection
from .websocket_manager import manager

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize database
try:
    init_database()
    if not check_database_connection():
        logger.error("Database connection failed at startup")
        raise Exception("Database connection failed")
except Exception as e:
    logger.error(f"Database initialization failed: {e}")
    raise

# Create FastAPI app
app = FastAPI(
    title="Politisk Godkendelsessystem API",
    description="Sikker API til håndtering af godkendelsesworkflows i politiske kontorer",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Security middleware
app.add_middleware(
    TrustedHostMiddleware, 
    allowed_hosts=["localhost", "127.0.0.1", "*.local", "*.internal"]
)

# CORS middleware for development
allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:4200").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    logger.info("Starting Politisk Godkendelsessystem API")
    
    # Start WebSocket ping/pong handler
    asyncio.create_task(manager.handle_ping_pong())
    
    logger.info("API started successfully")

@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    logger.info("Shutting down API")

# Root endpoint
@app.get("/")
def read_root():
    """Root endpoint med system information"""
    return {
        "message": "Politisk Godkendelsessystem API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health_check(db: Session = Depends(get_db)):
    """Sundhedstjek for systemet"""
    try:
        # Test database connection
        db.execute("SELECT 1")
        db_status = "healthy"
    except Exception as e:
        logger.error(f"Database health check failed: {e}")
        db_status = "unhealthy"
        raise HTTPException(status_code=503, detail="Database connection failed")
    
    stats = manager.get_connection_stats()
    
    return {
        "status": "healthy",
        "service": "approval-system",
        "database": db_status,
        "websocket_connections": stats["total_connections"],
        "timestamp": datetime.utcnow().isoformat()
    }

# WebSocket endpoint
@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int, role: str = Query(default="user")):
    """WebSocket endpoint for real-time notifications"""
    await manager.connect(websocket, user_id, role)
    try:
        while True:
            data = await websocket.receive_text()
            
            # Handle ping/pong
            if data == "ping":
                await websocket.send_text("pong")
                continue
            
            # Handle other messages if needed
            try:
                message = json.loads(data)
                if message.get("type") == "subscribe":
                    # Handle subscription to specific events
                    logger.info(f"User {user_id} subscribed to {message.get('events', [])}")
            except:
                # Ignore malformed messages
                pass
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
        manager.disconnect(websocket)

# User endpoints
@app.post("/users/", response_model=schemas.User, status_code=201)
def create_user(user: schemas.UserCreate, request: Request, db: Session = Depends(get_db)):
    """Opret ny bruger"""
    # Check if user already exists
    db_user = crud.get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email allerede registreret")
    
    db_user = crud.create_user(db=db, user=user)
    
    # Create audit log
    crud.create_audit_log(
        db=db,
        action="CREATE",
        entity_type="USER",
        entity_id=db_user.id,
        ip_address=request.client.host if request.client else None
    )
    
    return db_user

@app.get("/users/", response_model=List[schemas.User])
def get_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Hent alle brugere"""
    return crud.get_users(db, skip=skip, limit=limit)

@app.get("/users/{user_id}", response_model=schemas.User)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """Hent enkelt bruger"""
    db_user = crud.get_user(db, user_id=user_id)
    if db_user is None:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    return db_user

# Approval Request endpoints
@app.post("/approval-requests/", response_model=schemas.ApprovalRequest, status_code=201)
async def create_approval_request(
    request: schemas.ApprovalRequestCreate,
    requester_id: int = Query(..., description="ID på den person der anmoder"),
    request_obj: Request = None,
    db: Session = Depends(get_db)
):
    """Opret ny godkendelsesanmodning"""
    # Validate requester exists
    requester = crud.get_user(db, requester_id)
    if not requester:
        raise HTTPException(status_code=404, detail="Anmoder ikke fundet")
    
    # Validate approver exists
    approver = crud.get_user(db, request.approver_id)
    if not approver:
        raise HTTPException(status_code=404, detail="Godkender ikke fundet")
    
    db_request = crud.create_approval_request(db=db, request=request, requester_id=requester_id)
    
    # Create audit log
    crud.create_audit_log(
        db=db,
        action="CREATE",
        entity_type="APPROVAL_REQUEST",
        entity_id=db_request.id,
        user_id=requester_id,
        new_values={
            "title": db_request.title,
            "status": db_request.status.value,
            "approver_id": db_request.approver_id
        },
        ip_address=request_obj.client.host if request_obj and request_obj.client else None
    )
    
    # Send real-time notification til godkender
    await manager.send_to_user({
        "type": "new_request",
        "request_id": db_request.id,
        "title": db_request.title,
        "priority": db_request.priority.value,
        "requester_name": db_request.requester.name,
        "amount": db_request.amount,
        "message": f"Ny godkendelsesanmodning: {db_request.title}",
        "reference_number": db_request.reference_number
    }, db_request.approver_id)
    
    # Notify managers
    await manager.send_to_role({
        "type": "approval_assigned",
        "request_id": db_request.id,
        "title": db_request.title,
        "priority": db_request.priority.value,
        "message": f"Ny anmodning tildelt: {db_request.title}"
    }, "manager")
    
    return db_request

@app.get("/approval-requests/", response_model=schemas.ApprovalRequestList)
def read_approval_requests(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter på status"),
    priority: Optional[str] = Query(None, description="Filter på prioritet"),
    category: Optional[str] = Query(None, description="Filter på kategori"),
    approver_id: Optional[int] = Query(None, description="Filter på godkender"),
    requester_id: Optional[int] = Query(None, description="Filter på anmoder"),
    search: Optional[str] = Query(None, description="Søg i titel og beskrivelse"),
    db: Session = Depends(get_db)
):
    """Hent godkendelsesanmodninger med filtre"""
    result = crud.get_approval_requests(
        db, 
        skip=skip, 
        limit=limit, 
        status=status,
        priority=priority,
        category=category,
        approver_id=approver_id,
        requester_id=requester_id,
        search=search
    )
    
    return schemas.ApprovalRequestList(
        requests=result["requests"],
        total=result["total"],
        page=skip // limit + 1,
        per_page=limit
    )

@app.get("/approval-requests/{request_id}", response_model=schemas.ApprovalRequest)
def read_approval_request(request_id: int, db: Session = Depends(get_db)):
    """Hent enkelt godkendelsesanmodning"""
    db_request = crud.get_approval_request(db, request_id=request_id)
    if db_request is None:
        raise HTTPException(status_code=404, detail="Anmodning ikke fundet")
    return db_request

@app.put("/approval-requests/{request_id}", response_model=schemas.ApprovalRequest)
async def update_approval_request(
    request_id: int,
    update: schemas.ApprovalRequestUpdate,
    user_id: int = Query(..., description="ID på den bruger der opdaterer"),
    request_obj: Request = None,
    db: Session = Depends(get_db)
):
    """Opdater godkendelsesanmodning (godkend/afvis)"""
    # Validate user exists
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    
    db_request = crud.update_approval_request(
        db, request_id=request_id, update=update, user_id=user_id
    )
    
    if not db_request:
        raise HTTPException(status_code=404, detail="Anmodning ikke fundet")
    
    # Send real-time notification til anmoder
    status_text = {
        "approved": "godkendt",
        "rejected": "afvist",
        "escalated": "eskaleret"
    }.get(update.status.value, update.status.value)
    
    await manager.send_to_user({
        "type": "status_update",
        "request_id": db_request.id,
        "status": db_request.status.value,
        "title": db_request.title,
        "decided_by": user.name,
        "message": f"Din anmodning '{db_request.title}' er blevet {status_text}",
        "reference_number": db_request.reference_number
    }, db_request.requester_id)
    
    # Notify managers of decision
    await manager.send_to_role({
        "type": "approval_decision",
        "request_id": db_request.id,
        "status": db_request.status.value,
        "title": db_request.title,
        "decided_by": user.name,
        "message": f"Beslutning truffet: {db_request.title} - {status_text}"
    }, "manager")
    
    return db_request

# Statistics endpoint
@app.get("/stats/", response_model=schemas.ApprovalStats)
def get_approval_statistics(
    days: int = Query(30, ge=1, le=365, description="Antal dage at inkludere"),
    db: Session = Depends(get_db)
):
    """Hent statistikker over godkendelser"""
    return crud.get_approval_stats(db, days=days)

@app.get("/stats/overdue")
def get_overdue_requests(db: Session = Depends(get_db)):
    """Hent forfaldne anmodninger"""
    overdue = crud.get_overdue_requests(db)
    return {
        "count": len(overdue),
        "requests": [
            {
                "id": req.id,
                "title": req.title,
                "reference_number": req.reference_number,
                "due_date": req.due_date,
                "days_overdue": (datetime.utcnow() - req.due_date).days,
                "approver": req.approver.name
            }
            for req in overdue
        ]
    }

# WebSocket statistics
@app.get("/stats/websocket")
def get_websocket_stats():
    """Hent WebSocket statistikker"""
    return manager.get_connection_stats()

# Comment endpoints
@app.post("/approval-requests/{request_id}/comments")
async def add_comment_to_request(
    request_id: int,
    content: str = Query(..., description="Kommentar indhold"),
    user_id: int = Query(..., description="Bruger ID"),
    is_internal: bool = Query(False, description="Er det en intern kommentar"),
    db: Session = Depends(get_db)
):
    """Tilføj kommentar til godkendelsesanmodning"""
    # Validate request exists
    db_request = crud.get_approval_request(db, request_id)
    if not db_request:
        raise HTTPException(status_code=404, detail="Anmodning ikke fundet")
    
    # Validate user exists
    user = crud.get_user(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Bruger ikke fundet")
    
    comment = crud.add_comment(db, request_id, user_id, content, is_internal)
    
    # Send real-time notification (only for public comments)
    if not is_internal:
        await manager.send_to_user({
            "type": "new_comment",
            "request_id": request_id,
            "comment_id": comment.id,
            "user_name": user.name,
            "content_preview": content[:100] + "..." if len(content) > 100 else content,
            "message": f"Ny kommentar på '{db_request.title}'"
        }, db_request.requester_id if user_id != db_request.requester_id else db_request.approver_id)
    
    return {"message": "Kommentar tilføjet", "comment_id": comment.id}

# Error handlers
@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=404,
        content={"detail": "Ressource ikke fundet", "path": str(request.url)}
    )

@app.exception_handler(500)
async def internal_error_handler(request: Request, exc: Exception):
    logger.error(f"Internal server error: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Intern serverfejl", "type": "internal_error"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )