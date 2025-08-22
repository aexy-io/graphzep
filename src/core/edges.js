import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import { utcNow } from '../utils/datetime.js';
export const BaseEdgeSchema = z.object({
    uuid: z.string().default(() => uuidv4()),
    groupId: z.string(),
    sourceNodeUuid: z.string(),
    targetNodeUuid: z.string(),
    createdAt: z.date().default(() => utcNow()),
});
export const EntityEdgeSchema = BaseEdgeSchema.extend({
    name: z.string(),
    factIds: z.array(z.string()),
    episodes: z.array(z.string()),
    expiredAt: z.date().optional(),
    validAt: z.date(),
    invalidAt: z.date().optional(),
});
export const EpisodicEdgeSchema = BaseEdgeSchema;
export const CommunityEdgeSchema = BaseEdgeSchema.extend({
    name: z.string(),
    description: z.string().optional(),
    factIds: z.array(z.string()).optional(),
});
export class Edge {
    uuid;
    groupId;
    sourceNodeUuid;
    targetNodeUuid;
    createdAt;
    constructor(data) {
        this.uuid = data.uuid || uuidv4();
        this.groupId = data.groupId;
        this.sourceNodeUuid = data.sourceNodeUuid;
        this.targetNodeUuid = data.targetNodeUuid;
        this.createdAt = data.createdAt || utcNow();
    }
    async delete(driver) {
        await driver.executeQuery(`
      MATCH (n)-[e:MENTIONS|RELATES_TO|HAS_MEMBER {uuid: $uuid}]->(m)
      DELETE e
      `, { uuid: this.uuid });
    }
    static async deleteByUuids(driver, uuids) {
        await driver.executeQuery(`
      MATCH (n)-[e:MENTIONS|RELATES_TO|HAS_MEMBER]->(m)
      WHERE e.uuid IN $uuids
      DELETE e
      `, { uuids });
    }
    static async getByUuid(driver, uuid) {
        const result = await driver.executeQuery(`
      MATCH (n)-[e {uuid: $uuid}]->(m)
      RETURN e, type(e) as relType
      `, { uuid });
        if (result.length === 0) {
            return null;
        }
        const edgeData = result[0].e;
        const relType = result[0].relType;
        switch (relType) {
            case 'RELATES_TO':
                return new EntityEdgeImpl(edgeData);
            case 'MENTIONS':
                return new EpisodicEdgeImpl(edgeData);
            case 'HAS_MEMBER':
                return new CommunityEdgeImpl(edgeData);
            default:
                throw new Error(`Unknown edge type: ${relType}`);
        }
    }
}
export class EntityEdgeImpl extends Edge {
    name;
    factIds;
    episodes;
    expiredAt;
    validAt;
    invalidAt;
    constructor(data) {
        super(data);
        this.name = data.name;
        this.factIds = data.factIds;
        this.episodes = data.episodes;
        this.expiredAt = data.expiredAt;
        this.validAt = data.validAt;
        this.invalidAt = data.invalidAt;
    }
    async save(driver) {
        const params = {
            uuid: this.uuid,
            sourceUuid: this.sourceNodeUuid,
            targetUuid: this.targetNodeUuid,
            name: this.name,
            factIds: this.factIds,
            episodes: this.episodes,
            groupId: this.groupId,
            createdAt: this.createdAt.toISOString(),
            validAt: this.validAt.toISOString(),
            invalidAt: this.invalidAt?.toISOString(),
            expiredAt: this.expiredAt?.toISOString(),
        };
        const query = `
      MATCH (source:Entity {uuid: $sourceUuid})
      MATCH (target:Entity {uuid: $targetUuid})
      MERGE (source)-[e:RELATES_TO {uuid: $uuid}]->(target)
      SET e.name = $name,
          e.factIds = $factIds,
          e.episodes = $episodes,
          e.groupId = $groupId,
          e.createdAt = datetime($createdAt),
          e.validAt = datetime($validAt),
          e.invalidAt = ${this.invalidAt ? 'datetime($invalidAt)' : 'null'},
          e.expiredAt = ${this.expiredAt ? 'datetime($expiredAt)' : 'null'}
      RETURN e
    `;
        await driver.executeQuery(query, params);
    }
}
export class EpisodicEdgeImpl extends Edge {
    async save(driver) {
        const params = {
            uuid: this.uuid,
            episodeUuid: this.sourceNodeUuid,
            entityUuid: this.targetNodeUuid,
            groupId: this.groupId,
            createdAt: this.createdAt.toISOString(),
        };
        const query = `
      MATCH (episode:Episodic {uuid: $episodeUuid})
      MATCH (entity:Entity {uuid: $entityUuid})
      MERGE (episode)-[e:MENTIONS {uuid: $uuid}]->(entity)
      SET e.groupId = $groupId,
          e.createdAt = datetime($createdAt)
      RETURN e
    `;
        await driver.executeQuery(query, params);
    }
}
export class CommunityEdgeImpl extends Edge {
    name;
    description;
    factIds;
    constructor(data) {
        super(data);
        this.name = data.name;
        this.description = data.description;
        this.factIds = data.factIds;
    }
    async save(driver) {
        const params = {
            uuid: this.uuid,
            communityUuid: this.sourceNodeUuid,
            entityUuid: this.targetNodeUuid,
            name: this.name,
            description: this.description,
            factIds: this.factIds || [],
            groupId: this.groupId,
            createdAt: this.createdAt.toISOString(),
        };
        const query = `
      MATCH (community:Community {uuid: $communityUuid})
      MATCH (entity:Entity {uuid: $entityUuid})
      MERGE (community)-[e:HAS_MEMBER {uuid: $uuid}]->(entity)
      SET e.name = $name,
          e.description = $description,
          e.factIds = $factIds,
          e.groupId = $groupId,
          e.createdAt = datetime($createdAt)
      RETURN e
    `;
        await driver.executeQuery(query, params);
    }
}
//# sourceMappingURL=edges.js.map