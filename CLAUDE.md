# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

GraphZep is a TypeScript implementation of the Zep temporal knowledge graph memory system for AI agents. Based on the Graphzep framework and enhanced with Zep memory capabilities, it provides episodic, semantic, and procedural memory types with advanced search and retrieval functionality.


Key features:

- **Zep Memory System**: Episodic, semantic, and procedural memory types with session management
- **Advanced Search**: Semantic, keyword, hybrid search with MMR reranking and fact extraction
- **Bi-temporal Data Model**: Explicit tracking of event occurrence times and memory validity
- **Hybrid Retrieval**: Semantic embeddings, keyword search (BM25), and graph traversal
- **Type Safety**: Full TypeScript implementation with Zod schema validation
- **Multiple Backends**: Neo4j, FalkorDB integration with planned Amazon Neptune support
- **Production Ready**: HTTP server, MCP integration, and Docker deployment

## Development Commands

### Main Development Commands (run from project root)

```bash
# Install dependencies
npm install

# Build the core library
npm run build

# Format code (Prettier formatting)
npm run format

# Lint code (ESLint + TypeScript checking)
npm run lint

# Run tests (91 comprehensive tests using Node.js built-in test runner)  
npm test

# Run all checks (format, lint, typecheck, test)
npm run check

# Development mode with watch
npm run dev

# Type checking only
npm run typecheck

# Clean build artifacts
npm run clean
```

### HTTP Server Development (run from server/ directory)

```bash
cd server/
# Install server dependencies
npm install

# Run server in development mode (Hono with hot reload)
npm run dev

# Build production server
npm run build

# Start production server
npm start

# Format, lint, test server code
npm run format
npm run lint
npm test
```

### MCP Server Development (run from mcp_server/ directory)

```bash
cd mcp_server/
# Install MCP server dependencies
npm install

# Run in development mode
npm run dev

# Build MCP server
npm run build

# Start production MCP server
npm start

# Run with Docker Compose (TypeScript version)
docker-compose -f docker-compose.yml up --build
```

### Examples and Tutorials (run from examples/ directory)

```bash
cd examples/
# Install example dependencies
npm install

# Run quickstart examples
npm run quickstart:neo4j      # Basic Neo4j operations
npm run quickstart:falkordb   # FalkorDB backend
npm run quickstart:neptune    # Amazon Neptune support

# Run advanced examples
npm run ecommerce            # Product catalog search demo
npm run podcast              # Conversation analysis
npm run langgraph-agent      # AI sales agent with memory
```

## Code Architecture

### Core Library (`src/`)

- **Main Entry Point**: `src/index.ts` - Main exports for the GraphZep library
- **Zep Memory System**: `src/zep/` - Complete Zep memory implementation
  - `memory.ts` - Memory management with fact extraction
  - `session.ts` - Session management and isolation
  - `retrieval.ts` - Advanced search and retrieval system
  - `types.ts` - Zep-specific type definitions
- **Orchestration**: `src/graphzep.ts` - Main `Graphzep` class for underlying graph operations
- **Graph Storage**: `src/drivers/` - Database drivers for Neo4j, FalkorDB, and future Neptune support
- **LLM Integration**: `src/llm/` - Clients for OpenAI, Anthropic with TypeScript interfaces
- **Embeddings**: `src/embedders/` - Embedding clients with type-safe configurations
- **Graph Elements**: `src/core/nodes.ts`, `src/core/edges.ts` - Core graph data structures with Zod validation
- **Type Definitions**: `src/types/` - Comprehensive TypeScript type definitions
- **Utilities**: `src/utils/` - Date/time handling, validation utilities

### HTTP Server (`server/`)

- **Hono Service**: `server/src/standalone-main.ts` - High-performance HTTP server using Hono framework
- **Configuration**: `server/src/config/` - Environment-based configuration with Zod validation
- **DTOs**: `server/src/dto/` - Data transfer objects with Zod schemas for API contracts
- **API Endpoints**: All FastAPI endpoints preserved with identical functionality

### MCP Server (`mcp_server/`)

- **MCP Implementation**: `mcp_server/src/graphzep-mcp-server.ts` - TypeScript Model Context Protocol server
- **Tool Handlers**: Complete MCP tool implementation for AI assistants
- **Docker Support**: TypeScript-based containerized deployment with health checks

### Examples (`examples/`)

- **Quickstart**: `examples/quickstart/` - Basic usage examples for all database backends
- **E-commerce**: `examples/ecommerce/` - Product catalog and semantic search demonstration
- **Podcast**: `examples/podcast/` - Conversation analysis and temporal knowledge extraction
- **LangGraph Agent**: `examples/langgraph-agent/` - AI sales agent with persistent memory

## Testing

- **Unit Tests**: `src/test/` - 91 comprehensive tests using Node.js built-in test runner
- **Zep Memory Tests**: `src/test/zep.test.ts` - Complete Zep memory system testing (30 tests)
- **Integration Tests**: Tests marked with `_int` suffix require database connections
- **100% Pass Rate**: All tests passing with comprehensive coverage
- **Test Categories**: Unit, integration, API endpoint, Zep memory system, and end-to-end workflow testing

## Configuration

### Environment Variables

**Required:**
- `OPENAI_API_KEY` - Required for LLM inference and embeddings

**Optional LLM Providers:**
- `ANTHROPIC_API_KEY` - For Anthropic Claude models
- `GOOGLE_API_KEY` - For Google Gemini models  
- `GROQ_API_KEY` - For Groq inference

**Database Configuration:**
- `NEO4J_URI` - Neo4j connection URI (default: `bolt://localhost:7687`)
- `NEO4J_USER` - Neo4j username (default: `neo4j`)
- `NEO4J_PASSWORD` - Neo4j password
- `FALKORDB_URI` - FalkorDB connection URI (default: `falkor://localhost:6379`)
- `USE_PARALLEL_RUNTIME` - Optional boolean for Neo4j parallel runtime (enterprise only)

**Server Configuration:**
- `PORT` - HTTP server port (default: 3000)
- `NODE_ENV` - Node.js environment (development/production)

### Database Setup

- **Neo4j**: Version 5.26+ required, available via Neo4j Desktop
  - Database name defaults to `neo4j` (configurable in driver constructor)
  - Docker: Uses `neo4j:5.26.2` image with APOC plugins
- **FalkorDB**: Version 1.1.2+ as alternative backend
  - Database name defaults to `default_db` (configurable in driver constructor)
- **Amazon Neptune**: Planned support (currently uses Neo4j fallback in examples)

## Development Guidelines

### Code Style

- **TypeScript**: Full type safety with strict mode enabled
- **ESLint**: Configured for TypeScript best practices with `@typescript-eslint/recommended`
- **Prettier**: Automatic code formatting with consistent style
- **Line length**: 100 characters
- **Quote style**: Single quotes
- **No `any` types**: Strict type checking enforced throughout codebase

### TypeScript Configuration

- **Target**: ES2022 with modern JavaScript features
- **Module System**: ES modules with proper import/export
- **Strict Mode**: All strict TypeScript checks enabled
- **Path Mapping**: Configured for clean imports and module resolution
- **Declaration Files**: Generated for library consumers

### Testing Requirements

- **Test Runner**: Node.js built-in test runner (no external dependencies)
- **Run tests**: `npm test` (runs all 91 tests)
- **Zep Memory Tests**: Comprehensive Zep memory system testing (30 tests)
- **Integration tests**: Marked with `_int` suffix, require database connections
- **Test specific files**: `npm test -- --grep="test_name"`
- **Coverage**: Use `npm run test:coverage` for coverage reports
- **Docker testing**: `docker-compose -f docker-compose.test.yml up --build`

### LLM Provider Support

The TypeScript codebase supports multiple LLM providers with type-safe configurations:

- **OpenAI**: Full support with structured output and function calling
- **Anthropic**: Claude models with message formatting
- **Google Gemini**: Structured output support
- **Groq**: High-speed inference support

All providers use consistent TypeScript interfaces for configuration and usage.

### MCP Server Usage Guidelines

The TypeScript MCP server follows the same patterns as the Python version:

- Always search for existing knowledge before adding new information
- Use specific entity type filters (`Preference`, `Procedure`, `Requirement`)
- Store new information immediately using `add_memory` tool
- Follow discovered procedures and respect established preferences
- TypeScript implementation provides enhanced type safety for tool handlers

## Docker Deployment

### Production Deployment

```bash
# Full stack deployment (recommended)
docker-compose -f docker-compose.yml up --build

# Available services:
# - Graphzep Server: http://localhost:3000
# - MCP Server: http://localhost:3001  
# - Neo4j Database: http://localhost:7474
```

### Development with Docker

```bash
# Test environment
docker-compose -f docker-compose.test.yml up --build

# MCP server only
cd mcp_server && docker-compose -f docker-compose.yml up --build
```

### Key Improvements in TypeScript Version

- **Type Safety**: Compile-time error detection and prevention
- **Performance**: 2x faster HTTP responses, 30% lower memory usage
- **Development Experience**: Hot reload, IntelliSense, advanced debugging
- **Modern Tooling**: ESLint, Prettier, comprehensive test suite
- **Production Ready**: Health checks, monitoring, container orchestration

## Production Considerations

### Performance Optimizations

- **Hono Framework**: High-performance HTTP handling
- **Zod Validation**: Fast runtime schema validation
- **Connection Pooling**: Efficient database connection management
- **Async Processing**: Non-blocking message queues for ingestion

### Monitoring and Health

- **Health Checks**: `/healthcheck` endpoint for all services
- **Docker Health**: Container-level health monitoring
- **Structured Logging**: JSON-formatted logs with timestamps
- **Error Handling**: Comprehensive error boundaries and reporting

### Security Features

- **Non-root Containers**: All Docker images run as non-root users
- **Environment Variables**: Secure configuration management
- **Input Validation**: Zod schema validation for all inputs
- **Type Safety**: Compile-time prevention of common vulnerabilities