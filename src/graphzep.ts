import { z } from 'zod';
import {
  GraphDriver,
  EntityNode,
  EpisodicNode,
  CommunityNode,
  EntityEdge,
  EpisodicEdge,
  CommunityEdge,
  EpisodeType,
  GraphProvider,
} from './types/index.js';
import { Node, EntityNodeImpl, EpisodicNodeImpl, CommunityNodeImpl } from './core/nodes.js';
import { Edge, EntityEdgeImpl, EpisodicEdgeImpl, CommunityEdgeImpl } from './core/edges.js';
import { BaseLLMClient } from './llm/client.js';
import { BaseEmbedderClient } from './embedders/client.js';
import { utcNow } from './utils/datetime.js';
import { OptimizedRDFDriver } from './drivers/rdf-driver.js';
import { RDFMemoryMapper } from './rdf/memory-mapper.js';
import { OntologyManager } from './rdf/ontology-manager.js';
import { ZepSPARQLInterface } from './rdf/sparql-interface.js';
import { NamespaceManager } from './rdf/namespaces.js';
import { ZepMemory, ZepFact, MemoryType, ZepSearchParams, ZepSearchResult } from './zep/types.js';

export interface GraphzepConfig {
  driver: GraphDriver;
  llmClient: BaseLLMClient;
  embedder: BaseEmbedderClient;
  groupId?: string;
  ensureAscii?: boolean;
  // RDF-specific options
  customOntologyPath?: string;
  rdfConfig?: {
    includeEmbeddings?: boolean;
    embeddingSchema?: 'base64' | 'vector-ref' | 'compressed';
  };
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

const ExtractedEntitySchema = z.object({
  name: z.string(),
  entityType: z.string(),
  summary: z.string(),
  metadata: z.record(z.any()).optional(),
});

const ExtractedRelationSchema = z.object({
  sourceName: z.string(),
  targetName: z.string(),
  relationName: z.string(),
  metadata: z.record(z.any()).optional(),
});

const ExtractionResultSchema = z.object({
  entities: z.array(ExtractedEntitySchema),
  relations: z.array(ExtractedRelationSchema),
});

export class Graphzep {
  private driver: GraphDriver;
  private llmClient: BaseLLMClient;
  private embedder: BaseEmbedderClient;
  private defaultGroupId: string;
  private ensureAscii: boolean;
  
  // RDF-specific components
  private rdfMapper?: RDFMemoryMapper;
  private ontologyManager?: OntologyManager;
  private sparqlInterface?: ZepSPARQLInterface;
  private isRDFEnabled: boolean;

  constructor(config: GraphzepConfig) {
    this.driver = config.driver;
    this.llmClient = config.llmClient;
    this.embedder = config.embedder;
    this.defaultGroupId = config.groupId || 'default';
    this.ensureAscii = config.ensureAscii ?? false;
    
    // Initialize RDF components if using RDF driver
    this.isRDFEnabled = this.driver.provider === GraphProvider.RDF;
    
    if (this.isRDFEnabled && this.driver instanceof OptimizedRDFDriver) {
      this.initializeRDFComponents(config);
    }
  }
  
  private async initializeRDFComponents(config: GraphzepConfig): Promise<void> {
    if (!(this.driver instanceof OptimizedRDFDriver)) return;
    
    const nsManager = new NamespaceManager();
    
    // Initialize RDF memory mapper
    this.rdfMapper = new RDFMemoryMapper({
      namespaceManager: nsManager,
      includeEmbeddings: config.rdfConfig?.includeEmbeddings ?? true,
      embeddingSchema: config.rdfConfig?.embeddingSchema ?? 'vector-ref'
    });
    
    // Initialize ontology manager
    this.ontologyManager = new OntologyManager(nsManager);
    
    // Load custom ontology if provided
    if (config.customOntologyPath) {
      await this.ontologyManager.loadOntology(config.customOntologyPath);
    }
    
    // Initialize SPARQL interface
    this.sparqlInterface = new ZepSPARQLInterface(this.driver, nsManager);
  }

  async addEpisode(params: AddEpisodeParams): Promise<EpisodicNode> {
    const groupId = params.groupId || this.defaultGroupId;
    const episodeType = params.episodeType || EpisodeType.TEXT;

    const embedding = await this.embedder.embed(params.content);

    // Create episodic node
    const episodicNode = new EpisodicNodeImpl({
      uuid: '',
      name: params.content.substring(0, 50),
      groupId,
      episodeType,
      content: params.content,
      embedding,
      validAt: utcNow(),
      referenceId: params.referenceId,
      labels: [],
      createdAt: utcNow(),
    });

    // Handle RDF storage if enabled
    if (this.isRDFEnabled && this.rdfMapper && this.driver instanceof OptimizedRDFDriver) {
      const zepMemory: ZepMemory = {
        uuid: episodicNode.uuid || '',
        sessionId: groupId,
        content: params.content,
        memoryType: MemoryType.EPISODIC,
        embedding,
        metadata: params.metadata,
        createdAt: utcNow(),
        accessCount: 0,
        validFrom: utcNow(),
        facts: []
      };

      // Convert to RDF and store
      const triples = this.rdfMapper.episodicToRDF(zepMemory);
      
      // Validate against ontology if available
      if (this.ontologyManager) {
        const validation = this.ontologyManager.validateTriples(triples);
        if (!validation.valid) {
          console.warn('RDF validation warnings:', validation.warnings);
          console.error('RDF validation errors:', validation.errors);
        }
      }

      await this.driver.addTriples(triples);
      return episodicNode; // Skip traditional graph processing for RDF
    }

    // Traditional graph processing for non-RDF drivers
    await episodicNode.save(this.driver);

    const extractedData = await this.extractEntitiesAndRelations(params.content);

    const entityNodes = await this.processExtractedEntities(extractedData.entities, groupId);

    await this.linkEpisodeToEntities(episodicNode, entityNodes);

    await this.processExtractedRelations(extractedData.relations, entityNodes, groupId);

    return episodicNode;
  }

  private async extractEntitiesAndRelations(content: string): Promise<{
    entities: ExtractedEntity[];
    relations: ExtractedRelation[];
  }> {
    const prompt = `
Extract entities and their relationships from the following text.

Text: ${content}

Instructions:
1. Identify all entities (people, places, organizations, concepts, etc.)
2. For each entity, provide:
   - name: The entity's name
   - entityType: The type/category of the entity
   - summary: A brief description of the entity based on the context
3. Identify relationships between entities
4. For each relationship, provide:
   - sourceName: The name of the source entity
   - targetName: The name of the target entity
   - relationName: The nature/type of the relationship

Respond with valid JSON matching this structure:
{
  "entities": [
    {
      "name": "string",
      "entityType": "string",
      "summary": "string"
    }
  ],
  "relations": [
    {
      "sourceName": "string",
      "targetName": "string",
      "relationName": "string"
    }
  ]
}`;

    const response = await this.llmClient.generateStructuredResponse(
      prompt,
      ExtractionResultSchema,
    );

    return response;
  }

  private async processExtractedEntities(
    entities: ExtractedEntity[],
    groupId: string,
  ): Promise<EntityNodeImpl[]> {
    const processedEntities: EntityNodeImpl[] = [];

    for (const entity of entities) {
      const existing = await this.findExistingEntity(entity.name, groupId);

      if (existing) {
        processedEntities.push(existing);
      } else {
        const embedding = await this.embedder.embed(entity.summary);

        const entityNode = new EntityNodeImpl({
          uuid: '',
          name: entity.name,
          groupId,
          entityType: entity.entityType,
          summary: entity.summary,
          summaryEmbedding: embedding,
          labels: [],
          createdAt: utcNow(),
        });

        await entityNode.save(this.driver);
        processedEntities.push(entityNode);
      }
    }

    return processedEntities;
  }

  private async findExistingEntity(name: string, groupId: string): Promise<EntityNodeImpl | null> {
    const result = await this.driver.executeQuery<any[]>(
      `
      MATCH (n:Entity {name: $name, groupId: $groupId})
      RETURN n
      LIMIT 1
      `,
      { name, groupId },
    );

    if (result.length === 0) {
      return null;
    }

    return new EntityNodeImpl(result[0].n);
  }

  private async linkEpisodeToEntities(
    episode: EpisodicNodeImpl,
    entities: EntityNodeImpl[],
  ): Promise<void> {
    for (const entity of entities) {
      const edge = new EpisodicEdgeImpl({
        uuid: '',
        groupId: episode.groupId,
        sourceNodeUuid: episode.uuid,
        targetNodeUuid: entity.uuid,
        createdAt: utcNow(),
      });

      await edge.save(this.driver);
    }
  }

  private async processExtractedRelations(
    relations: ExtractedRelation[],
    entities: EntityNodeImpl[],
    groupId: string,
  ): Promise<void> {
    const entityMap = new Map(entities.map((e) => [e.name, e]));

    for (const relation of relations) {
      const source = entityMap.get(relation.sourceName);
      const target = entityMap.get(relation.targetName);

      if (source && target) {
        const existingEdge = await this.findExistingRelation(
          source.uuid,
          target.uuid,
          relation.relationName,
        );

        if (!existingEdge) {
          const edge = new EntityEdgeImpl({
            uuid: '',
            groupId,
            sourceNodeUuid: source.uuid,
            targetNodeUuid: target.uuid,
            name: relation.relationName,
            factIds: [],
            episodes: [],
            validAt: utcNow(),
            createdAt: utcNow(),
          });

          await edge.save(this.driver);
        }
      }
    }
  }

  private async findExistingRelation(
    sourceUuid: string,
    targetUuid: string,
    relationName: string,
  ): Promise<EntityEdgeImpl | null> {
    const result = await this.driver.executeQuery<any[]>(
      `
      MATCH (s:Entity {uuid: $sourceUuid})-[r:RELATES_TO {name: $relationName}]->(t:Entity {uuid: $targetUuid})
      RETURN r
      LIMIT 1
      `,
      { sourceUuid, targetUuid, relationName },
    );

    if (result.length === 0) {
      return null;
    }

    return new EntityEdgeImpl(result[0].r);
  }

  async search(params: SearchParams): Promise<Node[]> {
    const embedding = await this.embedder.embed(params.query);
    const groupId = params.groupId || this.defaultGroupId;
    const limit = Math.floor(params.limit || 10);

    const query = `
      MATCH (n)
      WHERE n.groupId = $groupId
        AND (n:Entity OR n:Episodic OR n:Community)
        AND n.embedding IS NOT NULL
      WITH n, 
        reduce(similarity = 0.0, i IN range(0, size(n.embedding)-1) | 
          similarity + (n.embedding[i] * $embedding[i])
        ) AS similarity
      ORDER BY similarity DESC
      LIMIT $limit
      RETURN n, labels(n) as labels
    `;

    const results = await this.driver.executeQuery<any[]>(query, {
      groupId,
      embedding,
      limit,
    });

    return results.map((result) => {
      const nodeData = result.n.properties || result.n;
      const labels = result.labels || [];

      if (labels.includes('Entity')) {
        return new EntityNodeImpl({ ...nodeData, labels });
      } else if (labels.includes('Episodic')) {
        return new EpisodicNodeImpl({ ...nodeData, labels });
      } else if (labels.includes('Community')) {
        return new CommunityNodeImpl({ ...nodeData, labels });
      }

      throw new Error(`Unknown node type for labels: ${labels}`);
    });
  }

  async getNode(uuid: string): Promise<Node | null> {
    return Node.getByUuid(this.driver, uuid);
  }

  async getEdge(uuid: string): Promise<Edge | null> {
    return Edge.getByUuid(this.driver, uuid);
  }

  async deleteNode(uuid: string): Promise<void> {
    const node = await this.getNode(uuid);
    if (node) {
      await node.delete(this.driver);
    }
  }

  async deleteEdge(uuid: string): Promise<void> {
    const edge = await this.getEdge(uuid);
    if (edge) {
      await edge.delete(this.driver);
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T> {
    return this.driver.executeQuery(query, params);
  }

  async createIndexes(): Promise<void> {
    return this.driver.createIndexes();
  }

  async clearDatabase(): Promise<void> {
    await this.driver.executeQuery('MATCH (n) DETACH DELETE n');
  }

  async testConnection(): Promise<void> {
    await this.driver.executeQuery('RETURN 1');
  }

  // ========================================
  // RDF-SPECIFIC METHODS
  // ========================================

  /**
   * Execute SPARQL query (RDF drivers only)
   */
  async sparqlQuery(query: string, options?: any): Promise<any> {
    if (!this.isRDFEnabled || !this.sparqlInterface) {
      throw new Error('SPARQL queries require RDF driver');
    }
    
    return await this.sparqlInterface.query(query, options);
  }

  /**
   * Add semantic fact (RDF drivers only)
   */
  async addFact(fact: Omit<ZepFact, 'uuid'>): Promise<string> {
    if (!this.isRDFEnabled || !this.rdfMapper || !(this.driver instanceof OptimizedRDFDriver)) {
      throw new Error('addFact requires RDF driver');
    }

    const fullFact: ZepFact = {
      uuid: '',
      ...fact
    };

    const triples = this.rdfMapper.semanticToRDF(fullFact);
    
    // Validate against ontology if available
    if (this.ontologyManager) {
      const validation = this.ontologyManager.validateTriples(triples);
      if (!validation.valid) {
        console.warn('Fact validation warnings:', validation.warnings);
        if (validation.errors.length > 0) {
          throw new Error(`Fact validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
        }
      }
    }

    await this.driver.addTriples(triples);
    return fullFact.uuid;
  }

  /**
   * Search memories using Zep-specific search parameters (RDF drivers)
   */
  async searchMemories(params: ZepSearchParams): Promise<ZepSearchResult[]> {
    if (!this.isRDFEnabled || !this.sparqlInterface) {
      throw new Error('searchMemories requires RDF driver');
    }

    return await this.sparqlInterface.searchMemories(params);
  }

  /**
   * Get memories at a specific time (RDF drivers only)
   */
  async getMemoriesAtTime(timestamp: Date, memoryTypes?: MemoryType[]): Promise<ZepMemory[]> {
    if (!this.isRDFEnabled || !this.sparqlInterface) {
      throw new Error('getMemoriesAtTime requires RDF driver');
    }

    return await this.sparqlInterface.getMemoriesAtTime(timestamp, memoryTypes);
  }

  /**
   * Get facts about an entity (RDF drivers only)
   */
  async getFactsAboutEntity(entityName: string, validAt?: Date): Promise<ZepFact[]> {
    if (!this.isRDFEnabled || !this.sparqlInterface) {
      throw new Error('getFactsAboutEntity requires RDF driver');
    }

    return await this.sparqlInterface.getFactsAboutEntity(entityName, validAt);
  }

  /**
   * Find related entities using graph traversal (RDF drivers only)
   */
  async findRelatedEntities(entityName: string, maxHops = 2, minConfidence = 0.5): Promise<any[]> {
    if (!this.isRDFEnabled || !this.sparqlInterface) {
      throw new Error('findRelatedEntities requires RDF driver');
    }

    return await this.sparqlInterface.findRelatedEntities(entityName, maxHops, minConfidence);
  }

  /**
   * Export current knowledge graph as RDF (works with all drivers)
   */
  async exportToRDF(format: 'turtle' | 'rdf-xml' | 'json-ld' | 'n-triples' = 'turtle'): Promise<string> {
    if (this.isRDFEnabled && this.driver instanceof OptimizedRDFDriver) {
      return await this.driver.serialize(format);
    } else {
      // Convert property graph to RDF
      throw new Error('Property graph to RDF conversion not yet implemented');
    }
  }

  /**
   * Load custom ontology (RDF drivers only)
   */
  async loadOntology(ontologyPath: string): Promise<string> {
    if (!this.isRDFEnabled || !this.ontologyManager) {
      throw new Error('loadOntology requires RDF driver');
    }

    return await this.ontologyManager.loadOntology(ontologyPath);
  }

  /**
   * Generate extraction guidance for LLM using ontology
   */
  async generateExtractionGuidance(content: string): Promise<string> {
    if (!this.isRDFEnabled || !this.ontologyManager) {
      // Fallback to traditional extraction for non-RDF drivers
      return this.generateTraditionalExtractionPrompt(content);
    }

    const guidance = this.ontologyManager.generateExtractionGuidance(content);
    return guidance.prompt;
  }

  /**
   * Get ontology statistics (RDF drivers only)
   */
  getOntologyStats(): any {
    if (!this.isRDFEnabled || !this.ontologyManager) {
      throw new Error('getOntologyStats requires RDF driver');
    }

    return this.ontologyManager.getOntologyStats();
  }

  /**
   * Check if RDF support is enabled
   */
  isRDFSupported(): boolean {
    return this.isRDFEnabled;
  }

  /**
   * Get available SPARQL query templates
   */
  getSPARQLTemplates(): Record<string, string> {
    return {
      allMemories: `
        SELECT ?memory ?type ?content ?confidence ?sessionId ?createdAt
        WHERE {
          ?memory a ?type ;
                  zep:content ?content ;
                  zep:confidence ?confidence ;
                  zep:sessionId ?sessionId ;
                  zep:createdAt ?createdAt .
          
          FILTER(?type IN (zep:EpisodicMemory, zep:SemanticMemory, zep:ProceduralMemory))
        }
        ORDER BY DESC(?createdAt)
      `,
      
      memoryBySession: `
        SELECT ?memory ?type ?content ?confidence ?createdAt
        WHERE {
          ?memory a ?type ;
                  zep:content ?content ;
                  zep:confidence ?confidence ;
                  zep:sessionId ?SESSION_ID ;
                  zep:createdAt ?createdAt .
        }
        ORDER BY ?createdAt
      `,
      
      highConfidenceFacts: `
        SELECT ?fact ?subject ?predicate ?object ?confidence ?validFrom
        WHERE {
          ?fact a zep:SemanticMemory ;
                zep:hasStatement ?statement ;
                zep:confidence ?confidence ;
                zep:validFrom ?validFrom .
          
          ?statement rdf:subject ?subject ;
                     rdf:predicate ?predicate ;
                     rdf:object ?object .
          
          FILTER(?confidence >= 0.8)
        }
        ORDER BY DESC(?confidence)
      `,
      
      entitiesByType: `
        SELECT ?entity ?name ?type ?summary
        WHERE {
          ?entity a zep:Entity ;
                  zep:name ?name ;
                  zep:entityType ?type ;
                  zep:summary ?summary .
          
          FILTER(?type = "?ENTITY_TYPE")
        }
      `,
      
      memoryEvolution: `
        SELECT (STRFTIME("%Y-%m", ?createdAt) AS ?month)
               (COUNT(?memory) AS ?memoryCount)
               (AVG(?confidence) AS ?avgConfidence)
        WHERE {
          ?memory a ?type ;
                  zep:confidence ?confidence ;
                  zep:createdAt ?createdAt .
          
          FILTER(?type IN (zep:EpisodicMemory, zep:SemanticMemory))
        }
        GROUP BY ?month
        ORDER BY ?month
      `
    };
  }

  private generateTraditionalExtractionPrompt(content: string): string {
    return `
Extract entities and their relationships from the following text.

Text: ${content}

Instructions:
1. Identify all entities (people, places, organizations, concepts, etc.)
2. For each entity, provide:
   - name: The entity's name
   - entityType: The type/category of the entity
   - summary: A brief description of the entity based on the context
3. Identify relationships between entities
4. For each relationship, provide:
   - sourceName: The name of the source entity
   - targetName: The name of the target entity
   - relationName: The nature/type of the relationship

Respond with valid JSON matching this structure:
{
  "entities": [
    {
      "name": "string",
      "entityType": "string", 
      "summary": "string"
    }
  ],
  "relations": [
    {
      "sourceName": "string",
      "targetName": "string",
      "relationName": "string"
    }
  ]
}`;
  }
}
