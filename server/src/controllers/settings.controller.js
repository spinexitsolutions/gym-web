import * as settings from '../services/settings.service.js';
import { audit } from '../services/audit.service.js';
import { ok } from '../utils/apiResponse.js';

export const getDraft = async (_req, res) => ok(res, await settings.getDraftSettings());

export async function saveDraft(req, res) {
  const data = await settings.saveDraft(req.body, req.user._id);
  await audit(req, { action: 'settings.save_draft', entity: 'WebsiteSettings', summary: `Updated: ${Object.keys(req.body).join(', ')}` });
  return ok(res, data, { message: 'Draft saved' });
}

export async function publish(req, res) {
  const data = await settings.publishDraft(req.user._id);
  await audit(req, { action: 'settings.publish', entity: 'WebsiteSettings', summary: `Published version ${data.version}` });
  return ok(res, data, { message: 'Website updated' });
}

export async function discard(req, res) {
  const data = await settings.discardDraft(req.user._id);
  await audit(req, { action: 'settings.discard_draft', entity: 'WebsiteSettings' });
  return ok(res, data, { message: 'Draft discarded' });
}
