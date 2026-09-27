-- CreateEnum
CREATE TYPE "IssueRecipientType" AS ENUM ('SALESMAN', 'DEALER');

-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'ISSUE';

-- AlterTable
ALTER TABLE "stock_movements" ADD COLUMN     "issue_stock_id" TEXT;

-- CreateTable
CREATE TABLE "issue_stocks" (
    "id" TEXT NOT NULL,
    "recipient_type" "IssueRecipientType" NOT NULL,
    "salesman_id" TEXT,
    "dealer_id" TEXT,
    "issue_date" DATE NOT NULL,
    "total_issued_value" DECIMAL(14,2) NOT NULL,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_stock_items" (
    "id" TEXT NOT NULL,
    "issue_stock_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "uom" "Uom" NOT NULL,
    "sales_rate" DECIMAL(12,2) NOT NULL,
    "issued_value" DECIMAL(14,2) NOT NULL,
    "base_quantity" DECIMAL(12,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "issue_stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issue_stocks_recipient_type_idx" ON "issue_stocks"("recipient_type");

-- CreateIndex
CREATE INDEX "issue_stocks_salesman_id_idx" ON "issue_stocks"("salesman_id");

-- CreateIndex
CREATE INDEX "issue_stocks_dealer_id_idx" ON "issue_stocks"("dealer_id");

-- CreateIndex
CREATE INDEX "issue_stocks_issue_date_idx" ON "issue_stocks"("issue_date");

-- CreateIndex
CREATE INDEX "issue_stock_items_issue_stock_id_idx" ON "issue_stock_items"("issue_stock_id");

-- CreateIndex
CREATE INDEX "issue_stock_items_product_id_idx" ON "issue_stock_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_stock_items_issue_stock_id_product_id_key" ON "issue_stock_items"("issue_stock_id", "product_id");

-- CreateIndex
CREATE INDEX "stock_movements_issue_stock_id_idx" ON "stock_movements"("issue_stock_id");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_issue_stock_id_fkey" FOREIGN KEY ("issue_stock_id") REFERENCES "issue_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_stocks" ADD CONSTRAINT "issue_stocks_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_stocks" ADD CONSTRAINT "issue_stocks_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_stock_items" ADD CONSTRAINT "issue_stock_items_issue_stock_id_fkey" FOREIGN KEY ("issue_stock_id") REFERENCES "issue_stocks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_stock_items" ADD CONSTRAINT "issue_stock_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
