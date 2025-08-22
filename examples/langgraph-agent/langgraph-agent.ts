/**
 * Build a ShoeBot Sales Agent using LangGraphJS and Graphzep
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
 * This example demonstrates building an agent using LangGraphJS and Graphzep.
 * Graphzep is used to personalize agent responses based on information learned 
 * from prior conversations. Additionally, a database of products is loaded into 
 * the Graphzep graph, enabling the agent to speak to these products.
 * 
 * The agent implements:
 * - LangGraphJS state management and graph orchestration
 * - Tool integration for searching Graphzep for shoe information
 * - Persistence of conversations to Graphzep
 * - Message-based state handling with LangChain
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
import { StateGraph, Annotation, START, END, messagesStateReducer } from '@langchain/langgraph';
import { ChatOpenAI } from '@langchain/openai';
import { 
  BaseMessage, 
  HumanMessage, 
  AIMessage, 
  SystemMessage,
  ToolMessage 
} from '@langchain/core/messages';
import { tool } from '@langchain/core/tools';
import { ToolNode } from '@langchain/langgraph/prebuilt';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config();

// Configure logging
const logger = console;

// Neo4j connection parameters
const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
const neo4jUser = process.env.NEO4J_USER || 'neo4j';
const neo4jPassword = process.env.NEO4J_PASSWORD || 'password';

// Define the agent state using LangGraph Annotation
const AgentState = Annotation.Root({
  messages: Annotation<BaseMessage[]>({
    reducer: messagesStateReducer,
    default: () => [],
  }),
  userName: Annotation<string>({
    default: () => 'jess',
  }),
  userNodeUuid: Annotation<string>({
    default: () => '',
  }),
  facts: Annotation<string>({
    default: () => 'No facts about the user and their conversation',
  }),
});

// Product interface for shoe data
interface Product {
  title: string;
  description?: string;
  price?: number;
  category?: string;
  [key: string]: any;
}

export class ShoeBotLangGraphAgent {
  private graphzep: Graphzep;
  private chatModel: ChatOpenAI;
  private graph: ReturnType<typeof StateGraph.prototype.compile>;
  private userNodeUuid?: string;
  private manybirdsNodeUuid?: string;

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
      groupId: 'shoebot-langgraph-demo',
    });

    // Initialize ChatOpenAI for LangGraph
    this.chatModel = new ChatOpenAI({
      model: 'gpt-4o-mini',
      temperature: 0.7,
    });

    // Build the LangGraph workflow
    this.graph = this.buildGraph();
  }

  /**
   * Build the LangGraph workflow
   */
  private buildGraph() {
    // Define the search tool for Graphzep
    const searchShoeDataTool = tool(
      async ({ query }: { query: string }) => {
        const results = await this.graphzep.search({
          query,
          groupId: 'products',
          limit: 10,
        });

        if (results.length === 0) {
          return 'No shoe information found for your query.';
        }

        const products = results
          .map(result => {
            if ('fact' in result) {
              return result.fact;
            } else if ('name' in result) {
              return `Product: ${result.name}`;
            }
            return null;
          })
          .filter(Boolean)
          .join('\n- ');

        return `Available shoe information:\n- ${products}`;
      },
      {
        name: 'search_shoe_data',
        description: 'Search for shoe product information based on user queries',
        schema: z.object({
          query: z.string().describe('The search query for shoe products'),
        }),
      }
    );

    // Define the user facts retrieval tool
    const getUserFactsTool = tool(
      async ({ userName, message }: { userName: string; message: string }) => {
        const graphzepQuery = `${userName}: ${message}`;
        
        const results = await this.graphzep.search({
          query: graphzepQuery,
          groupId: 'users',
          limit: 5,
        });
        
        if (results.length === 0) {
          return 'No relevant user facts found';
        }

        const facts = results
          .filter(result => 'fact' in result)
          .map(result => result.fact)
          .join('\n- ');
        
        return facts || 'No facts about the user';
      },
      {
        name: 'get_user_facts',
        description: 'Retrieve facts about the user from previous conversations',
        schema: z.object({
          userName: z.string().describe('The username to search for'),
          message: z.string().describe('The current message context'),
        }),
      }
    );

    // Bind tools to the model
    const modelWithTools = this.chatModel.bindTools([searchShoeDataTool, getUserFactsTool]);

    // Create the state graph
    const workflow = new StateGraph(AgentState)
      // Agent node that processes messages and decides on tool calls
      .addNode('agent', async (state) => {
        const { messages, userName } = state;
        
        // Create system message with context
        const systemMessage = new SystemMessage(`You are a skillful shoe salesperson working for ManyBirds. 
Keep responses short and concise. Always be selling and helpful!

Things you'll need to know about the user to close a sale:
- the user's shoe size
- any other shoe needs (e.g., wide feet)
- preferred colors and styles
- their budget

Ask the user for the above if you don't already know.

Current user: ${userName}
Facts about the user: ${state.facts}`);

        // Add system message at the beginning if not present
        const allMessages = [systemMessage, ...messages];
        
        // Get response from the model
        const response = await modelWithTools.invoke(allMessages);
        
        return { messages: [response] };
      })
      // Tool node for executing tool calls
      .addNode('tools', new ToolNode([searchShoeDataTool, getUserFactsTool]))
      // Save conversation to Graphzep
      .addNode('save_to_graphzep', async (state) => {
        const { messages, userName } = state;
        
        // Get the last user and assistant messages
        const lastMessages = messages.slice(-2);
        const userMessage = lastMessages.find(m => m._getType() === 'human')?.content;
        const assistantMessage = lastMessages.find(m => m._getType() === 'ai')?.content;
        
        if (userMessage && assistantMessage && typeof userMessage === 'string' && typeof assistantMessage === 'string') {
          try {
            await this.graphzep.addEpisode({
              content: `${userName}: ${userMessage}\nSalesBot: ${assistantMessage}`,
              episodeType: EpisodeType.MESSAGE,
              referenceId: `interaction-${Date.now()}`,
              groupId: 'conversations',
              metadata: {
                name: 'Chatbot Response',
                userName,
                sourceDescription: 'LangGraph Chatbot',
                referenceTime: new Date().toISOString(),
              },
            });
          } catch (error) {
            logger.error('Error saving to Graphzep:', error);
          }
        }
        
        return state;
      });

    // Define edges
    workflow
      .addEdge(START, 'agent')
      .addConditionalEdges(
        'agent',
        (state) => {
          const lastMessage = state.messages[state.messages.length - 1];
          // Check if the last message has tool calls
          if (lastMessage && 'tool_calls' in lastMessage && lastMessage.tool_calls?.length > 0) {
            return 'tools';
          }
          return 'save_to_graphzep';
        },
        {
          tools: 'tools',
          save_to_graphzep: 'save_to_graphzep',
        }
      )
      .addEdge('tools', 'agent')
      .addEdge('save_to_graphzep', END);

    // Compile the graph
    return workflow.compile();
  }

  /**
   * Initialize the database and load product data
   */
  async initialize(clearData: boolean = false): Promise<void> {
    logger.log('=== Initializing ShoeBotLangGraph Agent ===');
    
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
      logger.log('Clearing existing data...');
      await this.graphzep.clearDatabase();
      await (this.graphzep as any).driver.createIndexes();
    }

    // Load product data
    await this.ingestProductsData();
    
    // Create user node
    await this.createUserNode('jess');
    
    logger.log('ShoeBotLangGraph agent initialized successfully!');
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

      for (let i = 0; i < Math.min(products.length, 20); i++) {
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
          logger.log(`Loaded ${i + 1} products...`);
        }
      }
      
      logger.log(`Successfully loaded ${Math.min(products.length, 20)} products`);
      
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
        sourceDescription: 'LangGraph SalesBot',
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
   * Process a user message through the LangGraph workflow
   */
  async processMessage(userInput: string, userName: string = 'jess'): Promise<string> {
    // Create initial state with the user message
    const initialState = {
      messages: [new HumanMessage(userInput)],
      userName,
      userNodeUuid: this.userNodeUuid || '',
      facts: 'No facts loaded yet',
    };

    // Invoke the graph
    const result = await this.graph.invoke(initialState);
    
    // Extract the assistant's response
    const lastMessage = result.messages[result.messages.length - 1];
    
    if (lastMessage && lastMessage._getType() === 'ai') {
      return lastMessage.content as string;
    }
    
    return "I'm sorry, I couldn't process your request. Please try again.";
  }

  /**
   * Run an interactive chat session
   */
  async runInteractiveChat(): Promise<void> {
    logger.log('\n=== Interactive ShoeBotLangGraph Chat Session ===');
    logger.log('SalesBot: Hello! Welcome to ManyBirds! How can I help you find the perfect shoes today?');
    logger.log('(Type "quit" or "exit" to end the conversation)\n');
    
    // Simple readline interface for demonstration
    const readline = await import('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const chatLoop = () => {
      rl.question('You: ', async (userInput) => {
        if (userInput.toLowerCase() === 'quit' || userInput.toLowerCase() === 'exit') {
          logger.log('\nSalesBot: Thanks for chatting! Come back anytime to find your perfect shoes!');
          rl.close();
          await this.close();
          return;
        }

        try {
          const response = await this.processMessage(userInput);
          logger.log(`\nSalesBot: ${response}\n`);
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
   * Run test interactions
   */
  async runTestInteractions(): Promise<void> {
    logger.log('\n=== Testing ShoeBotLangGraph Agent ===');
    
    // Test queries
    const testQueries = [
      "Hi, I'm looking for running shoes",
      "What sizes do the TinyBirds Wool Runners come in?",
      "I wear size 10 and prefer dark colors. What do you recommend?",
      "What's the price range for your athletic shoes?",
    ];
    
    for (const query of testQueries) {
      logger.log(`\nUser: ${query}`);
      const response = await this.processMessage(query);
      logger.log(`SalesBot: ${response}`);
      
      // Small delay between queries
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    logger.log('\n=== Test Complete ===');
  }

  /**
   * Close the Graphzep connection
   */
  async close(): Promise<void> {
    await this.graphzep.close();
    logger.log('ShoeBotLangGraph agent connections closed');
  }
}

// Main execution function
async function main(): Promise<void> {
  const agent = new ShoeBotLangGraphAgent();
  
  try {
    // Initialize the agent (set clearData to true to start fresh)
    await agent.initialize(true);
    
    // Wait for data to be processed
    logger.log('\nWaiting for data to be processed...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Run test interactions
    await agent.runTestInteractions();
    
    // Uncomment the following line to run an interactive chat session
    // await agent.runInteractiveChat();
    
  } catch (error) {
    logger.error('Error running ShoeBotLangGraph agent:', error);
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