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