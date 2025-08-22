import neo4j from 'neo4j-driver';
import { BaseGraphDriver } from './driver';
import { GraphProvider } from '../types';
export class Neo4jDriver extends BaseGraphDriver {
    provider = GraphProvider.NEO4J;
    driver;
    session = null;
    constructor(uri, username, password, database = 'neo4j') {
        super(uri, username, password, database);
        this.driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
    }
    async executeQuery(query, params) {
        const session = this.getSession();
        try {
            const result = await session.run(this.formatQuery(query), params || {});
            return result.records.map((record) => record.toObject());
        }
        catch (error) {
            console.error('Neo4j query execution error:', error);
            throw error;
        }
    }
    async close() {
        if (this.session) {
            await this.session.close();
            this.session = null;
        }
        await this.driver.close();
    }
    getSession() {
        if (!this.session) {
            this.session = this.driver.session({
                database: this.database,
                defaultAccessMode: neo4j.session.WRITE,
            });
        }
        return this.session;
    }
    async verifyConnectivity() {
        try {
            await this.driver.verifyConnectivity();
            console.log('Neo4j connection verified successfully');
        }
        catch (error) {
            console.error('Neo4j connection verification failed:', error);
            throw error;
        }
    }
    async createIndexes() {
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
            }
            catch (error) {
                console.warn(`Index creation warning: ${error}`);
            }
        }
    }
}
