import Anthropic from '@anthropic-ai/sdk';
import { BaseLLMClient } from './client';
export class AnthropicClient extends BaseLLMClient {
    client;
    constructor(config) {
        super(config);
        this.client = new Anthropic({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
        });
    }
    async generateResponse(prompt, schema) {
        try {
            const response = await this.client.messages.create({
                model: this.config.model || 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens || 4096,
                temperature: this.config.temperature ?? 0.7,
                top_p: this.config.topP,
                messages: [{ role: 'user', content: prompt }],
            });
            const content = response.content[0].type === 'text' ? response.content[0].text : '';
            let parsedContent;
            if (schema) {
                try {
                    const jsonContent = JSON.parse(content);
                    parsedContent = this.validateResponse(jsonContent, schema);
                }
                catch (error) {
                    throw new Error(`Failed to parse response as JSON: ${error}`);
                }
            }
            else {
                parsedContent = content;
            }
            return {
                content: parsedContent,
                usage: response.usage
                    ? {
                        promptTokens: response.usage.input_tokens,
                        completionTokens: response.usage.output_tokens,
                        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
                    }
                    : undefined,
                model: response.model,
            };
        }
        catch (error) {
            console.error('Anthropic API error:', error);
            throw error;
        }
    }
    async generateStructuredResponse(prompt, schema) {
        const systemPrompt = `You are a helpful assistant that always responds with valid JSON matching the requested schema.

    Schema:
    ${JSON.stringify(schema._def, null, 2)}

    Important: Your response must be valid JSON that matches this schema exactly.`;
        try {
            const response = await this.client.messages.create({
                model: this.config.model || 'claude-3-opus-20240229',
                max_tokens: this.config.maxTokens || 4096,
                temperature: this.config.temperature ?? 0.7,
                system: systemPrompt,
                messages: [{ role: 'user', content: prompt }],
            });
            const content = response.content[0].type === 'text' ? response.content[0].text : '';
            const jsonContent = JSON.parse(content);
            return this.validateResponse(jsonContent, schema);
        }
        catch (error) {
            console.error('Anthropic structured response error:', error);
            throw error;
        }
    }
}
