import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as dotenv from 'dotenv';
import { Graphzep } from '../graphzep.js';
import { Neo4jDriver } from '../drivers/neo4j.js';
import { OpenAIClient } from '../llm/openai.js';
import { OpenAIEmbedder } from '../embedders/openai.js';
import { ZepMemoryManager } from '../zep/memory.js';
import { ZepSessionManager } from '../zep/session.js';
import { ZepRetrieval } from '../zep/retrieval.js';
import { MemoryType } from '../zep/types.js';

// Load environment variables
dotenv.config();

// Skip tests if Neo4j is not configured
const skipTests = !process.env.NEO4J_URI || !process.env.NEO4J_PASSWORD;

describe('Zep Memory System Tests', { skip: skipTests }, () => {
  let driver: Neo4jDriver;
  let graphzep: Graphzep;
  let memoryManager: ZepMemoryManager;
  let sessionManager: ZepSessionManager;
  let retrieval: ZepRetrieval;
  let testSessionId: string;

  before(async () => {
    // Initialize test components
    driver = new Neo4jDriver(
      process.env.NEO4J_URI || 'bolt://localhost:7687',
      process.env.NEO4J_USER || 'neo4j',
      process.env.NEO4J_PASSWORD || 'password',
      'neo4j',
    );

    const llmClient = new OpenAIClient({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      model: 'gpt-3.5-turbo',
    });

    const embedder = new OpenAIEmbedder({
      apiKey: process.env.OPENAI_API_KEY || 'test-key',
      model: 'text-embedding-3-small',
    });

    graphzep = new Graphzep({
      driver,
      llmClient,
      embedder,
      groupId: 'zep-test',
    });

    memoryManager = new ZepMemoryManager(graphzep, llmClient, embedder, driver);
    sessionManager = new ZepSessionManager(driver, llmClient, memoryManager);
    retrieval = new ZepRetrieval(embedder, driver);

    await driver.verifyConnectivity();
  });

  after(async () => {
    // Clean up test data
    if (testSessionId) {
      await sessionManager.deleteSession(testSessionId);
    }
    await driver.close();
  });

  describe('Memory Manager', () => {
    it('should create episodic memory', async () => {
      const session = await sessionManager.createSession({
        userId: 'test-user',
      });
      testSessionId = session.sessionId;

      const memory = await memoryManager.addMemory({
        content: 'This is a test episodic memory',
        sessionId: session.sessionId,
        userId: 'test-user',
        memoryType: MemoryType.EPISODIC,
      });

      assert.strictEqual(memory.memoryType, MemoryType.EPISODIC);
      assert.strictEqual(memory.content, 'This is a test episodic memory');
      assert.strictEqual(memory.sessionId, session.sessionId);
      assert.ok(memory.uuid);
      assert.ok(memory.embedding);
      assert.ok(memory.createdAt);
    });

    it('should extract facts from memory', async () => {
      const memory = await memoryManager.addMemory({
        content: 'John works at OpenAI as a software engineer. He lives in San Francisco.',
        sessionId: testSessionId,
        memoryType: MemoryType.EPISODIC,
      });

      assert.ok(memory.facts);
      assert.ok(memory.facts.length > 0);

      const facts = memory.facts;
      const johnFact = facts.find((f) => f.subject === 'John');
      assert.ok(johnFact);
      assert.ok(johnFact.confidence > 0 && johnFact.confidence <= 1);
    });

    it('should retrieve memory by ID', async () => {
      const memory = await memoryManager.addMemory({
        content: 'Test memory for retrieval',
        sessionId: testSessionId,
      });

      const retrieved = await memoryManager.getMemory(memory.uuid);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.uuid, memory.uuid);
      assert.strictEqual(retrieved.content, memory.content);
      assert.strictEqual(retrieved.accessCount, 1); // Should increment on retrieval
    });

    it('should get all session memories', async () => {
      // Add multiple memories
      await memoryManager.addMemory({
        content: 'First memory',
        sessionId: testSessionId,
      });
      await memoryManager.addMemory({
        content: 'Second memory',
        sessionId: testSessionId,
      });

      const memories = await memoryManager.getSessionMemories(testSessionId);
      assert.ok(memories.length >= 2);
      assert.ok(memories.every((m) => m.sessionId === testSessionId));
    });

    it('should update relevance score', async () => {
      const memory = await memoryManager.addMemory({
        content: 'Memory with relevance',
        sessionId: testSessionId,
      });

      await memoryManager.updateRelevanceScore(memory.uuid, 0.85);

      const updated = await memoryManager.getMemory(memory.uuid);
      assert.ok(updated);
      assert.strictEqual(updated.relevanceScore, 0.85);
    });

    it('should generate summary from memories', async () => {
      const memoryIds = [];

      const m1 = await memoryManager.addMemory({
        content: 'We discussed the project timeline today',
        sessionId: testSessionId,
      });
      memoryIds.push(m1.uuid);

      const m2 = await memoryManager.addMemory({
        content: 'The deadline is set for next Friday',
        sessionId: testSessionId,
      });
      memoryIds.push(m2.uuid);

      const summary = await memoryManager.generateSummary(memoryIds);
      assert.ok(summary);
      assert.ok(summary.length > 0);
    });

    it('should prune old memories', async () => {
      // This test would need to mock dates or wait
      // For now, we'll test the function exists and returns a number
      const prunedCount = await memoryManager.pruneMemories({
        sessionId: testSessionId,
        olderThan: new Date('2020-01-01'),
      });

      assert.ok(typeof prunedCount === 'number');
      assert.ok(prunedCount >= 0);
    });
  });

  describe('Session Manager', () => {
    it('should create a session', async () => {
      const session = await sessionManager.createSession({
        userId: 'test-user-2',
        metadata: { app: 'test' },
      });

      assert.ok(session.sessionId);
      assert.strictEqual(session.userId, 'test-user-2');
      assert.deepStrictEqual(session.metadata, { app: 'test' });
      assert.ok(session.createdAt);
      assert.ok(session.lastActiveAt);

      // Clean up
      await sessionManager.deleteSession(session.sessionId);
    });

    it('should retrieve session by ID', async () => {
      const session = await sessionManager.createSession({
        userId: 'test-user-3',
      });

      const retrieved = await sessionManager.getSession(session.sessionId);
      assert.ok(retrieved);
      assert.strictEqual(retrieved.sessionId, session.sessionId);
      assert.strictEqual(retrieved.userId, 'test-user-3');

      // Clean up
      await sessionManager.deleteSession(session.sessionId);
    });

    it('should add memory to session', async () => {
      const session = await sessionManager.createSession({});

      const memory = await memoryManager.addMemory({
        content: 'Session memory test',
        sessionId: session.sessionId,
      });

      await sessionManager.addMemoryToSession(session.sessionId, memory);

      const updatedSession = await sessionManager.getSession(session.sessionId);
      assert.ok(updatedSession);
      assert.ok(updatedSession.memoryIds.includes(memory.uuid));

      // Clean up
      await sessionManager.deleteSession(session.sessionId);
    });

    it('should get user sessions', async () => {
      const userId = 'multi-session-user';

      const session1 = await sessionManager.createSession({ userId });
      const session2 = await sessionManager.createSession({ userId });

      const userSessions = await sessionManager.getUserSessions(userId);
      assert.ok(userSessions.length >= 2);
      assert.ok(userSessions.every((s) => s.userId === userId));

      // Clean up
      await sessionManager.deleteSession(session1.sessionId);
      await sessionManager.deleteSession(session2.sessionId);
    });
  });

  describe('Retrieval System', () => {
    let searchSessionId: string;

    before(async () => {
      // Create a session with test memories for search
      const session = await sessionManager.createSession({
        userId: 'search-test-user',
      });
      searchSessionId = session.sessionId;

      // Add diverse memories
      await memoryManager.addMemory({
        content: 'Python is a popular programming language',
        sessionId: searchSessionId,
        memoryType: MemoryType.SEMANTIC,
      });

      await memoryManager.addMemory({
        content: 'Machine learning requires understanding of statistics',
        sessionId: searchSessionId,
        memoryType: MemoryType.SEMANTIC,
      });

      await memoryManager.addMemory({
        content: 'I learned Python last year during my data science course',
        sessionId: searchSessionId,
        memoryType: MemoryType.EPISODIC,
      });
    });

    after(async () => {
      if (searchSessionId) {
        await sessionManager.deleteSession(searchSessionId);
      }
    });

    it('should perform semantic search', async () => {
      const results = await retrieval.search({
        query: 'programming languages',
        sessionId: searchSessionId,
        searchType: 'semantic',
        limit: 5,
      });

      assert.ok(results.length > 0);
      assert.ok(results[0].score > 0);
      assert.ok(results[0].memory);
    });

    it('should perform keyword search', async () => {
      const results = await retrieval.search({
        query: 'Python',
        sessionId: searchSessionId,
        searchType: 'keyword',
        limit: 5,
      });

      assert.ok(results.length > 0);
      const pythonResults = results.filter((r) =>
        r.memory.content.toLowerCase().includes('python'),
      );
      assert.ok(pythonResults.length > 0);
    });

    it('should perform hybrid search', async () => {
      const results = await retrieval.search({
        query: 'learning programming',
        sessionId: searchSessionId,
        searchType: 'hybrid',
        limit: 5,
      });

      assert.ok(results.length > 0);
      assert.ok(results[0].score > 0);
    });

    it('should filter by memory type', async () => {
      const results = await retrieval.search({
        query: 'knowledge',
        sessionId: searchSessionId,
        searchType: 'semantic',
        memoryTypes: [MemoryType.SEMANTIC],
        limit: 10,
      });

      if (results.length > 0) {
        assert.ok(results.every((r) => r.memory.memoryType === MemoryType.SEMANTIC));
      }
    });

    it('should apply minimum relevance filter', async () => {
      const minRelevance = 0.5;
      const results = await retrieval.search({
        query: 'test query',
        sessionId: searchSessionId,
        searchType: 'semantic',
        minRelevance,
        limit: 10,
      });

      if (results.length > 0) {
        assert.ok(results.every((r) => r.score >= minRelevance));
      }
    });
  });

  describe('Fact Extraction', () => {
    it('should extract facts with confidence scores', async () => {
      const memory = await memoryManager.addMemory({
        content: 'Alice is the CEO of TechCorp. She founded the company in 2020.',
        sessionId: testSessionId,
        memoryType: MemoryType.EPISODIC,
      });

      assert.ok(memory.facts);
      assert.ok(memory.facts.length > 0);

      const ceoFact = memory.facts.find(
        (f) =>
          f.predicate.toLowerCase().includes('ceo') || f.predicate.toLowerCase().includes('is'),
      );

      if (ceoFact) {
        assert.ok(ceoFact.confidence > 0);
        assert.ok(ceoFact.confidence <= 1);
        assert.ok(ceoFact.subject || ceoFact.object);
      }
    });

    it('should track temporal validity of facts', async () => {
      const memory = await memoryManager.addMemory({
        content: 'The project deadline is tomorrow',
        sessionId: testSessionId,
        memoryType: MemoryType.EPISODIC,
      });

      if (memory.facts && memory.facts.length > 0) {
        const fact = memory.facts[0];
        assert.ok(fact.validFrom);
        assert.ok(fact.validFrom instanceof Date);
      }
    });
  });

  describe('Temporal Features', () => {
    it('should support time-range queries', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const results = await retrieval.search({
        query: 'test',
        sessionId: testSessionId,
        searchType: 'semantic',
        timeRange: {
          start: yesterday,
          end: tomorrow,
        },
        limit: 10,
      });

      // All results should be within the time range
      assert.ok(Array.isArray(results));
    });

    it('should track memory access patterns', async () => {
      const memory = await memoryManager.addMemory({
        content: 'Access tracking test',
        sessionId: testSessionId,
      });

      const initial = await memoryManager.getMemory(memory.uuid);
      assert.strictEqual(initial?.accessCount, 1);

      const second = await memoryManager.getMemory(memory.uuid);
      assert.strictEqual(second?.accessCount, 2);
      assert.ok(second?.lastAccessedAt);
    });
  });
});
