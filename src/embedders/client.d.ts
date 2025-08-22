export interface EmbedderConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}
export declare abstract class BaseEmbedderClient {
  protected config: EmbedderConfig;
  constructor(config?: EmbedderConfig);
  abstract embed(text: string): Promise<number[]>;
  abstract embedBatch(texts: string[]): Promise<number[][]>;
  protected batchProcess<T>(
    items: T[],
    processor: (batch: T[]) => Promise<any[]>,
    batchSize?: number,
  ): Promise<any[]>;
  protected normalizeVector(vector: number[]): number[];
}
