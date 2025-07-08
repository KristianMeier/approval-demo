# 🏛️ Approval Flow System POC

## 🎯 IMPORTANT: Project Context for Review

**What this is**: A Proof of Concept (POC) for an approval flow system that will handle ~25 different approval workflows such as Access to database or Equipment requests

**Why we need this**: We need functionality similar to Microsoft Power Automate, but we CANNOT use cloud services - everything must run on-premise/locally.

**Mandatory Requirements**: 
- ✅ Must use **Angular** (frontend)
- ✅ Must use **FastAPI** (backend)  
- ✅ Must use **PostgreSQL** (database)

## 🚀 Quick Start

```bash
# Start with Docker
docker-compose up --build

# Wait for services to start:
# ✅ Postgres: Ready on port 5432
# ✅ Backend: Ready on port 8000 
# ✅ Frontend: Ready on port 4200
```

**Access points:**
- Frontend: http://localhost:4200
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📁 Documentation

- [Architecture](docs/ARCHITECTURE.md) - System design and technical details
- [Deployment](docs/DEPLOYMENT.md) - Installation and deployment instructions
- [API Testing](docs/API_TESTING.md) - Backend testing with cURL

## 📊 System Features

- **Approval workflow**: Request → Approve → Complete
- **Real-time updates**: WebSocket notifications
- **Role-based access**: Different user permissions
- **Priority routing**: Urgent cases handled first
- **Audit trail**: Complete traceability
- **100% on-premise**: No cloud dependencies