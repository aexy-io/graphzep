import OpenAI from 'openai';
import { BaseLLMClient } from './client';
export class OpenAIClient extends BaseLLMClient {
    client;
    constructor(config) {
        super(config);
        this.client = new OpenAI({
            apiKey: config.apiKey,
            baseURL: config.baseURL,
            organization: config.organization,
        });
    }
    async generateResponse(prompt, schema) {
        try {
            const completion = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.config.temperature ?? 0.7,
                max_tokens: this.config.maxTokens,
                top_p: this.config.topP,
                frequency_penalty: this.config.frequencyPenalty,
                presence_penalty: this.config.presencePenalty,
            });
            const content = completion.choices[0]?.message?.content || '';
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
                usage: completion.usage
                    ? {
                        promptTokens: completion.usage.prompt_tokens,
                        completionTokens: completion.usage.completion_tokens,
                        totalTokens: completion.usage.total_tokens,
                    }
                    : undefined,
                model: completion.model,
            };
        }
        catch (error) {
            console.error('OpenAI API error:', error);
            throw error;
        }
    }
    async generateStructuredResponse(prompt, schema) {
        try {
            const zodToJsonSchema = (schema) => {
                const def = schema._def;
                if (def.typeName === 'ZodObject') {
                    const properties = {};
                    const required = [];
                    for (const [key, value] of Object.entries(def.shape())) {
                        properties[key] = zodToJsonSchema(value);
                        if (!value.isOptional()) {
                            required.push(key);
                        }
                    }
                    return {
                        type: 'object',
                        properties,
                        required: required.length > 0 ? required : undefined,
                    };
                }
                else if (def.typeName === 'ZodString') {
                    return { type: 'string' };
                }
                else if (def.typeName === 'ZodNumber') {
                    return { type: 'number' };
                }
                else if (def.typeName === 'ZodBoolean') {
                    return { type: 'boolean' };
                }
                else if (def.typeName === 'ZodArray') {
                    return {
                        type: 'array',
                        items: zodToJsonSchema(def.type),
                    };
                }
                else if (def.typeName === 'ZodEnum') {
                    return {
                        type: 'string',
                        enum: def.values,
                    };
                }
                else if (def.typeName === 'ZodOptional') {
                    return zodToJsonSchema(def.innerType);
                }
                return { type: 'string' };
            };
            const completion = await this.client.chat.completions.create({
                model: this.config.model,
                messages: [{ role: 'user', content: prompt }],
                temperature: this.config.temperature ?? 0.7,
                max_tokens: this.config.maxTokens,
                response_format: {
                    type: 'json_object',
                },
                functions: [
                    {
                        name: 'response',
                        parameters: zodToJsonSchema(schema),
                    },
                ],
                function_call: { name: 'response' },
            });
            const functionCall = completion.choices[0]?.message?.function_call;
            if (!functionCall || !functionCall.arguments) {
                throw new Error('No function call in response');
            }
            const parsedArgs = JSON.parse(functionCall.arguments);
            return this.validateResponse(parsedArgs, schema);
        }
        catch (error) {
            console.error('OpenAI structured response error:', error);
            throw error;
        }
    }
}
