import { connectDb, disconnectDb } from './config/db';
import { env } from './config/env';
import { logger } from './config/logger';
import { createApp } from './app';
import { startScheduler } from './jobs/scheduler';
import { getThemeDoc } from './services/settings.service';

async function main() {
  await connectDb();
  await getThemeDoc(); // ensure theme singleton exists
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT} (docs: /api/docs)`));
  const jobs = await startScheduler();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    jobs.forEach((j) => j.stop());
    server.close(async () => {
      await disconnectDb();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start server');
  process.exit(1);
});
