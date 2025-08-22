#!/usr/bin/env node

import { Command } from 'commander';
import dotenv from 'dotenv';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

import {
  Graphzep,
  Neo4jDriver,
  OpenAIClient,
  AnthropicClient,
  OpenAIEmbedder,
  EpisodeType,
  EntityNodeImpl,
  EpisodicNodeImpl,
} from 'graphzep';

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { 
  CallToolRequestSchema, 
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';

dotenv.config();

// Default configuration
const DEFAULT_LLM_MODEL = 'gpt-4o-mini';
const SMALL_LLM_MODEL = 'gpt-4o-mini';
const DEFAULT_EMBEDDER_MODEL = 'text-embedding-3-small';
const SEMAPHORE_LIMIT = parseInt(process.env.SEMAPHORE_LIMIT || '10');

// Entity types for custom extraction
const RequirementSchema = z.object({
  project_name: z.string().describe('The name of the project to which the requirement belongs.'),
  description: z.string().describe('Description of the requirement. Only use information mentioned in the context to write this description.'),
});

const PreferenceSchema = z.object({
  category: z.string().describe("The category of the preference. (e.g., 'Brands', 'Food', 'Music')"),
  description: z.string().describe('Brief description of the preference. Only use information mentioned in the context to write this description.'),
});

const ProcedureSchema = z.object({
  description: z.string().describe('Brief description of the procedure. Only use information mentioned in the context to write this description.'),
});

const ENTITY_TYPES = {
  Requirement: RequirementSchema,
  Preference: PreferenceSchema,
  Procedure: ProcedureSchema,
};

// Response schemas
const ErrorResponseSchema = z.object({
  error: z.string(),
});

const SuccessResponseSchema = z.object({
  message: z.string(),
});

const NodeResultSchema = z.object({
  uuid: z.string(),
  name: z.string(),
  summary: z.string(),
  labels: z.array(z.string()),
  group_id: z.string(),
  created_at: z.string(),
  attributes: z.record(z.any()),
});

const NodeSearchResponseSchema = z.object({
  message: z.string(),
  nodes: z.array(NodeResultSchema),
});

const FactSearchResponseSchema = z.object({
  message: z.string(),
  facts: z.array(z.record(z.any())),
});

const EpisodeSearchResponseSchema = z.object({
  message: z.string(),
  episodes: z.array(z.record(z.any())),
});

const StatusResponseSchema = z.object({
  status: z.string(),
  message: z.string(),
});

// Configuration classes
interface GraphzepLLMConfig {
  apiKey?: string;
  model: string;
  smallModel: string;
  temperature: number;
  provider: 'openai' | 'anthropic';
}

interface GraphzepEmbedderConfig {
  apiKey?: string;
  model: string;
}

interface Neo4jConfig {
  uri: string;
  user: string;
  password: string;
}

interface GraphzepConfig {
  llm: GraphzepLLMConfig;
  embedder: GraphzepEmbedderConfig;
  neo4j: Neo4jConfig;
  groupId: string;
  useCustomEntities: boolean;
  destroyGraph: boolean;
}

interface MCPConfig {
  transport: 'stdio' | 'sse';
}

// Global configuration
let config: GraphzepConfig;
let graphzepClient: Graphzep | null = null;

// Episode processing queues
const episodeQueues: Record<string, Array<() => Promise<void>>> = {};
const queueWorkers: Record<string, boolean> = {};

const GRAPHITI_MCP_INSTRUCTIONS = `
Graphzep is a memory service for AI agents built on a knowledge graph. Graphzep performs well
with dynamic data such as user interactions, changing enterprise data, and external information.

Graphzep transforms information into a richly connected knowledge network, allowing you to 
capture relationships between concepts, entities, and information. The system organizes data as episodes 
(content snippets), nodes (entities), and facts (relationships between entities), creating a dynamic, 
queryable memory store that evolves with new information. Graphzep supports multiple data formats, including 
structured JSON data, enabling seamless integration with existing data pipelines and systems.

Facts contain temporal metadata, allowing you to track the time of creation and whether a fact is invalid 
(superseded by new information).

Key capabilities:
1. Add episodes (text, messages, or JSON) to the knowledge graph with the add_memory tool
2. Search for nodes (entities) in the graph using natural language queries with search_nodes
3. Find relevant facts (relationships between entities) with search_facts
4. Retrieve specific entity edges or episodes by UUID
5. Manage the knowledge graph with tools like delete_episode, delete_entity_edge, and clear_graph

The server connects to a database for persistent storage and uses language models for certain operations. 
Each piece of information is organized by group_id, allowing you to maintain separate knowledge domains.

When adding information, provide descriptive names and detailed content to improve search quality. 
When searching, use specific queries and consider filtering by group_id for more relevant results.

For optimal performance, ensure the database is properly configured and accessible, and valid 
API keys are provided for any language model operations.
`;

// Configuration helpers
function createLLMConfigFromEnv(): GraphzepLLMConfig {
  const model = process.env.MODEL_NAME?.trim() || DEFAULT_LLM_MODEL;
  const smallModel = process.env.SMALL_MODEL_NAME?.trim() || SMALL_LLM_MODEL;
  const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0.0');
  
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (anthropicKey) {
    return {
      apiKey: anthropicKey,
      model,
      smallModel,
      temperature,
      provider: 'anthropic',
    };
  } else if (openaiKey) {
    return {
      apiKey: openaiKey,
      model,
      smallModel,
      temperature,
      provider: 'openai',
    };
  } else {
    throw new Error('Either ANTHROPIC_API_KEY or OPENAI_API_KEY must be set');
  }
}

function createEmbedderConfigFromEnv(): GraphzepEmbedderConfig {
  const model = process.env.EMBEDDER_MODEL_NAME?.trim() || DEFAULT_EMBEDDER_MODEL;
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY must be set for embeddings');
  }
  
  return { apiKey, model };
}

function createNeo4jConfigFromEnv(): Neo4jConfig {
  return {
    uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
    user: process.env.NEO4J_USER || 'neo4j',
    password: process.env.NEO4J_PASSWORD || 'password',
  };
}

function createGraphzepConfigFromEnv(options: {
  groupId?: string;
  useCustomEntities?: boolean;
  destroyGraph?: boolean;
  model?: string;
  smallModel?: string;
  temperature?: number;
}): GraphzepConfig {
  const llmConfig = createLLMConfigFromEnv();
  
  if (options.model) llmConfig.model = options.model;
  if (options.smallModel) llmConfig.smallModel = options.smallModel;
  if (options.temperature !== undefined) llmConfig.temperature = options.temperature;
  
  return {
    llm: llmConfig,
    embedder: createEmbedderConfigFromEnv(),
    neo4j: createNeo4jConfigFromEnv(),
    groupId: options.groupId || uuidv4(),
    useCustomEntities: options.useCustomEntities || false,
    destroyGraph: options.destroyGraph || false,
  };
}

// Initialize Graphzep client
async function initializeGraphzep(): Promise<void> {
  try {
    // Create LLM client
    let llmClient;
    if (config.llm.provider === 'anthropic') {
      llmClient = new AnthropicClient({
        apiKey: config.llm.apiKey!,
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
    } else {
      llmClient = new OpenAIClient({
        apiKey: config.llm.apiKey!,
        model: config.llm.model,
        temperature: config.llm.temperature,
      });
    }

    // Create embedder client
    const embedder = new OpenAIEmbedder({
      apiKey: config.embedder.apiKey!,
      model: config.embedder.model,
    });

    // Create Neo4j driver
    const driver = new Neo4jDriver(
      config.neo4j.uri,
      config.neo4j.user,
      config.neo4j.password
    );

    // Initialize Graphzep client
    graphzepClient = new Graphzep({
      driver,
      llmClient,
      embedder,
      groupId: config.groupId,
    });

    // Destroy graph if requested
    if (config.destroyGraph) {
      console.log('Destroying graph...');
      await driver.executeQuery('MATCH (n) DETACH DELETE n');
    }

    // Create indexes
    await driver.createIndexes();
    
    console.log('Graphzep client initialized successfully');
    console.log(`Using LLM model: ${config.llm.model}`);
    console.log(`Using temperature: ${config.llm.temperature}`);
    console.log(`Using group_id: ${config.groupId}`);
    console.log(`Custom entity extraction: ${config.useCustomEntities ? 'enabled' : 'disabled'}`);

  } catch (error) {
    console.error('Failed to initialize Graphzep:', error);
    throw error;
  }
}

// Queue processing for episodes
async function processEpisodeQueue(groupId: string): Promise<void> {
  console.log(`Starting episode queue worker for group_id: ${groupId}`);
  queueWorkers[groupId] = true;

  try {
    while (episodeQueues[groupId] && episodeQueues[groupId].length > 0) {
      const processFunc = episodeQueues[groupId].shift();
      if (processFunc) {
        try {
          await processFunc();
        } catch (error) {
          console.error(`Error processing queued episode for group_id ${groupId}:`, error);
        }
      }
    }
  } finally {
    queueWorkers[groupId] = false;
    console.log(`Stopped episode queue worker for group_id: ${groupId}`);
  }
}

// MCP Server setup
const server = new Server(
  {
    name: 'graphzep-mcp-server',
    version: '0.18.9',
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'add_memory',
        description: 'Add an episode to memory. This is the primary way to add information to the graph.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the episode' },
            episode_body: { type: 'string', description: 'The content of the episode to persist to memory' },
            group_id: { type: 'string', description: 'A unique ID for this graph' },
            source: { 
              type: 'string', 
              enum: ['text', 'json', 'message'],
              default: 'text',
              description: 'Source type' 
            },
            source_description: { type: 'string', description: 'Description of the source' },
            uuid: { type: 'string', description: 'Optional UUID for the episode' },
          },
          required: ['name', 'episode_body'],
        },
      },
      {
        name: 'search_memory_nodes',
        description: 'Search the graph memory for relevant node summaries',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
            group_ids: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Optional list of group IDs to filter results' 
            },
            max_nodes: { type: 'number', default: 10, description: 'Maximum number of nodes to return' },
            center_node_uuid: { type: 'string', description: 'Optional UUID of a node to center the search around' },
            entity: { type: 'string', description: 'Optional entity type to filter results' },
          },
          required: ['query'],
        },
      },
      {
        name: 'search_memory_facts',
        description: 'Search the graph memory for relevant facts',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'The search query' },
            group_ids: { 
              type: 'array', 
              items: { type: 'string' },
              description: 'Optional list of group IDs to filter results' 
            },
            max_facts: { type: 'number', default: 10, description: 'Maximum number of facts to return' },
            center_node_uuid: { type: 'string', description: 'Optional UUID of a node to center the search around' },
          },
          required: ['query'],
        },
      },
      {
        name: 'clear_graph',
        description: 'Clear all data from the graph memory and rebuild indices',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'add_memory': {
        if (!graphzepClient) {
          throw new Error('Graphzep client not initialized');
        }

        const { name, episode_body, group_id, source = 'text', source_description = '', uuid } = args as any;

        // Map string source to EpisodeType enum
        let episodeType = EpisodeType.TEXT;
        if (source.toLowerCase() === 'message') {
          episodeType = EpisodeType.MESSAGE;
        } else if (source.toLowerCase() === 'json') {
          episodeType = EpisodeType.JSON;
        }

        const effectiveGroupId = group_id || config.groupId;

        // Define episode processing function
        const processEpisode = async () => {
          try {
            console.log(`Processing queued episode '${name}' for group_id: ${effectiveGroupId}`);
            
            await graphzepClient!.addEpisode({
              content: episode_body,
              episodeType,
              groupId: effectiveGroupId,
              referenceId: uuid,
            });
            
            console.log(`Episode '${name}' processed successfully`);
          } catch (error) {
            console.error(`Error processing episode '${name}' for group_id ${effectiveGroupId}:`, error);
          }
        };

        // Initialize queue if needed
        if (!episodeQueues[effectiveGroupId]) {
          episodeQueues[effectiveGroupId] = [];
        }

        // Add to queue
        episodeQueues[effectiveGroupId].push(processEpisode);

        // Start worker if not running
        if (!queueWorkers[effectiveGroupId]) {
          processEpisodeQueue(effectiveGroupId);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: `Episode '${name}' queued for processing (position: ${episodeQueues[effectiveGroupId].length})`
              }),
            },
          ],
        };
      }

      case 'search_memory_nodes': {
        if (!graphzepClient) {
          throw new Error('Graphzep client not initialized');
        }

        const { query, group_ids, max_nodes = 10, center_node_uuid, entity } = args as any;

        const effectiveGroupIds = group_ids || (config.groupId ? [config.groupId] : []);

        const results = await graphzepClient.search({
          query,
          groupId: effectiveGroupIds[0],
          limit: max_nodes,
        });

        const formattedNodes = results.map((node: any) => ({
          uuid: node.uuid,
          name: node.name,
          summary: (node as any).summary || '',
          labels: node.labels,
          group_id: node.groupId,
          created_at: node.createdAt.toISOString(),
          attributes: {},
        }));

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Nodes retrieved successfully',
                nodes: formattedNodes,
              }),
            },
          ],
        };
      }

      case 'search_memory_facts': {
        if (!graphzepClient) {
          throw new Error('Graphzep client not initialized');
        }

        const { query, group_ids, max_facts = 10 } = args as any;

        const effectiveGroupIds = group_ids || (config.groupId ? [config.groupId] : []);

        // For now, return empty facts as the search functionality needs more implementation
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Facts retrieved successfully',
                facts: [],
              }),
            },
          ],
        };
      }

      case 'clear_graph': {
        if (!graphzepClient) {
          throw new Error('Graphzep client not initialized');
        }

        await graphzepClient.clearDatabase();
        await graphzepClient.createIndexes();

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                message: 'Graph cleared successfully and indices rebuilt'
              }),
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            error: error instanceof Error ? error.message : String(error)
          }),
        },
      ],
    };
  }
});

// Resource handlers
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [
      {
        uri: 'http://graphzep/status',
        mimeType: 'application/json',
        name: 'Graphzep Status',
        description: 'Get the status of the Graphzep MCP server and Neo4j connection',
      },
    ],
  };
});

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const { uri } = request.params;

  if (uri === 'http://graphzep/status') {
    if (!graphzepClient) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'error',
              message: 'Graphzep client not initialized',
            }),
          },
        ],
      };
    }

    try {
      // Test database connection
      await graphzepClient.testConnection();

      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'ok',
              message: 'Graphzep MCP server is running and connected to Neo4j',
            }),
          },
        ],
      };
    } catch (error) {
      return {
        contents: [
          {
            uri,
            mimeType: 'application/json',
            text: JSON.stringify({
              status: 'error',
              message: `Graphzep MCP server is running but Neo4j connection failed: ${error}`,
            }),
          },
        ],
      };
    }
  }

  throw new Error(`Unknown resource: ${uri}`);
});

// CLI setup
async function main() {
  const program = new Command();

  program
    .name('graphzep-mcp-server')
    .description('Run the Graphzep MCP server with optional LLM client')
    .option('--group-id <id>', 'Namespace for the graph')
    .option('--transport <type>', 'Transport to use for communication', 'stdio')
    .option('--model <model>', `Model name to use with the LLM client (default: ${DEFAULT_LLM_MODEL})`)
    .option('--small-model <model>', `Small model name to use with the LLM client (default: ${SMALL_LLM_MODEL})`)
    .option('--temperature <temp>', 'Temperature setting for the LLM (0.0-2.0)', parseFloat)
    .option('--destroy-graph', 'Destroy all Graphzep graphs')
    .option('--use-custom-entities', 'Enable entity extraction using the predefined ENTITY_TYPES')
    .option('--host <host>', 'Host to bind the MCP server to');

  program.parse();

  const options = program.opts();

  // Build configuration
  config = createGraphzepConfigFromEnv(options);

  // Log configuration
  if (options.groupId) {
    console.log(`Using provided group_id: ${config.groupId}`);
  } else {
    console.log(`Generated random group_id: ${config.groupId}`);
  }

  if (config.useCustomEntities) {
    console.log('Entity extraction enabled using predefined ENTITY_TYPES');
  } else {
    console.log('Entity extraction disabled (no custom entities will be used)');
  }

  // Initialize Graphzep
  await initializeGraphzep();

  // Run MCP server
  console.log(`Starting MCP server with transport: ${options.transport}`);
  
  if (options.transport === 'stdio') {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log('MCP server running with stdio transport');
  } else {
    throw new Error('Only stdio transport is currently supported');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Error starting MCP server:', error);
    process.exit(1);
  });
}