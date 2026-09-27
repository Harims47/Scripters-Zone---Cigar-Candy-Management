-- CreateTable
CREATE TABLE "sales_targets" (
    "id" TEXT NOT NULL,
    "salesman_id" TEXT NOT NULL,
    "target_date" DATE NOT NULL,
    "daily_revenue_target" DECIMAL(14,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sales_target_products" (
    "id" TEXT NOT NULL,
    "sales_target_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "target_quantity" DECIMAL(12,2) NOT NULL,
    "uom" "Uom" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_target_products_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sales_targets_salesman_id_idx" ON "sales_targets"("salesman_id");

-- CreateIndex
CREATE INDEX "sales_targets_target_date_idx" ON "sales_targets"("target_date");

-- CreateIndex
CREATE INDEX "sales_targets_active_idx" ON "sales_targets"("active");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_salesman_id_target_date_key" ON "sales_targets"("salesman_id", "target_date");

-- CreateIndex
CREATE INDEX "sales_target_products_sales_target_id_idx" ON "sales_target_products"("sales_target_id");

-- CreateIndex
CREATE INDEX "sales_target_products_product_id_idx" ON "sales_target_products"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "sales_target_products_sales_target_id_product_id_key" ON "sales_target_products"("sales_target_id", "product_id");

-- AddForeignKey
ALTER TABLE "sales_targets" ADD CONSTRAINT "sales_targets_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_products" ADD CONSTRAINT "sales_target_products_sales_target_id_fkey" FOREIGN KEY ("sales_target_id") REFERENCES "sales_targets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sales_target_products" ADD CONSTRAINT "sales_target_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
