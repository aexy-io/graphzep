# Zep Memory System Implementation in Graphzep

## Overview

This implementation brings the Zep memory architecture (as described in https://arxiv.org/html/2501.13956v1) to the Graphzep library, providing a comprehensive temporal knowledge graph system for AI agent memory management.

## Implementation Structure

### Core Components Added

1. **Memory Manager** (`src/zep/memory.ts`)
   - Handles creation, storage, and retrieval of memories
   - Automatic fact extraction from episodic content
   - Temporal validity tracking for all memories
   - Memory pruning and lifecycle management

2. **Retrieval System** (`src/zep/retrieval.ts`)
   - Multiple search strategies: semantic, keyword, hybrid, MMR
   - Advanced reranking algorithms (RRF, MMR, graph-based)
   - Temporal filtering capabilities
   - Memory type filtering

3. **Session Manager** (`src/zep/session.ts`)
   - Session-based memory isolation
   - User-specific memory tracking
   - Automatic session summarization
   - Entity and topic extraction

4. **Type Definitions** (`src/zep/types.ts`)
   - Comprehensive TypeScript types for all Zep concepts
   - Zod schemas for runtime validation
   - Support for multiple memory types (episodic, semantic, procedural, summary)

## Key Features Implemented

### 1. Temporal Knowledge Graph
- **Bi-temporal model**: Tracks both event time and ingestion time
- **Dynamic updates**: No batch recomputation needed
- **Hierarchical structure**: Episodic → Semantic → Community layers

### 2. Memory Types
- **Episodic Memory**: Raw interaction/conversation data
- **Semantic Memory**: Extracted knowledge and facts
- **Procedural Memory**: Learned patterns and procedures
- **Summary Memory**: Condensed overviews of sessions

### 3. Fact Extraction
- Automatic extraction of (subject, predicate, object) triples
- Confidence scoring for each extracted fact
- Temporal validity tracking
- Source memory linkage

### 4. Advanced Search Capabilities
- **Semantic Search**: Embedding-based similarity matching
- **Keyword Search**: BM25 full-text search
- **Hybrid Search**: Combines multiple approaches with RRF
- **MMR Search**: Maximizes relevance while maintaining diversity

### 5. Reranking Strategies
- **Reciprocal Rank Fusion (RRF)**: Combines multiple ranking signals
- **Maximal Marginal Relevance (MMR)**: Balances relevance and diversity
- **Graph-based Reranking**: Boosts results with more connections
- **Cross-encoder Support**: Framework ready for advanced models

## Usage Example

```typescript
import { Graphzep } from 'graphzep';
import { ZepMemoryManager, ZepSessionManager, ZepRetrieval } from 'graphzep/zep';

// Initialize components
const graphzep = new Graphzep({ driver, llmClient, embedder });
const memoryManager = new ZepMemoryManager(graphzep, llmClient, embedder, driver);
const sessionManager = new ZepSessionManager(driver, llmClient, memoryManager);
const retrieval = new ZepRetrieval(embedder, driver);

// Create a session
const session = await sessionManager.createSession({
  userId: 'user-123',
  metadata: { app: 'my-agent' }
});

// Add memories
const memory = await memoryManager.addMemory({
  content: 'The user prefers Python for data science tasks',
  sessionId: session.sessionId,
  memoryType: MemoryType.SEMANTIC,
});

// Search memories
const results = await retrieval.search({
  query: 'programming preferences',
  sessionId: session.sessionId,
  searchType: 'hybrid',
  limit: 5
});

// Generate session summary
const summary = await sessionManager.generateSessionSummary(session.sessionId);
```

## Database Schema

### New Node Types
- `ZepMemory`: Core memory storage with embeddings and metadata
- `ZepFact`: Extracted facts with confidence scores
- `ZepSession`: Session management and isolation
- `SessionSummary`: Condensed session overviews

### Relationships
- `(ZepSession)-[:HAS_MEMORY]->(ZepMemory)`
- `(ZepMemory)-[:HAS_FACT]->(ZepFact)`
- `(ZepSession)-[:HAS_SUMMARY]->(SessionSummary)`

## Testing

Comprehensive test suite added (`src/test/zep.test.ts`) covering:
- Memory CRUD operations
- Fact extraction accuracy
- Search strategy effectiveness
- Session management
- Temporal queries
- Memory pruning

## Performance Considerations

1. **Embedding Caching**: Reuses embeddings when possible
2. **Batch Processing**: Supports bulk memory operations
3. **Index Optimization**: Leverages Neo4j indices for fast queries
4. **Connection Pooling**: Efficient database connection management

## Future Enhancements

1. **Community Detection**: Implement clustering algorithms for entity groups
2. **Cross-encoder Models**: Add advanced reranking models
3. **Multimodal Support**: Extend to image and audio memories
4. **Streaming Updates**: Real-time memory updates via WebSocket
5. **Federation**: Support for distributed memory systems

## Integration with Existing Graphzep

The Zep implementation seamlessly integrates with Graphzep's existing infrastructure:
- Uses the same driver abstraction for database operations
- Leverages existing LLM and embedding clients
- Compatible with Graphzep's temporal model
- Extends rather than replaces core functionality

## Example Application

A complete example is provided in `examples/zep-poc/` demonstrating:
- Session creation and management
- Memory addition with automatic fact extraction
- All search strategies (semantic, keyword, hybrid, MMR)
- Session summarization
- Temporal queries
- Memory lifecycle management

## API Compatibility

The implementation maintains compatibility with Zep's conceptual API while leveraging TypeScript's type safety:
- Type-safe memory operations
- Runtime validation with Zod schemas
- Comprehensive error handling
- Full IntelliSense support

## Production Readiness

The implementation includes:
- Comprehensive error handling
- Logging for debugging
- Configuration via environment variables
- Docker support (via existing Graphzep infrastructure)
- Scalability considerations

## Documentation

Complete documentation provided including:
- API reference (TypeScript types and JSDoc)
- Usage examples
- Architecture overview
- Integration guide
- Performance tips

This implementation successfully brings Zep's advanced memory architecture to the TypeScript ecosystem through Graphzep, enabling developers to build sophisticated AI agents with persistent, queryable memory systems.