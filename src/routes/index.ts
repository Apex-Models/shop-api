const productRouterModule = require('./products.routes');
const orderRouterModule = require('./orders.routes');
const userRouterModule = require('./users.routes');

async function apiRouter(fastify: any, _options: any) {
  fastify.register(productRouterModule, { prefix: '/product' });
  fastify.register(orderRouterModule, { prefix: '/order' });
  fastify.register(userRouterModule, { prefix: '/user' });

  fastify.get('/', (_request: any, reply: any) => {
    reply.send({ hello: 'Welcome to Nos Truffes API !' });
  });
}
module.exports = apiRouter;
