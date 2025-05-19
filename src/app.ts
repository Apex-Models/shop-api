const fastify = require("fastify")({ logger: true });
const cors = require("@fastify/cors");
const { PrismaClient } = require('@prisma/client')
const apiRouter = require('./routes');
require('dotenv').config();

// Prisma
const prisma = new PrismaClient()

// CORS
fastify.register(cors, {
  origin: (origin, cb) => {
    if (!origin || origin.includes('.vercel.app') || origin === 'http://localhost:3000') {
      cb(null, true);
    } else {
      cb(new Error("Not allowed by CORS"));
    }
  },
  allowMethods:'GET,PUT,POST',
  credentials: true
});

// app routes
fastify.register(apiRouter, { prefix: "api/" });

// Run the server
fastify.listen({ port: process.env.FASTIFY_PORT || 4000 , host: '0.0.0.0' }, function (error, address) {
  if (error) {
    fastify.log.error(error);
    process.exit(1);
  }
  fastify.log.info(`server listening on ${address}`)
});