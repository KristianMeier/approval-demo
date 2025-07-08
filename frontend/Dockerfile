# frontend/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install Angular CLI globally
RUN npm install -g @angular/cli

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

EXPOSE 4200

# Start development server
CMD ["npm", "start"]