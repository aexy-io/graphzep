import { describe, it } from 'node:test';
import assert from 'node:assert';
import { EpisodeType } from '../types/index.js';
import { EntityNodeImpl, EpisodicNodeImpl } from '../core/nodes.js';
import { utcNow } from '../utils/datetime.js';

describe('Core Types and Schemas', () => {
  describe('EpisodeType', () => {
    it('should have correct values', () => {
      assert.strictEqual(EpisodeType.MESSAGE, 'message');
      assert.strictEqual(EpisodeType.JSON, 'json');
      assert.strictEqual(EpisodeType.TEXT, 'text');
    });
  });

  describe('EntityNode Creation', () => {
    it('should create entity node with required properties', () => {
      const nodeData = {
        uuid: 'test-uuid',
        name: 'Test Entity',
        groupId: 'group-1',
        entityType: 'Person',
        summary: 'A test entity',
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EntityNodeImpl(nodeData);

      assert.strictEqual(node.uuid, 'test-uuid');
      assert.strictEqual(node.name, 'Test Entity');
      assert.strictEqual(node.entityType, 'Person');
      assert(node.labels.includes('Entity'));
    });
  });

  describe('EpisodicNode Creation', () => {
    it('should create episodic node with required properties', () => {
      const nodeData = {
        uuid: 'episode-uuid',
        name: 'Test Episode',
        groupId: 'group-1',
        episodeType: EpisodeType.TEXT,
        content: 'This is test content',
        validAt: utcNow(),
        labels: [],
        createdAt: utcNow(),
      };

      const node = new EpisodicNodeImpl(nodeData);

      assert.strictEqual(node.uuid, 'episode-uuid');
      assert.strictEqual(node.content, 'This is test content');
      assert.strictEqual(node.episodeType, EpisodeType.TEXT);
      assert(node.labels.includes('Episodic'));
    });
  });

  describe('Date Utilities', () => {
    it('should create current UTC date', () => {
      const now = utcNow();
      const currentTime = new Date();

      assert(now instanceof Date);
      assert(Math.abs(now.getTime() - currentTime.getTime()) < 1000);
    });
  });
});
