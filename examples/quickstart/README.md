# Graphzep TypeScript Quickstart Example

This example demonstrates the basic functionality of Graphzep in TypeScript, including:

1. Connecting to a Neo4j or FalkorDB database
2. Initializing Graphzep indices and constraints  
3. Adding episodes to the graph
4. Searching the graph with semantic and keyword matching
5. Performing node searches

## Prerequisites

- Node.js 18+
- TypeScript
- OpenAI API key (set as `OPENAI_API_KEY` environment variable)
- **For Neo4j**:
  - Neo4j Desktop installed and running
  - A local DBMS created and started in Neo4j Desktop
- **For FalkorDB**:
  - FalkorDB server running (see [FalkorDB documentation](https://falkordb.com/docs/) for setup)

## Setup Instructions

1. Install the required dependencies:

```bash
npm install
```

2. Set up environment variables:

```bash
# Required for LLM and embedding
export OPENAI_API_KEY=your_openai_api_key

# Optional Neo4j connection parameters (defaults shown)
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD=password

# Optional FalkorDB connection parameters (defaults shown)  
export FALKORDB_URI=falkor://localhost:6379
```

Or create a `.env` file in the examples directory:

```
OPENAI_API_KEY=your_openai_api_key
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password
FALKORDB_URI=falkor://localhost:6379
```

3. Run the examples:

```bash
# For Neo4j
npm run quickstart:neo4j

# For FalkorDB  
npm run quickstart:falkordb

# For Amazon Neptune (using Neo4j fallback)
npm run quickstart:neptune

# Or run directly with tsx
npx tsx quickstart/quickstart-neo4j.ts
npx tsx quickstart/quickstart-falkordb.ts
npx tsx quickstart/quickstart-neptune.ts
```

## What This Example Demonstrates

- **Graph Initialization**: Setting up the Graphzep indices and constraints
- **Adding Episodes**: Adding text content that will be analyzed and converted into knowledge graph nodes and edges
- **Hybrid Search**: Performing searches that combine semantic similarity and keyword matching
- **Node Search**: Searching for entities directly rather than relationships
- **Result Processing**: Understanding the structure of search results including facts, nodes, and temporal metadata

## TypeScript Features

This TypeScript version demonstrates:

- **Type Safety**: Full TypeScript typing for all Graphzep operations
- **Modern ES Modules**: Using import/export syntax
- **Async/Await**: Modern asynchronous programming patterns
- **Error Handling**: Proper error handling with try/catch blocks
- **Environment Configuration**: Using dotenv for environment variable management

## Next Steps

After running this example, you can:

1. Modify the episode content to add your own information
2. Try different search queries to explore the knowledge extraction
3. Experiment with different search parameters and limits
4. Explore the more advanced examples in the other directories
5. Build your own applications using the TypeScript Graphzep API

## Troubleshooting

### Module Resolution Issues

If you encounter module resolution issues, ensure:

1. The workspace is properly configured
2. TypeScript paths are correctly mapped in tsconfig.json
3. All dependencies are installed

### Database Connection Issues

For Neo4j:
- Ensure Neo4j Desktop is running
- Verify the connection parameters match your setup
- Check that the database exists and is started

For FalkorDB:
- Ensure FalkorDB server is running on the specified port
- Verify the URI format is correct

### API Key Issues

- Ensure `OPENAI_API_KEY` is set in your environment
- Verify the API key has sufficient credits and permissions