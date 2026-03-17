import Fastify from 'fastify';
import cors from '@fastify/cors';
import { loadFixtures, getFixture, getFixtureCount } from './fixtures-loader.mjs';

const PORT = process.env.AGILEDAY_MOCK_PORT || 3000;

const fastify = Fastify({
  logger: false
});

// Register CORS
await fastify.register(cors, {
  origin: true
});

// Load fixtures on startup
loadFixtures();

// Routes
fastify.get('/api/v1/employee', async () => {
  console.log(`[${new Date().toISOString()}] 👷 GET /api/v1/employee`);
  return getFixture('employee');
});

fastify.get('/api/v1/history_project', async () => {
  console.log(`[${new Date().toISOString()}] 📋 GET /api/v1/history_project`);
  return getFixture('history_project');
});

fastify.get('/api/v1/opening', async () => {
  console.log(`[${new Date().toISOString()}] 🎯 GET /api/v1/opening`);
  return getFixture('opening');
});

fastify.get('/api/v1/project', async () => {
  console.log(`[${new Date().toISOString()}] 📁 GET /api/v1/project`);
  return getFixture('project');
});

fastify.get('/api/v1/allocation_reporting', async () => {
  console.log(`[${new Date().toISOString()}] 📊 GET /api/v1/allocation_reporting`);
  return getFixture('allocation_reporting');
});

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', fixtures: getFixtureCount() };
});

// Start server
try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`🚀 Mock Agileday API server running on http://localhost:${PORT}`);
  console.log(`📦 Loaded ${getFixtureCount()} fixtures`);
} catch (err) {
  console.error('Failed to start server:', err);
  process.exit(1);
}
