import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import * as dotenv from 'dotenv';
import { Neo4jDriver } from '../../drivers/neo4j.js';
import { EntityNodeImpl, EpisodicNodeImpl } from '../../core/nodes.js';
import { EntityEdgeImpl } from '../../core/edges.js';
import { EpisodeType } from '../../types/index.js';
import { utcNow } from '../../utils/datetime.js';

// Load environment variables
dotenv.config();

describe('Neo4j Integration Tests', { skip: !process.env.NEO4J_URI }, () => {
  let driver: Neo4jDriver;
  const testGroupId = `test-group-${Date.now()}`;

  before(async () => {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const username = process.env.NEO4J_USERNAME || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'password';

    driver = new Neo4jDriver(uri, username, password);
    await driver.verifyConnectivity();
    await driver.createIndexes();
  });

  after(async () => {
    await driver.executeQuery(
      `
      MATCH (n {groupId: $groupId})
      DETACH DELETE n
      `,
      { groupId: testGroupId },
    );
    await driver.close();
  });

  describe('Node Operations', () => {
    it('should create and retrieve an entity node', async () => {
      const entity = new EntityNodeImpl({
        uuid: `entity-${Date.now()}`,
        name: 'Test Entity',
        groupId: testGroupId,
        entityType: 'TestType',
        summary: 'A test entity for integration testing',
        summaryEmbedding: [0.1, 0.2, 0.3],
        factIds: ['fact-1', 'fact-2'],
        labels: [],
        createdAt: utcNow(),
      });

      await entity.save(driver);

      const result = await driver.executeQuery<any[]>(
        `
        MATCH (n:Entity {uuid: $uuid})
        RETURN n
        `,
        { uuid: entity.uuid },
      );

      assert.strictEqual(result.length, 1);
      const retrieved = result[0].n;
      assert.strictEqual(retrieved.properties.name, 'Test Entity');
      assert.strictEqual(retrieved.properties.entityType, 'TestType');
      assert.strictEqual(retrieved.properties.groupId, testGroupId);
      assert.deepStrictEqual(retrieved.properties.factIds, ['fact-1', 'fact-2']);
    });

    it('should create and retrieve an episodic node', async () => {
      const episode = new EpisodicNodeImpl({
        uuid: `episode-${Date.now()}`,
        name: 'Test Episode',
        groupId: testGroupId,
        episodeType: EpisodeType.MESSAGE,
        content: 'user: This is a test message',
        embedding: [0.4, 0.5, 0.6],
        validAt: utcNow(),
        referenceId: 'ref-123',
        labels: [],
        createdAt: utcNow(),
      });

      await episode.save(driver);

      const result = await driver.executeQuery<any[]>(
        `
        MATCH (n:Episodic {uuid: $uuid})
        RETURN n
        `,
        { uuid: episode.uuid },
      );

      assert.strictEqual(result.length, 1);
      const retrieved = result[0].n;
      assert.strictEqual(retrieved.properties.content, 'user: This is a test message');
      assert.strictEqual(retrieved.properties.episodeType, EpisodeType.MESSAGE);
      assert.strictEqual(retrieved.properties.referenceId, 'ref-123');
    });

    it('should delete a node', async () => {
      const entity = new EntityNodeImpl({
        uuid: `delete-entity-${Date.now()}`,
        name: 'To Delete',
        groupId: testGroupId,
        entityType: 'Temporary',
        summary: 'Will be deleted',
        labels: [],
        createdAt: utcNow(),
      });

      await entity.save(driver);

      let result = await driver.executeQuery<any[]>(
        `
        MATCH (n:Entity {uuid: $uuid})
        RETURN n
        `,
        { uuid: entity.uuid },
      );
      assert.strictEqual(result.length, 1);

      await entity.delete(driver);

      result = await driver.executeQuery<any[]>(
        `
        MATCH (n:Entity {uuid: $uuid})
        RETURN n
        `,
        { uuid: entity.uuid },
      );
      assert.strictEqual(result.length, 0);
    });
  });

  describe('Edge Operations', () => {
    it('should create and retrieve an entity edge', async () => {
      const source = new EntityNodeImpl({
        uuid: `source-${Date.now()}`,
        name: 'Source Entity',
        groupId: testGroupId,
        entityType: 'Person',
        summary: 'Source person',
        labels: [],
        createdAt: utcNow(),
      });

      const target = new EntityNodeImpl({
        uuid: `target-${Date.now()}`,
        name: 'Target Entity',
        groupId: testGroupId,
        entityType: 'Person',
        summary: 'Target person',
        labels: [],
        createdAt: utcNow(),
      });

      await source.save(driver);
      await target.save(driver);

      const edge = new EntityEdgeImpl({
        uuid: `edge-${Date.now()}`,
        groupId: testGroupId,
        sourceNodeUuid: source.uuid,
        targetNodeUuid: target.uuid,
        name: 'KNOWS',
        factIds: ['fact-3'],
        episodes: ['episode-1'],
        validAt: utcNow(),
        createdAt: utcNow(),
      });

      await edge.save(driver);

      const result = await driver.executeQuery<any[]>(
        `
        MATCH (s:Entity {uuid: $sourceUuid})-[r:RELATES_TO {uuid: $edgeUuid}]->(t:Entity {uuid: $targetUuid})
        RETURN r
        `,
        {
          sourceUuid: source.uuid,
          targetUuid: target.uuid,
          edgeUuid: edge.uuid,
        },
      );

      assert.strictEqual(result.length, 1);
      const retrieved = result[0].r;
      assert.strictEqual(retrieved.properties.name, 'KNOWS');
      assert.deepStrictEqual(retrieved.properties.factIds, ['fact-3']);
      assert.deepStrictEqual(retrieved.properties.episodes, ['episode-1']);
    });

    it('should delete an edge', async () => {
      const source = new EntityNodeImpl({
        uuid: `del-source-${Date.now()}`,
        name: 'Source',
        groupId: testGroupId,
        entityType: 'Test',
        summary: 'Source',
        labels: [],
        createdAt: utcNow(),
      });

      const target = new EntityNodeImpl({
        uuid: `del-target-${Date.now()}`,
        name: 'Target',
        groupId: testGroupId,
        entityType: 'Test',
        summary: 'Target',
        labels: [],
        createdAt: utcNow(),
      });

      await source.save(driver);
      await target.save(driver);

      const edge = new EntityEdgeImpl({
        uuid: `del-edge-${Date.now()}`,
        groupId: testGroupId,
        sourceNodeUuid: source.uuid,
        targetNodeUuid: target.uuid,
        name: 'TEMP',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        createdAt: utcNow(),
      });

      await edge.save(driver);

      let result = await driver.executeQuery<any[]>(
        `
        MATCH ()-[r:RELATES_TO {uuid: $uuid}]->()
        RETURN r
        `,
        { uuid: edge.uuid },
      );
      assert.strictEqual(result.length, 1);

      await edge.delete(driver);

      result = await driver.executeQuery<any[]>(
        `
        MATCH ()-[r:RELATES_TO {uuid: $uuid}]->()
        RETURN r
        `,
        { uuid: edge.uuid },
      );
      assert.strictEqual(result.length, 0);
    });
  });

  describe('Query Operations', () => {
    it('should find nodes by property', async () => {
      const entity1 = new EntityNodeImpl({
        uuid: `search-1-${Date.now()}`,
        name: 'Alice',
        groupId: testGroupId,
        entityType: 'Person',
        summary: 'First person',
        labels: [],
        createdAt: utcNow(),
      });

      const entity2 = new EntityNodeImpl({
        uuid: `search-2-${Date.now()}`,
        name: 'Alice',
        groupId: testGroupId,
        entityType: 'Person',
        summary: 'Second person',
        labels: [],
        createdAt: utcNow(),
      });

      await entity1.save(driver);
      await entity2.save(driver);

      const result = await driver.executeQuery<any[]>(
        `
        MATCH (n:Entity {name: $name, groupId: $groupId})
        RETURN n
        ORDER BY n.uuid
        `,
        { name: 'Alice', groupId: testGroupId },
      );

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].n.properties.name, 'Alice');
      assert.strictEqual(result[1].n.properties.name, 'Alice');
    });

    it('should find connected nodes', async () => {
      const hub = new EntityNodeImpl({
        uuid: `hub-${Date.now()}`,
        name: 'Hub',
        groupId: testGroupId,
        entityType: 'Hub',
        summary: 'Central hub',
        labels: [],
        createdAt: utcNow(),
      });

      const spoke1 = new EntityNodeImpl({
        uuid: `spoke1-${Date.now()}`,
        name: 'Spoke1',
        groupId: testGroupId,
        entityType: 'Spoke',
        summary: 'First spoke',
        labels: [],
        createdAt: utcNow(),
      });

      const spoke2 = new EntityNodeImpl({
        uuid: `spoke2-${Date.now()}`,
        name: 'Spoke2',
        groupId: testGroupId,
        entityType: 'Spoke',
        summary: 'Second spoke',
        labels: [],
        createdAt: utcNow(),
      });

      await hub.save(driver);
      await spoke1.save(driver);
      await spoke2.save(driver);

      const edge1 = new EntityEdgeImpl({
        uuid: `hub-edge1-${Date.now()}`,
        groupId: testGroupId,
        sourceNodeUuid: hub.uuid,
        targetNodeUuid: spoke1.uuid,
        name: 'CONNECTS',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        createdAt: utcNow(),
      });

      const edge2 = new EntityEdgeImpl({
        uuid: `hub-edge2-${Date.now()}`,
        groupId: testGroupId,
        sourceNodeUuid: hub.uuid,
        targetNodeUuid: spoke2.uuid,
        name: 'CONNECTS',
        factIds: [],
        episodes: [],
        validAt: utcNow(),
        createdAt: utcNow(),
      });

      await edge1.save(driver);
      await edge2.save(driver);

      const result = await driver.executeQuery<any[]>(
        `
        MATCH (hub:Entity {uuid: $hubUuid})-[:RELATES_TO]->(connected)
        RETURN connected
        ORDER BY connected.name
        `,
        { hubUuid: hub.uuid },
      );

      assert.strictEqual(result.length, 2);
      assert.strictEqual(result[0].connected.properties.name, 'Spoke1');
      assert.strictEqual(result[1].connected.properties.name, 'Spoke2');
    });
  });
});
