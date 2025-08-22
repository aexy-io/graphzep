# Zep Memory System POC using Graphzep

This proof of concept demonstrates how to implement a Zep-like memory system using the Graphzep library, based on the architecture described in the paper "Zep: A Temporal Knowledge Graph Architecture for Agent Memory" (https://arxiv.org/html/2501.13956v1).

## Features Demonstrated

### 1. **Temporal Knowledge Graph**
- Hierarchical graph structure with episodic, semantic, and community subgraphs
- Bi-temporal model tracking both event time and ingestion time
- Dynamic knowledge integration without batch recomputation

### 2. **Memory Types**
- **Episodic Memory**: Raw conversation/interaction data
- **Semantic Memory**: Extracted facts and knowledge
- **Procedural Memory**: Learned patterns and best practices
- **Summary Memory**: Condensed session overviews

### 3. **Advanced Search & Retrieval**
- **Semantic Search**: Embedding-based similarity search
- **Keyword Search**: BM25 full-text search
- **Hybrid Search**: Combines semantic and keyword approaches
- **MMR Search**: Maximal Marginal Relevance for diverse results

### 4. **Reranking Strategies**
- Reciprocal Rank Fusion (RRF)
- Maximal Marginal Relevance (MMR)
- Graph-based reranking
- Cross-encoder support (framework ready)

### 5. **Session Management**
- Session-based memory isolation
- User-specific memory tracking
- Session summarization with entity/topic extraction
- Temporal memory queries

### 6. **Fact Extraction**
- Automatic extraction of (subject, predicate, object) triples
- Confidence scoring for extracted facts
- Temporal validity tracking for facts

## Prerequisites

1. **Neo4j Database** (v5.26+)
   ```bash
   docker run -d \
     --name neo4j-zep \
     -p 7474:7474 -p 7687:7687 \
     -e NEO4J_AUTH=neo4j/password \
     neo4j:5.26.2
   ```

2. **Environment Variables**
   Create a `.env` file:
   ```env
   OPENAI_API_KEY=your-openai-api-key
   NEO4J_URI=bolt://localhost:7687
   NEO4J_USER=neo4j
   NEO4J_PASSWORD=password
   ```

## Running the POC

```bash
# Install dependencies
npm install

# Run the example
npm start
```

## Architecture Overview

The Zep implementation consists of three main components:

### 1. Memory Manager (`src/zep/memory.ts`)
- Handles memory creation, storage, and retrieval
- Extracts facts from episodic memories
- Manages temporal validity
- Implements memory pruning strategies

### 2. Retrieval System (`src/zep/retrieval.ts`)
- Implements multiple search strategies
- Handles result reranking
- Provides temporal filtering
- Supports memory type filtering

### 3. Session Manager (`src/zep/session.ts`)
- Manages conversation sessions
- Links memories to sessions
- Generates session summaries
- Tracks user interactions

## Example Output

```
🧠 Zep Memory System POC using Graphzep

✅ Connected to Neo4j database

📝 Created session: abc123-def456-...

💭 Adding conversation memories...
  ✓ Added memory: "Hi! I'm working on a new e-commerce platform..."
    📌 Extracted 2 facts:
       - ShopMaster is-a e-commerce platform (confidence: 0.90)
       - ShopMaster uses React and Node.js (confidence: 0.95)
  ...

🔍 Testing Search Strategies

1. Semantic Search for "team members"
   Score: 0.912 - "The team consists of Alice as the frontend lead..."

2. Keyword Search for "Stripe"
   Score: 0.856 - "...payment processing with Stripe..."

3. Hybrid Search for "technical stack and architecture"
   Score: 0.923 - "We're using MongoDB for the database..."

4. MMR Search for "project details" (with diversity)
   Score: 0.901 - "Hi! I'm working on a new e-commerce platform..."
   Score: 0.823 - "The main features include product catalog..."
   Score: 0.756 - "Our next sprint goals are to implement..."

📋 Generating Session Summary

Summary:
The conversation discusses ShopMaster, an e-commerce platform built with React and Node.js...

Entities identified: ShopMaster, Alice, Bob, Carol, MongoDB, AWS, Docker, Stripe
Topics covered: e-commerce, web development, team structure, bug fixes, deployment
Messages summarized: 6
```

## Integration with Graphzep

This POC extends Graphzep's core functionality by:

1. **Adding Zep-specific node types** (ZepMemory, ZepFact, ZepSession)
2. **Implementing temporal tracking** for all memories and facts
3. **Providing advanced retrieval** with multiple search strategies
4. **Supporting session-based isolation** for multi-user scenarios
5. **Enabling fact extraction** from unstructured text

## Use Cases

1. **Conversational AI Agents**: Maintain context across sessions
2. **Knowledge Management**: Extract and organize facts from conversations
3. **Personalization**: Track user preferences and interaction patterns
4. **Analytics**: Analyze conversation patterns and extract insights
5. **Compliance**: Maintain audit trails with temporal accuracy

## Next Steps

To productionize this POC:

1. **Scaling**:
   - Implement distributed graph sharding
   - Add caching layers for frequently accessed memories
   - Optimize embedding generation with batching

2. **Enhanced Features**:
   - Add cross-encoder reranking models
   - Implement community detection algorithms
   - Add support for multimodal memories (images, audio)

3. **Integration**:
   - Create REST API endpoints
   - Build WebSocket support for real-time updates
   - Add authentication and authorization

4. **Monitoring**:
   - Add metrics collection
   - Implement memory access patterns analytics
   - Create dashboard for session insights

## References

- [Zep Paper](https://arxiv.org/html/2501.13956v1)
- [Graphzep Documentation](../../docs/README.md)
- [Neo4j Graph Data Science](https://neo4j.com/docs/graph-data-science/)