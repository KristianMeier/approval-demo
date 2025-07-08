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