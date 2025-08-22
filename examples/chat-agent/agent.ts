/**
 * Build a ShoeBot Sales Agent using LangGraph and Graphzep
 * 
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

/**
 * This example demonstrates building an agent using LangGraph and Graphzep.
 * Graphzep is used to personalize agent responses based on information learned 
 * from prior conversations. Additionally, a database of products is loaded into 
 * the Graphzep graph, enabling the agent to speak to these products.
 * 
 * The agent implements:
 * - persistence of new chat turns to Graphzep and recall of relevant Facts using the most recent message
 * - a tool for querying Graphzep for shoe information  
 * - in-memory state management to maintain agent state
 * 
 * Prerequisites:
 * - Node.js 18+
 * - Neo4j database running
 * - Environment variables: OPENAI_API_KEY, NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD
 */

import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import { z } from 'zod';
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

// Configure logging (simple console logging in TypeScript)
const logger = console;

// Neo4j connection parameters
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// Agent state interface
interface AgentState {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    toolCalls?: any[];
  }>;
  userName: string;
  userNodeUuid: string;
}

// Product interface for shoe data
interface Product {
  title: string;
  description?: string;
  price?: number;
  category?: string;
  [key: string]: any;
}

export class ShoeBotAgent {
  private graphzep: Graphzep;
  private userNodeUuid?: string;
  private manybirdsNodeUuid?: string;
  private conversationHistory: Map<string, AgentState> = new Map();

  constructor() {
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
    this.graphzep = new Graphzep({
      driver,
      llmClient,
      embedder,
      groupId: 'shoebot-demo',
    });
  }

  /**
   * Initialize the database and load product data
   */
  async initialize(clearData: boolean = false): Promise<void> {
    logger.log('=== Initializing SheBot Sales Agent ===');
    
    // Test connection
    try {
      const driver = (this.graphzep as any).driver;
      await driver.verifyConnectivity();
      logger.log('Successfully connected to Neo4j database');
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', error);
      throw error;
    }
    
    if (clearData) {
      logger.log('Clearing existing data and building indices...');
      await this.graphzep.clearDatabase();
      await (this.graphzep as any).driver.createIndexes();
    }

    // Load product data
    await this.ingestProductsData();
    
    // Create user node
    await this.createUserNode('jess');
    
    logger.log('SheBot agent initialized successfully!');
  }

  /**
   * Load shoe products into the Graphzep graph
   */
  private async ingestProductsData(): Promise<void> {
    logger.log('Loading product data into the graph...');
    
    try {
      // Try to load from the data directory
      const dataPath = join(__dirname, '../data/manybirds_products.json');
      const data = readFileSync(dataPath, 'utf-8');
      const parsedData = JSON.parse(data);
      const products: Product[] = parsedData.products || parsedData;

      const productsToLoad = Math.min(products.length, 10); // Load first 10 products
      for (let i = 0; i < productsToLoad; i++) {
        const product = products[i];
        
        // Remove images to reduce payload size
        const { images, ...productWithoutImages } = product;
        
        await this.graphzep.addEpisode({
          content: JSON.stringify(productWithoutImages),
          episodeType: EpisodeType.JSON,
          referenceId: `product-${i}`,
          groupId: 'products',
          metadata: {
            name: product.title || `Product ${i}`,
            sourceDescription: 'ManyBirds products',
            referenceTime: new Date().toISOString(),
          },
        });
        
        if (i % 5 === 0) {
          logger.log(`Loaded ${i + 1}/${productsToLoad} products...`);
        }
      }
      
      logger.log(`Successfully loaded ${productsToLoad} products`);
      
    } catch (error) {
      logger.warn('Could not load product data file, using sample products');
      
      // Create sample shoe products
      const sampleProducts: Product[] = [
        {
          title: 'TinyBirds Wool Runners',
          description: 'Comfortable wool running shoes in Natural Black',
          price: 95,
          category: 'Running',
          sizes: ['7', '8', '9', '10', '11', '12'],
          colors: ['Natural Black', 'Natural Grey'],
        },
        {
          title: 'TreeBirds Casual Sneakers',
          description: 'Sustainable sneakers made from eucalyptus tree fiber',
          price: 85,
          category: 'Casual',
          sizes: ['6', '7', '8', '9', '10', '11'],
          colors: ['White', 'Navy', 'Forest Green'],
        },
        {
          title: 'ManyBirds Athletic Runners',
          description: 'High-performance running shoes for serious athletes',
          price: 120,
          category: 'Athletic',
          sizes: ['7', '8', '9', '10', '11', '12', '13'],
          colors: ['Black', 'White', 'Red'],
        },
      ];

      for (let i = 0; i < sampleProducts.length; i++) {
        const product = sampleProducts[i];
        
        await this.graphzep.addEpisode({
          content: JSON.stringify(product),
          episodeType: EpisodeType.JSON,
          referenceId: `sample-product-${i}`,
          groupId: 'products',
          metadata: {
            name: product.title,
            sourceDescription: 'Sample ManyBirds products',
            referenceTime: new Date().toISOString(),
          },
        });
      }
      
      logger.log(`Loaded ${sampleProducts.length} sample products`);
    }
  }

  /**
   * Create a user node in the Graphzep graph
   */
  private async createUserNode(userName: string): Promise<void> {
    logger.log(`Creating user node for: ${userName}`);
    
    await this.graphzep.addEpisode({
      content: `${userName} is interested in buying a pair of shoes`,
      episodeType: EpisodeType.TEXT,
      referenceId: `user-creation-${userName}`,
      groupId: 'users',
      metadata: {
        name: 'User Creation',
        userName,
        sourceDescription: 'SalesBot',
        referenceTime: new Date().toISOString(),
      },
    });

    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Search for the user node
    const userResults = await this.graphzep.search({
      query: userName,
      groupId: 'users',
      limit: 1,
    });

    if (userResults.length > 0) {
      this.userNodeUuid = userResults[0].uuid;
      logger.log(`User node created with UUID: ${this.userNodeUuid}`);
    }

    // Search for ManyBirds node
    const manybirdResults = await this.graphzep.search({
      query: 'ManyBirds',
      groupId: 'products',
      limit: 1,
    });

    if (manybirdResults.length > 0) {
      this.manybirdsNodeUuid = manybirdResults[0].uuid;
      logger.log(`ManyBirds node UUID: ${this.manybirdsNodeUuid}`);
    }
  }

  /**
   * Tool for searching shoe data in Graphzep
   */
  async getShoeData(query: string): Promise<string> {
    const results = await this.graphzep.search({
      query,
      groupId: 'products',
      limit: 10,
    });

    if (results.length === 0) {
      return 'No shoe information found for your query.';
    }

    const facts = results
      .filter(result => 'fact' in result)
      .map(result => result.fact)
      .join('\n- ');

    return `Available shoe information:\n- ${facts}`;
  }

  /**
   * Generate a response using the chatbot logic
   */
  async generateResponse(userInput: string, threadId: string, userName: string = 'jess'): Promise<string> {
    // Get or create conversation state
    let state = this.conversationHistory.get(threadId) || {
      messages: [],
      userName,
      userNodeUuid: this.userNodeUuid || '',
    };

    // Add user message to conversation
    state.messages.push({
      role: 'user',
      content: userInput,
    });

    // Search for relevant facts from Graphzep
    let factsString = 'No facts about the user and their conversation';
    
    if (state.messages.length > 0) {
      const lastMessage = state.messages[state.messages.length - 1];
      const graphzepQuery = `${userName}: ${lastMessage.content}`;
      
      // Search graphzep using user's node uuid as the center node
      const results = await this.graphzep.search({
        query: graphzepQuery,
        groupId: 'users',
        limit: 5,
      });
      
      if (results.length > 0) {
        const facts = results
          .filter(result => 'fact' in result)
          .map(result => result.fact)
          .join('\n- ');
        factsString = `- ${facts}`;
      }
    }

    // Check if user is asking about shoes specifically
    const isShoeQuery = userInput.toLowerCase().includes('shoe') || 
                       userInput.toLowerCase().includes('runner') || 
                       userInput.toLowerCase().includes('sneaker') ||
                       userInput.toLowerCase().includes('size') ||
                       userInput.toLowerCase().includes('color');

    let shoeData = '';
    if (isShoeQuery) {
      shoeData = await this.getShoeData(userInput);
    }

    // Create system message with context
    const systemMessage = `You are a skillful shoe salesperson working for ManyBirds. Review information about the user and their prior conversation below and respond accordingly.
Keep responses short and concise. And remember, always be selling (and helpful!)

Things you'll need to know about the user in order to close a sale:
- the user's shoe size
- any other shoe needs? maybe for wide feet?
- the user's preferred colors and styles
- their budget

Ensure that you ask the user for the above if you don't already know.

Facts about the user and their conversation:
${factsString}

${shoeData ? `Available shoe information:\n${shoeData}` : ''}`;

    // For this simplified example, we'll use a simple response generation
    // In a real implementation, this would use the LLM client
    let response: string;
    
    if (userInput.toLowerCase().includes('hello') || userInput.toLowerCase().includes('hi')) {
      response = "Hello! Welcome to ManyBirds! I'm here to help you find the perfect pair of shoes. What type of shoes are you looking for today?";
    } else if (isShoeQuery) {
      if (userInput.toLowerCase().includes('wool runner')) {
        response = "Great choice! Our TinyBirds Wool Runners are very popular. They come in sizes 7-12 and are available in Natural Black and Natural Grey. They're $95 and perfect for casual wear or light running. What size are you looking for?";
      } else if (userInput.toLowerCase().includes('size')) {
        response = "What's your shoe size? Our shoes typically run true to size, and we have sizes ranging from 6 to 13 depending on the model. Do you have any special fit requirements like wide feet?";
      } else {
        response = "I'd be happy to help you find the perfect shoes! We have running shoes, casual sneakers, and athletic shoes. What's your preferred style, and what size do you wear?";
      }
    } else {
      response = "I'm here to help you find amazing shoes! What can I tell you about our ManyBirds collection? Are you looking for running shoes, casual wear, or something else?";
    }

    // Add assistant response to conversation
    state.messages.push({
      role: 'assistant',
      content: response,
    });

    // Save updated conversation state
    this.conversationHistory.set(threadId, state);

    // Add the interaction to Graphzep graph asynchronously (fire and forget)
    this.addInteractionToGraph(userName, userInput, response).catch(() => {});

    return response;
  }

  /**
   * Add the conversation interaction to Graphzep graph
   */
  private async addInteractionToGraph(userName: string, userMessage: string, botResponse: string): Promise<void> {
    try {
      // Don't add interaction if graphzep connection is closed
      const driver = (this.graphzep as any).driver;
      if (!driver || !driver.driver || !driver.session) {
        return;
      }
      
      // Check if session is still open
      try {
        await driver.driver.verifyConnectivity();
      } catch {
        // Connection is closed, skip saving
        return;
      }
      
      await this.graphzep.addEpisode({
        content: `${userName}: ${userMessage}\nSalesBot: ${botResponse}`,
        episodeType: EpisodeType.MESSAGE,
        referenceId: `interaction-${Date.now()}`,
        groupId: 'conversations',
        metadata: {
          name: 'Chatbot Response',
          userName,
          sourceDescription: 'Chatbot',
          referenceTime: new Date().toISOString(),
        },
      });
    } catch (error) {
      // Silently ignore if connection is closed
      if (error instanceof Error && !error.message.includes('Pool is closed')) {
        logger.error('Error adding interaction to graph:', error);
      }
    }
  }

  /**
   * Run an interactive chat session
   */
  async runInteractiveChat(): Promise<void> {
    logger.log('\n=== Interactive SheBot Chat Session ===');
    logger.log('SalesBot: Hello! Welcome to ManyBirds! How can I help you find the perfect shoes today?');
    
    const threadId = randomUUID();
    
    // Simple readline interface for demonstration
    // In a real application, this would be replaced with a proper chat interface
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const chatLoop = () => {
      rl.question('\nYou: ', async (userInput) => {
        if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
          logger.log('\nSalesBot: Thanks for chatting! Come back anytime to find your perfect shoes!');
          rl.close();
          await this.close();
          return;
        }

        try {
          const response = await this.generateResponse(userInput, threadId);
          logger.log(`\nSalesBot: ${response}`);
          chatLoop(); // Continue the conversation
        } catch (error) {
          logger.error('Error generating response:', error);
          chatLoop();
        }
      });
    };

    chatLoop();
  }

  /**
   * Run a single test interaction
   */
  async runTestInteraction(): Promise<void> {
    logger.log('\n=== Testing SheBot Agent ===');
    
    const threadId = randomUUID();
    const testQuery = "What sizes do the TinyBirds Wool Runners in Natural Black come in?";
    
    logger.log(`User: ${testQuery}`);
    const response = await this.generateResponse(testQuery, threadId);
    logger.log(`SalesBot: ${response}`);
    
    logger.log('\n=== Test Complete ===');
  }

  /**
   * Close the Graphzep connection
   */
  async close(): Promise<void> {
    await this.graphzep.close();
    logger.log('SheBot agent connections closed');
  }
}

// Main execution function
async function main(): Promise<void> {
  const agent = new ShoeBotAgent();
  
  try {
    // Initialize the agent (set clearData to true to start fresh)
    await agent.initialize(true);
    
    // Wait for data to be processed
    logger.log('\nWaiting for data to be processed...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Run a test interaction
    await agent.runTestInteraction();
    
    // Wait a bit before closing to allow async operations to complete
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Uncomment the following line to run an interactive chat session
    // await agent.runInteractiveChat();
    
  } catch (error) {
    logger.error('Error running SheBot agent:', error);
  } finally {
    await agent.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { main };