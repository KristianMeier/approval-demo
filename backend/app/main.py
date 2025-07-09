# backend/app/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, Query, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy.sql import text
from typing import Optional, List
import asyncio
import logging
import os
import json
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
    title="Dst Approval Flows API",
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
    logger.info("Starting Dst Approval Flows API")
    
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
        "message": "Dst Approval Flows API",
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
        db.execute(text("SELECT 1"))
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