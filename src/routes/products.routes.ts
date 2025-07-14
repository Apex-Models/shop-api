const productControllers = require('../controllers/products.controllers');

async function productsRoutes(fastify: any, _options: any) {
  fastify.post('/createProduct', productControllers.createProduct);
  fastify.post('/getAllProducts', productControllers.getAllProducts);
  fastify.get('/getProductById/:id', productControllers.getProductById);
  fastify.post('/getProductsWithFilters', productControllers.getProductsWithFilters);
}

module.exports = productsRoutes;
