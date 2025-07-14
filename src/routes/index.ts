const productRouterModule = require('./products.routes');

async function apiRouter(fastify: any, _options: any) {
  fastify.register(productRouterModule, { prefix: '/product' });

  fastify.get('/', (_request: any, reply: any) => {
    reply.send({ hello: 'Welcome to Nos Truffes API !' });
  });
}
module.exports = apiRouter;
