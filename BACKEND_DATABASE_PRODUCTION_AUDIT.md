# PHASE 1: BACKEND & DATABASE PRODUCTION AUDIT
## Candy & Cigarette Management System
**Document Version:** 1.0.0 — Production Blueprint  
**Status:** AUDIT & ARCHITECTURE BLUEPRINT ONLY (Implementation Locked)  
**Target Stack:** FastAPI (Python 3.11+) | PostgreSQL 16+ | SQLAlchemy 2.0 (Async) | Pydantic v2 | Alembic  

---

## 1. CURRENT ARCHITECTURE AUDIT

### 1.1 Overview & Topology
The current application is a single-page React 18+ TypeScript application bundled with Vite. It functions entirely client-side, with all state, business calculations, persistence, and role simulation residing in browser memory and `localStorage`.

```
[ Browser Client / React SPA ]
       │
       ├── State & Context (HubContext.tsx)
       │     ├── In-Memory State Hooks
       │     └── Browser LocalStorage ('CANDY_CIGARETTE_FINAL_FLOW_V3_*')
       ├── Client-Side Calculations (handoverCalculation.ts, inventoryConversion.ts)
       └── Mock Role Simulation (ActiveSession: ADMIN | SALESMAN)
```

### 1.2 Identified Architecture Strengths
1. **Mathematical Consistency**: The client calculations for row math (`calculateRow`), handover reconciliation (`calculateHandover`), and inventory unit conversion (`toBaseQuantity`) have been hardened through automated test suites (`test_phase2_verification.ts`).
2. **Clear Separation of Role Views**: Admin screens (`src/views/admin/`) and Salesman screens (`src/views/salesman/`) are segregated logically with role-conditional routing in `App.tsx` and `AppShell.tsx`.
3. **Explicit Domain Models**: `src/types/index.ts` provides comprehensive domain models covering inventory, stock movements, handovers, outstanding ledgers, attendance, advances, salaries, and sales targets.

### 1.3 Critical Deficiencies for Production Readiness
1. **Zero Backend Authority**: All business decisions (discount validation, stock deduction, handover settlements, ledger postings) occur in the browser. A malicious or compromised client can forge transactions, bypass stock checks, or alter financial balances.
2. **Plaintext LocalStorage Storage**: Sensitive business operations, salary amounts, employee details, and sales ledgers are stored unencrypted in browser `localStorage`.
3. **Mock Authentication**: Authentication consists of selecting a dropdown account in `LoginPage.tsx` and storing `{ role, personId, name }` in `localStorage`. There are no cryptographic tokens (JWT/PASETO), no password hashing (Argon2/bcrypt), no session expiration, and no CSRF protection.
4. **No Concurrency / Race Condition Protections**: Two users issuing stock or submitting handovers simultaneously will overwrite each other's data without optimistic locking or ACID isolation.
5. **Client-Side Aggregation Limits**: Reports and dashboard KPIs fetch entire collections into browser memory and iterate with `.reduce()` and `.filter()`. With tens of thousands of transaction rows in production, browser performance will degrade drastically.

---

## 2. MODULE INVENTORY

| Module Name | Existing View/Component | Primary Users | Inputs | Core Outputs | Key Database Tables Needed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Authentication & Session** | `LoginPage.tsx`, `AppShell.tsx` | Admin, Salesman | Email/Username, Password | Access Token, User Session | `users`, `user_sessions`, `audit_logs` |
| **Product Master** | `ProductsCatalogView.tsx`, `ProductFormModal.tsx` | Admin | SKU, Name, Category, Brand, UOMs, Purchase Price, Rate, Case Conversion | Product Catalog Record | `products`, `product_uom_conversions` |
| **Staff & Persons** | `StaffDirectoryView.tsx`, `DealersListView.tsx`, `SalesmenListView.tsx` | Admin | Name, Phone, Role (Salesman/Dealer), Base Salary, Notes | Person Master Record | `persons` |
| **Initial Stock Setup** | `InventoryView.tsx` (Tab 4) | Admin (One-time) | Product, Quantity, UOM, Unit Cost, Date, Notes | Opening Stock Movement | `initial_stocks`, `stock_movements` |
| **Procurement (PO / Stock-In / Invoice)** | `InventoryView.tsx` (Tabs 1-3) | Admin | Supplier, Date, Product Items, Qty, Rate, Purchase Discount | PO, Stock Receipt, Purchase Invoice | `purchase_orders`, `purchase_order_items`, `stock_receipts`, `stock_receipt_items`, `purchase_invoices`, `purchase_invoice_items`, `stock_movements` |
| **Stock Issue** | `QuantityIssuesView.tsx`, `IssueQuantityModal.tsx` | Admin | Recipient (Salesman/Dealer), Date, Products, Quantities, Notes | Issue Record, Deducted Stock Movement | `stock_issues`, `stock_issue_items`, `stock_movements` |
| **Sales Targets** | `SalesTargetsView.tsx` | Admin | Salesman, Type (Value/Quantity), Target Amount/Qty, Date (if Qty), Notes | Target Record | `sales_targets` |
| **Daily Handover (Salesman)** | `SalesmanHandoverView.tsx`, `HandoverEntryForm.tsx` | Salesman | Date, Product Rows (Opening, Closing, Free, Discount), Empty Pocket Items, Coupon Items | Submitted Handover (`SUBMITTED`) | `daily_handovers`, `daily_handover_items`, `handover_allowances` |
| **Daily Handover (Dealer)** | `DealerSalesView.tsx`, `HandoverEntryForm.tsx` | Admin | Dealer, Date, Customer Name/Phone, Product Rows, Cash/GPay Collection | Completed Dealer Handover (`COMPLETED`) | `daily_handovers`, `daily_handover_items`, `handover_collections`, `stock_movements` |
| **Admin Collection & Verification** | `HandoverHubView.tsx` | Admin | Handover ID, Cash Collected, GPay Collected, Notes | Settled Handover (`COLLECTED`/`SHORT`/`EXCESS`), Outstanding Entry | `daily_handovers`, `handover_collections`, `salesman_ledger_entries`, `outstandings` |
| **Salesman Financial Ledger** | `SalesmanLedgerView.tsx`, `OutstandingPaymentModal.tsx` | Admin | Salesman, Transaction Type, Debit, Credit, Reference, Notes | Audited Ledger Transaction, Outstanding Payment | `salesman_ledger_entries`, `advances`, `outstanding_payments` |
| **Staff Attendance** | `StaffAttendanceView.tsx` | Admin | Staff ID, Date, Status (`PRESENT`, `ABSENT`, `LOP`, `LEAVE`, `HALF_DAY`), Notes | Attendance Daily Record | `staff_attendance` |
| **Salary Management** | `SalaryManagementView.tsx` | Admin | Person, Month, Base Salary, Attendance Adj, LOP Ded, Ledger Recovery, Net Salary | Salary Disbursement Record, Linked Ledger Credit | `salary_records`, `salesman_ledger_entries` |
| **Expenses** | `ExpensesView.tsx` | Admin | Date, Category (`Office`, `House`, `GPI`, etc.), Amount, Description, Notes | Expense Voucher | `expenses` |
| **Reports Hub** | `ReportsView.tsx` | Admin | Date Range, Filters (Salesman, Dealer, Product, Category) | 16 Tabular Reports, COGS, Net Profit | All Domain Tables (Aggregations) |

---

## 3. AUTHORITATIVE BUSINESS RULES

### 3.1 Role & Security Rules
1. **Two Login Roles Only**: Only `ADMIN` and `SALESMAN` have user accounts and credentials.
2. **Dealers Have No Login**: Dealers are non-login customer records managed exclusively by Admin.
3. **Data Isolation**: A Salesman can ONLY view and submit his own stock, handovers, targets, and ledger history. He cannot see peer salesmen, dealers, purchase costs, inventory margins, or central expenses.
4. **Backend Enforcement**: Route hiding in the React SPA is for UX only. The FastAPI backend must validate JWT claims and enforce entity ownership on every endpoint.

### 3.2 Handover Mathematical Rules
Every daily handover row and total MUST adhere to the following formulas without exception:
1. $\text{Sales} = \max(0, \text{Opening} - \text{Closing})$
2. $\text{Chargeable Quantity} = \max(0, \text{Sales} - \text{Free})$
3. $\text{Gross Sales} = \text{Chargeable Quantity} \times \text{Rate}$
4. $\text{Free Item Value} = \text{Free Quantity} \times \text{Rate}$ *(Informational display only; must NOT be subtracted from Gross Sales).*
5. $\text{Net Sales} = \max(0, \text{Gross Sales} - \text{Manual Item Discounts})$
6. $\text{Expected Handover} = \max(0, \text{Net Sales} - \text{Total Empty Pocket Benefit} - \text{Total Coupon Benefit})$
7. $\text{Difference} = \text{Expected Handover} - (\text{Cash Collected} + \text{GPay Collected})$
8. If $\text{Difference} > 0$: $\text{Outstanding} = \text{Difference}$, $\text{Excess} = 0$, $\text{Status} = \text{'SHORT'}$.
9. If $\text{Difference} < 0$: $\text{Outstanding} = 0$, $\text{Excess} = |\text{Difference}|$, $\text{Status} = \text{'EXCESS'}$.
10. If $\text{Difference} = 0$: $\text{Outstanding} = 0$, $\text{Excess} = 0$, $\text{Status} = \text{'COLLECTED'}$.

### 3.3 Allowance & Rebate Rules
1. **Optional per Product**: Empty pockets and coupons are NOT applied globally across all catalog products. Only products explicitly chosen during handover entry have allowance records.
2. **Actual User-Entered Valuation**: There is NO enforced fixed formula or master rate for allowances. The user inputs the actual physical count and the actual financial benefit amount agreed in the field.

### 3.4 Target Rules
1. **Exclusively for Salesmen**: Dealers never have sales targets.
2. **Standing Fixed Daily Revenue Target**: Overall revenue targets (`VALUE`) are standing/fixed per salesman without date constraints. They apply every day until explicitly modified by Admin.
3. **Date-Specific Product Targets**: Product quantity targets (`QUANTITY`) are promotional/temporary and fixed to a specific target date.

---

## 4. DATABASE SCHEMA PROPOSAL (POSTGRESQL)

```
                            ┌────────────────┐
                            │    tenants     │
                            └───────┬────────┘
                                    │ 1
                                    │
           ┌────────────────────────┼────────────────────────┐
           │ *                      │ *                      │ *
   ┌───────┴────────┐       ┌───────┴────────┐       ┌───────┴────────┐
   │     users      │       │    persons     │       │    products    │
   └───────┬────────┘       └───────┬────────┘       └───────┬────────┘
           │ 1                      │ 1                      │ 1
           │                        │                        │
           │ *                      │ *                      │ *
   ┌───────┴────────┐       ┌───────┴────────┐       ┌───────┴────────┐
   │ user_sessions  │       │daily_handovers ├───────┤ stock_movements│
   └────────────────┘       └───────┬────────┘ *     └────────────────┘
                                    │ 1
                            ┌───────┴────────┐
                            │ handover_items │
                            └────────────────┘
```

### Table 1: `tenants` (Multi-Client Readiness)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique tenant identifier |
| `name` | `VARCHAR(150)` | `NOT NULL` | Client business name (e.g. "Crackers Hub Central") |
| `code` | `VARCHAR(50)` | `NOT NULL, UNIQUE` | Unique client slug |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Active subscription flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record creation timestamp |

### Table 2: `users`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique user ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id) ON DELETE RESTRICT` | Multi-client tenant reference |
| `email` | `VARCHAR(255)` | `NOT NULL` | Login email (unique per tenant) |
| `password_hash`| `VARCHAR(255)` | `NOT NULL` | Argon2id or bcrypt password hash |
| `role` | `VARCHAR(20)` | `NOT NULL` | Check constraint: `role IN ('ADMIN', 'SALESMAN')` |
| `person_id` | `UUID` | `NULLABLE, REFERENCES persons(id) ON DELETE SET NULL` | Linked person record (for Salesman) |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Account status flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Last update timestamp |

*Unique Index*: `UNIQUE(tenant_id, email)`

### Table 3: `persons`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique person ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id) ON DELETE RESTRICT` | Tenant boundary |
| `name` | `VARCHAR(150)` | `NOT NULL` | Full Name |
| `phone` | `VARCHAR(30)` | `NOT NULL` | Primary Phone Number |
| `role` | `VARCHAR(20)` | `NOT NULL` | Check constraint: `role IN ('SALESMAN', 'DEALER')` |
| `base_salary` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Monthly base salary (Salesman only) |
| `notes` | `TEXT` | `NULLABLE` | Profile notes |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Soft delete / active flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Creation timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Last update timestamp |

*Index*: `INDEX(tenant_id, role, is_active)`

### Table 4: `products`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique product ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id) ON DELETE RESTRICT` | Tenant boundary |
| `sku` | `VARCHAR(50)` | `NOT NULL` | Product SKU (unique per tenant) |
| `name` | `VARCHAR(150)` | `NOT NULL` | Product Commercial Name |
| `category` | `VARCHAR(20)` | `NOT NULL` | Check constraint: `category IN ('Candy', 'Cigarette')` |
| `sub_category` | `VARCHAR(50)` | `NOT NULL` | Group / Concessionaire (e.g. GPI, IPM, Fereo) |
| `brand` | `VARCHAR(100)`| `NOT NULL` | Brand identity (e.g. Four Square, Cavanders) |
| `base_uom` | `VARCHAR(20)` | `NOT NULL` | Base Unit: 'Pocket' (Cigarette) or 'Jar' (Candy) |
| `purchase_uom`| `VARCHAR(20)` | `NOT NULL` | Typical purchase unit (e.g. 'M', 'Case', 'Jar') |
| `sales_uom` | `VARCHAR(20)` | `NOT NULL` | Field sales unit (e.g. 'Pocket', 'Jar') |
| `standard_purchase_price` | `NUMERIC(10,2)` | `NOT NULL, DEFAULT 0.00` | Standard reference cost for COGS |
| `rate` | `NUMERIC(10,2)` | `NOT NULL, CHECK (rate > 0)` | Standard selling price per sales UOM |
| `case_conversion_factor` | `NUMERIC(10,2)` | `NULLABLE` | Case conversion ratio |
| `case_conversion_unit` | `VARCHAR(20)` | `NULLABLE` | Target unit for case factor ('M' or 'Pocket') |
| `is_active` | `BOOLEAN` | `NOT NULL, DEFAULT TRUE` | Active catalog flag |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Timestamp |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Timestamp |

*Unique Index*: `UNIQUE(tenant_id, sku)`

### Table 5: `stock_movements` (Auditable Stock Ledger)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique movement ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id)` | Tenant boundary |
| `date` | `DATE` | `NOT NULL` | Operational movement date |
| `product_id` | `UUID` | `NOT NULL, REFERENCES products(id)` | Targeted product |
| `transaction_type` | `VARCHAR(30)` | `NOT NULL` | `OPENING_STOCK`, `PURCHASE`, `STOCK_ISSUE`, `SALES_HANDOVER`, `ADJUSTMENT` |
| `reference` | `VARCHAR(100)`| `NOT NULL` | External reference (e.g. `ISS-2026-001`, `HND-2026-002`) |
| `display_quantity` | `NUMERIC(12,2)` | `NOT NULL` | Raw entered quantity |
| `display_uom` | `VARCHAR(20)` | `NOT NULL` | Unit entered by user |
| `base_quantity` | `NUMERIC(12,2)` | `NOT NULL` | **Normalized quantity** (Positive for additions, Negative for deductions) |
| `unit_cost` | `NUMERIC(10,2)` | `NULLABLE` | Acquisition unit cost in base unit |
| `notes` | `TEXT` | `NULLABLE` | Movement rationale |
| `created_by` | `UUID` | `NOT NULL, REFERENCES users(id)` | User executing transaction |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Audit timestamp |

*Index*: `INDEX(tenant_id, product_id, date)`

### Table 6: `stock_issues` & `stock_issue_items`
- `stock_issues`: Stores issue header (`id`, `issue_number`, `tenant_id`, `person_id`, `recipient_role`, `date`, `notes`, `created_by`, `created_at`).
- `stock_issue_items`: Stores line items (`id`, `issue_id`, `product_id`, `quantity_issued`, `uom`, `base_quantity`).

### Table 7: `daily_handovers`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique handover ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id)` | Tenant boundary |
| `handover_number`| `VARCHAR(50)`| `NOT NULL` | Sequence identifier (e.g. `HND-2026-001`) |
| `type` | `VARCHAR(20)` | `NOT NULL` | Check: `type IN ('SALESMAN', 'DEALER')` |
| `person_id` | `UUID` | `NOT NULL, REFERENCES persons(id)` | Recipient person reference |
| `date` | `DATE` | `NOT NULL` | Handover business date |
| `customer_name` | `VARCHAR(150)`| `NULLABLE` | Customer name (Mandatory if Dealer) |
| `customer_phone`| `VARCHAR(30)` | `NULLABLE` | Customer phone (Mandatory if Dealer) |
| `gross_sales` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Sum of chargeable $\times$ rate |
| `total_discount`| `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Sum of line discounts |
| `free_item_value`| `NUMERIC(12,2)`| `NOT NULL, DEFAULT 0.00` | Informational value of free units |
| `net_sales` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Gross Sales - Total Discount |
| `empty_pocket_benefit` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Total Empty Pocket rebate |
| `coupon_benefit`| `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Total Coupon rebate |
| `expected_handover` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Authoritative Net Amount Due |
| `amount_received` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Total verified received |
| `outstanding` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Shortage ($\ge 0$) |
| `excess` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Surplus ($\ge 0$) |
| `status` | `VARCHAR(30)` | `NOT NULL` | `DRAFT`, `SUBMITTED`, `COLLECTED`, `SHORT`, `EXCESS`, `COMPLETED` |
| `submitted_at` | `TIMESTAMPTZ` | `NULLABLE` | Timestamp when Salesman submitted |
| `notes` | `TEXT` | `NULLABLE` | Operational remarks |
| `created_by` | `UUID` | `NOT NULL, REFERENCES users(id)` | Creator |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Record timestamp |

### Table 8: `daily_handover_items`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Line item ID |
| `handover_id` | `UUID` | `NOT NULL, REFERENCES daily_handovers(id) ON DELETE CASCADE` | Parent handover |
| `product_id` | `UUID` | `NOT NULL, REFERENCES products(id)` | Product |
| `opening` | `NUMERIC(12,2)` | `NOT NULL, CHECK (opening >= 0)` | Starting quantity |
| `closing` | `NUMERIC(12,2)` | `NOT NULL, CHECK (closing >= 0)` | Ending physical count |
| `sales` | `NUMERIC(12,2)` | `NOT NULL, CHECK (sales >= 0)` | opening - closing |
| `free` | `NUMERIC(12,2)` | `NOT NULL, CHECK (free >= 0)` | Non-chargeable free units |
| `chargeable` | `NUMERIC(12,2)` | `NOT NULL, CHECK (chargeable >= 0)` | sales - free |
| `rate` | `NUMERIC(10,2)` | `NOT NULL, CHECK (rate >= 0)` | Selling rate per unit |
| `gross_amount` | `NUMERIC(12,2)` | `NOT NULL` | chargeable $\times$ rate |
| `free_item_value`| `NUMERIC(12,2)`| `NOT NULL` | free $\times$ rate |
| `discount` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Line item discount |
| `net_amount` | `NUMERIC(12,2)` | `NOT NULL` | gross_amount - discount |

### Table 9: `handover_allowances` (Empty Pocket & Coupon Items)
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique allowance ID |
| `handover_id` | `UUID` | `NOT NULL, REFERENCES daily_handovers(id) ON DELETE CASCADE` | Associated handover |
| `product_id` | `UUID` | `NOT NULL, REFERENCES products(id)` | Product |
| `allowance_type` | `VARCHAR(20)` | `NOT NULL` | Check: `allowance_type IN ('EMPTY_POCKET', 'COUPON')` |
| `quantity` | `NUMERIC(10,2)` | `NOT NULL, CHECK (quantity > 0)` | Physical count |
| `amount` | `NUMERIC(10,2)` | `NOT NULL, CHECK (amount > 0)` | Actual rebate value |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Audit timestamp |

### Table 10: `handover_collections`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Collection record ID |
| `handover_id` | `UUID` | `NOT NULL, REFERENCES daily_handovers(id) ON DELETE CASCADE` | Associated handover |
| `cash_amount` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Physical currency verified |
| `gpay_amount` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Digital UPI verified |
| `collected_by` | `UUID` | `NOT NULL, REFERENCES users(id)` | Admin who verified |
| `notes` | `TEXT` | `NULLABLE` | Collection notes |
| `collected_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Confirmation timestamp |

### Table 11: `salesman_ledger_entries`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Unique ledger entry ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id)` | Tenant boundary |
| `salesman_id` | `UUID` | `NOT NULL, REFERENCES persons(id)` | Sales representative |
| `date` | `DATE` | `NOT NULL` | Accounting date |
| `entry_type` | `VARCHAR(30)` | `NOT NULL` | `HANDOVER_SHORTAGE`, `ADVANCE`, `RECOVERY`, `SALARY_DEDUCTION`, `MANUAL_ADJUSTMENT` |
| `reference` | `VARCHAR(100)`| `NOT NULL` | Document ref (`HND-...`, `ADV-...`, `SAL-...`) |
| `description` | `TEXT` | `NOT NULL` | Narrative description |
| `debit` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Increases amount due from salesman |
| `credit` | `NUMERIC(12,2)` | `NOT NULL, DEFAULT 0.00` | Decreases amount due from salesman |
| `created_by` | `UUID` | `NOT NULL, REFERENCES users(id)` | Admin recording entry |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Audit timestamp |

*Note: Running balance is a computed SQL window function over ordered entries, NOT a mutable stored column.*

### Table 12: `staff_attendance`
| Column | Type | Constraints | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY, DEFAULT gen_random_uuid()` | Attendance entry ID |
| `tenant_id` | `UUID` | `NOT NULL, REFERENCES tenants(id)` | Tenant boundary |
| `person_id` | `UUID` | `NOT NULL, REFERENCES persons(id)` | Staff member |
| `date` | `DATE` | `NOT NULL` | Attendance date |
| `status` | `VARCHAR(20)` | `NOT NULL` | `PRESENT`, `ABSENT`, `LOP`, `LEAVE`, `HALF_DAY` |
| `notes` | `VARCHAR(255)` | `NULLABLE` | Route or reason notes |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL, DEFAULT NOW()` | Timestamp |

*Unique Index*: `UNIQUE(tenant_id, person_id, date)`

### Table 13: `salary_records`
- Fields: `id`, `tenant_id`, `person_id`, `month` (YYYY-MM), `base_salary`, `attendance_adjustment`, `lop_deduction`, `other_deductions`, `ledger_recovery`, `net_salary`, `paid_amount`, `payment_date`, `status` (`PENDING`, `PAID`, `PARTIAL`), `notes`, `created_at`.
*Unique Index*: `UNIQUE(tenant_id, person_id, month)`

### Table 14: `sales_targets`
- Fields: `id`, `tenant_id`, `salesman_id`, `target_type` (`VALUE`, `QUANTITY`), `period` (`DAILY`, `MONTHLY`), `date` (NULL for fixed VALUE, YYYY-MM-DD for QUANTITY), `target_value`, `product_id`, `target_quantity`, `target_uom`, `notes`, `created_at`.

### Table 15: `expenses`
- Fields: `id`, `tenant_id`, `date`, `category` (`Office`, `House`, `GPI`, `Empty Pocket`, `Coupon`, `Discount`), `amount`, `description`, `notes`, `paid_by`, `created_by`, `created_at`.

---

## 5. UOM CONVERSION ARCHITECTURE

### 5.1 Business Rules & Base Invariants
1. **Candy**: Base unit is strictly `Jar`. No sub-units exist.
2. **Cigarette**:
   - Base inventory unit is strictly `Pocket`.
   - Universal Constant: $1\text{ M} = 100\text{ Pockets}$ (fixed by tobacco standard).
   - Configurable Case Ratio: $1\text{ Case} = X\text{ M}$ or $Y\text{ Pockets}$, configured on the product record via `case_conversion_factor` and `case_conversion_unit`.

### 5.2 Normalization Formula (Stored in Base Units)
```python
def to_base_quantity(product: Product, quantity: Decimal, uom: str) -> Decimal:
    if product.category == "Candy":
        return quantity  # Jar is base
    
    uom_clean = uom.strip().lower()
    if uom_clean == "pocket":
        return quantity
    elif uom_clean == "m":
        return quantity * Decimal("100")
    elif uom_clean == "case":
        if not product.case_conversion_factor or product.case_conversion_factor <= 0:
            raise ValueError(f"Product {product.name} missing case conversion factor")
        if product.case_conversion_unit == "M":
            return quantity * product.case_conversion_factor * Decimal("100")
        else:
            return quantity * product.case_conversion_factor
    raise ValueError(f"Unsupported UOM: {uom}")
```

---

## 6. STOCK LEDGER & TRANSACTION BOUNDARIES

### 6.1 Transaction Boundaries & Invariants
Every inventory movement MUST be executed inside an ACID transaction (`BEGIN ... COMMIT`) with row-level locks (`SELECT FOR UPDATE`) on product records:

```
┌─────────────────────────────────────────────────────────────────┐
│                      ACID TRANSACTION BOUNDARY                  │
│                                                                 │
│  1. BEGIN                                                       │
│  2. Acquire row lock on product(s): SELECT FOR UPDATE           │
│  3. Calculate current base stock: SUM(base_quantity)            │
│  4. Verify availability (if deduction): current + delta >= 0    │
│  5. INSERT stock_movement row                                   │
│  6. INSERT domain record (stock_issue / handover / stock_in)    │
│  7. COMMIT                                                      │
└─────────────────────────────────────────────────────────────────┘
```

1. **Issue Stock Boundary**:
   - `stock_issues` header inserted.
   - `stock_issue_items` inserted.
   - Negative `stock_movements` rows inserted for each item.
   - If available stock is insufficient, the entire transaction rolls back with HTTP 409 Conflict.
2. **Handover Collection Boundary**:
   - Handover status transitions to `COLLECTED` / `SHORT` / `EXCESS`.
   - `handover_collections` record created.
   - If `outstanding > 0`, insert `salesman_ledger_entries` (Type: `HANDOVER_SHORTAGE`, Debit = outstanding).
   - If stock deductions occur at handover closing (for direct dealer sales), corresponding negative `stock_movements` are inserted.

---

## 7. COLLECTION & SALESMAN LEDGER DESIGN

### 7.1 Ledger Math & Double-Entry Principles
The salesman financial ledger represents what the salesman owes the business (recoverable balance).
- **Debit (+)**: Increases amount owed by salesman (e.g. Handover Cash Shortage, Cash Advance taken).
- **Credit (-)**: Decreases amount owed by salesman (e.g. Cash Repayment, Salary Deduction).

$$\text{Current Recoverable Balance} = \sum \text{Debits} - \sum \text{Credits}$$

```
                ┌─────────────────────────────────┐
                │     Salesman Debt Increases     │
                │             (DEBIT)             │
                └───────────────┬─────────────────┘
                                │
                 + Shortage from Handover Collection
                 + Cash Advance Taken
                                │
                                ▼
                ┌─────────────────────────────────┐
                │   TOTAL RECOVERABLE BALANCE     │
                └───────────────┬─────────────────┘
                                │
                 - Cash Repayment / Direct Recovery
                 - Monthly Salary Ledger Deduction
                                │
                                ▼
                ┌─────────────────────────────────┐
                │     Salesman Debt Decreases     │
                │            (CREDIT)             │
                └─────────────────────────────────┘
```

### 7.2 Handling Shortage vs Excess
1. **Shortage**: Admin collects less than Expected Handover. Outstanding is posted to `salesman_ledger_entries` as a DEBIT. Handover status is marked `SHORT`.
2. **Excess**: Admin collects more than Expected Handover. Excess amount is recorded for auditing, status is marked `EXCESS`. **No negative outstanding is ever created**.

---

## 8. PROFIT & LOSS (P&L) DATA MODEL

The P&L statement must derive strictly from database facts without frontend estimation:

$$\text{Gross Profit} = \text{Net Sales Revenue} - \text{COGS}$$
$$\text{Net Operating Profit} = \text{Gross Profit} - \text{Operating Expenses} - \text{Allowances} - \text{Staff Salaries}$$

| P&L Component | Authoritative Source Table & Column | Calculation Filter |
| :--- | :--- | :--- |
| **Gross Sales Revenue** | `daily_handovers.gross_sales` | `status IN ('COLLECTED', 'SHORT', 'EXCESS', 'COMPLETED') AND date BETWEEN :start AND :end` |
| **Sales Discounts** | `daily_handovers.total_discount` | Sum of discounts granted to field buyers |
| **Net Sales Revenue** | `daily_handovers.net_sales` | Gross Sales - Sales Discounts |
| **Cost of Goods Sold (COGS)** | `daily_handover_items.sales` $\times$ `products.standard_purchase_price` | Product sales volume $\times$ authoritative purchase cost |
| **Empty Pocket Rebates** | `handover_allowances.amount` | `allowance_type = 'EMPTY_POCKET'` |
| **Coupon Rebates** | `handover_allowances.amount` | `allowance_type = 'COUPON'` |
| **Operating Expenses** | `expenses.amount` | `date BETWEEN :start AND :end` (All operational categories) |
| **Staff Salaries** | `salary_records.net_salary` | `month = :current_month AND status = 'PAID'` |

---

## 9. API BLUEPRINT (FASTAPI SPECIFICATION)

### Authentication Endpoints
- `POST /api/v1/auth/login`: Authenticate with email/password; returns JWT access token + refresh token.
- `POST /api/v1/auth/refresh`: Refresh expired access token.
- `GET /api/v1/auth/me`: Return current user profile, role, and tenant context.

### Products & Catalog Endpoints
- `GET /api/v1/products`: List products (Filters: category, sub_category, active).
- `POST /api/v1/products`: Create product (Admin only).
- `GET /api/v1/products/{id}`: Product detail.
- `PUT /api/v1/products/{id}`: Update product (Admin only).
- `DELETE /api/v1/products/{id}`: Soft-delete / deactivate product.

### Inventory & Stock Movement Endpoints
- `GET /api/v1/inventory/movements`: Audited stock movement ledger.
- `GET /api/v1/inventory/stock-balance`: Current computed stock balance by product.
- `POST /api/v1/inventory/initial-stock`: Initial system opening stock establishment (Admin only, one-time).
- `POST /api/v1/inventory/issues`: Execute Stock Issue to Salesman or Dealer.
- `GET /api/v1/inventory/issues`: List stock issue history.

### Daily Handover Endpoints
- `GET /api/v1/handovers`: List handovers (Salesman sees own; Admin sees all).
- `POST /api/v1/handovers`: Create/submit daily handover.
- `GET /api/v1/handovers/{id}`: Full handover document with product lines and allowances.
- `POST /api/v1/handovers/{id}/collect`: Admin collection confirmation (Cash & GPay verification).

### Sales Targets Endpoints
- `GET /api/v1/targets`: List sales targets (Salesman sees own; Admin sees all).
- `POST /api/v1/targets`: Assign/update sales target (Admin only).
- `PUT /api/v1/targets/{id}`: Edit sales target (Admin only).
- `DELETE /api/v1/targets/{id}`: Delete sales target (Admin only).

### Staff & Ledger Endpoints
- `GET /api/v1/ledger/{salesman_id}`: Salesman ledger transactions and current balance.
- `POST /api/v1/ledger/advances`: Record cash advance issued to salesman.
- `GET /api/v1/attendance`: Monthly attendance matrix.
- `POST /api/v1/attendance/bulk`: Bulk record daily attendance for staff.
- `GET /api/v1/salaries`: Monthly payroll list.
- `POST /api/v1/salaries`: Process salary disbursement with ledger recovery.

### Reports Endpoints
- `GET /api/v1/reports/profit-loss`: Authoritative P&L Statement.
- `GET /api/v1/reports/empty-pocket`: Monthly Empty Pocket summary.
- `GET /api/v1/reports/coupon`: Monthly Coupon summary.
- `GET /api/v1/reports/item-wise`: Item-wise volume and gross/net revenue analysis.

---

## 10. BUSINESS RULE CONFLICT REPORT

During our thorough audit of the frontend code against the approved business rules, the following critical discrepancies were uncovered:

### Conflict 1: Empty Pocket & Coupon Rate Calculation in Legacy Views
- **Current Behaviour**: `src/views/admin/ProductsCatalogView.tsx` and legacy exports still contain table columns for `Empty Pocket Value (₹)` and `Coupon Value (₹)`.
- **Expected Behaviour**: As confirmed in Section 4 & Section 13, allowances are NOT master product rates; they are entered on-the-fly during handover entry only for products that actually have returns.
- **Impact**: Exporting or viewing these columns suggests a fixed rate exists on the product master, confusing operations.
- **Recommended Fix**: Remove the `Empty Pocket Val` and `Coupon Val` columns from `ProductsCatalogView.tsx` tables and export templates, aligning with the form edit completed in Phase 1.

### Conflict 2: Dealer Customer Details Validation
- **Current Behaviour**: `DealerSalesView.tsx` allows entering customer name and phone, but `HandoverEntryForm.tsx` treats them as optional text fields.
- **Expected Behaviour**: Dealer sales are wholesale commercial events and MUST record the legal purchasing buyer/business name and contact number for audit and tax reconciliation.
- **Impact**: Incomplete dealer transactions without verifiable counter-party details.
- **Recommended Fix**: Backend validation rule: when `handover.type == 'DEALER'`, `customer_name` and `customer_phone` are strictly `NOT NULL` and validated with regex.

### Conflict 3: Mutable Running Balance in Mock Ledger
- **Current Behaviour**: `SalesmanLedgerEntry` interface in `src/types/index.ts` stores a mutable `runningBalance` number on each row.
- **Expected Behaviour**: In accounting systems, storing running balance directly on each row leads to corruption if past entries are amended or re-ordered.
- **Impact**: Ledger balance desynchronization.
- **Recommended Fix**: Store only `debit` and `credit`. The backend calculates running balance dynamically via window functions (`SUM(debit - credit) OVER (PARTITION BY salesman_id ORDER BY date, created_at)`).

---

## 11. PRODUCTION DEPLOYMENT & BACKUP BLUEPRINT

### 11.1 Infrastructure Architecture
- **Web / Reverse Proxy**: Nginx 1.24+ with TLS 1.3, HSTS, rate limiting (`limit_req_zone`), and Gzip/Brotli compression.
- **Application Server**: Uvicorn running 4 Gunicorn worker processes for FastAPI.
- **Database**: PostgreSQL 16 on Ubuntu Linux with connection pooling (`pgbouncer` or SQLAlchemy async pool size: 20, max_overflow: 10).
- **Process Manager**: `systemd` services for FastAPI backend and automated maintenance cron.

### 11.2 Automated Backup Policy
1. **Daily Full Logical Dump**: Executed daily at 02:00 AM via `pg_dump -Fc` compressed binary format.
2. **Retention Strategy**:
   - Keep 7 daily backups locally.
   - Keep 4 weekly backups on off-site encrypted S3 storage.
   - Keep 12 monthly backups for accounting compliance.
3. **Point-In-Time Recovery (PITR)**: Enable PostgreSQL WAL archiving (`archive_mode = on`, `archive_command = 'test ! -f /var/lib/postgresql/wal_archive/%f && cp %p /var/lib/postgresql/wal_archive/%f'`).

---

## 12. RECAP: AUDIT SUMMARY & NEXT STEPS

### AUDIT COMPLETE

#### A. Tables to Create in PostgreSQL
1. `tenants`
2. `users`
3. `user_sessions`
4. `persons`
5. `products`
6. `stock_movements`
7. `stock_issues`
8. `stock_issue_items`
9. `daily_handovers`
10. `daily_handover_items`
11. `handover_allowances`
12. `handover_collections`
13. `outstandings`
14. `outstanding_payments`
15. `salesman_ledger_entries`
16. `advances`
17. `staff_attendance`
18. `salary_records`
19. `sales_targets`
20. `expenses`
21. `purchase_orders`
22. `purchase_order_items`
23. `stock_receipts`
24. `stock_receipt_items`
25. `purchase_invoices`
26. `purchase_invoice_items`
27. `audit_logs`

#### B. Tables Already Existing in Database
**None**. The current application is a pure client-side prototype. No database tables or migrations exist yet in the codebase.

#### C. APIs to Create
Total 38 REST endpoints across Auth, Products, Staff, Inventory, Handovers, Collections, Ledger, Attendance, Salaries, Expenses, and Reports as detailed in Section 9.

#### D. Frontend Areas That Must Be Connected
1. Replace `useHub()` client mutations with async TanStack React Query / Axios API calls.
2. Replace `localStorage` session handling with secure cookie/header token storage.
3. Connect `HandoverEntryForm` submission directly to `POST /api/v1/handovers`.
4. Connect `HandoverHubView` collection dialog directly to `POST /api/v1/handovers/{id}/collect`.
5. Connect `ProductsCatalogView` and `ProductFormModal` to `/api/v1/products`.
6. Connect `SalesTargetsView` to `/api/v1/targets`.

#### E. Business Rule Conflicts
- Product master empty pocket/coupon legacy columns in catalog view.
- Missing mandatory customer validation on dealer sales.
- Stored mutable running balances on ledger rows.

#### F. Risks & Mitigations
- **Concurrency on Stock Issue**: Mitigated via PostgreSQL `SELECT FOR UPDATE` pessimistic row locking.
- **Data Integrity on Network Drop**: Mitigated via atomic multi-table database transactions.
- **Client Calculation Divergence**: Backend recomputes and validates all math; client calculations serve only as instant UI feedback.

#### G. Exact Recommended Implementation Sequence (Phase 2+)
1. **Step 1**: Initialize Python FastAPI project structure with SQLAlchemy, Pydantic, and Alembic migrations.
2. **Step 2**: Apply initial Alembic migration creating the 27 PostgreSQL tables with strict constraints and foreign keys.
3. **Step 3**: Implement Authentication, JWT tokens, password hashing, and role-based dependencies.
4. **Step 4**: Implement Product Master and UOM normalization engine with full unit tests.
5. **Step 5**: Implement Inventory Stock Movement Ledger with atomic locking for issues and receipts.
6. **Step 6**: Implement Daily Handover submission and Admin split collection (`Cash` + `GPay`) workflows.
7. **Step 7**: Implement Salesman Financial Ledger, Advances, Attendance, and Salary modules.
8. **Step 8**: Implement Authoritative P&L and Reporting queries.
9. **Step 9**: Integrate React Frontend API client with the FastAPI backend, switching off mock localStorage data.
10. **Step 10**: End-to-end integration testing and production deployment hardening.
