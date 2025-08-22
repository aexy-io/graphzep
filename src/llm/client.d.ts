import { z } from 'zod';
export interface LLMConfig {
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  timeout?: number;
}
export interface LLMResponse<T = any> {
  content: T;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}
export declare abstract class BaseLLMClient {
  protected config: LLMConfig;
  constructor(config: LLMConfig);
  abstract generateResponse<T = string>(
    prompt: string,
    schema?: z.ZodSchema<T>,
  ): Promise<LLMResponse<T>>;
  abstract generateStructuredResponse<T>(prompt: string, schema: z.ZodSchema<T>): Promise<T>;
  protected validateResponse<T>(response: any, schema: z.ZodSchema<T>): T;
}
