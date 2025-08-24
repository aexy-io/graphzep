/**
 * GraphZep RDF Quickstart Example
 * Demonstrates basic RDF functionality with GraphZep
 */

import { Graphzep, OptimizedRDFDriver } from '../src/index.js';
import { OpenAIClient } from '../src/llm/openai.js';
import { OpenAIEmbedder } from '../src/embedders/openai.js';
import { MemoryType } from '../src/zep/types.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function main() {
  console.log('🧠 GraphZep RDF Quickstart Example\n');

  // Initialize RDF driver with in-memory store
  const rdfDriver = new OptimizedRDFDriver({
    inMemory: true,
    cacheSize: 10000,
    batchSize: 1000
  });

  // Initialize LLM and embedder clients
  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4'
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small'
  });

  // Initialize GraphZep with RDF support
  const graphzep = new Graphzep({
    driver: rdfDriver,
    llmClient,
    embedder,
    groupId: 'rdf-demo',
    rdfConfig: {
      includeEmbeddings: true,
      embeddingSchema: 'vector-ref'
    }
  });

  console.log('✅ GraphZep initialized with RDF support');
  console.log(`🔧 RDF Support Enabled: ${graphzep.isRDFSupported()}\n`);

  try {
    // Step 1: Add episodic memories
    console.log('📝 Step 1: Adding episodic memories...');
    
    const memory1 = await graphzep.addEpisode({
      content: 'Alice Johnson works as a software engineer at ACME Corporation in San Francisco.',
      metadata: { source: 'conversation', confidence: 0.9 }
    });
    console.log(`✅ Added episodic memory: ${memory1.uuid}`);

    const memory2 = await graphzep.addEpisode({
      content: 'Bob Smith is the CTO of ACME Corporation and is Alice\'s manager.',
      metadata: { source: 'conversation', confidence: 0.95 }
    });
    console.log(`✅ Added episodic memory: ${memory2.uuid}`);

    const memory3 = await graphzep.addEpisode({
      content: 'ACME Corporation is developing a new AI-powered product called SmartAssist.',
      metadata: { source: 'document', confidence: 0.85 }
    });
    console.log(`✅ Added episodic memory: ${memory3.uuid}\n`);

    // Step 2: Add semantic facts
    console.log('🧠 Step 2: Adding semantic facts...');
    
    const fact1 = await graphzep.addFact({
      subject: 'zepent:alice-johnson',
      predicate: 'zep:worksAt',
      object: 'zepent:acme-corp',
      confidence: 0.95,
      sourceMemoryIds: [memory1.uuid!],
      validFrom: new Date()
    });
    console.log(`✅ Added fact: Alice works at ACME Corp`);

    const fact2 = await graphzep.addFact({
      subject: 'zepent:bob-smith',
      predicate: 'zep:managerOf',
      object: 'zepent:alice-johnson',
      confidence: 0.9,
      sourceMemoryIds: [memory2.uuid!],
      validFrom: new Date()
    });
    console.log(`✅ Added fact: Bob manages Alice`);

    const fact3 = await graphzep.addFact({
      subject: 'zepent:acme-corp',
      predicate: 'zep:develops',
      object: 'zepent:smartassist',
      confidence: 0.85,
      sourceMemoryIds: [memory3.uuid!],
      validFrom: new Date()
    });
    console.log(`✅ Added fact: ACME develops SmartAssist\n`);

    // Step 3: Execute SPARQL queries
    console.log('🔍 Step 3: Executing SPARQL queries...');
    
    // Query all memories
    const allMemoriesQuery = `
      SELECT ?memory ?type ?content ?confidence ?sessionId
      WHERE {
        ?memory a ?type ;
                zep:content ?content ;
                zep:confidence ?confidence ;
                zep:sessionId ?sessionId .
        
        FILTER(?type IN (zep:EpisodicMemory, zep:SemanticMemory))
      }
      ORDER BY DESC(?confidence)
    `;
    
    const allMemories = await graphzep.sparqlQuery(allMemoriesQuery);
    console.log(`📊 Found ${allMemories.bindings.length} memories:`);
    allMemories.bindings.forEach((binding: any, index: number) => {
      console.log(`  ${index + 1}. ${binding.type?.split('#').pop()}: ${binding.content} (confidence: ${binding.confidence})`);
    });

    // Query facts about ACME Corporation
    const acmeFactsQuery = `
      SELECT ?subject ?predicate ?object ?confidence
      WHERE {
        ?fact a zep:SemanticMemory ;
              zep:hasStatement ?statement ;
              zep:confidence ?confidence .
        
        ?statement rdf:subject ?subject ;
                   rdf:predicate ?predicate ;
                   rdf:object ?object .
        
        FILTER(CONTAINS(LCASE(STR(?subject)), "acme") || CONTAINS(LCASE(STR(?object)), "acme"))
      }
      ORDER BY DESC(?confidence)
    `;
    
    const acmeFacts = await graphzep.sparqlQuery(acmeFactsQuery);
    console.log(`\n🏢 Facts about ACME Corporation:`);
    acmeFacts.bindings.forEach((binding: any, index: number) => {
      const subject = binding.subject?.split(':').pop() || binding.subject;
      const predicate = binding.predicate?.split('#').pop() || binding.predicate;
      const object = binding.object?.split(':').pop() || binding.object;
      console.log(`  ${index + 1}. ${subject} ${predicate} ${object} (confidence: ${binding.confidence})`);
    });

    // Step 4: Use Zep-specific search
    console.log('\n🔍 Step 4: Semantic memory search...');
    
    const searchResults = await graphzep.searchMemories({
      query: 'software engineer',
      limit: 5,
      searchType: 'semantic'
    });
    
    console.log(`📋 Search results for "software engineer":`);
    searchResults.forEach((result, index) => {
      console.log(`  ${index + 1}. ${result.memory.content} (score: ${result.score.toFixed(3)})`);
    });

    // Step 5: Temporal queries
    console.log('\n⏰ Step 5: Temporal queries...');
    
    const now = new Date();
    const recentMemories = await graphzep.getMemoriesAtTime(now, [MemoryType.EPISODIC]);
    console.log(`📅 Memories valid at ${now.toISOString()}:`);
    recentMemories.forEach((memory, index) => {
      console.log(`  ${index + 1}. ${memory.content?.substring(0, 60)}...`);
    });

    // Step 6: Entity relationship discovery
    console.log('\n🕸️ Step 6: Entity relationship discovery...');
    
    const aliceRelations = await graphzep.findRelatedEntities('alice', 2, 0.5);
    console.log(`🔗 Entities related to Alice:`);
    aliceRelations.forEach((relation, index) => {
      console.log(`  ${index + 1}. Related to: ${relation.relatedEntity} via ${relation.relationPath} (confidence: ${relation.totalConfidence})`);
    });

    // Step 7: Export to RDF
    console.log('\n📤 Step 7: Exporting to RDF formats...');
    
    const turtleExport = await graphzep.exportToRDF('turtle');
    console.log(`🐢 Turtle format (first 200 characters):`);
    console.log(`${turtleExport.substring(0, 200)}...\n`);

    // Step 8: Use SPARQL templates
    console.log('📋 Step 8: Available SPARQL templates:');
    const templates = graphzep.getSPARQLTemplates();
    Object.keys(templates).forEach((templateName, index) => {
      console.log(`  ${index + 1}. ${templateName}`);
    });

    // Execute a template query
    const highConfidenceQuery = templates.highConfidenceFacts;
    const highConfidenceFacts = await graphzep.sparqlQuery(highConfidenceQuery);
    console.log(`\n⭐ High confidence facts (>=0.8):`);
    highConfidenceFacts.bindings.forEach((binding: any, index: number) => {
      const subject = binding.subject?.split(':').pop() || binding.subject;
      const predicate = binding.predicate?.split('#').pop() || binding.predicate;
      const object = binding.object?.split(':').pop() || binding.object;
      console.log(`  ${index + 1}. ${subject} ${predicate} ${object} (${binding.confidence})`);
    });

    // Step 9: Ontology statistics
    console.log('\n📊 Step 9: Ontology information...');
    try {
      const ontologyStats = graphzep.getOntologyStats();
      console.log(`📈 Ontology Statistics:`);
      console.log(`  - Classes: ${ontologyStats.totalClasses}`);
      console.log(`  - Properties: ${ontologyStats.totalProperties}`);
      console.log(`  - Depth: ${ontologyStats.depth}`);
      console.log(`  - Complexity: ${ontologyStats.complexity}`);
    } catch (error) {
      console.log(`ℹ️ Ontology statistics not available (using default ontology)`);
    }

    console.log('\n🎉 RDF Quickstart completed successfully!');
    console.log('\nKey RDF Features Demonstrated:');
    console.log('✅ In-memory RDF triple store');
    console.log('✅ Automatic conversion of Zep memories to RDF');
    console.log('✅ SPARQL 1.1 query support');
    console.log('✅ Semantic and temporal queries');
    console.log('✅ Entity relationship discovery');
    console.log('✅ RDF export in multiple formats');
    console.log('✅ Hybrid performance optimization');
    console.log('✅ Ontology-guided extraction');

  } catch (error) {
    console.error('❌ Error during RDF quickstart:', error);
  } finally {
    // Clean up
    await graphzep.close();
    console.log('\n👋 GraphZep RDF driver closed');
  }
}

// Advanced RDF Features Demo
async function advancedRDFDemo() {
  console.log('\n🚀 Advanced RDF Features Demo\n');

  const rdfDriver = new OptimizedRDFDriver({
    inMemory: true,
    cacheSize: 10000,
    batchSize: 1000
  });

  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4'
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!
  });

  const graphzep = new Graphzep({
    driver: rdfDriver,
    llmClient,
    embedder,
    groupId: 'advanced-demo'
  });

  try {
    // Complex SPARQL query with aggregations
    console.log('📊 Complex aggregation query...');
    
    // Add some test data first
    await graphzep.addEpisode({
      content: 'The AI conference had 500 attendees from 20 countries.',
      metadata: { confidence: 0.9 }
    });
    
    await graphzep.addEpisode({
      content: 'GraphZep was presented at the AI conference by the research team.',
      metadata: { confidence: 0.95 }
    });

    const aggregationQuery = `
      SELECT ?sessionId 
             (COUNT(?memory) AS ?memoryCount)
             (AVG(?confidence) AS ?avgConfidence)
             (MAX(?createdAt) AS ?latestMemory)
      WHERE {
        ?memory a zep:EpisodicMemory ;
                zep:sessionId ?sessionId ;
                zep:confidence ?confidence ;
                zep:createdAt ?createdAt .
      }
      GROUP BY ?sessionId
      ORDER BY DESC(?memoryCount)
    `;

    const aggregationResults = await graphzep.sparqlQuery(aggregationQuery);
    console.log('📈 Session statistics:');
    aggregationResults.bindings.forEach((binding: any, index: number) => {
      console.log(`  ${index + 1}. Session: ${binding.sessionId}`);
      console.log(`      Memories: ${binding.memoryCount}, Avg Confidence: ${parseFloat(binding.avgConfidence).toFixed(3)}`);
    });

    // Reasoning query - find potential contradictions
    console.log('\n🤔 Looking for potential contradictions...');
    
    const contradictionQuery = `
      SELECT ?entity ?predicate ?value1 ?value2 ?confidence1 ?confidence2
      WHERE {
        ?fact1 a zep:SemanticMemory ;
               zep:hasStatement ?stmt1 ;
               zep:confidence ?confidence1 .
        
        ?fact2 a zep:SemanticMemory ;
               zep:hasStatement ?stmt2 ;
               zep:confidence ?confidence2 .
        
        ?stmt1 rdf:subject ?entity ;
               rdf:predicate ?predicate ;
               rdf:object ?value1 .
        
        ?stmt2 rdf:subject ?entity ;
               rdf:predicate ?predicate ;
               rdf:object ?value2 .
        
        FILTER(?fact1 != ?fact2)
        FILTER(?value1 != ?value2)
        FILTER(?confidence1 >= 0.7 && ?confidence2 >= 0.7)
      }
    `;

    const contradictions = await graphzep.sparqlQuery(contradictionQuery);
    if (contradictions.bindings.length > 0) {
      console.log('⚠️ Potential contradictions found:');
      contradictions.bindings.forEach((binding: any, index: number) => {
        console.log(`  ${index + 1}. ${binding.entity} ${binding.predicate}:`);
        console.log(`      Value 1: ${binding.value1} (confidence: ${binding.confidence1})`);
        console.log(`      Value 2: ${binding.value2} (confidence: ${binding.confidence2})`);
      });
    } else {
      console.log('✅ No contradictions found');
    }

    // Path finding query
    console.log('\n🛤️ Finding paths between entities...');
    
    const pathQuery = `
      SELECT ?start ?intermediate ?end ?path
      WHERE {
        ?fact1 a zep:SemanticMemory ;
               zep:hasStatement ?stmt1 .
        
        ?fact2 a zep:SemanticMemory ;
               zep:hasStatement ?stmt2 .
        
        ?stmt1 rdf:subject ?start ;
               rdf:predicate ?pred1 ;
               rdf:object ?intermediate .
        
        ?stmt2 rdf:subject ?intermediate ;
               rdf:predicate ?pred2 ;
               rdf:object ?end .
        
        FILTER(?start != ?end)
        BIND(CONCAT(STR(?pred1), " -> ", STR(?pred2)) AS ?path)
      }
      LIMIT 5
    `;

    const paths = await graphzep.sparqlQuery(pathQuery);
    console.log('🔗 Entity connection paths:');
    paths.bindings.forEach((binding: any, index: number) => {
      const start = binding.start?.split(':').pop() || binding.start;
      const intermediate = binding.intermediate?.split(':').pop() || binding.intermediate;
      const end = binding.end?.split(':').pop() || binding.end;
      console.log(`  ${index + 1}. ${start} -> ${intermediate} -> ${end}`);
      console.log(`      Path: ${binding.path}`);
    });

  } catch (error) {
    console.error('❌ Error in advanced demo:', error);
  } finally {
    await graphzep.close();
  }
}

// Main execution
if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => advancedRDFDemo())
    .then(() => {
      console.log('\n✨ All demos completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Demo failed:', error);
      process.exit(1);
    });
}