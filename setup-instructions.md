# 1. Mappestruktur og Setup Instruktioner

## 📁 Mappestruktur

```
approval-demo/
├── docker-compose.yml
├── .env
├── logs/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── __init__.py
│       ├── main.py
│       ├── database.py
│       ├── models.py
│       ├── schemas.py
│       ├── crud.py
│       └── websocket_manager.py
└── frontend/
    ├── Dockerfile
    ├── package.json
    ├── angular.json
    ├── tsconfig.json
    ├── tsconfig.app.json
    ├── src/
    │   ├── index.html
    │   ├── main.ts
    │   ├── styles.css
    │   └── app/
    │       ├── app.module.ts
    │       ├── app.component.ts
    │       ├── services/
    │       │   └── approval.service.ts
    │       ├── models/
    │       │   └── approval.model.ts
    │       └── components/
    │           ├── approval-list.component.ts
    │           └── create-request.component.ts
```

## 🛠️ Setup Instruktioner

### Trin 1: Installer Angular CLI
```bash
npm install -g @angular/cli
```

### Trin 2: Opret projekt struktur
```bash
mkdir approval-demo
cd approval-demo

# Opret Angular projekt
ng new frontend --routing=false --style=css --skip-git

# Opret backend struktur
mkdir -p backend/app
mkdir logs
```

### Trin 3: Generer Angular komponenter
```bash
cd frontend

# Generer services og komponenter
ng generate service services/approval --skip-tests
ng generate component components/approval-list --skip-tests
ng generate component components/create-request --skip-tests

# Opret models mappe
mkdir src/app/models

cd ..
```

### Trin 4: Kopier alle filer
- Kopier filer fra Artefakt 2 (Docker & Config)
- Kopier filer fra Artefakt 3 (Backend)
- Kopier filer fra Artefakt 4 (Frontend)

## 🚀 Start Systemet

### Trin 1: Start med Docker
```bash
# Fra approval-demo/ mappen
docker-compose up --build
```

### Trin 2: Vent på opstart
```
✅ Postgres: Klar på port 5432
✅ Backend: Klar på port 8000 
✅ Frontend: Klar på port 4200
```

### Trin 3: Åbn browser
- **Frontend**: http://localhost:4200
- **Backend API**: http://localhost:8000
- **API Dokumentation**: http://localhost:8000/docs

## 🧪 Test Backend med cURL

### Test 1: Sundhedstjek
```bash
curl http://localhost:8000/health
```
**Forventet svar:**
```json
{"status":"healthy","service":"approval-system"}
```

### Test 2: Opret test brugere
```bash
# Opret manager
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@gov.dk",
    "name": "Manager Jensen",
    "role": "Manager"
  }'

# Opret medarbejder
curl -X POST "http://localhost:8000/users/" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee@gov.dk", 
    "name": "Medarbejder Hansen",
    "role": "Employee"
  }'
```

### Test 3: Vis alle brugere
```bash
curl http://localhost:8000/users/
```

### Test 4: Opret godkendelsesanmodning
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

### Test 5: Vis alle anmodninger
```bash
curl http://localhost:8000/approval-requests/
```

### Test 6: Godkend anmodning (ID 1)
```bash
curl -X PUT "http://localhost:8000/approval-requests/1?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "comment": "Godkendt - nødvendigt udstyr"
  }'
```

### Test 7: Afvis anmodning (hvis du har ID 2)
```bash
curl -X PUT "http://localhost:8000/approval-requests/2?user_id=1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "comment": "Ikke i budgettet lige nu"
  }'
```

### Test 8: WebSocket test
```bash
# Test WebSocket forbindelse (kræver wscat)
npm install -g wscat
wscat -c ws://localhost:8000/ws/1
```

## ✅ Forventede Resultater

**Efter succesfuld opstart:**
- Frontend viser "Godkendelsessystem" interface
- Backend API svarer på alle endpoints
- PostgreSQL database er oprettet med tabeller
- WebSocket forbindelse etableret
- Real-time notifikationer virker

**Hvis der er problemer:**
```bash
# Check container status
docker-compose ps

# Check logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs postgres

# Restart specifik service
docker-compose restart backend
```

## 📋 Tjekliste

- [ ] Angular CLI installeret
- [ ] Projekt struktur oprettet
- [ ] Alle filer kopieret korrekt
- [ ] Docker containers startet
- [ ] Backend API svarer
- [ ] Frontend tilgængelig
- [ ] Test brugere oprettet
- [ ] WebSocket forbindelse aktiv
- [ ] Kan oprette og godkende anmodninger

**Status: Klar til brug! 🎉**