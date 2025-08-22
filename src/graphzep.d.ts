import { GraphDriver, EpisodicNode, EpisodeType } from './types/index.js';
import { Node } from './core/nodes.js';
import { Edge } from './core/edges.js';
import { BaseLLMClient } from './llm/client.js';
import { BaseEmbedderClient } from './embedders/client.js';
export interface GraphzepConfig {
  driver: GraphDriver;
  llmClient: BaseLLMClient;
  embedder: BaseEmbedderClient;
  groupId?: string;
  ensureAscii?: boolean;
}
export interface AddEpisodeParams {
  content: string;
  episodeType?: EpisodeType;
  referenceId?: string;
  groupId?: string;
  metadata?: Record<string, any>;
}
export interface SearchParams {
  query: string;
  groupId?: string;
  limit?: number;
  searchType?: 'semantic' | 'keyword' | 'hybrid';
  nodeTypes?: ('entity' | 'episodic' | 'community')[];
}
export interface ExtractedEntity {
  name: string;
  entityType: string;
  summary: string;
  metadata?: Record<string, any>;
}
export interface ExtractedRelation {
  sourceName: string;
  targetName: string;
  relationName: string;
  metadata?: Record<string, any>;
}
export declare class Graphzep {
  private driver;
  private llmClient;
  private embedder;
  private defaultGroupId;
  private ensureAscii;
  constructor(config: GraphzepConfig);
  addEpisode(params: AddEpisodeParams): Promise<EpisodicNode>;
  private extractEntitiesAndRelations;
  private processExtractedEntities;
  private findExistingEntity;
  private linkEpisodeToEntities;
  private processExtractedRelations;
  private findExistingRelation;
  search(params: SearchParams): Promise<Node[]>;
  getNode(uuid: string): Promise<Node | null>;
  getEdge(uuid: string): Promise<Edge | null>;
  deleteNode(uuid: string): Promise<void>;
  deleteEdge(uuid: string): Promise<void>;
  close(): Promise<void>;
  executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  createIndexes(): Promise<void>;
  clearDatabase(): Promise<void>;
  testConnection(): Promise<void>;
}
