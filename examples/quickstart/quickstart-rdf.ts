/**
 * GraphZep RDF Triple Store Quickstart
 * 
 * This example demonstrates:
 * - RDF triple store setup with in-memory storage
 * - SPARQL 1.1 queries with Zep extensions
 * - Episodic memory to RDF triple conversion
 * - Semantic fact extraction and validation
 * - Multiple RDF serialization formats
 * - Ontology management and validation
 */

import { 
  Graphzep,
  OptimizedRDFDriver,
  OpenAIClient,
  OpenAIEmbedder,
  MemoryType
} from '../../src/index.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🔗 GraphZep RDF Triple Store Quickstart\n');

  // Initialize RDF driver with in-memory triple store
  console.log('📊 Initializing RDF driver...');
  const rdfDriver = new OptimizedRDFDriver({
    inMemory: true,
    cacheSize: 10000,
    batchSize: 1000,
    // customOntologyPath: './custom-ontology.rdf' // Optional
  });

  await rdfDriver.connect();
  console.log('✅ RDF driver connected with in-memory store\n');

  // Initialize LLM and embedder
  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  // Create GraphZep with RDF support
  console.log('🚀 Creating GraphZep with RDF support...');
  const graphzep = new Graphzep({
    driver: rdfDriver,
    llmClient,
    embedder,
  });

  console.log(`✅ RDF support enabled: ${graphzep.isRDFSupported()}\n`);

  // Add episodic memories that get converted to RDF triples
  console.log('📝 Adding episodic memories...');
  
  await graphzep.addEpisode({
    content: 'Alice works as a machine learning engineer at ACME Corporation. She specializes in deep learning and computer vision.',
    metadata: { source: 'conversation', confidence: 0.95 }
  });

  await graphzep.addEpisode({
    content: 'Bob is the CTO of TechStart Inc. He has expertise in distributed systems and blockchain technology.',
    metadata: { source: 'interview', confidence: 0.9 }
  });

  await graphzep.addEpisode({
    content: 'Alice and Bob collaborated on a research paper about federated learning published in ICML 2024.',
    metadata: { source: 'publication', confidence: 1.0 }
  });

  console.log('✅ Episodes added and converted to RDF triples\n');

  // Add semantic facts directly
  console.log('🧬 Adding semantic facts...');
  
  await graphzep.addFact({
    subject: 'zepent:alice',
    predicate: 'zep:hasExpertise',
    object: 'zepent:deep-learning',
    confidence: 0.95,
    sourceMemoryIds: [],
    validFrom: new Date(),
  });

  await graphzep.addFact({
    subject: 'zepent:bob',
    predicate: 'zep:hasRole',
    object: 'zepent:cto-role',
    confidence: 0.9,
    sourceMemoryIds: [],
    validFrom: new Date(),
  });

  console.log('✅ Semantic facts added to knowledge graph\n');

  // Execute SPARQL queries
  console.log('🔍 Executing SPARQL queries...\n');

  // Basic query: Find all memories
  console.log('Query 1: All episodic memories');
  const allMemories = await graphzep.sparqlQuery(`
    PREFIX zep: <http://graphzep.ai/ontology#>
    
    SELECT ?memory ?content
    WHERE {
      ?memory a zep:EpisodicMemory ;
              zep:content ?content .
    }
    LIMIT 5
  `);
  console.log('Results:', allMemories.bindings?.length || 0, 'memories found\n');

  // Advanced query: Find people with their expertise
  console.log('Query 2: People and their expertise areas');
  const expertise = await graphzep.sparqlQuery(`
    PREFIX zep: <http://graphzep.ai/ontology#>
    PREFIX zepent: <http://graphzep.ai/entity#>
    
    SELECT ?person ?expertise
    WHERE {
      ?person a zep:Person ;
              zep:hasExpertise ?expertise .
    }
  `);
  console.log('Results:', expertise.bindings?.length || 0, 'expertise relationships found\n');

  // Temporal query: Recent memories
  console.log('Query 3: Recent memories (last hour)');
  const recentMemories = await graphzep.getMemoriesAtTime(
    new Date(), 
    [MemoryType.EPISODIC, MemoryType.SEMANTIC]
  );
  console.log('Results:', recentMemories.length, 'recent memories\n');

  // Search memories with semantic search
  console.log('🔍 Searching memories semantically...');
  const searchResults = await graphzep.searchMemories({
    query: 'machine learning researchers',
    limit: 10,
    searchType: 'semantic'
  });
  console.log(`Found ${searchResults.length} relevant memories\n`);

  // Find related entities
  console.log('🕸️ Finding related entities...');
  const relatedToAlice = await graphzep.findRelatedEntities('Alice', 2, 0.5);
  console.log(`Found ${relatedToAlice.length} entities related to Alice\n`);

  // Get facts about specific entity
  console.log('📋 Getting facts about Alice...');
  const aliceFacts = await graphzep.getFactsAboutEntity('Alice');
  console.log(`Found ${aliceFacts.length} facts about Alice\n`);

  // Export knowledge graph to different RDF formats
  console.log('📤 Exporting knowledge graph to RDF formats...\n');

  // Turtle format
  console.log('Turtle format:');
  const turtle = await graphzep.exportToRDF('turtle');
  console.log(turtle.substring(0, 200) + '...\n');

  // JSON-LD format
  console.log('JSON-LD format:');
  const jsonLd = await graphzep.exportToRDF('json-ld');
  console.log(JSON.parse(jsonLd)['@context'] ? 'JSON-LD with context exported successfully' : 'JSON-LD exported\n');

  // RDF/XML format
  console.log('RDF/XML format:');
  const rdfXml = await graphzep.exportToRDF('rdf-xml');
  console.log(rdfXml.includes('<?xml') ? 'RDF/XML exported successfully' : 'RDF/XML exported\n');

  // Get SPARQL query templates
  console.log('📚 Available SPARQL templates:');
  const templates = graphzep.getSPARQLTemplates();
  console.log('Templates:', Object.keys(templates).join(', '), '\n');

  // Performance demonstration
  console.log('⚡ Performance demonstration...');
  const startTime = Date.now();
  
  // Add many triples quickly
  for (let i = 0; i < 100; i++) {
    await graphzep.addFact({
      subject: `zepent:entity${i}`,
      predicate: 'zep:hasProperty',
      object: `zepent:value${i}`,
      confidence: Math.random(),
      sourceMemoryIds: [],
      validFrom: new Date(),
    });
  }
  
  const endTime = Date.now();
  console.log(`✅ Added 100 facts in ${endTime - startTime}ms (${((endTime - startTime) / 100).toFixed(2)}ms per fact)\n`);

  // Query performance
  const queryStart = Date.now();
  const allFacts = await graphzep.sparqlQuery(`
    PREFIX zep: <http://graphzep.ai/ontology#>
    
    SELECT ?subject ?predicate ?object
    WHERE {
      ?subject ?predicate ?object .
    }
    LIMIT 50
  `);
  const queryEnd = Date.now();
  console.log(`✅ Queried ${allFacts.bindings?.length || 0} triples in ${queryEnd - queryStart}ms\n`);

  // Cleanup
  console.log('🧹 Cleaning up...');
  await graphzep.close();
  console.log('✅ GraphZep closed successfully');

  console.log('\n🎉 RDF Triple Store quickstart completed!');
  console.log('📚 Key features demonstrated:');
  console.log('  • In-memory RDF triple store');
  console.log('  • SPARQL 1.1 query execution');
  console.log('  • Episodic memory to RDF conversion');
  console.log('  • Semantic fact management');
  console.log('  • Multiple RDF serialization formats');
  console.log('  • Temporal and confidence-based queries');
  console.log('  • High-performance batch operations');
}

// Run the example
main().catch(console.error);