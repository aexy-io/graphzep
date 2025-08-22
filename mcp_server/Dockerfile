# syntax=docker/dockerfile:1.9

# Single-stage build for MCP server using graphzep from npm
FROM node:22-alpine

WORKDIR /app

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    curl \
    ca-certificates

# Create non-root user
RUN addgroup -g 1001 -S app && \
    adduser -S app -u 1001

# Copy MCP server package files
COPY mcp_server/package*.json ./
COPY mcp_server/tsconfig.docker.json ./tsconfig.json

# Install all dependencies (including graphzep from npm)
RUN npm ci --include=dev

# Copy MCP server source
COPY mcp_server/src/ ./src/

# Build MCP server
RUN npm run build

# Install production dependencies only
RUN npm ci --only=production && \
    npm cache clean --force

# Change ownership to app user
RUN chown -R app:app /app

# Switch to non-root user
USER app

# Set environment variables
ENV NODE_ENV=production \
    PORT=3001 \
    MCP_SERVER_HOST="0.0.0.0"

# Expose port
EXPOSE $PORT

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD pgrep -f "node.*graphzep-mcp-server" || exit 1

# Command to run the MCP server
CMD ["node", "dist/graphzep-mcp-server.js"]