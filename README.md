# Scripters Zone — Cigar & Candy Management

A production-grade Operational Management System for Concessionaire & Distribution Operations (Candy & Cigarette — GPI • Fereo • IPM).

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, Vite, React Router, Lucide Icons, Vanilla CSS Design System
- **Backend:** Node.js, TypeScript, Fastify, Prisma ORM, Argon2id, Fastify JWT & Cookies
- **Database:** PostgreSQL 16+
- **Testing & Tooling:** Vitest, Playwright, Oxlint

---

## 📁 Repository Structure

```text
├── src/                    # Frontend source code (React + TypeScript)
│   ├── components/         # Reusable UI components & layouts
│   ├── context/            # Application state management (HubContext, ToastContext)
│   ├── services/           # Backend API integration client & domain services
│   └── views/              # View layers (Admin, Salesman, Authentication)
├── public/                 # Static assets
├── backend/                # Backend API service (Fastify + Prisma)
│   ├── prisma/             # Prisma schema, migrations, and seed scripts
│   ├── scripts/            # Operational & maintenance utilities
│   ├── src/                # Backend application code (modules, plugins, routes)
│   └── tests/              # Backend integration and unit test suites
├── e2e/                    # Playwright end-to-end integration tests
├── .env.example            # Frontend environment variable template
├── backend/.env.example    # Backend environment variable template
├── render.yaml             # Render infrastructure Blueprint specification
└── package.json            # Root frontend package definition
```

---

## 🚀 Local Development Setup

### 1. Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm or pnpm

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and supply your local database credentials and secrets

# Generate Prisma client and apply database migrations
npx prisma generate
npx prisma migrate dev

# Start development server with hot-reload
npm run dev
```
Backend runs by default at `http://localhost:4000`. Health check is available at `http://localhost:4000/health`.

### 3. Frontend Setup
```bash
# In the root repository directory
npm install

# Configure environment variables
cp .env.example .env.local
# Set VITE_API_BASE_URL=http://localhost:4000

# Start Vite development server
npm run dev
```
Frontend runs by default at `http://localhost:5173`.

---

## ⚙️ Environment Variables

Never commit `.env` or production credentials to source control. Use the provided `.env.example` templates:

### Backend (`backend/.env.example`)
| Variable | Description | Example / Notes |
| :--- | :--- | :--- |
| `ENVIRONMENT` | Application mode | `production` / `development` |
| `PORT` | Listening port | Render sets this automatically (e.g. `10000`) |
| `HOST` | Binding interface | `0.0.0.0` for containerized hosting |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:password@host:5432/dbname` |
| `JWT_SECRET` | Primary JWT signing key | Minimum 32-character random string |
| `JWT_REFRESH_SECRET` | Refresh token secret | Minimum 32-character random string |
| `ACCESS_TOKEN_EXPIRE`| Token duration | `15m` |
| `REFRESH_TOKEN_EXPIRE`| Refresh duration | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `https://your-frontend.onrender.com` |
| `FRONTEND_URL` | Primary production frontend URL | `https://your-frontend.onrender.com` |
| `COOKIE_SAME_SITE` | Cookie cross-site policy | `none` (production cross-domain) / `lax` (local) |

### Frontend (`.env.example`)
| Variable | Description | Example / Notes |
| :--- | :--- | :--- |
| `VITE_API_BASE_URL` | Target Backend API URL | `https://your-backend.onrender.com` |

---

## 🗄️ Database Migrations

For production environments, **always use `migrate deploy`**:

```bash
cd backend
npx prisma migrate deploy
```

> **Warning:** Never run `prisma migrate reset` or `prisma db push` in production environments as these operations can cause irreversible data loss.

---

## ☁️ Production Deployment on Render

This repository is pre-configured for automated deployment using `render.yaml`:

1. **Backend Web Service (`crackers-hub-backend`)**:
   - Runtime: `Node`
   - Root Directory: `backend`
   - Build Command: `npm install && npx prisma generate && npm run build`
   - Pre-Deploy Command: `npx prisma migrate deploy`
   - Start Command: `npm run start`
   - Health Check Path: `/health`

2. **Frontend Static Site (`crackers-hub-frontend`)**:
   - Runtime: `Static Site`
   - Root Directory: `.`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `dist`
   - SPA Routing: Configured with `/*` rewrite to `/index.html`

3. **Managed PostgreSQL (`crackers-hub-db`)**:
   - PostgreSQL 16
   - Automatically connected to backend via `DATABASE_URL`

---

## 🔒 Security Architecture

- **Authentication:** Dual-token JWT architecture with cryptographic passwords hashed via Argon2id.
- **Cookie Security:** Tokens managed via `HttpOnly`, `SameSite=None`, and `Secure` cookies in production.
- **Zero Secrets in Repository:** Codebase contains zero hardcoded API keys, tokens, or credentials.
- **Clean Production Database:** Clean schema ready for immediate real business data entry with zero demo or seed pollution.
