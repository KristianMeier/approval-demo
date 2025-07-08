# 🏛️ Politisk Godkendelsessystem

Et sikkert, on-premise godkendelsessystem til politiske kontorer med real-time notifikationer og komplet audit trail.

# Prompt link
https://claude.ai/chat/ef9104e0-6985-4775-bf67-28dcc77b2d28

## 🏛️ Systemfunktioner

- **Godkendelsesworkflow**: Anmod → Godkend → Afslut
- **Real-time opdateringer**: WebSocket notifikationer
- **Rolle-baseret adgang**: Forskellige brugerrettigheder
- **Prioritetsrouting**: Kritiske sager behandles først
- **Audit trail**: Komplet sporbarhed
- **GDPR compliance**: Databeskyttelse

## 🛡️ Sikkerhed og Teknologi

**Sikkerhedsfeatures**:
- Database kryptering
- Session management med timeout
- Rate limiting
- Komplet aktivitetslog

**Teknisk stack**:
- Backend: FastAPI (Python 3.11+)
- Frontend: Angular (TypeScript)
- Database: PostgreSQL
- Real-time: WebSockets
- Deployment: Docker Compose

**Systemkrav**:
- Docker & Docker Compose
- 2GB RAM minimum
- Node.js 18+ (udvikling)

## 📊 Kapacitet

- Optimeret til 50+ godkendelser/dag
- Skalerbar arkitektur
- Tilpasset små-mellemstore kontorer

## 🚨 Troubleshooting

| Problem | Løsning |
|---------|---------|
| Docker fejl | `docker-compose down && docker-compose up --build` |
| Port i brug | `docker-compose down` eller skift port |
| Frontend ikke tilgængelig | Vent 2-3 minutter på Angular build |

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