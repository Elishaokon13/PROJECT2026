import Fastify from 'fastify';
import { config } from './config/index.js';

export const app = Fastify({
  logger: config.logLevel === 'development' ? { level: 'info' } : true,
});

// Register plugins
// TODO: Register auth, db, cors, rate-limit plugins

// Register routes
// TODO: Register API routes

