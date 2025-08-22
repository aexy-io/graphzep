import { z } from 'zod';
import { MessageSchema } from './common.js';

export const SearchQuerySchema = z.object({
  group_ids: z.array(z.string()).optional().describe('The group ids for the memories to search'),
  query: z.string(),
  max_facts: z.number().default(10).describe('The maximum number of facts to retrieve'),
});

export const FactResultSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  fact: z.string(),
  valid_at: z.string().datetime().nullable(),
  invalid_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  expired_at: z.string().datetime().nullable(),
});

export const SearchResultsSchema = z.object({
  facts: z.array(FactResultSchema),
});

export const GetMemoryRequestSchema = z.object({
  group_id: z.string().describe('The group id of the memory to get'),
  max_facts: z.number().default(10).describe('The maximum number of facts to retrieve'),
  center_node_uuid: z.string().optional().describe('The uuid of the node to center the retrieval on'),
  messages: z.array(MessageSchema).describe('The messages to build the retrieval query from'),
});

export const GetMemoryResponseSchema = z.object({
  facts: z.array(FactResultSchema).describe('The facts that were retrieved from the graph'),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
export type FactResult = z.infer<typeof FactResultSchema>;
export type SearchResults = z.infer<typeof SearchResultsSchema>;
export type GetMemoryRequest = z.infer<typeof GetMemoryRequestSchema>;
export type GetMemoryResponse = z.infer<typeof GetMemoryResponseSchema>;