const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedOrders() {
  try {
    console.log('🌱 Début du seeding des commandes...');

    // Vérifier s'il y a des produits existants
    const products = await prisma.product.findMany({
      take: 5
    });

    if (products.length === 0) {
      console.log('❌ Aucun produit trouvé. Veuillez d\'abord créer des produits.');
      return;
    }

    // Créer quelques commandes d'exemple
    const ordersData = [
      {
        customerFirstName: 'Jean',
        customerLastName: 'Dupont',
        customerEmail: 'jean.dupont@email.com',
        total: 159.99,
        orderStatus: 'delivered',
        paymentStatus: 'succeded',
        street: '123 Rue de la Paix',
        city: 'Paris',
        postalCode: '75001',
        country: 'France',
        items: [
          {
            productId: products[0].id,
            productName: products[0].name,
            quantity: 2,
            unitPrice: 79.99,
            totalPrice: 159.98
          }
        ]
      },
      {
        customerFirstName: 'Marie',
        customerLastName: 'Martin',
        customerEmail: 'marie.martin@email.com',
        total: 89.50,
        orderStatus: 'shipped',
        paymentStatus: 'succeded',
        street: '456 Avenue des Champs',
        city: 'Lyon',
        postalCode: '69001',
        country: 'France',
        items: [
          {
            productId: products[1] ? products[1].id : products[0].id,
            productName: products[1] ? products[1].name : products[0].name,
            quantity: 1,
            unitPrice: 89.50,
            totalPrice: 89.50
          }
        ]
      },
      {
        customerFirstName: 'Pierre',
        customerLastName: 'Dubois',
        customerEmail: 'pierre.dubois@email.com',
        total: 245.75,
        orderStatus: 'processing',
        paymentStatus: 'succeded',
        street: '789 Boulevard Saint-Michel',
        city: 'Marseille',
        postalCode: '13001',
        country: 'France',
        items: [
          {
            productId: products[0].id,
            productName: products[0].name,
            quantity: 1,
            unitPrice: 79.99,
            totalPrice: 79.99
          },
          {
            productId: products[1] ? products[1].id : products[0].id,
            productName: products[1] ? products[1].name : products[0].name,
            quantity: 2,
            unitPrice: 82.88,
            totalPrice: 165.76
          }
        ]
      },
      {
        customerFirstName: 'Sophie',
        customerLastName: 'Leroy',
        customerEmail: 'sophie.leroy@email.com',
        total: 120.00,
        orderStatus: 'pending',
        paymentStatus: 'failed',
        street: '321 Rue du Commerce',
        city: 'Toulouse',
        postalCode: '31000',
        country: 'France',
        items: [
          {
            productId: products[2] ? products[2].id : products[0].id,
            productName: products[2] ? products[2].name : products[0].name,
            quantity: 3,
            unitPrice: 40.00,
            totalPrice: 120.00
          }
        ]
      },
      {
        customerFirstName: 'Lucas',
        customerLastName: 'Moreau',
        customerEmail: 'lucas.moreau@email.com',
        total: 67.99,
        orderStatus: 'cancelled',
        paymentStatus: 'refunded',
        street: '654 Place de la République',
        city: 'Nice',
        postalCode: '06000',
        country: 'France',
        items: [
          {
            productId: products[3] ? products[3].id : products[0].id,
            productName: products[3] ? products[3].name : products[0].name,
            quantity: 1,
            unitPrice: 67.99,
            totalPrice: 67.99
          }
        ]
      }
    ];

    // Créer les commandes avec leurs items
    for (const orderData of ordersData) {
      const { items, ...order } = orderData;
      
      const createdOrder = await prisma.order.create({
        data: order
      });

      // Créer les items pour cette commande
      for (const item of items) {
        await prisma.orderItem.create({
          data: {
            ...item,
            orderId: createdOrder.id
          }
        });
      }

      console.log(`✅ Commande créée: ${createdOrder.id} - ${order.customerFirstName} ${order.customerLastName}`);
    }

    console.log('🎉 Seeding des commandes terminé avec succès !');
    
    // Afficher les statistiques
    const totalOrders = await prisma.order.count();
    const totalItems = await prisma.orderItem.count();
    
    console.log(`📊 Statistiques:`);
    console.log(`   - Total commandes: ${totalOrders}`);
    console.log(`   - Total items: ${totalItems}`);

  } catch (error) {
    console.error('❌ Erreur lors du seeding:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le seeding si ce fichier est lancé directement
if (require.main === module) {
  seedOrders();
}

module.exports = { seedOrders };
