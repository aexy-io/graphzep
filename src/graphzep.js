import { z } from 'zod';
import { EpisodeType, } from './types/index.js';
import { Node, EntityNodeImpl, EpisodicNodeImpl, CommunityNodeImpl } from './core/nodes.js';
import { Edge, EntityEdgeImpl, EpisodicEdgeImpl } from './core/edges.js';
import { utcNow } from './utils/datetime.js';
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
    driver;
    llmClient;
    embedder;
    defaultGroupId;
    ensureAscii;
    constructor(config) {
        this.driver = config.driver;
        this.llmClient = config.llmClient;
        this.embedder = config.embedder;
        this.defaultGroupId = config.groupId || 'default';
        this.ensureAscii = config.ensureAscii ?? false;
    }
    async addEpisode(params) {
        const groupId = params.groupId || this.defaultGroupId;
        const episodeType = params.episodeType || EpisodeType.TEXT;
        const embedding = await this.embedder.embed(params.content);
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
        await episodicNode.save(this.driver);
        const extractedData = await this.extractEntitiesAndRelations(params.content);
        const entityNodes = await this.processExtractedEntities(extractedData.entities, groupId);
        await this.linkEpisodeToEntities(episodicNode, entityNodes);
        await this.processExtractedRelations(extractedData.relations, entityNodes, groupId);
        return episodicNode;
    }
    async extractEntitiesAndRelations(content) {
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
        const response = await this.llmClient.generateStructuredResponse(prompt, ExtractionResultSchema);
        return response;
    }
    async processExtractedEntities(entities, groupId) {
        const processedEntities = [];
        for (const entity of entities) {
            const existing = await this.findExistingEntity(entity.name, groupId);
            if (existing) {
                processedEntities.push(existing);
            }
            else {
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
    async findExistingEntity(name, groupId) {
        const result = await this.driver.executeQuery(`
      MATCH (n:Entity {name: $name, groupId: $groupId})
      RETURN n
      LIMIT 1
      `, { name, groupId });
        if (result.length === 0) {
            return null;
        }
        return new EntityNodeImpl(result[0].n);
    }
    async linkEpisodeToEntities(episode, entities) {
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
    async processExtractedRelations(relations, entities, groupId) {
        const entityMap = new Map(entities.map((e) => [e.name, e]));
        for (const relation of relations) {
            const source = entityMap.get(relation.sourceName);
            const target = entityMap.get(relation.targetName);
            if (source && target) {
                const existingEdge = await this.findExistingRelation(source.uuid, target.uuid, relation.relationName);
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
    async findExistingRelation(sourceUuid, targetUuid, relationName) {
        const result = await this.driver.executeQuery(`
      MATCH (s:Entity {uuid: $sourceUuid})-[r:RELATES_TO {name: $relationName}]->(t:Entity {uuid: $targetUuid})
      RETURN r
      LIMIT 1
      `, { sourceUuid, targetUuid, relationName });
        if (result.length === 0) {
            return null;
        }
        return new EntityEdgeImpl(result[0].r);
    }
    async search(params) {
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
        const results = await this.driver.executeQuery(query, {
            groupId,
            embedding,
            limit,
        });
        return results.map((result) => {
            const nodeData = result.n.properties || result.n;
            const labels = result.labels || [];
            if (labels.includes('Entity')) {
                return new EntityNodeImpl({ ...nodeData, labels });
            }
            else if (labels.includes('Episodic')) {
                return new EpisodicNodeImpl({ ...nodeData, labels });
            }
            else if (labels.includes('Community')) {
                return new CommunityNodeImpl({ ...nodeData, labels });
            }
            throw new Error(`Unknown node type for labels: ${labels}`);
        });
    }
    async getNode(uuid) {
        return Node.getByUuid(this.driver, uuid);
    }
    async getEdge(uuid) {
        return Edge.getByUuid(this.driver, uuid);
    }
    async deleteNode(uuid) {
        const node = await this.getNode(uuid);
        if (node) {
            await node.delete(this.driver);
        }
    }
    async deleteEdge(uuid) {
        const edge = await this.getEdge(uuid);
        if (edge) {
            await edge.delete(this.driver);
        }
    }
    async close() {
        await this.driver.close();
    }
    async executeQuery(query, params) {
        return this.driver.executeQuery(query, params);
    }
    async createIndexes() {
        return this.driver.createIndexes();
    }
    async clearDatabase() {
        await this.driver.executeQuery('MATCH (n) DETACH DELETE n');
    }
    async testConnection() {
        await this.driver.executeQuery('RETURN 1');
    }
}
//# sourceMappingURL=graphzep.js.map