export class BaseLLMClient {
    config;
    constructor(config) {
        this.config = config;
    }
    validateResponse(response, schema) {
        const result = schema.safeParse(response);
        if (!result.success) {
            throw new Error(`Schema validation failed: ${result.error.message}`);
        }
        return result.data;
    }
}
//# sourceMappingURL=client.js.map