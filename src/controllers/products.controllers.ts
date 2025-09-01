const axios = require('axios');
const prisma = require('../lib/prisma');

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

exports.getProducts = async function (request: any, reply: any) {
  try {
    // S'assurer que request.body existe, même s'il est vide
    const body = request.body || {};

    const { filter = {}, sort = {}, page = 1, limit = null, status = 'active' } = body;

    // Configuration du tri avec valeurs par défaut
    const { sortOrder = 'desc', sortBy = 'createdAt' } = sort;

    // Construction du where clause
    const where: any = {};

    // Filtrage par status (paramètre direct ou dans filter)
    const productStatus = filter.status || status;
    if (productStatus) {
      where.status = { equals: productStatus, mode: 'insensitive' };
    }

    // Application des filtres
    if (filter.minPrice || filter.maxPrice) {
      where.price = {};
      if (filter.minPrice) {
        where.price.gte = parseFloat(filter.minPrice);
      }
      if (filter.maxPrice) {
        where.price.lte = parseFloat(filter.maxPrice);
      }
    }

    if (filter.type) {
      where.type = { equals: filter.type, mode: 'insensitive' };
    }

    if (filter.category && Array.isArray(filter.category) && filter.category.length > 0) {
      where.category = { hasSome: filter.category };
    }

    // Configuration de la pagination
    const currentPage = page ? parseInt(page) : 1;
    const itemsPerPage = limit ? parseInt(limit) : null;
    const skip = itemsPerPage ? (currentPage - 1) * itemsPerPage : 0;

    // Validation du tri
    const allowedSortFields = ['name', 'price', 'status', 'type', 'createdAt', 'updatedAt'];
    const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';
    const orderBy = { [validSortBy]: validSortOrder };

    // Construction de la requête
    const queryOptions: any = {
      where,
      orderBy,
    };

    // Ajout de la pagination si limit est spécifié
    if (itemsPerPage) {
      queryOptions.skip = skip;
      queryOptions.take = itemsPerPage;
    }

    // Récupération via une transaction pour limiter les aller-retours DB
    const [products, matchedCount, statusCounts] = await prisma.$transaction([
      prisma.product.findMany(queryOptions),
      prisma.product.count({ where }),
      prisma.product.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    // Agrégation des compteurs globaux
    const totalsByStatus: Record<string, number> = Object.create(null);
    for (const row of statusCounts as Array<{ status: string; _count: { _all: number } }>) {
      totalsByStatus[row.status] = row._count._all;
    }
    const totalActiveProducts = totalsByStatus['active'] || 0;
    const totalInactiveProducts = totalsByStatus['inactive'] || 0;
    const totalProducts = Object.values(totalsByStatus).reduce((acc, n) => acc + n, 0);

    // Calcul des métadonnées de pagination
    const response: any = {
      success: true,
      message: 'Products retrieved successfully',
      data: products,
      totalMatchedProducts: matchedCount,
      counts: { totalProducts, totalActiveProducts, totalInactiveProducts },
      appliedFilters: {
        filter,
        sort: { sortBy: validSortBy, sortOrder: validSortOrder },
        status: productStatus,
      },
    };

    // Ajout des métadonnées de pagination si limit est spécifié
    if (itemsPerPage) {
      const totalPages = Math.ceil(matchedCount / itemsPerPage);
      const hasNextPage = currentPage < totalPages;
      const hasPrevPage = currentPage > 1;

      response.pagination = {
        currentPage,
        totalPages,
        limit: itemsPerPage,
        hasNextPage,
        hasPrevPage,
      };
    } else {
      response.pagination = {
        currentPage: 1,
        totalPages: 1,
        limit: 'all',
        hasNextPage: false,
        hasPrevPage: false,
      };
    }

    reply.status(200).send(response);
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving products',
      data: null,
      error: error.message,
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

exports.deleteProducts = async function (request: any, reply: any) {
  try {
    const { productIds } = request.body;

    // Validation des données requises
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return reply.status(400).send({
        success: false,
        message: 'Le champ productIds est requis et doit être un tableau non vide',
        data: null,
      });
    }

    // Vérification que tous les IDs sont des nombres valides
    const validIds = productIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

    if (validIds.length !== productIds.length) {
      return reply.status(400).send({
        success: false,
        message: 'Tous les IDs de produits doivent être des nombres valides',
        data: null,
      });
    }

    // Vérification de l'existence des produits avant suppression
    const existingProducts = await prisma.product.findMany({
      where: { id: { in: validIds } },
      select: { id: true, name: true },
    });

    if (existingProducts.length === 0) {
      return reply.status(404).send({
        success: false,
        message: 'Aucun produit trouvé avec les IDs fournis',
        data: null,
      });
    }

    const existingIds = existingProducts.map((p: { id: number; name: string }) => p.id);
    const notFoundIds = validIds.filter(id => !existingIds.includes(id));

    // Suppression des produits
    const deleteResult = await prisma.product.deleteMany({
      where: { id: { in: existingIds } },
    });

    console.log(`✅ ${deleteResult.count} produit(s) supprimé(s) avec succès`);

    const responseMessage =
      deleteResult.count === validIds.length
        ? `${deleteResult.count} produit(s) supprimé(s) avec succès`
        : `${deleteResult.count} produit(s) supprimé(s) avec succès. ${notFoundIds.length} produit(s) non trouvé(s): ${notFoundIds.join(', ')}`;

    reply.status(200).send({
      success: true,
      message: responseMessage,
      data: {
        deletedCount: deleteResult.count,
        deletedProducts: existingProducts.filter((p: { id: number; name: string }) =>
          existingIds.includes(p.id)
        ),
        notFoundIds,
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression des produits:', {
      message: error.message,
      stack: error.stack,
    });
    reply.status(500).send({
      success: false,
      message: 'Erreur lors de la suppression des produits',
      data: null,
      error: error.message,
    });
  }
};
