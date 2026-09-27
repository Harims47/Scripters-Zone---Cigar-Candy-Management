-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Uom" ADD VALUE 'PACKET';
ALTER TYPE "Uom" ADD VALUE 'HANGER';
ALTER TYPE "Uom" ADD VALUE 'BOX';

-- CreateTable
CREATE TABLE "initial_stocks" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "uom" "Uom" NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initial_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "initial_stocks_product_id_key" ON "initial_stocks"("product_id");

-- CreateIndex
CREATE INDEX "initial_stocks_product_id_idx" ON "initial_stocks"("product_id");

-- AddForeignKey
ALTER TABLE "initial_stocks" ADD CONSTRAINT "initial_stocks_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
