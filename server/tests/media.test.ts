import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { inspectGlb, sniffMime } from '../src/services/media.service';
import { AppError } from '../src/utils/AppError';
import { loginAs } from './helpers';

function glb(json: object, opts: { version?: number; badLength?: boolean } = {}) {
  let j = Buffer.from(JSON.stringify(json));
  const pad = (4 - (j.length % 4)) % 4;
  j = Buffer.concat([j, Buffer.alloc(pad, 0x20)]);
  const header = Buffer.alloc(20);
  header.write('glTF', 0, 'ascii');
  header.writeUInt32LE(opts.version ?? 2, 4);
  header.writeUInt32LE(20 + j.length + (opts.badLength ? 4 : 0), 8);
  header.writeUInt32LE(j.length, 12);
  header.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([header, j]);
}

const mesh = { meshes: [{ primitives: [{ attributes: { POSITION: 0 } }] }], accessors: [{ count: 300 }], materials: [{}] };

describe('3D model validation', () => {
  it('accepts a minimal embedded glTF 2.0 binary', () => {
    expect(inspectGlb(glb(mesh))).toEqual({ meshes: 1, materials: 1, triangles: 100 });
  });
  it.each([
    ['wrong magic', Buffer.from('not a model at all, nope')],
    ['glTF 1.0', glb(mesh, { version: 1 })],
    ['bad length', glb(mesh, { badLength: true })],
    ['external buffer URI', glb({ ...mesh, buffers: [{ uri: 'https://evil.example/x.bin' }] })],
    ['external image URI', glb({ ...mesh, images: [{ uri: '../../etc/passwd' }] })],
    ['Draco compression', glb({ ...mesh, extensionsRequired: ['KHR_draco_mesh_compression'] })],
    ['no meshes', glb({ meshes: [] })],
    ['too many triangles', glb({ ...mesh, accessors: [{ count: 3_000_000 }] })],
  ])('rejects %s', (_label, buf) => {
    expect(() => inspectGlb(buf)).toThrow(AppError);
  });
});

describe('image uploads', () => {
  it('detects real file types from magic bytes', async () => {
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#c6ff3d' } }).png().toBuffer();
    expect(sniffMime(png)).toBe('image/png');
    expect(sniffMime(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'))).toBeNull();
  });

  it('accepts a valid image, re-encodes it and generates responsive variants', async () => {
    const { c } = await loginAs('admin');
    const jpg = await sharp({ create: { width: 1200, height: 800, channels: 3, background: '#222' } }).jpeg().toBuffer();
    const res = await c.post('/api/v1/media/images').field('folder', 'hero').attach('files', jpg, 'photo.jpg');
    expect(res.status).toBe(201);
    const asset = res.body.data.uploaded[0];
    expect(asset).toMatchObject({ mime: 'image/webp', width: 1200, height: 800, folder: 'hero', visibility: 'public' });
    expect(asset.url).toMatch(/^\/uploads\/public\/hero\//);
    expect(asset.variants.map((v: { width: number }) => v.width)).toEqual([480, 1024]);
    const served = await c.get(asset.url);
    expect(served.status).toBe(200);
    expect(served.headers['x-content-type-options']).toBe('nosniff');
  });

  it('rejects SVG / disguised files / wrong extensions', async () => {
    const { c } = await loginAs('admin');
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
    expect((await c.post('/api/v1/media/images').attach('files', svg, 'logo.svg')).status).toBe(400);
    expect((await c.post('/api/v1/media/images').attach('files', svg, 'fake.png')).status).toBe(400);
    const png = await sharp({ create: { width: 40, height: 40, channels: 3, background: '#000' } }).png().toBuffer();
    expect((await c.post('/api/v1/media/images').attach('files', png, 'script.php')).status).toBe(400);
  });

  it('members cannot use the media library but can upload private progress photos', async () => {
    const { c } = await loginAs('member');
    const png = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#333' } }).png().toBuffer();
    expect((await c.post('/api/v1/media/images').attach('files', png, 'a.png')).status).toBe(403);
    const up = await c.post('/api/v1/members/me/photos').field('pose', 'front').attach('file', png, 'me.png');
    expect(up.status).toBe(201);
    expect(up.body.data.url).toMatch(/^\/api\/v1\/media\/private\//);
    expect((await c.get(up.body.data.url)).status).toBe(200);
    const { c: stranger } = await loginAs('member');
    expect((await stranger.get(up.body.data.url)).status).toBe(404);
    const anon = await (await import('./helpers')).client();
    expect((await anon.get(up.body.data.url)).status).toBe(401);
  });
});
