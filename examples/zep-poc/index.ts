#!/usr/bin/env node

/**
 * Zep Memory System POC using Graphzep
 * 
 * This example demonstrates:
 * 1. Session-based memory management
 * 2. Fact extraction from conversations
 * 3. Hybrid search (semantic + keyword + graph)
 * 4. Memory reranking strategies (MMR, RRF)
 * 5. Temporal memory tracking
 * 6. Session summarization
 */

import { Graphzep } from '../../src/graphzep.js';
import { Neo4jDriver } from '../../src/drivers/neo4j.js';
import { OpenAIClient } from '../../src/llm/openai.js';
import { OpenAIEmbedder } from '../../src/embedders/openai.js';
import { ZepMemoryManager } from '../../src/zep/memory.js';
import { ZepSessionManager } from '../../src/zep/session.js';
import { ZepRetrieval } from '../../src/zep/retrieval.js';
import { MemoryType } from '../../src/zep/types.js';
import { utcNow } from '../../src/utils/datetime.js';

async function main() {
  console.log('🧠 Zep Memory System POC using Graphzep\n');

  // Initialize components
  const driver = new Neo4jDriver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'password',
    'neo4j'
  );

  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4-turbo-preview',
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  const graphzep = new Graphzep({
    driver,
    llmClient,
    embedder,
    groupId: 'zep-demo',
  });

  // Initialize Zep components
  const memoryManager = new ZepMemoryManager(graphzep, llmClient, embedder, driver);
  const sessionManager = new ZepSessionManager(driver, llmClient, memoryManager);
  const retrieval = new ZepRetrieval(embedder, driver);

  try {
    // Verify connectivity
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j database\n');

    // Create a session
    const session = await sessionManager.createSession({
      userId: 'user-123',
      metadata: {
        applicationId: 'zep-poc',
        userType: 'developer',
      },
    });
    console.log(`📝 Created session: ${session.sessionId}\n`);

    // Simulate a conversation about a software project
    const conversationMessages = [
      {
        content: "Hi! I'm working on a new e-commerce platform using React and Node.js. The project is called ShopMaster.",
        timestamp: new Date('2024-01-15T09:00:00Z'),
      },
      {
        content: "The main features include product catalog, shopping cart, user authentication, and payment processing with Stripe.",
        timestamp: new Date('2024-01-15T09:01:00Z'),
      },
      {
        content: "We're using MongoDB for the database and deploying on AWS with Docker containers.",
        timestamp: new Date('2024-01-15T09:02:00Z'),
      },
      {
        content: "The team consists of Alice as the frontend lead, Bob handling backend, and Carol managing DevOps.",
        timestamp: new Date('2024-01-15T09:03:00Z'),
      },
      {
        content: "We had a critical bug last week where payment processing was failing for international customers. Bob fixed it by updating the Stripe API integration.",
        timestamp: new Date('2024-01-15T09:05:00Z'),
      },
      {
        content: "Our next sprint goals are to implement product recommendations using machine learning and add multi-language support.",
        timestamp: new Date('2024-01-15T09:07:00Z'),
      },
    ];

    // Add memories for each message
    console.log('💭 Adding conversation memories...\n');
    const memories = [];

    for (const message of conversationMessages) {
      const memory = await memoryManager.addMemory({
        content: message.content,
        sessionId: session.sessionId,
        userId: 'user-123',
        memoryType: MemoryType.EPISODIC,
        metadata: {
          timestamp: message.timestamp.toISOString(),
          source: 'chat',
        },
      });

      await sessionManager.addMemoryToSession(session.sessionId, memory);
      memories.push(memory);

      console.log(`  ✓ Added memory: "${message.content.substring(0, 50)}..."`);
      
      if (memory.facts && memory.facts.length > 0) {
        console.log(`    📌 Extracted ${memory.facts.length} facts:`);
        for (const fact of memory.facts) {
          console.log(`       - ${fact.subject} ${fact.predicate} ${fact.object} (confidence: ${fact.confidence.toFixed(2)})`);
        }
      }
    }

    console.log('\n');

    // Test different search strategies
    console.log('🔍 Testing Search Strategies\n');

    // 1. Semantic Search
    console.log('1. Semantic Search for "team members"');
    const semanticResults = await retrieval.search({
      query: 'Who are the team members and their roles?',
      sessionId: session.sessionId,
      searchType: 'semantic',
      limit: 3,
    });

    for (const result of semanticResults) {
      console.log(`   Score: ${result.score.toFixed(3)} - "${result.memory.content.substring(0, 60)}..."`);
    }
    console.log();

    // 2. Keyword Search
    console.log('2. Keyword Search for "Stripe"');
    const keywordResults = await retrieval.search({
      query: 'Stripe',
      sessionId: session.sessionId,
      searchType: 'keyword',
      limit: 3,
    });

    for (const result of keywordResults) {
      console.log(`   Score: ${result.score.toFixed(3)} - "${result.memory.content.substring(0, 60)}..."`);
    }
    console.log();

    // 3. Hybrid Search
    console.log('3. Hybrid Search for "technical stack and architecture"');
    const hybridResults = await retrieval.search({
      query: 'What is the technical stack and architecture?',
      sessionId: session.sessionId,
      searchType: 'hybrid',
      limit: 3,
    });

    for (const result of hybridResults) {
      console.log(`   Score: ${result.score.toFixed(3)} - "${result.memory.content.substring(0, 60)}..."`);
    }
    console.log();

    // 4. MMR Search (for diversity)
    console.log('4. MMR Search for "project details" (with diversity)');
    const mmrResults = await retrieval.search({
      query: 'Tell me about the project',
      sessionId: session.sessionId,
      searchType: 'mmr',
      limit: 3,
    });

    for (const result of mmrResults) {
      console.log(`   Score: ${result.score.toFixed(3)} - "${result.memory.content.substring(0, 60)}..."`);
    }
    console.log();

    // Generate session summary
    console.log('📋 Generating Session Summary\n');
    const summary = await sessionManager.generateSessionSummary(session.sessionId);
    
    console.log('Summary:');
    console.log(summary.summary);
    console.log(`\nEntities identified: ${summary.entities.join(', ')}`);
    console.log(`Topics covered: ${summary.topics.join(', ')}`);
    console.log(`Messages summarized: ${summary.messageCount}`);
    console.log();

    // Add a procedural memory (learned pattern)
    console.log('🔧 Adding Procedural Memory\n');
    const proceduralMemory = await memoryManager.addMemory({
      content: 'When deploying React applications to AWS, always use Docker containers with multi-stage builds to optimize image size and ensure environment consistency.',
      sessionId: session.sessionId,
      userId: 'user-123',
      memoryType: MemoryType.PROCEDURAL,
      metadata: {
        category: 'deployment-best-practice',
        confidence: 0.9,
      },
    });
    console.log(`  ✓ Added procedural memory about deployment best practices`);
    console.log();

    // Add a semantic memory (general knowledge)
    console.log('💡 Adding Semantic Memory\n');
    const semanticMemory = await memoryManager.addMemory({
      content: 'ShopMaster is an e-commerce platform built with React, Node.js, MongoDB, and deployed on AWS. It features product catalog, shopping cart, authentication, and Stripe payment processing.',
      sessionId: session.sessionId,
      userId: 'user-123',
      memoryType: MemoryType.SEMANTIC,
      metadata: {
        category: 'project-overview',
        lastUpdated: utcNow().toISOString(),
      },
    });
    console.log(`  ✓ Added semantic memory with project overview`);
    console.log();

    // Test temporal queries
    console.log('⏰ Testing Temporal Queries\n');
    
    // Search for memories in a specific time range
    const timeRangeResults = await retrieval.search({
      query: 'bug fixes',
      sessionId: session.sessionId,
      searchType: 'hybrid',
      timeRange: {
        start: new Date('2024-01-15T09:04:00Z'),
        end: new Date('2024-01-15T09:06:00Z'),
      },
      limit: 2,
    });

    console.log('Memories from 09:04 to 09:06:');
    for (const result of timeRangeResults) {
      console.log(`   - "${result.memory.content.substring(0, 60)}..."`);
    }
    console.log();

    // Test memory type filtering
    console.log('🎯 Testing Memory Type Filtering\n');
    
    const semanticOnlyResults = await retrieval.search({
      query: 'project',
      sessionId: session.sessionId,
      searchType: 'semantic',
      memoryTypes: [MemoryType.SEMANTIC],
      limit: 2,
    });

    console.log('Semantic memories only:');
    for (const result of semanticOnlyResults) {
      console.log(`   Type: ${result.memory.memoryType} - "${result.memory.content.substring(0, 50)}..."`);
    }
    console.log();

    // Get all session data
    console.log('📊 Session Statistics\n');
    const sessionData = await sessionManager.getSession(session.sessionId);
    
    if (sessionData) {
      console.log(`Session ID: ${sessionData.sessionId}`);
      console.log(`User ID: ${sessionData.userId}`);
      console.log(`Total memories: ${sessionData.memoryIds.length}`);
      console.log(`Summaries generated: ${sessionData.summaries?.length || 0}`);
      console.log(`Created: ${sessionData.createdAt.toISOString()}`);
      console.log(`Last active: ${sessionData.lastActiveAt.toISOString()}`);
    }
    console.log();

    // Test memory pruning
    console.log('🗑️  Testing Memory Pruning\n');
    
    // Add some old memories to prune
    const oldMemory = await memoryManager.addMemory({
      content: 'This is an old memory that should be pruned',
      sessionId: session.sessionId,
      userId: 'user-123',
      memoryType: MemoryType.EPISODIC,
      metadata: {
        createdAt: new Date('2024-01-01T00:00:00Z').toISOString(),
      },
    });

    // Prune memories older than 14 days (from current date perspective)
    const prunedCount = await memoryManager.pruneMemories({
      sessionId: session.sessionId,
      olderThan: new Date('2024-01-14T00:00:00Z'),
    });
    
    console.log(`Pruned ${prunedCount} old memories`);
    console.log();

    console.log('✨ Zep POC completed successfully!\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await driver.close();
    console.log('👋 Closed database connection');
  }
}

// Run the example
main().catch(console.error);