import { z } from 'zod';

export const ResultSchema = z.object({
  message: z.string(),
  success: z.boolean(),
});

export const MessageSchema = z.object({
  content: z.string().describe('The content of the message'),
  uuid: z.string().optional().describe('The uuid of the message (optional)'),
  name: z.string().default('').describe('The name of the episodic node for the message (optional)'),
  role_type: z.enum(['user', 'assistant', 'system']).describe('The role type of the message (user, assistant or system)'),
  role: z.string().optional().describe('The custom role of the message to be used alongside role_type (user name, bot name, etc.)'),
  timestamp: z.string().datetime().default(new Date().toISOString()).describe('The timestamp of the message'),
  source_description: z.string().default('').describe('The description of the source of the message'),
});

export type Result = z.infer<typeof ResultSchema>;
export type Message = z.infer<typeof MessageSchema>;