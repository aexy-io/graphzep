import { createClient, Graph } from 'redis';
import { BaseGraphDriver } from './driver';
import { GraphProvider } from '../types';
export class FalkorDBDriver extends BaseGraphDriver {
    provider = GraphProvider.FALKORDB;
    client;
    graph;
    constructor(uri, username = '', password = '', database = 'default_db') {
        super(uri, username, password, database);
        const url = new URL(uri);
        this.client = createClient({
            socket: {
                host: url.hostname,
                port: parseInt(url.port || '6379'),
            },
            ...(password && { password }),
        });
        this.graph = new Graph(this.client, database);
    }
    async connect() {
        if (!this.client.isOpen) {
            await this.client.connect();
        }
    }
    async executeQuery(query, params) {
        await this.connect();
        try {
            const formattedQuery = this.formatQueryWithParams(query, params);
            const result = await this.graph.query(formattedQuery);
            return this.parseResults(result);
        }
        catch (error) {
            console.error('FalkorDB query execution error:', error);
            throw error;
        }
    }
    async close() {
        if (this.client.isOpen) {
            await this.client.quit();
        }
    }
    formatQueryWithParams(query, params) {
        if (!params)
            return query;
        let formattedQuery = query;
        for (const [key, value] of Object.entries(params)) {
            const placeholder = `$${key}`;
            let formattedValue;
            if (value === null || value === undefined) {
                formattedValue = 'null';
            }
            else if (typeof value === 'string') {
                formattedValue = `'${value.replace(/'/g, "\\'")}'`;
            }
            else if (Array.isArray(value)) {
                formattedValue = `[${value.map((v) => (typeof v === 'string' ? `'${v}'` : v)).join(', ')}]`;
            }
            else if (value instanceof Date) {
                formattedValue = `'${value.toISOString()}'`;
            }
            else {
                formattedValue = String(value);
            }
            formattedQuery = formattedQuery.replace(new RegExp(`\\${placeholder}`, 'g'), formattedValue);
        }
        return formattedQuery;
    }
    parseResults(result) {
        if (!result || !result.data)
            return [];
        return result.data.map((row) => {
            const parsed = {};
            row.forEach((value, index) => {
                const key = result.headers[index];
                parsed[key] = this.parseValue(value);
            });
            return parsed;
        });
    }
    parseValue(value) {
        if (value && typeof value === 'object') {
            if (value.properties) {
                return { ...value.properties, labels: value.labels };
            }
            if (Array.isArray(value)) {
                return value.map((v) => this.parseValue(v));
            }
        }
        return value;
    }
    async createIndexes() {
        const indexes = [
            'CREATE INDEX ON :Entity(uuid)',
            'CREATE INDEX ON :Entity(groupId)',
            'CREATE INDEX ON :Episodic(uuid)',
            'CREATE INDEX ON :Episodic(groupId)',
            'CREATE INDEX ON :Community(uuid)',
            'CREATE INDEX ON :Community(groupId)',
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
