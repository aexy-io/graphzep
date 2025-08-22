import { z } from 'zod';
import { BaseLLMClient, LLMConfig, LLMResponse } from './client';
export interface AnthropicConfig extends LLMConfig {
  apiKey: string;
  baseURL?: string;
}
export declare class AnthropicClient extends BaseLLMClient {
  private client;
  constructor(config: AnthropicConfig);
  generateResponse<T = string>(prompt: string, schema?: z.ZodSchema<T>): Promise<LLMResponse<T>>;
  generateStructuredResponse<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;
}
