import { describe, expect, it } from 'vitest';
import { DEFAULT_THEME, createSection } from '@apex/shared';
import { PageModel, PageVersionModel } from '../src/models';
import { client, loginAs } from './helpers';

async function seedHome() {
  const { c } = await loginAs('admin');
  const page = await PageModel.create({ slug: 'home', isHome: true, system: true, status: 'draft', draft: { title: 'Home', sections: [createSection('hero', { headline: 'Original headline' })] } });
  const pub = await c.post(`/api/v1/pages/${page._id}/publish`).send({});
  expect(pub.status).toBe(200);
  return { c, page };
}

describe('CMS draft & publishing', () => {
  it('draft edits are not visible publicly until published', async () => {
    const { c, page } = await seedHome();
    const anon = await client();
    const before = await anon.get('/api/v1/pages/public/home');
    expect(before.body.data.sections[0].props.headline).toBe('Original headline');

    const sections = [createSection('hero', { headline: 'New headline' }), createSection('faq')];
    const save = await c.put(`/api/v1/pages/${page._id}/draft`).send({ sections });
    expect(save.status).toBe(200);
    expect((await anon.get('/api/v1/pages/public/home')).body.data.sections[0].props.headline).toBe('Original headline');

    const pub = await c.post(`/api/v1/pages/${page._id}/publish`).send({ note: 'New hero' });
    expect(pub.body.data.version).toBe(2);
    const after = await anon.get('/api/v1/pages/public/home');
    expect(after.body.data.sections.map((s: { type: string }) => s.type)).toEqual(['hero', 'faq']);
    expect(after.body.data.sections[0].props.headline).toBe('New headline');
  });

  it('refuses to publish invalid drafts and keeps the live page intact', async () => {
    const { c, page } = await seedHome();
    const bad = { ...createSection('hero', { headline: 'x' }), props: { headline: '', ctas: [{ label: 'Go', href: 'javascript:alert(1)' }] } };
    const save = await c.put(`/api/v1/pages/${page._id}/draft`).send({ sections: [bad] });
    expect(save.status).toBe(200);
    expect(save.body.data.validation.ok).toBe(false);
    const pub = await c.post(`/api/v1/pages/${page._id}/publish`).send({});
    expect(pub.status).toBe(422);
    const paths = pub.body.error.details[0].issues.map((i: { path: string }) => i.path);
    expect(paths).toEqual(expect.arrayContaining(['props.headline', 'props.ctas.0.href']));
    const live = await (await client()).get('/api/v1/pages/public/home');
    expect(live.body.data.sections[0].props.headline).toBe('Original headline');
    expect(await PageVersionModel.countDocuments({ page: page._id })).toBe(1);
  });

  it('hidden sections are excluded from the public page; order is preserved', async () => {
    const { c, page } = await seedHome();
    const a = createSection('faq');
    const b = { ...createSection('stats'), enabled: false };
    const h = createSection('hero', { headline: 'Hi' });
    await c.put(`/api/v1/pages/${page._id}/draft`).send({ sections: [a, b, h] });
    await c.post(`/api/v1/pages/${page._id}/publish`).send({});
    const live = await (await client()).get('/api/v1/pages/public/home');
    expect(live.body.data.sections.map((s: { type: string }) => s.type)).toEqual(['faq', 'hero']);
  });

  it('restores an older version into the draft', async () => {
    const { c, page } = await seedHome();
    await c.put(`/api/v1/pages/${page._id}/draft`).send({ sections: [createSection('hero', { headline: 'Second' })] });
    await c.post(`/api/v1/pages/${page._id}/publish`).send({});
    const versions = await c.get(`/api/v1/pages/${page._id}/versions`);
    const v1 = versions.body.data.find((v: { version: number }) => v.version === 1);
    const restored = await c.post(`/api/v1/pages/${page._id}/versions/${v1._id}/restore`).send({});
    expect(restored.body.data.sections[0].props.headline).toBe('Original headline');
    expect(restored.body.data.hasUnpublishedChanges).toBe(true);
  });

  it('protects system pages and reserved slugs; unpublished pages 404 publicly', async () => {
    const { c, page } = await seedHome();
    expect((await c.delete(`/api/v1/pages/${page._id}`)).status).toBe(400);
    expect((await c.post('/api/v1/pages').send({ title: 'Admin', slug: 'admin' })).status).toBe(422);
    const created = await c.post('/api/v1/pages').send({ title: 'Corporate', slug: 'corporate' });
    expect(created.status).toBe(201);
    const anon = await client();
    expect((await anon.get('/api/v1/pages/public/corporate')).status).toBe(404);
    await c.post(`/api/v1/pages/${created.body.data.id}/publish`).send({});
    expect((await anon.get('/api/v1/pages/public/corporate')).status).toBe(200);
    await c.post(`/api/v1/pages/${created.body.data.id}/unpublish`).send({});
    expect((await anon.get('/api/v1/pages/public/corporate')).status).toBe(404);
  });

  it('bumps the content version on publish so clients refetch', async () => {
    const { c, page } = await seedHome();
    const v1 = (await c.get('/api/v1/cms/version')).body.data.contentVersion;
    await new Promise((r) => setTimeout(r, 5));
    await c.post(`/api/v1/pages/${page._id}/publish`).send({});
    const v2 = (await c.get('/api/v1/cms/version')).body.data.contentVersion;
    expect(v2).toBeGreaterThan(v1);
  });
});

describe('theme settings', () => {
  it('admin theme changes reach the public site only after publishing', async () => {
    const { c } = await loginAs('admin');
    const anon = await client();
    expect((await anon.get('/api/v1/themes/published')).body.data.colors.primary).toBe(DEFAULT_THEME.colors.primary);
    const tokens = { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: '#ff6b1a' }, fonts: { heading: 'Unbounded', body: 'DM Sans' } };
    expect((await c.put('/api/v1/themes/draft').send({ tokens })).status).toBe(200);
    expect((await anon.get('/api/v1/cms/site')).body.data.theme.colors.primary).toBe(DEFAULT_THEME.colors.primary);
    expect((await c.post('/api/v1/themes/publish')).status).toBe(200);
    const site = await anon.get('/api/v1/cms/site');
    expect(site.body.data.theme.colors.primary).toBe('#ff6b1a');
    expect(site.body.data.theme.fonts.heading).toBe('Unbounded');
  });

  it('validates theme tokens (colours, fonts allowlist)', async () => {
    const { c } = await loginAs('admin');
    const bad = await c.put('/api/v1/themes/draft').send({ tokens: { ...DEFAULT_THEME, colors: { ...DEFAULT_THEME.colors, primary: 'red; background:url(x)' }, fonts: { heading: 'Comic Sans', body: 'Inter' } } });
    expect(bad.status).toBe(422);
  });

  it('only users with cms:write can change the theme', async () => {
    const { c } = await loginAs('trainer');
    expect((await c.put('/api/v1/themes/draft').send({ tokens: DEFAULT_THEME })).status).toBe(403);
    const { c: granted } = await loginAs('trainer', { permissions: ['cms:write'] });
    expect((await granted.put('/api/v1/themes/draft').send({ tokens: DEFAULT_THEME })).status).toBe(200);
  });
});

describe('public content safety', () => {
  it('never exposes member gallery items without recorded consent', async () => {
    const { c } = await loginAs('admin');
    const noConsent = await c.post('/api/v1/cms/admin/gallery').send({ category: 'transformation', title: 'Story', published: true, consent: { given: false } });
    expect(noConsent.status).toBe(422);
    const ok = await c.post('/api/v1/cms/admin/gallery').send({ category: 'transformation', title: 'Story', published: true, consent: { given: true, reference: 'Signed form #12' } });
    expect(ok.status).toBe(201);
    expect(ok.body.data.consent.recordedBy).toBeTruthy();
    const pub = await (await client()).get('/api/v1/cms/public/gallery');
    expect(pub.body.data).toHaveLength(1);
    expect(pub.body.data[0].consent.reference).toBeUndefined();
  });

  it('site bootstrap does not leak notification settings', async () => {
    const res = await (await client()).get('/api/v1/cms/site');
    expect(res.status).toBe(200);
    expect(res.body.data.settings.notifications).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain('rzp_test_key_secret');
  });
});
