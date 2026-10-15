import supertest from 'supertest';
import type { Role } from '@apex/shared';
import { createApp } from '../src/app';
import { MembershipPlanModel, UserModel } from '../src/models';
import { hashPassword } from '../src/services/auth.service';
import { ensureMemberProfile } from '../src/services/member.service';
import { randomToken } from '../src/utils/crypto';

export const app = createApp();
export const PASSWORD = 'Str0ngPassword!';

/** A cookie-keeping client that automatically sends the CSRF header on mutating requests. */
export async function client() {
  const agent = supertest.agent(app);
  const res = await agent.get('/api/v1/auth/csrf');
  const token: string = res.body.data.csrfToken;
  const wrap = (method: 'post' | 'put' | 'patch' | 'delete') => (url: string) => agent[method](url).set('X-CSRF-Token', token);
  return { agent, token, get: (url: string) => agent.get(url), post: wrap('post'), put: wrap('put'), patch: wrap('patch'), delete: wrap('delete') };
}
export type Client = Awaited<ReturnType<typeof client>>;

let n = 0;
export async function createUser(role: Role = 'member', extra: Record<string, unknown> = {}) {
  n++;
  const user = await UserModel.create({ name: `${role} ${n}`, email: `${role}${n}-${randomToken(4)}@test.dev`.toLowerCase(), passwordHash: await hashPassword(PASSWORD), role, qrToken: randomToken(18), ...extra });
  if (role === 'member') await ensureMemberProfile(user._id);
  return user;
}

export async function loginAs(role: Role = 'member', extra: Record<string, unknown> = {}) {
  const user = await createUser(role, extra);
  const c = await client();
  const res = await c.post('/api/v1/auth/login').send({ email: user.email, password: PASSWORD });
  if (res.status !== 200) throw new Error(`login failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { user, c };
}

export async function createPlan(overrides: Record<string, unknown> = {}) {
  n++;
  return MembershipPlanModel.create({ name: `Plan ${n}`, slug: `plan-${n}-${randomToken(3).toLowerCase().replace(/[^a-z0-9]/g, 'x')}`, durationDays: 30, priceMinor: 250000, ...overrides });
}
