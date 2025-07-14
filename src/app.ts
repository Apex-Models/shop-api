const isDev = process.env.NODE_ENV !== 'production';

const fastify = require('fastify')({
  logger: isDev ? true : { level: 'warn' },
  trustProxy: !isDev,
});
const cors = require('@fastify/cors');
const routes = require('./routes');
require('dotenv').config();

// CORS
fastify.register(cors, {
  origin: (origin: string | undefined, cb: (error: Error | null, success: boolean) => void) => {
    if (!origin || origin === `${process.env.CORS_ORIGIN}`) {
      cb(null, true);
    } else {
      cb(new Error('Not allowed by CORS'), false);
    }
  },
  allowMethods: 'GET,PUT,POST,DELETE',
  credentials: true,
});

// app routes
fastify.register(routes, { prefix: 'api/' });

// Run the server
fastify.listen(
  { port: process.env.PORT || 4000, host: '0.0.0.0' },
  (error: Error | null, address: string) => {
    if (error) {
      fastify.log.error(error);
      process.exit(1);
    }
    fastify.log.info(`server listening on ${address}`);
  }
);
