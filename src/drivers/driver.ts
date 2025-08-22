import { GraphDriver, GraphProvider } from '../types/index.js';

export abstract class BaseGraphDriver implements GraphDriver {
  abstract provider: GraphProvider;

  constructor(
    protected uri: string,
    protected username: string,
    protected password: string,
    protected database?: string,
  ) {}

  abstract executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  abstract close(): Promise<void>;
  abstract createIndexes(): Promise<void>;

  protected formatQuery(query: string): string {
    return query.trim().replace(/\s+/g, ' ');
  }
}
