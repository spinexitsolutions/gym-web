import env from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';

async function main() {
  await connectDB();
  const app = createApp();
  const server = app.listen(env.PORT, () => console.log(`API listening on http://localhost:${env.PORT}/api`));

  const shutdown = (signal) => {
    console.log(`${signal} received, shutting down`);
    server.close(async () => {
      const { disconnectDB } = await import('./config/db.js');
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Failed to start server:', err.message);
  process.exit(1);
});
