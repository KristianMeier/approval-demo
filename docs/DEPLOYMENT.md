# 🚀 Deployment Guide
## Docker Deployment
```bash
# Clone the repository
git clone [repository-url]
cd approval-demo

# Start all services
docker-compose up -d --build
```

## Port Configuration

Default ports (can be changed in docker-compose.yml):
- Frontend: 4200
- Backend API: 8000
- PostgreSQL: 5432

## Health Checks
```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "approval-system",
  "database": "healthy",
  "websocket_connections": 0,
  "timestamp": "2024-01-15T12:00:00"
}
```