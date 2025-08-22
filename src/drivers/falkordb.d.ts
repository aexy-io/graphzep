import { BaseGraphDriver } from './driver';
import { GraphProvider } from '../types';
export declare class FalkorDBDriver extends BaseGraphDriver {
  provider: GraphProvider;
  private client;
  private graph;
  constructor(uri: string, username?: string, password?: string, database?: string);
  connect(): Promise<void>;
  executeQuery<T = any>(query: string, params?: Record<string, any>): Promise<T>;
  close(): Promise<void>;
  private formatQueryWithParams;
  private parseResults;
  private parseValue;
  createIndexes(): Promise<void>;
}
