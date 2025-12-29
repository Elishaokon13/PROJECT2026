import { app } from './app.js';
import { config } from './config/index.js';

async function start() {
  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 Server listening on ${config.host}:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();

