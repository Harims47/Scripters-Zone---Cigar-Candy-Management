// Phase 2N.5: Database-Only Architecture
// All business datasets (Products, Persons, Invoices, Handovers, Ledgers, etc.)
// are strictly authoritative in PostgreSQL and loaded live via the Fastify API.
// Local mock data, static arrays, and offline fallback datasets have been purged.
export {};
