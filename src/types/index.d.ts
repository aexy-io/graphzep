export interface GraphzepClients {
  driver: GraphDriver;
  llmClient: LLMClient;
  embedder: EmbedderClient;
  crossEncoder: CrossEncoderClient;
  ensureAscii?: boolean;
}
export interface GraphDriver {
  provider: GraphProvider;
  executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  close(): Promise<void>;
  createIndexes(): Promise<void>;
}
export declare enum GraphProvider {
  NEO4J = 'neo4j',
  FALKORDB = 'falkordb',
  NEPTUNE = 'neptune',
}
export interface LLMClient {
  generateResponse<T = any>(prompt: string, schema?: any): Promise<T>;
  generateStructuredResponse<T = any>(prompt: string, schema: any): Promise<T>;
}
export interface EmbedderClient {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
export interface CrossEncoderClient {
  rerank(query: string, documents: string[]): Promise<number[]>;
}
export declare enum EpisodeType {
  MESSAGE = 'message',
  JSON = 'json',
  TEXT = 'text',
}
export interface BaseNode {
  uuid: string;
  name: string;
  groupId: string;
  labels: string[];
  createdAt: Date;
}
export interface BaseEdge {
  uuid: string;
  groupId: string;
  sourceNodeUuid: string;
  targetNodeUuid: string;
  createdAt: Date;
}
export interface EntityNode extends BaseNode {
  entityType: string;
  summary: string;
  summaryEmbedding?: number[];
  factIds?: string[];
}
export interface EpisodicNode extends BaseNode {
  episodeType: EpisodeType;
  content: string;
  embedding?: number[];
  validAt: Date;
  invalidAt?: Date;
  createdAt: Date;
  referenceId?: string;
}
export interface CommunityNode extends BaseNode {
  communityLevel: number;
  summary: string;
  summaryEmbedding?: number[];
  factIds?: string[];
}
export interface EntityEdge extends BaseEdge {
  name: string;
  factIds: string[];
  episodes: string[];
  expiredAt?: Date;
  validAt: Date;
  invalidAt?: Date;
}
export interface EpisodicEdge extends BaseEdge {}
export interface CommunityEdge extends BaseEdge {
  name: string;
  description?: string;
  factIds?: string[];
}
