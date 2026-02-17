# Multi-stage build for SABA
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Install Docker CLI for agent deployment
RUN apk add --no-cache docker-cli

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/templates ./src/templates

# Create directories
RUN mkdir -p logs memory agents

# Environment variables
ENV NODE_ENV=production
ENV DB_HOST=postgres
ENV DB_PORT=5432
ENV DB_NAME=saba_db
ENV DB_USER=saba
ENV AGENTS_BASE_PATH=/app/agents
ENV LOGS_PATH=/app/logs
ENV MEMORY_PATH=/app/memory

# Expose port for health checks
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "const db = require('./dist/database/connection'); db.getPool().query('SELECT 1').then(() => process.exit(0)).catch(() => process.exit(1))"

# Run SABA
CMD ["node", "dist/index.js"]
