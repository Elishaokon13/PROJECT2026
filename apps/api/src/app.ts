import Fastify from 'fastify';
import { config } from './config/index.js';
import { registerPlugins } from './plugins/index.js';
import { registerRoutes } from './routes/index.js';
import { errorHandler } from './errors/index.js';

export const app = Fastify({
  logger: config.nodeEnv === 'development' ? { level: 'info' } : true,
});

// Decorate app with config for error handler
app.decorate('config', config);

declare module 'fastify' {
  interface FastifyInstance {
    config: typeof config;
  }
}

// Register plugins (order matters)
app.register(async (fastify) => {
  await registerPlugins(fastify);
  await registerRoutes(fastify);
});

// Register error handler
app.setErrorHandler(errorHandler);

