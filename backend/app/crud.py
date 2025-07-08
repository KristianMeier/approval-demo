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