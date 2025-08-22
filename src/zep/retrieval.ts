import {
  ZepMemory,
  ZepSearchParams,
  ZepSearchResult,
  RerankingStrategy,
  RerankingConfig,
} from './types.js';
import { BaseEmbedderClient } from '../embedders/client.js';
import { GraphDriver } from '../types/index.js';

export class ZepRetrieval {
  private embedder: BaseEmbedderClient;
  private driver: GraphDriver;

  constructor(embedder: BaseEmbedderClient, driver: GraphDriver) {
    this.embedder = embedder;
    this.driver = driver;
  }

  /**
   * Search for memories using hybrid search (semantic + keyword + graph)
   */
  async search(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    const searchType = params.searchType || 'hybrid';
    let results: ZepSearchResult[] = [];

    switch (searchType) {
      case 'semantic':
        results = await this.semanticSearch(params);
        break;
      case 'keyword':
        results = await this.keywordSearch(params);
        break;
      case 'hybrid':
        results = await this.hybridSearch(params);
        break;
      case 'mmr':
        results = await this.mmrSearch(params);
        break;
    }

    // Apply reranking if requested
    if (params.rerank) {
      results = await this.rerankResults(results, params.query);
    }

    // Filter by minimum relevance
    if (params.minRelevance !== undefined) {
      const minRelevance = params.minRelevance;
      results = results.filter((r) => r.score >= minRelevance);
    }

    // Apply limit
    if (params.limit) {
      results = results.slice(0, params.limit);
    }

    return results;
  }

  /**
   * Semantic search using embeddings
   */
  private async semanticSearch(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    const queryEmbedding = await this.embedder.embed(params.query);

    let query = `
      MATCH (m:ZepMemory)
      WHERE m.embedding IS NOT NULL
    `;

    const whereConditions: string[] = [];
    const queryParams: any = { embedding: queryEmbedding };

    if (params.sessionId) {
      whereConditions.push('m.sessionId = $sessionId');
      queryParams.sessionId = params.sessionId;
    }

    if (params.userId) {
      whereConditions.push('m.userId = $userId');
      queryParams.userId = params.userId;
    }

    if (params.memoryTypes && params.memoryTypes.length > 0) {
      whereConditions.push('m.memoryType IN $memoryTypes');
      queryParams.memoryTypes = params.memoryTypes;
    }

    if (params.timeRange) {
      if (params.timeRange.start) {
        whereConditions.push('m.createdAt >= datetime($startTime)');
        queryParams.startTime = params.timeRange.start.toISOString();
      }
      if (params.timeRange.end) {
        whereConditions.push('m.createdAt <= datetime($endTime)');
        queryParams.endTime = params.timeRange.end.toISOString();
      }
    }

    if (whereConditions.length > 0) {
      query += ' AND ' + whereConditions.join(' AND ');
    }

    query += `
      WITH m, 
        CASE 
          WHEN size(m.embedding) = 0 OR size($embedding) = 0 THEN 0.0
          ELSE
            reduce(dot = 0.0, i IN range(0, size(m.embedding)-1) | 
              dot + (m.embedding[i] * $embedding[i])
            ) /
            (sqrt(reduce(norm1 = 0.0, x IN m.embedding | norm1 + x * x)) * 
             sqrt(reduce(norm2 = 0.0, x IN $embedding | norm2 + x * x))
            )
        END AS similarity
      WHERE similarity > 0.1
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      RETURN m, collect(f) as facts, similarity
      ORDER BY similarity DESC
      LIMIT ${params.limit || 20}
    `;

    const results = await this.driver.executeQuery<any>(query, queryParams);

    return results.map((record: any) => ({
      memory: this.parseMemoryFromNode(record.m, record.facts),
      score: record.similarity,
      distance: 1 - record.similarity,
    }));
  }

  /**
   * Keyword search using BM25
   */
  private async keywordSearch(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    // Use simple text matching instead of fulltext index
    let query = `
      MATCH (m:ZepMemory)
      WHERE toLower(m.content) CONTAINS toLower($query)
    `;

    const whereConditions: string[] = [];
    const queryParams: any = { query: params.query };

    if (params.sessionId) {
      whereConditions.push('m.sessionId = $sessionId');
      queryParams.sessionId = params.sessionId;
    }

    if (params.userId) {
      whereConditions.push('m.userId = $userId');
      queryParams.userId = params.userId;
    }

    if (whereConditions.length > 0) {
      query += ' AND ' + whereConditions.join(' AND ');
    }

    query += `
      WITH m, 1.0 as score
      OPTIONAL MATCH (m)-[:HAS_FACT]->(f:ZepFact)
      RETURN m, collect(f) as facts, score
      ORDER BY m.createdAt DESC
      LIMIT ${params.limit || 20}
    `;

    const results = await this.driver.executeQuery<any>(query, queryParams);

    return results.map((record: any) => ({
      memory: this.parseMemoryFromNode(record.m, record.facts),
      score: record.score,
    }));
  }

  /**
   * Hybrid search combining semantic and keyword search
   */
  private async hybridSearch(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    // Get both semantic and keyword results
    const [semanticResults, keywordResults] = await Promise.all([
      this.semanticSearch(params),
      this.keywordSearch(params),
    ]);

    // Apply Reciprocal Rank Fusion (RRF)
    return this.reciprocalRankFusion(semanticResults, keywordResults);
  }

  /**
   * Maximal Marginal Relevance (MMR) search for diversity
   */
  private async mmrSearch(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    // Start with semantic search
    const candidates = await this.semanticSearch({
      ...params,
      limit: (params.limit || 10) * 3, // Get more candidates
    });

    if (candidates.length === 0) return [];

    // Apply MMR algorithm
    const lambda = 0.5; // Balance between relevance and diversity
    const selected: ZepSearchResult[] = [];
    const remaining = [...candidates];

    // Select first item (most relevant)
    selected.push(remaining.shift()!);

    // Iteratively select items that maximize MMR
    while (selected.length < (params.limit || 10) && remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Calculate relevance score
        const relevanceScore = candidate.score;

        // Calculate maximum similarity to already selected items
        let maxSimilarity = 0;
        for (const selectedItem of selected) {
          const similarity = this.calculateSimilarity(
            candidate.memory.embedding!,
            selectedItem.memory.embedding!,
          );
          maxSimilarity = Math.max(maxSimilarity, similarity);
        }

        // MMR score
        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        selected.push(remaining.splice(bestIndex, 1)[0]);
      }
    }

    return selected;
  }

  /**
   * Reciprocal Rank Fusion for combining multiple result sets
   */
  private reciprocalRankFusion(...resultSets: ZepSearchResult[][]): ZepSearchResult[] {
    const k = 60; // RRF constant
    const scoreMap = new Map<string, number>();
    const memoryMap = new Map<string, ZepSearchResult>();

    for (const results of resultSets) {
      results.forEach((result, rank) => {
        const uuid = result.memory.uuid;
        const rrfScore = 1 / (k + rank + 1);

        if (scoreMap.has(uuid)) {
          scoreMap.set(uuid, scoreMap.get(uuid)! + rrfScore);
        } else {
          scoreMap.set(uuid, rrfScore);
          memoryMap.set(uuid, result);
        }
      });
    }

    // Sort by RRF score
    const sortedResults = Array.from(scoreMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([uuid, score]) => {
        const result = memoryMap.get(uuid)!;
        return { ...result, score };
      });

    return sortedResults;
  }

  /**
   * Rerank results using cross-encoder or other strategies
   */
  private async rerankResults(
    results: ZepSearchResult[],
    query: string,
    config?: RerankingConfig,
  ): Promise<ZepSearchResult[]> {
    const strategy = config?.strategy || RerankingStrategy.RECIPROCAL_RANK_FUSION;

    switch (strategy) {
      case RerankingStrategy.RECIPROCAL_RANK_FUSION:
        // Already applied in hybrid search
        return results;

      case RerankingStrategy.MAXIMAL_MARGINAL_RELEVANCE:
        // Apply MMR post-processing
        return this.applyMMRReranking(results, config?.diversityLambda || 0.5);

      case RerankingStrategy.GRAPH_BASED:
        // Boost results with more graph connections
        return this.graphBasedReranking(results);

      case RerankingStrategy.CROSS_ENCODER:
        // Would require additional model for cross-encoding
        console.warn('Cross-encoder reranking not implemented yet');
        return results;

      default:
        return results;
    }
  }

  /**
   * Apply MMR reranking to existing results
   */
  private applyMMRReranking(results: ZepSearchResult[], lambda: number): ZepSearchResult[] {
    if (results.length <= 1) return results;

    const reranked: ZepSearchResult[] = [];
    const remaining = [...results];

    // Select first item
    reranked.push(remaining.shift()!);

    // Iteratively select diverse items
    while (remaining.length > 0) {
      let bestScore = -Infinity;
      let bestIndex = -1;

      for (let i = 0; i < remaining.length; i++) {
        const candidate = remaining[i];

        // Original relevance score
        const relevanceScore = candidate.score;

        // Maximum similarity to selected items
        let maxSimilarity = 0;
        for (const selected of reranked) {
          if (candidate.memory.embedding && selected.memory.embedding) {
            const similarity = this.calculateSimilarity(
              candidate.memory.embedding,
              selected.memory.embedding,
            );
            maxSimilarity = Math.max(maxSimilarity, similarity);
          }
        }

        // MMR score
        const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;

        if (mmrScore > bestScore) {
          bestScore = mmrScore;
          bestIndex = i;
        }
      }

      if (bestIndex >= 0) {
        reranked.push(remaining.splice(bestIndex, 1)[0]);
      }
    }

    return reranked;
  }

  /**
   * Graph-based reranking using graph connections
   */
  private async graphBasedReranking(results: ZepSearchResult[]): Promise<ZepSearchResult[]> {
    // Boost scores based on graph connectivity
    for (const result of results) {
      const connectionCount = await this.getConnectionCount(result.memory.uuid);
      // Boost score based on connections (logarithmic scale)
      result.score *= 1 + Math.log(1 + connectionCount) * 0.1;
    }

    // Re-sort by boosted scores
    return results.sort((a, b) => b.score - a.score);
  }

  /**
   * Get number of graph connections for a memory
   */
  private async getConnectionCount(memoryId: string): Promise<number> {
    const query = `
      MATCH (m:ZepMemory {uuid: $memoryId})
      OPTIONAL MATCH (m)-[r]-()
      RETURN count(r) as connections
    `;

    const result = await this.driver.executeQuery<any>(query, { memoryId });
    return result[0]?.connections || 0;
  }

  /**
   * Calculate cosine similarity between two embeddings
   */
  private calculateSimilarity(embedding1: number[], embedding2: number[]): number {
    if (embedding1.length !== embedding2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) return 0;

    return dotProduct / (norm1 * norm2);
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
      memoryType: node.properties.memoryType,
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
