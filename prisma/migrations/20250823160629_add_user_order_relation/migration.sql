/*
  Warnings:

  - You are about to drop the column `customerEmail` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customerFirstName` on the `Order` table. All the data in the column will be lost.
  - You are about to drop the column `customerLastName` on the `Order` table. All the data in the column will be lost.
  - Added the required column `userId` to the `Order` table without a default value. This is not possible if the table is not empty.

*/

-- Step 1: Ajouter la colonne userId comme nullable d'abord
ALTER TABLE "Order" ADD COLUMN "userId" INTEGER;

-- Step 2: Créer les utilisateurs à partir des données existantes des commandes
INSERT INTO "User" ("firstName", "lastName", "email", "password", "createdAt", "updatedAt")
SELECT DISTINCT 
    "customerFirstName", 
    "customerLastName", 
    "customerEmail", 
    'temp_password_needs_reset', -- password temporaire
    NOW(),
    NOW()
FROM "Order"
WHERE "customerEmail" NOT IN (SELECT "email" FROM "User");

-- Step 3: Mettre à jour les commandes avec les userId correspondants
UPDATE "Order" 
SET "userId" = (
    SELECT "User"."id" 
    FROM "User" 
    WHERE "User"."email" = "Order"."customerEmail"
    AND "User"."firstName" = "Order"."customerFirstName"
    AND "User"."lastName" = "Order"."customerLastName"
    LIMIT 1
);

-- Step 4: Rendre userId NOT NULL maintenant qu'il est rempli
ALTER TABLE "Order" ALTER COLUMN "userId" SET NOT NULL;

-- Step 5: Supprimer les anciennes colonnes
ALTER TABLE "Order" DROP COLUMN "customerEmail",
DROP COLUMN "customerFirstName",
DROP COLUMN "customerLastName";

-- Step 6: Ajouter la contrainte de clé étrangère
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;