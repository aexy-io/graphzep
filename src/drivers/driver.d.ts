import { GraphDriver, GraphProvider } from '../types';
export declare abstract class BaseGraphDriver implements GraphDriver {
  protected uri: string;
  protected username: string;
  protected password: string;
  protected database?: string | undefined;
  abstract provider: GraphProvider;
  constructor(uri: string, username: string, password: string, database?: string | undefined);
  abstract executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  abstract close(): Promise<void>;
  protected formatQuery(query: string): string;
}
