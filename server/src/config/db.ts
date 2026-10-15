import mongoose from 'mongoose';
import { env } from './env';
import { logger } from './logger';

mongoose.set('strictQuery', true);
// Query-operator injection is prevented at the edge: every request body/query is parsed by a
// strict zod schema, so user input can never become an object such as { $ne: ... }.

let transactionsSupported: boolean | null = null;

export async function connectDb(uri = env.MONGODB_URI): Promise<void> {
  await mongoose.connect(uri, { autoIndex: true, serverSelectionTimeoutMS: 10000 });
  logger.info({ db: mongoose.connection.name }, 'MongoDB connected');
  await detectTransactions();
}

export async function detectTransactions(): Promise<boolean> {
  try {
    const hello = await mongoose.connection.db!.admin().command({ hello: 1 });
    transactionsSupported = Boolean(hello.setName || hello.msg === 'isdbgrid');
  } catch {
    transactionsSupported = false;
  }
  if (!transactionsSupported) logger.warn('MongoDB is not a replica set: multi-document transactions are disabled. Use a replica set in production.');
  return transactionsSupported;
}

/**
 * Runs `fn` inside a transaction when the deployment supports it (replica set / Atlas),
 * otherwise runs it without a session. Business logic is written to be idempotent so the
 * non-transactional path stays safe for local development.
 */
export async function withTransaction<T>(fn: (session: mongoose.ClientSession | undefined) => Promise<T>): Promise<T> {
  if (transactionsSupported === null) await detectTransactions();
  if (!transactionsSupported) return fn(undefined);
  const session = await mongoose.startSession();
  try {
    let result: T;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result!;
  } finally {
    await session.endSession();
  }
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
