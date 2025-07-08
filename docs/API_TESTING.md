# 🧪 API Testing Guide
## Create Test Users
```bash
# Create manager
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@gov.dk",
    "name": "Manager Jensen",
    "role": "Manager"
  }'

# Create employee
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@gov.dk", 
    "name": "Medarbejder Hansen",
    "role": "Employee"
  }'
```

## List All Users
```bash
curl http://localhost:8000/users/
```

### Create Approval Request
```bash
curl -X POST "http://localhost:8000/approval-requests/?requester_id=2" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Nyt kontorudstyr",
    "description": "Har brug for ny laptop til arbejdet",
    "category": "IT",
    "priority": "medium",
    "amount": 15000,
    "approver_id": 1
  }'
```

### List All Requests
```bash
curl http://localhost:8000/approval-requests/
```

### Approve Request (assuming ID 1)
```bash
curl -X PUT "http://localhost:8000/approval-requests/1?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "comment": "Godkendt - nødvendigt udstyr"
  }'
```

### Reject Request (assuming ID 2)
```bash
curl -X PUT "http://localhost:8000/approval-requests/2?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "comment": "Ikke i budgettet lige nu"
  }'
```

### Add Comment
```bash
curl -X POST "http://localhost:8000/approval-requests/1/comments?content=Test%20comment&user_id=1&is_internal=false"
```

### Get Statistics
```bash
curl "http://localhost:8000/stats/?days=30"
```

### Get Overdue Requests
```bash
curl http://localhost:8000/stats/overdue
```

### WebSocket Connection
```bash
# Install wscat if not already installed
npm install -g wscat

# Connect to WebSocket
wscat -c ws://localhost:8000/ws/1?role=manager

# Once connected, send ping
> ping

# Should receive pong back
```

## Filtering and Search

### Filter by Status
```bash
curl "http://localhost:8000/approval-requests/?status=pending"
```

### Filter by Priority
```bash
curl "http://localhost:8000/approval-requests/?priority=high"
```

### Filter by Category
```bash
curl "http://localhost:8000/approval-requests/?category=IT"
```

### Search
```bash
curl "http://localhost:8000/approval-requests/?search=laptop"
```

### Combined Filters
```bash
curl "http://localhost:8000/approval-requests/?status=pending&priority=high&category=IT"
```

### Pagination
```bash
curl "http://localhost:8000/approval-requests/?skip=0&limit=10"
```

## Expected Responses

### Successful User Creation
```json
{
  "id": 1,
  "email": "manager@gov.dk",
  "name": "Manager Jensen",
  "role": "Manager",
  "department": null,
  "phone": null,
  "is_active": true,
  "created_at": "2024-01-15T12:00:00",
  "last_login": null
}
```

### Successful Request Creation
```json
{
  "id": 1,
  "title": "Nyt kontorudstyr",
  "description": "Har brug for ny laptop til arbejdet",
  "category": "IT",
  "priority": "medium",
  "status": "pending",
  "amount": 15000,
  "reference_number": "REQ-20240115-0001",
  "requester": {...},
  "approver": {...},
  "comments": []
}
```

### Request List Response
```json
{
  "requests": [...],
  "total": 10,
  "page": 1,
  "per_page": 20
}
```

### Statistics Response
```json
{
  "total_requests": 25,
  "pending_requests": 5,
  "approved_requests": 15,
  "rejected_requests": 5,
  "avg_processing_time_hours": 24.5,
  "requests_by_priority": {
    "low": 5,
    "medium": 10,
    "high": 8,
    "urgent": 2
  },
  "requests_by_category": {
    "IT": 10,
    "HR": 5,
    "Finance": 10
  }
}
```

## Error Responses

### 400 Bad Request
```json
{
  "detail": "Email allerede registreret"
}
```

### 404 Not Found
```json
{
  "detail": "Bruger ikke fundet"
}
```

### 422 Validation Error
```json
{
  "detail": [
    {
      "loc": ["body", "title"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

## Using the API Documentation

FastAPI provides automatic interactive documentation:
1. Open http://localhost:8000/docs
2. Click on any endpoint to expand
3. Click "Try it out"
4. Fill in parameters
5. Click "Execute"

Alternative documentation at http://localhost:8000/redoc