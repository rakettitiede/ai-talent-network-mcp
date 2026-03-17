import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadFixtures } from './fixtures-loader.mjs';
import { handleEmbeddings } from './embeddings.mjs';

const PORT = process.env.OPENAI_MOCK_PORT || 3001;

// Create Fastify instance
const fastify = Fastify({
  logger: false // Disable Fastify's built-in logger to avoid duplicate logs
});

// Register CORS plugin
await fastify.register(cors, {
  origin: true // Allow all origins
});

// Load fixtures once at startup
const fixtureMap = loadFixtures();

// Health check endpoint
fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    fixtures: fixtureMap.size
  };
});

// Embeddings endpoint
fastify.post('/v1/embeddings', async (request, reply) => {
  const inputText = typeof request.body?.input === 'string' 
    ? request.body.input 
    : Array.isArray(request.body?.input) ? request.body.input[0] : String(request.body?.input || '');
  const preview = inputText.length > 50 ? inputText.substring(0, 50) + '...' : inputText;
  const timestamp = new Date().toISOString().substring(11, 23); // HH:MM:SS.mmm
  console.log(`📥 [${timestamp}] Request received to embed "${preview}"`);
  return handleEmbeddings(request, reply, fixtureMap);
});

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Mock OpenAI API server running on http://localhost:${PORT}`);
  console.log(`📦 Loaded ${fixtureMap.size} fixtures`);
} catch (err) {
  console.error('❌ Server error:', err);
  process.exit(1);
}
