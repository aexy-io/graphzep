# Docker Setup for TypeScript Graphzep

This document describes how to run the TypeScript version of Graphzep using Docker and Docker Compose.

## Quick Start

1. **Copy environment configuration:**
   ```bash
   cp .env.docker.example .env
   # Edit .env with your actual values (especially OPENAI_API_KEY and NEO4J_PASSWORD)
   ```

2. **Start the full stack with Docker Compose:**
   ```bash
   docker-compose -f docker-compose.yml up --build
   ```

3. **Test the deployment:**
   ```bash
   # Check server health
   curl http://localhost:3000/healthcheck
   
   # Check Neo4j is running
   curl http://localhost:7474
   ```

## Available Services

### Main Graphzep Server
- **Image**: Built from `Dockerfile`
- **Port**: 3000
- **Health check**: `GET /healthcheck`
- **Description**: TypeScript Hono server with Graphzep API

### MCP Server (Optional)
- **Image**: Built from `mcp_server/Dockerfile`
- **Port**: 3001  
- **Description**: Model Context Protocol server for AI assistants

### Neo4j Database
- **Image**: `neo4j:5.26.2`
- **Ports**: 7474 (HTTP), 7687 (Bolt)
- **Description**: Graph database backend

## Docker Compose Configurations

### Production (`docker-compose.yml`)
Full production stack with all services, health checks, and networking.

```bash
docker-compose -f docker-compose.yml up -d
```

### Testing (`docker-compose.test.yml`)
Test environment with faster startup and test data isolation.

```bash
docker-compose -f docker-compose.test.yml up --build
```

### MCP Server Only (`mcp_server/docker-compose.yml`)
Just the MCP server and Neo4j database.

```bash
cd mcp_server
docker-compose -f docker-compose.yml up --build
```

## Environment Variables

### Required
- `OPENAI_API_KEY`: OpenAI API key for LLM inference
- `NEO4J_PASSWORD`: Password for Neo4j database

### Optional
- `OPENAI_BASE_URL`: Custom OpenAI endpoint
- `MODEL_NAME`: LLM model name (default: gpt-4)
- `EMBEDDING_MODEL_NAME`: Embedding model (default: text-embedding-3-small)
- `NEO4J_USER`: Neo4j username (default: neo4j)
- `NEO4J_PORT`: Neo4j Bolt port (default: 7687)
- `PORT`: Main server port (default: 3000)
- `SEMAPHORE_LIMIT`: MCP server concurrency (default: 10)

## Building Images

### Main Server
```bash
docker build -f Dockerfile -t graphzep-server:latest .
```

### MCP Server
```bash
cd mcp_server
docker build -f Dockerfile -t graphzep-mcp:latest .
```

## Networking

All services run in isolated Docker networks:
- `graphzep-network`: Main application network
- `mcp-network`: MCP server network  
- `test-network`: Testing network

## Volumes

- `neo4j_data`: Persistent Neo4j database storage
- `neo4j_logs`: Neo4j log files

## Health Checks

All services include health checks:
- **Graphzep Server**: HTTP endpoint check
- **MCP Server**: Process health check
- **Neo4j**: Cypher query test

## Troubleshooting

### Service Won't Start
1. Check environment variables are set correctly
2. Verify Docker and Docker Compose versions
3. Check port availability (3000, 3001, 7474, 7687)

### Connection Issues
1. Verify Neo4j is healthy: `docker-compose ps`
2. Check network connectivity: `docker network ls`
3. Review service logs: `docker-compose logs <service-name>`

### Performance Issues
1. Adjust Neo4j memory settings in docker-compose.yml
2. Increase `SEMAPHORE_LIMIT` for MCP server
3. Monitor container resources: `docker stats`

## Development

### Hot Reload Development
```bash
# Start only Neo4j
docker-compose -f docker-compose.yml up neo4j -d

# Run server locally with hot reload
cd server
npm run dev
```

### Running Tests
```bash
# Run test suite
docker-compose -f docker-compose.test.yml up --build --abort-on-container-exit

# Run specific service tests
docker-compose -f docker-compose.test.yml up graphzep-server-test
```

### Debugging
```bash
# View logs
docker-compose -f docker-compose.yml logs -f graphzep-server

# Execute commands in container
docker-compose exec graphzep-server sh

# Inspect container
docker inspect <container-id>
```

## Production Deployment

For production deployments, consider:

1. **Security**: Use Docker secrets for sensitive data
2. **Scalability**: Use Docker Swarm or Kubernetes
3. **Monitoring**: Add Prometheus/Grafana stack
4. **Backup**: Configure Neo4j backup strategies
5. **SSL/TLS**: Add reverse proxy with HTTPS

### Example Production Override
```yaml
# docker-compose.prod.yml
version: '3.8'
services:
  graphzep-server:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 2G
    environment:
      - NODE_ENV=production
```

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```