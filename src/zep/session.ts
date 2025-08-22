import { v4 as uuidv4 } from 'uuid';
import { ZepSession, SessionSummary, ZepMemory, MemoryType } from './types.js';
import { GraphDriver } from '../types/index.js';
import { BaseLLMClient } from '../llm/client.js';
import { utcNow } from '../utils/datetime.js';
import { ZepMemoryManager } from './memory.js';
import { z } from 'zod';

// Schema for entity extraction
const EntityExtractionSchema = z.object({
  entities: z.array(z.string()),
  topics: z.array(z.string()),
});

export class ZepSessionManager {
  private driver: GraphDriver;
  private llmClient: BaseLLMClient;
  private memoryManager: ZepMemoryManager;

  constructor(driver: GraphDriver, llmClient: BaseLLMClient, memoryManager: ZepMemoryManager) {
    this.driver = driver;
    this.llmClient = llmClient;
    this.memoryManager = memoryManager;
  }

  /**
   * Create a new session
   */
  async createSession(params: {
    sessionId?: string;
    userId?: string;
    metadata?: Record<string, any>;
  }): Promise<ZepSession> {
    const sessionId = params.sessionId || uuidv4();
    const now = utcNow();

    const session: ZepSession = {
      sessionId,
      userId: params.userId,
      metadata: params.metadata || {},
      createdAt: now,
      lastActiveAt: now,
      memoryIds: [],
      summaries: [],
    };

    // Store session in the graph
    await this.storeSession(session);

    return session;
  }

  /**
   * Get session by ID
   */
  async getSession(sessionId: string): Promise<ZepSession | null> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})
      OPTIONAL MATCH (s)-[:HAS_MEMORY]->(m:ZepMemory)
      OPTIONAL MATCH (s)-[:HAS_SUMMARY]->(sum:SessionSummary)
      RETURN s, collect(DISTINCT m.uuid) as memoryIds, collect(DISTINCT sum) as summaries
    `;

    const result = await this.driver.executeQuery<any>(query, { sessionId });

    if (!result || result.length === 0) {
      return null;
    }

    const record = result[0];
    return this.parseSessionFromNode(record.s, record.memoryIds, record.summaries);
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})
      SET s.lastActiveAt = datetime()
    `;

    await this.driver.executeQuery(query, { sessionId });
  }

  /**
   * Add memory to session
   */
  async addMemoryToSession(sessionId: string, memory: ZepMemory): Promise<void> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})
      MATCH (m:ZepMemory {uuid: $memoryId})
      CREATE (s)-[:HAS_MEMORY]->(m)
      SET s.lastActiveAt = datetime()
    `;

    await this.driver.executeQuery(query, {
      sessionId,
      memoryId: memory.uuid,
    });

    // Update session activity
    await this.updateSessionActivity(sessionId);
  }

  /**
   * Generate and store session summary
   */
  async generateSessionSummary(
    sessionId: string,
    params?: {
      startTime?: Date;
      endTime?: Date;
      maxMessages?: number;
    },
  ): Promise<SessionSummary> {
    // Get session memories
    const memories = await this.getSessionMemoriesInRange(
      sessionId,
      params?.startTime,
      params?.endTime,
      params?.maxMessages,
    );

    if (memories.length === 0) {
      throw new Error('No memories found for session');
    }

    // Generate summary using LLM
    const summaryText = await this.generateSummaryFromMemories(memories);

    // Extract entities and topics
    const extraction = await this.extractEntitiesAndTopics(summaryText);

    const summary: SessionSummary = {
      uuid: uuidv4(),
      sessionId,
      summary: summaryText,
      startTime: memories[0].createdAt,
      endTime: memories[memories.length - 1].createdAt,
      messageCount: memories.length,
      entities: extraction.entities,
      topics: extraction.topics,
      createdAt: utcNow(),
    };

    // Store summary
    await this.storeSummary(sessionId, summary);

    return summary;
  }

  /**
   * Get session memories in a time range
   */
  private async getSessionMemoriesInRange(
    sessionId: string,
    startTime?: Date,
    endTime?: Date,
    limit?: number,
  ): Promise<ZepMemory[]> {
    let query = `
      MATCH (s:ZepSession {sessionId: $sessionId})-[:HAS_MEMORY]->(m:ZepMemory)
    `;

    const whereConditions: string[] = [];
    const queryParams: any = { sessionId };

    if (startTime) {
      whereConditions.push('m.createdAt >= datetime($startTime)');
      queryParams.startTime = startTime.toISOString();
    }

    if (endTime) {
      whereConditions.push('m.createdAt <= datetime($endTime)');
      queryParams.endTime = endTime.toISOString();
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    query += `
      WITH m ORDER BY m.createdAt ASC
      ${limit ? `LIMIT ${limit}` : ''}
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      RETURN m, collect(f) as facts
    `;

    const results = await this.driver.executeQuery<any>(query, queryParams);

    return results.map((record: any) => this.parseMemoryFromNode(record.m, record.facts));
  }

  /**
   * Generate summary from memories
   */
  private async generateSummaryFromMemories(memories: ZepMemory[]): Promise<string> {
    const memoryContents = memories.map((m) => m.content).join('\n\n');

    const prompt = `
Generate a concise summary of the following conversation or interaction:

${memoryContents}

The summary should:
1. Capture the main topics discussed
2. Highlight key decisions or conclusions
3. Note any important facts or information shared
4. Maintain temporal order of events
5. Be clear and coherent for future reference

Provide a summary in 2-3 paragraphs.
`;

    const response = await this.llmClient.generateResponse(prompt);
    return typeof response === 'string' ? response : response.content || '';
  }

  /**
   * Extract entities and topics from text
   */
  private async extractEntitiesAndTopics(
    text: string,
  ): Promise<{ entities: string[]; topics: string[] }> {
    const prompt = `
Extract entities and topics from the following text:

${text}

Entities are specific people, places, organizations, products, or other named items.
Topics are general subjects or themes discussed.

Return the results in the following JSON format:
- entities: list of unique entity names
- topics: list of main topics discussed

Keep each item concise (1-3 words).
Return as valid JSON.
`;

    try {
      const response = await this.llmClient.generateStructuredResponse<
        z.infer<typeof EntityExtractionSchema>
      >(prompt, EntityExtractionSchema);

      return response;
    } catch (error) {
      console.error('Failed to extract entities and topics:', error);
      return { entities: [], topics: [] };
    }
  }

  /**
   * Store session in the graph
   */
  private async storeSession(session: ZepSession): Promise<void> {
    const query = `
      CREATE (s:ZepSession {
        sessionId: $sessionId,
        userId: $userId,
        metadata: $metadata,
        createdAt: datetime($createdAt),
        lastActiveAt: datetime($lastActiveAt)
      })
      RETURN s
    `;

    const params = {
      sessionId: session.sessionId,
      userId: session.userId || null,
      metadata: JSON.stringify(session.metadata || {}),
      createdAt: session.createdAt.toISOString(),
      lastActiveAt: session.lastActiveAt.toISOString(),
    };

    await this.driver.executeQuery(query, params);
  }

  /**
   * Store session summary
   */
  private async storeSummary(sessionId: string, summary: SessionSummary): Promise<void> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})
      CREATE (sum:SessionSummary {
        uuid: $uuid,
        sessionId: $sessionId,
        summary: $summary,
        startTime: datetime($startTime),
        endTime: datetime($endTime),
        messageCount: $messageCount,
        entities: $entities,
        topics: $topics,
        createdAt: datetime($createdAt)
      })
      CREATE (s)-[:HAS_SUMMARY]->(sum)
      RETURN sum
    `;

    const params = {
      sessionId,
      uuid: summary.uuid,
      summary: summary.summary,
      startTime: summary.startTime.toISOString(),
      endTime: summary.endTime.toISOString(),
      messageCount: summary.messageCount,
      entities: summary.entities,
      topics: summary.topics,
      createdAt: summary.createdAt.toISOString(),
    };

    await this.driver.executeQuery(query, params);
  }

  /**
   * Get all session summaries
   */
  async getSessionSummaries(sessionId: string): Promise<SessionSummary[]> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})-[:HAS_SUMMARY]->(sum:SessionSummary)
      RETURN sum
      ORDER BY sum.createdAt DESC
    `;

    const results = await this.driver.executeQuery<any>(query, { sessionId });

    return results.map((record: any) => this.parseSummaryFromNode(record.sum));
  }

  /**
   * Delete a session and all associated data
   */
  async deleteSession(sessionId: string): Promise<void> {
    const query = `
      MATCH (s:ZepSession {sessionId: $sessionId})
      OPTIONAL MATCH (s)-[:HAS_MEMORY]->(m:ZepMemory)
      OPTIONAL MATCH (s)-[:HAS_SUMMARY]->(sum:SessionSummary)
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      DETACH DELETE s, m, sum, f
    `;

    await this.driver.executeQuery(query, { sessionId });
  }

  /**
   * Get all sessions for a user
   */
  async getUserSessions(userId: string): Promise<ZepSession[]> {
    const query = `
      MATCH (s:ZepSession {userId: $userId})
      OPTIONAL MATCH (s)-[:HAS_MEMORY]->(m:ZepMemory)
      OPTIONAL MATCH (s)-[:HAS_SUMMARY]->(sum:SessionSummary)
      RETURN s, collect(DISTINCT m.uuid) as memoryIds, collect(DISTINCT sum) as summaries
      ORDER BY s.lastActiveAt DESC
    `;

    const results = await this.driver.executeQuery<any>(query, { userId });

    return results.map((record: any) =>
      this.parseSessionFromNode(record.s, record.memoryIds, record.summaries),
    );
  }

  /**
   * Parse session from database node
   */
  private parseSessionFromNode(node: any, memoryIds: string[], summaries: any[]): ZepSession {
    return {
      sessionId: node.properties.sessionId,
      userId: node.properties.userId,
      metadata: JSON.parse(node.properties.metadata || '{}'),
      createdAt: new Date(node.properties.createdAt),
      lastActiveAt: new Date(node.properties.lastActiveAt),
      memoryIds: memoryIds || [],
      summaries: summaries?.map((s) => this.parseSummaryFromNode(s)) || [],
    };
  }

  /**
   * Parse summary from database node
   */
  private parseSummaryFromNode(node: any): SessionSummary {
    return {
      uuid: node.properties.uuid,
      sessionId: node.properties.sessionId,
      summary: node.properties.summary,
      startTime: new Date(node.properties.startTime),
      endTime: new Date(node.properties.endTime),
      messageCount: node.properties.messageCount,
      entities: node.properties.entities || [],
      topics: node.properties.topics || [],
      createdAt: new Date(node.properties.createdAt),
    };
  }

  /**
   * Parse memory from database node
   */
  private parseMemoryFromNode(node: any, facts: any[]): ZepMemory {
    return {
      uuid: node.properties.uuid,
      sessionId: node.properties.sessionId,
      userId: node.properties.userId,
      content: node.properties.content,
      memoryType: node.properties.memoryType as MemoryType,
      embedding: node.properties.embedding,
      metadata: JSON.parse(node.properties.metadata || '{}'),
      createdAt: new Date(node.properties.createdAt),
      lastAccessedAt: node.properties.lastAccessedAt
        ? new Date(node.properties.lastAccessedAt)
        : undefined,
      accessCount: node.properties.accessCount,
      relevanceScore: node.properties.relevanceScore,
      summary: node.properties.summary,
      validFrom: new Date(node.properties.validFrom),
      validUntil: node.properties.validUntil ? new Date(node.properties.validUntil) : undefined,
      facts:
        facts?.map((f) => ({
          uuid: f.properties.uuid,
          subject: f.properties.subject,
          predicate: f.properties.predicate,
          object: f.properties.object,
          confidence: f.properties.confidence,
          sourceMemoryIds: [node.properties.uuid],
          validFrom: new Date(f.properties.validFrom),
          validUntil: f.properties.validUntil ? new Date(f.properties.validUntil) : undefined,
          metadata: JSON.parse(f.properties.metadata || '{}'),
        })) || [],
    };
  }
}
