import { describe, it, before, after, mock } from 'node:test';
import assert from 'node:assert';
import { Graphzep } from '../graphzep.js';
import { GraphProvider, EpisodeType } from '../types/index.js';
import { EntityNodeImpl, EpisodicNodeImpl } from '../core/nodes.js';
import { EntityEdgeImpl, EpisodicEdgeImpl } from '../core/edges.js';

describe('Graphzep Core', () => {
  const mockDriver = {
    provider: GraphProvider.NEO4J,
    executeQuery: mock.fn(async (...args: any[]): Promise<any[]> => []),
    close: mock.fn(async () => {}),
  };

  const mockLLMClient = {
    generateResponse: mock.fn(async () => ({ content: 'test response' })),
    generateStructuredResponse: mock.fn(async () => ({
      entities: [
        { name: 'Alice', entityType: 'Person', summary: 'A person named Alice' },
        { name: 'Bob', entityType: 'Person', summary: 'A person named Bob' },
      ],
      relations: [{ sourceName: 'Alice', targetName: 'Bob', relationName: 'KNOWS' }],
    })),
  };

  const mockEmbedder = {
    embed: mock.fn(async () => new Array(384).fill(0.1)),
    embedBatch: mock.fn(async (texts: string[]) => texts.map(() => new Array(384).fill(0.1))),
  };

  let graphzep: Graphzep;

  before(() => {
    graphzep = new Graphzep({
      driver: mockDriver as any,
      llmClient: mockLLMClient as any,
      embedder: mockEmbedder as any,
      groupId: 'test-group',
    });
  });

  after(async () => {
    await graphzep.close();
  });

  describe('addEpisode', () => {
    it('should add an episode and extract entities', async () => {
      const episodeContent = 'Alice met Bob at the conference.';

      mockDriver.executeQuery.mock.mockImplementation(async (query: string, params?: any) => {
        if (query.includes('MATCH (n:Entity')) {
          return [];
        }
        if (query.includes('MATCH (s:Entity')) {
          return [];
        }
        return [];
      });

      const episode = await graphzep.addEpisode({
        content: episodeContent,
        episodeType: EpisodeType.TEXT,
      });

      assert(episode instanceof EpisodicNodeImpl);
      assert.strictEqual(episode.content, episodeContent);
      assert.strictEqual(episode.episodeType, EpisodeType.TEXT);
      assert.strictEqual(episode.groupId, 'test-group');

      assert(mockLLMClient.generateStructuredResponse.mock.calls.length > 0);

      assert(mockEmbedder.embed.mock.calls.length > 0);
      const embedCall = mockEmbedder.embed.mock.calls[0] as any;
      assert.strictEqual(embedCall.arguments[0], episodeContent);
    });

    it('should link episode to existing entities', async () => {
      const episodeContent = 'Alice and Bob had lunch together.';

      const existingAlice = {
        uuid: 'alice-uuid',
        name: 'Alice',
        entityType: 'Person',
        summary: 'A person named Alice',
        groupId: 'test-group',
        labels: ['Entity'],
        createdAt: new Date(),
      };

      (mockDriver.executeQuery as any).mock.mockImplementation(
        async (query: string, params: any) => {
          if (query.includes('MATCH (n:Entity') && params?.name === 'Alice') {
            return [{ n: existingAlice }];
          }
          return [];
        },
      );

      const episode = await graphzep.addEpisode({
        content: episodeContent,
        referenceId: 'ref-123',
      });

      assert.strictEqual(episode.referenceId, 'ref-123');
    });

    it('should handle custom group ID', async () => {
      const customGroupId = 'custom-group';

      (mockDriver.executeQuery as any).mock.mockImplementation(async () => []);

      const episode = await graphzep.addEpisode({
        content: 'Test content',
        groupId: customGroupId,
      });

      assert.strictEqual(episode.groupId, customGroupId);
    });
  });

  describe('search', () => {
    it('should search for nodes by similarity', async () => {
      const searchQuery = 'Find information about Alice';

      const mockSearchResults = [
        {
          n: {
            uuid: 'alice-uuid',
            name: 'Alice',
            entityType: 'Person',
            summary: 'A person named Alice',
            groupId: 'test-group',
            createdAt: new Date(),
            embedding: new Array(384).fill(0.1),
          },
          labels: ['Entity'],
        },
      ];

      (mockDriver.executeQuery as any).mock.mockImplementation(async (query: string) => {
        if (query.includes('similarity')) {
          return mockSearchResults;
        }
        return [];
      });

      const results = await graphzep.search({
        query: searchQuery,
        limit: 5,
      });

      assert.strictEqual(results.length, 1);
      assert(results[0] instanceof EntityNodeImpl);
      assert.strictEqual(results[0].name, 'Alice');

      assert(mockEmbedder.embed.mock.calls.length > 0);
    });

    it('should handle empty search results', async () => {
      (mockDriver.executeQuery as any).mock.mockImplementation(async () => []);

      const results = await graphzep.search({
        query: 'Non-existent entity',
      });

      assert.strictEqual(results.length, 0);
    });

    it('should use custom group ID in search', async () => {
      const customGroupId = 'search-group';

      (mockDriver.executeQuery as any).mock.mockImplementation(
        async (query: string, params: any) => {
          assert.strictEqual(params?.groupId, customGroupId);
          return [];
        },
      );

      await graphzep.search({
        query: 'Test search',
        groupId: customGroupId,
      });
    });
  });

  describe('node operations', () => {
    it('should get node by UUID', async () => {
      const nodeData = {
        uuid: 'test-uuid',
        name: 'Test Entity',
        entityType: 'Test',
        summary: 'A test entity',
        groupId: 'test-group',
        labels: ['Entity'],
        createdAt: new Date(),
      };

      (mockDriver.executeQuery as any).mock.mockImplementation(async () => [{ n: nodeData }]);

      const node = await graphzep.getNode('test-uuid');

      assert(node instanceof EntityNodeImpl);
      assert.strictEqual(node?.uuid, 'test-uuid');
      assert.strictEqual(node?.name, 'Test Entity');
    });

    it('should return null for non-existent node', async () => {
      (mockDriver.executeQuery as any).mock.mockImplementation(async () => []);

      const node = await graphzep.getNode('non-existent');

      assert.strictEqual(node, null);
    });

    it('should delete node by UUID', async () => {
      const nodeData = {
        uuid: 'delete-uuid',
        name: 'To Delete',
        entityType: 'Test',
        summary: 'Entity to delete',
        groupId: 'test-group',
        labels: ['Entity'],
        createdAt: new Date(),
      };

      (mockDriver.executeQuery as any).mock.mockImplementation(async (query: string) => {
        if (query.includes('RETURN n')) {
          return [{ n: nodeData }];
        }
        return [];
      });

      await graphzep.deleteNode('delete-uuid');

      const deleteCalls = (mockDriver.executeQuery as any).mock.calls.filter((call: any) =>
        call.arguments[0].includes('DELETE'),
      );
      assert(deleteCalls.length > 0);
    });
  });

  describe('edge operations', () => {
    it('should get edge by UUID', async () => {
      const edgeData = {
        uuid: 'edge-uuid',
        groupId: 'test-group',
        sourceNodeUuid: 'source-uuid',
        targetNodeUuid: 'target-uuid',
        name: 'RELATES_TO',
        factIds: [],
        episodes: [],
        validAt: new Date(),
        createdAt: new Date(),
      };

      (mockDriver.executeQuery as any).mock.mockImplementation(async () => [
        { e: edgeData, relType: 'RELATES_TO' },
      ]);

      const edge = await graphzep.getEdge('edge-uuid');

      assert(edge instanceof EntityEdgeImpl);
      assert.strictEqual(edge?.uuid, 'edge-uuid');
    });

    it('should return null for non-existent edge', async () => {
      (mockDriver.executeQuery as any).mock.mockImplementation(async () => []);

      const edge = await graphzep.getEdge('non-existent');

      assert.strictEqual(edge, null);
    });

    it('should delete edge by UUID', async () => {
      const edgeData = {
        uuid: 'delete-edge-uuid',
        groupId: 'test-group',
        sourceNodeUuid: 'source-uuid',
        targetNodeUuid: 'target-uuid',
        createdAt: new Date(),
      };

      (mockDriver.executeQuery as any).mock.mockImplementation(async (query: string) => {
        if (query.includes('RETURN e')) {
          return [{ e: edgeData, relType: 'MENTIONS' }];
        }
        return [];
      });

      await graphzep.deleteEdge('delete-edge-uuid');

      const deleteCalls = (mockDriver.executeQuery as any).mock.calls.filter((call: any) =>
        call.arguments[0].includes('DELETE'),
      );
      assert(deleteCalls.length > 0);
    });
  });

  describe('close', () => {
    it('should close the driver connection', async () => {
      await graphzep.close();

      assert(mockDriver.close.mock.calls.length > 0);
    });
  });
});
