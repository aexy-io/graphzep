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
  Neo4jDriver,
  OpenAIClient,
  OpenAIEmbedder,
  EpisodeType 
} from 'graphzep';

//////////////////////////////////////////////////
// CONFIGURATION
//////////////////////////////////////////////////
// Set up environment variables for connecting to Neo4j database
//////////////////////////////////////////////////

// Load environment variables
config();

// Configure logging (simple console logging in TypeScript)
const logger = console;

// Neo4j connection parameters
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

if (!neo4jUri || !neo4jUser || !neo4jPassword) {
  throw new Error('NEO4J_URI, NEO4J_USER, and NEO4J_PASSWORD must be set');
}

async function main(): Promise<void> {
  //////////////////////////////////////////////////
  // INITIALIZATION
  //////////////////////////////////////////////////
  // Connect to Neo4j and set up Graphzep indices
  // This is required before using other Graphzep functionality
  //////////////////////////////////////////////////

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

  // Initialize Graphzep with Neo4j connection
  const graphzep = new Graphzep({
    driver,
    llmClient,
    embedder,
    groupId: 'quickstart-example',
  });

  try {
    // Initialize the graph database with Graphzep's indices. This only needs to be done once.
    logger.log('Building indices and constraints...');
    // Note: buildIndicesAndConstraints would be a driver-level method
    
    //////////////////////////////////////////////////
    // ADDING EPISODES
    //////////////////////////////////////////////////
    // Episodes are the primary units of information in Graphzep.
    // They can be text or structured JSON and are automatically 
    // processed to extract entities and relationships.
    //////////////////////////////////////////////////

    // Example: Add Episodes
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
      {
        content: JSON.stringify({
          name: 'Gavin Newsom',
          position: 'Governor',
          term_start: 'January 7, 2019',
          term_end: 'Present',
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
        referenceId: `freakonomics-radio-${i}`,
        groupId: 'quickstart-example',
        metadata: {
          name: `Freakonomics Radio ${i}`,
          sourceDescription: episode.description,
          referenceTime: new Date().toISOString(),
        },
      });
      
      logger.log(`Added episode: Freakonomics Radio ${i} (${episode.type})`);
    }

    //////////////////////////////////////////////////
    // BASIC SEARCH
    //////////////////////////////////////////////////
    // The simplest way to retrieve relationships (edges) from Graphzep
    // is using the search method, which performs a hybrid search 
    // combining semantic similarity and BM25 text retrieval.
    //////////////////////////////////////////////////

    // Perform a hybrid search combining semantic similarity and BM25 retrieval
    logger.log("\nSearching for: 'Who was the California Attorney General?'");
    const results = await graphzep.search({
      query: 'Who was the California Attorney General?',
      groupId: 'quickstart-example',
      limit: 10,
    });

    // Print search results
    logger.log('\nSearch Results:');
    for (const result of results) {
      if ('fact' in result) {
        // This is an edge result
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
    // Search for nodes directly
    //////////////////////////////////////////////////

    logger.log('\nPerforming node search for California Governor:');
    const nodeResults = await graphzep.search({
      query: 'California Governor',
      groupId: 'quickstart-example',
      limit: 5,
      nodeTypes: ['entity'],
    });

    // Print node search results
    logger.log('\nNode Search Results:');
    for (const node of nodeResults) {
      if ('name' in node && !('fact' in node)) {
        // This is a node result
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
    //////////////////////////////////////////////////
    // CLEANUP
    //////////////////////////////////////////////////
    // Always close the connection to Neo4j when finished
    // to properly release resources
    //////////////////////////////////////////////////

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