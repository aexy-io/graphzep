# Graphzep TypeScript Examples

This directory contains comprehensive TypeScript examples demonstrating the Graphzep knowledge graph framework capabilities.

## 📁 Available Examples

### 1. Quickstart (`quickstart/`)
Basic introduction to Graphzep with different database backends:
- **quickstart-neo4j.ts**: Connect to Neo4j and perform basic operations
- **quickstart-falkordb.ts**: Connect to FalkorDB and perform basic operations  
- **quickstart-neptune.ts**: Amazon Neptune example (with Neo4j fallback)

### 2. E-commerce Demo (`ecommerce/`)
Product catalog knowledge graph demonstration:
- **runner.ts**: Load product data and perform intelligent product searches
- Demonstrates semantic search across product descriptions, categories, and features

### 3. Podcast Analysis (`podcast/`)
Conversation analysis and knowledge extraction:
- **podcast-runner.ts**: Process podcast transcripts and extract speaker relationships
- **transcript-parser.ts**: Parse structured conversation data with timestamps
- Demonstrates temporal knowledge graphs and speaker relationship extraction

### 4. LangGraph Agent (`langgraph-agent/`)
AI sales agent with persistent memory:
- **agent.ts**: Conversational sales bot using Graphzep for customer knowledge
- Demonstrates context-aware conversations and product recommendations
- Shows integration patterns for AI agents with knowledge persistence

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- TypeScript
- Neo4j, FalkorDB, or Amazon Neptune database
- OpenAI API key

### Installation

```bash
cd examples
npm install
```

### Environment Configuration

Create a `.env` file or set environment variables:

```bash
# Required
OPENAI_API_KEY=your_openai_api_key

# Database (choose one)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# Or FalkorDB
FALKORDB_URI=falkor://localhost:6379

# Or Amazon Neptune
NEPTUNE_HOST=your_neptune_cluster.cluster-xyz.us-east-1.neptune.amazonaws.com
NEPTUNE_PORT=8182
```

### Running Examples

```bash
# Basic quickstart examples
npm run quickstart:neo4j
npm run quickstart:falkordb
npm run quickstart:neptune

# Advanced examples
npm run ecommerce        # Product search demo
npm run podcast          # Podcast analysis
npm run langgraph-agent  # AI sales agent
```

## 📚 Example Details

### Quickstart Examples

**Purpose**: Learn basic Graphzep operations
**Time**: 2-5 minutes each
**Key Concepts**:
- Graph initialization and schema setup
- Adding episodes (text and JSON)
- Hybrid search (semantic + keyword)
- Node and edge retrieval

### E-commerce Demo  

**Purpose**: Product catalog and semantic search
**Time**: 5-10 minutes
**Key Concepts**:
- Large dataset ingestion
- Product categorization and search
- Price and feature-based queries
- JSON episode handling

**Sample Queries**:
- "Find wireless headphones under $100"
- "Show me organic cotton clothing"
- "What products have high ratings?"

### Podcast Analysis

**Purpose**: Conversation and temporal analysis
**Time**: 10-15 minutes  
**Key Concepts**:
- Transcript parsing and speaker identification
- Temporal relationship extraction
- Multi-speaker conversation analysis
- Custom entity types (Person, City, IsPresidentOf)

**Sample Insights**:
- Speaker relationships and roles
- Topic extraction from conversations
- Temporal context preservation
- Political and educational content identification

### LangGraph Agent

**Purpose**: AI agent with persistent memory
**Time**: 15-20 minutes
**Key Concepts**:
- Conversational AI with Graphzep integration
- Customer profile building
- Product recommendation system
- Sales-focused interaction patterns

**Agent Capabilities**:
- Product catalog search
- Customer preference learning
- Size and color recommendations
- Budget-aware suggestions

## 🔧 Development

### Project Structure

```
examples/
├── quickstart/           # Basic examples
│   ├── quickstart-neo4j.ts
│   ├── quickstart-falkordb.ts
│   ├── quickstart-neptune.ts
│   └── README.md
├── ecommerce/           # Product search demo  
│   └── runner.ts
├── podcast/             # Conversation analysis
│   ├── podcast-runner.ts
│   ├── transcript-parser.ts
│   └── podcast_transcript.txt
├── langgraph-agent/     # AI sales agent
│   ├── agent.ts
│   ├── README.md
│   └── tinybirds-jess.png
├── data/                # Sample data files
│   └── manybirds_products.json
└── package.json
```

### Building and Testing

```bash
# Build all TypeScript
npm run build

# Run linting
npm run lint

# Format code
npm run format

# Development mode with watching
npm run dev
```

### Adding New Examples

1. **Create directory**: `mkdir examples/my-example`
2. **Add TypeScript file**: Create `my-example.ts` with proper imports
3. **Update package.json**: Add npm script for your example
4. **Add documentation**: Create README.md explaining the example
5. **Test**: Verify the example works with `npx tsx my-example/my-example.ts`

## 🎯 Learning Path

### Beginner (Start Here)
1. **quickstart-neo4j.ts**: Basic Graphzep operations
2. **quickstart-falkordb.ts**: Alternative database backend

### Intermediate  
3. **ecommerce/runner.ts**: Structured data and search
4. **podcast/podcast-runner.ts**: Conversation analysis

### Advanced
5. **langgraph-agent/agent.ts**: AI agent integration
6. **quickstart-neptune.ts**: Cloud database patterns

## 🚀 Production Integration

### Using Examples in Your Application

```typescript
// Import Graphzep components
import { 
  Graphzep, 
  Neo4jDriver, 
  OpenAIClient, 
  OpenAIEmbedderClient 
} from 'graphzep';

// Initialize like in examples
const graphzep = new Graphzep({
  driver: new Neo4jDriver({ /* config */ }),
  llmClient: new OpenAIClient({ /* config */ }),
  embedder: new OpenAIEmbedderClient({ /* config */ }),
});

// Use patterns from examples
await graphzep.addEpisode({ /* episode data */ });
const results = await graphzep.search({ /* search params */ });
```

### Integration Patterns

1. **Web Applications**: Use with Express, Fastify, or Hono servers
2. **AI Agents**: Integrate with LangChain, LangGraph, or custom agent frameworks
3. **Data Pipelines**: Batch process documents, conversations, or structured data
4. **Search Systems**: Build intelligent search with semantic understanding

## 🛠️ Troubleshooting

### Common Issues

1. **Module Resolution**: Ensure graphzep is properly built and linked
2. **Database Connection**: Verify database is running and credentials are correct
3. **API Keys**: Check OpenAI API key is valid and has sufficient credits
4. **Memory**: Large datasets may require database tuning

### Debug Mode

Run examples with debug output:

```bash
DEBUG=graphzep:* npm run quickstart:neo4j
```

### Performance Tips

1. **Batch Operations**: Use bulk processing for large datasets
2. **Connection Pooling**: Configure database connection limits
3. **Caching**: Implement embedding caching for repeated content
4. **Indexing**: Ensure proper database indexes are created

## 📖 Further Reading

- **Core Documentation**: See main README.md for detailed API reference
- **TypeScript Migration**: Read README-TYPESCRIPT.md for migration details
- **Docker Deployment**: Check DOCKER.md for containerization
- **Server Integration**: Review server/README.md for HTTP API usage

## 🤝 Contributing

When adding new examples:

1. **Follow Patterns**: Use existing examples as templates
2. **Add Documentation**: Include comprehensive README files
3. **Error Handling**: Include proper error handling and cleanup
4. **Type Safety**: Use full TypeScript typing
5. **Testing**: Verify examples work with different configurations

---

These examples provide a comprehensive introduction to Graphzep's capabilities and demonstrate real-world usage patterns for building knowledge-driven applications with TypeScript.