import { lookupFixture } from './fixtures-loader.mjs';

export async function handlePredictions(request, reply, fixtureMap) {
  try {
    const { instances } = request.body;

    if (!instances || !Array.isArray(instances) || instances.length === 0) {
      return reply.code(400).send({
        error: {
          code: 400,
          message: 'Missing required parameter: instances',
          status: 'INVALID_ARGUMENT',
        },
      });
    }

    const content = instances[0].content;
    if (!content) {
      return reply.code(400).send({
        error: {
          code: 400,
          message: 'Missing required parameter: instances[0].content',
          status: 'INVALID_ARGUMENT',
        },
      });
    }

    const text = String(content);
    const fixture = lookupFixture(text, fixtureMap);

    if (fixture) {
      return reply.send(fixture);
    }

    return reply.code(404).send({
      error: {
        code: 404,
        message: `Fixture not found for text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}". Please capture this fixture first by running the capture script with real Vertex AI credentials.`,
        status: 'NOT_FOUND',
      },
    });
  } catch (error) {
    console.error('\u274C Error handling predictions request:', error);
    return reply.code(500).send({
      error: {
        code: 500,
        message: 'Internal server error',
        status: 'INTERNAL',
      },
    });
  }
}
