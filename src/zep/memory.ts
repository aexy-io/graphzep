import { v4 as uuidv4 } from 'uuid';
import { Graphzep } from '../graphzep.js';
import { ZepMemory, ZepFact, MemoryType } from './types.js';
import { BaseLLMClient } from '../llm/client.js';
import { BaseEmbedderClient } from '../embedders/client.js';
import { GraphDriver } from '../types/index.js';
import { utcNow } from '../utils/datetime.js';
import { z } from 'zod';

// Schema for fact extraction
const FactExtractionSchema = z.object({
  facts: z.array(
    z.object({
      subject: z.string(),
      predicate: z.string(),
      object: z.string(),
      confidence: z.number().min(0).max(1),
    }),
  ),
});

export class ZepMemoryManager {
  private graphzep: Graphzep;
  private llmClient: BaseLLMClient;
  private embedder: BaseEmbedderClient;
  private driver: GraphDriver;

  constructor(
    graphzep: Graphzep,
    llmClient: BaseLLMClient,
    embedder: BaseEmbedderClient,
    driver: GraphDriver,
  ) {
    this.graphzep = graphzep;
    this.llmClient = llmClient;
    this.embedder = embedder;
    this.driver = driver;
  }

  /**
   * Add a new memory to the Zep system
   */
  async addMemory(params: {
    content: string;
    sessionId: string;
    userId?: string;
    memoryType?: MemoryType;
    metadata?: Record<string, any>;
  }): Promise<ZepMemory> {
    const now = utcNow();
    const memoryType = params.memoryType || MemoryType.EPISODIC;

    // Generate embedding for the content
    const embedding = await this.embedder.embed(params.content);

    // Create the memory object
    const memory: ZepMemory = {
      uuid: uuidv4(),
      sessionId: params.sessionId,
      userId: params.userId,
      content: params.content,
      memoryType,
      embedding,
      metadata: params.metadata || {},
      createdAt: now,
      accessCount: 0,
      validFrom: now,
      facts: [],
    };

    // Extract facts from the content
    if (memoryType === MemoryType.EPISODIC || memoryType === MemoryType.SEMANTIC) {
      memory.facts = await this.extractFacts(memory);
    }

    // Store as an episodic node in Graphzep
    await this.graphzep.addEpisode({
      content: params.content,
      groupId: params.sessionId,
      referenceId: memory.uuid,
      metadata: {
        ...params.metadata,
        memoryType,
        userId: params.userId,
        zepMemory: true,
      },
    });

    // Store the full Zep memory in the graph
    await this.storeZepMemory(memory);

    return memory;
  }

  /**
   * Extract facts from memory content using LLM
   */
  private async extractFacts(memory: ZepMemory): Promise<ZepFact[]> {
    const prompt = `
Extract factual statements from the following text. Each fact should be represented as a triple (subject, predicate, object).
Provide a confidence score (0-1) for each fact based on how certain it appears in the text.

Text: "${memory.content}"

Return facts in the following JSON format:
- Subject: the entity performing the action or being described
- Predicate: the relationship or action
- Object: the entity being acted upon or related to
- Confidence: how certain this fact is (0-1)

Only extract clear, unambiguous facts. Skip opinions or uncertain statements.
Return the results as valid JSON with this exact structure:
{
  "facts": [
    {
      "subject": "string",
      "predicate": "string", 
      "object": "string",
      "confidence": 0.95
    }
  ]
}
`;

    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Fact extraction timeout')), 30000);
      });

      const responsePromise = this.llmClient.generateStructuredResponse<
        z.infer<typeof FactExtractionSchema>
      >(prompt, FactExtractionSchema);

      const response = (await Promise.race([responsePromise, timeoutPromise])) as z.infer<
        typeof FactExtractionSchema
      >;

      return response.facts.map((fact) => ({
        uuid: uuidv4(),
        subject: fact.subject,
        predicate: fact.predicate,
        object: fact.object,
        confidence: fact.confidence,
        sourceMemoryIds: [memory.uuid],
        validFrom: memory.validFrom,
        metadata: {
          extractedFrom: memory.uuid,
          sessionId: memory.sessionId,
        },
      }));
    } catch (error) {
      console.error('Failed to extract facts:', error);
      return [];
    }
  }

  /**
   * Store Zep memory in the graph database
   */
  private async storeZepMemory(memory: ZepMemory): Promise<void> {
    const facts = memory.facts || [];

    // Create memory node first
    const memoryQuery = `
      CREATE (m:ZepMemory {
        uuid: $uuid,
        sessionId: $sessionId,
        userId: $userId,
        content: $content,
        memoryType: $memoryType,
        embedding: $embedding,
        metadata: $metadata,
        createdAt: datetime($createdAt),
        accessCount: $accessCount,
        validFrom: datetime($validFrom)
      })
      RETURN m
    `;

    const memoryParams = {
      uuid: memory.uuid,
      sessionId: memory.sessionId,
      userId: memory.userId || null,
      content: memory.content,
      memoryType: memory.memoryType,
      embedding: memory.embedding || null,
      metadata: JSON.stringify(memory.metadata || {}),
      createdAt: memory.createdAt.toISOString(),
      accessCount: memory.accessCount,
      validFrom: memory.validFrom.toISOString(),
    };

    await this.driver.executeQuery(memoryQuery, memoryParams);

    // Create facts separately if any exist
    if (facts.length > 0) {
      const factQuery = `
        MATCH (m:ZepMemory {uuid: $memoryUuid})
        UNWIND $facts AS fact
        CREATE (f:ZepFact {
          uuid: fact.uuid,
          subject: fact.subject,
          predicate: fact.predicate,
          object: fact.object,
          confidence: fact.confidence,
          validFrom: datetime(fact.validFrom),
          metadata: fact.metadata
        })
        CREATE (m)-[:HAS_FACT]->(f)
        RETURN count(f) as factCount
      `;

      const factParams = {
        memoryUuid: memory.uuid,
        facts: facts.map((fact) => ({
          ...fact,
          validFrom: fact.validFrom.toISOString(),
          validUntil: fact.validUntil?.toISOString() || null,
          metadata: JSON.stringify(fact.metadata || {}),
        })),
      };

      await this.driver.executeQuery(factQuery, factParams);
    }
  }

  /**
   * Get memory by ID and update access count
   */
  async getMemory(memoryId: string): Promise<ZepMemory | null> {
    const query = `
      MATCH (m:ZepMemory {uuid: $memoryId})
      SET m.lastAccessedAt = datetime(),
          m.accessCount = m.accessCount + 1
      WITH m
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      RETURN m, collect(f) as facts
    `;

    const result = await this.driver.executeQuery<any>(query, { memoryId });

    if (!result || result.length === 0) {
      return null;
    }

    const record = result[0];
    const memoryNode = record.m;
    const facts = record.facts;

    return this.parseMemoryFromNode(memoryNode, facts);
  }

  /**
   * Get all memories for a session
   */
  async getSessionMemories(sessionId: string, limit?: number): Promise<ZepMemory[]> {
    const query = `
      MATCH (m:ZepMemory {sessionId: $sessionId})
      WITH m ORDER BY m.createdAt DESC
      ${limit ? `LIMIT ${limit}` : ''}
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      RETURN m, collect(f) as facts
    `;

    const results = await this.driver.executeQuery<any>(query, { sessionId });

    return results.map((record: any) => this.parseMemoryFromNode(record.m, record.facts));
  }

  /**
   * Update memory relevance score
   */
  async updateRelevanceScore(memoryId: string, score: number): Promise<void> {
    const query = `
      MATCH (m:ZepMemory {uuid: $memoryId})
      SET m.relevanceScore = $score
    `;

    await this.driver.executeQuery(query, { memoryId, score });
  }

  /**
   * Generate summary for a set of memories
   */
  async generateSummary(memoryIds: string[]): Promise<string> {
    // Fetch memories
    const memories = await Promise.all(memoryIds.map((id) => this.getMemory(id)));

    const validMemories = memories.filter((m) => m !== null) as ZepMemory[];

    if (validMemories.length === 0) {
      return '';
    }

    const prompt = `
Summarize the following conversation memories into a concise summary that captures the key points, facts, and context:

${validMemories.map((m) => `- ${m.content}`).join('\n')}

Provide a clear, coherent summary that maintains temporal order and highlights important information.
`;

    const response = await this.llmClient.generateResponse(prompt);
    return typeof response === 'string' ? response : response.content || '';
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
      facts: facts.map((f) => ({
        uuid: f.properties.uuid,
        subject: f.properties.subject,
        predicate: f.properties.predicate,
        object: f.properties.object,
        confidence: f.properties.confidence,
        sourceMemoryIds: [node.properties.uuid],
        validFrom: new Date(f.properties.validFrom),
        validUntil: f.properties.validUntil ? new Date(f.properties.validUntil) : undefined,
        metadata: JSON.parse(f.properties.metadata || '{}'),
      })),
    };
  }

  /**
   * Delete old memories based on retention policy
   */
  async pruneMemories(params: {
    sessionId?: string;
    olderThan?: Date;
    keepRecent?: number;
  }): Promise<number> {
    let query = 'MATCH (m:ZepMemory)';
    const whereConditions: string[] = [];
    const queryParams: any = {};

    if (params.sessionId) {
      whereConditions.push('m.sessionId = $sessionId');
      queryParams.sessionId = params.sessionId;
    }

    if (params.olderThan) {
      whereConditions.push('m.createdAt < datetime($olderThan)');
      queryParams.olderThan = params.olderThan.toISOString();
    }

    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }

    if (params.keepRecent) {
      query += ` WITH m ORDER BY m.createdAt DESC SKIP ${params.keepRecent}`;
    }

    query += ' DETACH DELETE m RETURN count(m) as deleted';

    const result = await this.driver.executeQuery<any>(query, queryParams);
    const deleted = result[0]?.deleted;
    return typeof deleted === 'object' && deleted !== null && 'toNumber' in deleted
      ? deleted.toNumber()
      : Number(deleted) || 0;
  }
}
