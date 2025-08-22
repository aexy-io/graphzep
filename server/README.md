# Graphzep Server

A TypeScript/Node.js HTTP server for the Graphzep knowledge graph system using Hono.

## Quick Start

1. Install dependencies:
```bash
npm install
```

2. Copy environment config:
```bash
cp .env.example .env
# Edit .env with your actual values
```

3. Build and start:
```bash
npm run build
npm start
```

Or run in development mode:
```bash
npm run dev
```

## Environment Variables

- `OPENAI_API_KEY` - Required for LLM inference
- `OPENAI_BASE_URL` - OpenAI API base URL (optional)
- `MODEL_NAME` - LLM model name (optional, defaults to gpt-4)
- `EMBEDDING_MODEL_NAME` - Embedding model name (optional)
- `NEO4J_URI` - Neo4j database connection URI
- `NEO4J_USER` - Neo4j username
- `NEO4J_PASSWORD` - Neo4j password
- `PORT` - Server port (optional, defaults to 3000)

## API Endpoints

### Health Check
- `GET /healthcheck` - Returns server health status

### Ingestion
- `POST /messages` - Add messages to processing queue
- `DELETE /group/:groupId` - Delete all data for a group
- `POST /clear` - Clear all stored data

### Retrieval
- `POST /search` - Search for relevant facts
- `GET /episodes/:groupId?last_n=10` - Get recent episodes for a group
- `POST /get-memory` - Get memory based on conversation context

## Development

```bash
# Run in development mode with auto-reload
npm run dev

# Build TypeScript
npm run build

# Lint code
npm run lint

# Format code
npm run format
```

## Current Implementation

This server currently uses in-memory storage for demonstration purposes. In a production environment, it would integrate with the full Graphzep TypeScript library and Neo4j/FalkorDB for persistent storage.

The server implements all the same API endpoints as the original Python FastAPI server, maintaining compatibility with existing clients.