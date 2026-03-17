import { GoogleAuth } from 'google-auth-library';
import { GCP_SCOPE, GCP_MOCK_VERTEX_URL, GCP_VERTEX_URL } from './constants.mjs';

export async function embed(text) {
  if (GCP_MOCK_VERTEX_URL) {
    const res = await fetch(GCP_MOCK_VERTEX_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ instances: [{ content: text }] }),
    });
    const data = await res.json();
    const values = data.predictions[0].embeddings.values;
    const f32 = new Float32Array(values);
    return JSON.stringify(Array.from(f32));
  }

  const auth = new GoogleAuth({ scopes: [GCP_SCOPE] });
  const client = await auth.getClient();
  const { data } = await client.request({
    url: GCP_VERTEX_URL,
    method: 'POST',
    data: { instances: [{ content: text }] },
  });

  const values = data.predictions[0].embeddings.values;
  const f32 = new Float32Array(values);
  return JSON.stringify(Array.from(f32));
}
