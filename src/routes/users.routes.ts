const userControllers = require('../controllers/users.controllers');

async function usersRoutes(fastify: any, _options: any) {
  // Routes pour les utilisateurs/clients
  fastify.post('/getUsers', userControllers.getUsers);
  fastify.get('/getUserById/:id', userControllers.getUserById);
  fastify.post('/deleteUsers', userControllers.deleteUsers);
}

module.exports = usersRoutes;
