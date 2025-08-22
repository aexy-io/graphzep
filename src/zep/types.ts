import { z } from 'zod';

// Zep-specific types based on the paper
export enum MemoryType {
  EPISODIC = 'episodic',
  SEMANTIC = 'semantic',
  PROCEDURAL = 'procedural',
  SUMMARY = 'summary',
}

export enum RelevanceScore {
  HIGH = 1.0,
  MEDIUM = 0.7,
  LOW = 0.4,
}

// Zep Memory Node - extends standard node with memory-specific features
export interface ZepMemory {
  uuid: string;
  sessionId: string;
  userId?: string;
  content: string;
  memoryType: MemoryType;
  embedding?: number[];
  metadata?: Record<string, any>;
  createdAt: Date;
  lastAccessedAt?: Date;
  accessCount: number;
  relevanceScore?: number;
  summary?: string;
  // Temporal aspects
  validFrom: Date;
  validUntil?: Date;
  // Facts extracted from this memory
  facts?: ZepFact[];
}

// Fact representation based on Zep's temporal knowledge model
export interface ZepFact {
  uuid: string;
  subject: string;
  predicate: string;
  object: string;
  confidence: number;
  sourceMemoryIds: string[];
  validFrom: Date;
  validUntil?: Date;
  metadata?: Record<string, any>;
}

// Session management for conversation context
export interface ZepSession {
  sessionId: string;
  userId?: string;
  metadata?: Record<string, any>;
  createdAt: Date;
  lastActiveAt: Date;
  memoryIds: string[];
  summaries?: SessionSummary[];
}

export interface SessionSummary {
  uuid: string;
  sessionId: string;
  summary: string;
  startTime: Date;
  endTime: Date;
  messageCount: number;
  entities: string[];
  topics: string[];
  createdAt: Date;
}

// Search and retrieval parameters
export interface ZepSearchParams {
  query: string;
  sessionId?: string;
  userId?: string;
  limit?: number;
  searchType?: 'semantic' | 'keyword' | 'hybrid' | 'mmr';
  memoryTypes?: MemoryType[];
  minRelevance?: number;
  timeRange?: {
    start?: Date;
    end?: Date;
  };
  includeMetadata?: boolean;
  rerank?: boolean;
}

export interface ZepSearchResult {
  memory: ZepMemory;
  score: number;
  distance?: number;
  highlights?: string[];
  context?: ZepMemory[];
}

// Reranking strategies
export enum RerankingStrategy {
  RECIPROCAL_RANK_FUSION = 'rrf',
  MAXIMAL_MARGINAL_RELEVANCE = 'mmr',
  CROSS_ENCODER = 'cross_encoder',
  GRAPH_BASED = 'graph_based',
}

export interface RerankingConfig {
  strategy: RerankingStrategy;
  topK?: number;
  diversityLambda?: number; // For MMR
  fusionK?: number; // For RRF
  modelName?: string; // For cross-encoder
}

// Schemas for validation
export const ZepMemorySchema = z.object({
  uuid: z.string(),
  sessionId: z.string(),
  userId: z.string().optional(),
  content: z.string(),
  memoryType: z.nativeEnum(MemoryType),
  embedding: z.array(z.number()).optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  lastAccessedAt: z.date().optional(),
  accessCount: z.number(),
  relevanceScore: z.number().optional(),
  summary: z.string().optional(),
  validFrom: z.date(),
  validUntil: z.date().optional(),
});

export const ZepFactSchema = z.object({
  uuid: z.string(),
  subject: z.string(),
  predicate: z.string(),
  object: z.string(),
  confidence: z.number().min(0).max(1),
  sourceMemoryIds: z.array(z.string()),
  validFrom: z.date(),
  validUntil: z.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const ZepSessionSchema = z.object({
  sessionId: z.string(),
  userId: z.string().optional(),
  metadata: z.record(z.any()).optional(),
  createdAt: z.date(),
  lastActiveAt: z.date(),
  memoryIds: z.array(z.string()),
});

export const ZepSearchParamsSchema = z.object({
  query: z.string(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  limit: z.number().positive().optional(),
  searchType: z.enum(['semantic', 'keyword', 'hybrid', 'mmr']).optional(),
  memoryTypes: z.array(z.nativeEnum(MemoryType)).optional(),
  minRelevance: z.number().min(0).max(1).optional(),
  timeRange: z
    .object({
      start: z.date().optional(),
      end: z.date().optional(),
    })
    .optional(),
  includeMetadata: z.boolean().optional(),
  rerank: z.boolean().optional(),
});
