const orderControllers = require('../controllers/orders.controllers');

async function ordersRoutes(fastify: any, _options: any) {
  // Routes pour les commandes
  fastify.post('/createOrder', orderControllers.createOrder);
  fastify.post('/getOrders', orderControllers.getOrders);
  fastify.get('/getOrderById/:id', orderControllers.getOrderById);
  fastify.post('/deleteOrders', orderControllers.deleteOrders);
  fastify.put('/updateOrderStatus/:id', orderControllers.updateOrderStatus);
}

module.exports = ordersRoutes;
