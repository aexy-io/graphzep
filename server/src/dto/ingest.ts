import { z } from 'zod';
import { MessageSchema } from './common.js';

export const AddMessagesRequestSchema = z.object({
  group_id: z.string().describe('The group id of the messages to add'),
  messages: z.array(MessageSchema).describe('The messages to add'),
});

export const AddEntityNodeRequestSchema = z.object({
  uuid: z.string().describe('The uuid of the node to add'),
  group_id: z.string().describe('The group id of the node to add'),
  name: z.string().describe('The name of the node to add'),
  summary: z.string().default('').describe('The summary of the node to add'),
});

export type AddMessagesRequest = z.infer<typeof AddMessagesRequestSchema>;
export type AddEntityNodeRequest = z.infer<typeof AddEntityNodeRequestSchema>;