# 🏛️ Politisk Godkendelsessystem

Et sikkert, on-premise godkendelsessystem til politiske kontorer med real-time notifikationer og komplet audit trail.

# Prompt link
https://claude.ai/chat/ef9104e0-6985-4775-bf67-28dcc77b2d28

## 📚 Filstruktur og Navigation

| Fil | Formål | Hvornår |
|-----|--------|---------|
| `complete_system_overview.md` | Systemforståelse | Start her |
| `setup_instructions.md` | Installation og test | Nu (med internet) |
| `docker_config_files.txt` | Konfigurationsfiler | Kopiér til setup |
| `backend_files.py` | Python backend kode | Kopiér til backend/ |
| `frontend_files.ts` | Angular frontend kode | Kopiér til frontend/ |

## 🎯 Implementation Roadmap

### Test Setup
**Mål**: Funktionelt system på din PC med internet
- Følg `setup_instructions.md`
- Resultat: http://localhost:4200 virker
- Fokus: Lær systemet og test funktioner

## ⚡ Hurtig Start

```bash
# Opret projekt
mkdir approval-demo && cd approval-demo
ng new frontend --routing=false --style=css --skip-git
mkdir -p backend/app logs

# Kopiér filer fra dokumenterne
# docker_config_files.txt → docker-compose.yml + .env
# backend_files.py → backend/
# frontend_files.ts → frontend/

# Start system
docker-compose up --build

# Test endpoints
# Frontend: http://localhost:4200
# API docs: http://localhost:8000/docs
```

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

## ✅ Success Kriterier

Du er klar til næste fase når:
- Systemet starter uden fejl
- Test brugere kan oprettes
- Godkendelsesanmodninger fungerer
- Real-time notifikationer virker
- Basic workflow er forstået

---

**Bygget til dansk politik - Sikkerhed først** 🇩🇰