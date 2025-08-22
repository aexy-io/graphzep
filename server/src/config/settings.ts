import { z } from 'zod';
import { config } from 'dotenv';

config();

const settingsSchema = z.object({
  OPENAI_API_KEY: z.string(),
  OPENAI_BASE_URL: z.string().optional(),
  MODEL_NAME: z.string().optional(),
  EMBEDDING_MODEL_NAME: z.string().optional(),
  NEO4J_URI: z.string(),
  NEO4J_USER: z.string(),
  NEO4J_PASSWORD: z.string(),
  PORT: z.string().default('3000').transform(Number),
});

export type Settings = z.infer<typeof settingsSchema>;

let cachedSettings: Settings | null = null;

export function getSettings(): Settings {
  if (cachedSettings) {
    return cachedSettings;
  }

  const result = settingsSchema.safeParse(process.env);
  
  if (!result.success) {
    throw new Error(`Invalid environment configuration: ${result.error.message}`);
  }

  cachedSettings = result.data;
  return cachedSettings;
}