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

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { 
  Graphzep, 
  Neo4jDriver,
  OpenAIClient,
  OpenAIEmbedder,
  EpisodeType 
} from 'graphzep';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

// Setup logging
const logger = console;

// Neo4j connection parameters
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

interface ProductData {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  rating?: {
    rate: number;
    count: number;
  };
}

async function loadProductData(): Promise<ProductData[]> {
  try {
    // Try to load from the data directory
    const dataPath = join(__dirname, '../data/manybirds_products.json');    
    const data = readFileSync(dataPath, 'utf-8');
    const parsedData = JSON.parse(data);
    return parsedData.products;
  } catch (error) {
    logger.warn('Could not load product data file, using sample data');
    // Return sample product data
    return [
      {
        id: '1',
        title: 'Wireless Bluetooth Headphones',
        description: 'High-quality wireless headphones with noise cancellation and 20-hour battery life',
        price: 99.99,
        category: 'Electronics',
        rating: { rate: 4.5, count: 120 }
      },
      {
        id: '2', 
        title: 'Organic Cotton T-Shirt',
        description: 'Comfortable organic cotton t-shirt available in multiple colors',
        price: 24.99,
        category: 'Clothing',
        rating: { rate: 4.2, count: 89 }
      },
      {
        id: '3',
        title: 'Stainless Steel Water Bottle',
        description: 'Insulated water bottle that keeps drinks cold for 24 hours or hot for 12 hours',
        price: 34.99,
        category: 'Home & Garden',
        rating: { rate: 4.8, count: 156 }
      }
    ];
  }
}

async function main(): Promise<void> {
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
    groupId: 'ecommerce-demo',
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
    logger.log('=== E-commerce Product Knowledge Graph Demo ===');
    
    // Load product data
    logger.log('Loading product data...');
    const products = await loadProductData();
    logger.log(`Loaded ${products.length} products`);

    // Clear existing data (optional)
    logger.log('Clearing existing data...');
    await graphzep.clearDatabase();
    
    // Add product data as episodes
    logger.log('Adding product data to knowledge graph...');
    for (const product of products) {
      // Create a rich episode description combining all product information
      const productDescription = `
        Product: ${product.title}
        Description: ${product.description}
        Price: $${product.price}
        Category: ${product.category}
        ${product.rating ? `Rating: ${product.rating.rate}/5 (${product.rating.count} reviews)` : ''}
      `.trim();

      await graphzep.addEpisode({
        content: productDescription,
        episodeType: EpisodeType.TEXT,
        referenceId: `product-${product.id}`,
        groupId: 'ecommerce-demo',
        metadata: {
          productId: product.id,
          category: product.category,
          price: product.price,
          sourceDescription: 'Product catalog',
          referenceTime: new Date().toISOString(),
        },
      });

      // Also add structured product data as JSON episode
      await graphzep.addEpisode({
        content: JSON.stringify(product),
        episodeType: EpisodeType.JSON,
        referenceId: `product-json-${product.id}`,
        groupId: 'ecommerce-demo',
        metadata: {
          productId: product.id,
          category: product.category,
          sourceDescription: 'Product structured data',
          referenceTime: new Date().toISOString(),
        },
      });

      logger.log(`Added product: ${product.title}`);
    }

    // Wait for processing to complete
    logger.log('\nWaiting for episodes to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Check what's in the database
    logger.log('\n=== Checking Database Contents ===');
    const allNodesResult = await driver.executeQuery(
      'MATCH (n) RETURN labels(n) as labels, n.name as name LIMIT 10'
    ) as any;
    logger.log('Sample nodes in database:');
    if (allNodesResult && allNodesResult.records) {
      for (const record of allNodesResult.records) {
        logger.log(`  - ${record.get('labels')}: ${record.get('name')}`);
      }
    } else {
      logger.log('  No node records found or unexpected format');
    }

    const allEdgesResult = await driver.executeQuery(
      'MATCH ()-[r]->() RETURN type(r) as type, count(*) as count'
    ) as any;
    logger.log('\nEdge types in database:');
    if (allEdgesResult && allEdgesResult.records) {
      for (const record of allEdgesResult.records) {
        logger.log(`  - ${record.get('type')}: ${record.get('count')}`);
      }
    } else {
      logger.log('  No edge records found or unexpected format');
    }

    logger.log('\n=== Running Product Queries ===');

    // Query 1: Search for electronics
    logger.log('\n1. Searching for electronics products:');
    const electronicsResults = await graphzep.search({
      query: 'electronics wireless headphones audio',
      groupId: 'ecommerce-demo',
      limit: 5,
    });

    logger.log(`Found ${electronicsResults.length} results`);
    if (electronicsResults.length === 0) {
      logger.log('No results found for electronics query');
    }
    for (const result of electronicsResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 2: Search for clothing items
    logger.log('\n2. Searching for clothing items:');
    const clothingResults = await graphzep.search({
      query: 'clothing shirt cotton apparel',
      groupId: 'ecommerce-demo', 
      limit: 5,
    });

    logger.log(`Found ${clothingResults.length} results`);
    if (clothingResults.length === 0) {
      logger.log('No results found for clothing query');
    }
    for (const result of clothingResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 3: Search by price range
    logger.log('\n3. Searching for affordable products under $30:');
    const affordableResults = await graphzep.search({
      query: 'cheap affordable under 30 dollars budget',
      groupId: 'ecommerce-demo',
      limit: 5,
    });

    logger.log(`Found ${affordableResults.length} results`);
    if (affordableResults.length === 0) {
      logger.log('No results found for affordable products query');
    }
    for (const result of affordableResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 4: Search by features
    logger.log('\n4. Searching for products with high ratings:');
    const ratedResults = await graphzep.search({
      query: 'high rating good reviews quality popular',
      groupId: 'ecommerce-demo',
      limit: 5,
    });

    logger.log(`Found ${ratedResults.length} results`);
    if (ratedResults.length === 0) {
      logger.log('No results found for high-rated products query');
    }
    for (const result of ratedResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    // Query 5: Complex search - sustainable products
    logger.log('\n5. Searching for sustainable/eco-friendly products:');
    const sustainableResults = await graphzep.search({
      query: 'organic sustainable eco-friendly environmentally conscious',
      groupId: 'ecommerce-demo',
      limit: 5,
    });

    logger.log(`Found ${sustainableResults.length} results`);
    if (sustainableResults.length === 0) {
      logger.log('No results found for sustainable products query');
    }
    for (const result of sustainableResults) {
      if ('fact' in result) {
        logger.log(`- ${result.fact}`);
      } else if ('name' in result) {
        logger.log(`- Entity: ${result.name}`);
      } else {
        logger.log(`- Result: ${JSON.stringify(result)}`);
      }
    }

    logger.log('\n=== Demo Complete ===');
    logger.log('The knowledge graph has successfully extracted entities and relationships from product data.');
    logger.log('You can now search for products using natural language queries that understand:');
    logger.log('- Product categories and types');
    logger.log('- Features and specifications');
    logger.log('- Price ranges and value propositions');
    logger.log('- Quality indicators like ratings');
    logger.log('- Brand and sustainability attributes');

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
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };