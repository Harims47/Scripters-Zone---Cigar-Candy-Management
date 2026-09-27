-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('PAID');

-- CreateTable
CREATE TABLE "salesman_attendances" (
    "id" TEXT NOT NULL,
    "salesman_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesman_attendances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salesman_salaries" (
    "id" TEXT NOT NULL,
    "salesman_id" TEXT NOT NULL,
    "salary_month" DATE NOT NULL,
    "base_salary" DECIMAL(14,2) NOT NULL,
    "salary_recovery" DECIMAL(14,2) NOT NULL,
    "net_salary" DECIMAL(14,2) NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'PAID',
    "paid_date" DATE NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "salesman_salaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "salesman_attendances_salesman_id_idx" ON "salesman_attendances"("salesman_id");

-- CreateIndex
CREATE INDEX "salesman_attendances_attendance_date_idx" ON "salesman_attendances"("attendance_date");

-- CreateIndex
CREATE INDEX "salesman_attendances_status_idx" ON "salesman_attendances"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salesman_attendances_salesman_id_attendance_date_key" ON "salesman_attendances"("salesman_id", "attendance_date");

-- CreateIndex
CREATE INDEX "salesman_salaries_salesman_id_idx" ON "salesman_salaries"("salesman_id");

-- CreateIndex
CREATE INDEX "salesman_salaries_salary_month_idx" ON "salesman_salaries"("salary_month");

-- CreateIndex
CREATE INDEX "salesman_salaries_status_idx" ON "salesman_salaries"("status");

-- CreateIndex
CREATE UNIQUE INDEX "salesman_salaries_salesman_id_salary_month_key" ON "salesman_salaries"("salesman_id", "salary_month");

-- AddForeignKey
ALTER TABLE "salesman_attendances" ADD CONSTRAINT "salesman_attendances_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salesman_salaries" ADD CONSTRAINT "salesman_salaries_salesman_id_fkey" FOREIGN KEY ("salesman_id") REFERENCES "persons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
