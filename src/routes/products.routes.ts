const productControllers = require("../controllers/products.controllers");

async function productsRoutes(fastify, options) {
    fastify.post("/createProduct", productControllers.createProduct);
    fastify.get("/getAllProducts", productControllers.getAllProducts);
    fastify.get("/getProductById/:id", productControllers.getProductById);
}

module.exports = productsRoutes;