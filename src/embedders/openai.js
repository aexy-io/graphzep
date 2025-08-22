import OpenAI from 'openai';
import { BaseEmbedderClient } from './client';
export class OpenAIEmbedder extends BaseEmbedderClient {
    client;
    model;
    constructor(config) {
        super(config);
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            organization: config.organization,
        });
        this.model = config.model || 'text-embedding-3-small';
    }
    async embed(text) {
        try {
            const response = await this.client.embeddings.create({
                model: this.model,
                input: text,
                dimensions: this.config.dimensions,
            });
            return response.data[0].embedding;
        }
        catch (error) {
            console.error('OpenAI embedding error:', error);
            throw error;
        }
    }
    async embedBatch(texts) {
        if (texts.length === 0) {
            return [];
        }
        const batchSize = this.config.batchSize || 100;
        return this.batchProcess(texts, async (batch) => {
            try {
                const response = await this.client.embeddings.create({
                    model: this.model,
                    input: batch,
                    dimensions: this.config.dimensions,
                });
                return response.data.map((item) => item.embedding);
            }
            catch (error) {
                console.error('OpenAI batch embedding error:', error);
                throw error;
            }
        }, batchSize);
    }
}
