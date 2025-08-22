/**
 * 
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * 
 *     http://www.apache.org/licenses/LICENSE-2.0
 * 
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { randomUUID } from 'crypto';
import { config } from 'dotenv';
import { z } from 'zod';
import { 
  Graphzep, 
  Neo4jDriver,
  OpenAIClient,
  OpenAIEmbedder,
  EpisodeType 
} from 'graphzep';
import { parsePodcastMessages } from './transcript-parser.js';

// Load environment variables
config();

// Configure logging (simple console logging in TypeScript)
const logger = console;

// Neo4j connection parameters
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// Define custom entity and relationship schemas
export const PersonSchema = z.object({
  firstName: z.string().optional().describe('First name'),
  lastName: z.string().optional().describe('Last name'),
  occupation: z.string().optional().describe("The person's work occupation"),
});

export const CitySchema = z.object({
  country: z.string().optional().describe('The country the city is in'),
});

export const IsPresidentOfSchema = z.object({
  // Relationship between a person and the entity they are a president of
  startDate: z.string().optional().describe('When they became president'),
  endDate: z.string().optional().describe('When they stopped being president'),
});

export type Person = z.infer<typeof PersonSchema>;
export type City = z.infer<typeof CitySchema>;
export type IsPresidentOf = z.infer<typeof IsPresidentOfSchema>;

export async function main(useBulk: boolean = false): Promise<void> {
  logger.log('=== Podcast Transcript Knowledge Graph Demo ===');
  
  // Create driver instances
  const driver = new Neo4jDriver(neo4jUri, neo4jUser, neo4jPassword);

  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  // Initialize Graphzep
  const graphzep = new Graphzep({
    driver,
    llmClient,
    embedder,
    groupId: 'podcast-demo',
  });

  // Test connection
  try {
    await driver.verifyConnectivity();
    logger.log('Successfully connected to Neo4j database');
  } catch (error) {
    logger.error('Failed to connect to Neo4j:', error);
    throw error;
  }

  try {
    // Clear existing data and build indices
    logger.log('Clearing existing data and building indices...');
    await graphzep.clearDatabase();
    await driver.createIndexes();
    
    // Parse podcast messages
    logger.log('Parsing podcast transcript...');
    const messages = parsePodcastMessages();
    const groupId = randomUUID();

    logger.log(`Processing ${messages.length} messages from podcast transcript...`);

    if (useBulk) {
      logger.log('Using bulk processing for episodes...');
      
      // Prepare raw episodes for bulk processing
      const rawEpisodes = messages.slice(3, 14).map((message, i) => ({
        content: `${message.speakerName} (${message.role}): ${message.content}`,
        episodeType: EpisodeType.MESSAGE,
        referenceId: `message-${i}`,
        groupId,
        metadata: {
          name: `Message ${i}`,
          speakerName: message.speakerName,
          role: message.role,
          relativeTimestamp: message.relativeTimestamp,
          referenceTime: message.actualTimestamp.toISOString(),
          sourceDescription: 'Podcast Transcript',
        },
      }));

      // Note: Bulk processing would need to be implemented in the TypeScript version
      logger.log('Bulk processing is not yet implemented in TypeScript version');
      logger.log('Falling back to individual episode processing...');
      
      // Process episodes individually for now
      for (let i = 0; i < rawEpisodes.length; i++) {
        const episode = rawEpisodes[i];
        await graphzep.addEpisode({
          content: episode.content,
          episodeType: episode.episodeType,
          referenceId: episode.referenceId,
          groupId: episode.groupId,
          metadata: episode.metadata,
        });
        logger.log(`Added episode ${i + 1}/${rawEpisodes.length}: ${episode.metadata.name}`);
      }
      
    } else {
      logger.log('Processing episodes individually...');
      
      for (let i = 0; i < Math.min(messages.length - 3, 11); i++) {
        const message = messages[i + 3]; // Skip first 3 messages
        
        // Retrieve recent episodes for context
        // Note: retrieveEpisodes would need proper implementation
        logger.log(`Processing message ${i + 1}: ${message.speakerName}`);

        await graphzep.addEpisode({
          content: `${message.speakerName} (${message.role}): ${message.content}`,
          episodeType: EpisodeType.MESSAGE,
          referenceId: `message-${i}`,
          groupId,
          metadata: {
            name: `Message ${i}`,
            speakerName: message.speakerName,
            role: message.role,
            relativeTimestamp: message.relativeTimestamp,
            referenceTime: message.actualTimestamp.toISOString(),
            sourceDescription: 'Podcast Transcript',
            // Custom entity and relationship types could be specified here
            entityTypes: {
              Person: PersonSchema,
              City: CitySchema,
            },
            relationshipTypes: {
              IS_PRESIDENT_OF: IsPresidentOfSchema,
            },
          },
        });

        logger.log(`Added episode: Message ${i} (${message.speakerName})`);
      }
    }

    // Wait for processing to complete
    logger.log('\nWaiting for episodes to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    logger.log('\n=== Running Knowledge Graph Queries ===');

    // Query 1: Search for information about presidents
    logger.log('\n1. Searching for information about presidents:');
    const presidentResults = await graphzep.search({
      query: 'president presidential office government leadership',
      groupId,
      limit: 5,
    });

    logger.log(`Found ${presidentResults.length} results`);
    if (presidentResults.length === 0) {
      logger.log('No results found for presidents query');
    }
    for (const result of presidentResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 2: Search for people and their roles
    logger.log('\n2. Searching for people and their roles:');
    const peopleResults = await graphzep.search({
      query: 'person people occupation job role work',
      groupId,
      limit: 5,
    });

    logger.log(`Found ${peopleResults.length} results`);
    if (peopleResults.length === 0) {
      logger.log('No results found for people query');
    }
    for (const result of peopleResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 3: Search for specific speakers
    logger.log('\n3. Searching for information about Stephen Dubner:');
    const dubnerResults = await graphzep.search({
      query: 'Stephen Dubner host interview podcast',
      groupId,
      limit: 5,
    });

    logger.log(`Found ${dubnerResults.length} results`);
    if (dubnerResults.length === 0) {
      logger.log('No results found for Dubner query');
    }
    for (const result of dubnerResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 4: Search for political topics
    logger.log('\n4. Searching for political topics:');
    const politicsResults = await graphzep.search({
      query: 'politics government policy leadership administration',
      groupId,
      limit: 5,
    });

    logger.log(`Found ${politicsResults.length} results`);
    if (politicsResults.length === 0) {
      logger.log('No results found for politics query');
    }
    for (const result of politicsResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 5: Search for educational content
    logger.log('\n5. Searching for educational or academic content:');
    const educationResults = await graphzep.search({
      query: 'education university academic research study',
      groupId,
      limit: 5,
    });

    logger.log(`Found ${educationResults.length} results`);
    if (educationResults.length === 0) {
      logger.log('No results found for education query');
    }
    for (const result of educationResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    logger.log('\n=== Demo Complete ===');
    logger.log('The knowledge graph has successfully processed the podcast transcript and extracted:');
    logger.log('- Speaker information and relationships');
    logger.log('- Topics and themes discussed');
    logger.log('- Temporal context from the conversation');
    logger.log('- Named entities and their relationships');
    logger.log('\nYou can now search the knowledge graph using natural language queries to discover');
    logger.log('insights from the podcast conversation.');

  } catch (error) {
    logger.error('Error during execution:', error);
    throw error;
  } finally {
    // Close the connection
    await graphzep.close();
    logger.log('\nConnection closed');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  // Run with individual processing by default
  main(false).catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

