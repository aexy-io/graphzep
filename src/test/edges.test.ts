import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  EntityEdgeImpl,
  EpisodicEdgeImpl,
  CommunityEdgeImpl,
  EntityEdgeSchema,
  EpisodicEdgeSchema,
  CommunityEdgeSchema,
} from '../core/edges.js';
import { utcNow } from '../utils/datetime.js';

describe('Edge Models', () => {
  describe('EntityEdge', () => {
    it('should create a valid entity edge', () => {
      const edgeData = {
        uuid: 'edge-uuid-1',
        groupId: 'group-1',
        sourceNodeUuid: 'entity-1',
        targetNodeUuid: 'entity-2',
        name: 'KNOWS',
        factIds: ['fact-1', 'fact-2'],
        episodes: ['episode-1', 'episode-2'],
        validAt: utcNow(),
        createdAt: utcNow(),
      };

      const edge = new EntityEdgeImpl(edgeData);

      assert.strictEqual(edge.uuid, 'edge-uuid-1');
      assert.strictEqual(edge.groupId, 'group-1');
      assert.strictEqual(edge.sourceNodeUuid, 'entity-1');
      assert.strictEqual(edge.targetNodeUuid, 'entity-2');
      assert.strictEqual(edge.name, 'KNOWS');
      assert.deepStrictEqual(edge.factIds, ['fact-1', 'fact-2']);
      assert.deepStrictEqual(edge.episodes, ['episode-1', 'episode-2']);
    });

    it('should validate entity edge schema', () => {
      const validData = {
        groupId: 'group-1',
        sourceNodeUuid: 'entity-1',
        targetNodeUuid: 'entity-2',
        name: 'WORKS_WITH',
        factIds: ['fact-3'],
        episodes: ['episode-3'],
        validAt: utcNow(),
      };

      const result = EntityEdgeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert(result.data?.createdAt instanceof Date);
    });

    it('should handle optional fields', () => {
      const edgeData = {
        uuid: 'edge-uuid-2',
        groupId: 'group-1',
        sourceNodeUuid: 'entity-3',
        targetNodeUuid: 'entity-4',
        name: 'RELATED_TO',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        invalidAt: new Date('2025-12-31'),
        expiredAt: new Date('2025-06-30'),
        createdAt: utcNow(),
      };

      const edge = new EntityEdgeImpl(edgeData);

      assert(edge.invalidAt);
      assert(edge.expiredAt);
      assert.strictEqual(edge.invalidAt.getFullYear(), 2025);
      assert.strictEqual(edge.expiredAt.getMonth(), 5);
    });

    it('should reject invalid entity edge data', () => {
      const invalidData = {
        groupId: 'group-1',
        sourceNodeUuid: 'entity-1',
      };

      const result = EntityEdgeSchema.safeParse(invalidData);
      assert(!result.success);
    });
  });

  describe('EpisodicEdge', () => {
    it('should create a valid episodic edge', () => {
      const edgeData = {
        uuid: 'episodic-edge-1',
        groupId: 'group-1',
        sourceNodeUuid: 'episode-1',
        targetNodeUuid: 'entity-1',
        createdAt: utcNow(),
      };

      const edge = new EpisodicEdgeImpl(edgeData);

      assert.strictEqual(edge.uuid, 'episodic-edge-1');
      assert.strictEqual(edge.groupId, 'group-1');
      assert.strictEqual(edge.sourceNodeUuid, 'episode-1');
      assert.strictEqual(edge.targetNodeUuid, 'entity-1');
    });

    it('should validate episodic edge schema', () => {
      const validData = {
        groupId: 'group-1',
        sourceNodeUuid: 'episode-2',
        targetNodeUuid: 'entity-2',
      };

      const result = EpisodicEdgeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert(result.data?.createdAt instanceof Date);
    });
  });

  describe('CommunityEdge', () => {
    it('should create a valid community edge', () => {
      const edgeData = {
        uuid: 'community-edge-1',
        groupId: 'group-1',
        sourceNodeUuid: 'community-1',
        targetNodeUuid: 'entity-1',
        name: 'HAS_MEMBER',
        description: 'Entity is a member of this community',
        factIds: ['fact-5', 'fact-6'],
        createdAt: utcNow(),
      };

      const edge = new CommunityEdgeImpl(edgeData);

      assert.strictEqual(edge.uuid, 'community-edge-1');
      assert.strictEqual(edge.groupId, 'group-1');
      assert.strictEqual(edge.sourceNodeUuid, 'community-1');
      assert.strictEqual(edge.targetNodeUuid, 'entity-1');
      assert.strictEqual(edge.name, 'HAS_MEMBER');
      assert.strictEqual(edge.description, 'Entity is a member of this community');
      assert.deepStrictEqual(edge.factIds, ['fact-5', 'fact-6']);
    });

    it('should validate community edge schema', () => {
      const validData = {
        groupId: 'group-1',
        sourceNodeUuid: 'community-2',
        targetNodeUuid: 'entity-2',
        name: 'HAS_MEMBER',
      };

      const result = CommunityEdgeSchema.safeParse(validData);
      assert(result.success);
      assert(result.data?.uuid);
      assert.strictEqual(result.data?.name, 'HAS_MEMBER');
    });

    it('should handle optional description and factIds', () => {
      const edgeData = {
        uuid: 'community-edge-2',
        groupId: 'group-1',
        sourceNodeUuid: 'community-3',
        targetNodeUuid: 'entity-3',
        name: 'HAS_MEMBER',
        createdAt: utcNow(),
      };

      const edge = new CommunityEdgeImpl(edgeData);

      assert.strictEqual(edge.description, undefined);
      assert.strictEqual(edge.factIds, undefined);
    });
  });

  describe('Edge UUID Generation', () => {
    it('should auto-generate UUID when not provided', () => {
      const edgeData = {
        groupId: 'group-1',
        sourceNodeUuid: 'entity-1',
        targetNodeUuid: 'entity-2',
        name: 'TEST_EDGE',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        createdAt: utcNow(),
      };

      const edge = new EntityEdgeImpl({ ...edgeData, uuid: '' });
      assert(edge.uuid);
      assert(edge.uuid.length > 0);
    });

    it('should use provided UUID when available', () => {
      const providedUuid = 'custom-edge-uuid-123';
      const edgeData = {
        uuid: providedUuid,
        groupId: 'group-1',
        sourceNodeUuid: 'entity-1',
        targetNodeUuid: 'entity-2',
        name: 'TEST_EDGE',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        createdAt: utcNow(),
      };

      const edge = new EntityEdgeImpl(edgeData);
      assert.strictEqual(edge.uuid, providedUuid);
    });
  });
});
