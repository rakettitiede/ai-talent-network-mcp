import { lookupFixture } from './fixtures-loader.mjs';

/**
 * Handles POST /v1/embeddings requests
 * @param {object} request - Fastify request object
 * @param {object} reply - Fastify reply object
 * @param {Map<string, object>} fixtureMap - The fixture map
 */
export async function handleEmbeddings(request, reply, fixtureMap) {
  try {
    const { model, input } = request.body;
    
    // Validate request
    if (!model) {
      return reply.code(400).send({
        error: {
          message: "Missing required parameter: model",
          type: "invalid_request_error",
          param: "model"
        }
      });
    }
    
    if (!input) {
      return reply.code(400).send({
        error: {
          message: "Missing required parameter: input",
          type: "invalid_request_error",
          param: "input"
        }
      });
    }
    
    // Handle both single string and array of strings
    const inputs = Array.isArray(input) ? input : [input];
    const responses = [];
    
    for (let i = 0; i < inputs.length; i++) {
      const text = String(inputs[i]);
      const fixture = lookupFixture(text, fixtureMap);
      
      if (fixture) {
        // Use fixture response, but ensure index matches array position
        const response = JSON.parse(JSON.stringify(fixture)); // Deep copy
        if (response.data && response.data[0]) {
          response.data[0].index = i;
          
          // Always return base64 format (default for test mock server)
          // Convert embedding array to base64 string
          if (Array.isArray(response.data[0].embedding)) {
            const embeddingArray = response.data[0].embedding;
            const float32Array = new Float32Array(embeddingArray);
            const buffer = Buffer.from(float32Array.buffer);
            response.data[0].embedding = buffer.toString('base64');
          }
        }
        responses.push(response.data[0]);
      } else {
        // Fixture not found - return error
        // Tests expect exact embeddings, so missing fixtures should be captured first
        return reply.code(404).send({
          error: {
            message: `Fixture not found for text: "${text.substring(0, 100)}${text.length > 100 ? '...' : ''}". Please capture this fixture first by running tests with OPENAI_KEY set.`,
            type: "fixture_not_found_error",
            param: "input"
          }
        });
      }
    }
    
    // Return response matching OpenAI API format
    const response = {
      object: "list",
      data: responses,
      model: model,
      usage: {
        prompt_tokens: inputs.reduce((sum, text) => sum + Math.ceil(String(text).length / 4), 0),
        total_tokens: inputs.reduce((sum, text) => sum + Math.ceil(String(text).length / 4), 0)
      }
    };
    
    return reply.send(response);
  } catch (error) {
    console.error('❌ Error handling embeddings request:', error);
    return reply.code(500).send({
      error: {
        message: "Internal server error",
        type: "server_error"
      }
    });
  }
}
