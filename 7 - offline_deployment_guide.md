# 5. Offline Deployment Guide - Færdige Images

## 🎯 Strategi: Build på Udvikling → Deploy til Offline Produktion

Du har ret! Det er meget smartere at bygge alt på din udviklingsmaskine (med internet) og så kopiere færdige images til produktionsserveren.

## 📦 Hvad vi pakker ind i images:

### **Backend Image:**
- ✅ Python 3.11 runtime
- ✅ Alle pip pakker (FastAPI, SQLAlchemy, osv.)
- ✅ Applikationskode
- ✅ Alt er "baked in" - intet internet påkrævet

### **Frontend Image:**
- ✅ Node.js runtime + dependencies
- ✅ Kompileret Angular app (dist/ folder)
- ✅ Nginx til at serve filerne
- ✅ Alt er færdig bygget

### **Database Image:**
- ✅ Standard PostgreSQL image (download én gang)
- ✅ Kan køre helt offline

## 🛠️ TRIN 1: Byg Images på Udvikling (Med Internet)

### Opdaterede Dockerfiles til Produktion

#### backend/Dockerfile.prod
```dockerfile
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Create app user
RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

# Copy requirements and install ALL dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Final stage
FROM python:3.11-slim

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser appuser

# Copy installed packages from builder
COPY --from=builder /root/.local /home/appuser/.local

# Copy application code
WORKDIR /app
COPY . .
RUN chown -R appuser:appuser /app

# Switch to non-root user
USER appuser
ENV PATH=/home/appuser/.local/bin:$PATH

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### frontend/Dockerfile.prod
```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install ALL dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY . .

# Build production Angular app
RUN npm run build:prod

# Production stage
FROM nginx:alpine

# Copy built app from builder stage
COPY --from=builder /app/dist/frontend /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### frontend/nginx.prod.conf
```nginx
server {
    listen 80;
    server_name localhost;
    
    root /usr/share/nginx/html;
    index index.html;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    
    # Serve Angular app
    location / {
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }
    
    # API proxy til backend
    location /api/ {
        proxy_pass http://backend:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
    
    # WebSocket endpoint
    location /ws/ {
        proxy_pass http://backend:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

## 🏗️ TRIN 2: Build Script til Udvikling

### build-for-production.sh
```bash
#!/bin/bash

echo "🏗️  Bygger images til offline produktion..."

# Set image names
REGISTRY="approval-system"
VERSION="v1.0.0"

echo "📦 Bygger backend image..."
cd backend
docker build -f Dockerfile.prod -t $REGISTRY/backend:$VERSION .
docker tag $REGISTRY/backend:$VERSION $REGISTRY/backend:latest
cd ..

echo "📦 Bygger frontend image..."
cd frontend
docker build -f Dockerfile.prod -t $REGISTRY/frontend:$VERSION .
docker tag $REGISTRY/frontend:$VERSION $REGISTRY/frontend:latest
cd ..

echo "📦 Henter PostgreSQL image..."
docker pull postgres:15
docker tag postgres:15 $REGISTRY/postgres:15

echo "💾 Gemmer images til filer..."
mkdir -p ./docker-images

docker save $REGISTRY/backend:$VERSION | gzip > ./docker-images/backend-$VERSION.tar.gz
docker save $REGISTRY/frontend:$VERSION | gzip > ./docker-images/frontend-$VERSION.tar.gz
docker save $REGISTRY/postgres:15 | gzip > ./docker-images/postgres-15.tar.gz

echo "✅ Images bygget og gemt i ./docker-images/"
echo "📁 Filer til kopiering:"
ls -lah ./docker-images/

echo ""
echo "🚀 Næste trin:"
echo "1. Kopier docker-images/ mappen til produktionsserveren"
echo "2. Kopier docker-compose.prod.yml til produktionsserveren"
echo "3. Kør load-images.sh på produktionsserveren"
```

## 📋 TRIN 3: Produktions Docker Compose

### docker-compose.prod.yml
```yaml
version: '3.8'

services:
  postgres:
    image: approval-system/postgres:15
    environment:
      POSTGRES_USER: ${DB_USER:-approval_user}
      POSTGRES_PASSWORD: ${DB_PASSWORD:-secure_password}
      POSTGRES_DB: ${DB_NAME:-approvals}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - approval_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER:-approval_user} -d ${DB_NAME:-approvals}"]
      interval: 10s
      timeout: 5s
      retries: 5

  backend:
    image: approval-system/backend:latest
    environment:
      DATABASE_URL: postgresql://${DB_USER:-approval_user}:${DB_PASSWORD:-secure_password}@postgres/${DB_NAME:-approvals}
      SECRET_KEY: ${SECRET_KEY:-your_secret_key_change_this}
      ENVIRONMENT: production
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - approval_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  frontend:
    image: approval-system/frontend:latest
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - approval_network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost"]
      interval: 30s
      timeout: 10s
      retries: 3

networks:
  approval_network:
    driver: bridge

volumes:
  postgres_data:
    driver: local
```

## 🎯 TRIN 4: Load Script til Produktion

### load-images.sh (til produktionsserveren)
```bash
#!/bin/bash

echo "📦 Indlæser Docker images til offline produktion..."

# Check om docker-images mappen findes
if [ ! -d "./docker-images" ]; then
    echo "❌ Fejl: docker-images/ mappen ikke fundet"
    echo "Kopier docker-images/ mappen fra udviklingsmaskinen først"
    exit 1
fi

echo "📥 Indlæser backend image..."
docker load < ./docker-images/backend-v1.0.0.tar.gz

echo "📥 Indlæser frontend image..."
docker load < ./docker-images/frontend-v1.0.0.tar.gz

echo "📥 Indlæser PostgreSQL image..."
docker load < ./docker-images/postgres-15.tar.gz

echo "🔍 Verificerer indlæste images..."
docker images | grep approval-system
docker images | grep postgres

echo "✅ Alle images indlæst succesfuldt!"
echo ""
echo "🚀 Start systemet med:"
echo "docker-compose -f docker-compose.prod.yml up -d"
```

## 📦 TRIN 5: Komplet Deployment Process

### På Udviklingsmaskinen (Med Internet):
```bash
# 1. Byg alle images
./build-for-production.sh

# 2. Pak alt til kopiering
tar -czf approval-system-deployment.tar.gz \
    docker-images/ \
    docker-compose.prod.yml \
    load-images.sh \
    .env.prod

# 3. Kopier til produktionsserver
scp approval-system-deployment.tar.gz user@production-server:/opt/approval-system/
```

### På Produktionsserveren (Offline):
```bash
# 1. Pak ud
cd /opt/approval-system
tar -xzf approval-system-deployment.tar.gz

# 2. Indlæs images
chmod +x load-images.sh
./load-images.sh

# 3. Konfigurer environment
cp .env.prod .env
# Rediger .env med produktionsindstillinger

# 4. Start systemet
docker-compose -f docker-compose.prod.yml up -d

# 5. Verificer
docker-compose -f docker-compose.prod.yml ps
curl http://localhost/health
```

## 🔧 TRIN 6: Produktions Environment (.env.prod)

```bash
# Database Configuration
DB_USER=approval_prod_user
DB_PASSWORD=super_secure_production_password_123
DB_NAME=approval_production

# Security Configuration
SECRET_KEY=ultra_secure_256_bit_key_for_production_use_only
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application Configuration
ENVIRONMENT=production
DEBUG=false

# Logging Configuration
LOG_LEVEL=WARNING
LOG_FILE=/var/log/approval-system.log

# Security Settings
ENABLE_RATE_LIMITING=true
MAX_REQUESTS_PER_MINUTE=60
SESSION_TIMEOUT_MINUTES=30

# Audit and Compliance
AUDIT_LOG_RETENTION_DAYS=2555  # 7 years
ENABLE_DETAILED_AUDIT=true
```

## 🛡️ TRIN 7: Sikkerhed og Monitoring

### healthcheck.sh (til produktionsserver)
```bash
#!/bin/bash

echo "🏥 Sundhedstjek af Godkendelsessystem..."

# Check containers
echo "📦 Container status:"
docker-compose -f docker-compose.prod.yml ps

# Check application health
echo "🌐 Application health:"
curl -s http://localhost/health | jq '.' || echo "❌ Health endpoint fejlede"

# Check database
echo "🗄️ Database forbindelse:"
docker-compose -f docker-compose.prod.yml exec postgres pg_isready -U approval_prod_user -d approval_production

# Check logs for errors
echo "📋 Seneste logs (fejl):"
docker-compose -f docker-compose.prod.yml logs --tail=10 | grep -i error

echo "✅ Sundhedstjek færdig"
```

## 📊 Fordele ved denne tilgang:

### ✅ **Helt Offline Produktion**
- Ingen internet adgang påkrævet
- Alle dependencies er "baked in"
- Sikker og isoleret

### ✅ **Nem Deployment**
- Byg én gang, deploy mange gange
- Konsistent miljø
- Ingen build-tid på produktion

### ✅ **Sikkerhed**
- Minimale attack surfaces
- No secrets over network
- Controlled environment

### ✅ **Performance**
- Ingen download tid
- Hurtig startup
- Optimeret images

## 🔄 Updates og Maintenance

### Nye Versioner:
```bash
# På udvikling
./build-for-production.sh  # Bygger nye images

# På produktion  
./load-images.sh           # Indlæser nye images
docker-compose -f docker-compose.prod.yml up -d  # Zero-downtime update
```

### Backup:
```bash
# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U approval_prod_user approval_production > backup-$(date +%Y%m%d).sql

# Backup images (for rollback)
docker save approval-system/backend:latest | gzip > backend-backup.tar.gz
```

## 🎯 Resultat

Med denne tilgang får du:
- **100% offline produktion** - intet internet påkrævet
- **Hurtig deployment** - alt er præ-bygget
- **Sikker** - ingen externe dependencies på runtime
- **Simpel maintenance** - standard Docker kommandoer
- **Skalerbar** - nemt at opdatere og rollback

**Alt er pakket ind i 3 images der bare kører sammen! 🚀**