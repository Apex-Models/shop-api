const db = require('../lib/prisma');

exports.createOrder = async function (request: any, reply: any) {
  try {
    console.log('🚀 Début création commande:', request.body);
    const {
      customerFirstName,
      customerLastName,
      customerEmail,
      items,
      total,
      orderStatus = 'pending',
      paymentStatus = 'pending',
      address,
    } = request.body;

    // Validation des données requises
    if (
      !customerFirstName ||
      !customerLastName ||
      !customerEmail ||
      !items ||
      !Array.isArray(items) ||
      items.length === 0 ||
      !total ||
      !address
    ) {
      console.error('❌ Données manquantes:', {
        customerFirstName,
        customerLastName,
        customerEmail,
        items,
        total,
        address,
      });
      return reply.status(400).send({
        success: false,
        message:
          'Les champs customerFirstName, customerLastName, customerEmail, items, total et address sont requis',
        data: null,
      });
    }

    // Validation de l'adresse
    const { street, city, postalCode, country } = address;
    if (!street || !city || !postalCode || !country) {
      return reply.status(400).send({
        success: false,
        message: 'Adresse complète requise (street, city, postalCode, country)',
        data: null,
      });
    }

    // Validation des items
    for (const item of items) {
      if (!item.productId || !item.productName || !item.quantity || !item.unitPrice) {
        return reply.status(400).send({
          success: false,
          message: 'Chaque item doit avoir productId, productName, quantity et unitPrice',
          data: null,
        });
      }
    }

    // Créer la commande avec les items dans une transaction
    const order = await db.$transaction(async (tx: any) => {
      // Créer la commande
      const newOrder = await tx.order.create({
        data: {
          customerFirstName,
          customerLastName,
          customerEmail,
          total: parseFloat(total),
          orderStatus,
          paymentStatus,
          street,
          city,
          postalCode,
          country,
        },
      });

      // Créer les items de la commande
      const orderItems = await Promise.all(
        items.map((item: any) =>
          tx.orderItem.create({
            data: {
              orderId: newOrder.id,
              productId: parseInt(item.productId),
              productName: item.productName,
              quantity: parseInt(item.quantity),
              unitPrice: parseFloat(item.unitPrice),
              totalPrice: parseFloat(item.quantity) * parseFloat(item.unitPrice),
            },
          })
        )
      );

      return { ...newOrder, items: orderItems };
    });

    console.log('✅ Commande créée avec succès:', order.id);
    reply.status(201).send({
      success: true,
      message: 'Order created successfully',
      data: {
        id: order.id,
        customerName: `${order.customerFirstName} ${order.customerLastName}`,
        total: order.total,
        itemsCount: order.items.length,
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
      message: 'Error creating order',
      data: null,
      error: error.message,
    });
  }
};

exports.getOrders = async function (request: any, reply: any) {
  try {
    // S'assurer que request.body existe, même s'il est vide
    const body = request.body || {};

    const { filter = {}, sort = {}, page = 1, limit = null, status = null } = body;

    // Configuration du tri avec valeurs par défaut
    const { sortOrder = 'desc', sortBy = 'createdAt' } = sort;

    // Construction du where clause
    const where: any = {};

    // Filtrage par paymentStatus (paramètre direct ou dans filter)
    const paymentStatus = filter.paymentStatus || status;
    if (paymentStatus) {
      where.paymentStatus = { equals: paymentStatus, mode: 'insensitive' };
    }

    // Filtrage par orderStatus
    if (filter.orderStatus) {
      where.orderStatus = { equals: filter.orderStatus, mode: 'insensitive' };
    }

    // Filtrage par montant
    if (filter.minTotal || filter.maxTotal) {
      where.total = {};
      if (filter.minTotal) {
        where.total.gte = parseFloat(filter.minTotal);
      }
      if (filter.maxTotal) {
        where.total.lte = parseFloat(filter.maxTotal);
      }
    }

    // Filtrage par nom de client
    if (filter.customerName) {
      where.OR = [
        { customerFirstName: { contains: filter.customerName, mode: 'insensitive' } },
        { customerLastName: { contains: filter.customerName, mode: 'insensitive' } },
      ];
    }

    // Configuration de la pagination
    const currentPage = page ? parseInt(page) : 1;
    const itemsPerPage = limit ? parseInt(limit) : null;
    const skip = itemsPerPage ? (currentPage - 1) * itemsPerPage : 0;

    // Validation du tri
    const allowedSortFields = [
      'orderId',
      'customer',
      'date',
      'total',
      'orderStatus',
      'paymentStatus',
      'deliveryAddress',
      'createdAt',
    ];
    let validSortBy = 'createdAt';

    // Mapper les champs de tri du frontend vers les champs DB
    switch (sortBy) {
      case 'orderId':
        validSortBy = 'id';
        break;
      case 'customer':
        validSortBy = 'customerFirstName';
        break;
      case 'date':
        validSortBy = 'createdAt';
        break;
      case 'deliveryAddress':
      case 'address':
        validSortBy = 'city';
        break;
      default:
        validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    }

    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';
    const orderBy = { [validSortBy]: validSortOrder };

    // Construction de la requête
    const queryOptions: any = {
      where,
      orderBy,
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
              },
            },
          },
        },
      },
    };

    // Ajout de la pagination si limit est spécifié
    if (itemsPerPage) {
      queryOptions.skip = skip;
      queryOptions.take = itemsPerPage;
    }

    // Récupération via une transaction pour limiter les aller-retours DB
    const [orders, matchedCount, statusCounts] = await db.$transaction([
      db.order.findMany(queryOptions),
      db.order.count({ where }),
      db.order.groupBy({
        by: ['paymentStatus'],
        _count: { _all: true },
      }),
    ]);

    // Transformer les données pour correspondre au format attendu par le frontend
    const transformedOrders = orders.map((order: any) => ({
      id: order.id,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
      })),
      total: order.total,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      address: {
        street: order.street,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    }));

    // Agrégation des compteurs globaux
    const totalsByStatus: Record<string, number> = Object.create(null);
    for (const row of statusCounts as Array<{ paymentStatus: string; _count: { _all: number } }>) {
      totalsByStatus[row.paymentStatus] = row._count._all;
    }

    const totalOrders = Object.values(totalsByStatus).reduce((acc, n) => acc + n, 0);
    const totalSuccededOrders = totalsByStatus['succeded'] || 0;
    const totalFailedOrders = totalsByStatus['failed'] || 0;
    const totalRefundedOrders = totalsByStatus['refunded'] || 0;

    // Calcul des métadonnées de pagination
    const response: any = {
      success: true,
      message: 'Orders retrieved successfully',
      data: transformedOrders,
      totalMatchedOrders: matchedCount,
      counts: {
        totalOrders,
        totalSuccededOrders,
        totalFailedOrders,
        totalRefundedOrders,
      },
      appliedFilters: {
        filter,
        sort: { sortBy: validSortBy, sortOrder: validSortOrder },
        status: paymentStatus,
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
      message: 'Error retrieving orders',
      data: null,
      error: error.message,
    });
  }
};

exports.getOrderById = async function (request: any, reply: any) {
  try {
    const { id } = request.query;

    const order = await db.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
                imageUrl: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return reply.status(404).send({
        success: false,
        message: 'Order not found',
        data: null,
      });
    }

    // Transformer les données
    const transformedOrder = {
      id: order.id,
      customerFirstName: order.customerFirstName,
      customerLastName: order.customerLastName,
      customerEmail: order.customerEmail,
      items: order.items.map((item: any) => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        product: item.product,
      })),
      total: order.total,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      address: {
        street: order.street,
        city: order.city,
        postalCode: order.postalCode,
        country: order.country,
      },
      createdAt: order.createdAt.toISOString(),
      updatedAt: order.updatedAt.toISOString(),
    };

    reply.status(200).send({
      success: true,
      message: 'Order retrieved successfully',
      data: transformedOrder,
    });
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving order',
      data: null,
      error: error.message,
    });
  }
};

exports.deleteOrders = async function (request: any, reply: any) {
  try {
    const { orderIds } = request.body;

    // Validation des données requises
    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return reply.status(400).send({
        success: false,
        message: 'Le champ orderIds est requis et doit être un tableau non vide',
        data: null,
      });
    }

    // Vérification que tous les IDs sont des nombres valides
    const validIds = orderIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

    if (validIds.length !== orderIds.length) {
      return reply.status(400).send({
        success: false,
        message: 'Tous les IDs de commandes doivent être des nombres valides',
        data: null,
      });
    }

    // Vérification de l'existence des commandes avant suppression
    const existingOrders = await db.order.findMany({
      where: { id: { in: validIds } },
      select: { id: true, customerFirstName: true, customerLastName: true },
    });

    if (existingOrders.length === 0) {
      return reply.status(404).send({
        success: false,
        message: 'Aucune commande trouvée avec les IDs fournis',
        data: null,
      });
    }

    const existingIds = existingOrders.map((order: any) => order.id);
    const notFoundIds = validIds.filter(id => !existingIds.includes(id));

    // Suppression des commandes (les items seront supprimés automatiquement avec CASCADE)
    const deleteResult = await db.order.deleteMany({
      where: { id: { in: existingIds } },
    });

    console.log(`✅ ${deleteResult.count} commande(s) supprimée(s) avec succès`);

    const responseMessage =
      deleteResult.count === validIds.length
        ? `${deleteResult.count} commande(s) supprimée(s) avec succès`
        : `${deleteResult.count} commande(s) supprimée(s) avec succès. ${notFoundIds.length} commande(s) non trouvée(s): ${notFoundIds.join(', ')}`;

    reply.status(200).send({
      success: true,
      message: responseMessage,
      data: {
        deletedCount: deleteResult.count,
        deletedOrders: existingOrders.filter((order: any) => existingIds.includes(order.id)),
        notFoundIds,
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression des commandes:', {
      message: error.message,
      stack: error.stack,
    });
    reply.status(500).send({
      success: false,
      message: 'Erreur lors de la suppression des commandes',
      data: null,
      error: error.message,
    });
  }
};

exports.updateOrderStatus = async function (request: any, reply: any) {
  try {
    const { id } = request.params;
    const { orderStatus, paymentStatus } = request.body;

    if (!orderStatus && !paymentStatus) {
      return reply.status(400).send({
        success: false,
        message: 'Au moins orderStatus ou paymentStatus doit être fourni',
        data: null,
      });
    }

    const updateData: any = {};

    if (orderStatus) {
      const validOrderStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
      if (!validOrderStatuses.includes(orderStatus)) {
        return reply.status(400).send({
          success: false,
          message: 'orderStatus invalide. Valeurs autorisées: ' + validOrderStatuses.join(', '),
          data: null,
        });
      }
      updateData.orderStatus = orderStatus;
    }

    if (paymentStatus) {
      const validPaymentStatuses = ['pending', 'succeded', 'failed', 'refunded'];
      if (!validPaymentStatuses.includes(paymentStatus)) {
        return reply.status(400).send({
          success: false,
          message: 'paymentStatus invalide. Valeurs autorisées: ' + validPaymentStatuses.join(', '),
          data: null,
        });
      }
      updateData.paymentStatus = paymentStatus;
    }

    const order = await db.order.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    reply.status(200).send({
      success: true,
      message: 'Order status updated successfully',
      data: {
        id: order.id,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
      },
    });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return reply.status(404).send({
        success: false,
        message: 'Order not found',
        data: null,
      });
    }

    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error updating order status',
      data: null,
      error: error.message,
    });
  }
};
