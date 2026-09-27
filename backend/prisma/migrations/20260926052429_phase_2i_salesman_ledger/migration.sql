-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('HANDOVER_SHORT', 'ADVANCE', 'RECOVERY', 'SALARY_DEDUCTION', 'MANUAL_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "LedgerDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "LedgerReferenceType" AS ENUM ('DAILY_HANDOVER', 'MANUAL', 'SALARY');

-- CreateTable
CREATE TABLE "salesman_ledger_transactions" (
    "id" TEXT NOT NULL,
    "salesman_id" TEXT NOT NULL,
    "transaction_date" DATE NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "direction" "LedgerDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_type" "LedgerReferenceType",
    "reference_id" TEXT,
    "daily_handover_id" TEXT,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salesman_ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_salesman_id_idx" ON "salesman_ledger_transactions"("salesman_id");

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_transaction_date_idx" ON "salesman_ledger_transactions"("transaction_date");

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_type_idx" ON "salesman_ledger_transactions"("type");

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_direction_idx" ON "salesman_ledger_transactions"("direction");

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_reference_type_idx" ON "salesman_ledger_transactions"("reference_type");

-- CreateIndex
CREATE INDEX "salesman_ledger_transactions_reference_id_idx" ON "salesman_ledger_transactions"("reference_id");

-- CreateIndex
CREATE UNIQUE INDEX "salesman_ledger_transactions_daily_handover_id_type_key" ON "salesman_ledger_transactions"("daily_handover_id", "type");

-- AddForeignKey
ALTER TABLE "salesman_ledger_transactions" ADD CONSTRAINT "salesman_ledger_transactions_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesman_ledger_transactions" ADD CONSTRAINT "salesman_ledger_transactions_daily_handover_id_fkey" FOREIGN KEY ("daily_handover_id") REFERENCES "daily_handovers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
