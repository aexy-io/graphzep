export interface EmbedderConfig {
  apiKey?: string;
  model?: string;
  dimensions?: number;
  batchSize?: number;
}

export abstract class BaseEmbedderClient {
  protected config: EmbedderConfig;

  constructor(config: EmbedderConfig = {}) {
    this.config = config;
  }

  abstract embed(text: string): Promise<number[]>;

  abstract embedBatch(texts: string[]): Promise<number[][]>;

  protected async batchProcess<T>(
    items: T[],
    processor: (batch: T[]) => Promise<any[]>,
    batchSize: number = 100,
  ): Promise<any[]> {
    const results: any[] = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchResults = await processor(batch);
      results.push(...batchResults);
    }

    return results;
  }

  protected normalizeVector(vector: number[]): number[] {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    return magnitude > 0 ? vector.map((val) => val / magnitude) : vector;
  }
}
