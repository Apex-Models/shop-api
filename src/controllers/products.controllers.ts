const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.createProduct = async function (request, reply) {
    try {
        const { name, description, price, imageUrl, ObjectModelData, stock, type, category } = request.body;

        const product = await prisma.product.create({
            data: {
                name,
                description,
                price,
                imageUrl,
                ObjectModelData,
                stock,
                type,
                category
            }
        });

        reply.status(201).send({
            success: true,
            message: 'Product created successfully'
        });
    } catch (error) {
        console.error(error);
        reply.status(400).send({
            success: false,
            message: 'Error creating product',
            data: null
        });
    }
};

exports.getAllProducts = async function (request, reply) {
    try {
        const products = await prisma.product.findMany();
        reply.status(200).send({
            success: true,
            message: 'Products retrieved successfully',
            data: products
        });
    } catch (error) {
        console.error(error);
        reply.status(400).send({
            success: false,
            message: 'Error retrieving products',
            data: null
        });
    }
}

exports.getProductById = async function (request, reply) {
    try {
        const { id } = request.query;

        const product = await prisma.product.findUnique({
            where: { id: parseInt(id) }
        });

        if (!product) {
            return reply.status(404).send({
                success: false,
                message: 'Product not found',
                data: null
            });
        }

        reply.status(200).send({
            success: true,
            message: 'Product retrieved successfully',
            data: product
        });
    } catch (error) {
        console.error(error);
        reply.status(400).send({
            success: false,
            message: 'Error retrieving product',
            data: null
        });
    }
};