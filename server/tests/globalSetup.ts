import { MongoMemoryReplSet } from 'mongodb-memory-server';
import type { TestProject } from 'vitest/node';

/**
 * Starts a single-node MongoDB replica set so multi-document transactions are exercised.
 * Set MONGOMS_SYSTEM_BINARY to use a locally installed mongod (no download).
 */
let replSet: MongoMemoryReplSet;

export async function setup(project: TestProject) {
  replSet = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: 'wiredTiger' } });
  await replSet.waitUntilRunning();
  project.provide('mongoUri', replSet.getUri());
}

export async function teardown() {
  await replSet?.stop();
}

declare module 'vitest' {
  export interface ProvidedContext {
    mongoUri: string;
  }
}
