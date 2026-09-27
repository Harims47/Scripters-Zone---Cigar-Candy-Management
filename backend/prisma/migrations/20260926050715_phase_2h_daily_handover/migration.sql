-- CreateEnum
CREATE TYPE "HandoverRecipientType" AS ENUM ('SALESMAN', 'DEALER');

-- CreateEnum
CREATE TYPE "HandoverStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'REVIEWED', 'SETTLED', 'SHORT', 'EXCESS');

-- CreateTable
CREATE TABLE "daily_handovers" (
    "id" TEXT NOT NULL,
    "recipient_type" "HandoverRecipientType" NOT NULL,
    "salesman_id" TEXT,
    "dealer_id" TEXT,
    "handover_date" DATE NOT NULL,
    "status" "HandoverStatus" NOT NULL DEFAULT 'DRAFT',
    "customer_name" TEXT,
    "customer_phone" TEXT,
    "gross_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total_item_discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_sales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "free_item_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "empty_packet_benefit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "coupon_benefit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "expected_handover" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cash_collected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gpay_collected" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "collection_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "outstanding" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "excess" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "submitted_by" TEXT,
    "reviewed_by" TEXT,
    "submitted_at" TIMESTAMP(3),
    "reviewed_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_handover_items" (
    "id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "uom" "Uom" NOT NULL,
    "opening_quantity" DECIMAL(12,2) NOT NULL,
    "closing_quantity" DECIMAL(12,2) NOT NULL,
    "sales_quantity" DECIMAL(12,2) NOT NULL,
    "free_quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "chargeable_quantity" DECIMAL(12,2) NOT NULL,
    "rate" DECIMAL(12,2) NOT NULL,
    "gross_amount" DECIMAL(14,2) NOT NULL,
    "free_item_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "net_amount" DECIMAL(14,2) NOT NULL,
    "base_sales_quantity" DECIMAL(12,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_handover_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_handover_empty_packets" (
    "id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "product_id" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL,
    "actual_amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_handover_empty_packets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_handover_coupons" (
    "id" TEXT NOT NULL,
    "handover_id" TEXT NOT NULL,
    "product_id" TEXT,
    "denomination" DECIMAL(12,2) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_handover_coupons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_handovers_recipient_type_idx" ON "daily_handovers"("recipient_type");

-- CreateIndex
CREATE INDEX "daily_handovers_salesman_id_idx" ON "daily_handovers"("salesman_id");

-- CreateIndex
CREATE INDEX "daily_handovers_dealer_id_idx" ON "daily_handovers"("dealer_id");

-- CreateIndex
CREATE INDEX "daily_handovers_handover_date_idx" ON "daily_handovers"("handover_date");

-- CreateIndex
CREATE INDEX "daily_handovers_status_idx" ON "daily_handovers"("status");

-- CreateIndex
CREATE UNIQUE INDEX "daily_handovers_salesman_id_handover_date_key" ON "daily_handovers"("salesman_id", "handover_date");

-- CreateIndex
CREATE INDEX "daily_handover_items_handover_id_idx" ON "daily_handover_items"("handover_id");

-- CreateIndex
CREATE INDEX "daily_handover_items_product_id_idx" ON "daily_handover_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_handover_items_handover_id_product_id_key" ON "daily_handover_items"("handover_id", "product_id");

-- CreateIndex
CREATE INDEX "daily_handover_empty_packets_handover_id_idx" ON "daily_handover_empty_packets"("handover_id");

-- CreateIndex
CREATE INDEX "daily_handover_empty_packets_product_id_idx" ON "daily_handover_empty_packets"("product_id");

-- CreateIndex
CREATE INDEX "daily_handover_coupons_handover_id_idx" ON "daily_handover_coupons"("handover_id");

-- CreateIndex
CREATE INDEX "daily_handover_coupons_product_id_idx" ON "daily_handover_coupons"("product_id");

-- AddForeignKey
ALTER TABLE "daily_handovers" ADD CONSTRAINT "daily_handovers_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handovers" ADD CONSTRAINT "daily_handovers_dealer_id_fkey" FOREIGN KEY ("dealer_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_items" ADD CONSTRAINT "daily_handover_items_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "daily_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_items" ADD CONSTRAINT "daily_handover_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_empty_packets" ADD CONSTRAINT "daily_handover_empty_packets_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "daily_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_empty_packets" ADD CONSTRAINT "daily_handover_empty_packets_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_coupons" ADD CONSTRAINT "daily_handover_coupons_handover_id_fkey" FOREIGN KEY ("handover_id") REFERENCES "daily_handovers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_handover_coupons" ADD CONSTRAINT "daily_handover_coupons_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
