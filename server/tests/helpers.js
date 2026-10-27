import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

// A cookie-keeping agent that has fetched a CSRF token, like the browser client does.
export async function browserAgent() {
  const agent = request.agent(app);
  const res = await agent.get('/api/auth/csrf');
  const token = res.body.data.csrfToken;
  const send = (method) => (url) => agent[method](url).set('X-CSRF-Token', token);
  return { agent, token, get: (url) => agent.get(url), post: send('post'), patch: send('patch'), delete: send('delete') };
}
