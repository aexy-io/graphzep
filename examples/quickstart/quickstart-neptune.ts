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
  // NeptuneDriver, // Would need to be implemented
  Neo4jDriver, // Using Neo4j as fallback for now
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

// Amazon Neptune connection parameters
const neptuneHost = process.env.NEPTUNE_HOST;
const neptunePort = parseInt(process.env.NEPTUNE_PORT || '8182');

// Fallback to Neo4j if Neptune is not configured
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

if (!neptuneHost) {
  logger.warn('NEPTUNE_HOST not configured, falling back to Neo4j for demonstration');
}

async function main(): Promise<void> {
  //////////////////////////////////////////////////
  // INITIALIZATION
  //////////////////////////////////////////////////

  // Create driver instances
  // Note: NeptuneDriver would need to be implemented in the TypeScript version
  let driver;
  
  if (neptuneHost) {
    logger.log('Amazon Neptune driver is not yet implemented in TypeScript version');
    logger.log('Using Neo4j driver as fallback...');
    // TODO: Implement NeptuneDriver
    // driver = new NeptuneDriver({
    //   host: neptuneHost,
    //   port: neptunePort,
    // });
  }
  
  // Fallback to Neo4j
  driver = new Neo4jDriver(neo4jUri, neo4jUser, neo4jPassword);

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
    groupId: 'quickstart-neptune-example',
  });

  try {
    // Initialize the graph database with Graphzep's indices
    logger.log('Building indices and constraints...');
    // Note: buildIndicesAndConstraints would be a driver-level method
    
    //////////////////////////////////////////////////
    // ADDING EPISODES
    //////////////////////////////////////////////////

    const episodes = [
      {
        content: 'Amazon Neptune is a fast, reliable, fully-managed graph database service that makes it easy to build and run applications that work with highly connected datasets.',
        type: EpisodeType.TEXT,
        description: 'AWS documentation',
      },
      {
        content: 'Neptune supports both Property Graph and RDF graph models, and provides choice of graph query languages including Apache TinkerPop Gremlin and SPARQL.',
        type: EpisodeType.TEXT,
        description: 'AWS documentation',
      },
      {
        content: JSON.stringify({
          service: 'Amazon Neptune',
          provider: 'AWS',
          type: 'Graph Database',
          features: ['Property Graph', 'RDF', 'Gremlin', 'SPARQL'],
          deployment: 'Fully Managed',
        }),
        type: EpisodeType.JSON,
        description: 'AWS service metadata',
      },
    ];

    // Add episodes to the graph
    logger.log('Adding episodes to the graph...');
    for (let i = 0; i < episodes.length; i++) {
      const episode = episodes[i];
      
      await graphzep.addEpisode({
        content: episode.content,
        episodeType: episode.type,
        referenceId: `neptune-example-${i}`,
        groupId: 'quickstart-neptune-example',
        metadata: {
          name: `Neptune Episode ${i}`,
          sourceDescription: episode.description,
          referenceTime: new Date().toISOString(),
        },
      });
      
      logger.log(`Added episode: Neptune Episode ${i} (${episode.type})`);
    }

    //////////////////////////////////////////////////
    // BASIC SEARCH
    //////////////////////////////////////////////////

    logger.log("\nSearching for: 'What is Amazon Neptune?'");
    const results = await graphzep.search({
      query: 'What is Amazon Neptune?',
      groupId: 'quickstart-neptune-example',
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
    // GRAPH DATABASE QUERIES
    //////////////////////////////////////////////////

    logger.log('\nSearching for graph database features:');
    const featureResults = await graphzep.search({
      query: 'graph database features Gremlin SPARQL',
      groupId: 'quickstart-neptune-example',
      limit: 5,
    });

    for (const result of featureResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      }
    }

    //////////////////////////////////////////////////
    // AWS SERVICE QUERIES
    //////////////////////////////////////////////////

    logger.log('\nSearching for AWS service information:');
    const awsResults = await graphzep.search({
      query: 'AWS Amazon managed service cloud',
      groupId: 'quickstart-neptune-example',
      limit: 5,
    });

    for (const result of awsResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      }
    }

    logger.log('\n=== Demo Notes ===');
    logger.log('This example demonstrates how Graphzep could work with Amazon Neptune.');
    logger.log('Currently using Neo4j as the backend since NeptuneDriver is not yet implemented.');
    logger.log('');
    logger.log('To implement Neptune support:');
    logger.log('1. Create NeptuneDriver class extending GraphDriver');
    logger.log('2. Implement Gremlin query interface');
    logger.log('3. Add Neptune-specific connection handling');
    logger.log('4. Handle Neptune authentication (IAM roles, etc.)');

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