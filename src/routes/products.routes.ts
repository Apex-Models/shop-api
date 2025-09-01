const productControllers = require('../controllers/products.controllers');

async function productsRoutes(fastify: any, _options: any) {
  fastify.post('/createProduct', productControllers.createProduct);
  fastify.post('/getProducts', productControllers.getProducts);
  fastify.get('/getProductById/:id', productControllers.getProductById);
  fastify.post('/deleteProducts', productControllers.deleteProducts);
}

module.exports = productsRoutes;
