const { PrismaClient } = require('@prisma/client');

// Instance Prisma partagée pour éviter les redéclarations
const database = new PrismaClient();

module.exports = database;
