import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';
import {
  BaseNode,
  EntityNode,
  EpisodicNode,
  CommunityNode,
  EpisodeType,
  GraphDriver,
  GraphProvider,
} from '../types/index.js';
import { utcNow } from '../utils/datetime.js';

export const EpisodeTypeSchema = z.nativeEnum(EpisodeType);

export const BaseNodeSchema = z.object({
  uuid: z.string().default(() => uuidv4()),
  name: z.string(),
  groupId: z.string(),
  labels: z.array(z.string()).default([]),
  createdAt: z.date().default(() => utcNow()),
});

export const EntityNodeSchema = BaseNodeSchema.extend({
  entityType: z.string(),
  summary: z.string(),
  summaryEmbedding: z.array(z.number()).optional(),
  factIds: z.array(z.string()).optional(),
});

export const EpisodicNodeSchema = BaseNodeSchema.extend({
  episodeType: EpisodeTypeSchema,
  content: z.string(),
  embedding: z.array(z.number()).optional(),
  validAt: z.date(),
  invalidAt: z.date().optional(),
  referenceId: z.string().optional(),
});

export const CommunityNodeSchema = BaseNodeSchema.extend({
  communityLevel: z.number(),
  summary: z.string(),
  summaryEmbedding: z.array(z.number()).optional(),
  factIds: z.array(z.string()).optional(),
});

export abstract class Node implements BaseNode {
  uuid: string;
  name: string;
  groupId: string;
  labels: string[];
  createdAt: Date;

  constructor(data: BaseNode) {
    this.uuid = data.uuid || uuidv4();
    this.name = data.name;
    this.groupId = data.groupId;
    this.labels = data.labels || [];
    this.createdAt = data.createdAt || utcNow();
  }

  abstract save(driver: GraphDriver): Promise<void>;

  async delete(driver: GraphDriver): Promise<void> {
    switch (driver.provider) {
      case GraphProvider.NEO4J:
        await driver.executeQuery(
          `
          MATCH (n:Entity|Episodic|Community {uuid: $uuid})
          DETACH DELETE n
          `,
          { uuid: this.uuid },
        );
        break;
      case GraphProvider.FALKORDB:
        await driver.executeQuery(
          `
          MATCH (n {uuid: $uuid})
          WHERE 'Entity' IN labels(n) OR 'Episodic' IN labels(n) OR 'Community' IN labels(n)
          DETACH DELETE n
          `,
          { uuid: this.uuid },
        );
        break;
      case GraphProvider.NEPTUNE:
        await driver.executeQuery(
          `
          MATCH (n {uuid: $uuid})
          WHERE n:Entity OR n:Episodic OR n:Community
          DETACH DELETE n
          `,
          { uuid: this.uuid },
        );
        break;
    }
  }

  static async getByUuid(driver: GraphDriver, uuid: string): Promise<Node | null> {
    const result = await driver.executeQuery<any[]>(
      `
      MATCH (n {uuid: $uuid})
      RETURN n
      `,
      { uuid },
    );

    if (result.length === 0) {
      return null;
    }

    const nodeData = result[0].n;
    const labels = nodeData.labels || [];

    if (labels.includes('Entity')) {
      return new EntityNodeImpl(nodeData);
    } else if (labels.includes('Episodic')) {
      return new EpisodicNodeImpl(nodeData);
    } else if (labels.includes('Community')) {
      return new CommunityNodeImpl(nodeData);
    }

    throw new Error(`Unknown node type for uuid: ${uuid}`);
  }
}

export class EntityNodeImpl extends Node implements EntityNode {
  entityType: string;
  summary: string;
  summaryEmbedding?: number[];
  factIds?: string[];

  constructor(data: EntityNode) {
    super(data);
    this.entityType = data.entityType;
    this.summary = data.summary;
    this.summaryEmbedding = data.summaryEmbedding;
    this.factIds = data.factIds;
    this.labels = ['Entity', ...this.labels];
  }

  async save(driver: GraphDriver): Promise<void> {
    const params = {
      uuid: this.uuid,
      name: this.name,
      entityType: this.entityType,
      summary: this.summary,
      summaryEmbedding: this.summaryEmbedding || null,
      groupId: this.groupId,
      createdAt: this.createdAt.toISOString(),
      factIds: this.factIds || [],
    };

    const query = `
      MERGE (n:Entity {uuid: $uuid})
      SET n.name = $name,
          n.entityType = $entityType,
          n.summary = $summary,
          n.groupId = $groupId,
          n.createdAt = datetime($createdAt),
          n.factIds = $factIds
      ${this.summaryEmbedding ? 'SET n.summaryEmbedding = $summaryEmbedding, n.embedding = $summaryEmbedding' : ''}
      RETURN n
    `;

    await driver.executeQuery(query, params);
  }
}

export class EpisodicNodeImpl extends Node implements EpisodicNode {
  episodeType: EpisodeType;
  content: string;
  embedding?: number[];
  validAt: Date;
  invalidAt?: Date;
  referenceId?: string;

  constructor(data: EpisodicNode) {
    super(data);
    this.episodeType = data.episodeType;
    this.content = data.content;
    this.embedding = data.embedding;
    this.validAt = data.validAt;
    this.invalidAt = data.invalidAt;
    this.referenceId = data.referenceId;
    this.labels = ['Episodic', ...this.labels];
  }

  async save(driver: GraphDriver): Promise<void> {
    const params = {
      uuid: this.uuid,
      name: this.name,
      episodeType: this.episodeType,
      content: this.content,
      embedding: this.embedding || null,
      groupId: this.groupId,
      createdAt: this.createdAt.toISOString(),
      validAt: this.validAt.toISOString(),
      invalidAt: this.invalidAt?.toISOString(),
      referenceId: this.referenceId,
    };

    const query = `
      MERGE (n:Episodic {uuid: $uuid})
      SET n.name = $name,
          n.episodeType = $episodeType,
          n.content = $content,
          n.groupId = $groupId,
          n.createdAt = datetime($createdAt),
          n.validAt = datetime($validAt),
          n.invalidAt = ${this.invalidAt ? 'datetime($invalidAt)' : 'null'},
          n.referenceId = $referenceId
      ${this.embedding ? 'SET n.embedding = $embedding' : ''}
      RETURN n
    `;

    await driver.executeQuery(query, params);
  }
}

export class CommunityNodeImpl extends Node implements CommunityNode {
  communityLevel: number;
  summary: string;
  summaryEmbedding?: number[];
  factIds?: string[];

  constructor(data: CommunityNode) {
    super(data);
    this.communityLevel = data.communityLevel;
    this.summary = data.summary;
    this.summaryEmbedding = data.summaryEmbedding;
    this.factIds = data.factIds;
    this.labels = ['Community', ...this.labels];
  }

  async save(driver: GraphDriver): Promise<void> {
    const params = {
      uuid: this.uuid,
      name: this.name,
      communityLevel: this.communityLevel,
      summary: this.summary,
      summaryEmbedding: this.summaryEmbedding,
      groupId: this.groupId,
      createdAt: this.createdAt.toISOString(),
      factIds: this.factIds || [],
    };

    const query = `
      MERGE (n:Community {uuid: $uuid})
      SET n.name = $name,
          n.communityLevel = $communityLevel,
          n.summary = $summary,
          n.summaryEmbedding = $summaryEmbedding,
          n.groupId = $groupId,
          n.createdAt = datetime($createdAt),
          n.factIds = $factIds
      RETURN n
    `;

    await driver.executeQuery(query, params);
  }
}
