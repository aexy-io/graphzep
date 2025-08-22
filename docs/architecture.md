# Architecture Overview

## System Architecture

Graphzep follows a modular, layered architecture designed for flexibility and extensibility:

```
┌─────────────────────────────────────────────────────────────┐
│                      Applications Layer                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   HTTP   │  │   MCP    │  │  Docker  │  │Examples  │  │
│  │  Server  │  │  Server  │  │Container │  │   Apps   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                    Graphzep Core Library                     │
│  ┌─────────────────────────────────────────────────────┐  │
│  │              Graphzep Orchestrator                   │  │
│  │         (src/graphzep.ts - Main Class)              │  │
│  └─────────────────────────────────────────────────────┘  │
│                              │                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │   LLM    │  │ Embedder │  │  Search  │  │  Graph   │  │
│  │ Clients  │  │ Clients  │  │  Engine  │  │ Storage  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                     Infrastructure Layer                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │  Neo4j   │  │ FalkorDB │  │ Neptune  │  │   LLM    │  │
│  │    DB    │  │    DB    │  │    DB    │  │   APIs   │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Graphzep Orchestrator (`src/graphzep.ts`)

The main orchestration class that coordinates all operations:

```typescript
class Graphzep {
  private driver: GraphDriver;      // Database abstraction
  private llmClient: BaseLLMClient; // LLM for extraction
  private embedder: BaseEmbedder;   // Embedding generation
  
  // Core operations
  async addEpisode(params: AddEpisodeParams): Promise<EpisodicNode>
  async search(params: SearchParams): Promise<Node[]>
  async getNode(uuid: string): Promise<Node | null>
  async getEdge(uuid: string): Promise<Edge | null>
}
```

**Responsibilities:**
- Episode ingestion and processing
- Entity and relation extraction coordination
- Search query orchestration
- Graph operations management

### 2. Graph Storage Layer (`src/drivers/`)

Abstract driver interface with concrete implementations:

```typescript
abstract class BaseGraphDriver {
  abstract executeQuery<T>(query: string, params?: any): Promise<T>
  abstract close(): Promise<void>
  abstract verifyConnectivity(): Promise<void>
}
```

**Implementations:**
- `Neo4jDriver` - Production-grade graph database
- `FalkorDBDriver` - Redis-based graph storage
- `NeptuneDriver` - AWS managed graph service (planned)

### 3. LLM Integration (`src/llm/`)

Abstraction for language model providers:

```typescript
abstract class BaseLLMClient {
  abstract generateResponse<T>(prompt: string, schema?: ZodSchema): Promise<T>
  abstract generateStructuredResponse<T>(prompt: string, schema: ZodSchema): Promise<T>
}
```

**Implementations:**
- `OpenAIClient` - GPT models with function calling
- `AnthropicClient` - Claude models
- `GoogleClient` - Gemini models
- `GroqClient` - Fast inference

### 4. Embedding Layer (`src/embedders/`)

Vector embedding generation for semantic search:

```typescript
abstract class BaseEmbedder {
  abstract embed(text: string): Promise<number[]>
  abstract embedBatch(texts: string[]): Promise<number[][]>
}
```

**Implementations:**
- `OpenAIEmbedder` - text-embedding-3-small/large
- `VoyageEmbedder` - Voyage AI embeddings

### 5. Graph Elements (`src/core/`)

Core data structures with Zod validation:

#### Nodes
- `EntityNode` - Named entities with types and summaries
- `EpisodicNode` - Episode content with embeddings
- `CommunityNode` - Entity clusters and summaries

#### Edges
- `EntityEdge` - Relations between entities
- `EpisodicEdge` - Links episodes to entities
- `CommunityEdge` - Community membership

## Data Models

### Node Schema

```typescript
interface BaseNode {
  uuid: string;           // Unique identifier
  name: string;           // Display name
  groupId: string;        // Isolation group
  labels: string[];       // Graph labels
  createdAt: Date;        // Creation timestamp
}

interface EntityNode extends BaseNode {
  entityType: string;     // Person, Place, Organization, etc.
  summary: string;        // Description
  summaryEmbedding?: number[]; // Vector for search
  factIds?: string[];     // Related facts
}

interface EpisodicNode extends BaseNode {
  episodeType: EpisodeType; // TEXT or JSON
  content: string;        // Original content
  embedding?: number[];   // Content embedding
  validAt: Date;         // When episode occurred
  invalidAt?: Date;      // When superseded
  referenceId?: string;  // External reference
}
```

### Edge Schema

```typescript
interface BaseEdge {
  uuid: string;
  groupId: string;
  createdAt: Date;
}

interface EntityEdge extends BaseEdge {
  sourceName: string;     // Source entity name
  targetName: string;     // Target entity name
  relationName: string;   // Relationship type
  fact: string;          // Fact description
  factEmbedding?: number[]; // Fact embedding
  episodeIds: string[];  // Supporting episodes
  validAt?: Date;        // Fact valid from
  invalidAt?: Date;      // Fact valid until
}
```

## Processing Pipeline

### Episode Processing Flow

1. **Content Ingestion**
   - Receive text or JSON content
   - Generate content embedding
   - Create EpisodicNode

2. **Entity Extraction**
   - LLM analyzes content
   - Extracts entities with types and summaries
   - Identifies relationships

3. **Entity Resolution**
   - Check for existing entities
   - Merge or create new entities
   - Generate entity embeddings

4. **Relation Processing**
   - Create edges between entities
   - Generate fact descriptions
   - Set temporal validity

5. **Graph Update**
   - Save nodes and edges
   - Update indices
   - Maintain consistency

## Search Architecture

### Hybrid Search Strategy

Graphzep implements a three-pronged search approach:

1. **Semantic Search**
   - Convert query to embedding
   - Cosine similarity with node/edge embeddings
   - Returns semantically similar results

2. **Keyword Search (BM25)**
   - Full-text search on content
   - TF-IDF based relevance scoring
   - Exact match capabilities

3. **Graph Traversal**
   - Follow relationships from matched nodes
   - Expand search context
   - Discover related information

### Search Execution

```typescript
async search(params: SearchParams): Promise<Node[]> {
  // 1. Generate query embedding
  const embedding = await this.embedder.embed(params.query);
  
  // 2. Execute similarity search
  const query = `
    MATCH (n)
    WHERE n.groupId = $groupId
      AND n.embedding IS NOT NULL
    WITH n, cosine_similarity(n.embedding, $embedding) AS similarity
    ORDER BY similarity DESC
    LIMIT $limit
    RETURN n, labels(n) as labels
  `;
  
  // 3. Process and return results
  return this.processSearchResults(results);
}
```

## Temporal Model

### Bi-Temporal Design

Graphzep tracks two time dimensions:

1. **Valid Time** (`validAt`, `invalidAt`)
   - When facts are true in the real world
   - Supports historical queries
   - Enables fact evolution tracking

2. **Transaction Time** (`createdAt`, `updatedAt`)
   - When data entered the system
   - Audit trail and versioning
   - Reproducible analyses

### Temporal Queries

```cypher
// Find facts valid at a specific time
MATCH (e:EntityEdge)
WHERE e.validAt <= $queryTime 
  AND (e.invalidAt IS NULL OR e.invalidAt > $queryTime)
RETURN e

// Track fact evolution
MATCH (e:EntityEdge {sourceName: $entity})
RETURN e ORDER BY e.validAt
```

## Scalability Considerations

### Performance Optimizations

1. **Batch Processing**
   - Bulk entity creation
   - Batch embedding generation
   - Transaction batching

2. **Indexing Strategy**
   - UUID indices for fast lookups
   - Embedding indices for similarity search
   - Temporal indices for time queries

3. **Caching**
   - Entity resolution cache
   - Embedding cache
   - Query result cache

### Horizontal Scaling

- **Stateless Services**: HTTP and MCP servers
- **Database Sharding**: By groupId
- **Load Balancing**: Multiple server instances
- **Queue Processing**: Async episode ingestion

## Security Model

### Data Isolation

- **Group-based**: Complete data isolation by groupId
- **Multi-tenancy**: Support for multiple organizations
- **Access Control**: Application-level permissions

### API Security

- **Authentication**: Token-based auth
- **Rate Limiting**: Request throttling
- **Input Validation**: Zod schema validation
- **Audit Logging**: Complete operation history