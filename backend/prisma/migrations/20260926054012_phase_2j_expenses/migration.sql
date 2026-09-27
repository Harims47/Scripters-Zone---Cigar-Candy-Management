-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('OFFICE', 'HOUSE', 'GPI');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expense_date" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_expense_date_idx" ON "expenses"("expense_date");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_created_at_idx" ON "expenses"("created_at");
