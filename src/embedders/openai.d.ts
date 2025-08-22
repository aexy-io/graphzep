import { BaseEmbedderClient, EmbedderConfig } from './client';
export interface OpenAIEmbedderConfig extends EmbedderConfig {
  apiKey: string;
  baseURL?: string;
  organization?: string;
}
export declare class OpenAIEmbedder extends BaseEmbedderClient {
  private client;
  private model;
  constructor(config: OpenAIEmbedderConfig);
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
