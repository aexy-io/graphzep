# RDF Integration Guide

This guide covers practical integration patterns and best practices for using GraphZep's RDF support in real-world applications.

## Table of Contents
- [Quick Integration](#quick-integration)
- [Integration Patterns](#integration-patterns)
- [External System Integration](#external-system-integration)
- [Migration Strategies](#migration-strategies)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

## Quick Integration

### Basic RDF Setup

```typescript
import { Graphzep, OptimizedRDFDriver, OpenAIClient, OpenAIEmbedder } from 'graphzep';

// 1. Initialize RDF driver
const rdfDriver = new OptimizedRDFDriver({
  inMemory: true,                    // Start with in-memory for development
  cacheSize: 10000,                 // Adjust based on memory constraints
  batchSize: 1000,                  // Optimize for your write patterns
  customOntologyPath: './domain.owl' // Optional domain ontology
});

// 2. Connect and initialize
await rdfDriver.connect();

// 3. Create GraphZep instance
const graphzep = new Graphzep({
  driver: rdfDriver,
  llmClient: new OpenAIClient({ apiKey: process.env.OPENAI_API_KEY }),
  embedder: new OpenAIEmbedder({ apiKey: process.env.OPENAI_API_KEY })
});

// 4. Verify RDF support
console.log('RDF enabled:', graphzep.isRDFSupported());
```

### Adding Your First Data

```typescript
// Add episodic memories (automatically converted to RDF)
await graphzep.addEpisode({
  content: 'Customer John Smith purchased laptop model X1 for $1299 on 2024-01-15',
  metadata: { 
    source: 'sales_system',
    confidence: 0.95,
    department: 'sales'
  }
});

// Add semantic facts directly
await graphzep.addFact({
  subject: 'ent:john_smith',
  predicate: 'has:purchase_history',
  object: 'product:laptop_x1',
  confidence: 1.0,
  sourceMemoryIds: [],
  validFrom: new Date('2024-01-15')
});
```

### Your First SPARQL Query

```typescript
// Query customer purchase patterns
const results = await graphzep.sparqlQuery(`
  PREFIX ent: <http://graphzep.ai/entity#>
  PREFIX has: <http://graphzep.ai/relations#>
  PREFIX product: <http://graphzep.ai/products#>
  
  SELECT ?customer ?product ?date
  WHERE {
    ?customer has:purchase_history ?product .
    ?memory a zep:EpisodicMemory ;
            zep:mentions ?customer ;
            zeptime:occurredAt ?date .
    FILTER (?date >= "2024-01-01T00:00:00Z"^^xsd:dateTime)
  }
  ORDER BY DESC(?date)
`);

console.log('Recent purchases:', results.bindings);
```

## Integration Patterns

### 1. Hybrid Database Pattern

Use RDF alongside existing databases for different strengths:

```typescript
class ECommerceSystem {
  private rdfDriver: OptimizedRDFDriver;     // Semantic queries
  private sqlDatabase: PostgreSQLClient;     // Transactional data
  private searchEngine: ElasticsearchClient; // Full-text search
  
  async processCustomerInteraction(interaction: CustomerInteraction): Promise<void> {
    // 1. Store transaction in SQL
    await this.sqlDatabase.insertTransaction(interaction.transaction);
    
    // 2. Add semantic knowledge to RDF
    await this.graphzep.addEpisode({
      content: `Customer ${interaction.customerId} ${interaction.action} ${interaction.product}`,
      metadata: { source: 'interaction_log' }
    });
    
    // 3. Index for search
    await this.searchEngine.index({
      id: interaction.id,
      content: interaction.description,
      timestamp: interaction.timestamp
    });
  }
  
  async getCustomerInsights(customerId: string): Promise<CustomerInsights> {
    // Use RDF for semantic analysis
    const semanticInsights = await this.graphzep.sparqlQuery(`
      SELECT ?preference ?frequency
      WHERE {
        ent:${customerId} has:preference ?preference .
        ?preference zep:frequency ?frequency .
      }
      ORDER BY DESC(?frequency)
    `);
    
    // Use SQL for transactional history
    const transactions = await this.sqlDatabase.getCustomerTransactions(customerId);
    
    return {
      preferences: semanticInsights.bindings,
      transactions: transactions
    };
  }
}
```

### 2. Event-Driven Integration Pattern

Process events and maintain RDF knowledge graph:

```typescript
class EventDrivenRDFSystem {
  private eventBus: EventBus;
  private rdfProcessor: RDFProcessor;
  
  constructor() {
    this.setupEventHandlers();
  }
  
  private setupEventHandlers(): void {
    this.eventBus.on('user_action', async (event: UserActionEvent) => {
      await this.rdfProcessor.processUserAction(event);
    });
    
    this.eventBus.on('system_update', async (event: SystemUpdateEvent) => {
      await this.rdfProcessor.processSystemUpdate(event);
    });
    
    this.eventBus.on('data_ingestion', async (event: DataIngestionEvent) => {
      await this.rdfProcessor.processBulkData(event);
    });
  }
}

class RDFProcessor {
  constructor(private graphzep: Graphzep) {}
  
  async processUserAction(event: UserActionEvent): Promise<void> {
    const memory = await this.graphzep.addEpisode({
      content: `User ${event.userId} performed ${event.action} on ${event.target}`,
      metadata: {
        userId: event.userId,
        action: event.action,
        timestamp: event.timestamp,
        confidence: this.calculateConfidence(event)
      }
    });
    
    // Extract relationships
    await this.extractRelationships(memory, event);
  }
  
  private async extractRelationships(memory: any, event: UserActionEvent): Promise<void> {
    // Extract user preferences
    if (event.action === 'viewed' || event.action === 'purchased') {
      await this.graphzep.addFact({
        subject: `ent:${event.userId}`,
        predicate: 'has:interest_in',
        object: `ent:${event.target}`,
        confidence: 0.7,
        sourceMemoryIds: [memory.uuid],
        validFrom: new Date(event.timestamp)
      });
    }
  }
}
```

### 3. Microservices Integration Pattern

Expose RDF capabilities as microservice APIs:

```typescript
// RDF Microservice
class RDFMicroservice {
  private graphzep: Graphzep;
  private server: Express;
  
  constructor() {
    this.setupRoutes();
  }
  
  private setupRoutes(): void {
    // Memory ingestion endpoint
    this.server.post('/api/v1/memories', async (req, res) => {
      try {
        const memory = await this.graphzep.addEpisode(req.body);
        res.json({ success: true, memoryId: memory.uuid });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
    
    // SPARQL query endpoint
    this.server.post('/api/v1/sparql', async (req, res) => {
      try {
        const results = await this.graphzep.sparqlQuery(req.body.query);
        res.json({ results: results.bindings });
      } catch (error) {
        res.status(400).json({ error: 'Invalid SPARQL query', details: error.message });
      }
    });
    
    // Knowledge export endpoint
    this.server.get('/api/v1/export/:format', async (req, res) => {
      try {
        const format = req.params.format as 'turtle' | 'rdf-xml' | 'json-ld';
        const rdf = await this.graphzep.exportToRDF(format);
        
        res.setHeader('Content-Type', this.getContentType(format));
        res.send(rdf);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });
  }
}
```

## External System Integration

### Apache Jena Fuseki Integration

```typescript
const rdfDriver = new OptimizedRDFDriver({
  inMemory: false,
  sparqlEndpoint: 'http://fuseki.company.com:3030/dataset/sparql',
  sparqlUpdateEndpoint: 'http://fuseki.company.com:3030/dataset/update',
  authentication: {
    type: 'bearer',
    token: process.env.FUSEKI_TOKEN
  },
  requestConfig: {
    timeout: 30000,
    retries: 3
  }
});

// Test connection
try {
  await rdfDriver.connect();
  console.log('Connected to Fuseki successfully');
} catch (error) {
  console.error('Fuseki connection failed:', error);
}
```

### Blazegraph Integration

```typescript
const rdfDriver = new OptimizedRDFDriver({
  sparqlEndpoint: 'http://blazegraph.company.com:9999/blazegraph/namespace/kb/sparql',
  requestConfig: {
    headers: {
      'Accept': 'application/sparql-results+json',
      'Content-Type': 'application/sparql-query'
    }
  }
});
```

### GraphDB Integration

```typescript
const rdfDriver = new OptimizedRDFDriver({
  sparqlEndpoint: 'http://graphdb.company.com:7200/repositories/knowledge',
  authentication: {
    type: 'basic',
    username: process.env.GRAPHDB_USER,
    password: process.env.GRAPHDB_PASSWORD
  }
});
```

### AWS Neptune Integration (Planned)

```typescript
// Future implementation
const rdfDriver = new OptimizedRDFDriver({
  provider: 'neptune',
  endpoint: 'https://neptune-cluster.cluster-xyz.us-east-1.neptune.amazonaws.com:8182',
  authentication: {
    type: 'aws-iam',
    region: 'us-east-1'
  }
});
```

## Migration Strategies

### 1. Gradual Migration from Neo4j

```typescript
class Neo4jToRDFMigrator {
  private neo4jDriver: Neo4jDriver;
  private rdfDriver: OptimizedRDFDriver;
  
  async migrateIncrementally(): Promise<void> {
    // 1. Run both systems in parallel
    const batchSize = 1000;
    let offset = 0;
    
    while (true) {
      const neo4jMemories = await this.neo4jDriver.getMemories(batchSize, offset);
      if (neo4jMemories.length === 0) break;
      
      // 2. Convert and add to RDF
      for (const memory of neo4jMemories) {
        await this.graphzep.addEpisode({
          content: memory.content,
          metadata: { ...memory.metadata, migrated: true }
        });
      }
      
      offset += batchSize;
      console.log(`Migrated ${offset} memories`);
    }
  }
  
  async validateMigration(): Promise<ValidationReport> {
    const neo4jCount = await this.neo4jDriver.getMemoryCount();
    const rdfCount = await this.getRDFMemoryCount();
    
    return {
      sourceCount: neo4jCount,
      targetCount: rdfCount,
      success: neo4jCount === rdfCount
    };
  }
}
```

### 2. Schema Evolution Pattern

```typescript
class RDFSchemaEvolution {
  private graphzep: Graphzep;
  private versionManager: SchemaVersionManager;
  
  async migrateToNewSchema(fromVersion: string, toVersion: string): Promise<void> {
    const migrationPlan = this.versionManager.getMigrationPlan(fromVersion, toVersion);
    
    for (const step of migrationPlan.steps) {
      switch (step.type) {
        case 'rename_property':
          await this.renameProperty(step.oldName, step.newName);
          break;
        case 'add_property':
          await this.addProperty(step.property, step.defaultValue);
          break;
        case 'transform_values':
          await this.transformValues(step.property, step.transformer);
          break;
      }
    }
  }
  
  private async renameProperty(oldName: string, newName: string): Promise<void> {
    await this.graphzep.sparqlQuery(`
      DELETE { ?s <${oldName}> ?o }
      INSERT { ?s <${newName}> ?o }
      WHERE { ?s <${oldName}> ?o }
    `);
  }
}
```

## Production Deployment

### Configuration Management

```typescript
// production-config.ts
export const ProductionRDFConfig: RDFDriverConfig = {
  inMemory: false,
  sparqlEndpoint: process.env.SPARQL_ENDPOINT_URL,
  authentication: {
    type: 'basic',
    username: process.env.SPARQL_USERNAME,
    password: process.env.SPARQL_PASSWORD
  },
  cacheSize: 100000,                    // Large cache for production
  batchSize: 5000,                      // Larger batches for efficiency
  requestConfig: {
    timeout: 60000,                     // 60-second timeout
    retries: 3,
    retryDelay: 1000
  },
  performanceOptimization: {
    enableQueryCache: true,
    queryCacheTTL: 300000,             // 5-minute cache
    enableBackgroundProcessing: true,
    backgroundProcessingInterval: 30000 // 30-second intervals
  }
};
```

### Health Monitoring

```typescript
class RDFHealthMonitor {
  private metrics: {
    queryLatency: HistogramMetric;
    errorRate: CounterMetric;
    tripleCount: GaugeMetric;
    cacheHitRate: GaugeMetric;
  };
  
  async healthCheck(): Promise<HealthStatus> {
    try {
      // Test basic connectivity
      const startTime = Date.now();
      await this.graphzep.sparqlQuery('SELECT (COUNT(*) as ?count) WHERE { ?s ?p ?o }');
      const latency = Date.now() - startTime;
      
      // Check cache performance
      const cacheStats = this.rdfDriver.getCacheStats();
      
      // Check memory usage
      const memoryUsage = process.memoryUsage();
      
      return {
        status: 'healthy',
        latency,
        cacheHitRate: cacheStats.hitRate,
        memoryUsage: memoryUsage.heapUsed,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}
```

### Load Balancing

```typescript
class LoadBalancedRDFDriver {
  private drivers: OptimizedRDFDriver[];
  private currentIndex = 0;
  
  constructor(endpoints: string[]) {
    this.drivers = endpoints.map(endpoint => 
      new OptimizedRDFDriver({ sparqlEndpoint: endpoint })
    );
  }
  
  async executeQuery(query: string): Promise<any> {
    const driver = this.getNextDriver();
    
    try {
      return await driver.executeQuery(query);
    } catch (error) {
      // Try next driver on failure
      const backupDriver = this.getNextDriver();
      return await backupDriver.executeQuery(query);
    }
  }
  
  private getNextDriver(): OptimizedRDFDriver {
    const driver = this.drivers[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.drivers.length;
    return driver;
  }
}
```

## Troubleshooting

### Common Issues and Solutions

#### 1. SPARQL Query Performance Issues

**Problem**: Slow SPARQL queries
```typescript
// Inefficient query
const slowQuery = `
  SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
    FILTER regex(?o, ".*searchTerm.*", "i")
  }
`;
```

**Solution**: Use indexes and optimize patterns
```typescript
// Optimized query
const fastQuery = `
  SELECT ?s ?p ?o WHERE {
    ?s rdf:type zep:EpisodicMemory .
    ?s zep:content ?content .
    ?s ?p ?o .
    FILTER contains(lcase(?content), "searchterm")
  }
`;
```

#### 2. Memory Pressure Issues

**Problem**: High memory usage
```typescript
// Monitor memory usage
const memoryMonitor = new RDFMemoryMonitor();
memoryMonitor.on('pressure', async (stats) => {
  console.warn('Memory pressure detected:', stats);
  
  // Trigger cleanup
  await rdfDriver.triggerGarbageCollection();
  
  // Reduce cache sizes temporarily
  rdfDriver.updateConfig({
    cacheSize: stats.cacheSize * 0.7
  });
});
```

#### 3. Connection Timeouts

**Problem**: SPARQL endpoint timeouts
```typescript
// Add retry logic with exponential backoff
class RetryableSPARQLClient {
  async executeWithRetry(query: string, maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(query);
      } catch (error) {
        if (attempt === maxRetries) throw error;
        
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await this.sleep(delay);
      }
    }
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

#### 4. Ontology Validation Errors

**Problem**: Triple validation failures
```typescript
// Add validation middleware
class ValidatingRDFDriver extends OptimizedRDFDriver {
  async addTriple(triple: RDFTriple): Promise<void> {
    const validation = this.ontologyManager.validateTriple(triple);
    
    if (!validation.valid) {
      // Log warning but continue (graceful degradation)
      console.warn('Invalid triple:', triple, validation.errors);
      
      if (validation.severity === 'error') {
        throw new TripleValidationError(validation.errors);
      }
    }
    
    return super.addTriple(triple);
  }
}
```

### Debugging Tools

```typescript
class RDFDebugger {
  static logQuery(query: string, results: any, duration: number): void {
    console.log('SPARQL Query Debug:', {
      query: query.substring(0, 200) + '...',
      resultCount: results.bindings?.length || 0,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  }
  
  static validateTripleStructure(triple: RDFTriple): ValidationResult {
    const errors: string[] = [];
    
    if (!triple.subject) errors.push('Missing subject');
    if (!triple.predicate) errors.push('Missing predicate');
    if (!triple.object) errors.push('Missing object');
    
    // Check URI format
    if (!this.isValidURI(triple.subject)) {
      errors.push(`Invalid subject URI: ${triple.subject}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private static isValidURI(uri: string): boolean {
    try {
      new URL(uri);
      return true;
    } catch {
      return uri.includes(':'); // Accept prefixed URIs
    }
  }
}
```

## Best Practices

### 1. Query Optimization

```typescript
// Good: Use specific types and filters early
const optimizedQuery = `
  PREFIX zep: <http://graphzep.ai/ontology#>
  PREFIX zeptime: <http://graphzep.ai/temporal#>
  
  SELECT ?memory ?content ?confidence
  WHERE {
    ?memory rdf:type zep:EpisodicMemory .        # Filter by type first
    ?memory zep:sessionId "user_123" .           # Filter by session early
    ?memory zep:content ?content .
    ?memory zep:confidence ?confidence .
    ?memory zeptime:validFrom ?validFrom .
    FILTER (?validFrom > "2024-01-01"^^xsd:date) # Use indexed properties
    FILTER (?confidence > 0.8)                   # Final confidence filter
  }
  ORDER BY DESC(?confidence) DESC(?validFrom)
  LIMIT 20
`;

// Bad: Generic patterns without early filtering
const slowQuery = `
  SELECT ?s ?p ?o WHERE {
    ?s ?p ?o .
    FILTER regex(str(?o), "searchterm", "i")
  }
`;
```

### 2. Batch Processing

```typescript
// Process large datasets in batches
class BatchRDFProcessor {
  async processBulkData(data: any[], batchSize = 1000): Promise<void> {
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      try {
        await this.processBatch(batch);
        console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(data.length / batchSize)}`);
      } catch (error) {
        console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
        // Consider implementing retry logic or error recovery
      }
    }
  }
  
  private async processBatch(batch: any[]): Promise<void> {
    const triples = batch.flatMap(item => this.convertToTriples(item));
    await this.rdfDriver.addTriples(triples);
  }
}
```

### 3. Caching Strategy

```typescript
// Implement intelligent caching
class SmartRDFCache {
  private queryCache = new Map<string, CachedResult>();
  private frequencyMap = new Map<string, number>();
  
  async getCachedOrExecute(query: string): Promise<any> {
    const cacheKey = this.generateCacheKey(query);
    
    // Check cache first
    const cached = this.queryCache.get(cacheKey);
    if (cached && !this.isCacheExpired(cached)) {
      this.recordCacheHit(cacheKey);
      return cached.result;
    }
    
    // Execute and cache
    const result = await this.rdfDriver.executeQuery(query);
    this.cacheResult(cacheKey, result, this.calculateTTL(query));
    
    return result;
  }
  
  private calculateTTL(query: string): number {
    // Longer TTL for queries that don't involve recent data
    if (query.includes('validFrom') && query.includes('2024')) {
      return 60000; // 1 minute for recent data
    }
    return 300000; // 5 minutes for historical data
  }
}
```

### 4. Error Recovery

```typescript
class ResilientRDFSystem {
  async executeWithFallback(query: string): Promise<any> {
    try {
      // Try primary endpoint
      return await this.primaryDriver.executeQuery(query);
    } catch (primaryError) {
      console.warn('Primary RDF endpoint failed:', primaryError.message);
      
      try {
        // Try secondary endpoint
        return await this.secondaryDriver.executeQuery(query);
      } catch (secondaryError) {
        console.error('Secondary RDF endpoint also failed:', secondaryError.message);
        
        // Fallback to cached results or default response
        return this.getFallbackResult(query);
      }
    }
  }
  
  private getFallbackResult(query: string): any {
    // Return cached results or empty result set
    const cached = this.getCachedResult(query);
    if (cached) {
      console.log('Returning cached result due to endpoint failures');
      return cached;
    }
    
    return { bindings: [], message: 'Service temporarily unavailable' };
  }
}
```

---

This integration guide provides practical patterns for incorporating GraphZep's RDF support into real-world applications. Choose the patterns that best fit your architecture and scale them according to your needs.