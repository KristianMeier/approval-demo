# 6. Offline Development Cache - Download Alt

## 🎯 Problem: Begrænset Internet på Udvikling

Du skal downloade og cache alt når du har internet, så du kan bygge offline senere.

## 📦 TRIN 1: Download Docker Base Images

### download-base-images.sh
```bash
#!/bin/bash

echo "📥 Downloader Docker base images..."

# Base images vi skal bruge
IMAGES=(
    "python:3.11-slim"
    "node:18-alpine" 
    "nginx:alpine"
    "postgres:15"
    "alpine:latest"
    "ubuntu:22.04"
)

for image in "${IMAGES[@]}"; do
    echo "📦 Downloader $image..."
    docker pull $image
    
    # Gem til fil for backup
    image_name=$(echo $image | tr ':/' '-')
    docker save $image | gzip > ./docker-cache/base-$image_name.tar.gz
    echo "✅ $image gemt som base-$image_name.tar.gz"
done

echo "🎉 Alle base images downloadet!"
```

### load-base-images.sh (til offline brug)
```bash
#!/bin/bash

echo "📥 Indlæser base images fra cache..."

if [ ! -d "./docker-cache" ]; then
    echo "❌ docker-cache/ mappe ikke fundet"
    exit 1
fi

for file in ./docker-cache/base-*.tar.gz; do
    if [ -f "$file" ]; then
        echo "📦 Indlæser $(basename $file)..."
        docker load < "$file"
    fi
done

echo "✅ Base images indlæst fra cache"
echo "🔍 Tilgængelige images:"
docker images
```

## 🐍 TRIN 2: Cache Python Dependencies 

### cache-python-deps.sh
```bash
#!/bin/bash

echo "🐍 Cacher Python dependencies..."

# Opret cache mappe
mkdir -p ./python-cache

# Download alle pip pakker til lokal cache
pip download --dest ./python-cache \
    fastapi==0.104.1 \
    uvicorn[standard]==0.24.0 \
    sqlalchemy==2.0.23 \
    psycopg2-binary==2.9.9 \
    pydantic==2.5.0 \
    python-multipart==0.0.6 \
    python-jose[cryptography]==3.3.0 \
    passlib[bcrypt]==1.7.4 \
    asyncpg==0.29.0

echo "📦 Alle Python pakker cachet i ./python-cache/"
ls -la ./python-cache/
```

### backend/Dockerfile.offline
```dockerfile
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy cached Python packages FØRST
COPY ../python-cache ./python-cache

# Copy requirements
COPY requirements.txt .

# Install fra lokal cache (INGEN internet påkrævet)
RUN pip install --no-index --find-links ./python-cache -r requirements.txt

# Resten af build...
COPY . .

# Final stage
FROM python:3.11-slim

RUN apt-get update && apt-get install -y \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r appuser && useradd -r -g appuser appuser

# Copy installed packages
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

WORKDIR /app
COPY . .
RUN chown -R appuser:appuser /app

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

## 🌐 TRIN 3: Cache Node.js Dependencies

### cache-node-deps.sh
```bash
#!/bin/bash

echo "📦 Cacher Node.js dependencies..."

# Opret cache mappe
mkdir -p ./node-cache

cd frontend

# Download alle npm pakker til cache
npm pack @angular/animations@17.0.0
npm pack @angular/common@17.0.0  
npm pack @angular/compiler@17.0.0
npm pack @angular/core@17.0.0
npm pack @angular/forms@17.0.0
npm pack @angular/platform-browser@17.0.0
npm pack @angular/platform-browser-dynamic@17.0.0
npm pack @angular/router@17.0.0
npm pack @angular-devkit/build-angular@17.0.0
npm pack @angular/cli@17.0.0
npm pack @angular/compiler-cli@17.0.0
npm pack rxjs@7.8.0
npm pack tslib@2.3.0
npm pack zone.js@0.14.0
npm pack typescript@5.2.0

# Flyt pakker til cache
mv *.tgz ../node-cache/

cd ..

echo "📦 Node.js pakker cachet i ./node-cache/"
ls -la ./node-cache/
```

### frontend/Dockerfile.offline
```dockerfile
# Build stage
FROM node:18-alpine as builder

WORKDIR /app

# Copy cached Node packages
COPY ../node-cache ./node-cache

# Create offline package.json der bruger lokal cache
COPY package.json package-lock.json ./

# Install fra cache (modificeret approach)
RUN npm ci --cache ./node-cache --prefer-offline

# Copy source and build
COPY . .
RUN npm run build:prod

# Production stage  
FROM nginx:alpine

COPY --from=builder /app/dist/frontend /usr/share/nginx/html
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost || exit 1

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 💾 TRIN 4: Alternative - Komplet Offline NPM Cache

### setup-offline-npm.sh
```bash
#!/bin/bash

echo "📦 Opsætter komplet offline NPM miljø..."

# Opret npm cache
mkdir -p ./npm-offline-cache

cd frontend

# Download ALT hvad vi skal bruge
npm install --cache ../npm-offline-cache

# Kopier node_modules til cache
cp -r node_modules ../npm-offline-cache/

cd ..

echo "✅ NPM cache oprettet med alle dependencies"
```

### frontend/Dockerfile.full-offline
```dockerfile
FROM node:18-alpine as builder

WORKDIR /app

# Copy ALLE cached node_modules
COPY ../npm-offline-cache/node_modules ./node_modules

# Copy source
COPY . .

# Build (ingen npm install påkrævet!)
RUN npm run build:prod

# Production stage
FROM nginx:alpine

COPY --from=builder /app/dist/frontend /usr/share/nginx/html
COPY nginx.prod.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

## 📋 TRIN 5: Master Download Script

### download-everything.sh
```bash
#!/bin/bash

echo "🌐 Downloader ALT til offline udvikling..."

# Opret cache mapper
mkdir -p docker-cache python-cache node-cache npm-offline-cache

echo "1/4 📦 Downloader Docker base images..."
./download-base-images.sh

echo "2/4 🐍 Downloader Python pakker..."
./cache-python-deps.sh

echo "3/4 🌐 Downloader Node.js pakker..."
./cache-node-deps.sh

echo "4/4 📱 Opsætter NPM offline cache..."
./setup-offline-npm.sh

# Pak alt sammen for backup
echo "📦 Pakker alt til backup..."
tar -czf offline-dev-cache-$(date +%Y%m%d).tar.gz \
    docker-cache/ \
    python-cache/ \
    node-cache/ \
    npm-offline-cache/

echo "✅ FÆRDIG! Alt downloadet og cachet"
echo "📁 Cache mapper:"
du -sh docker-cache python-cache node-cache npm-offline-cache

echo ""
echo "🚀 Næste gang (offline):"
echo "1. ./load-base-images.sh        # Indlæs Docker images"
echo "2. ./build-offline.sh           # Byg med cache"
```

## 🔧 TRIN 6: Offline Build Script

### build-offline.sh
```bash
#!/bin/bash

echo "🏗️ Bygger OFFLINE med cached dependencies..."

# Check cache findes
if [ ! -d "docker-cache" ] || [ ! -d "python-cache" ] || [ ! -d "node-cache" ]; then
    echo "❌ Cache mapper mangler! Kør download-everything.sh først"
    exit 1
fi

# Indlæs base images
echo "📥 Indlæser cached Docker images..."
./load-base-images.sh

# Byg backend med Python cache
echo "🐍 Bygger backend (offline)..."
cd backend
docker build -f Dockerfile.offline -t approval-system/backend:latest .
cd ..

# Byg frontend med Node cache  
echo "🌐 Bygger frontend (offline)..."
cd frontend
docker build -f Dockerfile.offline -t approval-system/frontend:latest .
cd ..

echo "✅ Offline build færdig!"
echo "🔍 Byggede images:"
docker images | grep approval-system
```

## 📁 TRIN 7: Mappestruktur

```
approval-demo/
├── download-everything.sh      # Master download script
├── build-offline.sh           # Offline build script
├── load-base-images.sh        # Load Docker images
├── docker-cache/              # Cached Docker images
│   ├── base-python-3.11-slim.tar.gz
│   ├── base-node-18-alpine.tar.gz
│   └── base-nginx-alpine.tar.gz
├── python-cache/              # Cached pip packages
│   ├── fastapi-0.104.1.tar.gz
│   ├── uvicorn-0.24.0.tar.gz
│   └── ...
├── node-cache/               # Cached npm packages  
│   ├── angular-core-17.0.0.tgz
│   └── ...
├── npm-offline-cache/        # Complete node_modules
│   └── node_modules/
├── backend/
│   ├── Dockerfile.offline    # Offline Dockerfile
│   └── ...
├── frontend/
│   ├── Dockerfile.offline    # Offline Dockerfile
│   └── ...
└── docker-compose.yml
```

## ⚡ TRIN 8: Workflow

### Med Internet (én gang):
```bash
# Download alt
./download-everything.sh

# Test offline build
./build-offline.sh
```

### Uden Internet (hver gang):
```bash
# Byg med cache
./build-offline.sh

# Deploy til produktion
./build-for-production.sh
```

## 🎯 Fordele:

### ✅ **Komplet Offline**
- Ingen internet påkrævet til builds
- Alt er cachet lokalt
- Hurtigere builds

### ✅ **Backup Sikkerhed**  
- Cache kan gemmes på USB/disk
- Reproducible builds
- Version kontrol af dependencies

### ✅ **Hastighed**
- Ingen downloads under build
- Lokale cache = hurtigere
- Parallel builds muligt

## 💡 Pro Tips:

1. **Backup cache regelmæssigt** til ekstern disk
2. **Version tag cache** efter downloads
3. **Test offline builds** før du mister internet
4. **Hold cache opdateret** når du har internet

**Nu kan du bygge HELT offline! 🚀**