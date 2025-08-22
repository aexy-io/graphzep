import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { zValidator } from '@hono/zod-validator';
import { getSettings } from './config/settings.js';
import { 
  AddMessagesRequestSchema,
  type AddMessagesRequest
} from './dto/ingest.js';
import {
  SearchQuerySchema,
  GetMemoryRequestSchema,
  type SearchQuery,
  type GetMemoryRequest,
  type SearchResults,
  type GetMemoryResponse,
  type FactResult
} from './dto/retrieve.js';
import { type Message } from './dto/common.js';

const app = new Hono();

// Simple in-memory storage for demonstration
// In production, this would use the actual Neo4j/GraphDB
const messages: Array<Message & { group_id: string }> = [];
const episodes: Array<{ uuid: string; group_id: string; content: string; timestamp: string }> = [];

// Simple async worker queue
const jobQueue: (() => Promise<void>)[] = [];
let isProcessing = false;

async function processQueue() {
  if (isProcessing) return;
  isProcessing = true;
  
  while (jobQueue.length > 0) {
    const job = jobQueue.shift();
    if (job) {
      try {
        console.log(`Processing job: (remaining queue: ${jobQueue.length})`);
        await job();
      } catch (error) {
        console.error('Job error:', error);
      }
    }
  }
  
  isProcessing = false;
}

// Initialize server
async function initializeServer() {
  const settings = getSettings();
  console.log('Server initialized with settings');
  console.log('Neo4j URI:', settings.NEO4J_URI);
  console.log('OpenAI configured:', !!settings.OPENAI_API_KEY);
}

// Health check
app.get('/healthcheck', (c) => {
  return c.json({ status: 'healthy' });
});

// Ingest routes
app.post('/messages', zValidator('json', AddMessagesRequestSchema), async (c) => {
  const request: AddMessagesRequest = c.req.valid('json');

  const addMessagesTask = async (m: Message) => {
    // Store message in memory for now
    messages.push({ ...m, group_id: request.group_id });
    
    // Create episode
    episodes.push({
      uuid: m.uuid || `episode_${Date.now()}_${Math.random()}`,
      group_id: request.group_id,
      content: `${m.role || ''}(${m.role_type}): ${m.content}`,
      timestamp: m.timestamp,
    });
    
    console.log(`Added episode for group ${request.group_id}: ${m.content.substring(0, 50)}...`);
  };

  for (const message of request.messages) {
    jobQueue.push(() => addMessagesTask(message));
  }

  // Start processing if not already running
  processQueue().catch(console.error);

  return c.json({ message: 'Messages added to processing queue', success: true }, 202);
});

app.delete('/group/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  
  // Remove messages and episodes for this group
  const messageCount = messages.length;
  const episodeCount = episodes.length;
  
  messages.splice(0, messages.length, ...messages.filter(m => m.group_id !== groupId));
  episodes.splice(0, episodes.length, ...episodes.filter(e => e.group_id !== groupId));
  
  console.log(`Deleted group ${groupId}: ${messageCount - messages.length} messages, ${episodeCount - episodes.length} episodes`);
  
  return c.json({ message: 'Group deleted', success: true });
});

app.post('/clear', async (c) => {
  messages.length = 0;
  episodes.length = 0;
  
  console.log('Cleared all data');
  
  return c.json({ message: 'Graph cleared', success: true });
});

// Retrieve routes
app.post('/search', zValidator('json', SearchQuerySchema), async (c) => {
  const query: SearchQuery = c.req.valid('json');

  // Simple search implementation - filter episodes by group and content
  const relevantEpisodes = episodes.filter(episode => {
    const matchesGroup = !query.group_ids || query.group_ids.includes(episode.group_id);
    const matchesQuery = episode.content.toLowerCase().includes(query.query.toLowerCase());
    return matchesGroup && matchesQuery;
  });

  // Convert episodes to facts
  const facts: FactResult[] = relevantEpisodes.slice(0, query.max_facts).map(episode => ({
    uuid: episode.uuid,
    name: `Episode ${episode.uuid.slice(-6)}`,
    fact: episode.content,
    valid_at: episode.timestamp,
    invalid_at: null,
    created_at: episode.timestamp,
    expired_at: null,
  }));

  const results: SearchResults = { facts };
  
  console.log(`Search for "${query.query}" returned ${facts.length} results`);
  
  return c.json(results);
});

app.get('/episodes/:groupId', async (c) => {
  const groupId = c.req.param('groupId');
  const lastN = parseInt(c.req.query('last_n') || '10');

  const groupEpisodes = episodes
    .filter(episode => episode.group_id === groupId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, lastN);

  console.log(`Retrieved ${groupEpisodes.length} episodes for group ${groupId}`);

  return c.json(groupEpisodes);
});

app.post('/get-memory', zValidator('json', GetMemoryRequestSchema), async (c) => {
  const request: GetMemoryRequest = c.req.valid('json');

  const combinedQuery = request.messages.map(m => 
    `${m.role_type || ''}(${m.role || ''}): ${m.content}`
  ).join(' ');

  // Find relevant episodes
  const relevantEpisodes = episodes
    .filter(episode => episode.group_id === request.group_id)
    .filter(episode => {
      const content = episode.content.toLowerCase();
      return request.messages.some(m => 
        content.includes(m.content.toLowerCase()) ||
        combinedQuery.toLowerCase().includes(content)
      );
    })
    .slice(0, request.max_facts);

  const facts: FactResult[] = relevantEpisodes.map(episode => ({
    uuid: episode.uuid,
    name: `Memory ${episode.uuid.slice(-6)}`,
    fact: episode.content,
    valid_at: episode.timestamp,
    invalid_at: null,
    created_at: episode.timestamp,
    expired_at: null,
  }));

  const response: GetMemoryResponse = { facts };
  
  console.log(`Get memory for group ${request.group_id} returned ${facts.length} facts`);
  
  return c.json(response);
});

// Error handler
app.onError((err, c) => {
  console.error('Server error:', err);
  return c.json({ error: err.message }, 500);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  process.exit(0);
});

// Start server
async function startServer() {
  try {
    await initializeServer();
    
    const settings = getSettings();
    const port = settings.PORT || 3000;
    
    console.log(`Graphzep server is running on port ${port}`);
    console.log('Available endpoints:');
    console.log('  GET  /healthcheck');
    console.log('  POST /messages');
    console.log('  POST /search');
    console.log('  POST /get-memory');
    console.log('  GET  /episodes/:groupId');
    console.log('  DELETE /group/:groupId');
    console.log('  POST /clear');
    
    serve({
      fetch: app.fetch,
      port,
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer().catch(console.error);