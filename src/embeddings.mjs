import OpenAI from 'openai';
import { OPENAI_KEY, EMBEDDING_MODEL_NAME, OPENAI_BASE_URL } from './constants.mjs';

const client = new OpenAI({
  apiKey: OPENAI_KEY,
  baseURL: OPENAI_BASE_URL,
});

export async function embed(text) {

  const { data } = await client.embeddings.create({
    model: EMBEDDING_MODEL_NAME,
    input: text,
  });

  const f32 = new Float32Array(data[0].embedding);

  return JSON.stringify(Array.from(f32));
}
