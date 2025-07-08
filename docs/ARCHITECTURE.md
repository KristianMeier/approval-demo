# 🏗️ System Architecture

## Overview

POC for an on-premise approval system using Angular, FastAPI, and PostgreSQL.

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | Angular 17 | User interface |
| Backend | FastAPI (Python 3.11) | REST API and WebSocket server |
| Database | PostgreSQL 15 | Data storage |
| Real-time | WebSockets | Live notifications |
| Container | Docker Compose | Local deployment |

## System Components

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Angular SPA    │────▶│  FastAPI Backend│────▶│  PostgreSQL DB  │
│  (port 4200)    │     │  (port 8000)    │     │  (port 5432)    │
└────────┬────────┘     └────────┬────────┘     └─────────────────┘
         │                       │
         │    WebSocket         │
         └───────────────────────┘
```

## Database Schema

### Tables
- `users` - System users (id, email, name, role, department)
- `approval_requests` - Approval requests with status tracking
- `approval_comments` - Comments on requests
- `audit_logs` - Complete activity tracking
- `system_config` - System configuration

### Key Fields in approval_requests
- `title`, `description` - Request details
- `category` - Type of request
- `priority` - low, medium, high, urgent
- `status` - pending, approved, rejected, escalated, cancelled
- `amount` - Optional monetary value
- `requester_id`, `approver_id` - User relationships

## API Endpoints

### Users
- `POST /users/` - Create user
- `GET /users/` - List users
- `GET /users/{id}` - Get specific user

### Approval Requests
- `POST /approval-requests/` - Create request
- `GET /approval-requests/` - List requests (with filters)
- `GET /approval-requests/{id}` - Get specific request
- `PUT /approval-requests/{id}` - Update request status
- `POST /approval-requests/{id}/comments` - Add comment

### System
- `GET /health` - Health check
- `GET /stats/` - Statistics
- `GET /stats/overdue` - Overdue requests
- `GET /stats/websocket` - WebSocket statistics

## WebSocket Implementation

Connection: `ws://localhost:8000/ws/{user_id}?role={role}`

Message types handled:
- `new_request` - New approval request created
- `status_update` - Request status changed
- `approval_decision` - Request approved/rejected
- `new_comment` - Comment added
- `ping/pong` - Keep-alive

## Current Implementation

The POC demonstrates core functionality with:
- User management
- Request creation and approval workflow
- Real-time notifications via WebSocket
- Filtering and search capabilities
- Comment system
- Audit logging

## Extending for Multiple Workflows

The current implementation uses a `category` field that can be extended to support different workflow types:
- IT (current example)
- Database access
- Folder access
- Budget approval
- Other workflow types as needed

Each category can have:
- Different approval chains
- Specific validation rules
- Custom fields (stored in JSON)
- Different notification templates