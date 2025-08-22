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

import { config } from 'dotenv';
import { 
  Graphzep, 
  FalkorDBDriver,
  OpenAIClient,
  OpenAIEmbedder,
  EpisodeType 
} from 'graphzep';

//////////////////////////////////////////////////
// CONFIGURATION
//////////////////////////////////////////////////

// Load environment variables
config();

// Configure logging (simple console logging in TypeScript)
const logger = console;

// FalkorDB connection parameters
const falkordbUri = process.env.FALKORDB_URI || 'falkor://localhost:6379';

if (!falkordbUri) {
  throw new Error('FALKORDB_URI must be set');
}

async function main(): Promise<void> {
  //////////////////////////////////////////////////
  // INITIALIZATION
  //////////////////////////////////////////////////

  // Create driver instances
  const driver = new FalkorDBDriver(falkordbUri);

  const llmClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'gpt-4o-mini',
  });

  const embedder = new OpenAIEmbedder({
    apiKey: process.env.OPENAI_API_KEY!,
    model: 'text-embedding-3-small',
  });

  // Initialize Graphzep with FalkorDB connection
  const graphzep = new Graphzep({
    driver,
    llmClient,
    embedder,
    groupId: 'quickstart-falkordb-example',
  });

  try {
    // Initialize the graph database with Graphzep's indices
    logger.log('Building indices and constraints...');
    
    //////////////////////////////////////////////////
    // ADDING EPISODES
    //////////////////////////////////////////////////

    const episodes = [
      {
        content: 'Kamala Harris is the Attorney General of California. She was previously the district attorney for San Francisco.',
        type: EpisodeType.TEXT,
        description: 'podcast transcript',
      },
      {
        content: 'As AG, Harris was in office from January 3, 2011 – January 3, 2017',
        type: EpisodeType.TEXT,
        description: 'podcast transcript',
      },
      {
        content: JSON.stringify({
          name: 'Gavin Newsom',
          position: 'Governor',
          state: 'California',
          previous_role: 'Lieutenant Governor',
          previous_location: 'San Francisco',
        }),
        type: EpisodeType.JSON,
        description: 'podcast metadata',
      },
    ];

    // Add episodes to the graph
    logger.log('Adding episodes to the graph...');
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      
      await graphzep.addEpisode({
        content: episode.content,
        episodeType: episode.type,
        referenceId: `falkor-radio-${i}`,
        groupId: 'quickstart-falkordb-example',
        metadata: {
          name: `FalkorDB Radio ${i}`,
          sourceDescription: episode.description,
          referenceTime: new Date().toISOString(),
        },
      });
      
      logger.log(`Added episode: FalkorDB Radio ${i} (${episode.type})`);
    }

    //////////////////////////////////////////////////
    // BASIC SEARCH
    //////////////////////////////////////////////////

    logger.log("\nSearching for: 'Who was the California Attorney General?'");
    const results = await graphzep.search({
      query: 'Who was the California Attorney General?',
      groupId: 'quickstart-falkordb-example',
      limit: 10,
    });

    // Print search results
    logger.log('\nSearch Results:');
    for (const result of results) {
      if ('fact' in result) {
        logger.log(`UUID: ${result.uuid}`);
        logger.log(`Fact: ${result.fact}`);
        if ('validAt' in result && result.validAt) {
          logger.log(`Valid from: ${result.validAt}`);
        }
        if ('invalidAt' in result && result.invalidAt) {
          logger.log(`Valid until: ${result.invalidAt}`);
        }
        logger.log('---');
      }
    }

    //////////////////////////////////////////////////
    // NODE SEARCH
    //////////////////////////////////////////////////

    logger.log('\nPerforming node search for California Governor:');
    const nodeResults = await graphzep.search({
      query: 'California Governor',
      groupId: 'quickstart-falkordb-example',
      limit: 5,
      nodeTypes: ['entity'],
    });

    // Print node search results
    logger.log('\nNode Search Results:');
    for (const node of nodeResults) {
      if ('name' in node && !('fact' in node)) {
        logger.log(`Node UUID: ${node.uuid}`);
        logger.log(`Node Name: ${node.name}`);
        const nodeSummary = 'summary' in node && typeof node.summary === 'string'
          ? (node.summary.length > 100 ? node.summary.substring(0, 100) + '...' : node.summary)
          : 'No summary available';
        logger.log(`Content Summary: ${nodeSummary}`);
        logger.log(`Created At: ${node.createdAt}`);
        if ('labels' in node && node.labels) {
          logger.log(`Node Labels: ${node.labels.join(', ')}`);
        }
        logger.log('---');
      }
    }

  } catch (error) {
    logger.error('Error during execution:', error);
  } finally {
    // Close the connection
    await graphzep.close();
    logger.log('\nConnection closed');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };