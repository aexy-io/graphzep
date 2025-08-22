# Getting Started with Graphzep

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or later)
- **npm** or **yarn** package manager
- **Neo4j** (v5.26+) or **FalkorDB** database
- **OpenAI API key** (or other LLM provider credentials)

## Installation

### 1. Install Graphzep Library

```bash
npm install graphzep
```

Or using yarn:

```bash
yarn add graphzep
```

### 2. Set Up Environment Variables

Create a `.env` file in your project root:

```env
# Required
OPENAI_API_KEY=your-openai-api-key

# Database Configuration (Neo4j)
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your-password

# Alternative: FalkorDB
# FALKORDB_URI=falkor://localhost:6379

# Optional: Other LLM Providers
# ANTHROPIC_API_KEY=your-anthropic-key
# GOOGLE_API_KEY=your-google-key
# GROQ_API_KEY=your-groq-key
```

### 3. Database Setup

#### Option A: Neo4j

1. Download and install [Neo4j Desktop](https://neo4j.com/download/)
2. Create a new database
3. Start the database
4. Note the connection details

#### Option B: Docker

```bash
# Neo4j
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/password \
  neo4j:5.26.2

# FalkorDB
docker run -d \
  --name falkordb \
  -p 6379:6379 \
  falkordb/falkordb:latest
```

## Quick Start Example

### Basic Usage

```typescript
import { 
  Graphzep, 
  Neo4jDriver,
  OpenAIClient,
  OpenAIEmbedder,
  EpisodeType 
} from 'graphzep';

// Initialize components
const driver = new Neo4jDriver(
  process.env.NEO4J_URI!,
  process.env.NEO4J_USER!,
  process.env.NEO4J_PASSWORD!
);

const llmClient = new OpenAIClient({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
});

const embedder = new OpenAIEmbedder({
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'text-embedding-3-small',
});

// Create Graphzep instance
const graphzep = new Graphzep({
  driver,
  llmClient,
  embedder,
  groupId: 'my-project',
});

// Add an episode
const episode = await graphzep.addEpisode({
  content: 'Elon Musk founded SpaceX in 2002. The company is headquartered in Hawthorne, California.',
  episodeType: EpisodeType.TEXT,
  referenceId: 'article-001',
});

console.log('Episode added:', episode.uuid);

// Search for information
const results = await graphzep.search({
  query: 'Where is SpaceX located?',
  limit: 5,
});

console.log('Search results:', results);

// Clean up
await graphzep.close();
```

## Step-by-Step Tutorial

### Step 1: Initialize Graphzep

```typescript
import { config } from 'dotenv';
import { Graphzep, Neo4jDriver, OpenAIClient, OpenAIEmbedder } from 'graphzep';

// Load environment variables
config();

async function initializeGraphzep() {
  // Create driver
  const driver = new Neo4jDriver(
    process.env.NEO4J_URI!,
    process.env.NEO4J_USER!,
    process.env.NEO4J_PASSWORD!
  );

  // Create LLM client
  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini', // or 'gpt-4', 'gpt-3.5-turbo'
  });

  // Create embedder
  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  // Initialize Graphzep
  const graphzep = new Graphzep({
    driver,
    llmClient,
    embedder,
    groupId: 'tutorial', // Isolate data by group
  });

  return graphzep;
}
```

### Step 2: Add Episodes

Episodes are the primary way to add information to the graph:

```typescript
async function addContent(graphzep: Graphzep) {
  // Add text content
  const textEpisode = await graphzep.addEpisode({
    content: `
      Apple Inc. was founded by Steve Jobs, Steve Wozniak, and Ronald Wayne 
      in April 1976. The company is headquartered in Cupertino, California. 
      Tim Cook has been the CEO since 2011.
    `,
    episodeType: EpisodeType.TEXT,
    referenceId: 'wiki-apple',
    metadata: {
      source: 'Wikipedia',
      timestamp: new Date().toISOString(),
    },
  });

  console.log('Text episode added:', textEpisode.uuid);

  // Add JSON content
  const jsonEpisode = await graphzep.addEpisode({
    content: JSON.stringify({
      company: 'Apple Inc.',
      employees: 164000,
      revenue: '394.3 billion USD',
      founded: '1976-04-01',
      products: ['iPhone', 'Mac', 'iPad', 'Apple Watch'],
    }),
    episodeType: EpisodeType.JSON,
    referenceId: 'data-apple',
  });

  console.log('JSON episode added:', jsonEpisode.uuid);
}
```

### Step 3: Search the Graph

Graphzep provides powerful search capabilities:

```typescript
async function searchExamples(graphzep: Graphzep) {
  // Simple search
  const results = await graphzep.search({
    query: 'Who founded Apple?',
    limit: 5,
  });

  console.log('Founders:', results);

  // Search with filters
  const entitySearch = await graphzep.search({
    query: 'technology companies in California',
    nodeTypes: ['entity'],
    limit: 10,
  });

  console.log('Tech companies:', entitySearch);

  // Temporal search
  const recentInfo = await graphzep.search({
    query: 'recent CEO changes',
    dateRange: {
      start: new Date('2010-01-01'),
      end: new Date(),
    },
  });

  console.log('Recent changes:', recentInfo);
}
```

### Step 4: Retrieve Specific Nodes and Edges

```typescript
async function retrieveData(graphzep: Graphzep) {
  // Get a specific node by UUID
  const node = await graphzep.getNode('node-uuid-here');
  if (node) {
    console.log('Node:', node.name, node.summary);
  }

  // Get a specific edge
  const edge = await graphzep.getEdge('edge-uuid-here');
  if (edge) {
    console.log('Relationship:', edge.fact);
  }

  // Find edges between entities
  const relation = await graphzep.getEntityEdge(
    'source-uuid',
    'target-uuid',
    'founded'
  );
  if (relation) {
    console.log('Relation found:', relation);
  }
}
```

## Working with Different Data Sources

### Processing Documents

```typescript
async function processDocument(graphzep: Graphzep, documentPath: string) {
  const fs = require('fs').promises;
  
  // Read document
  const content = await fs.readFile(documentPath, 'utf-8');
  
  // Split into chunks if needed
  const chunks = splitIntoChunks(content, 1000); // 1000 chars per chunk
  
  // Process each chunk
  for (let i = 0; i < chunks.length; i++) {
    await graphzep.addEpisode({
      content: chunks[i],
      episodeType: EpisodeType.TEXT,
      referenceId: `${documentPath}-chunk-${i}`,
      metadata: {
        documentPath,
        chunkIndex: i,
        totalChunks: chunks.length,
      },
    });
  }
}

function splitIntoChunks(text: string, chunkSize: number): string[] {
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}
```

### Processing Conversations

```typescript
async function processConversation(
  graphzep: Graphzep,
  messages: Array<{ role: string; content: string; timestamp: string }>
) {
  for (const message of messages) {
    await graphzep.addEpisode({
      content: `${message.role}: ${message.content}`,
      episodeType: EpisodeType.TEXT,
      referenceId: `message-${message.timestamp}`,
      metadata: {
        role: message.role,
        timestamp: message.timestamp,
      },
    });
  }
}
```

### Processing Structured Data

```typescript
interface ProductData {
  id: string;
  name: string;
  category: string;
  price: number;
  manufacturer: string;
}

async function processProducts(graphzep: Graphzep, products: ProductData[]) {
  for (const product of products) {
    await graphzep.addEpisode({
      content: JSON.stringify(product),
      episodeType: EpisodeType.JSON,
      referenceId: `product-${product.id}`,
      metadata: {
        category: product.category,
        priceRange: getPriceRange(product.price),
      },
    });
  }
}

function getPriceRange(price: number): string {
  if (price < 100) return 'budget';
  if (price < 500) return 'mid-range';
  return 'premium';
}
```

## Common Use Cases

### 1. Knowledge Base Construction

```typescript
async function buildKnowledgeBase(graphzep: Graphzep) {
  const articles = [
    { title: 'Introduction to AI', content: '...' },
    { title: 'Machine Learning Basics', content: '...' },
    { title: 'Deep Learning', content: '...' },
  ];

  for (const article of articles) {
    await graphzep.addEpisode({
      content: `${article.title}\n\n${article.content}`,
      episodeType: EpisodeType.TEXT,
      referenceId: slugify(article.title),
      metadata: {
        type: 'article',
        title: article.title,
      },
    });
  }

  // Query the knowledge base
  const answer = await graphzep.search({
    query: 'What is the difference between ML and Deep Learning?',
    limit: 3,
  });

  return answer;
}
```

### 2. Conversation Memory

```typescript
class ConversationMemory {
  private graphzep: Graphzep;
  private sessionId: string;

  constructor(graphzep: Graphzep, sessionId: string) {
    this.graphzep = graphzep;
    this.sessionId = sessionId;
  }

  async remember(message: string, role: 'user' | 'assistant') {
    await this.graphzep.addEpisode({
      content: message,
      episodeType: EpisodeType.TEXT,
      referenceId: `${this.sessionId}-${Date.now()}`,
      metadata: {
        sessionId: this.sessionId,
        role,
        timestamp: new Date().toISOString(),
      },
    });
  }

  async recall(query: string, limit: number = 5) {
    return await this.graphzep.search({
      query,
      limit,
      groupId: this.sessionId,
    });
  }
}
```

### 3. Entity Tracking

```typescript
async function trackEntityChanges(graphzep: Graphzep) {
  // Initial state
  await graphzep.addEpisode({
    content: 'John Smith is the CTO of TechCorp.',
    episodeType: EpisodeType.TEXT,
    referenceId: 'update-001',
  });

  // Later update
  await graphzep.addEpisode({
    content: 'John Smith has been promoted to CEO of TechCorp, replacing Jane Doe.',
    episodeType: EpisodeType.TEXT,
    referenceId: 'update-002',
  });

  // Query current state
  const currentRole = await graphzep.search({
    query: "What is John Smith's current role?",
    limit: 1,
  });

  // Query history
  const history = await graphzep.search({
    query: 'John Smith career changes',
    limit: 10,
  });

  return { currentRole, history };
}
```

## Best Practices

### 1. Episode Design

- **Chunk Size**: Keep episodes between 500-2000 characters for optimal extraction
- **Context**: Include relevant context in each episode
- **References**: Always provide meaningful `referenceId` values
- **Metadata**: Use metadata to store non-textual information

### 2. Group Management

```typescript
// Use groups for data isolation
const userGraphzep = new Graphzep({
  driver,
  llmClient,
  embedder,
  groupId: `user-${userId}`, // Isolate per user
});

const projectGraphzep = new Graphzep({
  driver,
  llmClient,
  embedder,
  groupId: `project-${projectId}`, // Isolate per project
});
```

### 3. Error Handling

```typescript
async function safeAddEpisode(graphzep: Graphzep, params: any) {
  try {
    const episode = await graphzep.addEpisode(params);
    console.log('Success:', episode.uuid);
    return episode;
  } catch (error) {
    console.error('Failed to add episode:', error);
    
    // Retry logic
    if (error.code === 'RATE_LIMIT') {
      await delay(1000);
      return safeAddEpisode(graphzep, params);
    }
    
    throw error;
  }
}
```

### 4. Performance Optimization

```typescript
// Batch processing
async function batchProcess(graphzep: Graphzep, items: any[]) {
  const batchSize = 10;
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    await Promise.all(
      batch.map(item => 
        graphzep.addEpisode({
          content: item.content,
          episodeType: EpisodeType.TEXT,
          referenceId: item.id,
        })
      )
    );
    
    // Rate limiting
    await delay(100);
  }
}
```

## Troubleshooting

### Common Issues

1. **Connection Issues**
   ```typescript
   // Test database connection
   try {
     await driver.verifyConnectivity();
     console.log('Database connected');
   } catch (error) {
     console.error('Connection failed:', error);
   }
   ```

2. **Memory Issues**
   - Process large datasets in chunks
   - Close connections when done
   - Use streaming for large files

3. **Rate Limiting**
   - Implement exponential backoff
   - Use batch processing
   - Cache embeddings when possible

### Debug Mode

```typescript
// Enable detailed logging
const graphzep = new Graphzep({
  driver,
  llmClient,
  embedder,
  groupId: 'debug',
  config: {
    debug: true,
    logLevel: 'verbose',
  },
});
```

## Next Steps

- Explore [Advanced Features](./api-reference.md)
- Learn about [Entity Extraction](./entity-extraction.md)
- Understand [Search Strategies](./search-retrieval.md)
- Review [Architecture](./architecture.md)

## Resources

- [GitHub Repository](https://github.com/your-org/graphzep)
- [API Documentation](./api-reference.md)
- [Examples](../examples/)
- [Discord Community](https://discord.gg/graphzep)