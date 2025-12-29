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
await registerPlugins(app);

// Register routes
await registerRoutes(app);

// Register error handler
app.setErrorHandler(errorHandler);

