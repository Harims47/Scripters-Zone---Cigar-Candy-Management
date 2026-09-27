-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'SALESMAN');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('SALESMAN', 'DEALER', 'STAFF');

-- CreateEnum
CREATE TYPE "ProductCategory" AS ENUM ('CANDY', 'CIGARETTE');

-- CreateEnum
CREATE TYPE "Uom" AS ENUM ('JAR', 'POCKET', 'M', 'CASE');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "person_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "persons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "type" "PersonType" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "persons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT,
    "name" TEXT NOT NULL,
    "category" "ProductCategory" NOT NULL,
    "brand" TEXT NOT NULL,
    "base_uom" "Uom" NOT NULL,
    "sales_uom" "Uom" NOT NULL,
    "purchase_uom" "Uom" NOT NULL,
    "standard_purchase_price" DECIMAL(12,2) NOT NULL,
    "sales_rate" DECIMAL(12,2) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_uom_conversions" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "from_uom" "Uom" NOT NULL,
    "to_uom" "Uom" NOT NULL,
    "conversion_factor" DECIMAL(12,4) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_uom_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_person_id_key" ON "users"("person_id");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_is_active_idx" ON "users"("is_active");

-- CreateIndex
CREATE INDEX "persons_type_idx" ON "persons"("type");

-- CreateIndex
CREATE INDEX "persons_active_idx" ON "persons"("active");

-- CreateIndex
CREATE INDEX "persons_phone_idx" ON "persons"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE INDEX "products_category_idx" ON "products"("category");

-- CreateIndex
CREATE INDEX "products_brand_idx" ON "products"("brand");

-- CreateIndex
CREATE INDEX "products_active_idx" ON "products"("active");

-- CreateIndex
CREATE INDEX "product_uom_conversions_product_id_idx" ON "product_uom_conversions"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_uom_conversions_product_id_from_uom_to_uom_key" ON "product_uom_conversions"("product_id", "from_uom", "to_uom");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_person_id_fkey" FOREIGN KEY ("person_id") REFERENCES "persons"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_uom_conversions" ADD CONSTRAINT "product_uom_conversions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
