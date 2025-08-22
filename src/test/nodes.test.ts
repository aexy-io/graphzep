import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import {
  EntityNodeImpl,
  EpisodicNodeImpl,
  CommunityNodeImpl,
  EntityNodeSchema,
  EpisodicNodeSchema,
  CommunityNodeSchema,
} from '../core/nodes.js';
import { EpisodeType } from '../types/index.js';
import { utcNow } from '../utils/datetime.js';

describe('Node Models', () => {
  describe('EntityNode', () => {
    it('should create a valid entity node', () => {
      const nodeData = {
        uuid: 'test-uuid-1',
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test person entity',
        labels: ['TestLabel'],
        createdAt: utcNow(),
      };

      const node = new EntityNodeImpl(nodeData);

      assert.strictEqual(node.uuid, 'test-uuid-1');
      assert.strictEqual(node.name, 'Test Entity');
      assert.strictEqual(node.groupId, 'group-1');
      assert.strictEqual(node.entityType, 'Person');
      assert.strictEqual(node.summary, 'A test person entity');
      assert(node.labels.includes('Entity'));
      assert(node.labels.includes('TestLabel'));
    });

    it('should validate entity node schema', () => {
      const validData = {
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test person entity',
      };

      const result = EntityNodeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert(Array.isArray(result.data?.labels));
      assert(result.data?.createdAt instanceof Date);
    });

    it('should reject invalid entity node data', () => {
      const invalidData = {
        name: 'Test Entity',
      };

      const result = EntityNodeSchema.safeParse(invalidData);
      assert(!result.success);
    });

    it('should handle summary embeddings', () => {
      const nodeData = {
        uuid: 'test-uuid-2',
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test person entity',
        summaryEmbedding: [0.1, 0.2, 0.3],
        factIds: ['fact-1', 'fact-2'],
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EntityNodeImpl(nodeData);

      assert.deepStrictEqual(node.summaryEmbedding, [0.1, 0.2, 0.3]);
      assert.deepStrictEqual(node.factIds, ['fact-1', 'fact-2']);
    });
  });

  describe('EpisodicNode', () => {
    it('should create a valid episodic node', () => {
      const nodeData = {
        uuid: 'episode-uuid-1',
        name: 'Test Episode',
        groupId: 'group-1',
        episodeType: EpisodeType.MESSAGE,
        content: 'user: Hello, world!',
        validAt: utcNow(),
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EpisodicNodeImpl(nodeData);

      assert.strictEqual(node.uuid, 'episode-uuid-1');
      assert.strictEqual(node.name, 'Test Episode');
      assert.strictEqual(node.episodeType, EpisodeType.MESSAGE);
      assert.strictEqual(node.content, 'user: Hello, world!');
      assert(node.labels.includes('Episodic'));
    });

    it('should validate episodic node schema', () => {
      const validData = {
        name: 'Test Episode',
        groupId: 'group-1',
        episodeType: EpisodeType.TEXT,
        content: 'Some text content',
        validAt: utcNow(),
      };

      const result = EpisodicNodeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert.strictEqual(result.data?.episodeType, EpisodeType.TEXT);
    });

    it('should handle optional fields', () => {
      const nodeData = {
        uuid: 'episode-uuid-2',
        name: 'Test Episode',
        groupId: 'group-1',
        episodeType: EpisodeType.JSON,
        content: '{"key": "value"}',
        validAt: utcNow(),
        invalidAt: new Date('2025-12-31'),
        referenceId: 'ref-123',
        embedding: [0.4, 0.5, 0.6],
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EpisodicNodeImpl(nodeData);

      assert(node.invalidAt);
      assert.strictEqual(node.referenceId, 'ref-123');
      assert.deepStrictEqual(node.embedding, [0.4, 0.5, 0.6]);
    });
  });

  describe('CommunityNode', () => {
    it('should create a valid community node', () => {
      const nodeData = {
        uuid: 'community-uuid-1',
        name: 'Test Community',
        groupId: 'group-1',
        communityLevel: 1,
        summary: 'A test community of entities',
        labels: [],
        createdAt: utcNow(),
      };

      const node = new CommunityNodeImpl(nodeData);

      assert.strictEqual(node.uuid, 'community-uuid-1');
      assert.strictEqual(node.name, 'Test Community');
      assert.strictEqual(node.communityLevel, 1);
      assert.strictEqual(node.summary, 'A test community of entities');
      assert(node.labels.includes('Community'));
    });

    it('should validate community node schema', () => {
      const validData = {
        name: 'Test Community',
        groupId: 'group-1',
        communityLevel: 2,
        summary: 'A higher level community',
      };

      const result = CommunityNodeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert.strictEqual(result.data?.communityLevel, 2);
    });

    it('should handle summary embeddings and fact IDs', () => {
      const nodeData = {
        uuid: 'community-uuid-2',
        name: 'Test Community',
        groupId: 'group-1',
        communityLevel: 0,
        summary: 'A base level community',
        summaryEmbedding: [0.7, 0.8, 0.9],
        factIds: ['fact-3', 'fact-4', 'fact-5'],
        labels: [],
        createdAt: utcNow(),
      };

      const node = new CommunityNodeImpl(nodeData);

      assert.deepStrictEqual(node.summaryEmbedding, [0.7, 0.8, 0.9]);
      assert.deepStrictEqual(node.factIds, ['fact-3', 'fact-4', 'fact-5']);
    });
  });

  describe('Node UUID Generation', () => {
    it('should auto-generate UUID when not provided', () => {
      const nodeData = {
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test person entity',
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EntityNodeImpl({ ...nodeData, uuid: '' });
      assert(node.uuid);
      assert(node.uuid.length > 0);
    });

    it('should use provided UUID when available', () => {
      const providedUuid = 'custom-uuid-123';
      const nodeData = {
        uuid: providedUuid,
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test person entity',
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EntityNodeImpl(nodeData);
      assert.strictEqual(node.uuid, providedUuid);
    });
  });
});
