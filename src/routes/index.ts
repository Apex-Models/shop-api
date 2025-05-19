const productsRoutes = require('./products.routes');

async function apiRouter(fastify, options) {
  fastify.register(productsRoutes, { prefix: "/product" });

  fastify.get("/", function (request, reply) {
    reply.send({ hello: "Welcome to Nos Truffes API !" });
  });
}
module.exports = apiRouter;