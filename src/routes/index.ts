const productsRoutes = require('./products.routes');

async function apiRouter(fastify, _options) {
  fastify.register(productsRoutes, { prefix: '/product' });

  fastify.get('/', (request, reply) => {
    reply.send({ hello: 'Welcome to Nos Truffes API !' });
  });
}
module.exports = apiRouter;
