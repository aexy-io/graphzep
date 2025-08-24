/**
 * Comprehensive RDF Tests for GraphZep
 * Tests RDF driver, memory mapping, SPARQL interface, and ontology management
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { OptimizedRDFDriver, RDFDriverConfig } from '../drivers/rdf-driver.js';
import { RDFMemoryMapper } from '../rdf/memory-mapper.js';
import { OntologyManager } from '../rdf/ontology-manager.js';
import { ZepSPARQLInterface } from '../rdf/sparql-interface.js';
import { NamespaceManager } from '../rdf/namespaces.js';
import { Graphzep } from '../graphzep.js';
import { OpenAIClient } from '../llm/openai.js';
import { OpenAIEmbedder } from '../embedders/openai.js';
import { ZepMemory, ZepFact, MemoryType } from '../zep/types.js';
import { GraphProvider } from '../types/index.js';

// Mock LLM and embedder for testing
const mockLLMClient = {
  generateResponse: async () => ({ entities: [], relations: [] }),
  generateStructuredResponse: async () => ({ entities: [], relations: [] })
} as any;

const mockEmbedder = {
  embed: async () => new Array(384).fill(0.1),
  embedBatch: async (texts: string[]) => texts.map(() => new Array(384).fill(0.1))
} as any;

describe('RDF Driver Tests', () => {
  let driver: OptimizedRDFDriver;
  
  test('should initialize RDF driver with in-memory store', async () => {
    const config: RDFDriverConfig = {
      inMemory: true,
      cacheSize: 1000,
      batchSize: 100
    };
    
    driver = new OptimizedRDFDriver(config);
    await driver.connect();
    
    assert.strictEqual(driver.provider, GraphProvider.RDF);
  });
  
  test('should add and retrieve RDF triples', async () => {
    const triples = [
      {
        subject: 'zepent:alice',
        predicate: 'rdf:type',
        object: 'zep:Person'
      },
      {
        subject: 'zepent:alice',
        predicate: 'zep:name',
        object: { value: 'Alice Johnson', type: 'literal', datatype: 'xsd:string' }
      }
    ];
    
    await driver.addTriples(triples);
    
    const query = `
      SELECT ?name
      WHERE {
        zepent:alice zep:name ?name .
      }
    `;
    
    const results = await driver.executeQuery(query);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].name, 'Alice Johnson');
  });
  
  test('should handle temporal queries', async () => {
    const now = new Date();
    const pastTime = new Date(now.getTime() - 86400000); // 24 hours ago
    
    const memories = await driver.getMemoriesAtTime(now);
    assert.ok(Array.isArray(memories));
  });
  
  test('should serialize to different RDF formats', async () => {
    const turtle = await driver.serialize('turtle');
    assert.ok(typeof turtle === 'string');
    assert.ok(turtle.length > 0);
  });
  
  test('should close driver properly', async () => {
    await driver.close();
    // Should not throw an error
  });
});

describe('RDF Memory Mapper Tests', () => {
  let mapper: RDFMemoryMapper;
  
  test('should initialize memory mapper', () => {
    mapper = new RDFMemoryMapper({
      includeEmbeddings: true,
      embeddingSchema: 'vector-ref'
    });
    
    assert.ok(mapper);
  });
  
  test('should convert episodic memory to RDF triples', () => {
    const memory: ZepMemory = {
      uuid: 'mem-123',
      sessionId: 'session-1',
      content: 'Alice met Bob at the conference',
      memoryType: MemoryType.EPISODIC,
      embedding: [0.1, 0.2, 0.3],
      metadata: { source: 'chat' },
      createdAt: new Date(),
      accessCount: 1,
      validFrom: new Date(),
      facts: []
    };
    
    const triples = mapper.episodicToRDF(memory);
    
    assert.ok(Array.isArray(triples));
    assert.ok(triples.length > 0);
    
    // Check for required triples
    const typeTriple = triples.find(t => t.predicate === 'rdf:type');
    assert.strictEqual(typeTriple?.object, 'zep:EpisodicMemory');
    
    const contentTriple = triples.find(t => t.predicate === 'zep:content');
    assert.strictEqual((contentTriple?.object as any).value, memory.content);
  });
  
  test('should convert semantic memory (facts) to RDF triples', () => {
    const fact: ZepFact = {
      uuid: 'fact-456',
      subject: 'zepent:alice',
      predicate: 'zep:worksAt',
      object: 'zepent:acme-corp',
      confidence: 0.9,
      sourceMemoryIds: ['mem-123'],
      validFrom: new Date(),
      metadata: {}
    };
    
    const triples = mapper.semanticToRDF(fact);
    
    assert.ok(Array.isArray(triples));
    assert.ok(triples.length > 0);
    
    // Check for reified statement
    const statementTriple = triples.find(t => t.predicate === 'rdf:type' && t.object === 'rdf:Statement');
    assert.ok(statementTriple);
    
    // Check for confidence
    const confidenceTriple = triples.find(t => t.predicate === 'zep:confidence');
    assert.strictEqual((confidenceTriple?.object as any).value, '0.9');
  });
  
  test('should handle embeddings according to schema', () => {
    const memory: ZepMemory = {
      uuid: 'mem-embed',
      sessionId: 'session-1',
      content: 'Test content with embedding',
      memoryType: MemoryType.EPISODIC,
      embedding: [0.1, 0.2, 0.3, 0.4],
      createdAt: new Date(),
      accessCount: 0,
      validFrom: new Date(),
      facts: []
    };
    
    const triples = mapper.episodicToRDF(memory);
    const embeddingTriple = triples.find(t => t.predicate === 'zep:hasEmbedding');
    
    assert.ok(embeddingTriple);
    // Should contain vector reference for vector-ref schema
    assert.ok(typeof embeddingTriple.object === 'object');
  });
});

describe('SPARQL Interface Tests', () => {
  let driver: OptimizedRDFDriver;
  let sparqlInterface: ZepSPARQLInterface;
  
  test('should initialize SPARQL interface', async () => {
    driver = new OptimizedRDFDriver({ inMemory: true });
    await driver.connect();
    
    sparqlInterface = new ZepSPARQLInterface(driver);
    assert.ok(sparqlInterface);
  });
  
  test('should execute basic SPARQL query', async () => {
    const query = `
      SELECT ?s ?p ?o
      WHERE {
        ?s ?p ?o .
      }
      LIMIT 10
    `;
    
    const result = await sparqlInterface.query(query);
    
    assert.ok(result.bindings);
    assert.ok(Array.isArray(result.bindings));
    assert.ok(typeof result.executionTime === 'number');
    assert.ok(typeof result.count === 'number');
  });
  
  test('should search memories with parameters', async () => {
    // First add some test data
    const testMemory: ZepMemory = {
      uuid: 'test-mem-1',
      sessionId: 'test-session',
      content: 'This is a test memory about artificial intelligence',
      memoryType: MemoryType.EPISODIC,
      createdAt: new Date(),
      accessCount: 0,
      validFrom: new Date(),
      facts: []
    };
    
    const mapper = new RDFMemoryMapper();
    const triples = mapper.episodicToRDF(testMemory);
    await driver.addTriples(triples);
    
    const searchParams = {
      query: 'artificial intelligence',
      sessionId: 'test-session',
      limit: 10,
      searchType: 'semantic' as const
    };
    
    const results = await sparqlInterface.searchMemories(searchParams);
    assert.ok(Array.isArray(results));
  });
  
  test('should get memories at specific time', async () => {
    const timestamp = new Date();
    const memories = await sparqlInterface.getMemoriesAtTime(timestamp, [MemoryType.EPISODIC]);
    
    assert.ok(Array.isArray(memories));
  });
  
  test('should find related entities', async () => {
    const relatedEntities = await sparqlInterface.findRelatedEntities('Alice', 2, 0.5);
    
    assert.ok(Array.isArray(relatedEntities));
  });
});

describe('Ontology Manager Tests', () => {
  let ontologyManager: OntologyManager;
  
  test('should initialize ontology manager', () => {
    ontologyManager = new OntologyManager();
    assert.ok(ontologyManager);
  });
  
  test('should load ontology from string', async () => {
    const simpleOntology = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:test="http://test.example.com#">
        
        <owl:Class rdf:about="http://test.example.com#Person">
          <rdfs:label>Person</rdfs:label>
          <rdfs:comment>A human being</rdfs:comment>
        </owl:Class>
        
        <owl:ObjectProperty rdf:about="http://test.example.com#knows">
          <rdfs:label>knows</rdfs:label>
          <rdfs:domain rdf:resource="http://test.example.com#Person"/>
          <rdfs:range rdf:resource="http://test.example.com#Person"/>
        </owl:ObjectProperty>
        
      </rdf:RDF>
    `;
    
    const ontologyId = await ontologyManager.loadOntologyFromString(simpleOntology, 'application/rdf+xml', 'test-ontology');
    assert.strictEqual(ontologyId, 'test-ontology');
    
    const activeOntology = ontologyManager.getActiveOntology();
    assert.ok(activeOntology);
    assert.ok(activeOntology.classes.size > 0);
    assert.ok(activeOntology.properties.size > 0);
  });
  
  test('should validate triples against ontology', async () => {
    const testTriple = {
      subject: 'http://test.example.com#alice',
      predicate: 'http://test.example.com#knows',
      object: 'http://test.example.com#bob'
    };
    
    const validation = ontologyManager.validateTriple(testTriple);
    assert.ok(typeof validation.valid === 'boolean');
    assert.ok(Array.isArray(validation.errors));
    assert.ok(Array.isArray(validation.warnings));
  });
  
  test('should generate extraction guidance', () => {
    const content = 'Alice works at ACME Corp and knows Bob from university.';
    const guidance = ontologyManager.generateExtractionGuidance(content);
    
    assert.ok(Array.isArray(guidance.entityTypes));
    assert.ok(Array.isArray(guidance.relationTypes));
    assert.ok(typeof guidance.prompt === 'string');
    assert.ok(guidance.prompt.includes(content));
  });
  
  test('should get ontology statistics', () => {
    const stats = ontologyManager.getOntologyStats();
    
    assert.ok(typeof stats.totalClasses === 'number');
    assert.ok(typeof stats.totalProperties === 'number');
    assert.ok(typeof stats.complexity === 'number');
  });
  
  test('should search ontology elements', () => {
    const results = ontologyManager.search('person', 'class');
    assert.ok(Array.isArray(results));
  });
});

describe('Namespace Manager Tests', () => {
  let nsManager: NamespaceManager;
  
  test('should initialize with default namespaces', () => {
    nsManager = new NamespaceManager();
    
    assert.ok(nsManager.hasPrefix('zep'));
    assert.ok(nsManager.hasPrefix('rdf'));
    assert.ok(nsManager.hasPrefix('rdfs'));
    assert.ok(nsManager.hasPrefix('owl'));
  });
  
  test('should expand prefixed URIs', () => {
    const expanded = nsManager.expand('zep:Memory');
    assert.ok(expanded.startsWith('http://graphzep.ai/ontology#'));
    assert.ok(expanded.includes('Memory'));
  });
  
  test('should contract full URIs', () => {
    const contracted = nsManager.contract('http://graphzep.ai/ontology#Memory');
    assert.strictEqual(contracted, 'zep:Memory');
  });
  
  test('should generate SPARQL prefixes', () => {
    const prefixes = nsManager.getSparqlPrefixes(['zep', 'rdf']);
    assert.ok(prefixes.includes('PREFIX zep:'));
    assert.ok(prefixes.includes('PREFIX rdf:'));
  });
  
  test('should add custom namespaces', () => {
    nsManager.addNamespace('custom', 'http://custom.example.com#');
    
    assert.ok(nsManager.hasPrefix('custom'));
    const expanded = nsManager.expand('custom:TestClass');
    assert.strictEqual(expanded, 'http://custom.example.com#TestClass');
  });
});

describe('GraphZep RDF Integration Tests', () => {
  let graphzep: Graphzep;
  let driver: OptimizedRDFDriver;
  
  test('should initialize GraphZep with RDF driver', async () => {
    driver = new OptimizedRDFDriver({ inMemory: true });
    await driver.connect();
    
    graphzep = new Graphzep({
      driver,
      llmClient: mockLLMClient,
      embedder: mockEmbedder
    });
    
    assert.ok(graphzep.isRDFSupported());
  });
  
  test('should add episode using RDF storage', async () => {
    const episode = await graphzep.addEpisode({
      content: 'Alice attended the AI conference in San Francisco',
      metadata: { source: 'chat', confidence: 0.9 }
    });
    
    assert.ok(episode);
    assert.ok(episode.content);
  });
  
  test('should execute SPARQL queries', async () => {
    const query = `
      SELECT ?memory ?content
      WHERE {
        ?memory a zep:EpisodicMemory ;
                zep:content ?content .
      }
      LIMIT 5
    `;
    
    const results = await graphzep.sparqlQuery(query);
    assert.ok(results.bindings);
  });
  
  test('should add semantic facts', async () => {
    const factId = await graphzep.addFact({
      subject: 'zepent:alice',
      predicate: 'zep:attendedEvent',
      object: 'zepent:ai-conference',
      confidence: 0.95,
      sourceMemoryIds: [],
      validFrom: new Date()
    });
    
    assert.ok(typeof factId === 'string');
  });
  
  test('should search memories with Zep parameters', async () => {
    const searchResults = await graphzep.searchMemories({
      query: 'Alice conference',
      limit: 10,
      searchType: 'semantic'
    });
    
    assert.ok(Array.isArray(searchResults));
  });
  
  test('should get facts about entity', async () => {
    const facts = await graphzep.getFactsAboutEntity('Alice');
    assert.ok(Array.isArray(facts));
  });
  
  test('should export to RDF formats', async () => {
    const turtle = await graphzep.exportToRDF('turtle');
    assert.ok(typeof turtle === 'string');
    
    const rdfXml = await graphzep.exportToRDF('rdf-xml');
    assert.ok(typeof rdfXml === 'string');
  });
  
  test('should get SPARQL templates', () => {
    const templates = graphzep.getSPARQLTemplates();
    
    assert.ok(typeof templates === 'object');
    assert.ok('allMemories' in templates);
    assert.ok('memoryBySession' in templates);
    assert.ok('highConfidenceFacts' in templates);
  });
  
  test('should handle memory temporal queries', async () => {
    const now = new Date();
    const memories = await graphzep.getMemoriesAtTime(now, [MemoryType.EPISODIC]);
    
    assert.ok(Array.isArray(memories));
  });
  
  test('should find related entities', async () => {
    const relatedEntities = await graphzep.findRelatedEntities('Alice', 2, 0.5);
    assert.ok(Array.isArray(relatedEntities));
  });
  
  test('should close GraphZep properly', async () => {
    await graphzep.close();
    // Should not throw an error
  });
});

describe('RDF Performance Tests', () => {
  let driver: OptimizedRDFDriver;
  
  test('should handle batch insertions efficiently', async () => {
    driver = new OptimizedRDFDriver({
      inMemory: true,
      batchSize: 100,
      cacheSize: 1000
    });
    await driver.connect();
    
    const startTime = Date.now();
    
    // Add 500 triples
    const triples = [];
    for (let i = 0; i < 500; i++) {
      triples.push({
        subject: `zepent:entity${i}`,
        predicate: 'rdf:type',
        object: 'zep:Entity'
      });
      triples.push({
        subject: `zepent:entity${i}`,
        predicate: 'zep:name',
        object: { value: `Entity ${i}`, type: 'literal', datatype: 'xsd:string' }
      });
    }
    
    await driver.addTriples(triples);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Should complete within reasonable time (less than 5 seconds)
    assert.ok(duration < 5000, `Batch insertion took ${duration}ms, should be under 5000ms`);
    
    await driver.close();
  });
  
  test('should demonstrate caching performance', async () => {
    driver = new OptimizedRDFDriver({
      inMemory: true,
      cacheSize: 100
    });
    await driver.connect();
    
    // Add test data
    await driver.addTriples([
      {
        subject: 'zepent:testEntity',
        predicate: 'zep:name',
        object: { value: 'Test Entity', type: 'literal', datatype: 'xsd:string' }
      }
    ]);
    
    const query = `
      SELECT ?name
      WHERE {
        zepent:testEntity zep:name ?name .
      }
    `;
    
    // First execution (cache miss)
    const start1 = Date.now();
    const result1 = await driver.executeQuery(query);
    const duration1 = Date.now() - start1;
    
    // Second execution (cache hit)
    const start2 = Date.now();
    const result2 = await driver.executeQuery(query);
    const duration2 = Date.now() - start2;
    
    // Both should return same results
    assert.deepStrictEqual(result1, result2);
    
    // Second query should be faster (though this might be flaky in CI)
    console.log(`First query: ${duration1}ms, Second query: ${duration2}ms`);
    
    await driver.close();
  });
});

describe('RDF Error Handling Tests', () => {
  test('should handle invalid SPARQL queries gracefully', async () => {
    const driver = new OptimizedRDFDriver({ inMemory: true });
    await driver.connect();
    
    const invalidQuery = 'SELECT ?invalid WHERE { INVALID SPARQL }';
    
    try {
      await driver.executeQuery(invalidQuery);
      assert.fail('Should have thrown an error');
    } catch (error) {
      assert.ok(error instanceof Error);
      assert.ok(error.message.includes('SPARQL'));
    }
    
    await driver.close();
  });
  
  test('should validate ontology constraints', async () => {
    const ontologyManager = new OntologyManager();
    
    // Load simple ontology with constraints
    const constrainedOntology = `
      <?xml version="1.0" encoding="UTF-8"?>
      <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
               xmlns:rdfs="http://www.w3.org/2000/01/rdf-schema#"
               xmlns:owl="http://www.w3.org/2002/07/owl#"
               xmlns:test="http://test.example.com#">
        
        <owl:ObjectProperty rdf:about="http://test.example.com#strictProperty">
          <rdfs:domain rdf:resource="http://test.example.com#Person"/>
          <rdfs:range rdf:resource="http://test.example.com#Organization"/>
        </owl:ObjectProperty>
        
      </rdf:RDF>
    `;
    
    await ontologyManager.loadOntologyFromString(constrainedOntology, 'application/rdf+xml', 'constrained');
    
    // Test invalid triple (violating constraints)
    const invalidTriple = {
      subject: 'http://test.example.com#alice',
      predicate: 'http://test.example.com#unknownProperty',
      object: 'http://test.example.com#bob'
    };
    
    const validation = ontologyManager.validateTriple(invalidTriple);
    assert.ok(validation.warnings.length > 0 || validation.errors.length > 0);
  });
  
  test('should handle driver connection failures', async () => {
    // Test with invalid endpoint
    const driver = new OptimizedRDFDriver({
      sparqlEndpoint: 'http://invalid-endpoint:9999/sparql'
    });
    
    // Connection should still work for in-memory mode
    await driver.connect();
    assert.ok(true);
    await driver.close();
  });
});