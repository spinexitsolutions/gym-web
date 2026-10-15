import mongoose from 'mongoose';
import { afterAll, afterEach, beforeAll, inject } from 'vitest';
import { connectDb } from '../src/config/db';
import { sentEmails } from '../src/services/email.service';
import { invalidateSettingsCache } from '../src/services/settings.service';

beforeAll(async () => {
  const base = inject('mongoUri');
  const dbName = `apex_test_${Math.random().toString(36).slice(2, 10)}`;
  const uri = base.replace(/\/(\?|$)/, `/${dbName}$1`);
  await connectDb(uri);
  await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
});

afterEach(async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((c) => c.deleteMany({})));
  sentEmails.length = 0;
  invalidateSettingsCache();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});
