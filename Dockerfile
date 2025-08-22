# syntax=docker/dockerfile:1.9
FROM node:22-alpine as builder

WORKDIR /app

# Install system dependencies for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates

# Copy package files for core library
COPY package*.json ./
COPY tsconfig.json ./

# Copy source code for core library
COPY src/ ./src/

# Install dependencies and build core library
RUN npm ci --include=dev
RUN npm run build

# Build server stage
FROM node:22-alpine as server-builder

WORKDIR /app

# Copy built core library from builder
COPY --from=builder /app/dist ./node_modules/graphzep/dist/
COPY --from=builder /app/package.json ./node_modules/graphzep/
COPY --from=builder /app/src ./node_modules/graphzep/src/

# Copy server files
COPY server/package*.json ./server/
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/

# Install server dependencies and build
WORKDIR /app/server
RUN npm ci --include=dev
RUN npm run build

# Runtime stage
FROM node:22-alpine

# Install curl for healthcheck
RUN apk add --no-cache curl

# Create non-root user
RUN addgroup -g 1001 -S app && \
    adduser -S app -u 1001

# Set up the application directory
WORKDIR /app

# Copy built server application
COPY --from=server-builder /app/server/dist ./dist/
COPY --from=server-builder /app/server/package*.json ./
COPY --from=server-builder /app/server/node_modules ./node_modules/

# Copy core library modules
COPY --from=builder /app/dist ./node_modules/graphzep/dist/
COPY --from=builder /app/package.json ./node_modules/graphzep/

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Change ownership to app user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:${PORT}/healthcheck || exit 1

# Start the server
CMD ["node", "dist/standalone-main.js"]