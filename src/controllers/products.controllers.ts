const { PrismaClient } = require('@prisma/client');
const axios = require('axios');
const prisma = new PrismaClient();

exports.createProduct = async function (request: any, reply: any) {
  try {
    console.log('🚀 Début création produit:', request.body);
    const { name, description, price, imageUrl, ObjectModelData, type, category } = request.body;

    // Validation des données requises
    if (!name || !description || !price || !type || !category) {
      console.error('❌ Données manquantes:', { name, description, price, type, category });
      return reply.status(400).send({
        success: false,
        message: 'Les champs name, description, price, type et category sont requis',
        data: null,
      });
    }

    // Appel à l'API payment-api pour créer le produit Stripe
    let stripeProductId = null;
    const paymentApiUrl = process.env.PAYMENT_API_URL || 'http://localhost:4001';
    console.log("📡 Tentative d'appel à l'API payment:", paymentApiUrl);

    try {
      const stripeResponse = await axios.post(
        `${paymentApiUrl}/api/create-stripe-product`,
        {
          name,
          description,
          price,
          images: imageUrl,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 secondes de timeout
        }
      );

      const stripeData = stripeResponse.data;
      console.log("✅ Réponse de l'API payment:", stripeData);

      if (stripeResponse.status === 200 && stripeData.success) {
        stripeProductId = stripeData.stripeProductId;
        console.log('✅ Produit Stripe créé avec succès:', stripeProductId);
      } else {
        console.error('❌ Erreur lors de la création du produit Stripe:', stripeData.error);
        // On continue même si Stripe échoue, mais on log l'erreur
      }
    } catch (stripeError: any) {
      console.error("❌ Erreur lors de l'appel à l'API payment:", {
        message: stripeError.message,
        code: stripeError.code,
        response: stripeError.response?.data,
      });
      // On continue même si l'appel à Stripe échoue
    }

    // Créer le produit dans la base de données
    console.log('💾 Création du produit en base de données...');
    const product = await prisma.product.create({
      data: {
        name,
        description,
        price,
        imageUrl,
        ObjectModelData,
        type,
        category,
        stripeProductId,
      },
    });

    console.log('✅ Produit créé avec succès:', product.id);
    reply.status(201).send({
      success: true,
      message: 'Product created successfully',
      data: {
        id: product.id,
        stripeProductId,
        stripeIntegration: stripeProductId ? 'success' : 'failed',
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur complète:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    reply.status(400).send({
      success: false,
      message: 'Error creating product',
      data: null,
      error: error.message,
    });
  }
};

exports.getAllProducts = async function (_request: any, reply: any) {
  try {
    const products = await prisma.product.findMany();
    reply.status(200).send({
      success: true,
      message: 'Products retrieved successfully',
      data: products,
    });
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving products',
      data: null,
    });
  }
};

exports.getProductsWithFilters = async function (request: any, reply: any) {
  try {
    const { page = 1, sortBy = 'createdAt', sortOrder = 'desc', filters = {} } = request.body;

    const limit = 12;
    const where: any = {};
    const hasFilters = filters && Object.keys(filters).length > 0;

    if (hasFilters) {
      if (filters.search) {
        where.OR = [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { description: { contains: filters.search, mode: 'insensitive' } },
        ];
      }

      if (filters.category) {
        where.category = { has: filters.category };
      }

      if (filters.type) {
        where.type = { equals: filters.type, mode: 'insensitive' };
      }

      if (filters.minPrice || filters.maxPrice) {
        where.price = {};
        if (filters.minPrice) {
          where.price.gte = parseFloat(filters.minPrice);
        }
        if (filters.maxPrice) {
          where.price.lte = parseFloat(filters.maxPrice);
        }
      }
    }

    // Calcul de la pagination
    const skip = (parseInt(page) - 1) * limit;

    // Validation du tri
    const allowedSortFields = ['name', 'price', 'createdAt', 'updatedAt'];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const orderBy = { [sortField]: sortOrder === 'asc' ? 'asc' : 'desc' };

    // Récupération des produits avec pagination
    const [products, totalCount] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Calcul des métadonnées de pagination
    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = parseInt(page);
    const hasNextPage = currentPage < totalPages;
    const hasPrevPage = currentPage > 1;

    reply.status(200).send({
      success: true,
      message: hasFilters
        ? 'Products retrieved successfully with filters'
        : 'All products retrieved successfully',
      data: products,
      pagination: {
        currentPage,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
      },
      appliedFilters: hasFilters ? filters : null,
      filtersApplied: hasFilters,
      sorting: {
        sortBy: sortField,
        sortOrder,
      },
    });
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving products with filters',
      data: null,
    });
  }
};

exports.getProductById = async function (request: any, reply: any) {
  try {
    const { id } = request.query;

    const product = await prisma.product.findUnique({
      where: { id: parseInt(id) },
    });

    if (!product) {
      return reply.status(404).send({
        success: false,
        message: 'Product not found',
        data: null,
      });
    }

    reply.status(200).send({
      success: true,
      message: 'Product retrieved successfully',
      data: product,
    });
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving product',
      data: null,
    });
  }
};
