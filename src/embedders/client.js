export class BaseEmbedderClient {
    config;
    constructor(config = {}) {
        this.config = config;
    }
    async batchProcess(items, processor, batchSize = 100) {
        const results = [];
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await processor(batch);
            results.push(...batchResults);
        }
        return results;
    }
    normalizeVector(vector) {
        const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
    }
}
//# sourceMappingURL=client.js.map