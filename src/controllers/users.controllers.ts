const database = require('../lib/prisma');

exports.getUsers = async function (request: any, reply: any) {
  try {
    // S'assurer que request.body existe, même s'il est vide
    const body = request.body || {};

    const { filter = {}, sort = {}, page = 1, limit = null, status = null } = body;

    // Configuration du tri avec valeurs par défaut
    const { sortOrder = 'desc', sortBy = 'createdAt' } = sort;

    // Construction du where clause pour les utilisateurs
    const where: any = {};

    // Filtrage par nom (prénom ou nom de famille)
    if (filter.name) {
      where.OR = [
        { firstName: { contains: filter.name, mode: 'insensitive' } },
        { lastName: { contains: filter.name, mode: 'insensitive' } },
      ];
    }

    // Configuration de la pagination
    const currentPage = page ? parseInt(page) : 1;
    const itemsPerPage = limit ? parseInt(limit) : null;
    const skip = itemsPerPage ? (currentPage - 1) * itemsPerPage : 0;

    // Validation du tri
    const allowedSortFields = [
      'id',
      'name',
      'email',
      'totalSpent',
      'totalOrders',
      'createdAt',
      'lastOrder',
    ];
    let validSortBy = 'createdAt';

    // Mapper les champs de tri du frontend vers les champs DB
    switch (sortBy) {
      case 'name':
        validSortBy = 'firstName';
        break;
      case 'email':
        validSortBy = 'email';
        break;
      default:
        validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';
    }

    const validSortOrder = ['asc', 'desc'].includes(sortOrder) ? sortOrder : 'desc';
    const orderBy = { [validSortBy]: validSortOrder };

    // Construction de la requête pour les utilisateurs avec leurs commandes
    const queryOptions: any = {
      where,
      orderBy,
      include: {
        // Nous n'avons pas de relation directe, on fera les calculs via des requêtes séparées
      },
    };

    // Ajout de la pagination si limit est spécifié
    if (itemsPerPage) {
      queryOptions.skip = skip;
      queryOptions.take = itemsPerPage;
    }

    // Récupération des utilisateurs
    const [users] = await database.$transaction([
      database.user.findMany(queryOptions),
      database.user.count({ where }),
    ]);

    // Pour chaque utilisateur, calculer ses statistiques de commandes
    const usersWithStats = await Promise.all(
      users.map(async (user: any) => {
        // Récupérer les commandes de cet utilisateur via la relation
        const userOrders = await database.order.findMany({
          where: { userId: user.id },
          select: {
            id: true,
            total: true,
            createdAt: true,
          },
        });

        // Calculer les statistiques
        const totalOrders = userOrders.length;
        const totalSpent = userOrders.reduce((sum: number, order: any) => sum + order.total, 0);
        const lastOrderDate =
          userOrders.length > 0
            ? userOrders.sort(
                (a: any, b: any) =>
                  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              )[0].createdAt
            : null;

        return {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          orderSummary: {
            totalOrders,
            totalSpent,
            lastOrderDate: lastOrderDate ? lastOrderDate.toISOString() : null,
          },
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
        };
      })
    );

    // Appliquer le filtrage post-requête si nécessaire
    let filteredUsers = usersWithStats;

    // Filtrage par montant dépensé
    if (filter.minSpent || filter.maxSpent) {
      filteredUsers = filteredUsers.filter((user: any) => {
        const totalSpent = user.orderSummary.totalSpent;
        if (filter.minSpent && totalSpent < parseFloat(filter.minSpent)) {
          return false;
        }
        if (filter.maxSpent && totalSpent > parseFloat(filter.maxSpent)) {
          return false;
        }
        return true;
      });
    }

    // Filtrage par statut (avec ou sans commandes)
    const filterStatus = status || filter.hasOrders;
    if (filterStatus !== null) {
      if (filterStatus === 'with_orders' || filterStatus === true) {
        filteredUsers = filteredUsers.filter((user: any) => user.orderSummary.totalOrders > 0);
      } else if (filterStatus === 'without_orders' || filterStatus === false) {
        filteredUsers = filteredUsers.filter((user: any) => user.orderSummary.totalOrders === 0);
      }
    }

    // Tri post-requête pour les champs calculés
    if (sortBy === 'totalSpent' || sortBy === 'totalOrders' || sortBy === 'lastOrder') {
      filteredUsers.sort((a: any, b: any) => {
        let aValue, bValue;

        if (sortBy === 'totalSpent') {
          aValue = a.orderSummary.totalSpent;
          bValue = b.orderSummary.totalSpent;
        } else if (sortBy === 'totalOrders') {
          aValue = a.orderSummary.totalOrders;
          bValue = b.orderSummary.totalOrders;
        } else if (sortBy === 'lastOrder') {
          aValue = a.orderSummary.lastOrderDate
            ? new Date(a.orderSummary.lastOrderDate).getTime()
            : 0;
          bValue = b.orderSummary.lastOrderDate
            ? new Date(b.orderSummary.lastOrderDate).getTime()
            : 0;
        }

        if (validSortOrder === 'asc') {
          return aValue - bValue;
        } else {
          return bValue - aValue;
        }
      });
    }

    // Calculer les statistiques globales
    const allUsers = await database.user.findMany();
    const allUsersWithOrderStats = await Promise.all(
      allUsers.map(async (user: any) => {
        const orders = await database.order.findMany({
          where: { userId: user.id },
          select: { total: true },
        });
        return {
          totalOrders: orders.length,
          totalSpent: orders.reduce((sum: number, order: any) => sum + order.total, 0),
        };
      })
    );

    const totalUsers = allUsers.length;
    const totalUsersWithOrders = allUsersWithOrderStats.filter(stat => stat.totalOrders > 0).length;
    const totalUsersWithoutOrders = totalUsers - totalUsersWithOrders;
    const totalSpent = allUsersWithOrderStats.reduce(
      (sum: number, stat: any) => sum + stat.totalSpent,
      0
    );

    const counts = {
      totalUsers,
      totalActiveUsers: totalUsers, // Tous les utilisateurs sont considérés comme actifs
      totalUsersWithOrders,
      totalUsersWithoutOrders,
      totalSpent,
    };

    // Calcul des métadonnées de pagination sur les résultats filtrés
    const totalFilteredUsers = filteredUsers.length;
    const response: any = {
      success: true,
      message: 'Users retrieved successfully',
      data: filteredUsers,
      totalMatchedUsers: totalFilteredUsers,
      counts,
      appliedFilters: {
        filter,
        sort: { sortBy: validSortBy, sortOrder: validSortOrder },
        status: filterStatus,
      },
    };

    // Ajout des métadonnées de pagination si limit est spécifié
    if (itemsPerPage) {
      const totalPages = Math.ceil(totalFilteredUsers / itemsPerPage);
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
      message: 'Error retrieving users',
      data: null,
      error: error.message,
    });
  }
};

exports.getUserById = async function (request: any, reply: any) {
  try {
    const { id } = request.query;

    const user = await database.user.findUnique({
      where: { id: parseInt(id) },
    });

    if (!user) {
      return reply.status(404).send({
        success: false,
        message: 'User not found',
        data: null,
      });
    }

    // Récupérer les commandes de cet utilisateur
    const userOrders = await database.order.findMany({
      where: { userId: user.id },
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
      orderBy: { createdAt: 'desc' },
    });

    // Calculer les statistiques
    const totalOrders = userOrders.length;
    const totalSpent = userOrders.reduce((sum: number, order: any) => sum + order.total, 0);

    const userWithStats = {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      orders: userOrders.map((order: any) => ({
        id: order.id,
        total: order.total,
        orderStatus: order.orderStatus,
        paymentStatus: order.paymentStatus,
        createdAt: order.createdAt.toISOString(),
        items: order.items,
      })),
      orderSummary: {
        totalOrders,
        totalSpent,
      },
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };

    reply.status(200).send({
      success: true,
      message: 'User retrieved successfully',
      data: userWithStats,
    });
  } catch (error: any) {
    console.error(error);
    reply.status(400).send({
      success: false,
      message: 'Error retrieving user',
      data: null,
      error: error.message,
    });
  }
};

exports.deleteUsers = async function (request: any, reply: any) {
  try {
    const { userIds } = request.body;

    // Validation des données requises
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return reply.status(400).send({
        success: false,
        message: 'Le champ userIds est requis et doit être un tableau non vide',
        data: null,
      });
    }

    // Vérification que tous les IDs sont des nombres valides
    const validIds = userIds.filter(id => !isNaN(parseInt(id))).map(id => parseInt(id));

    if (validIds.length !== userIds.length) {
      return reply.status(400).send({
        success: false,
        message: "Tous les IDs d'utilisateurs doivent être des nombres valides",
        data: null,
      });
    }

    // Vérification de l'existence des utilisateurs avant suppression
    const existingUsers = await database.user.findMany({
      where: { id: { in: validIds } },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (existingUsers.length === 0) {
      return reply.status(404).send({
        success: false,
        message: 'Aucun utilisateur trouvé avec les IDs fournis',
        data: null,
      });
    }

    const existingIds = existingUsers.map((user: any) => user.id);
    const notFoundIds = validIds.filter(id => !existingIds.includes(id));

    // Suppression des utilisateurs
    const deleteResult = await database.user.deleteMany({
      where: { id: { in: existingIds } },
    });

    console.log(`✅ ${deleteResult.count} utilisateur(s) supprimé(s) avec succès`);

    const responseMessage =
      deleteResult.count === validIds.length
        ? `${deleteResult.count} utilisateur(s) supprimé(s) avec succès`
        : `${deleteResult.count} utilisateur(s) supprimé(s) avec succès. ${notFoundIds.length} utilisateur(s) non trouvé(s): ${notFoundIds.join(', ')}`;

    reply.status(200).send({
      success: true,
      message: responseMessage,
      data: {
        deletedCount: deleteResult.count,
        deletedUsers: existingUsers.filter((user: any) => existingIds.includes(user.id)),
        notFoundIds,
      },
    });
  } catch (error: any) {
    console.error('❌ Erreur lors de la suppression des utilisateurs:', {
      message: error.message,
      stack: error.stack,
    });
    reply.status(500).send({
      success: false,
      message: 'Erreur lors de la suppression des utilisateurs',
      data: null,
      error: error.message,
    });
  }
};
