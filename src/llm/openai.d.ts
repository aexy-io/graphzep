import { z } from 'zod';
import { BaseLLMClient, LLMConfig, LLMResponse } from './client';
export interface OpenAIConfig extends LLMConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}
export declare class OpenAIClient extends BaseLLMClient {
  private client;
  constructor(config: OpenAIConfig);
  generateResponse<T = string>(prompt: string, schema?: z.ZodSchema<T>): Promise<LLMResponse<T>>;
  generateStructuredResponse<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;
}
