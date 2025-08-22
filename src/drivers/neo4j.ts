import neo4j, { Driver } from 'neo4j-driver';
import { BaseGraphDriver } from './driver.js';
import { GraphProvider } from '../types/index.js';

export class Neo4jDriver extends BaseGraphDriver {
  provider = GraphProvider.NEO4J;
  private driver: Driver;

  constructor(uri: string, username: string, password: string, database: string = 'neo4j') {
    super(uri, username, password, database);
    this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  }

  async executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T> {
    // Create a new session for each query to avoid transaction conflicts
    const session = this.driver.session({
      database: this.database,
      defaultAccessMode: neo4j.session.WRITE,
    });

    try {
      // Convert numeric parameters to integers for Neo4j compatibility
      const processedParams = params
        ? Object.entries(params).reduce(
            (acc, [key, value]) => {
              // Convert 'limit' and other integer-like parameters to integers
              if (
                (key === 'limit' || key === 'skip' || key === 'offset') &&
                typeof value === 'number'
              ) {
                acc[key] = neo4j.int(Math.floor(value));
              } else {
                acc[key] = value;
              }
              return acc;
            },
            {} as Record<string, any>,
          )
        : {};

      const result = await session.run(this.formatQuery(query), processedParams);
      return result.records.map((record) => record.toObject()) as T;
    } catch (error) {
      console.error('Neo4j query execution error:', error);
      throw error;
    } finally {
      // Always close the session
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
  }

  async verifyConnectivity(): Promise<void> {
    try {
      await this.driver.verifyConnectivity();
      console.log('Neo4j connection verified successfully');
    } catch (error) {
      console.error('Neo4j connection verification failed:', error);
      throw error;
    }
  }

  async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX entity_uuid IF NOT EXISTS FOR (n:Entity) ON (n.uuid)',
      'CREATE INDEX entity_group IF NOT EXISTS FOR (n:Entity) ON (n.groupId)',
      'CREATE INDEX episodic_uuid IF NOT EXISTS FOR (n:Episodic) ON (n.uuid)',
      'CREATE INDEX episodic_group IF NOT EXISTS FOR (n:Episodic) ON (n.groupId)',
      'CREATE INDEX community_uuid IF NOT EXISTS FOR (n:Community) ON (n.uuid)',
      'CREATE INDEX community_group IF NOT EXISTS FOR (n:Community) ON (n.groupId)',
    ];

    for (const index of indexes) {
      try {
        await this.executeQuery(index);
      } catch (error) {
        console.warn(`Index creation warning: ${error}`);
      }
    }
  }
}
