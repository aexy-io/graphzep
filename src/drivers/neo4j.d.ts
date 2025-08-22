import { BaseGraphDriver } from './driver';
import { GraphProvider } from '../types';
export declare class Neo4jDriver extends BaseGraphDriver {
  provider: GraphProvider;
  private driver;
  private session;
  constructor(uri: string, username: string, password: string, database?: string);
  executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  close(): Promise<void>;
  private getSession;
  verifyConnectivity(): Promise<void>;
  createIndexes(): Promise<void>;
}
