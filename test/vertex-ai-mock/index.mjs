import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadFixtures } from './fixtures-loader.mjs';
import { handlePredictions } from './predictions.mjs';

const PORT = process.env.VERTEX_MOCK_PORT || 3001;

const fastify = Fastify({
  logger: false
});

await fastify.register(cors, {
  origin: true
});

const fixtureMap = loadFixtures();

fastify.get('/health', async (request, reply) => {
  return {
    status: 'ok',
    fixtures: fixtureMap.size
  };
});

fastify.post('/v1/projects/:projectId/locations/:location/publishers/google/models/*', async (request, reply) => {
  const content = request.body?.instances?.[0]?.content || '';
  const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;
  const timestamp = new Date().toISOString().substring(11, 23);
  console.log(`\u{1F4E5} [${timestamp}] Request received to embed "${preview}"`);
  return handlePredictions(request, reply, fixtureMap);
});

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`\u{1F680} Mock Vertex AI server running on http://localhost:${PORT}`);
  console.log(`\u{1F4E6} Loaded ${fixtureMap.size} fixtures`);
} catch (err) {
  console.error('\u274C Server error:', err);
  process.exit(1);
}
